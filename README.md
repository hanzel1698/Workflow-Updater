# Workflow Updater

Custom dashboard frontend for the RDO KKD Google Sheets workflow tracker.

## Project layout

| Folder | Purpose |
|--------|---------|
| `windows/` | Desktop/web app (HTML/CSS/JS), Python local server, and EXE build scripts |
| `android/` | Android WebView app that bundles the same dashboard for mobile |
| `scripts/` | Shared maintenance scripts |

The **canonical web source** lives in `windows/`. After editing those files, sync them into the Android app:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-android-assets.ps1
```

## Windows app

**Quick start:** double-click `Launch Dashboard.bat` at the repo root (or `windows\Launch Dashboard.bat`).

**Standalone EXE:**

```powershell
cd windows
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

## Android app

**Sync assets and build release APK:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1
```

Release APK output: `android/app/build/outputs/apk/release/app-release.apk`

Signing uses `android/keystore.properties` and a local keystore (not committed). Generate once:

```powershell
cd android
keytool -genkeypair -v -keystore workflow-updater-release.keystore -alias workflowupdater -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android/keystore.properties`:

```properties
storeFile=workflow-updater-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=workflowupdater
keyPassword=YOUR_KEY_PASSWORD
```

## Google Apps Script

Deploy `windows/google_apps_script.js` as a Web App from your Google Sheet and set the URL in `windows/config.js`.
