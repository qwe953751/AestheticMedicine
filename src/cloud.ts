import { createClient } from "@supabase/supabase-js";
import {
  validateEntries,
  type Attachment,
  type Dataset,
  type Entry,
} from "./model";
// Public browser configuration. RLS and private Storage enforce all access.
export const cloud = createClient(
  "https://jazinwkendlnctjnmwuf.supabase.co",
  "sb_publishable_zD184654nCHPSumAfRdOMA_nyxqWhLw",
  {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal || AbortSignal.timeout(20000),
        }),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
const bucket = cloud.storage.from("journal-files");
type RemoteAttachment = Omit<Attachment, "data"> & { path: string };
type RemoteEntry = Omit<Entry, "attachments"> & {
  attachments: RemoteAttachment[];
};
const memory = new Map<string, string>();
export function clearCloudMemory() {
  memory.clear();
}
function bytes(data: string) {
  const binary = atob(data.split(",")[1]);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function contentHash(data: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function ownedPath(path: string, userId: string) {
  return (
    path.startsWith(userId + "/") &&
    new RegExp("^" + userId + "/[a-f0-9]{64}$").test(path)
  );
}
function blobData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("附件讀取失敗"));
    r.readAsDataURL(blob);
  });
}
export async function loadCloud(userId: string): Promise<Dataset> {
  const { data, error } = await cloud
    .from("journal_states")
    .select("revision,entries")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`讀取雲端失敗：${error.message}`);
  if (!data) return { revision: 0, entries: [] };
  const entries: Entry[] = [];
  for (const entry of data.entries as RemoteEntry[]) {
    const attachments: Attachment[] = [];
    for (const a of entry.attachments) {
      if (!ownedPath(a.path, userId))
        throw new Error("附件路徑不屬於目前帳號。");
      let value = memory.get(a.path);
      if (!value) {
        const { data: blob, error } = await bucket.download(a.path);
        if (error || !blob) throw new Error(`無法下載附件 ${a.name}，請重試。`);
        const raw = new Uint8Array(await blob.arrayBuffer());
        if ((await contentHash(raw)) !== a.path.split("/")[1])
          throw new Error("附件完整性檢查失敗。");
        value = await blobData(new Blob([raw], { type: a.type }));
        memory.set(a.path, value);
      }
      attachments.push({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
        data: value,
      });
    }
    entries.push({ ...entry, attachments });
  }
  return { revision: Number(data.revision), entries: validateEntries(entries) };
}
export async function saveCloud(
  entries: Entry[],
  expectedRevision: number,
  userId: string,
): Promise<Dataset> {
  const {
    data: { user },
    error: userError,
  } = await cloud.auth.getUser();
  if (userError || user?.id !== userId)
    throw new Error("登入已失效，請重新登入。");
  const remote: RemoteEntry[] = [];
  for (const entry of entries) {
    const attachments: RemoteAttachment[] = [];
    for (const a of entry.attachments) {
      const raw = bytes(a.data);
      const path = `${userId}/${await contentHash(raw)}`;
      if (!memory.has(path)) {
        const { error } = await bucket.upload(
          path,
          new Blob([raw], { type: a.type }),
          { contentType: a.type, upsert: false },
        );
        if (
          error &&
          !(
            String(error.statusCode) === "409" ||
            error.message.toLowerCase().includes("already exists")
          )
        )
          throw new Error(`附件上傳失敗：${error.message}`);
        memory.set(path, a.data);
      }
      attachments.push({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
        path,
      });
    }
    remote.push({ ...entry, attachments });
  }
  const { data, error } = await cloud.rpc("save_journal", {
    expected_revision: expectedRevision,
    new_entries: remote,
  });
  if (error) {
    if (["40001", "PT409"].includes(error.code))
      throw new Error(
        "另一台裝置已更新紀錄。請先關閉編輯並重新載入雲端資料，再修改。",
      );
    throw new Error(`雲端儲存失敗：${error.message}`);
  }
  return { revision: Number(data), entries };
}
