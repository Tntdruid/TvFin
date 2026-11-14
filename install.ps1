# Installs TvFin on a Samsung TV via Docker (same container as georift/install-jellyfin-tizen).
# Usage:  .\install.ps1 192.168.1.50
param(
    [Parameter(Mandatory = $true)][string]$TvIp
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed. Get Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force (Join-Path $root 'dist') | Out-Null

$app = (Join-Path $root 'app')
$scripts = (Join-Path $root 'scripts')
$dist = (Join-Path $root 'dist')

docker run --rm `
    -v "${app}:/src:ro" `
    -v "${scripts}:/scripts:ro" `
    -v "${dist}:/out" `
    --entrypoint /bin/bash `
    ghcr.io/georift/install-jellyfin-tizen `
    -c "tr -d '\r' < /scripts/tizen-install.sh > /tmp/i.sh && bash /tmp/i.sh $TvIp"
