const DB_NAME = "paytracker-travel-files";
const STORE_NAME = "files";
const DB_VERSION = 1;

export type TravelOfflineFileRecord = {
  id: string;
  blob: Blob;
  fileName: string;
  contentType: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB request failed"));
  });
}

export async function putTravelOfflineFile(
  record: TravelOfflineFileRecord,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await requestToPromise(tx.objectStore(STORE_NAME).put(record));
  } finally {
    db.close();
  }
}

export async function getTravelOfflineFile(
  id: string,
): Promise<TravelOfflineFileRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const result = await requestToPromise(
      tx.objectStore(STORE_NAME).get(id),
    );
    return (result as TravelOfflineFileRecord | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function deleteTravelOfflineFile(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await requestToPromise(tx.objectStore(STORE_NAME).delete(id));
  } finally {
    db.close();
  }
}

export async function storeFileForOffline(file: File): Promise<string> {
  const id = crypto.randomUUID();
  await putTravelOfflineFile({
    id,
    blob: file,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  });
  return id;
}

export function fileFromOfflineRecord(
  record: TravelOfflineFileRecord,
): File {
  return new File([record.blob], record.fileName, {
    type: record.contentType,
  });
}
