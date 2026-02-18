#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Change to cultpodcasts directory if running from tools
const workDir = process.cwd().endsWith('tools') ? path.join(__dirname, '..') : process.cwd();
process.chdir(workDir);

// Read base config from bubblewrap.json
const bubblewrapConfig = require('./bubblewrap.json');
const packageJson = require('./package.json');
const appVersion = packageJson.version;

// Convert semantic version (e.g., 1.8.0) to integer version code
// Multiply major*10000 + minor*100 + patch
const versionParts = appVersion.split('.');
const major = parseInt(versionParts[0], 10) || 0;
const minor = parseInt(versionParts[1], 10) || 0;
const patch = parseInt(versionParts[2], 10) || 0;
const appVersionCode = (major * 10000) + (minor * 100) + patch;

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
