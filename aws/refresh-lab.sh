#!/usr/bin/env bash
set -euo pipefail

REGION=us-east-1
FRONT_INSTANCE=i-07329b4e1b812f749
BACK_INSTANCE=i-08a1ba1ee7d0a9bf8
BUCKET=jdclinic-clinical-575998221805-use1
RDS=jdclinic-rds

FRONT_IP="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$FRONT_INSTANCE" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
if [[ ! "$FRONT_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Inicia el laboratorio y espera la IP pública del frontend.' >&2
  exit 1
fi

RDS_STATUS="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$RDS" --query 'DBInstances[0].DBInstanceStatus' --output text)"
if [[ "$RDS_STATUS" == stopped ]]; then
  aws rds start-db-instance --region "$REGION" --db-instance-identifier "$RDS" --query 'DBInstance.DBInstanceStatus' --output text
elif [[ "$RDS_STATUS" != available && "$RDS_STATUS" != starting ]]; then
  echo "RDS se encuentra en estado $RDS_STATUS; espera antes de repetir." >&2
  exit 1
fi
aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$RDS"

CORS_FILE="$(mktemp)"
PARAMS_FILE="$(mktemp)"
trap 'rm -f "$CORS_FILE" "$PARAMS_FILE"' EXIT
cat >"$CORS_FILE" <<EOF
{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["POST","GET"],"AllowedOrigins":["http://$FRONT_IP"],"MaxAgeSeconds":300}]}
EOF
aws s3api put-bucket-cors --region "$REGION" --bucket "$BUCKET" --cors-configuration "file://$CORS_FILE"

cat >"$PARAMS_FILE" <<EOF
{"commands":["sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=http://$FRONT_IP|' /etc/jdclinic/backend.env","chown ubuntu:ubuntu /etc/jdclinic/backend.env","systemctl restart jdclinic-backend","curl --retry 20 --retry-delay 2 --retry-all-errors -fsS http://127.0.0.1:4000/api/v1/health"]}
EOF
COMMAND_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$BACK_INSTANCE" --document-name AWS-RunShellScript --parameters "file://$PARAMS_FILE" --query Command.CommandId --output text)"
aws ssm wait command-executed --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$BACK_INSTANCE"
curl --retry 10 --retry-delay 2 --retry-all-errors -fsS "http://$FRONT_IP/api/v1/health" >/dev/null
echo "JDClinic listo: http://$FRONT_IP/"
