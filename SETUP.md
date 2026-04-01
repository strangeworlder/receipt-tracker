# TripTrack — Manual Setup Guide (Windows)

This document covers everything that cannot be automated by code and must be done by hand before the app can run on a device or emulator.

> **Platform note:** This guide is written for **Windows** development. iOS builds require macOS and are marked as such throughout. You can develop and test everything on Android from a Windows machine.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Firebase Project](#2-firebase-project)
3. [Google Cloud Console — Drive API & OAuth](#3-google-cloud-console--drive-api--oauth)
4. [Apple Developer Portal — Apple Sign-In](#4-apple-developer-portal--apple-sign-in)
5. [Environment Variables](#5-environment-variables)
6. [Update app.config.ts — Bundle Identifiers](#6-update-appconfigts--bundle-identifiers)
7. [Native Config Files](#7-native-config-files)
8. [Native Build](#8-native-build)
9. [EAS Setup (CI/CD & Distribution)](#9-eas-setup-cicd--distribution)
10. [Firebase Deployment](#10-firebase-deployment)
11. [Notification Icon Asset](#11-notification-icon-asset)
12. [Checklist Summary](#12-checklist-summary)

---

## 1. Prerequisites

Install the following tools before anything else.

### Node.js

- Download and install [Node.js LTS](https://nodejs.org/) (v18+ recommended)
- Verify installation in PowerShell:
  ```powershell
  node --version
  npm --version
  ```

### Android Studio (Android)
- Download and install [Android Studio](https://developer.android.com/studio)
- Open Android Studio, go to **SDK Manager**, and install:
  - Android SDK Platform 35
  - Android Emulator
  - Android SDK Build-Tools
- Set the following **system environment variables** (via **Settings → System → About → Advanced system settings → Environment Variables**, or in PowerShell for the current session):
  ```powershell
  # Permanent — run in an elevated PowerShell prompt:
  [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
  [System.Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:LOCALAPPDATA\Android\Sdk\emulator;$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
  ```
  > After setting these, **restart your terminal** (or log out/in) for the changes to take effect.

### Gradle (optional — only needed if `gradlew.bat` is missing)

`gradlew.bat` is bundled with your Android project after `npx expo prebuild` and is the **preferred** way to run Gradle tasks. If for any reason you need a global Gradle installation (e.g. to regenerate the wrapper), install it via a Windows package manager:

**Option A — Scoop** (recommended, no admin rights needed):
```powershell
# Install Scoop if you don't have it yet:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install Gradle:
scoop install gradle
```

**Option B — Chocolatey** (requires an elevated/admin terminal):
```powershell
choco install gradle -y
```

Verify after install:
```powershell
gradle --version
```

> **Tip:** If `gradlew.bat` is missing from your `android\` folder, it means `npx expo prebuild` hasn't been run yet (or the `android\` folder was deleted). Run prebuild first — you won't need a global Gradle for day-to-day use.

### Xcode (iOS — macOS only)

> **Windows users:** You cannot build iOS locally. You can still run iOS builds in the cloud via EAS Build (see §9). If you have access to a Mac, install Xcode from the Mac App Store and run:
> ```bash
> sudo xcode-select --install
> ```

### Firebase CLI
```powershell
npm install -g firebase-tools
firebase login
```

### EAS CLI
```powershell
npm install -g eas-cli@latest
eas login
```

---

## 2. Firebase Project

### 2.1 Create the project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `triptrack` (or your preferred name)
3. Disable Google Analytics if you don't need it, or enable it — either is fine
4. Click **Create project**

### 2.2 Enable Authentication

1. In the Firebase console, go to **Build → Authentication**
2. Click **Get started**
3. Under the **Sign-in method** tab, enable:
   - **Google** — toggle on, set the project support email, save
   - **Apple** — toggle on, save (no extra config needed here; see §4 for Apple Developer Portal)
4. Under the **Settings → Authorized domains** tab, your app's bundle ID and `localhost` should already be present

### 2.3 Enable Firestore

1. Go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (security rules will be deployed from `firestore.rules`)
4. Select a region close to your users (e.g. `europe-west1` or `us-central`)
5. Click **Enable**

### 2.4 Enable Storage

1. Go to **Build → Storage**
2. Click **Get started**
3. Choose **Start in production mode**
4. Use the same region as Firestore
5. Click **Done**

### 2.5 Enable Cloud Messaging (FCM)

1. Go to **Build → Cloud Messaging**
2. It is usually already enabled — no action needed unless you see a "Get started" button

### 2.6 Download Android config

1. In the Firebase console, click the **gear icon → Project settings**
2. Under **Your apps**, click **Add app → Android**
3. Register with package name `com.yourcompany.triptrack` (must match `android.package` in `app.config.ts` after you update it in §6)
4. Download `google-services.json`
5. Place it at:
   ```
   android\app\google-services.json
   ```
   > This file is in `.gitignore` — never commit it.

### 2.7 Download iOS config

1. In **Project settings → Your apps**, click **Add app → iOS**
2. Register with bundle ID `com.yourcompany.triptrack` (must match `ios.bundleIdentifier` in `app.config.ts` after §6)
3. Download `GoogleService-Info.plist`
4. Place it at:
   ```
   ios\GoogleService-Info.plist
   ```
   > This file is in `.gitignore` — never commit it.

> **Note:** The `ios\` and `android\` directories are generated by `npx expo prebuild` (see §8). Run prebuild first, then place the config files.

---

## 3. Google Cloud Console — Drive API & OAuth

The same Google Cloud project that backs Firebase is used for Drive API access.

### 3.1 Enable the Drive API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and select the same project as your Firebase project
2. Go to **APIs & Services → Library**
3. Search for **Google Drive API** and click **Enable**

### 3.2 Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace org), click **Create**
3. Fill in:
   - App name: `TripTrack`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and continue**
5. On the **Scopes** screen, click **Add or remove scopes** and add:
   - `https://www.googleapis.com/auth/drive.file`
6. Click **Save and continue** through the remaining steps

### 3.3 Get the Web Client ID (for Google Sign-In)

1. Go to **APIs & Services → Credentials**
2. Find the **Web client (auto created by Google Service)** OAuth 2.0 client — this was created automatically when you added the Android/iOS apps in Firebase
3. Copy its **Client ID** — this becomes `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in your `.env` file (see §5)

---

## 4. Apple Developer Portal — Apple Sign-In

Apple Sign-In requires an active Apple Developer Program membership ($99/year).

> **Windows users:** You can configure the Apple Developer Portal from any browser on Windows. However, building and testing Apple Sign-In requires a macOS machine or an EAS cloud build (see §9).

### 4.1 Enable Apple Sign-In capability for your App ID

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles → Identifiers**
2. Find your app's App ID (create one if needed, using the same bundle ID as `app.config.ts`)
3. Click the App ID, scroll to **Capabilities**, and check **Sign In with Apple**
4. Click **Save**

### 4.2 Enable in Firebase Authentication

1. In the Firebase console → **Authentication → Sign-in method → Apple**
2. Toggle **Enable**
3. Firebase handles the service ID and redirect URL automatically for mobile apps — no extra fields needed
4. Click **Save**

> **Note:** Apple Sign-In only works on physical iOS devices and iOS simulators running iOS 13+. It is automatically hidden on Android via `process.env.EXPO_OS === "ios"` in the onboarding screen.

---

## 5. Environment Variables

Create a `.env` file at the project root. This file is in `.gitignore` and must never be committed.

You can create it from PowerShell:

```powershell
@"
# .env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
"@ | Out-File -FilePath .env -Encoding utf8
```

Or simply create the file manually with any text editor containing:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
```

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → Web client (auto created) → Client ID |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase console → Project settings → General → Project ID |

> Variables must be prefixed with `EXPO_PUBLIC_` to be bundled into the client app.

---

## 6. Update `app.config.ts` — Bundle Identifiers

Replace the placeholder values in `app.config.ts` with your real identifiers:

| Field | Placeholder | What to replace with |
|---|---|---|
| `ios.bundleIdentifier` | `com.yourcompany.triptrack` | Your actual iOS bundle ID (e.g. `com.acme.triptrack`) |
| `android.package` | `com.yourcompany.triptrack` | Your actual Android package name (same value, or different if preferred) |
| `extra.eas.projectId` | `your-eas-project-id` | The EAS project ID — obtained after running `eas init` (see §9) |
| `ios.entitlements["aps-environment"]` | `development` | Change to `production` before submitting to the App Store |

> The bundle ID you choose must exactly match what you register in the Firebase console (§2.6–§2.7), Apple Developer Portal (§4.1), and Google Cloud Console (§3.4).

---

## 7. Native Config Files

After `npx expo prebuild` (§8) creates the `ios\` and `android\` directories, place the Firebase config files:

```
android\
  app\
    google-services.json        ← downloaded from Firebase (§2.6)
ios\
  GoogleService-Info.plist      ← downloaded from Firebase (§2.7)
```

Re-run `npx expo prebuild` if you change `app.config.ts` after placing these files — prebuild reads the paths from the config.

---

## 8. Native Build

### 8.1 Generate the native projects

Run this once, and again whenever you add a new native package or change `app.config.ts`:

```powershell
npx expo prebuild
```

This creates the `ios\` and `android\` directories from the config plugins.

> **Do NOT run `npx expo start` with Expo Go** — `@react-native-firebase` and ML Kit require a custom dev build.

### 8.2 Build and run on Android emulator

```powershell
npx expo run:android
```

Requires Android Studio and a running emulator (or connected device via USB with developer mode enabled).

> **Tip:** Start an Android emulator from Android Studio's **Device Manager** before running this command. You can also list available emulators with:
> ```powershell
> emulator -list-avds
> ```
> And start one with:
> ```powershell
> emulator -avd <avd_name>
> ```

### 8.3 Build and run on iOS simulator (macOS only)

> **Windows users:** Skip this step. Use EAS Build (§9) for iOS builds, or run on a Mac.

```bash
npx expo run:ios
```

Requires Xcode installed on macOS. Builds and launches on the default iOS simulator.

### 8.4 Add SHA-1 fingerprint for Android (Google Sign-In on Android)

> **Do this after `npx expo prebuild`** — `gradlew.bat` is generated by prebuild and won't exist before that.

1. Get your debug SHA-1 from PowerShell:
   ```powershell
   cd android
   .\gradlew.bat signingReport
   ```
   Look for the `SHA1` value under `Variant: debug`.
2. In the Firebase console → **Project settings → Your apps → Android app**
3. Click **Add fingerprint** and paste the SHA-1
4. Click **Save**
5. Re-download `google-services.json` and replace the one in `android\app\`

### 8.5 Verify the build

Once running, confirm:
- All 5 tabs render (Home, Scans, Split, Warranty, Trips)
- Lexend font loads (text should not use the system default)
- NativeWind green primary color (`#02ba41`) is visible

---

## 9. EAS Setup (CI/CD & Distribution)

EAS Build lets you produce shareable `.ipa` / `.apk` builds **in the cloud** — no Xcode or macOS required for iOS builds.

> **Windows advantage:** EAS cloud builds are the recommended way to produce iOS builds from a Windows machine.

### 9.1 Link the project

```powershell
eas init
```

This creates an EAS project and prints a project ID. Copy it into `app.config.ts`:

```typescript
extra: {
  eas: {
    projectId: "paste-your-eas-project-id-here",
  },
},
```

### 9.2 Build for iOS (cloud — no Mac needed)

```powershell
# Development build for iOS simulator
eas build -p ios --profile development

# Development build for a physical device
eas build -p ios --profile development-device

# Production build → App Store / TestFlight
eas build -p ios --profile production --submit
```

> Using `--local` for iOS builds is **only possible on macOS** with Xcode installed. Omit `--local` to build in the EAS cloud.

### 9.3 Build for Android

```powershell
# Development APK (can build locally with --local, or in cloud)
eas build -p android --profile development

# Local development build (requires Android SDK)
eas build -p android --profile development --local

# Production AAB → Play Store
eas build -p android --profile production --submit
```

---

## 10. Firebase Deployment

Deploy backend configuration after the Firebase project is set up (§2).

### 10.1 Firestore security rules

```powershell
firebase deploy --only firestore:rules
```

Source file: `firestore.rules`

### 10.2 Firestore composite indexes

```powershell
firebase deploy --only firestore:indexes
```

Source file: `firestore.indexes.json`

### 10.3 Storage security rules

```powershell
firebase deploy --only storage:rules
```

Source file: `storage.rules`

### 10.4 Cloud Functions

```powershell
Push-Location functions
npm install
Pop-Location
firebase deploy --only functions
```

`resolveGhostParticipant` — handles the ghost-participant → real-user upgrade when someone joins via an invite link. Fully implemented in `functions/src/resolveGhostParticipant.ts`. Only needed for the invite flow in Plan 10; everything else works without it.

To test functions locally before deploying:

```powershell
firebase emulators:start --only functions
```

---

## 11. Notification Icon Asset

The `expo-notifications` plugin references a notification icon that does not exist yet:

```typescript
// app.config.ts
["expo-notifications", {
  icon: "./assets/images/notification-icon.png",   // ← needs to be created
  color: "#02ba41",
}]
```

Create a **96×96 px white monochrome PNG** at `assets\images\notification-icon.png`. Android notification icons must be white on a transparent background. You can use any image editor or generate one from your app icon. This is required before `npx expo prebuild` will succeed without warnings.

---

## 12. Checklist Summary

### What you need right now vs. what can wait

| Goal | What's required |
|---|---|
| Implement & unit-test Plans 05–10 | **Nothing here** — all plans run against Jest mocks; no live Firebase needed |
| Run the app on Android emulator | Firebase project (§2), config files (§7), `npx expo prebuild` (§8), deploy rules + indexes (§10.1–10.3) |
| Run the app on iOS (from Windows) | All of the above + EAS cloud build (§9) — no Mac required |
| Test Google/Apple Sign-In end-to-end | All of the above + OAuth setup (§3–§4) + `.env` file (§5) |
| Test the ghost-participant invite flow | All of the above + Cloud Functions deployed (§10.4) |
| Submit to App Store / Play Store | All of the above + EAS setup (§9) |

**Short answer:** you can finish all remaining implementation plans (05–10) before touching anything in this document. Come back here when you're ready to run on a device.

---

Work through these in order:

### One-time external setup
- [ ] Install [Node.js LTS](https://nodejs.org/) (v18+)
- [ ] Install [Android Studio](https://developer.android.com/studio) and configure the Android SDK
- [ ] Set `ANDROID_HOME` environment variable (see §1)
- [ ] Install Firebase CLI (`npm install -g firebase-tools`) and run `firebase login`
- [ ] Install EAS CLI (`npm install -g eas-cli@latest`) and run `eas login`
- [ ] Create Firebase project and enable: Auth (Google + Apple), Firestore, Storage, Cloud Messaging
- [ ] Enable Google Drive API in Google Cloud Console
- [ ] Configure OAuth consent screen with `drive.file` scope
- [ ] Enable Apple Sign-In for your App ID in Apple Developer Portal *(iOS only, requires Developer account)*

### Per-machine / per-project setup
- [ ] Create `assets\images\notification-icon.png` (96×96 white monochrome PNG)
- [ ] Update `app.config.ts` with real bundle ID / package name
- [ ] Run `eas init` and paste the EAS project ID into `app.config.ts`
- [ ] Create `.env` with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] Run `npx expo prebuild` to generate `android\` (and `ios\` on macOS)
- [ ] Place `google-services.json` in `android\app\`
- [ ] Place `GoogleService-Info.plist` in `ios\` *(macOS / EAS cloud only)*
- [ ] Add Android SHA-1 fingerprint to Firebase and re-download `google-services.json`

### Deploy backend
- [ ] `firebase deploy --only firestore:rules`
- [ ] `firebase deploy --only firestore:indexes`
- [ ] `firebase deploy --only storage:rules`
- [ ] `firebase deploy --only functions`

### Verify
- [ ] `npx expo run:android` — app launches on Android emulator
- [ ] `eas build -p ios --profile development` — iOS build succeeds in the cloud *(no Mac needed)*
- [ ] Google Sign-In works end-to-end
- [ ] Apple Sign-In works on a physical iOS device *(requires Mac or cloud build)*
