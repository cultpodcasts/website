#!/bin/bash
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

node update-version.js
cp src/environments/version.prod.ts src/environments/version.ts

echo "Build"
npx npm run build --configuration "${env}"

echo "Process"
npx npm run process

echo "Build complete"
