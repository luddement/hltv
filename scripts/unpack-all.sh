#!/usr/bin/env bash
# Packar upp hela arkivet på burken: ZIP-åren via unpack-demo-zips.py, BZ2-åren
# via bunzip2. Båda raderar källarkivet efter verifierad uppackning, så disken
# aldrig behöver rymma båda formaten samtidigt.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/unpack-all.sh
#
# Körs frikopplat som hltv-unpack. Följ med: journalctl -u hltv-unpack -f

set -euo pipefail
ROOT=/srv/hltv/demos

# Ubuntu Minimal saknar bzip2. Kontrollera FÖRE jobbet startar — annars
# misslyckas 4770 filer en och en med "command not found".
for tool in bzip2 unzip python3; do
  command -v "$tool" >/dev/null || {
    echo "Installerar $tool"
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$tool"
  }
done

sudo systemd-run --unit=hltv-unpack --collect \
  --property=User=ubuntu \
  --property=WorkingDirectory=/srv/hltv \
  /bin/bash -c '
    set -uo pipefail
    echo "=== ZIP-åren ==="
    python3 /srv/hltv/app/scripts/unpack-demo-zips.py --root '"$ROOT"' --execute 2>&1 | tail -20

    echo "=== BZ2-åren ==="
    fails=0
    total=$(find '"$ROOT"' -name "*.bz2" | wc -l)
    echo "$total bz2-filer"
    n=0
    # -k utelämnas medvetet: bunzip2 tar bort källan först när uppackningen
    # lyckats, vilket är samma kontrakt som ZIP-skriptet och det som gör att
    # disken växer mot slutmålet i stället för att behöva rymma båda formaten.
    find '"$ROOT"' -name "*.bz2" -print0 | while IFS= read -r -d "" f; do
      n=$((n+1))
      if ! err=$(bunzip2 "$f" 2>&1); then
        echo "  MISSLYCKADES: $f — $err"
        fails=$((fails+1))
        # Samma fel om och om igen betyder miljön, inte filerna.
        if [ "$fails" -ge 20 ]; then
          echo "FEL: 20 misslyckanden i rad. Avbryter i stället för att mala igenom resten."
          exit 1
        fi
      else
        fails=0
      fi
      [ $((n % 250)) -eq 0 ] && echo "  $n/$total  disk: $(df -h /srv/hltv | tail -1 | awk "{print \$3\" använt, \"\$4\" kvar\"}")"
    done

    echo "=== resultat ==="
    echo "  .dem:  $(find '"$ROOT"' -name "*.dem" | wc -l)"
    echo "  .zip:  $(find '"$ROOT"' -name "*.zip" | wc -l)  (ska vara 0)"
    echo "  .bz2:  $(find '"$ROOT"' -name "*.bz2" | wc -l)  (ska vara 0)"
    df -h /srv/hltv | tail -1
    command -v compsize >/dev/null && sudo compsize /srv/hltv 2>/dev/null | head -3
    echo "KLART"
  '
echo "  igång som hltv-unpack"
