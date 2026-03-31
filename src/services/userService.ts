import type { AppUser } from "../types";

export async function upsertUserProfile(): Promise<void> {}
export async function getUserProfile(_uid: string): Promise<AppUser | null> { return null; }
export async function updateFcmToken(_token: string): Promise<void> {}
