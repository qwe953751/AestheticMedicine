import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { load, save } from "../src/storage";
import { newEntry } from "../src/model";
describe("瀏覽器資料儲存", () => {
  it("可保存並重新開啟，拒絕舊分頁覆蓋較新的資料", async () => {
    const original = await load();
    const entry = { ...newEntry("journal"), title: "測試日誌" };
    const saved = await save([entry], original.revision);
    expect(await load()).toEqual(saved);
    await expect(save([], original.revision)).rejects.toThrow("另一個分頁");
    expect((await load()).entries).toEqual([entry]);
  });
  it("競爭寫入僅一筆成功，不會靜默覆蓋", async () => {
    const original = await load();
    const results = await Promise.allSettled([
      save([], original.revision),
      save([], original.revision),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});
