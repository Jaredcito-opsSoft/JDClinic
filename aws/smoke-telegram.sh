#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/JDClinic
set -a
source /etc/jdclinic/backend.env
set +a

# Reutiliza un chat que ya recibió con éxito una prueba local; no imprime su ID.
JDCLINIC_TEST_CHAT_ID="$(python3 aws/find-test-chat.py)"
export JDCLINIC_TEST_CHAT_ID
node backend/scripts/smoke-telegram.mjs
unset JDCLINIC_TEST_CHAT_ID
