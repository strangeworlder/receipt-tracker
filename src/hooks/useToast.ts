import { create } from "zustand";

type ToastVariant = "success" | "error" | "info";

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  showToast: (message: string, variant?: ToastVariant) => void;
  hideToast: () => void;
}

export const useToast = create<ToastState>((set) => ({
  visible: false,
  message: "",
  variant: "info",

  showToast: (message, variant = "info") =>
    set({ visible: true, message, variant }),

  hideToast: () => set({ visible: false }),
}));
