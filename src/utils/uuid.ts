/** crypto.randomUUID() is available in React Native 0.73+ (Hermes engine) */
export function generateUUID(): string {
  return crypto.randomUUID();
}
