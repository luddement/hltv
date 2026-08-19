#!/usr/bin/env bash
# Hämtar ett stort arkiv från Google Drive DIREKT till burken och packar upp.
# Körs frikopplat, så en tappad SSH-session inte dödar överföringen.
#
#   ssh -i ~/.ssh/hltv.key ubuntu@<ip> "DRIVE_ID='<fil-id>' bash -s" \
#     < scripts/fetch-archive.sh
#
# DRIVE_ID är den långa strängen ur delningslänken:
#   https://drive.google.com/file/d/<DRIVE_ID>/view
#
# Ingen gdown. Google lade om bekräftelseflödet till drive.usercontent.google.com
# och gdown 6.1.0 hänger inte med — den rapporterar "Cannot retrieve the public
# link" även när filen är korrekt delad. curl gör jobbet bättre ändå: värden
# svarar med HTTP 206, så -C - ger äkta återupptagning byte för byte.

set -euo pipefail

DRIVE_ID="${DRIVE_ID:-}"
DEST=/srv/hltv/incoming
TARGET=/srv/hltv/demos
ZIP="$DEST/archive.zip"

note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
[[ -n "$DRIVE_ID" ]] || { echo "DRIVE_ID saknas. Se kommentaren överst." >&2; exit 2; }

note "Utrymme"
avail_gb="$(df --output=avail -BG /srv/hltv | tail -1 | tr -dc '0-9')"
echo "  ${avail_gb} GB ledigt"
[[ "$avail_gb" -ge 60 ]] || { echo "För lite utrymme kvar." >&2; exit 1; }

command -v unzip >/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unzip
mkdir -p "$DEST"

note "Startar frikopplad överföring"
sudo systemd-run --unit=hltv-fetch --collect \
  --property=WorkingDirectory="$DEST" \
  --property=User=ubuntu \
  --setenv=DRIVE_ID="$DRIVE_ID" \
  --setenv=ZIP="$ZIP" --setenv=TARGET="$TARGET" \
  /bin/bash -c '
    set -uo pipefail
    for attempt in $(seq 1 8); do
      echo "försök $attempt"

      # uuid är sessionsbundet och kortlivat — hämta ett färskt varje försök,
      # annars dör en återupptagning på ett utgånget token.
      page="$(curl -sL "https://drive.google.com/uc?export=download&id=$DRIVE_ID")"
      uuid="$(printf %s "$page" | grep -oE "name=\"uuid\" value=\"[^\"]+\"" | head -1 | cut -d\" -f4)"
      if [ -z "$uuid" ]; then
        echo "  ingen bekräftelsetoken — filen kan vara oåtkomlig eller kvotspärrad"
        printf %s "$page" | grep -oE "<title>[^<]*" | head -1
        sleep 60; continue
      fi

      url="https://drive.usercontent.google.com/download?id=$DRIVE_ID&export=download&confirm=t&uuid=$uuid"
      # -C - återupptar; --fail så en HTML-felsida inte skrivs in i zipen.
      if curl -fL -C - --retry 5 --retry-delay 10 -o "$ZIP" "$url"; then
        echo "  överföring klar"
        break
      fi
      echo "  avbröt — nytt försök om 30s"
      sleep 30
    done

    size=$(stat -c%s "$ZIP" 2>/dev/null || echo 0)
    echo "storlek: $((size/1024/1024/1024)) GB"

    # En riktig zip börjar med PK\x03\x04. Allt annat är en felsida.
    magic=$(head -c 4 "$ZIP" | od -An -tx1 | tr -d " \n")
    if [ "$magic" != "504b0304" ]; then
      echo "FEL: filen är ingen zip (börjar med $magic). Troligen Googles kvot- eller felsida."
      head -c 300 "$ZIP"; exit 1
    fi

    echo "verifierar arkivet"
    unzip -t "$ZIP" >/dev/null || { echo "FEL: zipen är trasig."; exit 1; }
    echo "packar upp"
    mkdir -p "$TARGET"
    unzip -q -n "$ZIP" -d "$TARGET"
    echo "KLART"
    du -sh "$TARGET"
    df -h /srv/hltv | tail -1
    echo "Zipen ligger kvar i $(dirname "$ZIP") tills du raderar den."
  '
echo "  igång som hltv-fetch"
echo "  följ:  journalctl -u hltv-fetch -f"
