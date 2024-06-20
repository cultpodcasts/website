#!/bin/bash
node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts
npx ng build --configuration $env
echo build complete
cp ./dist/cultpodcasts/clpudflare/ngsw-worker.js ./dist/cultpodcasts/clpudflare/ngsw-worker-dist.js
echo switched ngsw-worker.js -> ngsw-worker-dist.js
cp ./src/remove-ngsw-worker.js ./dist/cultpodcasts/clpudflare/ngsw-worker.js
echo switched remove-ngsw-worker.js -> ngsw-worker.js
