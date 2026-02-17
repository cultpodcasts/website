#!/bin/bash
# Build Android APK with Bubblewrap in Docker
# This script handles all the setup and interactive prompts
set -e

echo "=== Step 1: Pre-configure Bubblewrap ==="
mkdir -p ~/.bubblewrap
cat > ~/.bubblewrap/config.json << 'EOF'
{
  "jdkPath": "/opt/java/openjdk",
  "androidSdkPath": "/opt/android"
}
EOF
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
  grep "appVersion" twa-manifest.json | head -1
  echo "Checksum: $(cat .twa-manifest.json.sha1)"
else
  echo "✗ Missing manifest or checksum"
  ls -la twa-manifest* 2>/dev/null || echo "No manifest files found"
fi

echo ""
echo "=== Step 4: Install expect ==="
apt-get update -qq 2>/dev/null || true
apt-get install -y -qq expect >/dev/null 2>&1 || true
echo "✓ expect installed"

echo ""
echo "=== Step 5: Build with Bubblewrap ==="

expect << 'EXPECT_EOF'
set timeout 300
set log_user 1

spawn bubblewrap build --skipPwaValidation

expect {
  "Accept? (y/N):" {
    puts ">>> Responding to license prompt: y"
    send "y\r"
    exp_continue
  }
  "would you like to regenerate" {
    puts ">>> Responding to regenerate prompt: y"
    send "y\r"
    exp_continue
  }
  "project? (Y/n)" {
    puts ">>> Responding to project prompt: y"
    send "y\r"
    exp_continue
  }
  eof {
    puts ">>> Build process completed"
    exit 0
  }
  timeout {
    puts ">>> ERROR: Timeout"
    exit 1
  }
}
EXPECT_EOF

BUILD_EXIT=$?

echo ""
echo "=== Step 6: Verify build output ==="

if [ -f "app-release-signed.apk" ]; then
  echo "✓ Signed APK created"
  ls -lh app-release-signed.apk
elif [ -f "app-release.apk" ]; then
  echo "⚠ Unsigned APK found"
  ls -lh app-release.apk
else
  echo "✗ No APK found"
  ls -la app-* 2>/dev/null || echo "(no app files)"
fi

if [ -f "app-release-bundle.aab" ]; then
  echo "✓ Bundle created"
  ls -lh app-release-bundle.aab
fi

echo ""
if [ $BUILD_EXIT -eq 0 ]; then
  echo "=== BUILD SUCCESSFUL ==="
else
  echo "=== BUILD FAILED (exit: $BUILD_EXIT) ==="
fi

exit $BUILD_EXIT
