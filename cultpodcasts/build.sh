#!/bin/bash
set -euo pipefail

echo ENV:
echo "$(env)"

# Committed ngsw-config.json + index.html preconnect default to api-preview
# (local/staging). Production builds rewrite to the live API host.
API_HOST_PROD="https://api.cultpodcasts.com"
API_HOST_STAGING="https://api-preview.cultpodcasts.com"

NGSW_BAK=""
INDEX_BAK=""

restore_api_host_rewrites() {
  if [ -n "${NGSW_BAK}" ] && [ -f "${NGSW_BAK}" ]; then
    mv "${NGSW_BAK}" ngsw-config.json
    echo "Restored ngsw-config.json"
  fi
  if [ -n "${INDEX_BAK}" ] && [ -f "${INDEX_BAK}" ]; then
    mv "${INDEX_BAK}" src/index.html
    echo "Restored src/index.html"
  fi
}
trap restore_api_host_rewrites EXIT

# `sed -i` is GNU-only. macOS BSD sed treats the script as a backup suffix and
# then parses the filename as the program (`n` in ngsw-config.json →
# "extra characters at the end of n command").
rewrite_inplace() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"
  sed "s|${API_HOST_STAGING}|${API_HOST_PROD}|g" "$file" > "$tmp"
  mv "$tmp" "$file"
}

rewrite_api_host_for_production() {
  NGSW_BAK="$(mktemp)"
  INDEX_BAK="$(mktemp)"
  cp ngsw-config.json "${NGSW_BAK}"
  cp src/index.html "${INDEX_BAK}"
  rewrite_inplace ngsw-config.json
  rewrite_inplace src/index.html
  echo "Rewrote API host ${API_HOST_STAGING} -> ${API_HOST_PROD} in ngsw-config.json and src/index.html"
}

if [ "$env" == "staging" ]
then
    echo "is staging"
    cp src/environments/environment.staging.ts src/environments/environment.ts
    echo "Copied src/environments/environment.staging.ts -> src/environments/environment.ts"
elif [ "$env" == "production" ]
then
    echo "is production"
    cp src/environments/environment.production.ts src/environments/environment.ts
    echo "Copied src/environments/environment.production.ts -> src/environments/environment.ts"
    rewrite_api_host_for_production
else
   echo "Leaving environment config"
fi

echo "Node $(node -v) (need >=22.22.3 for Angular 22)"

node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts

echo "Build"
npx npm run build --configuration "${env}"

echo "Process"
npx npm run process

echo "Build complete"
