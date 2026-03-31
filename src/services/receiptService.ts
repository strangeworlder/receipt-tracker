import type { ReceiptCategory } from "../types";
import type { OCRResult } from "./ocrService";

export async function saveImageLocally(_uri: string, _id: string): Promise<string> { return ""; }
export async function createReceiptRecord(_ocr: OCRResult, _uri: string, _cat: ReceiptCategory, _isWarranty: boolean, _tripId?: string): Promise<string> { return ""; }
export async function updateReceipt(_id: string, _updates: Record<string, unknown>): Promise<void> {}
export async function deleteReceipt(_id: string): Promise<void> {}
export async function uploadToFirebaseStorage(_id: string, _uri: string): Promise<string> { return ""; }
export async function shareReceiptWithTrip(_receiptId: string, _tripId: string, _uri: string): Promise<void> {}
export function listenToReceipts(_cb: (receipts: unknown[]) => void): () => void { return () => {}; }
