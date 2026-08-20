#!/usr/bin/env bash
# Reparerar demos vars sektionskatalog aldrig skrevs, och sätter de lagade
# på originalens plats så indexeraren når dem.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/repair-archive.sh
#   journalctl -u hltv-repair -f
#
# Bakgrund: katalogen skrivs sist i en GoldSrc-demo, när inspelningen avslutas
# snyggt. Kraschade spelet står directoryOffset kvar på 0, och parsern läser då
# filens egen HLDEMO-magi som antal sektioner — felet "Orimligt antal
# demosektioner: 1162103880", där talet är byten HLDE.
#
# Originalen kastas aldrig. De byter namn till *.dem.unfinalised och ligger
# kvar; den lagade kopian tar den ordinarie sökvägen.
set -euo pipefail

sudo systemctl stop hltv-repair 2>/dev/null || true
sudo systemctl reset-failed hltv-repair 2>/dev/null || true

sudo systemd-run --unit=hltv-repair --collect \
  --property=User=ubuntu \
  --property=WorkingDirectory=/srv/hltv \
  --property=Nice=10 \
  /bin/bash -c '
    set -uo pipefail
    echo "=== reparerar ==="
    python3 /srv/hltv/app/scripts/repair-goldsrc-demos.py --root /srv/hltv/demos --execute 2>&1 |
      grep -aE "^\[.*(DONE|kan inte|misslyck)" | tail -100

    echo "=== sätter de lagade på plats ==="
    swapped=0
    while IFS= read -r rep; do
      # Ingen klammerexpansion här: systemd expanderar sådana uttryck i sin
      # egen kommandorad och gör dem tomma.
      orig=$(printf %s "$rep" | sed "s/\.repaired\.dem$/.dem/")
      [ -f "$orig" ] || continue
      mv "$orig" "$orig.unfinalised"
      mv "$rep" "$orig"
      swapped=$((swapped+1))
    done < <(find /srv/hltv/demos -name "*.repaired.dem")
    echo "bytte plats på $swapped demos"

    echo "=== resultat ==="
    echo "  .dem totalt:        $(find /srv/hltv/demos -name "*.dem" | wc -l)"
    echo "  bevarade original:  $(find /srv/hltv/demos -name "*.unfinalised" | wc -l)"
    echo "  kvar oreparerade:   $(find /srv/hltv/demos -name "*.repaired.dem" | wc -l)"
    df -h /srv/hltv | tail -1
    echo "KLART"
  '
echo "  igång som hltv-repair"
