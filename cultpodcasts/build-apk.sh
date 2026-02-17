#!/bin/bash
# Build Android APK with Bubblewrap in Docker
# This script uses expect to handle interactive prompts
set -e

echo "=== Step 1: Verify workspace ==="
echo "Working directory: $(pwd)"
ls -la | head -20

echo ""
echo "=== Step 2: Verify manifest ==="
if [ -f "twa-manifest.json" ]; then
  echo "✓ Manifest exists"
  grep "appVersion" twa-manifest.json | head -1
else
  echo "✗ No manifest file found"
  ls -la twa-manifest* 2>/dev/null || echo "No manifest files"
fi

echo ""
echo "=== Step 3: Install expect ==="
apt-get update -qq 2>/dev/null || true
apt-get install -y -qq expect >/dev/null 2>&1 || true
echo "✓ expect installed"

echo ""
echo "=== Step 4: Build with Bubblewrap (interactive prompts) ==="
echo "This may take several minutes on first run (SDK download)..."

# Extract version from manifest - use multiple methods to ensure we get it
if [ -f "twa-manifest.json" ]; then
  APP_VERSION=$(grep -oP '"appVersion":\s*"\K[^"]+' twa-manifest.json 2>/dev/null || \
                grep '"appVersion"' twa-manifest.json | sed 's/.*"appVersion"[^"]*"\([^"]*\)".*/\1/' || \
                echo "1.8.0")
else
  APP_VERSION="1.8.0"
fi

export APP_VERSION
echo "Using version: $APP_VERSION"

expect << 'EXPECT_EOF'
set timeout 600
set log_user 1

# Get version from environment
set appVersion $::env(APP_VERSION)
puts ">>> Expect script starting with version: $appVersion"

spawn bubblewrap build --skipPwaValidation

expect {
  "Where is your JDK installed?" {
    puts "\n>>> JDK path prompt detected"
    send "/usr/lib/jvm/java-17-openjdk-amd64\r"
    exp_continue
  }
  "Where is your Android SDK installed?" {
    puts "\n>>> Android SDK path prompt detected"
    send "~/.bubblewrap/android_sdk\r"
    exp_continue
  }
  "Do you want me to download it?" {
    puts "\n>>> SDK download prompt detected"
    send "y\r"
    exp_continue
  }
  -re "versionName for the new App version:\\s*$" {
    puts "\n>>> Version prompt detected, sending: $appVersion"
    send -- "$appVersion\r"
  }
  "Accept? (y/N):" {
    puts "\n>>> License acceptance prompt detected"
    send "y\r"
    exp_continue
  }
  "would you like to regenerate" {
    puts "\n>>> Regenerate prompt detected - must regenerate to create gradlew"
    send "y\r"
    exp_continue
  }
  "project? (Y/n)" {
    puts "\n>>> Project confirmation prompt detected"
    send "y\r"
    exp_continue
  }
  eof {
    puts "\n>>> Build process completed"
    exit 0
  }
  timeout {
    puts "\n>>> ERROR: Timeout after 600 seconds"
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
