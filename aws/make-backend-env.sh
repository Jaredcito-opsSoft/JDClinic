#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo 'Uso: sudo bash aws/make-backend-env.sh DB_IP_PRIVADA ORIGEN_FRONTEND REGION [BUCKET_S3]' >&2
  exit 2
fi
if [[ -e /etc/jdclinic/backend.env ]]; then
  echo 'El archivo de claves ya existe; no se reemplazará.' >&2
  exit 1
fi

DB_HOST="$1"
FRONTEND_ORIGIN="$2"
AWS_REGION="$3"
AWS_S3_BUCKET_NAME="${4:-}"
read -rsp 'Contraseña de jdclinic_app en PostgreSQL: ' DB_PASSWORD
echo
export DB_HOST FRONTEND_ORIGIN AWS_REGION AWS_S3_BUCKET_NAME DB_PASSWORD

install -d -m 700 -o ubuntu -g ubuntu /etc/jdclinic
python3 - <<'PY'
import os
import secrets
import shlex
from pathlib import Path
from urllib.parse import quote

db_password = quote(os.environ['DB_PASSWORD'], safe='')
db_host = os.environ['DB_HOST']
values = {
    'NODE_ENV': 'production',
    'DEPLOYMENT_MODE': 'academy-ec2',
    'PORT': '4000',
    'DATABASE_URL': f'postgresql://jdclinic_app:{db_password}@{db_host}:5432/jdclinic?schema=public&connection_limit=5',
    'FRONTEND_URL': os.environ['FRONTEND_ORIGIN'],
    'CLINICAL_FLE_MASTER_KEY': secrets.token_hex(32),
    'JWT_ACCESS_SECRET': secrets.token_hex(32),
    'JWT_REFRESH_SECRET': secrets.token_hex(32),
    'PRESCRIPTION_SIGNING_KEY': secrets.token_hex(32),
    'N8N_WEBHOOK_URL': 'http://127.0.0.1:5679/webhook/ece-telegram',
    'N8N_WEBHOOK_SECRET': secrets.token_hex(32),
    'AWS_REGION': os.environ['AWS_REGION'],
    'CLINIC_TIME_ZONE': 'America/Mexico_City',
}
if os.environ['AWS_S3_BUCKET_NAME']:
    values['AWS_S3_BUCKET_NAME'] = os.environ['AWS_S3_BUCKET_NAME']
path = Path('/etc/jdclinic/backend.env')
with path.open('x', encoding='utf-8') as handle:
    for key, value in values.items():
        handle.write(f'{key}={shlex.quote(value)}\n')
path.chmod(0o600)
print('Configuración creada. Los valores secretos no se imprimieron.')
PY
chown ubuntu:ubuntu /etc/jdclinic/backend.env
unset DB_PASSWORD

