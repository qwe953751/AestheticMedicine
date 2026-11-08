import { describe, expect, it } from "vitest";
import {
  calendarExport,
  daysBetween,
  monthDays,
  newEntry,
  parseBackup,
  reportSummary,
  safeUrl,
  shiftMonth,
  validDate,
  validateEntries,
  type Entry,
} from "../src/model";
const record = (overrides: Partial<Entry> = {}) => ({
  ...newEntry("treatment"),
  title: "測試紀錄",
  ...overrides,
});
const backup = (entries: Entry[]) =>
  JSON.stringify({ app: "skin-journal", version: 1, entries });
describe("資料完整性與備份", () => {
  it("完整保留療程與關聯報告；重新匯入保留 ID", () => {
    const t = record();
    const r = record({
      kind: "report",
      treatmentId: t.id,
      fields: { sourceUrl: "https://example.com/report", device: "測試儀器" },
      metrics: [{ name: "水分", value: "40", unit: "%", scale: "0–100" }],
    });
    expect(parseBackup(backup([t, r]))).toEqual([t, r]);
  });
  it("空備份可合法還原", () => expect(parseBackup(backup([]))).toEqual([]));
  it("拒絕重複 ID、遺失關聯及未知欄位", () => {
    const t = record();
    expect(() => validateEntries([t, t])).toThrow();
    expect(() => validateEntries([record({ treatmentId: "missing" })])).toThrow(
      "關聯療程",
    );
    expect(() =>
      validateEntries([record({ fields: { unknown: "x" } })]),
    ).toThrow("不支援");
  });
  it("拒絕損毀備份與不支援版本", () => {
    expect(() => parseBackup("{")).toThrow();
    expect(() =>
      parseBackup('{"app":"skin-journal","version":2,"entries":[]}'),
    ).toThrow("版本 1");
    expect(() => validateEntries([record({ date: "2026-02-30" })])).toThrow();
    expect(() => validateEntries([record({ title: "  " })])).toThrow();
  });
  it("拒絕偽裝圖片、檔案大小不符與 SVG", () => {
    const attachment = {
      id: "a",
      name: "x.png",
      type: "image/png",
      size: 5,
      data: "data:image/png;base64,aGVsbG8=",
    };
    expect(() =>
      validateEntries([record({ attachments: [attachment] })]),
    ).toThrow("類型不符");
    expect(() =>
      validateEntries([
        record({ attachments: [{ ...attachment, type: "image/svg+xml" }] }),
      ]),
    ).toThrow("格式錯誤");
  });
  it("可還原有效的 PNG 附件", () => {
    const data =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=";
    const t = record({
      kind: "photo",
      attachments: [
        {
          id: "image",
          name: "pixel.png",
          type: "image/png",
          size: atob(data).length,
          data: "data:image/png;base64," + data,
        },
      ],
    });
    expect(parseBackup(backup([t]))).toEqual([t]);
  });
  it("連結僅接受 HTTP(S)，拒絕執行碼與網址內的帳密", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///x",
      "https://user:pass@example.com",
    ])
      expect(safeUrl(url)).toBeNull();
    expect(() =>
      validateEntries([
        record({
          kind: "report",
          fields: { sourceUrl: "javascript:alert(1)" },
        }),
      ]),
    ).toThrow("連結");
  });
  it("不接受負費用、錯誤日程時間和空白指標", () => {
    expect(() => validateEntries([record({ fields: { cost: "-1" } })])).toThrow(
      "費用",
    );
    expect(() =>
      validateEntries([record({ kind: "event", fields: { time: "25:00" } })]),
    ).toThrow("時間");
    expect(() =>
      validateEntries([
        record({
          kind: "report",
          metrics: [{ name: "", value: "3", unit: "", scale: "" }],
        }),
      ]),
    ).toThrow("指標");
  });
});
describe("日期與行事曆", () => {
  it("正確處理閏年與無效日期", () => {
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2025-02-29")).toBe(false);
    expect(validDate("2026-99-99")).toBe(false);
    expect(validDate("2026-2-1")).toBe(false);
    expect(daysBetween("2026-11-08", "2026-10-30")).toBe(9);
  });
  it("以週一為首日並處理跨年、閏年", () => {
    const cells = monthDays("2026-11");
    expect(cells.length).toBe(42);
    expect(cells[6]).toBe("2026-11-01");
    expect(cells[35]).toBe("2026-11-30");
    expect(monthDays("2024-02").filter(Boolean)).toHaveLength(29);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("ICS 將台北時間轉為 UTC 並保留全天事件", () => {
    const timed = record({
      kind: "event",
      date: "2026-11-09",
      title: "回診,諮詢;內容",
      notes: "第一行\n第二行",
      fields: { time: "09:30" },
    });
    const full = record({ kind: "event", date: "2026-11-10" });
    const out = calendarExport([timed, full, record()]);
    expect(out).toContain("DTSTART:20261109T013000Z");
    expect(out).toContain("DTSTART;VALUE=DATE:20261110");
    expect(out).toContain("SUMMARY:回診\\,諮詢\\;內容");
    expect(out).toContain("第一行\\n第二行");
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    for (const line of out.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it("長中文內容折行後不損毀字元", () => {
    const long = "回診與觀察".repeat(20);
    const out = calendarExport([record({ kind: "event", title: long })]);
    expect(out.replace(/\r\n /g, "")).toContain("SUMMARY:" + long);
    for (const line of out.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
describe("報告摘要", () => {
  it("只整理實際輸入並揭露沒有自動讀取，不補推數值", () => {
    const out = reportSummary(record({ kind: "report" }), []);
    expect(out).toContain("尚未填寫，無法產生指標摘要");
    expect(out).toContain("未讀取附件或外部連結");
    expect(out).toContain("未執行 AI 分析");
  });
  it("保留來源、版本、量尺與關聯療程脈絡", () => {
    const t = record();
    const r = record({
      kind: "report",
      treatmentId: t.id,
      fields: { source: "測試來源", device: "A", version: "v1" },
      metrics: [{ name: "水分", value: "42", unit: "%", scale: "0–100" }],
    });
    const out = reportSummary(r, [t]);
    expect(out).toContain("水分：42 %（量尺：0–100）");
    expect(out).toContain("A／v1");
    expect(out).toContain("關聯療程：");
  });
});
