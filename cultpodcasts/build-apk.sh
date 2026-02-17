#!/bin/bash
# Build Android APK with Bubblewrap in Docker
# This script handles all the setup and interactive prompts
set -e

echo "=== Step 1: Pre-configure Bubblewrap ==="
mkdir -p ~/.bubblewrap
cat > ~/.bubblewrap/config.json << 'CONFIGEOF'
{
  "jdkPath": "/opt/java/openjdk",
  "androidSdkPath": "/opt/android"
}
CONFIGEOF
echo "✓ Config created"

echo ""
echo "=== Step 2: Pre-accept Android SDK licenses ==="
export ANDROID_SDK_ROOT=/opt/android
mkdir -p ${ANDROID_SDK_ROOT}/licenses
echo -e "\n24333f8a63b6825ea9c5514f83c2829ac002c39f" > ${ANDROID_SDK_ROOT}/licenses/android-sdk-license
echo -e "\n84831b9409646a918e30573bab4c9c91346d8abd" > ${ANDROID_SDK_ROOT}/licenses/android-sdk-preview-license
echo "✓ Licenses pre-accepted"

echo ""
echo "=== Step 3: Verify manifest and checksum ==="
if [ -f "twa-manifest.json" ] && [ -f ".twa-manifest.json.sha1" ]; then
  echo "✓ Both files exist"
  echo "Manifest version: $(grep -o '"'"'appVersion"'"': "[^"]*' twa-manifest.json)"
  echo "Checksum: $(cat .twa-manifest.json.sha1)"
else
  echo "✗ Missing manifest or checksum"
  ls -la twa-manifest* || echo "No manifest files found"
fi

echo ""
echo "=== Step 4: Install expect for interactive prompt handling ==="
apt-get update -qq 2>/dev/null
apt-get install -y -qq expect >/dev/null 2>&1
echo "✓ expect installed"

echo ""
echo "=== Step 5: Run Bubblewrap build with dynamic prompt handling ==="

# Create expect script
cat > /tmp/build.expect << 'EXPECTEOF'
set timeout 300
set log_user 1

spawn bubblewrap build --skipPwaValidation

expect {
  "Accept? (y/N):" {
    puts "\n>>> Detected license prompt, responding with: y"
    send "y\r"
    exp_continue
  }
  "would you like to regenerate" {
    puts "\n>>> Detected regenerate prompt, responding with: y"
    send "y\r"
    exp_continue
  }
  "project? (Y/n)" {
    puts "\n>>> Detected project prompt, responding with: y"
    send "y\r"
    exp_continue
  }
  eof {
    puts "\n>>> Build process completed"
  }
  timeout {
    puts "\n>>> ERROR: Timeout after 300 seconds"
    exit 1
  }
}
EXPECTEOF

# Run the expect script
expect /tmp/build.expect
BUILD_EXIT=$?

echo ""
echo "=== Step 6: Verify build output ==="

if [ -f "app-release-signed.apk" ]; then
  echo "✓ Signed APK created successfully"
  ls -lh app-release-signed.apk
elif [ -f "app-release.apk" ]; then
  echo "⚠ Unsigned APK found (expected signed)"
  ls -lh app-release.apk
else
  echo "✗ No APK found"
  ls -la app-* 2>/dev/null || echo "  (no app-* files found)"
fi

if [ -f "app-release-bundle.aab" ]; then
  echo "✓ Bundle created successfully"
  ls -lh app-release-bundle.aab
fi

if [ $BUILD_EXIT -eq 0 ]; then
  echo ""
  echo "=== BUILD SUCCESSFUL ==="
else
  echo ""
  echo "=== BUILD HAD ISSUES (exit code: $BUILD_EXIT) ==="
  echo "Review the output above for prompts we may not have captured yet"
fi

exit $BUILD_EXIT
