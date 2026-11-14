#!/bin/bash
# Installs TvFin on a Samsung TV via Docker (same container as georift/install-jellyfin-tizen).
# Usage:  ./install.sh 192.168.1.50
set -e
if [ -z "$1" ]; then echo "Usage: ./install.sh <tv-ip>"; exit 1; fi
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/dist"
docker run --rm \
    -v "$ROOT/app:/src:ro" \
    -v "$ROOT/scripts:/scripts:ro" \
    -v "$ROOT/dist:/out" \
    --entrypoint /bin/bash \
    ghcr.io/georift/install-jellyfin-tizen \
    -c "tr -d '\r' < /scripts/tizen-install.sh > /tmp/i.sh && bash /tmp/i.sh $1"
