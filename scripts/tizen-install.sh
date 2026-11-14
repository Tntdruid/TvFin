#!/bin/bash
# Runs INSIDE the ghcr.io/georift/install-jellyfin-tizen container.
# Packages /src (the app folder) into TvFin.wgt with the container's built-in developer certificate
# and installs it on the TV. Same approach as georift's entrypoint.sh.
set -e
TV_IP="$1"
if [ -z "$TV_IP" ]; then echo "Usage: tizen-install.sh <tv-ip>"; exit 1; fi

export PATH="$PATH:/home/developer/tizen-studio/tools/ide/bin:/home/developer/tizen-studio/tools"
WORK=/home/developer/tvfin
rm -rf "$WORK"
mkdir -p "$WORK/app" "$WORK/out"
cp -r /src/. "$WORK/app/"

echo "==> Packaging app..."
tizen package -t wgt -o "$WORK/out" -- "$WORK/app"
WGT=$(ls "$WORK/out"/*.wgt | head -n 1)
WGT_NAME=$(basename "$WGT")
if [ -d /out ]; then cp "$WGT" /out/ && echo "    Copied to dist/$WGT_NAME"; fi

echo "==> Connecting to TV ($TV_IP)..."
sdb connect "$TV_IP"
TV_NAME=$(sdb devices | grep -E 'device\s+\w+[-]?\w+' -o | sed 's/device//' - | xargs)
if [ -z "$TV_NAME" ]; then
    echo "TV not found. Is Developer Mode enabled with this machine's IP, and is the TV turned on?"
    exit 1
fi
echo "    Found: $TV_NAME"

echo "==> Installing $WGT_NAME..."
tizen install -n "$WGT_NAME" -t "$TV_NAME" -- "$WORK/out"
echo "==> Done! Find TvFin under Apps on the TV."
