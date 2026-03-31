import type { OCRResult } from "./ocrService";

export async function createWarranty(_data: Record<string, unknown>): Promise<string> { return ""; }
export async function createFromReceipt(_receiptId: string, _ocr: OCRResult): Promise<string> { return ""; }
export async function updateWarranty(_id: string, _updates: Record<string, unknown>): Promise<void> {}
export async function deleteWarranty(_id: string): Promise<void> {}
export function listenToWarranties(_cb: (warranties: unknown[]) => void): () => void { return () => {}; }
