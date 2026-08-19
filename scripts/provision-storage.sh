#!/usr/bin/env bash
# Formaterar och monterar datavolymen på hltv-burken. Idempotent: kan köras om
# utan att förstöra data — avbryter om filsystemet redan finns.
#
#   ssh ubuntu@<ip> 'bash -s' < scripts/provision-storage.sh
#
# btrfs med compress=zstd:3 är valt för att arkivet är 218 GiB rått men mäter
# ~36 GiB komprimerat (ratio 6,02 över tolv demos). Kärnan dekomprimerar per
# block, så HTTP Range fungerar oförändrat och appen märker ingenting.

set -euo pipefail

DEVICE="${DEVICE:-/dev/sdb}"
LABEL="hltv-data"
MOUNTPOINT="/srv/hltv"
SUBVOLUMES=(demos game-assets demo-analysis screenshots app)

note() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

[[ -b "$DEVICE" ]] || { echo "$DEVICE är ingen blockenhet." >&2; exit 1; }

# Ubuntu 24.04 Minimal levererar inte btrfs-progs.
if ! command -v mkfs.btrfs >/dev/null; then
  note "Installerar btrfs-progs"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq btrfs-progs
fi

existing="$(sudo blkid -s TYPE -o value "$DEVICE" 2>/dev/null || true)"
if [[ -z "$existing" ]]; then
  note "Skapar btrfs på $DEVICE"
  sudo mkfs.btrfs -L "$LABEL" "$DEVICE"
elif [[ "$existing" == "btrfs" ]]; then
  note "btrfs finns redan på $DEVICE — hoppar över mkfs"
else
  echo "$DEVICE innehåller '$existing', inte btrfs. Avbryter hellre än att skriva över." >&2
  exit 1
fi

UUID="$(sudo blkid -s UUID -o value "$DEVICE")"
[[ -n "$UUID" ]] || { echo "Kunde inte läsa UUID." >&2; exit 1; }

# Montera på UUID, inte på /dev/sdb eller /dev/oracleoci/*: Oracles symlänkar
# numreras per attachment och krockar med bootvolymens partitioner, och
# enhetsbokstaven kan byta plats mellan omstarter.
note "fstab-rad på UUID=$UUID"
sudo mkdir -p "$MOUNTPOINT"
if ! grep -q "UUID=$UUID" /etc/fstab; then
  # nofail: en trasig datavolym ska inte hindra burken från att boota. Att
  # behöva konsolen på en maskin som tog tre dygn att få vore illa.
  echo "UUID=$UUID $MOUNTPOINT btrfs compress=zstd:3,noatime,nofail 0 2" \
    | sudo tee -a /etc/fstab >/dev/null
  echo "  lade till"
else
  echo "  fanns redan"
fi

mountpoint -q "$MOUNTPOINT" || { note "Monterar"; sudo mount "$MOUNTPOINT"; }

note "Subvolymer"
for sv in "${SUBVOLUMES[@]}"; do
  if [[ -d "$MOUNTPOINT/$sv" ]]; then
    echo "  $sv finns"
  else
    sudo btrfs subvolume create "$MOUNTPOINT/$sv" >/dev/null
    echo "  $sv skapad"
  fi
done
sudo chown -R ubuntu:ubuntu "$MOUNTPOINT"

note "Resultat"
findmnt -no SOURCE,TARGET,FSTYPE,OPTIONS "$MOUNTPOINT"
df -h "$MOUNTPOINT" | tail -1
sudo btrfs subvolume list "$MOUNTPOINT" | awk '{print "  subvol:", $NF}'
