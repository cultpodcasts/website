#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Determine the cultpodcasts directory (parent of tools directory)
const cultpodcastsDir = path.join(__dirname, '..');
process.chdir(cultpodcastsDir);

// Read base config from bubblewrap.json
const bubblewrapConfig = require(path.join(cultpodcastsDir, 'bubblewrap.json'));
const { currentBuildVersion } = require('./build-version.cjs');

// Website #669: the version is worked out at build time (see tools/build-version.cjs). versionName is
// `<base>+<sha7>`; versionCode is 100000 + the workflow run number, so it rises with every release.
const buildVersion = currentBuildVersion();
const appVersion = buildVersion.version;
const appVersionCode = buildVersion.versionCode;

// Create manifest by merging bubblewrap config with dynamic values
const manifest = {
  ...bubblewrapConfig,
  appVersionCode: appVersionCode,
  appVersionName: appVersion
};

// Add signing key configuration if secrets are available
const keystorePassword = process.env.KEYSTORE_PASSWORD;
const keyPassword = process.env.KEY_PASSWORD;
const keyAlias = process.env.KEY_ALIAS || 'android';

if (keystorePassword && keyPassword) {
  manifest.signingKey = {
    path: './android.keystore',
    alias: keyAlias,
    keyPassword: keyPassword,
    storePassword: keystorePassword
  };
}

fs.writeFileSync('twa-manifest.json', JSON.stringify(manifest, null, 2));

// Generate SHA1 hash for manifest validation
const manifestContent = JSON.stringify(manifest);
const hash = crypto.createHash('sha1').update(manifestContent).digest('hex');
fs.writeFileSync('.twa-manifest.json.sha1', hash);

console.log(`Created twa-manifest.json with app version ${appVersion} (code: ${appVersionCode})`);
