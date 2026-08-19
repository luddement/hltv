# Datavolym för demoarkivet. Formateras med btrfs + compress=zstd:3 av
# provisioneringsskriptet, inte här — Terraform äger volymen och attachmentet,
# filsystemet hör hemma i app/scripts/.
#
# Storlek: hela återstoden av Always Free-taket. 50 GB boot + 150 GB data
# = 200 GB, potten är slut. Medvetet val 2026-08-19.
#
# Dagens arkiv är 218 GiB rått / ~36 GiB komprimerat (btrfs zstd:3, uppmätt
# ratio 6,02 över tolv demos), så 150 GB är långt mer än vad som behövs NU.
# Poängen är att arkivet ska växa: det finns fler demos att hitta och lägga
# upp, och vid ratio 6 rymmer volymen ungefär 900 GiB råa demos.
#
# Konsekvens att känna till: inget utrymme kvar för volymsnapshots, eftersom
# de räknas ur samma 200 GB. Backup måste därför ske utanför Oracle — se
# R2-resonemanget under "Kvarstående risk" i HOSTING_AND_INDEXING.md.
#
# OCI-blockvolymer går att växa men aldrig krympa. 150 är alltså ett slutgiltigt
# golv: att gå tillbaka till 100 kräver ny volym och datamigrering.

resource "oci_core_volume" "data" {
  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  display_name        = "hltv-data"
  size_in_gbs         = 150

  # VPU 10 = Balanced. Always Free tillåter inte högre prestandanivå.
  vpus_per_gb = 10

  lifecycle {
    prevent_destroy = true
  }
}

resource "oci_core_volume_attachment" "data" {
  # Paravirtualized: ingen iSCSI-konfiguration i gästen, volymen dyker upp
  # direkt som en vanlig blockenhet utan attach-skript.
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.hltv.id
  volume_id       = oci_core_volume.data.id

  # Monteras av provisioneringsskriptet via fstab, inte av Oracle.
  is_read_only = false
}

# Uppmätt efter attach: volymen blev /dev/sdb med symlänken
# /dev/oracleoci/oraclevda — INTE oraclevdb. Oracles symlänkar numreras per
# attachment, inte per enhetsbokstav, och krockar här med bootvolymens
# partitioner (oraclevda1/15/16 pekar på sda). Sökvägen är därför inte
# pålitlig över omstarter.
#
# fstab ska montera på UUID, som sätts när btrfs-filsystemet skapas:
#   mkfs.btrfs -L hltv-data /dev/disk/by-id/... && blkid -s UUID -o value ...
#   UUID=<uuid> /srv/demos btrfs compress=zstd:3,noatime 0 2
output "data_volume_ocid" {
  description = "Datavolymens OCID. Enhetssökvägen i gästen är medvetet inte en output — montera på UUID."
  value       = oci_core_volume.data.id
}
