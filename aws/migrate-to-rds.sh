#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 3 ]]; then
  echo 'Uso: migrate-to-rds.sh FRONT_PUBLIC_IP BUCKET_S3 REGION' >&2
  exit 2
fi

FRONT_IP="$1"
BUCKET="$2"
REGION="$3"
REPO=/home/ubuntu/JDClinic
ENV_FILE=/etc/jdclinic/backend.env
BACKUP_FILE=/etc/jdclinic/backend.env.pre-rds

if [[ ! -f "$ENV_FILE" ]]; then
  echo 'Falta la configuración actual del backend.' >&2
  exit 1
fi

RDS_STATUS="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier jdclinic-rds --query 'DBInstances[0].DBInstanceStatus' --output text)"
if [[ "$RDS_STATUS" != available ]]; then
  echo "RDS todavía no está disponible: $RDS_STATUS" >&2
  exit 1
fi
RDS_HOST="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier jdclinic-rds --query 'DBInstances[0].Endpoint.Address' --output text)"
SECRET_ARN="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier jdclinic-rds --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)"
SECRET_JSON="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ARN" --query SecretString --output text)"
DB_PASSWORD="$(printf '%s' "$SECRET_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])')"
unset SECRET_JSON
export DB_PASSWORD RDS_HOST

apt-get update -qq
apt-get install -y postgresql-client
aws s3 cp "s3://$BUCKET/migration/jdclinic.dump" /tmp/jdclinic-migrate.dump --region "$REGION"
test -s /tmp/jdclinic-migrate.dump

export PGPASSWORD="$DB_PASSWORD"
export PGSSLMODE=require
pg_restore --exit-on-error --no-owner --no-privileges -h "$RDS_HOST" -U jdclinic_app -d jdclinic /tmp/jdclinic-migrate.dump
USER_COUNT="$(psql -h "$RDS_HOST" -U jdclinic_app -d jdclinic -Atqc 'SELECT count(*) FROM users')"
if [[ ! "$USER_COUNT" =~ ^[0-9]+$ ]] || [[ "$USER_COUNT" -lt 1 ]]; then
  echo 'La restauración no conservó la cuenta administrativa.' >&2
  exit 1
fi

cd "$REPO"
sudo -u ubuntu git pull --ff-only
sudo -u ubuntu npm ci
sudo -u ubuntu npm --prefix backend run db:generate
sudo -u ubuntu npm --prefix backend run build

export FRONT_IP BUCKET
NEW_DATABASE_URL="$(python3 - <<'PY'
import os
from urllib.parse import quote
print('postgresql://jdclinic_app:' + quote(os.environ['DB_PASSWORD'], safe='') + '@' + os.environ['RDS_HOST'] + ':5432/jdclinic?schema=public&connection_limit=5&sslmode=require')
PY
)"
sudo -u ubuntu env DATABASE_URL="$NEW_DATABASE_URL" npm --prefix backend run db:sync

cp -p "$ENV_FILE" "$BACKUP_FILE"
export NEW_DATABASE_URL ENV_FILE
python3 - <<'PY'
import os
import shlex
from pathlib import Path

path = Path(os.environ['ENV_FILE'])
lines = path.read_text(encoding='utf-8').splitlines()
updates = {
    'DEPLOYMENT_MODE': 'academy-rds',
    'DATABASE_URL': os.environ['NEW_DATABASE_URL'],
    'FRONTEND_URL': 'http://' + os.environ['FRONT_IP'],
    'AWS_S3_BUCKET_NAME': os.environ['BUCKET'],
}
seen = set()
result = []
for line in lines:
    key = line.split('=', 1)[0]
    if key in updates:
        result.append(key + '=' + shlex.quote(updates[key]))
        seen.add(key)
    else:
        result.append(line)
for key, value in updates.items():
    if key not in seen:
        result.append(key + '=' + shlex.quote(value))
tmp = path.with_suffix('.env.new')
tmp.write_text('\n'.join(result) + '\n', encoding='utf-8')
tmp.chmod(0o600)
tmp.replace(path)
PY
chown ubuntu:ubuntu "$ENV_FILE"

systemctl restart jdclinic-backend
if ! curl --retry 15 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:4000/api/v1/health; then
  cp -p "$BACKUP_FILE" "$ENV_FILE"
  systemctl restart jdclinic-backend
  echo 'Se restauró la configuración anterior porque falló la comprobación de salud.' >&2
  exit 1
fi
unset DB_PASSWORD PGPASSWORD NEW_DATABASE_URL
echo "Migración completada; cuentas de usuario restauradas: $USER_COUNT"
