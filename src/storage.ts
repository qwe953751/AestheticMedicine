import type { Dataset, Entry } from "./model";
const DB = "skin-journal-v1";
export class ConflictError extends Error {
  constructor() {
    super("另一個分頁已更新資料。請關閉編輯視窗並重新整理，再進行修改。");
  }
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("journal");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("無法開啟瀏覽器儲存空間，請確認未封鎖網站資料。"));
  });
}
export async function load(): Promise<Dataset> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("journal", "readonly");
    const r = tx.objectStore("journal").get("data");
    tx.oncomplete = () => {
      db.close();
      resolve(r.result || { revision: 0, entries: [] });
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function save(
  entries: Entry[],
  expectedRevision: number,
): Promise<Dataset> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("journal", "readwrite");
    const store = tx.objectStore("journal");
    const r = store.get("data");
    const next = { revision: expectedRevision + 1, entries };
    let conflict = false;
    r.onsuccess = () => {
      if ((r.result?.revision || 0) !== expectedRevision) {
        conflict = true;
        tx.abort();
      } else store.put(next, "data");
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        conflict
          ? new ConflictError()
          : new Error(
              "儲存失敗，可能空間不足。資料尚未變更，請先匯出備份或減少附件。",
            ),
      );
    };
  });
}
