export async function configureGoogleSignIn(): Promise<void> {}
export async function signInWithGoogle(): Promise<void> {}
export async function signInWithApple(): Promise<void> {}
export async function signInAnonymously(): Promise<void> {}
export async function signOut(): Promise<void> {}
export async function saveGoogleTokens(_tokens: { accessToken: string }): Promise<void> {}
export async function getGoogleAccessToken(): Promise<string | null> { return null; }
export async function refreshGoogleAccessToken(): Promise<string> { return ""; }
