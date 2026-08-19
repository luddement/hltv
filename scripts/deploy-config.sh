#!/usr/bin/env bash
# Installerar Caddyfile och systemd-drop-in på burken. Körs LOKALT.
#
#   ./scripts/deploy-config.sh
#
# Caddy startas bara om DOMAIN är satt i /etc/hltv/site.env. Utan domän kan
# Let's Encrypt inte utfärda något certifikat, och basic auth över okrypterad
# HTTP skickar lösenorden i klartext — därför vägrar skriptet hellre.

set -euo pipefail
HOST="${HLTV_HOST:-79.76.54.16}"
KEY="${HLTV_KEY:-$HOME/.ssh/hltv.key}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH=(ssh -i "$KEY" -o ConnectTimeout=15 ubuntu@"$HOST")

note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

note "Caddyfile"
scp -q -i "$KEY" "$HERE/infra/server/Caddyfile" ubuntu@"$HOST":/tmp/Caddyfile
"${SSH[@]}" 'sudo install -o root -g caddy -m 644 /tmp/Caddyfile /etc/caddy/Caddyfile && rm /tmp/Caddyfile'

note "systemd-drop-in så Caddy ser DOMAIN"
"${SSH[@]}" 'sudo mkdir -p /etc/systemd/system/caddy.service.d && sudo tee /etc/systemd/system/caddy.service.d/hltv.conf >/dev/null <<UNIT
[Service]
# Caddy expanderar {\$DOMAIN} vid inläsning av konfigurationen. Utan den här
# raden är variabeln tom och Caddy vägrar starta.
EnvironmentFile=-/etc/hltv/site.env
UNIT
sudo touch /etc/hltv/users.caddy
sudo chown root:caddy /etc/hltv/users.caddy && sudo chmod 640 /etc/hltv/users.caddy
sudo systemctl daemon-reload'

note "Läge"
# site.env är 640 root:caddy — ubuntu kan inte källa den. Läs med sudo.
domain="$("${SSH[@]}" "sudo sed -n 's/^DOMAIN=//p' /etc/hltv/site.env 2>/dev/null | tr -d '[:space:]'")"
users="$("${SSH[@]}" 'sudo cat /etc/hltv/users.caddy 2>/dev/null | grep -c . || echo 0')"

if [[ -z "$domain" ]]; then
  cat <<'TEXT'
  DOMAIN är inte satt — Caddy startas inte.

  När domänen är klar:
    1. peka en A-post på burkens IP
    2. ssh in och sätt DOMAIN i /etc/hltv/site.env
    3. ./scripts/add-user.sh <namn>   (minst ett konto)
    4. kör detta skript igen

  Under tiden når du sajten privat via SSH-tunnel:
    ssh -i ~/.ssh/hltv.key -L 8080:127.0.0.1:4173 ubuntu@<ip>
    och öppna http://localhost:8080
TEXT
  exit 0
fi

auth_on=0
grep -qE '^[[:space:]]*basic_auth[[:space:]]*\{' "$HERE/infra/server/Caddyfile" && auth_on=1
if [[ "$auth_on" -eq 1 && "$users" -eq 0 ]]; then
  echo "  basic_auth är på men inga konton finns. Kör ./scripts/add-user.sh <namn> först." >&2
  exit 1
fi
[[ "$auth_on" -eq 0 ]] && echo "  OBS: inloggning avstängd — sajten är öppen för alla."

# systemd-dropin gäller bara tjänsten. En manuell validate ser ingen
# EnvironmentFile, så {$DOMAIN} blir tomt och blocket nyckellöst.
"${SSH[@]}" "sudo env DOMAIN='$domain' caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile" \
  || { echo "Caddyfile validerar inte — startar inte om." >&2; exit 1; }
"${SSH[@]}" 'sudo systemctl enable --now caddy && sudo systemctl reload caddy'
echo "  Caddy kör för $domain med $users konto(n)."
