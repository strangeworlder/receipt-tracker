# TripTrack — AI Agent Guide

TripTrack is a cross-platform mobile app (iOS + Android) built with Expo and React Native. It lets groups of people scan receipts, split expenses, track warranties, and plan shared trips with carpool coordination and settlement calculation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo (CNG — Continuous Native Generation, SDK 54) with expo-router v6 |
| Language | TypeScript (strict) |
| Styling | NativeWind v5 + Tailwind CSS v4 + react-native-css with Material Design 3 tokens |
| Navigation | expo-router (file-based, tab + stack) |
| State | Zustand stores (`src/stores/`) |
| Backend | Firebase (Firestore, Storage, Auth, FCM, Functions) via `@react-native-firebase` |
| OCR | Google ML Kit on-device text recognition |
| Auth | Firebase Auth — Google Sign-In, Apple Sign-In, anonymous |
| Drive backup | Google Drive REST API (personal receipt backup) |
| Animations | react-native-reanimated + react-native-gesture-handler + react-native-worklets |
| Font | Lexend (via `@expo-google-fonts/lexend`) |
| Icons | `@expo/vector-icons` (MaterialCommunityIcons + MaterialIcons) — cross-platform |
| Images | `expo-image` for all image rendering (preferred over RN's intrinsic Image) |
| Local storage | `expo-sqlite` (queue/cache), `expo-secure-store` (tokens), `expo-file-system` (images) |
| Push notifications | Firebase Cloud Messaging (FCM) + expo-notifications |
| Testing | Jest + jest-expo + @testing-library/react-native |

> **Critical:** `@react-native-firebase` requires native modules — Expo Go will not work. This project uses **Continuous Native Generation (CNG)**: run `npx expo prebuild` to generate `ios/` and `android/` directories, then `npx expo run:ios` / `npx expo run:android` or a custom dev build via EAS.

> **Deprecated packages (do not use):**
> - `expo-linear-gradient` → use `experimental_backgroundImage` CSS gradients on `View`
> - `@react-native-async-storage/async-storage` → use `expo-sqlite` localStorage
> - `babel.config.js` → not needed; Expo SDK 54 + Metro handles NativeWind v5 without one

---

## Project Structure

```
triptrack/
  app/
    _layout.tsx              # Root layout — auth guard, font loading, providers
    settings.tsx             # Profile, Drive sync, sign-out (modal route)
    scanner.tsx              # Full-screen camera modal (launched from scans tab FAB)
    (auth)/
      _layout.tsx
      onboarding.tsx         # Google + Apple + offline sign-in
    (tabs)/
      _layout.tsx            # 5-tab navigator
      index.tsx              # Dashboard / Home
      scans.tsx              # Receipt list (scanner entry via FAB)
      split.tsx              # Expense splitting
      warranty.tsx           # Warranty tracker
      trips/
        index.tsx            # Trip list (all user trips — NOT a trip detail screen)
        [tripId].tsx         # Trip detail
        settlement.tsx       # Settlement & balances
        planner.tsx          # Who brings what
        carpool/
          [carpoolId].tsx    # Carpool detail
    receipts/
      [receiptId].tsx        # Receipt detail screen
    trips/
      new.tsx                # Trip creation form
  src/
    components/              # Shared UI components
    hooks/                   # Custom hooks (useDashboardData, etc.)
    services/                # Firebase + external API layer
      firebase.ts            # App init, db/auth/storage exports
      authService.ts         # Sign-in, sign-out, token management
      userService.ts         # Firestore user profile CRUD
      receiptService.ts      # Receipt CRUD, local save, Storage upload
      warrantyService.ts     # Warranty CRUD, notification scheduling
      tripService.ts         # Trip/expense/settlement/invitation CRUD (expenses live here, not expenseService)
      settlementService.ts   # Settlement optimization algorithm
      driveService.ts        # Google Drive backup queue
      ocrService.ts          # ML Kit on-device OCR
      syncService.ts         # Firestore real-time listener lifecycle (Plan 09 delegation pattern)
    stores/                  # Zustand state
      authStore.ts
      receiptStore.ts
      warrantyStore.ts
      tripStore.ts
      splitStore.ts
    theme/                   # Design tokens (JS reference — CSS @theme is source of truth)
      colors.ts              # Material Design 3 color palette (for Reanimated/SVG use)
      typography.ts          # Lexend font presets
      spacing.ts             # 4px grid + border radii
    tw/                      # CSS-wrapped component exports (NativeWind v5)
      index.tsx              # View, Text, ScrollView, Pressable, TextInput, Link, AnimatedView...
      image.tsx              # CSS-wrapped expo-image Image
      animated.tsx           # CSS-wrapped Reanimated components
    types/
      index.ts               # UI view model types (lightweight, for components/stores)
      firestore.ts           # Firestore document schemas (canonical data shapes)
    utils/
      uuid.ts                # UUID generation
  __mocks__/
    @react-native-firebase/  # Firebase service mocks for Jest
  functions/                 # Firebase Cloud Functions (TypeScript)
  plans/                     # Detailed implementation plans (01–11)
  claude_skills/             # Agent skills (copy to ~/.claude/skills/)
  firestore.rules            # Firestore security rules
  firestore.indexes.json     # Composite indexes
  storage.rules              # Firebase Storage security rules
  metro.config.js
  postcss.config.mjs         # Tailwind CSS v4 PostCSS config
  global.css                 # Tailwind @theme tokens + @import directives
```

---

## Design System

The app uses a **Material Design 3** color palette with a green primary. All color tokens are defined as CSS `@theme` variables in `global.css` (the Tailwind CSS v4 approach). `src/theme/colors.ts` contains the same values as **JavaScript constants** for use in Reanimated worklets, SVG fills, and other imperative APIs — it is NOT the source of truth for Tailwind classes.

### Key colors (Tailwind class → hex)
| Token | Class | Value |
|---|---|---|
| Primary | `bg-primary` | `#02ba41` |
| Primary container | `bg-primary-container` | `#e6f8ec` |
| Surface | `bg-surface` | `#f7fbf3` |
| Surface container low | `bg-surface-container-low` | `#f1f5ed` |
| Error | `bg-error` | `#ba1a1a` |
| Error container | `bg-error-container` | `#ffdad6` |

### Typography
- Font family: **Lexend** for all text (defined as `--font-lexend` in `global.css` `@theme`)
- Weights: 300 (light) through 800 (extra-bold)
- Presets: `displayLarge`, `headlineMedium`, `bodyMedium`, `labelSmall`, etc.

### Spacing
- 4px base grid
- Border radii: `default: 16`, `lg: 20`, `xl: 24`, `2xl: 32`, `3xl: 40`, `full: 9999`

### Important styling rules
- **Import `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` from `@/tw`** — not from `react-native`. Raw RN components silently ignore `className` in NativeWind v5
- **Import `Image` from `@/tw/image`** — uses `expo-image` under the hood
- **Do not use CSS `backdrop-blur`** — use `BlurView` from `expo-blur` instead
- **Do not use `Platform.OS`** — use `process.env.EXPO_OS`
- Use `useWindowDimensions` (not `Dimensions.get()`) for screen size
- Use `boxShadow` CSS prop (never legacy RN shadow/elevation props)
- Add `borderCurve: 'continuous'` to all rounded containers for native iOS feel
- Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList` instead of `SafeAreaView` for safe-area insets
- **No `expo-linear-gradient`** — use `experimental_backgroundImage` CSS gradient on `View`: `style={{ experimental_backgroundImage: 'linear-gradient(...)' }}`
- Shadows with primary color: `shadow-primary/20` convention
- Inline styles for one-off; `StyleSheet.create` only if reusing heavily

---

## Shared Components (`src/components/`)

| Component | Purpose |
|---|---|
| `TopAppBar` | Sticky header with avatar, "TripTrack" title, settings icon; uses `BlurView` |
| `Card` | Configurable surface container; variants: `low`, `lowest`, `primary` |
| `StatusPill` | Rounded badge; variants: `primary`, `secondary`, `error`, `neutral` |
| `AvatarStack` | Overlapping avatars with `+N` count; used in trip planner |
| `PrimaryButton` / `SecondaryButton` | Main CTAs with press animation (`active:scale-95`) |
| `ProgressRing` | SVG circular progress; used in trip planner banner |
| `ListItem` | Generic row: 48×48 icon container, title + subtitle, right slot |
| `MaterialIcon` | Maps mockup icon names (e.g. `document_scanner`) to `MaterialCommunityIcons` |

---

## Architecture Patterns

### Service layer
- UI reads exclusively from **Zustand stores** — never calls Firebase directly
- **Services** handle all I/O (Firestore, Storage, Drive, Auth)
- **syncService** manages Firestore real-time listener lifecycle

```
UI Component → Zustand store (read)
UI Component → Service (write/action)
Firestore listener → syncService → Zustand store (update)
```

### Offline-first
- Firestore offline persistence is enabled by default
- All writes are queued locally and synced when connectivity returns
- Receipt image uploads queue in `AsyncStorage` via `driveService.processQueue()`
- Show `_pendingWrite` indicator (spinning `sync` icon) on unsynced list items

### Auth state
- `app/_layout.tsx` listens to `auth().onAuthStateChanged`
- Unauthenticated → redirect to `/(auth)/onboarding`
- Anonymous sessions allowed (offline mode); upgradeable to real account later
- Google OAuth access token stored in `expo-secure-store` (never AsyncStorage)

### Hybrid participants
- **AppUser**: has Firebase `uid`, sees the app in real-time
- **GhostParticipant**: name-only, managed by an AppUser on their behalf
- Ghost → AppUser upgrade: match by email on trip invite acceptance

---

## Common Commands

```bash
# (Re-)generate native iOS/Android dirs after adding/removing native packages
npx expo prebuild

# iOS build (local, requires Xcode)
npx expo run:ios

# Android build (local)
npx expo run:android

# EAS development build → TestFlight (requires EAS CLI >= 16.0.1)
eas build -p ios --profile development --submit

# EAS production build
eas build --profile production

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy Cloud Functions
firebase deploy --only functions

# Type-check
npx tsc --noEmit

# Run tests
npx jest

# Run tests in watch mode
npx jest --watch

# Install a new Expo-compatible package
npx expo install <package-name>
```

---

## Environment Setup

Never commit these files:
```
.env
android/app/google-services.json
ios/GoogleService-Info.plist
```

Required environment variables (`.env`):
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...   # from Google Cloud Console (EXPO_PUBLIC_ prefix required)
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

> Only variables prefixed with `EXPO_PUBLIC_` are bundled into the client app. Server-side or build-time-only vars do not need the prefix.

---

## Implementation Plans

The `plans/` directory contains 10 detailed plans. Plans 01–02 are complete. Implement the rest in dependency order:

| Plan | Title | Status | Depends on |
|---|---|---|---|
| 01 | Project Foundation & Design System | **Done** | — |
| 02 | Dashboard / Home Screen | **Done** | 01 |
| 03 | Architecture & Firebase Setup | Pending | 01, 02 |
| 04 | Auth & User Management | Pending | 03 |
| 05 | Data Layer — Firestore & Zustand | Pending | 03, 04 |
| 06 | Receipt Scanner & Storage Pipeline | Pending | 05 |
| 07 | Expense Splitting | Pending | 05 |
| 08 | Warranty Tracker | Pending | 05 |
| 09 | Trip Management | Pending | 05, 07 |
| 10 | Trip Creation, Receipt Detail & Deep Linking | Pending | 04, 05 |

Each plan is self-contained — no need to cross-reference other plans to understand what to implement. Plans 06–10 can be implemented in any order after Plan 05 is complete (subject to the dependency constraints above).

---

## Key Conventions

- **File naming:** kebab-case for all files (`comment-card.tsx`, not `CommentCard.tsx`)
- **Route files** live only in `app/` — never co-locate components there
- **No direct Firebase calls in components** — always go through a service
- **No `md:` responsive prefixes** — use `useWindowDimensions` for tablet layouts (breakpoint: 768px)
- **No `expo-av`** — use `expo-audio` and `expo-video` separately
- **No `SafeAreaView` from react-native** — use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList`
- **Always import from `@/tw`** — `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` must come from `@/tw` (CSS-wrapped). `Image` comes from `@/tw/image`. Importing from `react-native` directly will silently break `className` in NativeWind v5
- **Icon names** use mockup names (e.g. `document_scanner`); `MaterialIcon` component maps them to available icons
- **`arrayUnion` / `arrayRemove`** for Firestore array fields — never overwrite full arrays
- **UUIDs** generated client-side via `src/utils/uuid.ts`
- **Currency** always formatted to 2 decimal places
- **Types:** UI view models in `src/types/index.ts`; Firestore document shapes in `src/types/firestore.ts` (canonical). Services use Firestore types; components/stores use UI types
- **Expense functions** live in `tripService.ts` — there is no separate `expenseService.ts`
- **TDD:** follow the test-driven-development skill — write a failing test before any production code

---

## Agent Skills

The `claude_skills/` directory contains downloaded SKILL.md files relevant to this project. Copy them to your Claude skills directory to activate them:

| Skill | Source | When to use |
|---|---|---|
| `expo/building-native-ui` | expo/skills | Building any screen or component |
| `expo/expo-tailwind-setup` | expo/skills | Configuring NativeWind/Tailwind |
| `expo/native-data-fetching` | expo/skills | Network requests, caching, offline |
| `expo/upgrading-expo` | expo/skills | Upgrading Expo SDK version |
| `expo/expo-dev-client` | expo/skills | Creating custom dev builds |
| `expo/expo-deployment` | expo/skills | App Store / Play Store release |
| `superpowers/systematic-debugging` | obra/superpowers | Any bug or unexpected behavior |
| `superpowers/test-driven-development` | obra/superpowers | Implementing any feature |
| `superpowers/verification-before-completion` | obra/superpowers | Before claiming work is done |
| `anthropics/frontend-design` | anthropics/skills | UI design decisions and polish |
