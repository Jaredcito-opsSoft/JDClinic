#!/usr/bin/env bash
set -euo pipefail

REGION=us-east-1
FRONT_INSTANCE=i-07329b4e1b812f749
BACK_INSTANCE=i-08a1ba1ee7d0a9bf8
OLD_DB_INSTANCE=i-01bf88c12813a7335
BUCKET=jdclinic-clinical-575998221805-use1
RDS=jdclinic-rds

for instance in "$FRONT_INSTANCE" "$BACK_INSTANCE"; do
  state="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$instance" --query 'Reservations[0].Instances[0].State.Name' --output text)"
  if [[ "$state" == stopped ]]; then
    aws ec2 start-instances --region "$REGION" --instance-ids "$instance" >/dev/null
  fi
done
aws ec2 wait instance-running --region "$REGION" --instance-ids "$FRONT_INSTANCE" "$BACK_INSTANCE"
OLD_DB_STATE="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$OLD_DB_INSTANCE" --query 'Reservations[0].Instances[0].State.Name' --output text)"
if [[ "$OLD_DB_STATE" == running || "$OLD_DB_STATE" == pending ]]; then
  aws ec2 stop-instances --region "$REGION" --instance-ids "$OLD_DB_INSTANCE" >/dev/null
fi

FRONT_IP="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$FRONT_INSTANCE" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
BACK_IP="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$BACK_INSTANCE" --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)"
if [[ ! "$FRONT_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Inicia el laboratorio y espera la IP pública del frontend.' >&2
  exit 1
fi
DOMAIN="$FRONT_IP.sslip.io"

if ! aws ec2 describe-security-groups --region "$REGION" --group-ids sg-01586986350954711 \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`443` && ToPort==`443`]' --output text | grep -q 443; then
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id sg-01586986350954711 \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 >/dev/null
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
{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["POST","GET"],"AllowedOrigins":["https://$DOMAIN"],"MaxAgeSeconds":300}]}
EOF
aws s3api put-bucket-cors --region "$REGION" --bucket "$BUCKET" --cors-configuration "file://$CORS_FILE"

cat >"$PARAMS_FILE" <<EOF
{"commands":["sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|' /etc/jdclinic/backend.env","chown ubuntu:ubuntu /etc/jdclinic/backend.env","systemctl restart jdclinic-backend","curl --retry 20 --retry-delay 2 --retry-all-errors -fsS http://127.0.0.1:4000/api/v1/health"]}
EOF
COMMAND_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$BACK_INSTANCE" --document-name AWS-RunShellScript --parameters "file://$PARAMS_FILE" --query Command.CommandId --output text)"
aws ssm wait command-executed --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$BACK_INSTANCE"

cat >"$PARAMS_FILE" <<EOF
{"commands":["cd /home/ubuntu/JDClinic && sudo -u ubuntu git pull --ff-only","bash /home/ubuntu/JDClinic/aws/enable-https.sh '$FRONT_IP' '$BACK_IP'"]}
EOF
FRONT_COMMAND_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$FRONT_INSTANCE" --document-name AWS-RunShellScript --parameters "file://$PARAMS_FILE" --timeout-seconds 900 --query Command.CommandId --output text)"
for attempt in {1..90}; do
  STATUS="$(aws ssm get-command-invocation --region "$REGION" --command-id "$FRONT_COMMAND_ID" --instance-id "$FRONT_INSTANCE" --query Status --output text 2>/dev/null || true)"
  [[ "$STATUS" == Success ]] && break
  if [[ "$STATUS" == Failed || "$STATUS" == TimedOut || "$STATUS" == Cancelled ]]; then
    aws ssm get-command-invocation --region "$REGION" --command-id "$FRONT_COMMAND_ID" --instance-id "$FRONT_INSTANCE" --query '[StandardOutputContent,StandardErrorContent]' --output text >&2
    exit 1
  fi
  sleep 10
done
[[ "$STATUS" == Success ]] || { echo 'HTTPS tardó demasiado en configurarse.' >&2; exit 1; }
curl --retry 10 --retry-delay 2 --retry-all-errors -fsS "https://$DOMAIN/api/v1/health" >/dev/null
echo "JDClinic listo: https://$DOMAIN/"
