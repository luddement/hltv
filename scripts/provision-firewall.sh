#!/usr/bin/env bash
# Öppnar 80 och 443 i instansens EGEN brandvägg. Idempotent.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/provision-firewall.sh
#
# OCI har två brandväggslager och de är oberoende av varandra:
#   1. Security list i konsolen / Terraform  — släpper redan igenom 22/80/443
#   2. Instansens iptables                   — Oracles images avvisar ALLT
#                                              utom 22 med en REJECT sist
# Lager 2 är osynligt från konsolen. Symptomet är att porten ser öppen ut
# överallt utom där det räknas: Caddy lyssnar, security listen tillåter, och
# anslutningar utifrån dör ändå utan förklaring.

set -euo pipefail
note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

note "Nuläge"
sudo iptables -L INPUT -n --line-numbers | sed -n '1,12p'

for port in 80 443; do
  if sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    echo "  $port redan öppen"
  else
    # Infoga FÖRE REJECT-regeln. En regel efter den nås aldrig — iptables
    # utvärderar uppifrån och ned och stannar vid första träff.
    reject_line="$(sudo iptables -L INPUT -n --line-numbers \
      | awk '$2=="REJECT"{print $1; exit}')"
    if [[ -n "$reject_line" ]]; then
      sudo iptables -I INPUT "$reject_line" -p tcp --dport "$port" -j ACCEPT
    else
      sudo iptables -A INPUT -p tcp --dport "$port" -j ACCEPT
    fi
    echo "  $port öppnad"
  fi
done

note "Sparar så reglerna överlever omstart"
if ! dpkg -s iptables-persistent >/dev/null 2>&1; then
  echo iptables-persistent iptables-persistent/autosave_v4 boolean false | sudo debconf-set-selections
  echo iptables-persistent iptables-persistent/autosave_v6 boolean false | sudo debconf-set-selections
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent
fi
sudo netfilter-persistent save >/dev/null 2>&1 || sudo sh -c 'iptables-save > /etc/iptables/rules.v4'
echo "  sparade"

note "Resultat"
sudo iptables -L INPUT -n --line-numbers | sed -n '1,12p'
