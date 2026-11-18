#!/usr/bin/env bash
set -euo pipefail

REGION=us-east-1
RDS=jdclinic-rds
status="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$RDS" --query 'DBInstances[0].DBInstanceStatus' --output text)"
if [[ "$status" == available ]]; then
  aws rds stop-db-instance --region "$REGION" --db-instance-identifier "$RDS" --query 'DBInstance.DBInstanceStatus' --output text
elif [[ "$status" != stopped && "$status" != stopping ]]; then
  echo "RDS está en estado $status; espera a que esté disponible antes de detenerlo." >&2
  exit 1
fi
for attempt in {1..90}; do
  status="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$RDS" --query 'DBInstances[0].DBInstanceStatus' --output text)"
  [[ "$status" == stopped ]] && break
  if [[ "$status" != stopping ]]; then
    echo "RDS cambió a $status en vez de stopped." >&2
    exit 1
  fi
  sleep 10
done
[[ "$status" == stopped ]] || { echo 'RDS sigue deteniéndose; vuelve a consultar su estado.' >&2; exit 1; }
echo 'RDS detenida. Ahora pulsa End Lab en Vocareum.'
