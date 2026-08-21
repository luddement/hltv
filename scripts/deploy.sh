#!/usr/bin/env bash
# Synkar appen och spelresurserna till hltv-burken. Körs LOKALT från Macen.
#
#   ./scripts/deploy.sh              # app + resurser + skärmdumpar (~2,3 GB)
#   ./scripts/deploy.sh --demos      # bara demoarkivet (~56 GB, timmar)
#   ./scripts/deploy.sh --analysis   # bara lokala analyser (aldrig implicit)
#   ./scripts/deploy.sh --all        # app + resurser + demoarkiv
#
# Idempotent och återupptagbar: rsync överför bara det som skiljer, och en
# avbruten körning fortsätter där den slutade.

set -euo pipefail

HOST="${HLTV_HOST:-79.76.54.16}"
USER_AT="ubuntu@$HOST"
KEY="${HLTV_KEY:-$HOME/.ssh/hltv.key}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/app"
REMOTE=/srv/hltv

SSH=(ssh -i "$KEY" -o ConnectTimeout=15)

# macOS levererar openrsync (protokoll 29), som saknar --info=progress2.
# Homebrews rsync 3.x har den. Välj flagga efter vad som faktiskt finns.
if rsync --version 2>/dev/null | head -1 | grep -qi openrsync; then
  PROGRESS=(--progress)
else
  PROGRESS=(--info=progress2)
fi

# -z är ingen detalj här: .dem-filer komprimerar ungefär sexfaldigt, så
# demoarkivets 56 GB blir snarare 10-12 GB över tråden. Det är skillnaden
# mellan en halv arbetsdag och ett par timmar på en vanlig uppkoppling.
RSYNC=(rsync -az --partial "${PROGRESS[@]}" -e "ssh -i $KEY")

do_app=1; do_demos=0; do_analysis=0
case "${1:-}" in
  --demos) do_app=0; do_demos=1 ;;
  --analysis) do_app=0; do_analysis=1 ;;
  --all)   do_demos=1 ;;
  "")      ;;
  *) echo "Okänd flagga: $1" >&2; exit 2 ;;
esac

note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

"${SSH[@]}" "$USER_AT" 'command -v rsync >/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync'

if [[ $do_app -eq 1 ]]; then
  note "Appens kod (beroendefri — bara node:-inbyggda moduler)"
  "${SSH[@]}" "$USER_AT" "mkdir -p $REMOTE/app"
  "${RSYNC[@]}" "$APP/server.mjs" "$APP/demo-comments-store.mjs" \
    "$APP/game-assets-manifest.mjs" \
    "$APP/goldsrc-map-crc.mjs" "$APP/demo-assets.json" "$USER_AT:$REMOTE/app/"

  note "Byggd frontend (dist)"
  # demo-index.json och crew-index.json genereras PÅ SERVERN och finns inte i
  # det lokala bygget. Utan undantagen raderar --delete dem vid varje deploy,
  # och sajten tappar arkivlistan respektive spelarstatistiken tills de körts om.
  "${RSYNC[@]}" --delete --exclude=demo-index.json --exclude=crew-index.json \
    --exclude=playlists/ \
    "$APP/dist/" "$USER_AT:$REMOTE/app/dist/"

  # Indexeraren och crew-aggregeringen körs på servern och importerar från
  # src/ via hltv-node.mjs. Utan den här synken kör servern gammal kod, eller
  # kod som bara råkat kopieras dit för hand.
  note "Analyskod som servern kör"
  "${RSYNC[@]}" --delete "$APP/src/" "$USER_AT:$REMOTE/app/src/"
  "${RSYNC[@]}" "$APP/scripts/hltv-node.mjs" "$APP/scripts/index-demos.mjs" \
    "$APP/scripts/build-crew-index.mjs" "$APP/scripts/generate-crew-playlist.mjs" \
    "$APP/scripts/generate-crew-ace-playlist.mjs" \
    "$APP/scripts/generate-crew-fast-aces-playlist.mjs" \
    "$APP/scripts/build-side-end-manifest.mjs" \
    "$APP/scripts/capture-side-end-scoreboards.mjs" \
    "$APP/scripts/unpack-demo-zips.py" \
    "$APP/scripts/repair-goldsrc-demos.py" "$USER_AT:$REMOTE/app/scripts/"

  note "Basresurser för motorn (game-assets)"
  "${RSYNC[@]}" "$APP/game-assets/" "$USER_AT:$REMOTE/game-assets/"

  # Din personliga cstrike/ har 14 kartor och 5 wads som basuppsättningen
  # saknar — de CPL- och klankartor demos från 2003-2007 är inspelade på.
  # --ignore-existing är avsiktligt: basresurserna är auktoritativa, den
  # personliga mappen får bara FYLLA PÅ, aldrig skriva över. Annars riskerar
  # en lokalt modifierad fil att tysta bryta kartornas CRC-matchning.
  note "Custom-kartor och wads ur personliga cstrike/ (fyller bara på)"
  "${RSYNC[@]}" --ignore-existing \
    --exclude='*.bmp' --exclude='SAVE/' --exclude='cache/' \
    "$ROOT/cstrike/" "$USER_AT:$REMOTE/game-assets/cstrike/"

  note "Skärmdumpar (arkivmaterial, motorn rör dem inte)"
  "${RSYNC[@]}" --include='*.bmp' --exclude='*' "$ROOT/cstrike/" "$USER_AT:$REMOTE/screenshots/"

  note "Referensdemot"
  "${RSYNC[@]}" "$ROOT/r60_sthlm.dem" "$USER_AT:$REMOTE/"

  # server.mjs letar game-assets i appkatalogen. Symlänk i stället för kopia:
  # subvolymen ska kunna snapshottas separat.
  "${SSH[@]}" "$USER_AT" "ln -sfn $REMOTE/game-assets $REMOTE/app/game-assets"

  note "Starta om appservern"
  "${SSH[@]}" "$USER_AT" 'sudo systemctl restart hltv-app.service && sudo systemctl is-active hltv-app.service'
fi

if [[ $do_analysis -eq 1 ]]; then
  # Serverns analyskatalog är normalt auktoritativ. Den här vägen är explicit
  # eftersom en vanlig app-deploy annars kan skriva tillbaka äldre lokala
  # analysversioner över en pågående eller färdig serverindexering.
  note "Lokala demoanalyser — explicit synk"
  "${RSYNC[@]}" "$ROOT/demo-analysis/" "$USER_AT:$REMOTE/demo-analysis/"
fi

if [[ $do_demos -eq 1 ]]; then
  note "Demoarkivet — 56 GB, detta tar timmar. Avbryt och kör om när du vill."
  "${RSYNC[@]}" "$ROOT/demos/" "$USER_AT:$REMOTE/demos/"
fi

note "Läge på burken"
"${SSH[@]}" "$USER_AT" "df -h $REMOTE | tail -1; sudo btrfs filesystem usage -g $REMOTE | grep -E 'Device size|Used' | head -2"
