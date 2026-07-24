#!/bin/bash
set -euo pipefail

echo ENV:
echo "$(env)"

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
else
   echo "Leaving environment config"
fi

# Build-time flags → src/config/build.json (imported by the app as buildConfig).
# Set FLIX_PROMO_ENABLED in the Pages dashboard (Preview / Production), then redeploy.
# Unset locally → default on.
if [ "${FLIX_PROMO_ENABLED+x}" = "x" ] && [ -n "${FLIX_PROMO_ENABLED}" ]; then
  raw_promo="$FLIX_PROMO_ENABLED"
  echo "FLIX_PROMO_ENABLED from dashboard/env: ${raw_promo}"
else
  raw_promo=true
  echo "FLIX_PROMO_ENABLED unset — defaulting to true"
fi
promo_norm="$(printf '%s' "$raw_promo" | tr '[:upper:]' '[:lower:]')"
case "$promo_norm" in
  false|0|off) promo_enabled=false ;;
  *) promo_enabled=true ;;
esac

BUILD_JSON=src/config/build.json
echo "→ writing ${BUILD_JSON} (flixPromoEnabled=${promo_enabled})"
node -e "
const fs = require('fs');
const path = process.argv[1];
const enabled = process.argv[2] === 'true';
const config = { flixPromoEnabled: enabled };
fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log(path + ': ' + JSON.stringify(config));
" "$BUILD_JSON" "$promo_enabled"

echo "Node $(node -v) (need >=22.22.3 for Angular 22)"

node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts

echo "Build"
npx npm run build --configuration "${env}"

echo "Process"
npx npm run process

echo "Build complete"
