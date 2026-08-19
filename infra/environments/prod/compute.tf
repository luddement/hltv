# Instansen skapades av app/scripts/oci-launch-retry.sh 2026-08-19 17:21, efter
# ungefär 450 försök över tre dygn. Always Free-kapacitet på A1 i Stockholm
# frigörs i skurar på någon minut och är slutsåld resten av tiden.
#
# LÄS DETTA INNAN DU ÄNDRAR NÅGOT HÄR:
# Ett `terraform apply` som tvingar replacement förstör instansen och lyckas
# sedan INTE skapa den igen — kapaciteten finns inte. Det är en enkelriktad
# dörr som kostar dagar att gå tillbaka genom. prevent_destroy stoppar
# `destroy`, men granska ALLTID planen efter raden "must be replaced".
#
# Attribut som tvingar replacement: shape, fault_domain, source_details.image_id,
# availability_domain, create_vnic_details.subnet_id.
# Attribut som går att ändra i drift: shape_config (ocpus/minne),
# source_details.boot_volume_size_in_gbs (bara uppåt), metadata, agent_config.

resource "oci_core_instance" "hltv" {
  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  fault_domain        = "FAULT-DOMAIN-2"
  display_name        = "hltv"
  shape               = "VM.Standard.A1.Flex"

  # Always Free-taket är 4 OCPU / 24 GB totalt över alla A1-instanser.
  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }

  source_details {
    source_type             = "image"
    source_id               = "ocid1.image.oc1.eu-stockholm-1.aaaaaaaaxcefx34xbq2qqbqkzxzmva4jt5aqfd6xdchg7657hfpg7u7evdbq"
    boot_volume_size_in_gbs = 50
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = true
    hostname_label   = "hltv"
  }

  metadata = {
    ssh_authorized_keys = file(pathexpand(var.ssh_public_key_path))
  }

  # Monitoring måste vara på: Oracle bedömer idle-status på CPU-, nätverks- och
  # minnesmått som agenten rapporterar. Se hltv-ballast.service på burken.
  agent_config {
    is_monitoring_disabled   = false
    is_management_disabled   = false
    are_all_plugins_disabled = false
  }

  availability_config {
    recovery_action = "RESTORE_INSTANCE"
  }

  instance_options {
    are_legacy_imds_endpoints_disabled = false
  }

  # Bootvolymen överlever även om instansen på något sätt rivs.
  preserve_boot_volume = true

  lifecycle {
    prevent_destroy = true
  }
}

# Ephemeral public IP. Den överlever stopp/start — Oracle släpper den bara när
# instansen TERMINERAS, när VNIC:en kopplas bort, eller när den privata IP:n
# raderas. Vill du ha en IP som överlever även en terminering krävs en
# reserverad IP, vilket är en egen resurs.
output "instance_public_ip" {
  description = "Publik IP. Ephemeral men stabil så länge instansen inte termineras."
  value       = oci_core_instance.hltv.public_ip
}
