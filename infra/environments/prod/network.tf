# Nätet byggdes för hand i konsolen 2026-08-16 och importeras här oförändrat.
# Se app/docs/HOSTING_AND_INDEXING.md för de fällor som kostade tid då.

resource "oci_core_vcn" "hltv" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "hltv-vcn"

  # Går inte att ändra i efterhand. Saknas den står det "DNS isn't enabled
  # for this VCN" och hela VCN:en måste byggas om.
  dns_label = "hltvvcn"
}

resource "oci_core_internet_gateway" "hltv" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.hltv.id
  display_name   = "hltv-igw"
  enabled        = true
}

# VCN:ens default-tabell, inte en egen. Därav oci_core_default_route_table:
# defaultresurser skapas av VCN:en själv och kan inte förstöras separat.
resource "oci_core_default_route_table" "hltv" {
  manage_default_resource_id = oci_core_vcn.hltv.default_route_table_id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.hltv.id
  }
}

resource "oci_core_default_security_list" "hltv" {
  manage_default_resource_id = oci_core_vcn.hltv.default_security_list_id

  egress_security_rules {
    destination      = "0.0.0.0/0"
    destination_type = "CIDR_BLOCK"
    protocol         = "all"
    stateless        = false
  }

  # SSH, HTTP, HTTPS. Source Port Range lämnas medvetet tom: fylls den i
  # matchar regeln bara trafik FRÅN den porten, och webbläsare ansluter från
  # slumpade höga portar. Sajten blir onåbar med en konsol som ser rätt ut.
  dynamic "ingress_security_rules" {
    for_each = [22, 80, 443]
    content {
      protocol    = "6" # TCP
      source      = "0.0.0.0/0"
      source_type = "CIDR_BLOCK"
      stateless   = false

      tcp_options {
        min = ingress_security_rules.value
        max = ingress_security_rules.value
      }
    }
  }

  # OCI:s defaultregler. Typ 3 kod 4 är path MTU discovery — tas den bort
  # hänger stora paket på ett sätt som är mycket svårt att felsöka.
  ingress_security_rules {
    protocol    = "1" # ICMP
    source      = "0.0.0.0/0"
    source_type = "CIDR_BLOCK"
    stateless   = false

    icmp_options {
      type = 3
      code = 4
    }
  }

  ingress_security_rules {
    protocol    = "1"
    source      = "10.0.0.0/16"
    source_type = "CIDR_BLOCK"
    stateless   = false

    icmp_options {
      type = 3
    }
  }
}

resource "oci_core_subnet" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.hltv.id
  cidr_block     = "10.0.1.0/24"
  display_name   = "hltv-public"
  dns_label      = "hltvpublic"

  # Regionalt subnät: ingen availability_domain angiven.
  route_table_id    = oci_core_vcn.hltv.default_route_table_id
  security_list_ids = [oci_core_vcn.hltv.default_security_list_id]

  prohibit_public_ip_on_vnic = false
}
