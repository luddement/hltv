#!/usr/bin/env bash
# Indexerar hela demoarkivet på burken. Frikopplat — 6232 demos tar timmar.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/index-archive.sh
#   journalctl -u hltv-index -f
#
# 'parse' läser varje demofil och är det dyra steget. Vill du bara räkna om
# poängen efter ändrade fragregler räcker 'rescore', som aldrig rör filerna.
set -euo pipefail

sudo systemd-run --unit=hltv-index --collect \
  --property=User=ubuntu \
  --property=WorkingDirectory=/srv/hltv/app \
  --property=Nice=10 \
  /bin/bash -c '
    # Katalogen skrivs till dist/ eftersom det är den servern serverar.
    # public/ kopieras in i dist/ vid bygget, och bygget sker på Macen som
    # inte har arkivet.
    # 77 demos är över 100 MB och den största 2073 MB. Nodes standardgräns för
    # gamla generationen räcker inte: sopsamlaren tröskar mot taket i 100 % CPU
    # utan att komma vidare, vilket ser ut som en hängning men är minnesbrist.
    node --max-old-space-size=8192 \
      --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse \
      --root /srv/hltv/demos \
      --analysis /srv/hltv/demo-analysis \
      --catalog /srv/hltv/app/dist/demo-index.json 2>&1
    # Inget "| tail" här: ett rör buffrar tills processen är klar, så journalen
    # blir tyst i timmar och ett fel syns först när allt redan är över.
    echo "=== katalog ==="
    ls -lh /srv/hltv/app/dist/demo-index.json
    echo "=== analysfiler ==="
    find /srv/hltv/demo-analysis -name "*.json" | wc -l
    echo "KLART"
  '
echo "  igång som hltv-index"
