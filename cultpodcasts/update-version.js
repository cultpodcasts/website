const fs = require("fs");
const path = require("path");
const execSync = require("child_process").execSync;

const packageJson = require("./package.json");
const version = packageJson.version;
const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
const buildDate = new Date().toISOString();

// Update version in src/environments/version.prod.ts
const content = `export const version = '${version}';
export const buildDate = '${buildDate}';
export const commitHash = '${commitHash}';`;

fs.writeFileSync("./src/environments/version.prod.ts", content);
console.log("✓ Updated src/environments/version.prod.ts");

// Update bubblewrap.json (Android) if it exists
const bubblewrapPath = path.join(__dirname, 'bubblewrap.json');
if (fs.existsSync(bubblewrapPath)) {
  const bubblewrap = JSON.parse(fs.readFileSync(bubblewrapPath, 'utf8'));
  bubblewrap.appVersionName = version;
  
  // Increment build code
  bubblewrap.appVersionCode = (parseInt(bubblewrap.appVersionCode || '1') + 1).toString();
  
  fs.writeFileSync(bubblewrapPath, JSON.stringify(bubblewrap, null, 2) + '\n');
  console.log(`✓ Updated bubblewrap.json (v${version}, code ${bubblewrap.appVersionCode})`);
}

// Update iOS Info.plist if it exists
const iosInfoPlistPath = path.join(__dirname, 'ios-app/cultpodcasts/Info.plist');
if (fs.existsSync(iosInfoPlistPath)) {
  let infoPlist = fs.readFileSync(iosInfoPlistPath, 'utf8');
  
  // Update CFBundleShortVersionString (version)
  infoPlist = infoPlist.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*/,
    `$1${version}`
  );
  
  // Update CFBundleVersion (build timestamp)
  const buildNumber = Math.floor(Date.now() / 1000).toString();
  infoPlist = infoPlist.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*/,
    `$1${buildNumber}`
  );
  
  fs.writeFileSync(iosInfoPlistPath, infoPlist);
  console.log("✓ Updated iOS Info.plist");
}

console.log('');
console.log("Updated version information:", { version, commitHash, buildDate });
