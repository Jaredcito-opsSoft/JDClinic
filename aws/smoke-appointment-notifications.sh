#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/JDClinic
set -a
source /etc/jdclinic/backend.env
set +a

export JDCLINIC_TEST_EMAIL=robertope2016@gmail.com
export JDCLINIC_TEST_CHAT_ID="$(python3 aws/find-test-chat.py)"
node backend/scripts/smoke-clinic.mjs
unset JDCLINIC_TEST_EMAIL JDCLINIC_TEST_CHAT_ID
