// Website #669: writes the build-time version (tools/build-version.cjs) into the app. Nothing here is committed:
// package.json keeps its fixed base version, and the bubblewrap.json versions are set by tools/create-twa-manifest.js.
const fs = require("fs");
const path = require("path");
const { currentBuildVersion } = require("./tools/build-version.cjs");

const info = currentBuildVersion();
const buildDate = new Date().toISOString();

// Update version in src/environments/version.prod.ts
const content = `export const version = '${info.version}';
export const buildDate = '${buildDate}';
export const commitHash = '${info.commit}';`;

fs.writeFileSync("./src/environments/version.prod.ts", content);
console.log("✓ Updated src/environments/version.prod.ts");

// Update iOS Info.plist if it exists
const iosInfoPlistPath = path.join(__dirname, 'ios-app/cultpodcasts/Info.plist');
if (fs.existsSync(iosInfoPlistPath)) {
  let infoPlist = fs.readFileSync(iosInfoPlistPath, 'utf8');

  // CFBundleShortVersionString must be numeric (x.y.z): the base version.
  infoPlist = infoPlist.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*/,
    `$1${info.base}`
  );

  // CFBundleVersion must rise with every build: the run number, else epoch seconds.
  infoPlist = infoPlist.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*/,
    `$1${info.iosBuildNumber}`
  );

  fs.writeFileSync(iosInfoPlistPath, infoPlist);
  console.log("✓ Updated iOS Info.plist");
}

console.log('');
console.log("Updated version information:", { version: info.version, commitHash: info.commit, buildDate });
