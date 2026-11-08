export type Kind =
  | "treatment"
  | "photo"
  | "journal"
  | "report"
  | "routine"
  | "event";
export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
};
export type Metric = {
  name: string;
  value: string;
  unit: string;
  scale: string;
};
export type Entry = {
  id: string;
  kind: Kind;
  title: string;
  date: string;
  notes: string;
  treatmentId: string;
  fields: Record<string, string>;
  attachments: Attachment[];
  metrics: Metric[];
  createdAt: string;
  updatedAt: string;
};
export type Dataset = { revision: number; entries: Entry[] };
export const kinds: Kind[] = [
  "treatment",
  "photo",
  "journal",
  "report",
  "routine",
  "event",
];
export const labels: Record<Kind, string> = {
  treatment: "療程",
  photo: "照片",
  journal: "膚況日誌",
  report: "檢測報告",
  routine: "保養步驟",
  event: "日程",
};
export const MAX_FILE = 8 * 1024 * 1024;
export const MAX_BACKUP = 100 * 1024 * 1024;
export const fieldNames: Record<Kind, string[]> = {
  treatment: ["area", "clinic", "doctor", "cost", "instructions"],
  photo: ["stage", "angle"],
  journal: ["feeling", "products"],
  report: ["source", "sourceUrl", "device", "version"],
  routine: ["period", "product", "instructions"],
  event: ["type", "time", "location", "completed"],
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= "1900-01-01" &&
  value <= "2200-12-31" &&
  Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
export const displayDate = (date: string, year = false) =>
  new Date(date + "T12:00:00+08:00").toLocaleDateString("zh-TW", {
    ...(year ? { year: "numeric" as const } : {}),
    month: "long",
    day: "numeric",
  });
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000,
  );
export function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function newEntry(kind: Kind): Entry {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    date: today(),
    notes: "",
    treatmentId: "",
    fields: {},
    attachments: [],
    metrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function sorted(entries: Entry[]) {
  return [...entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}
export function monthDays(month: string) {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + count
      ? `${month}-${String(i - offset + 1).padStart(2, "0")}`
      : "",
  );
}
export function shiftMonth(month: string, amount: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + amount, 1));
  return d.toISOString().slice(0, 7);
}
export function reportSummary(entry: Entry, entries: Entry[]) {
  const related = entries.find((e) => e.id === entry.treatmentId);
  return [
    `檢測摘要｜${entry.title}`,
    `檢測日期：${entry.date}`,
    `來源：${entry.fields.source || "未填寫"}`,
    `儀器／版本：${entry.fields.device || "未填寫"}／${entry.fields.version || "未填寫"}`,
    related ? `關聯療程：${related.date} ${related.title}` : "關聯療程：無",
    "",
    "手動核對的指標",
    ...(entry.metrics.length
      ? entry.metrics.map(
          (m) =>
            `• ${m.name}：${m.value}${m.unit ? " " + m.unit : ""}${m.scale ? `（量尺：${m.scale}）` : ""}`,
        )
      : ["尚未填寫，無法產生指標摘要。"]),
    "",
    `你的備註：${entry.notes || "無"}`,
    "",
    "系統整理：以上僅依手動輸入資料排版，未讀取附件或外部連結，未執行 AI 分析。不同儀器、版本或量尺的數值不直接比較；變化不代表療程因果。",
    "下次諮詢：確認目前改善目標、曾有反應、醫囑及追蹤時間。療程適合性與間隔請由醫師確認。",
  ].join("\n");
}
const escapeICS = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r/g, "");
function foldLine(line: string) {
  let out = "",
    bytes = 0;
  for (const char of line) {
    const len = new TextEncoder().encode(char).length;
    if (bytes + len > 73) {
      out += "\r\n ";
      bytes = 1;
    }
    out += char;
    bytes += len;
  }
  return out;
}
export function calendarExport(entries: Entry[]) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skin Journal//ZH-TW",
    "CALSCALE:GREGORIAN",
    ...entries
      .filter((e) => e.kind === "event")
      .flatMap((e) => {
        const time = e.fields.time;
        const start = time
          ? "DTSTART:" +
            new Date(`${e.date}T${time}:00+08:00`)
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(/\.\d{3}/, "")
          : "DTSTART;VALUE=DATE:" + e.date.replace(/-/g, "");
        return [
          "BEGIN:VEVENT",
          `UID:${e.id}@skin-journal`,
          `DTSTAMP:${timestamp}`,
          start,
          "SUMMARY:" + escapeICS(e.title),
          "DESCRIPTION:" + escapeICS(e.notes),
          "LOCATION:" + escapeICS(e.fields.location || ""),
          ...(e.fields.completed === "true" ? ["STATUS:CONFIRMED"] : []),
          "END:VEVENT",
        ];
      }),
    "END:VCALENDAR",
    "",
  ]
    .map(foldLine)
    .join("\r\n");
}
function isString(v: unknown, max = 20000): v is string {
  return typeof v === "string" && v.length <= max;
}
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
export function validateEntries(input: unknown): Entry[] {
  if (!Array.isArray(input) || input.length > 5000)
    throw new Error("資料格式錯誤，最多可匯入 5,000 筆。");
  const ids = new Set<string>();
  let total = 0;
  const result = input.map((e): Entry => {
    if (
      !e ||
      typeof e !== "object" ||
      !kinds.includes(e.kind) ||
      !isString(e.id, 100) ||
      !/^[\w-]+$/.test(e.id) ||
      ids.has(e.id) ||
      !isString(e.title, 150) ||
      !e.title.trim() ||
      !isString(e.date, 10) ||
      !validDate(e.date) ||
      !isString(e.notes) ||
      !isString(e.treatmentId, 100) ||
      !isString(e.createdAt, 40) ||
      !Number.isFinite(Date.parse(e.createdAt)) ||
      !isString(e.updatedAt, 40) ||
      !Number.isFinite(Date.parse(e.updatedAt))
    )
      throw new Error("紀錄欄位或日期不完整，請使用本網站匯出的備份。");
    ids.add(e.id);
    if (
      !e.fields ||
      typeof e.fields !== "object" ||
      Array.isArray(e.fields) ||
      Object.keys(e.fields).some(
        (k) =>
          !fieldNames[e.kind as Kind].includes(k) || !isString(e.fields[k]),
      )
    )
      throw new Error("紀錄包含不支援的欄位。");
    if (e.fields.sourceUrl && !safeUrl(e.fields.sourceUrl))
      throw new Error("報告連結必須為有效的 http 或 https 網址。");
    if (e.fields.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.fields.time))
      throw new Error("日程時間格式錯誤。");
    if (
      e.fields.cost &&
      (!Number.isFinite(Number(e.fields.cost)) || Number(e.fields.cost) < 0)
    )
      throw new Error("費用需為非負數字。");
    if (e.fields.completed && !["true", "false"].includes(e.fields.completed))
      throw new Error("日程狀態錯誤。");
    if (
      !Array.isArray(e.attachments) ||
      e.attachments.length > 12 ||
      !Array.isArray(e.metrics) ||
      e.metrics.length > 30
    )
      throw new Error("附件或指標數量超過限制。");
    const attachments: Attachment[] = e.attachments.map((a: Attachment) => {
      if (
        !a ||
        !isString(a.id, 100) ||
        !isString(a.name, 250) ||
        ![...imageTypes, "application/pdf"].includes(a.type) ||
        (e.kind === "photo" && !imageTypes.includes(a.type)) ||
        !Number.isInteger(a.size) ||
        a.size <= 0 ||
        a.size > MAX_FILE ||
        !isString(a.data, Math.ceil((MAX_FILE * 4) / 3) + 100) ||
        !a.data.startsWith(`data:${a.type};base64,`)
      )
        throw new Error("附件格式錯誤或大於 8 MB。");
      const base64 = a.data.split(",")[1];
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0)
        throw new Error("附件編碼錯誤。");
      const bytes = atob(base64);
      if (bytes.length !== a.size || !fileSignature(bytes, a.type))
        throw new Error("附件內容與類型不符。");
      total += a.data.length;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
        data: a.data,
      };
    });
    const metrics: Metric[] = e.metrics.map((m: Metric) => {
      if (
        !m ||
        !isString(m.name, 100) ||
        !m.name.trim() ||
        !isString(m.value, 100) ||
        !m.value.trim() ||
        !isString(m.unit, 100) ||
        !isString(m.scale, 200)
      )
        throw new Error("每個指標都需填寫名稱與數值。");
      return { name: m.name, value: m.value, unit: m.unit, scale: m.scale };
    });
    return {
      id: e.id,
      kind: e.kind,
      title: e.title.trim(),
      date: e.date,
      notes: e.notes,
      treatmentId: e.treatmentId,
      fields: { ...e.fields },
      attachments,
      metrics,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  });
  if (total > MAX_BACKUP)
    throw new Error("附件總量超過 100 MB，請先移除較大的檔案。");
  if (
    result.some(
      (e) =>
        e.treatmentId &&
        !result.some((t) => t.id === e.treatmentId && t.kind === "treatment"),
    )
  )
    throw new Error("找不到關聯療程，請檢查備份完整性。");
  return result;
}
export function fileSignature(bytes: string, type: string) {
  if (type === "application/pdf") return bytes.startsWith("%PDF-");
  if (type === "image/jpeg")
    return (
      bytes.charCodeAt(0) === 255 &&
      bytes.charCodeAt(1) === 216 &&
      bytes.charCodeAt(2) === 255
    );
  if (type === "image/png") return bytes.startsWith("\x89PNG\r\n\x1a\n");
  if (type === "image/webp")
    return bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  return false;
}
export async function readAttachment(file: File): Promise<Attachment> {
  if (
    ![...imageTypes, "application/pdf"].includes(file.type) ||
    file.size > MAX_FILE ||
    !file.size
  )
    throw new Error("請選擇 8 MB 以下的 JPG、PNG、WebP 或 PDF。");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("無法讀取檔案。"));
    r.readAsDataURL(file);
  });
  if (!fileSignature(atob(data.split(",")[1]), file.type))
    throw new Error("檔案內容與副檔名不符。");
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
    data,
  };
}
export function parseBackup(text: string) {
  const value = JSON.parse(text);
  if (value?.app !== "skin-journal" || value?.version !== 1)
    throw new Error("不是支援的肌序備份檔（版本 1）。");
  return validateEntries(value.entries);
}
export function download(data: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
