import { beforeEach, expect, it, vi } from "vitest";
import { newEntry, type Entry } from "../src/model";
import { mergeEntries } from "../src/merge";
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mock.getUser },
    storage: { from: () => ({ upload: mock.upload, download: mock.download }) },
    rpc: mock.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mock.maybeSingle }) }),
    }),
  }),
}));
import {
  clearCloudMemory,
  contentHash,
  loadCloud,
  ownedPath,
  saveCloud,
} from "../src/cloud";
const userId = "11111111-1111-4111-8111-111111111111";
const image =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=";
const entry = (): Entry => ({
  ...newEntry("photo"),
  title: "測試照片",
  attachments: [
    {
      id: "image",
      name: "sample.png",
      type: "image/png",
      size: atob(image).length,
      data: "data:image/png;base64," + image,
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  clearCloudMemory();
  mock.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  mock.upload.mockResolvedValue({ error: null });
  mock.rpc.mockResolvedValue({ data: 1, error: null });
  vi.stubGlobal(
    "FileReader",
    class {
      result = "";
      onload = () => {};
      readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then((b) => {
          this.result =
            "data:" +
            blob.type +
            ";base64," +
            btoa(String.fromCharCode(...new Uint8Array(b)));
          this.onload();
        });
      }
    },
  );
});
it("uploads private content-addressed attachments and hydrates a fresh device without data loss", async () => {
  const original = entry();
  const saved = await saveCloud([original], 0, userId);
  expect(saved.revision).toBe(1);
  const call = mock.rpc.mock.calls[0][1];
  const remote = call.new_entries[0];
  expect(remote.attachments[0].data).toBeUndefined();
  expect(remote.attachments[0].path).toMatch(
    new RegExp("^" + userId + "/[a-f0-9]{64}$"),
  );
  expect(mock.upload.mock.calls[0][2].upsert).toBe(false);
  clearCloudMemory();
  mock.maybeSingle.mockResolvedValue({
    data: { revision: 1, entries: call.new_entries },
    error: null,
  });
  mock.download.mockResolvedValue({
    data: new Blob([Uint8Array.from(atob(image), (c) => c.charCodeAt(0))], {
      type: "image/png",
    }),
    error: null,
  });
  expect((await loadCloud(userId)).entries).toEqual([original]);
});
it("rejects a different account before uploading", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "other" } },
    error: null,
  });
  await expect(saveCloud([entry()], 0, userId)).rejects.toThrow("登入");
  expect(mock.upload).not.toHaveBeenCalled();
});
it("refuses stale writes instead of silently falling back to local storage", async () => {
  mock.rpc.mockResolvedValue({ error: { code: "PT409" } });
  await expect(saveCloud([], 3, userId)).rejects.toThrow("另一台裝置");
});
it("rejects corrupted or foreign attachment paths", () => {
  expect(ownedPath(userId + "/" + "a".repeat(64), userId)).toBe(true);
  expect(ownedPath("other/" + "a".repeat(64), userId)).toBe(false);
  expect(ownedPath(userId + "/../anything", userId)).toBe(false);
});
it("verifies attachment hashes", async () => {
  expect(await contentHash(new TextEncoder().encode("abc"))).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
it("merges local records without dropping cloud data or overwriting conflicts", () => {
  const a = entry(),
    b = entry();
  expect(mergeEntries([a], [a, b])).toEqual([a, b]);
  expect(() => mergeEntries([a], [{ ...a, title: "不同版本" }])).toThrow(
    "內容不同",
  );
});
