#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ || ! "$2" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Uso: enable-https.sh FRONT_PUBLIC_IP BACK_PRIVATE_IP' >&2
  exit 2
fi

FRONT_IP="$1"
BACK_IP="$2"
DOMAIN="${FRONT_IP}.sslip.io"
REPO=/home/ubuntu/JDClinic

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y certbot python3-certbot-nginx

if ! getent ahostsv4 "$DOMAIN" | awk '{print $1}' | grep -Fxq "$FRONT_IP"; then
  echo "DNS de $DOMAIN todavía no apunta a $FRONT_IP" >&2
  exit 1
fi

sed -e "s/__BACKEND_PRIVATE_IP__/$BACK_IP/g" -e "s/server_name _;/server_name $DOMAIN;/" \
  "$REPO/aws/nginx-front.conf" > /etc/nginx/sites-available/default
nginx -t
systemctl reload nginx

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect --keep-until-expiring
systemctl enable --now certbot.timer
curl --resolve "$DOMAIN:443:127.0.0.1" --retry 10 --retry-delay 2 \
  --retry-all-errors -fsS "https://$DOMAIN/api/v1/health"
echo "HTTPS listo: https://$DOMAIN/"
