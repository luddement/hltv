#!/usr/bin/env bash
# Kör indexeringen på burken med vakthund mot demos som låser parsern.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/index-supervised.sh
#   journalctl -u hltv-supervise -f
#
# Parsern loopar oändligt på vissa demofiler. Det är INTE storleksrelaterat:
# 1227 MB går igenom medan 583 MB låser sig. Tills orsaken är hittad får en
# enda sådan fil inte stoppa hela arkivet.
#
# Hela loopen körs på servern. En tidigare variant styrde den via ssh utifrån
# och blev skör av citering och nätverksglapp.
set -euo pipefail

sudo systemctl stop hltv-index hltv-supervise 2>/dev/null || true
sudo systemctl reset-failed hltv-index hltv-supervise 2>/dev/null || true

sudo systemd-run --unit=hltv-supervise --collect \
  --property=User=ubuntu \
  --property=WorkingDirectory=/srv/hltv/app \
  --property=Nice=10 \
  /bin/bash -c '
    set -uo pipefail
    LOG=/tmp/hltv-index.log
    MAX_EXCLUDE=25
    STALL_ROUNDS=5        # x 60 s utan ny utdata = låst
    excluded=0

    while : ; do
      : > "$LOG"
      node --max-old-space-size=8192 \
        --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse \
        --root /srv/hltv/demos \
        --analysis /srv/hltv/demo-analysis \
        --catalog /srv/hltv/app/dist/demo-index.json >> "$LOG" 2>&1 &
      pid=$!

      prev=0; stalls=0; stuck=""
      while kill -0 "$pid" 2>/dev/null; do
        sleep 60
        size=$(stat -c%s "$LOG" 2>/dev/null || echo 0)
        if [ "$size" -eq "$prev" ]; then stalls=$((stalls+1)); else stalls=0; fi
        prev=$size
        [ "$stalls" -ge "$STALL_ROUNDS" ] || continue

        # Den som hänger är nästa fil efter den senast loggade raden.
        donerel=$(grep -aE "^\[[0-9]+/" "$LOG" | tail -1 | sed -E "s#^\[[0-9]+/[0-9]+\] ([^ ]+) .*#\1#")
        # dirname i stället för parameterexpansion med klammer: systemd
        # expanderar sådana uttryck i sin egen kommandorad och gör dem tomma,
        # så exkluderingen hade misslyckats tyst.
        year=$(dirname "$donerel")
        base=$(basename "$donerel")
        stuck=$(find "/srv/hltv/demos/$year" -name "*.dem" | sort | grep -A1 -F "$base" | tail -1)
        kill -9 "$pid" 2>/dev/null
        break
      done
      wait "$pid" 2>/dev/null
      rc=$?

      if [ -z "$stuck" ]; then
        echo "=== körningen avslutad (rc=$rc) ==="
        tail -6 "$LOG"
        break
      fi

      excluded=$((excluded+1))
      echo "UNDANTAR [$excluded] $(basename "$stuck") ($(( $(stat -c%s "$stuck") / 1048576 )) MB)"
      mv "$stuck" "$stuck.parser-hang"
      if [ "$excluded" -ge "$MAX_EXCLUDE" ]; then
        echo "FEL: $MAX_EXCLUDE undantag — något är systematiskt fel. Avbryter."
        exit 1
      fi
    done

    echo "=== sammanfattning ==="
    echo "undantagna filer: $(find /srv/hltv/demos -name "*.parser-hang" | wc -l)"
    find /srv/hltv/demos -name "*.parser-hang" -printf "%s %p\n" |
      awk "{printf \"  %5.0f MB  %s\n\", \$1/1048576, \$2}"
    ls -lh /srv/hltv/app/dist/demo-index.json | awk "{print \"katalog: \"\$5}"
    echo "analysfiler: $(find /srv/hltv/demo-analysis -name "*.json" | wc -l)"
    sudo systemctl start hltv-ballast
    echo "ballast åter igång"
  '
echo "  igång som hltv-supervise"
