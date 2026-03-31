export interface OCRResult {
  merchant: string;
  date: string;
  amount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  confidence: number;
}

export async function processReceiptImage(_imageUri: string): Promise<OCRResult> {
  return {
    merchant: "Unknown",
    date: new Date().toISOString().split("T")[0],
    amount: 0,
    items: [],
    confidence: 0,
  };
}
