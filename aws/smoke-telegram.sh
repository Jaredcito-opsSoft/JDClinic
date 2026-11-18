#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/JDClinic
set -a
source /etc/jdclinic/backend.env
set +a

# Reutiliza un chat que ya recibió con éxito una prueba local; no imprime su ID.
JDCLINIC_TEST_CHAT_ID="$(python3 - <<'PY'
import json
import sqlite3

db = '/var/lib/docker/volumes/jdclinic_n8n_data/_data/database.sqlite'
with sqlite3.connect(f'file:{db}?mode=ro', uri=True) as conn:
    rows = conn.execute('''
        SELECT d.data FROM execution_entity e
        JOIN execution_data d ON d.executionId = e.id
        WHERE e.status = 'success' ORDER BY e.id DESC LIMIT 30
    ''').fetchall()

def find_chat(value):
    if isinstance(value, dict):
        chat = value.get('chatId')
        if isinstance(chat, (int, str)) and str(chat).isdigit():
            return str(chat)
        for child in value.values():
            result = find_chat(child)
            if result:
                return result
    if isinstance(value, list):
        for child in value:
            result = find_chat(child)
            if result:
                return result
    return None

for (data,) in rows:
    chat = find_chat(json.loads(data))
    if chat:
        print(chat)
        break
else:
    raise SystemExit('No existe un chat con entrega previa confirmada.')
PY
)"
export JDCLINIC_TEST_CHAT_ID
node backend/scripts/smoke-telegram.mjs
unset JDCLINIC_TEST_CHAT_ID
