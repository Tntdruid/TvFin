#!/bin/bash
# Pulls the latest version from GitHub and installs it on the TV.
# Usage:  ./update.sh 192.168.1.50   (the IP is saved in .tv-ip, so next time ./update.sh is enough)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

TV_IP="$1"
if [ -z "$TV_IP" ] && [ -f .tv-ip ]; then TV_IP="$(cat .tv-ip)"; fi
if [ -z "$TV_IP" ]; then echo "Usage: ./update.sh <tv-ip>"; exit 1; fi
echo "$TV_IP" > .tv-ip

echo "==> Pulling latest version from GitHub..."
git pull --ff-only

exec "$ROOT/install.sh" "$TV_IP"
