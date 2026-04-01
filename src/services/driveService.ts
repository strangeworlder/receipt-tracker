// expo-sqlite localStorage polyfill is installed once in app/_layout.tsx:
//   import 'expo-sqlite/localStorage/install';
// The global `localStorage` object is then available everywhere.

import * as FileSystem from "expo-file-system/legacy";
import firestore from "@react-native-firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { getGoogleAccessToken, refreshGoogleAccessToken } from "./authService";

interface DriveUploadQueueEntry {
  receiptId: string;
  localUri: string;
  merchant: string;
  date: string;
  attempts: number;
  lastAttemptAt?: string;
}

const QUEUE_KEY = "drive_upload_queue";

// Concurrency guard — prevents multiple simultaneous processQueue() calls
let isProcessing = false;

export async function queueDriveUpload(
  receiptId: string,
  localUri: string,
  merchant: string,
  date: string
): Promise<void> {
  const existing = getQueue();
  const entry: DriveUploadQueueEntry = { receiptId, localUri, merchant, date, attempts: 0 };
  saveQueue([...existing.filter(e => e.receiptId !== receiptId), entry]);
}

export async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const queue = getQueue();
    if (queue.length === 0) return;

    const remaining: DriveUploadQueueEntry[] = [];

    for (const entry of queue) {
      if (entry.attempts >= 5) continue; // drop after 5 failures

      try {
        const driveFileId = await uploadToDrive(entry);
        await firestore().collection("receipts").doc(entry.receiptId).update({ driveFileId });
      } catch {
        remaining.push({
          ...entry,
          attempts: entry.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });
      }
    }

    saveQueue(remaining);
  } finally {
    isProcessing = false;
  }
}

export function startQueueProcessor(): () => void {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      processQueue();
    }
  });
}

function getQueue(): DriveUploadQueueEntry[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveQueue(queue: DriveUploadQueueEntry[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function uploadToDrive(
  entry: DriveUploadQueueEntry,
  isRetry = false // prevents infinite recursion on persistent 401s
): Promise<string> {
  let accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error("No Google access token");

  const folderId = await ensureTripTrackFolder(accessToken);
  const fileName = `${entry.date}_${entry.merchant.replace(/[^a-zA-Z0-9]/g, "_")}_${entry.receiptId}.jpg`;

  const base64 = await FileSystem.readAsStringAsync(entry.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = "triptrack_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    JSON.stringify({ name: fileName, parents: [folderId] }) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: image/jpeg\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    base64 + `\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (response.status === 401 && !isRetry) {
    await refreshGoogleAccessToken();
    return uploadToDrive(entry, true);
  }

  if (!response.ok) throw new Error(`Drive upload failed: ${response.status}`);

  const json = await response.json();
  return json.id;
}

async function ensureTripTrackFolder(accessToken: string): Promise<string> {
  const cached = localStorage.getItem("drive_folder_id");
  if (cached) return cached;

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='TripTrack' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchJson = await searchResponse.json();

  if (searchJson.files?.length > 0) {
    const id = searchJson.files[0].id;
    localStorage.setItem("drive_folder_id", id);
    return id;
  }

  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "TripTrack", mimeType: "application/vnd.google-apps.folder" }),
  });
  const createJson = await createResponse.json();
  localStorage.setItem("drive_folder_id", createJson.id);
  return createJson.id;
}
