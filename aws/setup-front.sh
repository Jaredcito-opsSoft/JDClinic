#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo 'Uso: setup-front.sh BACK_PRIVATE_IP' >&2
  exit 2
fi
BACK_IP="$1"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y git curl nginx
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
sudo -u ubuntu npm --prefix frontend run build
install -d -m 755 /var/www/jdclinic
cp -a frontend/dist/. /var/www/jdclinic/
sed "s/__BACKEND_PRIVATE_IP__/$BACK_IP/g" aws/nginx-front.conf > /etc/nginx/sites-available/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
curl -fsS http://127.0.0.1/ >/dev/null
echo 'Frontend publicado; prueba API: '
curl -fsS http://127.0.0.1/api/v1/health
