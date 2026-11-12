#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo 'Uso: setup-db.sh DB_PRIVATE_IP BACK_PRIVATE_IP REGION' >&2
  exit 2
fi
DB_IP="$1"
BACK_IP="$2"
REGION="$3"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y postgresql postgresql-client awscli

DB_PASSWORD="$(aws ssm get-parameter --name /jdclinic/lab/db-password --with-decryption --region "$REGION" --query Parameter.Value --output text)"
if [[ -z "$DB_PASSWORD" || "$DB_PASSWORD" == None ]]; then
  echo 'No se pudo leer la contraseña de la base de datos.' >&2
  exit 1
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE ROLE jdclinic_app LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='jdclinic_app') \gexec
ALTER ROLE jdclinic_app WITH PASSWORD '$DB_PASSWORD';
SELECT 'CREATE DATABASE jdclinic OWNER jdclinic_app' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='jdclinic') \gexec
SQL
unset DB_PASSWORD

PG_VERSION="$(pg_lsclusters --no-header | awk 'NR==1 {print $1}')"
CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"
sed -i -E "s/^#?listen_addresses\s*=.*/listen_addresses = '$DB_IP,localhost'/" "$CONF"
RULE="host jdclinic jdclinic_app $BACK_IP/32 scram-sha-256"
grep -Fxq "$RULE" "$HBA" || printf '\n%s\n' "$RULE" >> "$HBA"
systemctl enable --now postgresql
systemctl restart postgresql
pg_isready -h "$DB_IP" -p 5432
