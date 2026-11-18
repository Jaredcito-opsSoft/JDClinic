#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then
  echo 'Uso: restore-n8n.sh BUCKET_S3 REGION' >&2
  exit 2
fi

BUCKET="$1"
REGION="$2"
VOL_DIR=/var/lib/docker/volumes/jdclinic_n8n_data/_data
ENV_FILE=/etc/jdclinic/backend.env
ARCHIVE=/tmp/jdclinic-n8n-data.tar.gz
SECRET_FILE=/tmp/jdclinic-webhook-secret.txt
trap 'rm -f "$ARCHIVE" "$SECRET_FILE"' EXIT

test -d "$VOL_DIR"
test -f "$ENV_FILE"
aws s3 cp "s3://$BUCKET/migration/jdclinic-n8n-data.tar.gz" "$ARCHIVE" --region "$REGION" --only-show-errors
aws s3 cp "s3://$BUCKET/migration/webhook-secret.txt" "$SECRET_FILE" --region "$REGION" --only-show-errors
test -s "$ARCHIVE"
test -s "$SECRET_FILE"
ARCHIVE_LIST="$(tar -tzf "$ARCHIVE")"
if ! grep -qxE '^\.?/?\.n8n/config$' <<<"$ARCHIVE_LIST"; then
  echo 'El respaldo n8n no incluye la clave de cifrado.' >&2
  exit 1
fi

docker stop jdclinic-n8n >/dev/null
tar -czf /tmp/jdclinic-n8n-before-restore.tar.gz -C "$VOL_DIR" .
aws s3 cp /tmp/jdclinic-n8n-before-restore.tar.gz "s3://$BUCKET/migration/jdclinic-n8n-before-restore.tar.gz" --sse AES256 --region "$REGION" --only-show-errors
find "$VOL_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
tar -xzf "$ARCHIVE" --strip-components=1 -C "$VOL_DIR"
chown -R 1000:1000 "$VOL_DIR"

cp -p "$ENV_FILE" /etc/jdclinic/backend.env.pre-n8n-restore
export ENV_FILE SECRET_FILE
python3 - <<'PY'
import os
import shlex
from pathlib import Path

path = Path(os.environ['ENV_FILE'])
secret = Path(os.environ['SECRET_FILE']).read_text(encoding='utf-8').strip()
if len(secret) < 16:
    raise SystemExit('Secreto de webhook demasiado corto')
updates = {
    'N8N_WEBHOOK_SECRET': secret,
    'N8N_WEBHOOK_URL': 'http://127.0.0.1:5679/webhook/ece-telegram',
}
lines = path.read_text(encoding='utf-8').splitlines()
found = set()
result = []
for line in lines:
    key = line.split('=', 1)[0]
    if key in updates:
        result.append(key + '=' + shlex.quote(updates[key]))
        found.add(key)
    else:
        result.append(line)
for key, value in updates.items():
    if key not in found:
        result.append(key + '=' + shlex.quote(value))
tmp = path.with_suffix('.env.new')
tmp.write_text('\n'.join(result) + '\n', encoding='utf-8')
tmp.chmod(0o600)
tmp.replace(path)
PY
chown ubuntu:ubuntu "$ENV_FILE"

docker start jdclinic-n8n >/dev/null
systemctl restart jdclinic-backend
curl --retry 20 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:5679/healthz >/dev/null
curl --retry 20 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:4000/api/v1/health >/dev/null

python3 - <<'PY'
import sqlite3
from pathlib import Path

db = Path('/var/lib/docker/volumes/jdclinic_n8n_data/_data/database.sqlite')
with sqlite3.connect(f'file:{db}?mode=ro', uri=True) as conn:
    workflows = conn.execute('SELECT name, active FROM workflow_entity WHERE name LIKE ?', ('%JDClinic%',)).fetchall()
    credentials = conn.execute('SELECT COUNT(*) FROM credentials_entity').fetchone()[0]
if not workflows or not any(active for _, active in workflows) or credentials < 3:
    raise SystemExit('El flujo activo o sus credenciales no se restauraron.')
print(f'n8n activo: {len(workflows)} flujo(s) JDClinic; {credentials} credenciales.')
PY

aws s3 rm "s3://$BUCKET/migration/webhook-secret.txt" --region "$REGION" --only-show-errors
echo 'n8n y la API quedaron configurados para avisos.'
