import { create } from "zustand";
import type { AppUser } from "../types";

interface AuthState {
  user: AppUser | null;
  isAnonymous: boolean;
  driveLinked: boolean;
  setUser: (user: AppUser | null, isAnonymous: boolean) => void;
  setDriveLinked: (linked: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isAnonymous: false,
  driveLinked: false,
  // State semantics:
  //   signed-out  → user=null, isAnonymous=false
  //   anonymous   → user=null, isAnonymous=true
  //   real user   → user=AppUser, isAnonymous=false
  setUser: (user, isAnonymous) => set({ user, isAnonymous }),
  setDriveLinked: linked => set({ driveLinked: linked }),
}));
