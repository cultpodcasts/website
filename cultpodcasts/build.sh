#!/bin/bash
node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts
npx ng build --configuration $env
echo build complete
cp ./dist/cultpodcasts/cloudflare/ngsw-worker.js ./dist/cultpodcasts/cloudflare/ngsw-worker-dist.js
echo switched ngsw-worker.js -> ngsw-worker-dist.js
cp ./src/remove-ngsw-worker.js ./dist/cultpodcasts/cloudflare/ngsw-worker.js
echo switched remove-ngsw-worker.js -> ngsw-worker.js
