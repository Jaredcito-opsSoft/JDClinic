#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo 'Uso: setup-backend.sh DB_PRIVATE_IP FRONT_PUBLIC_IP REGION' >&2
  exit 2
fi
DB_IP="$1"
FRONT_IP="$2"
REGION="$3"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y git curl python3 unzip
if ! command -v aws >/dev/null 2>&1; then
  curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/jdclinic-awscliv2.zip
  unzip -qo /tmp/jdclinic-awscliv2.zip -d /tmp/jdclinic-awscli
  /tmp/jdclinic-awscli/aws/install -i /usr/local/aws-cli -b /usr/local/bin
fi
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/jdclinic-nodesource.sh
bash /tmp/jdclinic-nodesource.sh
apt-get install -y nodejs

REPO=/home/ubuntu/JDClinic
if [[ ! -d "$REPO/.git" ]]; then
  sudo -u ubuntu git clone https://github.com/Jaredcito-opsSoft/JDClinic.git "$REPO"
else
  sudo -u ubuntu git -C "$REPO" pull --ff-only
fi
cd "$REPO"
sudo -u ubuntu npm ci
sudo -u ubuntu npm --prefix backend run db:generate
sudo -u ubuntu npm --prefix backend run build

if [[ ! -e /etc/jdclinic/backend.env ]]; then
  JDCLINIC_DB_PASSWORD="$(aws ssm get-parameter --name /jdclinic/lab/db-password --with-decryption --region "$REGION" --query Parameter.Value --output text)"
  export JDCLINIC_DB_PASSWORD
  bash aws/make-backend-env.sh "$DB_IP" "http://$FRONT_IP" "$REGION"
  unset JDCLINIC_DB_PASSWORD
fi
set -a
source /etc/jdclinic/backend.env
set +a
sudo -u ubuntu env DATABASE_URL="$DATABASE_URL" npm --prefix backend run db:sync
cp aws/jdclinic-backend.service /etc/systemd/system/jdclinic-backend.service
systemctl daemon-reload
systemctl enable --now jdclinic-backend
systemctl restart jdclinic-backend
curl --retry 12 --retry-delay 2 --retry-connrefused -fsS http://127.0.0.1:4000/api/v1/health

apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
docker volume inspect jdclinic_n8n_data >/dev/null 2>&1 || docker volume create jdclinic_n8n_data
docker compose -f n8n/compose.yaml up -d
docker compose -f n8n/compose.yaml ps
