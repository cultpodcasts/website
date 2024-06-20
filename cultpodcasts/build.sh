#!/bin/bash
echo ENV:
echo "$(env)"

cat <<< "$env" > "./.env"

echo LS:
echo $(ls)
echo LS .env:
echo $(ls .env)
echo CAT .env:
echo $(cat .env)

node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts

if [ "$env" == "staging" ]
then
    cp environments/environment.staging.ts environments/environment.ts 
    echo environments/environment.staging.ts -> environments/environment.ts 
fi

echo "${env}"
npx npm run build --configuration "${env}"
echo build complete

cp ./dist/cloudflare/ngsw-worker.js ./dist/cloudflare/ngsw-worker-dist.js
echo switched ngsw-worker.js -> ngsw-worker-dist.js

cp ./src/remove-ngsw-worker.js ./dist/cloudflare/ngsw-worker.js
echo switched remove-ngsw-worker.js -> ngsw-worker.js
