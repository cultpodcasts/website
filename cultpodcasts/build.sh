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

# Homepage Flix promo — Cloudflare Pages plaintext var FLIX_PROMO_ENABLED
# (Preview / Production). Kept out of wrangler.jsonc `vars` so the dashboard
# owns it. Unset locally → default on. Redeploy after flipping the value.
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
echo "→ baking flixPromoEnabled=${promo_enabled} into environment files"
node -e "
const fs = require('fs');
const enabled = process.argv[1] === 'true';
for (const p of [
  'src/environments/environment.ts',
  'src/environments/environment.staging.ts',
  'src/environments/environment.production.ts',
  'src/environments/environment.local.ts',
]) {
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  if (!/flixPromoEnabled\s*:/.test(s)) {
    console.warn('skip ' + p + ': flixPromoEnabled missing');
    continue;
  }
  s = s.replace(/flixPromoEnabled\s*:\s*(true|false)/, 'flixPromoEnabled: ' + enabled);
  fs.writeFileSync(p, s);
  console.log(p + ': flixPromoEnabled=' + enabled);
}
" "$promo_enabled"

echo "Node $(node -v) (need >=22.22.3 for Angular 22)"

node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts

echo "Build"
npx npm run build --configuration "${env}"

echo "Process"
npx npm run process

echo "Build complete"
