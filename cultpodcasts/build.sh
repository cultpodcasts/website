#!/bin/bash
echo ENV:
echo "$(env)"

echo "$(env)" > .env

node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts

echo "${env}"
npx npm run build --configuration "${env}"
echo build complete

cp ./dist/cloudflare/ngsw-worker.js ./dist/cloudflare/ngsw-worker-dist.js
echo switched ngsw-worker.js -> ngsw-worker-dist.js

cp ./src/remove-ngsw-worker.js ./dist/cloudflare/ngsw-worker.js
echo switched remove-ngsw-worker.js -> ngsw-worker.js
