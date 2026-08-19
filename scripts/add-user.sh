#!/usr/bin/env bash
# Lägger till eller uppdaterar ett konto på den privata sajten.
#
#   ./scripts/add-user.sh ludde
#   ./scripts/add-user.sh kalle --remove
#
# Lösenordet genereras slumpmässigt och visas EN gång. Caddy lagrar bara
# bcrypt-hashen; går lösenordet förlorat får kontot sättas om.

set -euo pipefail
HOST="${HLTV_HOST:-79.76.54.16}"
KEY="${HLTV_KEY:-$HOME/.ssh/hltv.key}"
SSH=(ssh -i "$KEY" ubuntu@"$HOST")

user="${1:-}"
[[ -n "$user" ]] || { echo "Användning: $0 <användarnamn> [--remove]" >&2; exit 2; }
[[ "$user" =~ ^[a-z0-9_-]+$ ]] || { echo "Bara a-z, 0-9, _ och -." >&2; exit 2; }

if [[ "${2:-}" == "--remove" ]]; then
  "${SSH[@]}" "sudo sed -i '/^${user} /d' /etc/hltv/users.caddy && sudo systemctl reload caddy"
  echo "$user borttagen."
  exit 0
fi

# 24 tecken ur ett alfabet utan lättförväxlade tecken.
# Subskal med pipefail avstängt: head stänger röret när det fått sina 24
# tecken, tr dör av SIGPIPE med kod 141, och pipefail gör det till ett avbrott.
password="$(set +o pipefail; LC_ALL=C tr -dc 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789' </dev/urandom | head -c 24)"
hash="$("${SSH[@]}" "caddy hash-password --plaintext '$password'")"

"${SSH[@]}" "sudo touch /etc/hltv/users.caddy \
  && sudo sed -i '/^${user} /d' /etc/hltv/users.caddy \
  && echo '${user} ${hash}' | sudo tee -a /etc/hltv/users.caddy >/dev/null \
  && sudo chown root:caddy /etc/hltv/users.caddy && sudo chmod 640 /etc/hltv/users.caddy \
  && (sudo systemctl reload caddy 2>/dev/null || true)"

cat <<TEXT

  användare: $user
  lösenord:  $password

  Visas bara denna gång. Skicka det över något annat än e-post.
TEXT
