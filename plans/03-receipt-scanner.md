# Plan 3: Receipt Scanner & Preview

> **Prerequisite:** Plan 1 (Project Foundation & Design System)

This plan implements the receipt scanning camera interface and the OCR data preview/confirmation screen. See **Step 0** below for the Scans tab list view that wraps the scanner.

> **NativeWind v5 import rule:** All `View`, `Text`, `ScrollView`, `Pressable`, `TextInput` imports **must** come from `@/tw` (the CSS-wrapped components from Plan 01 Step 6.5), **not** from `react-native`. `Image` imports come from `@/tw/image`. Raw React Native components silently ignore `className` in NativeWind v5.
>
> **No `expo-linear-gradient`:** Use CSS gradients via `experimental_backgroundImage` on `View` instead: `style={{ experimental_backgroundImage: 'linear-gradient(to bottom, ...)' }}`.
>
> **Rounded containers:** Add `borderCurve: 'continuous'` to `style` on any rounded View for the native iOS continuous corner curve.
>
> **Safe area:** Use `contentInsetAdjustmentBehavior="automatic"` on `ScrollView`/`FlatList` instead of wrapping in `SafeAreaView`.

---

## Screen Overview

The Receipt Scanner screen has two states:
1. **Camera mode** — Live camera viewfinder with scanning overlay and framing guide
2. **Preview mode** — Extracted receipt data displayed for user verification before saving

---

## Step 0: Scans Tab — Receipt List View

File: `app/(tabs)/scans.tsx`

The Scans tab default view is a **scrollable receipt list** — the scanner is launched via a FAB or header button, not shown immediately. This follows the same pattern as iOS Photos (list → open camera to add).

### Step 0.1: Screen Layout

- `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`
- `TopAppBar` (shared) at top
- Page title: "Receipts" — `font-headline text-2xl font-bold text-on-surface`
- Search bar via `headerSearchBarOptions` on the Stack screen (enables native iOS search integration)

### Step 0.2: Filter Pills

Horizontal `ScrollView` of filter pills below the header:
- "All" | "Food" | "Travel" | "Warranty" | "Utility" | "Shopping" | "Other"
- Active pill: `bg-primary text-on-primary rounded-full px-4 py-1.5`
- Inactive pill: `bg-surface-container text-on-surface-variant rounded-full px-4 py-1.5`

### Step 0.3: Receipt List

Each receipt renders as a `ListItem` component:
- **Left icon:** 48×48 `rounded-xl` with category color + `MaterialIcon`
- **Title:** `receipt.merchant` — `font-headline font-semibold text-on-surface`
- **Subtitle:** `receipt.date` — `text-sm text-on-surface-variant`
- **Right:** `$${receipt.amount.toFixed(2)}` — `font-bold text-on-surface` + optional `_pendingWrite` sync icon
- Tapping navigates to `router.push(`/receipts/${receipt.id}`)`

### Step 0.4: Empty State

When no receipts match the active filter:
- `MaterialIcon` "receipt_long" at 64px in `text-on-surface-variant`
- "No receipts yet" heading + "Tap the scan button to add your first receipt" subtext

### Step 0.5: FAB — "Scan Receipt"

- `absolute bottom-6 right-6`, `bg-primary rounded-full w-14 h-14`
- `document_scanner` icon in `text-on-primary`
- Navigates to scanner: `router.push('/scanner')` or opens as a modal

### Step 0.6: Scanner route

Move the scanner (`expo-camera` view) to `app/scanner.tsx` (a modal route). In the root `_layout.tsx`:
```typescript
<Stack.Screen name="scanner" options={{ presentation: "fullScreenModal", headerShown: false }} />
```

This means `app/(tabs)/scans.tsx` is the list, and `app/scanner.tsx` is the full-screen camera modal.

### Step 0.7: Data source

```typescript
const receipts = useReceiptStore(state => state.receipts);
const [activeFilter, setActiveFilter] = useState<ReceiptCategory | "all">("all");

const filteredReceipts = activeFilter === "all"
  ? receipts
  : receipts.filter(r => r.category === activeFilter);
```

---

## Step 1: Install Camera Dependencies

```bash
npx expo install expo-camera expo-image-picker expo-file-system
```

- `expo-camera` for the live camera view
- `expo-image-picker` as a fallback to pick from gallery
- `expo-file-system` for saving receipt images locally

## Step 2: Camera Permission Flow

File: `app/scanner.tsx` (full-screen modal — see Step 0.6)

1. On first open, request camera permission using `Camera.requestCameraPermissionsAsync()`
2. If denied, show a friendly message with a button to open settings
3. Store permission state so the prompt only shows once

## Step 3: Camera View Section

Build the camera interface matching the mockup:

### Layout:
1. Full-width container with `aspect-ratio: 3/4`, `rounded-3xl overflow-hidden`
2. Inside: `expo-camera` CameraView component filling the container
3. Shadow: `shadow-2xl` on the container

### Scanning Overlay (layered on top of camera):
1. **Frame guide:** Centered rectangle (`w-[85%] h-[75%]`) with:
   - `border-2 border-primary/60 rounded-xl`
   - Green glow effect using RN shadow props: `shadowColor: "#02ba41", shadowRadius: 20, shadowOpacity: 0.4, elevation: 8`
   - "Capture Receipt" label centered inside — `text-primary font-headline font-bold text-lg` with drop shadow
2. **Scan line:** Animated horizontal line at 1/3 height
   - `w-full h-1` using CSS gradient on View: `style={{ experimental_backgroundImage: 'linear-gradient(to right, transparent, #02ba41, transparent)' }}`
   - Animate with `react-native-reanimated` — slow pulse or vertical sweep

### Top Overlay Bar:
1. Absolute positioned at top, gradient overlay using CSS on View: `style={{ experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}`
2. Left: Close button — `w-10 h-10 rounded-full` with `BlurView` background from `expo-blur` and `close` icon
3. Right: Flash toggle button — same style with `flash_on` / `flash_off` icon

### Capture Button:
1. Centered at bottom of the camera view
2. Large circular button (68x68) with white border ring
3. Tap triggers `cameraRef.current.takePictureAsync()`

## Step 4: Image Capture Flow

1. When the user taps the capture button:
   - Call `takePictureAsync({ quality: 0.8, base64: false })`
   - Save the image to the app's file system using `expo-file-system`
   - Transition to the Preview mode (Step 5)
2. Add a gallery button that opens `expo-image-picker` as an alternative input

## Step 5: OCR Data Preview Card

After capture, show the preview below the captured image (or replace the camera view). This matches the lower section of the mockup.

### Container:
- `bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30`
- Vertical stack with `gap-5` between sections

### Section A: Detected Merchant
- Label: "Detected Merchant" — `font-label text-sm text-on-surface-variant`
- Value: merchant name — `font-headline text-2xl font-extrabold text-primary`
- Mock value: "Whole Foods"

### Section B: Data Grid (2 columns)
- Left column: "Date" label + value (e.g., "May 24, 2024")
- Right column: "Amount" label + value (e.g., "$84.32" in `text-xl font-bold`)

### Section C: Category Dropdown
- Label: "Category" — `font-label text-xs text-on-surface-variant font-semibold`
- Dropdown/Picker with options: "Groceries & Dining", "Home Utilities", "Business Expenses", "Travel"
- Styled as: `bg-surface-container-highest rounded-xl py-3 px-4` with chevron icon on right
- Use `@react-native-picker/picker` (installed in Plan 1) or a custom bottom sheet picker

### Section D: Warranty Toggle
- Row with left content and right toggle switch
- Left: Icon (48x48, `bg-secondary-container rounded-xl` with `verified_user` icon) + label "Flag as Warranty" + subtitle "Track for future claims"
- Right: Toggle switch (primary color when on)
- Use React Native `Switch` component styled with primary colors

### Section E: Action Buttons
- Two buttons in a row:
  - **Retake** (secondary): `flex-1 bg-surface-container-high text-on-surface font-semibold py-4 rounded-xl`
  - **Confirm & Save** (primary): `flex-[2] bg-primary text-on-primary font-bold py-4 rounded-xl shadow-lg shadow-primary/20`

## Step 6: OCR Processing (Placeholder)

Since real OCR requires a backend or ML model, create a placeholder:

1. Create `src/services/ocrService.ts` with an interface:

```typescript
export interface OCRResult {
  merchant: string;
  date: string;
  amount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  confidence: number;
}

export async function processReceiptImage(imageUri: string): Promise<OCRResult> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return {
    merchant: "Whole Foods",
    date: "2026-03-24",
    amount: 84.32,
    items: [
      { name: "Organic Bananas", quantity: 1, price: 3.49 },
      { name: "Sourdough Bread", quantity: 1, price: 5.99 },
    ],
    confidence: 0.92,
  };
}
```

2. Show a loading spinner/shimmer while "processing"
3. The interface is ready for a real OCR provider later (Google Vision, Tesseract, etc.)

## Step 7: Save Receipt Flow

When the user taps "Confirm & Save":

1. Create a `Receipt` object from the preview data:
   - `id`: generated UUID
   - `merchant`: from OCR/user input
   - `date`: from OCR/user input
   - `amount`: from OCR/user input
   - `category`: from dropdown selection
   - `isWarranty`: from toggle state
   - `imageUri`: path to saved image
2. Add to `useReceiptStore`
3. If warranty toggle is on, also create a `Warranty` entry in `useWarrantyStore`:
   - `productName`: use the merchant name as a placeholder (user can edit in the Warranty Tracker)
   - `manufacturer`: leave blank — pre-fill with `"Unknown"` until the user edits
   - `purchaseDate`: from the receipt date
   - `expirationDate`: default to 1 year from purchase date (standard warranty assumption); show a note that the user should update this in the Warranty Tracker
   - `coverageType`: default to `"Standard 1-year"`
4. Show a success toast/snackbar
5. Navigate back to the Dashboard (which should now show the new receipt in "Recent Scans")

## Step 8: Loading & Error States

1. **Camera loading:** Show a dark background with a spinner while the camera initializes
2. **OCR processing:** Show a shimmer/skeleton over the preview card fields
3. **Save error:** Show an error toast with a retry option
4. **No camera permission:** Show a friendly illustration + "Grant Access" button

---

## Deliverables Checklist

- [ ] `app/(tabs)/scans.tsx` — receipt list with filter pills, `ListItem` rows, empty state, FAB
- [ ] `app/scanner.tsx` — full-screen modal camera (registered in root `_layout.tsx`)
- [ ] Camera view renders with scanning overlay and framing guide
- [ ] Flash toggle works
- [ ] Image capture saves to file system
- [ ] Gallery picker works as alternative input
- [ ] OCR preview card shows merchant, date, amount, category, warranty toggle
- [ ] Category dropdown is functional
- [ ] Warranty toggle creates a warranty entry
- [ ] "Confirm & Save" persists the receipt to the store
- [ ] "Retake" returns to camera mode
- [ ] Loading and error states are handled
- [ ] Permission flow works correctly
