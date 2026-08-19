#!/usr/bin/env bash
# Tjatar tills Oracle släpper ifrån sig en Ampere A1-instans.
#
#   ./oci-launch-retry.sh --ssh-key ~/.ssh/hltv.key.pub
#
# "Out of host capacity" på VM.Standard.A1.Flex är normaltillståndet, inte ett
# fel: gratisnivån är alltid slutsåld och kapacitet frigörs stötvis när andra
# släpper sina instanser. Skriptet roterar fault domains, backar av korrekt när
# OCI rate-limitar, och säger till när det lyckats.
#
# Kräver OCI CLI med en konfigurerad profil:
#   brew install oci-cli && oci setup config

set -euo pipefail

SHAPE="VM.Standard.A1.Flex"
OCPUS=2
MEMORY_GB=12
BOOT_GB=50
NAME="hltv"
SUBNET_NAME="hltv-public"
OS_NAME="Canonical Ubuntu"
OS_VERSION="24.04 Minimal aarch64"
SSH_KEY=""
FALLBACK=""           # extra shape att växla in, format OCPU:GB
INTERVAL=180          # sekunder mellan försök vid kapacitetsbrist
MAX_BACKOFF=1800      # tak för backoff när vi blir rate-limitade

usage() {
  cat <<'TEXT'
Användning: ./oci-launch-retry.sh --ssh-key <sökväg till PUBLIK nyckel> [flaggor]

  --ssh-key FIL      Publik SSH-nyckel (.pub). Obligatorisk.
  --name NAMN        Instansens namn (standard: hltv)
  --subnet NAMN      Subnätets display name (standard: hltv-public)
  --interval SEK     Grundtakt mellan försök (standard: 180). Vid 429 backar
                     skriptet av från den och arbetar sig sedan tillbaka ner.
  --ocpus N          OCPU (standard: 2 — Always Free-taket)
  --memory N         GB minne (standard: 12 — Always Free-taket)
  --help             Visa detta
TEXT
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh-key) SSH_KEY="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --subnet) SUBNET_NAME="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --fallback) FALLBACK="$2"; shift 2 ;;
    --ocpus) OCPUS="$2"; shift 2 ;;
    --memory) MEMORY_GB="$2"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) echo "Okänd flagga: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# Storlekar att varva mellan. Att bara tjata på den största luckan är att tacka
# nej till varje mindre som råkar bli ledig under tiden.
SHAPE_VARIANTS=("$OCPUS:$MEMORY_GB")
if [[ -n "$FALLBACK" ]]; then
  [[ "$FALLBACK" =~ ^[0-9]+:[0-9]+$ ]] || {
    echo "--fallback vill ha formatet OCPU:GB, t.ex. 1:6" >&2; exit 2; }
  SHAPE_VARIANTS+=("$FALLBACK")
fi

# Grundtakten som användaren bad om. Backoff vid rate-limit får höja den
# tillfälliga takten, men aldrig den här — annars finns inget att återvända till.
BASE_INTERVAL="$INTERVAL"
interval="$INTERVAL"
LAUNCH_TIMEOUT=300    # väggklocka per launch-anrop

command -v oci >/dev/null || { echo "OCI CLI saknas. brew install oci-cli" >&2; exit 1; }
[[ -n "$SSH_KEY" ]] || { echo "--ssh-key krävs." >&2; usage >&2; exit 2; }
[[ -f "$SSH_KEY" ]] || { echo "Hittar inte $SSH_KEY" >&2; exit 1; }
grep -q '^ssh-' "$SSH_KEY" || {
  echo "$SSH_KEY ser inte ut som en publik nyckel. Peka på .pub-filen." >&2
  exit 1
}

# OCI CLI kan hänga i timmar på en halvdöd anslutning. Utan väggklocka blir
# nästa försök helt enkelt inte av. macOS bash 3.2 har ingen timeout(1), så:
run_capped() {
  local secs="$1"; shift
  local tmp pid watcher rc
  tmp="$(mktemp -t oci-launch)"
  "$@" >"$tmp" 2>&1 &
  pid=$!
  ( sleep "$secs"; kill -TERM "$pid" 2>/dev/null; sleep 5; kill -KILL "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  watcher=$!
  set +e
  wait "$pid"; rc=$?
  set -e
  kill "$watcher" 2>/dev/null || true
  cat "$tmp"; rm -f "$tmp"
  # Dödad av watchern => signalstatus, inte ett svar från Oracle.
  if [[ $rc -gt 128 ]]; then return 124; fi
  return $rc
}

note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# En nyss uppladdad API-nyckel propagerar mellan Oracles identitetsnoder under
# några minuter. Under tiden lyckas vissa anrop och andra ger 401 — helt
# slumpmässigt. Alla uppslagningar går därför via den här, som tål 401 och
# tomma svar tills nyckeln satt sig.
oci_try() {
  local tries=0 out
  while :; do
    if out="$("$@" 2>/dev/null)" && [[ -n "$out" && "$out" != "null" ]]; then
      printf '%s' "$out"
      return 0
    fi
    tries=$((tries + 1))
    [[ $tries -ge 20 ]] && return 1
    sleep 15
  done
}

note "Letar upp OCID:er (tål att nyckeln fortfarande propagerar)"
TENANCY="$(oci_try oci iam availability-domain list --query 'data[0]."compartment-id"' --raw-output)" \
  || { echo "Kunde inte autentisera på fem minuter. Kontrollera ~/.oci/config." >&2; exit 1; }
AD="$(oci_try oci iam availability-domain list --query 'data[0].name' --raw-output)"
SUBNET="$(oci_try oci network subnet list --compartment-id "$TENANCY" \
  --display-name "$SUBNET_NAME" --query 'data[0].id' --raw-output)"
IMAGE="$(oci_try oci compute image list --compartment-id "$TENANCY" \
  --operating-system "$OS_NAME" --operating-system-version "$OS_VERSION" \
  --shape "$SHAPE" --sort-by TIMECREATED --query 'data[0].id' --raw-output)"

for pair in "TENANCY:$TENANCY" "AD:$AD" "SUBNET:$SUBNET" "IMAGE:$IMAGE"; do
  [[ -n "${pair#*:}" && "${pair#*:}" != "null" ]] || {
    echo "Kunde inte slå upp ${pair%%:*}. Kontrollera profil och att $SUBNET_NAME finns." >&2
    exit 1
  }
  echo "  ${pair%%:*} = ${pair#*:}"
done

# Fault domains är separata hårdvarugrupper; kapaciteten skiljer sig mellan dem.
# while-read i stället för mapfile: macOS levererar bash 3.2, som saknar mapfile.
FAULT_DOMAINS=()
while IFS= read -r fd; do
  [[ -n "$fd" ]] && FAULT_DOMAINS+=("$fd")
done < <(
  oci iam fault-domain list --compartment-id "$TENANCY" --availability-domain "$AD" 2>/dev/null \
    | jq -r '.data[].name' 2>/dev/null || true
)
[[ ${#FAULT_DOMAINS[@]} -gt 0 ]] || FAULT_DOMAINS=("FAULT-DOMAIN-1" "FAULT-DOMAIN-2" "FAULT-DOMAIN-3")
echo "  Fault domains: ${FAULT_DOMAINS[*]}"
echo "  Storlekar:     ${SHAPE_VARIANTS[*]}"

metadata="$(printf '{"ssh_authorized_keys": %s}' "$(jq -Rs . < "$SSH_KEY")")"

note "Startar tjatet — Ctrl-C för att avbryta"
attempt=0
backoff="$interval"
unknown=0

while true; do
  attempt=$((attempt + 1))
  fd="${FAULT_DOMAINS[$(( (attempt - 1) % ${#FAULT_DOMAINS[@]} ))]}"
  # 3 fault domains x 2 storlekar: perioderna är samprimiska, så rotation på
  # samma räknare täcker alla sex kombinationerna innan den upprepar sig.
  variant="${SHAPE_VARIANTS[$(( (attempt - 1) % ${#SHAPE_VARIANTS[@]} ))]}"
  v_ocpus="${variant%%:*}"
  v_mem="${variant##*:}"
  tag="$fd ${v_ocpus}/${v_mem}"

  set +e
  # --no-retry: CLI:t retryar annars 3-5 gånger internt med egen backoff. Då
  # blir ett "försök" här flera förfrågningar mot Oracle, skriptets pacing blir
  # en gissning, och 429:orna vi ser är till stor del självförvållade.
  output="$(run_capped "$LAUNCH_TIMEOUT" oci --no-retry compute instance launch \
    --compartment-id "$TENANCY" \
    --availability-domain "$AD" \
    --fault-domain "$fd" \
    --shape "$SHAPE" \
    --shape-config "{\"ocpus\":$v_ocpus,\"memoryInGBs\":$v_mem}" \
    --subnet-id "$SUBNET" \
    --image-id "$IMAGE" \
    --display-name "$NAME" \
    --assign-public-ip true \
    --boot-volume-size-in-gbs "$BOOT_GB" \
    --metadata "$metadata" 2>&1)"
  code=$?
  set -e

  stamp="$(date '+%H:%M:%S')"

  if [[ $code -eq 0 ]]; then
    instance="$(printf '%s' "$output" | jq -r '.data.id')"
    note "LYCKADES efter $attempt försök ($tag)"
    echo "Instans: $instance"
    echo "Väntar på RUNNING och publik IP..."
    oci compute instance get --instance-id "$instance" \
      --wait-for-state RUNNING >/dev/null 2>&1 || true
    ip="$(oci compute instance list-vnics --instance-id "$instance" \
      --query 'data[0]."public-ip"' --raw-output 2>/dev/null || true)"
    echo "Publik IP: ${ip:-hämta i konsolen}"
    printf '\a'
    osascript -e "display notification \"Instansen är uppe: ${ip:-se konsolen}\" with title \"OCI\"" 2>/dev/null || true
    exit 0
  fi

  # Allt transient ska tålas — skriptet ska kunna gå i timmar obevakat. Bara ett
  # fel som upprepas oförändrat får avbryta, för då är det konfigurationen.
  if [[ $code -eq 124 ]]; then
    # Hängde. Ett dött anrop säger inget om kapaciteten, så takten rörs inte.
    unknown=0
    backoff=30
    echo "[$stamp] #$attempt $tag — anropet hängde >${LAUNCH_TIMEOUT}s, dödade det"
  elif printf '%s' "$output" | grep -qi 'too many requests\|TooManyRequests\|429'; then
    unknown=0
    # Multiplikativ ökning: rate-limiten mäts över ett långt fönster, så en
    # engångsbackoff räcker inte — takten måste ner tills vi slutar bli nekade.
    interval=$(( interval * 2 ))
    if [[ $interval -gt $MAX_BACKOFF ]]; then interval=$MAX_BACKOFF; fi
    backoff="$interval"
    echo "[$stamp] #$attempt $tag — rate-limitad, takt ${interval}s"
  elif printf '%s' "$output" | grep -qi 'out of capacity\|out of host capacity'; then
    unknown=0
    # ...och additiv minskning tillbaka mot grundtakten. Ett steg om
    # BASE_INTERVAL, inte halvering: att halvera intervallet är att fördubbla
    # takten, vilket kastar oss rakt in i väggen igen efter ett enda lyckat
    # anrop. Det var sågtanden 60->429->120->60->429 i loggen.
    if [[ $interval -gt $BASE_INTERVAL ]]; then
      interval=$(( interval - BASE_INTERVAL ))
      if [[ $interval -lt $BASE_INTERVAL ]]; then interval=$BASE_INTERVAL; fi
    fi
    backoff="$interval"
    echo "[$stamp] #$attempt $tag — slut på kapacitet (takt ${interval}s)"
  elif printf '%s' "$output" | grep -qi 'NotAuthenticated'; then
    # Nyckeln kan flappa länge efter uppladdning. Inte ett konfigurationsfel.
    unknown=0
    backoff=30
    echo "[$stamp] #$attempt $tag — 401, nyckeln propagerar"
  elif printf '%s' "$output" \
    | grep -Eqi 'timed out|timeout|RequestException|ConnectionError|Max retries|ServiceUnavailable|InternalError|"status" *: *50[0-9]|status code 50[0-9]|HTTP/[0-9.]+ 50[0-9]'; then
    unknown=0
    backoff=60
    echo "[$stamp] #$attempt $tag — nätverks- eller serverhicka, försöker igen"
  else
    unknown=$(( unknown + 1 ))
    echo "[$stamp] #$attempt $tag — okänt fel ($unknown/5):"
    printf '%s\n' "$output" | head -20
    if [[ $unknown -ge 5 ]]; then
      note "Samma okända fel fem gånger i rad — avbryter"
      exit 1
    fi
    backoff=60
  fi

  sleep "$backoff"
done
