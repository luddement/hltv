# Autentisering läses ur ~/.oci/config, profil DEFAULT — samma profil som
# oci-cli och oci-launch-retry.sh använder. Inga nycklar i repot.
provider "oci" {
  config_file_profile = "DEFAULT"
  region              = var.region
}
