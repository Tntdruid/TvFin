#!/bin/bash
# Kører INDE I ghcr.io/georift/install-jellyfin-tizen-containeren.
# Pakker /src (app-mappen) til TvFin.wgt med containerens indbyggede udvikler-certifikat
# og installerer den på TV'et. Samme fremgangsmåde som georift's entrypoint.sh.
set -e
TV_IP="$1"
if [ -z "$TV_IP" ]; then echo "Brug: tizen-install.sh <tv-ip>"; exit 1; fi

export PATH="$PATH:/home/developer/tizen-studio/tools/ide/bin:/home/developer/tizen-studio/tools"
WORK=/home/developer/tvfin
rm -rf "$WORK"
mkdir -p "$WORK/app" "$WORK/out"
cp -r /src/. "$WORK/app/"

echo "==> Pakker app..."
tizen package -t wgt -o "$WORK/out" -- "$WORK/app"
WGT=$(ls "$WORK/out"/*.wgt | head -n 1)
WGT_NAME=$(basename "$WGT")
if [ -d /out ]; then cp "$WGT" /out/ && echo "    Kopieret til dist/$WGT_NAME"; fi

echo "==> Forbinder til TV ($TV_IP)..."
sdb connect "$TV_IP"
TV_NAME=$(sdb devices | grep -E 'device\s+\w+[-]?\w+' -o | sed 's/device//' - | xargs)
if [ -z "$TV_NAME" ]; then
    echo "Fandt ikke TV'et. Er Developer Mode slået til med denne PC's IP, og er TV'et tændt?"
    exit 1
fi
echo "    Fundet: $TV_NAME"

echo "==> Installerer $WGT_NAME..."
tizen install -n "$WGT_NAME" -t "$TV_NAME" -- "$WORK/out"
echo "==> Færdig! Find TvFin under Apps på TV'et."
