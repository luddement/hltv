#!/usr/bin/env bash
# Installerar Node och Caddy på hltv-burken och lägger upp tjänstedefinitionerna.
# Idempotent — kan köras om efter varje ändring.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/provision-web.sh
#
# Sajten är privat. Caddy sköter TLS och basic auth; appservern lyssnar bara
# på 127.0.0.1 och är aldrig nåbar utifrån utan att passera Caddy.

set -euo pipefail

NODE_MAJOR=26
APP_DIR=/srv/hltv/app
APP_PORT=4173

note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

note "Node $NODE_MAJOR"
if command -v node >/dev/null && [[ "$(node -v)" == v${NODE_MAJOR}.* ]]; then
  echo "  $(node -v) finns"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash - >/dev/null 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
  echo "  $(node -v) installerad"
fi

note "Caddy"
if command -v caddy >/dev/null; then
  echo "  $(caddy version | head -1) finns"
else
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy
  echo "  $(caddy version | head -1) installerad"
fi

note "Konfigurationsfil för domän och konton"
sudo mkdir -p /etc/hltv
if [[ ! -f /etc/hltv/site.env ]]; then
  sudo tee /etc/hltv/site.env >/dev/null <<'ENV'
# Fyll i domänen när den är registrerad och peka en A-post på burkens IP.
# Caddy hämtar certifikat automatiskt vid omstart av tjänsten.
DOMAIN=
ENV
  sudo chmod 640 /etc/hltv/site.env
  sudo chown root:caddy /etc/hltv/site.env
  echo "  /etc/hltv/site.env skapad — DOMAIN är tom tills vidare"
else
  echo "  /etc/hltv/site.env finns"
fi

note "Appservern som systemd-tjänst"
sudo tee /etc/systemd/system/hltv-app.service >/dev/null <<UNIT
[Unit]
Description=HLTV Replay Lab - appserver
After=network.target srv-hltv.mount
Requires=srv-hltv.mount

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR
Environment=HLTV_PORT=$APP_PORT
# Lyssnar bara lokalt. All utifrånkommande trafik går via Caddy, som äger
# TLS och inloggningen. Appservern har ingen egen autentisering.
Environment=NODE_ENV=production
ExecStart=/usr/bin/node $APP_DIR/server.mjs
Restart=always
RestartSec=5

# Hardening: tjansten behover bara lasa sin egen katalog och arkivet.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/hltv

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
echo "  hltv-app.service skriven (startas när appen är deployad)"

note "Klart"
node -v; caddy version | head -1
