# Mobile App Builds - GitHub Actions CI/CD

Your project has automated Android APK and iOS IPA builds running on GitHub Actions runners. No local tooling needed!

## How It Works

**Automatic builds on every push to `main`:**
- Android APK built on Ubuntu runner (10-15 min)
- iOS IPA built on macOS runner (15-20 min)
- Artifacts available in GitHub Actions tab

**Release builds on version tag:**
```bash
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```
- Builds APK and IPA
- Auto-uploads to GitHub Releases

## Access Your Builds

**Development builds (every push):**
1. Go to GitHub repo → **Actions** tab
2. Click your workflow run
3. Scroll to **Artifacts** section
4. Download `cultpodcasts-apk` or `cultpodcasts-ios-debug`

**Release builds (version tags):**
1. Go to GitHub repo → **Releases** tab
2. Click your version (v1.0.0, etc)
3. Download APK and IPA files

## Configuration

### Android (`bubblewrap.json`)
```json
{
  "name": "Cult Podcasts",
  "packageId": "com.cultpodcasts.app",
  "appVersionName": "1.0.0",
  "appVersionCode": 1
}
```
- `packageId`: Unique app identifier (used on Google Play)
- `appVersionName`: Match your `package.json` version
- `appVersionCode`: Increment for each Play Store release

### iOS (`ExportOptions.plist`)
```xml
<dict>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>method</key>
    <string>app-store</string>
</dict>
```
- `teamID`: Your Apple Developer Team ID (10 characters)
- `method`: `development`, `ad-hoc`, or `app-store`

## Signing for Distribution

### Android - Google Play Store

**1. Create keystore (one-time):**
```bash
keytool -genkey -v -keystore cultpodcasts.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias cultpodcasts
```

**2. Encode for GitHub:**
```bash
base64 cultpodcasts.keystore > keystore.b64
```

**3. Add GitHub Secrets** (Settings → Secrets and variables → Actions):
- `ANDROID_KEYSTORE_BASE64` - Base64 encoded keystore
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias (cultpodcasts)
- `ANDROID_KEY_PASSWORD` - Key password

**4. Enable signing in workflow:**
Edit `.github/workflows/android-build.yml` and uncomment the signing section (search for "Decode and set up keystore").

**5. Upload to Play Store:**
- Create service account in [Google Cloud Console](https://console.cloud.google.com)
- Enable Play Developer API
- Add `PLAY_STORE_KEY` secret (base64 encoded JSON key)

### iOS - App Store Connect

**1. Export Apple Developer Certificate:**
- Open Keychain Access
- Find your Apple Development certificate
- Right-click → Export as `.p12` file

**2. Get Provisioning Profile:**
- Go to [Apple Developer](https://developer.apple.com)
- Certificates, IDs & Profiles → Profiles
- Download your App Store provisioning profile

**3. Encode for GitHub:**
```bash
base64 Certificate.p12 > cert.b64
base64 profile.mobileprovision > profile.b64
```

**4. Add GitHub Secrets:**
- `IOS_CERTIFICATE_P12_BASE64` - Base64 certificate
- `IOS_CERTIFICATE_PASSWORD` - Certificate password
- `IOS_PROVISIONING_PROFILE_BASE64` - Provisioning profile
- `KEYCHAIN_PASSWORD` - CI keychain password (any secure password)
- `IOS_TEAM_ID` - Apple Developer Team ID

**5. Enable signing in workflow:**
Edit `.github/workflows/ios-build.yml` and uncomment the signing section (search for "Install Apple certificates").

**6. Upload to App Store:**
- Get App Store Connect API key (Users and Access → Keys)
- Add these secrets:
  - `APP_STORE_CONNECT_API_KEY_ID`
  - `APP_STORE_CONNECT_ISSUER_ID`
  - `APP_STORE_CONNECT_API_KEY_BASE64`

## Workflows

### `.github/workflows/android-build.yml`
- Triggers: Push to `main`, manual dispatch, version tags
- Runs: Ubuntu Linux
- Tool: Bubblewrap
- Output: APK artifact

### `.github/workflows/ios-build.yml`
- Triggers: Push to `main`, manual dispatch, version tags
- Runs: macOS
- Tool: Xcode
- Output: IPA artifact (debug and release)

## Troubleshooting

**Build not starting?**
- Verify branch is `main` (workflows filter on this)
- Check Actions tab for errors
- Push a new commit

**APK/IPA not appearing?**
- Scroll down in Actions job to **Artifacts** section
- Artifacts retained for 30 days

**Signing failed?**
- Check GitHub Secrets are set (Settings → Secrets)
- Verify secret names match exactly (case-sensitive)
- Ensure base64 encoding is correct

**"Gradle build error"?**
- Usually Android SDK version mismatch
- Workflow uses Android API 34 - verify SDK installed
- Retry the build

**"Provisioning profile not found"?**
- Verify profile is for App Store (not development)
- Check UDID matches
- Ensure profile isn't expired

## Version Management

Update `package.json` version for your next build:
```json
{
  "version": "1.0.1"
}
```

Built APK/IPA automatically gets this version.

## Next Steps

1. **Test a build:** Push to `main` and check Actions tab
2. **Create a release:** `git tag -a v1.0.0 && git push origin v1.0.0`
3. **For distribution:** Add signing secrets per section above
4. **Upload to stores:** Follow Play Store / App Store upload instructions

## Files

- `.github/workflows/android-build.yml` - Android CI/CD
- `.github/workflows/ios-build.yml` - iOS CI/CD
- `bubblewrap.json` - Android config
- `ExportOptions.plist` - iOS config
