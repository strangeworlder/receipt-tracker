import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";

export interface OCRResult {
  merchant: string;
  date: string;       // ISO date string: "YYYY-MM-DD"
  amount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  confidence: number; // 0.0 - 1.0; < 0.7 means fields need manual review
}

export async function processReceiptImage(imageUri: string): Promise<OCRResult> {
  const result = await recognizeText(imageUri);
  return parseReceiptText(result.text ?? "");
}

export function parseReceiptText(rawText: string): OCRResult {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

  // Merchant: usually the first non-empty line
  const merchant = lines[0] ?? "Unknown Merchant";

  // Date: look for common date formats
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|([A-Z][a-z]+ \d{1,2},? \d{4})/;
  const dateMatch = rawText.match(datePattern);
  const date = dateMatch
    ? normalizeDateString(dateMatch[0])
    : new Date().toISOString().split("T")[0];

  // Total: look for the largest dollar amount near "total"
  const totalPattern = /(?:\btotal|amount due|balance)[^\d]*\$?([\d,]+\.\d{2})/i;
  const totalMatch = rawText.match(totalPattern);
  const allAmounts = [...rawText.matchAll(/\$?([\d,]+\.\d{2})/g)]
    .map(m => parseFloat(m[1].replace(",", "")));
  const amount = totalMatch
    ? parseFloat(totalMatch[1].replace(",", ""))
    : allAmounts.length > 0 ? Math.max(...allAmounts) : 0;

  return {
    merchant,
    date,
    amount,
    items: [],
    confidence: totalMatch ? 0.85 : 0.5,
  };
}

function normalizeDateString(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().split("T")[0];
  }
  // Use local date parts to avoid UTC shift
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
