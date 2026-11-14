#!/bin/bash
# Henter seneste version fra GitHub og installerer den på TV'et.
# Brug:  ./update.sh 192.168.1.50   (IP huskes i .tv-ip, så næste gang er ./update.sh nok)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

TV_IP="$1"
if [ -z "$TV_IP" ] && [ -f .tv-ip ]; then TV_IP="$(cat .tv-ip)"; fi
if [ -z "$TV_IP" ]; then echo "Brug: ./update.sh <tv-ip>"; exit 1; fi
echo "$TV_IP" > .tv-ip

echo "==> Henter seneste version fra GitHub..."
git pull --ff-only

exec "$ROOT/install.sh" "$TV_IP"
