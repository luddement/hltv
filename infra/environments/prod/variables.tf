variable "region" {
  description = "OCI-region. Stockholm har exakt en availability domain."
  type        = string
  default     = "eu-stockholm-1"
}

variable "compartment_ocid" {
  description = "Tenancy root — all infra ligger direkt i root, inget eget compartment."
  type        = string
}

variable "availability_domain" {
  description = "iJtZ:EU-STOCKHOLM-1-AD-1 — den enda som finns i regionen."
  type        = string
}

variable "ssh_public_key_path" {
  description = "Publik SSH-nyckel som läggs i instansens metadata."
  type        = string
  default     = "~/.ssh/hltv.key.pub"
}

# OCID:er för resurser som byggdes för hand 2026-08-16 och importeras.
variable "vcn_ocid" { type = string }
variable "subnet_ocid" { type = string }
variable "internet_gateway_ocid" { type = string }
variable "default_route_table_ocid" { type = string }
variable "default_security_list_ocid" { type = string }
variable "instance_ocid" { type = string }
