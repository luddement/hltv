#!/usr/bin/env bash
# Sätter upp en tom Ubuntu-burk (Oracle Ampere A1 eller motsvarande) för att
# servera HLTV Replay Lab: paket, Node 26, brandvägg, komprimerad datadisk och
# nginx. Körs som root och går att köra om — varje steg hoppar över sig självt
# om det redan är gjort.
#
#   sudo ./bootstrap-vps.sh --device /dev/sdb --user ldmnt
#
# Diskformateringen är det enda som förstör data, och den kräver därför att du
# pekar ut enheten explicit. Har enheten redan ett filsystem vägrar skriptet.

set -euo pipefail

DEVICE=""
MOUNT="/srv/hltv"
WEB_USER=""
SERVER_NAME="_"
FORCE_FORMAT=0
NODE_MAJOR=26

usage() {
  cat <<'TEXT'
Användning: sudo ./bootstrap-vps.sh [flaggor]

  --device /dev/sdb   Blockvolymen som ska bli btrfs med zstd. Utan denna
                      hoppas diskuppsättningen över helt.
  --mount /srv/hltv   Monteringspunkt (standard: /srv/hltv)
  --user NAMN         Skapa en HTTP-inloggning med detta namn (lösenord frågas)
  --domain NAMN       server_name i nginx (standard: _, alltså alla)
  --force-format      Formatera även om enheten redan har ett filsystem. FARLIGT.
  --help              Visa detta
TEXT
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --mount) MOUNT="$2"; shift 2 ;;
    --user) WEB_USER="$2"; shift 2 ;;
    --domain) SERVER_NAME="$2"; shift 2 ;;
    --force-format) FORCE_FORMAT=1; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Okänd flagga: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Kör som root (sudo)." >&2; exit 1; }
command -v apt-get >/dev/null || { echo "Skriptet förutsätter Debian/Ubuntu." >&2; exit 1; }

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Paket"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  nginx btrfs-progs btrfs-compsize rclone unzip bzip2 python3 \
  apache2-utils iptables-persistent curl ca-certificates xz-utils

step "Node $NODE_MAJOR"
# NodeSource saknar ofta paket för ett alldeles färskt Ubuntu-släpp. Faller
# därför tillbaka på Nodes officiella tarball, som bara beror på arkitekturen.
install_node_from_tarball() {
  local arch file
  case "$(dpkg --print-architecture)" in
    arm64) arch=linux-arm64 ;;
    amd64) arch=linux-x64 ;;
    *) echo "Okänd arkitektur för Node-tarball." >&2; return 1 ;;
  esac
  file="$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/" \
    | grep -o "node-v${NODE_MAJOR}\.[0-9.]*-${arch}\.tar\.xz" | head -1)"
  [[ -n "$file" ]] || { echo "Hittade ingen Node $NODE_MAJOR-tarball." >&2; return 1; }
  curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/${file}" -o /tmp/node.tar.xz
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm -f /tmp/node.tar.xz
}

node_major_installed=0
if command -v node >/dev/null; then
  node_major_installed="$(node -p 'process.versions.node.split(".")[0]')"
fi
if [[ "$node_major_installed" -lt $NODE_MAJOR ]]; then
  if curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y -qq nodejs; then
    echo "Node installerad från NodeSource."
  else
    echo "NodeSource fungerade inte här — använder officiell tarball i stället."
    install_node_from_tarball
  fi
fi
echo "node $(node -v)"
if [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  echo "Node är för gammal: index-demos.mjs kräver registerHooks och TS-strippning." >&2
  exit 1
fi

step "Brandvägg"
# OCI har två lager. Det här är instansens; ingressreglerna i VCN:ens Security
# List måste öppnas i konsolen och kan inte sättas härifrån.
for port in 80 443; do
  if ! iptables -C INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
    echo "öppnade $port"
  else
    echo "$port redan öppen"
  fi
done
netfilter-persistent save >/dev/null
echo "GLÖM INTE: öppna 80 och 443 i VCN → Security List i OCI-konsolen också."

if [[ -n "$DEVICE" ]]; then
  step "Datadisk $DEVICE"
  [[ -b "$DEVICE" ]] || { echo "$DEVICE är ingen blockenhet." >&2; exit 1; }
  root_source="$(findmnt -no SOURCE / || true)"
  if [[ "$root_source" == "$DEVICE"* ]]; then
    echo "$DEVICE bär rotfilsystemet. Avbryter." >&2
    exit 1
  fi

  existing="$(lsblk -no FSTYPE "$DEVICE" | head -1)"
  if [[ -n "$existing" && $FORCE_FORMAT -eq 0 ]]; then
    echo "$DEVICE har redan filsystemet '$existing'. Formaterar INTE."
    echo "Är det avsiktligt, kör om med --force-format."
  else
    if [[ -n "$existing" ]]; then
      echo "Formaterar om $DEVICE (hade '$existing') på din begäran."
    fi
    mkfs.btrfs -f -L hltv "$DEVICE"
  fi

  mkdir -p "$MOUNT"
  uuid="$(blkid -s UUID -o value "$DEVICE")"
  # nofail så att en saknad volym inte hindrar burken från att boota.
  if ! grep -q "$uuid" /etc/fstab; then
    echo "UUID=$uuid $MOUNT btrfs compress=zstd:3,noatime,nofail 0 2" >> /etc/fstab
  fi
  mountpoint -q "$MOUNT" || mount "$MOUNT"
  if findmnt -no OPTIONS "$MOUNT" | grep -q 'compress=zstd'; then
    echo "monterad med zstd-komprimering"
  else
    echo "VARNING: zstd är inte aktivt på $MOUNT — arkivet kommer inte få plats." >&2
  fi
else
  step "Datadisk"
  echo "Ingen --device angiven, hoppar över. $MOUNT används som vanlig katalog."
  mkdir -p "$MOUNT"
fi

step "Kataloger"
mkdir -p "$MOUNT"/{demos,demo-analysis,game-assets,www}
chown -R www-data:www-data "$MOUNT"
echo "$MOUNT/{demos,demo-analysis,game-assets,www}"

if [[ -n "$WEB_USER" ]]; then
  step "Inloggning"
  if [[ -f /etc/nginx/hltv.htpasswd ]]; then
    htpasswd /etc/nginx/hltv.htpasswd "$WEB_USER"
  else
    htpasswd -c /etc/nginx/hltv.htpasswd "$WEB_USER"
  fi
  chown root:www-data /etc/nginx/hltv.htpasswd
  chmod 640 /etc/nginx/hltv.htpasswd
fi

step "nginx"
cat > /etc/nginx/sites-available/hltv <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};
    root ${MOUNT}/www;

    # Arkivet är privat: spelresurserna tillhör Valve och demos är klanens egna.
    auth_basic "HLTV Replay Lab";
    auth_basic_user_file /etc/nginx/hltv.htpasswd;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    client_max_body_size 1m;
    sendfile on;
    tcp_nopush on;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    # Aldrig application/octet-stream: gzip stänger av Range, och demos läses
    # med Range. Filerna ligger redan komprimerade på btrfs.
    gzip_types text/css text/plain application/javascript application/json application/wasm;

    # Klienten frågar med query-parametrar, som inte påverkar vilken statisk fil
    # som serveras. Mappa dem till förberäknade manifest i stället. Andra raden
    # är fallbacken för demos som saknar kart-CRC.
    location = /game-assets-manifest.json {
        try_files /game-assets-manifest/\$arg_map.\$arg_checksum.json
                  /game-assets-manifest/\$arg_map.00000000.json
                  =404;
        default_type application/json;
    }

    # WebAssembly.instantiateStreaming vägrar utan rätt MIME-typ.
    location ~ \\.wasm\$ {
        default_type application/wasm;
    }

    location /demos/ {
        alias ${MOUNT}/demos/;
        default_type application/octet-stream;
    }

    location /demo-analysis/ {
        alias ${MOUNT}/demo-analysis/;
        default_type application/json;
    }

    location /game-assets/ {
        alias ${MOUNT}/game-assets/;
        default_type application/octet-stream;
        expires 30d;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/hltv /etc/nginx/sites-enabled/hltv
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "nginx omladdad"

cat <<TEXT

Klart. Nästa steg, i ordning:

  1. Öppna 80 och 443 i OCI-konsolen: Networking → VCN → Security List.

  2. Ladda upp arkivet från Google Drive (kör 'rclone config' först,
     med en token från 'rclone authorize "drive"' på din Mac):
       rclone copy gdrive:hltv-arkiv.zip ${MOUNT}/
       unzip ${MOUNT}/hltv-arkiv.zip -d ${MOUNT}/demos && rm ${MOUNT}/hltv-arkiv.zip

  3. Packa upp. Båda stegen raderar varje arkiv först efter verifiering,
     så disken växer mot slutmålet i stället för att rymma båda formaten:
       python3 unpack-demo-zips.py --root ${MOUNT}/demos --execute
       find ${MOUNT}/demos -name '*.dem.bz2' -print0 | xargs -0 -P4 bunzip2

  4. Från Macen: bygg och skicka appen och spelresurserna:
       pnpm build
       rsync -a dist/ root@SERVER:${MOUNT}/www/
       rsync -a game-assets/ root@SERVER:${MOUNT}/game-assets/

  5. Indexera på servern (~1,6 GiB topp-RAM):
       node --import ./scripts/hltv-node.mjs scripts/index-demos.mjs parse
       node scripts/build-asset-manifests.mjs

  6. Kontrollera att komprimeringen biter:
       compsize ${MOUNT}

  7. TLS när DNS pekar hit:
       apt-get install -y certbot python3-certbot-nginx
       certbot --nginx -d din.doman.se
TEXT
