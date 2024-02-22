#!/bin/bash
npx ng build
echo build complete
cp ./dist/cultpodcasts/ngsw-worker.js ./dist/cultpodcasts/ngsw-worker-dist.js
echo switched ngsw-worker.js -> ngsw-worker-dist.js
cp ./src/remove-ngsw-worker.js ./dist/cultpodcasts/ngsw-worker.js
echo switched remove-ngsw-worker.js -> ngsw-worker.js
