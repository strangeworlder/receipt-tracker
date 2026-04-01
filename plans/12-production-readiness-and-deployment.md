# Plan 12: Production Readiness & Deployment

> **Prerequisite:** Plans 01–11 — all app features complete or near-complete.
> **Depends on:** Plan 04 (Auth), Plan 05 (Data Layer), Plan 10 (Deep Linking), Plan 11 (Deferred Features).

This plan covers every production-readiness requirement that no previous plan addresses: transactional email delivery, universal deep links (HTTPS), crash reporting, security hardening, legal compliance (Privacy Policy, Terms of Service, account deletion), environment separation, CI/CD, App Store & Play Store submission, and final deployment orchestration.

> **NativeWind v5 import rule:** Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw` (not `react-native`). Import `Image` from `@/tw/image`.
>
> **Shadow:** Use `boxShadow` CSS strings (not legacy shadow props).
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View.

---

## Part A: Transactional Email — Trip Invitations & Reminders

> **Gap:** The invite system generates `triptrack://invite/...` links and uses `Share.share()` for local sharing, but there is no mechanism to deliver invitations or reminders via email. Ghost participants with only an email address have no way to receive notifications.

### Step A1: Install Firebase Extension — Trigger Email from Firestore

Use the official [Trigger Email from Firestore](https://extensions.dev/extensions/firebase/firestore-send-email) extension. This watches a `mail` collection and sends emails via an SMTP provider.

1. Install the extension in the Firebase console:
   ```
   Firebase Console → Extensions → Install → "Trigger Email from Firestore"
   ```
2. Configure with an SMTP service. Recommended options (choose one):
   - **SendGrid** (free tier: 100 emails/day) — create account at sendgrid.com, generate API key
   - **Mailgun** (free tier: 5,000 emails/month for first 3 months)
   - **Amazon SES** (low-cost, high-volume)

3. Extension configuration:
   - **Email documents collection:** `mail`
   - **Default FROM address:** `noreply@yourdomain.com` (or SendGrid verified sender)
   - **Templates collection (optional):** `emailTemplates`

### Step A2: Create Email Templates Collection

Seed Firestore with email templates:

```typescript
// Seed script — run once via Firebase Admin SDK or Firestore console
const templates = {
  tripInvitation: {
    subject: "You're invited to {{tripName}} on TripTrack!",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #02ba41; padding: 32px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0;">TripTrack</h1>
        </div>
        <div style="padding: 32px; background: #f7fbf3; border: 1px solid #e6f8ec;">
          <h2>{{inviterName}} invited you to join {{tripName}}!</h2>
          <p>Track expenses, split costs, and plan logistics together.</p>
          <a href="{{inviteLink}}" style="display: inline-block; background: #02ba41; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Join Trip
          </a>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            If the button doesn't work, copy this link: {{inviteLink}}
          </p>
        </div>
      </div>
    `,
  },
  settlementReminder: {
    subject: "Reminder: You have an outstanding balance on {{tripName}}",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #02ba41; padding: 32px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0;">TripTrack</h1>
        </div>
        <div style="padding: 32px; background: #f7fbf3; border: 1px solid #e6f8ec;">
          <h2>{{senderName}} sent you a settlement reminder</h2>
          <p>You have an outstanding balance of <strong>{{amount}}</strong> on <strong>{{tripName}}</strong>.</p>
          <a href="{{tripLink}}" style="display: inline-block; background: #02ba41; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            View Trip
          </a>
        </div>
      </div>
    `,
  },
  warrantyExpiring: {
    subject: "Warranty expiring soon: {{productName}}",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #02ba41; padding: 32px; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0;">TripTrack</h1>
        </div>
        <div style="padding: 32px; background: #f7fbf3; border: 1px solid #e6f8ec;">
          <h2>Warranty expires on {{expirationDate}}</h2>
          <p>Your warranty for <strong>{{productName}}</strong> is expiring soon. Consider filing any claims before it expires.</p>
          <a href="{{appLink}}" style="display: inline-block; background: #02ba41; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600;">
            Open TripTrack
          </a>
        </div>
      </div>
    `,
  },
};
```

### Step A3: Cloud Function — `sendInvitationEmail`

File: `functions/src/sendInvitationEmail.ts`

Triggered when a new document is created in `tripInvitations` with a non-empty `inviteeEmail`:

```typescript
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

export const sendInvitationEmail = onDocumentCreated(
  "tripInvitations/{inviteId}",
  async (event) => {
    const data = event.data?.data();
    if (!data?.inviteeEmail) return; // no email → skip

    const inviteLink = `https://yourdomain.com/invite/${event.params.inviteId}?tripId=${data.tripId}`;

    await admin.firestore().collection("mail").add({
      to: data.inviteeEmail,
      template: {
        name: "tripInvitation",
        data: {
          tripName: data.tripName,
          inviterName: data.invitedByName,
          inviteLink,
        },
      },
    });
  }
);
```

### Step A4: Wire Settlement Reminder Email

Update the `sendSettlementReminder` Cloud Function (Plan 11 Part C) to also send an email if the target participant has an email address and no FCM token:

```typescript
// In sendSettlementReminder — after the FCM attempt
if (!fcmToken && targetUser.data()?.email) {
  const tripLink = `https://yourdomain.com/trips/${tripId}`;
  await admin.firestore().collection("mail").add({
    to: targetUser.data()!.email,
    template: {
      name: "settlementReminder",
      data: {
        senderName,
        tripName: trip.name,
        amount: `$${data.amount?.toFixed(2) ?? "0.00"}`,
        tripLink,
      },
    },
  });
}
```

### Step A5: Export and Deploy

Update `functions/src/index.ts`:
```typescript
export { resolveGhostParticipant } from "./resolveGhostParticipant";
export { sendSettlementReminder } from "./sendSettlementReminder";
export { sendInvitationEmail } from "./sendInvitationEmail";
```

---

## Part B: Universal Links (HTTPS Deep Links)

> **Gap:** The app uses a custom URL scheme (`triptrack://`) which only works on devices with the app installed. Invite links shared via email or social media will not open in a browser and will not offer to install the app.

### Step B1: Set Up Firebase Hosting

Firebase Hosting serves as the web fallback for deep links and hosts the privacy policy / terms pages (Part E).

1. Enable Firebase Hosting in the console
2. Update `firebase.json`:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/invite/**",
        "function": "handleInviteWeb"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/.well-known/apple-app-site-association",
        "headers": [{ "key": "Content-Type", "value": "application/json" }]
      }
    ]
  }
}
```

### Step B2: iOS Universal Links — Apple App Site Association

Create `public/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.yourcompany.triptrack",
        "paths": ["/invite/*", "/trips/*", "/receipts/*"]
      }
    ]
  }
}
```

> Replace `TEAMID` with your Apple Developer Team ID.

Update `app.config.ts` to add the associated domain:

```typescript
ios: {
  // ...existing config...
  associatedDomains: [
    "applinks:your-project-id.web.app"
  ],
},
```

### Step B3: Android App Links — `assetlinks.json`

Create `public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.triptrack",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

> Get your SHA-256 fingerprint from `cd android && ./gradlew signingReport`.

Update `app.config.ts`:
```typescript
android: {
  // ...existing config...
  intentFilters: [
    {
      action: "VIEW",
      autoVerify: true,
      data: [
        {
          scheme: "https",
          host: "your-project-id.web.app",
          pathPrefix: "/invite",
        },
        {
          scheme: "https",
          host: "your-project-id.web.app",
          pathPrefix: "/trips",
        },
      ],
      category: ["BROWSABLE", "DEFAULT"],
    },
  ],
},
```

### Step B4: Web Fallback — Invite Landing Cloud Function

File: `functions/src/handleInviteWeb.ts`

When someone opens an invite link in a browser (no app installed), show a web page with app store links:

```typescript
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const handleInviteWeb = onRequest(async (req, res) => {
  const pathParts = req.path.split("/");
  const inviteId = pathParts[pathParts.indexOf("invite") + 1];

  let tripName = "a trip";
  let inviterName = "Someone";

  if (inviteId) {
    const doc = await admin.firestore().collection("tripInvitations").doc(inviteId).get();
    if (doc.exists) {
      tripName = doc.data()?.tripName ?? tripName;
      inviterName = doc.data()?.invitedByName ?? inviterName;
    }
  }

  const deepLink = `triptrack://${req.path}${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Join ${tripName} on TripTrack</title>
      <meta name="description" content="${inviterName} invited you to join ${tripName} on TripTrack." />
      <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f7fbf3; }
        .card { max-width: 400px; padding: 40px; text-align: center; background: white; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
        h1 { color: #02ba41; margin: 0 0 8px; }
        h2 { color: #1b1c19; margin: 16px 0 8px; }
        p { color: #666; line-height: 1.5; }
        .btn { display: inline-block; background: #02ba41; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 8px; }
        .btn-outline { background: transparent; border: 2px solid #02ba41; color: #02ba41; }
        .stores { margin-top: 24px; }
      </style>
      <script>
        // Try to open the app immediately
        window.location.href = "${deepLink}";
      </script>
    </head>
    <body>
      <div class="card">
        <h1>TripTrack</h1>
        <h2>You're invited to ${tripName}!</h2>
        <p>${inviterName} wants you to join their trip. Track expenses, split costs, and plan together.</p>
        <div class="stores">
          <a class="btn" href="${deepLink}">Open in App</a>
          <br />
          <a class="btn btn-outline" href="https://apps.apple.com/app/triptrack/idXXXXXXXXXX">App Store</a>
          <a class="btn btn-outline" href="https://play.google.com/store/apps/details?id=com.yourcompany.triptrack">Google Play</a>
        </div>
      </div>
    </body>
    </html>
  `);
});
```

### Step B5: Update `buildInviteLink`

Update `src/services/tripService.ts` to generate HTTPS links instead of custom scheme:

```typescript
export function buildInviteLink(inviteId: string, tripId: string): string {
  const host = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "triptrack";
  return `https://${host}.web.app/invite/${inviteId}?tripId=${tripId}`;
}
```

### Step B6: Deploy

```bash
firebase deploy --only hosting,functions
```

---

## Part C: Crash Reporting & Analytics

> **Gap:** No crash reporting or analytics. Production bugs will be invisible.

### Step C1: Install Firebase Crashlytics

```bash
npx expo install @react-native-firebase/crashlytics
```

Add plugin to `app.config.ts`:
```typescript
plugins: [
  // ...existing plugins...
  "@react-native-firebase/crashlytics",
],
```

### Step C2: Enable Crashlytics in Firebase Console

1. Firebase Console → **Release & Monitor → Crashlytics**
2. Click **Enable Crashlytics**
3. No code changes needed — the SDK automatically reports unhandled exceptions

### Step C3: Add Crashlytics Error Boundaries

File: `src/components/ErrorBoundary.tsx`

```typescript
import React from "react";
import { View, Text, Pressable } from "@/tw";
import crashlytics from "@react-native-firebase/crashlytics";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    crashlytics().recordError(error, info.componentStack ?? undefined);
  }

  resetError = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <View className="flex-1 bg-surface items-center justify-center px-6">
            <Text className="text-2xl font-extrabold text-on-surface mb-2">
              Something went wrong
            </Text>
            <Text className="text-on-surface-variant text-center mb-6">
              The app encountered an unexpected error. Please try again.
            </Text>
            <Pressable
              onPress={this.resetError}
              className="bg-primary px-8 py-3 rounded-2xl active:scale-95"
              style={{ borderCurve: "continuous" }}
            >
              <Text className="text-on-primary font-semibold">Try Again</Text>
            </Pressable>
          </View>
        )
      );
    }
    return this.props.children;
  }
}
```

### Step C4: Wrap Root Layout

In `app/_layout.tsx`, wrap the `<Stack>` with `<ErrorBoundary>`:

```typescript
import { ErrorBoundary } from "@/components/ErrorBoundary";

// In the return statement:
return (
  <>
    <StatusBar style="dark" />
    <ErrorBoundary>
      <Stack>
        {/* ...existing screens... */}
      </Stack>
    </ErrorBoundary>
  </>
);
```

### Step C5: Install Firebase Analytics (Optional)

```bash
npx expo install @react-native-firebase/analytics
```

Add plugin to `app.config.ts`:
```typescript
plugins: [
  // ...existing plugins...
  "@react-native-firebase/analytics",
],
```

Analytics auto-tracks screen views when using expo-router. No additional code needed for basic analytics. For custom events:

```typescript
import analytics from "@react-native-firebase/analytics";

await analytics().logEvent("receipt_scanned", { category: "dining" });
await analytics().logEvent("trip_created", { participantCount: 4 });
await analytics().logEvent("settlement_completed", { tripId, amount });
```

---

## Part D: Security Hardening — Firebase App Check

> **Gap:** No protection against API abuse. Any client with the Firebase config can call Firestore, Storage, and Cloud Functions directly.

### Step D1: Install App Check

```bash
npx expo install @react-native-firebase/app-check
```

Add plugin to `app.config.ts`:
```typescript
plugins: [
  // ...existing plugins...
  "@react-native-firebase/app-check",
],
```

### Step D2: Register App Attestation Providers

**Firebase Console:**
1. Go to **Project settings → App Check**
2. For iOS: register with **DeviceCheck** (production) or **App Attest** (iOS 14+)
3. For Android: register with **Play Integrity**

### Step D3: Initialize App Check in App

In `app/_layout.tsx`, add initialization before the auth state listener:

```typescript
import { firebase } from "@react-native-firebase/app-check";

useEffect(() => {
  const provider = firebase.appCheck().newReactNativeFirebaseAppCheckProvider();
  provider.configure({
    android: { provider: "playIntegrity" },
    apple: { provider: "appAttestWithDeviceCheckFallback" },
  });
  firebase.appCheck().initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true });
}, []);
```

### Step D4: Enable Enforcement

Once App Check is verified working:
1. Firebase Console → **App Check → APIs**
2. Enable enforcement for: **Cloud Firestore**, **Cloud Storage**, **Cloud Functions**

> **Warning:** Enable enforcement only after the app update with App Check is live on all devices. Enforcing before that will lock out existing users.

### Step D5: Cloud Functions Rate Limiting

Add basic rate limiting to callable Cloud Functions. In `functions/package.json`, add `firebase-functions-rate-limiter`:

```json
"dependencies": {
  "firebase-admin": "^13.0.0",
  "firebase-functions": "^6.0.0",
  "firebase-functions-rate-limiter": "^4.0.0"
}
```

Apply to `sendSettlementReminder`:

```typescript
import { FirebaseFunctionsRateLimiter } from "firebase-functions-rate-limiter";

const limiter = FirebaseFunctionsRateLimiter.withFirestoreBackend(
  { name: "sendSettlementReminder", maxCalls: 10, periodSeconds: 3600 },
  admin.firestore()
);

export const sendSettlementReminder = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  await limiter.rejectOnQuotaExceededOrRecordUsage(request.auth.uid);
  // ...rest of function
});
```

---

## Part E: Privacy Policy, Terms of Service & Account Deletion

> **Gap:** No Privacy Policy or Terms of Service exist. Both Apple App Store and Google Play Store require them. Apple also requires an in-app account deletion mechanism.

### Step E1: Create Static Pages

Create `public/privacy.html` and `public/terms.html` for Firebase Hosting:

**Privacy Policy** (`public/privacy.html`):
- Data collected: email, display name, avatar, receipt images, trip data, device tokens
- Data usage: authentication, expense tracking, trip coordination, push notifications
- Data sharing: only with trip participants (via Firestore security rules)
- Data storage: Firebase (Google Cloud), user's Google Drive (optional)
- Data retention: until user deletes their account
- Third-party services: Firebase, Google Sign-In, Apple Sign-In, Google Drive
- Contact information

**Terms of Service** (`public/terms.html`):
- Service description
- User responsibilities
- Content ownership (users own their data)
- Limitation of liability
- Termination and account deletion rights

### Step E2: Link in Settings Screen

Add Privacy Policy and Terms links to `app/settings.tsx`:

```typescript
import { Linking } from "react-native";

const PRIVACY_URL = "https://your-project-id.web.app/privacy";
const TERMS_URL = "https://your-project-id.web.app/terms";
```

Add a "Legal" section between Notifications and Sign Out:

```typescript
<Card variant="low" className="p-4">
  <View className="gap-1">
    <Text className="text-on-surface font-semibold text-base mb-2">Legal</Text>
    <Pressable
      onPress={() => Linking.openURL(PRIVACY_URL)}
      className="flex-row items-center justify-between py-3 active:opacity-70"
    >
      <View className="flex-row items-center gap-3">
        <MaterialIcon name="policy" size={20} color={colors.primary} />
        <Text className="text-on-surface text-sm">Privacy Policy</Text>
      </View>
      <MaterialIcon name="open_in_new" size={16} color={colors.onSurfaceVariant} />
    </Pressable>
    <Pressable
      onPress={() => Linking.openURL(TERMS_URL)}
      className="flex-row items-center justify-between py-3 active:opacity-70"
    >
      <View className="flex-row items-center gap-3">
        <MaterialIcon name="description" size={20} color={colors.primary} />
        <Text className="text-on-surface text-sm">Terms of Service</Text>
      </View>
      <MaterialIcon name="open_in_new" size={16} color={colors.onSurfaceVariant} />
    </Pressable>
  </View>
</Card>
```

### Step E3: Account Deletion — Cloud Function

> **Apple App Store requirement:** Apps that support account creation must also provide account deletion.

File: `functions/src/deleteUserAccount.ts`

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const deleteUserAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const db = admin.firestore();
  const batch = db.batch();

  // 1. Delete user's receipts
  const receipts = await db.collection("receipts").where("userId", "==", uid).get();
  receipts.forEach(doc => batch.delete(doc.ref));

  // 2. Delete user's warranties
  const warranties = await db.collection("warranties").where("userId", "==", uid).get();
  warranties.forEach(doc => batch.delete(doc.ref));

  // 3. Delete user profile
  batch.delete(db.collection("users").doc(uid));

  // 4. Delete user's Storage files
  const bucket = admin.storage().bucket();
  await bucket.deleteFiles({ prefix: `receipts/${uid}/` });

  // 5. Commit Firestore deletes
  await batch.commit();

  // 6. Remove user from trips (mark as removed, don't delete trip data for other members)
  const trips = await db.collection("trips").where("memberUids", "array-contains", uid).get();
  for (const tripDoc of trips.docs) {
    await tripDoc.ref.update({
      memberUids: admin.firestore.FieldValue.arrayRemove(uid),
      participants: (tripDoc.data().participants ?? []).filter(
        (p: any) => p.uid !== uid
      ),
    });
  }

  // 7. Delete Firebase Auth account
  await admin.auth().deleteUser(uid);

  return { deleted: true };
});
```

### Step E4: Account Deletion UI

Add a "Delete Account" section to `app/settings.tsx`:

```typescript
import functions from "@react-native-firebase/functions";

async function handleDeleteAccount() {
  Alert.alert(
    "Delete Account",
    "This will permanently delete your account, all receipts, warranties, and your data from all trips. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete My Account",
        style: "destructive",
        onPress: async () => {
          try {
            const deleteFn = functions().httpsCallable("deleteUserAccount");
            await deleteFn({});
            // Auth state observer in root layout will redirect to onboarding
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Deletion failed.";
            Alert.alert("Error", message);
          }
        },
      },
    ]
  );
}
```

Place the "Delete Account" button below "Sign out" with destructive error styling:
```typescript
<Pressable onPress={handleDeleteAccount} className="items-center py-4 active:opacity-70">
  <Text className="text-xs text-error">Delete Account</Text>
</Pressable>
```

---

## Part F: Environment Separation (Dev / Staging / Production)

> **Gap:** The app uses a single Firebase project. There is no separation between development, staging, and production environments.

### Step F1: Create Separate Firebase Projects

1. **Development:** `triptrack-dev` — used for local development and testing
2. **Production:** `triptrack` (existing) — used for App Store / Play Store builds

> **Optional:** A staging project (`triptrack-staging`) for QA, but the two-environment model is sufficient for most apps.

### Step F2: Environment-Specific Config Files

Create environment directories:
```
config/
  dev/
    google-services.json
    GoogleService-Info.plist
    .env
  prod/
    google-services.json
    GoogleService-Info.plist
    .env
```

Each `.env`:
```bash
# config/dev/.env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=dev-client-id.apps.googleusercontent.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=triptrack-dev

# config/prod/.env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=prod-client-id.apps.googleusercontent.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=triptrack
```

### Step F3: EAS Build Environment Variables

Update `eas.json` to separate environments:

```json
{
  "cli": {
    "version": ">= 16.0.1",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      },
      "ios": {
        "simulator": true
      }
    },
    "development-device": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step F4: Dynamic Config Selection in `app.config.ts`

```typescript
const APP_ENV = process.env.APP_ENV ?? "development";
const isProd = APP_ENV === "production";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProd ? "TripTrack" : "TripTrack (Dev)",
  slug: "triptrack",
  ios: {
    // ...
    bundleIdentifier: isProd ? "com.yourcompany.triptrack" : "com.yourcompany.triptrack.dev",
    googleServicesFile: isProd
      ? "./config/prod/GoogleService-Info.plist"
      : "./config/dev/GoogleService-Info.plist",
    entitlements: {
      "aps-environment": isProd ? "production" : "development",
    },
  },
  android: {
    // ...
    package: isProd ? "com.yourcompany.triptrack" : "com.yourcompany.triptrack.dev",
    googleServicesFile: isProd
      ? "./config/prod/google-services.json"
      : "./config/dev/google-services.json",
  },
  // ...
});
```

### Step F5: iOS APN Certificate for Production

> **Critical:** The current `app.config.ts` has `"aps-environment": "development"`. This MUST be changed to `"production"` before App Store submission, or push notifications will not work.

The `app.config.ts` in Step F4 handles this dynamically via the `APP_ENV` variable.

---

## Part G: App Store & Play Store Assets

> **Gap:** Current app icons are Expo defaults (`react-logo.png` etc.). No notification icon exists. No store listing metadata.

### Step G1: App Icon

Create production app icons:
- `assets/images/icon.png` — 1024×1024px (iOS App Store icon)
- `assets/images/adaptive-icon.png` — `android-icon-foreground.png` (108×108dp / 432×432px) with TripTrack logo on transparent background
- `assets/images/android-icon-background.png` — solid `#f7fbf3` background

> Use a TripTrack-branded icon (green primary with a receipt/map motif).

### Step G2: Splash Screen

- `assets/images/splash-icon.png` — 200×200px monochrome logo
- Background color already set to `#f7fbf3` in `app.config.ts`

### Step G3: Notification Icon

- `assets/images/notification-icon.png` — 96×96px white monochrome PNG on transparent background (required by Android)

> This file is already referenced in `app.config.ts` but does not exist yet (documented in `SETUP.md` §11).

### Step G4: Store Listing Materials

Prepare for `eas submit`:

**iOS App Store Connect:**
- Screenshots: 6.7" (iPhone 15 Pro Max), 6.1" (iPhone 15), 12.9" (iPad Pro)
  - Screenshot 1: Dashboard with receipt summary
  - Screenshot 2: Receipt scanning camera
  - Screenshot 3: Expense splitting screen
  - Screenshot 4: Trip detail with carpool cards
  - Screenshot 5: Settlement & balances
- App category: **Finance** or **Travel**
- Age rating: 4+
- Privacy URL: `https://your-project-id.web.app/privacy`
- Support URL: your email or support page

**Google Play Console:**
- Feature graphic: 1024×500px
- Screenshots (same as iOS, adjusted for Android frames)
- Short description (80 chars): "Scan receipts, split expenses & plan group trips"
- Full description (4000 chars): Feature overview
- Privacy policy URL: same as iOS

---

## Part H: CI/CD with EAS and GitHub Actions

> **Gap:** No automated build, test, or deployment pipeline exists.

### Step H1: Create GitHub Actions Workflow

File: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx jest --no-coverage --ci

  lint-cloud-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
          cache-dependency-path: functions/package-lock.json
      - run: cd functions && npm ci
      - run: cd functions && npx tsc --noEmit
      - run: cd functions && npx jest --ci
```

### Step H2: EAS Build on Push to Main

File: `.github/workflows/eas-build.yml`

```yaml
name: EAS Build

on:
  push:
    branches: [main]
    paths-ignore:
      - "**.md"
      - "plans/**"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --profile preview --non-interactive
```

### Step H3: Production Release Workflow

File: `.github/workflows/release.yml`

```yaml
name: Release

on:
  release:
    types: [published]

jobs:
  build-and-submit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - name: Build and submit iOS
        run: eas build --platform ios --profile production --non-interactive --submit
      - name: Build and submit Android
        run: eas build --platform android --profile production --non-interactive --submit
```

### Step H4: Store GitHub Secrets

In the GitHub repository settings → **Secrets and variables → Actions**, add:
- `EXPO_TOKEN` — from `eas whoami --token` or [expo.dev](https://expo.dev) account settings

---

## Part I: Final Deployment Orchestration

A step-by-step execution order for the production launch.

### Pre-Launch Checklist

1. **All tests pass:** `npx jest --no-coverage` and `npx tsc --noEmit`
2. **Cloud Functions tested:**
   ```bash
   cd functions && npm test
   firebase emulators:start --only functions,firestore
   ```
3. **Production Firebase project configured** (Part F)
4. **App icons and splash screen finalized** (Part G)
5. **Privacy Policy and Terms of Service hosted** (Part E)
6. **Account deletion flow tested end-to-end** (Part E)

### Deployment Order

```
1. Deploy Firebase Hosting (privacy pages + universal link config)
   → firebase deploy --only hosting

2. Deploy Firestore rules and indexes
   → firebase deploy --only firestore:rules,firestore:indexes

3. Deploy Storage rules
   → firebase deploy --only storage:rules

4. Deploy Cloud Functions
   → firebase deploy --only functions

5. Seed email templates in Firestore (Part A Step A2)

6. Build and submit iOS
   → eas build -p ios --profile production --submit

7. Build and submit Android
   → eas build -p android --profile production --submit

8. Enable App Check enforcement (Part D Step D4)
   → Only after the new build is live on both stores!

9. Monitor Crashlytics for first 48 hours
```

### Post-Launch Monitoring

- **Crashlytics:** Firebase Console → Crashlytics → watch for crash spikes
- **Analytics:** Firebase Console → Analytics → user engagement, screen views
- **Cloud Functions:** Firebase Console → Functions → invocation count, error rate, latency
- **Firestore:** Firebase Console → Firestore → usage, read/write counts, rule denials

---

## Deliverables Checklist

### Part A: Transactional Email
- [ ] Firebase "Trigger Email from Firestore" extension installed and configured with SMTP provider
- [ ] Email templates seeded in `emailTemplates` Firestore collection
- [ ] `functions/src/sendInvitationEmail.ts` — auto-sends on `tripInvitations` document creation
- [ ] Settlement reminder also sends email as FCM fallback

### Part B: Universal Deep Links
- [ ] Firebase Hosting enabled and configured in `firebase.json`
- [ ] `public/.well-known/apple-app-site-association` created
- [ ] `public/.well-known/assetlinks.json` created
- [ ] `app.config.ts` updated with `associatedDomains` (iOS) and `intentFilters` (Android)
- [ ] `functions/src/handleInviteWeb.ts` — web fallback for invite links
- [ ] `buildInviteLink()` generates HTTPS URLs
- [ ] Hosting + functions deployed

### Part C: Crash Reporting & Analytics
- [ ] `@react-native-firebase/crashlytics` installed and configured
- [ ] `src/components/ErrorBoundary.tsx` wraps root layout
- [ ] `@react-native-firebase/analytics` installed (optional)
- [ ] Crashlytics enabled in Firebase Console

### Part D: Security Hardening
- [ ] `@react-native-firebase/app-check` installed with DeviceCheck/Play Integrity
- [ ] App Check enforcement enabled for Firestore, Storage, Cloud Functions
- [ ] Rate limiting on callable Cloud Functions (`sendSettlementReminder`, `deleteUserAccount`)

### Part E: Legal & Account Deletion
- [ ] `public/privacy.html` — Privacy Policy hosted on Firebase Hosting
- [ ] `public/terms.html` — Terms of Service hosted on Firebase Hosting
- [ ] Privacy/Terms links added to `app/settings.tsx`
- [ ] `functions/src/deleteUserAccount.ts` — full data cleanup + auth deletion
- [ ] "Delete Account" UI in Settings with destructive confirmation

### Part F: Environment Separation
- [ ] Separate Firebase projects for dev / production
- [ ] `config/dev/` and `config/prod/` directories with per-env config files
- [ ] `eas.json` updated with `APP_ENV` per profile
- [ ] `app.config.ts` dynamically selects config based on `APP_ENV`
- [ ] iOS `aps-environment` set to `production` for production builds

### Part G: App Store Assets
- [ ] Production app icon (1024×1024)
- [ ] Android adaptive icon (foreground + background)
- [ ] Splash screen icon
- [ ] Notification icon (96×96 white monochrome PNG)
- [ ] Store screenshots for iOS (3 sizes) and Android
- [ ] Store listing metadata prepared

### Part H: CI/CD
- [ ] `.github/workflows/ci.yml` — typecheck + tests on PR / push
- [ ] `.github/workflows/eas-build.yml` — preview builds on push to main
- [ ] `.github/workflows/release.yml` — production build + submit on GitHub release
- [ ] `EXPO_TOKEN` secret configured in GitHub

### Part I: Final Deployment
- [ ] Pre-launch checklist completed
- [ ] Deployment executed in specified order
- [ ] App Check enforcement enabled (post-launch)
- [ ] Crashlytics monitoring active for 48h+
