/**
 * JS-side color constants for Reanimated worklets, SVG props, and imperative APIs.
 * The CSS @theme block in global.css is the canonical source for Tailwind classes.
 */
export const colors = {
  primary: "#02ba41",
  onPrimary: "#ffffff",
  primaryContainer: "#e6f8ec",
  onPrimaryContainer: "#002107",

  secondary: "#526350",
  onSecondary: "#ffffff",
  secondaryContainer: "#d5e8cf",
  onSecondaryContainer: "#111f0f",

  tertiary: "#39656b",
  onTertiary: "#ffffff",
  tertiaryContainer: "#bcebf1",
  onTertiaryContainer: "#001f23",

  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#410002",

  background: "#f7fbf3",
  onBackground: "#191d18",
  surface: "#f7fbf3",
  onSurface: "#191d18",
  surfaceVariant: "#dee5d9",
  onSurfaceVariant: "#424940",
  outline: "#72796f",
  outlineVariant: "#c2c9bd",

  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f1f5ed",
  surfaceContainer: "#ebefe7",
  surfaceContainerHigh: "#e5e9e2",
  surfaceContainerHighest: "#e0e4dc",
} as const;
