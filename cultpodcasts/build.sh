#!/bin/bash
node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts
npx npm run build --configuration $env
echo build complete
echo PWD:
echo "$(pwd)"
echo LS:
echo $(ls)
echo LS dist:
echo $(ls dist)
echo LS dist/cloudflare:
echo $(ls dist/cloudflare)
cp ./dist/cloudflare/ngsw-worker.js ./dist/cloudflare/ngsw-worker-dist.js
echo switched ngsw-worker.js -> ngsw-worker-dist.js
cp ./src/remove-ngsw-worker.js ./dist/cloudflare/ngsw-worker.js
echo switched remove-ngsw-worker.js -> ngsw-worker.js
