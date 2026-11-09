import {
  useEffect,
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Droplets,
  FileText,
  Flower2,
  Heart,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  calendarExport,
  daysBetween,
  displayDate,
  download,
  fieldNames,
  labels,
  MAX_BACKUP,
  monthDays,
  newEntry,
  parseBackup,
  readAttachment,
  reportSummary,
  safeUrl,
  shiftMonth,
  sorted,
  today,
  validateEntries,
  type Dataset,
  type Entry,
  type Attachment,
  type Kind,
} from "./model";
import { load, save } from "./storage";
const AttachmentPreview = lazy(() => import("./AttachmentPreview"));
import CloudAccount, { useAccount } from "./CloudAccount";
import { loadCloud, saveCloud } from "./cloud";
import { mergeEntries } from "./merge";

type Page =
  | "overview"
  | "timeline"
  | "photos"
  | "reports"
  | "care"
  | "calendar"
  | "settings";
const nav = [
  ["overview", "總覽", LayoutDashboard],
  ["timeline", "療程與日誌", ClipboardList],
  ["photos", "照片追蹤", Camera],
  ["reports", "檢測報告", FileText],
  ["care", "保養與諮詢", Droplets],
  ["calendar", "行事曆", CalendarDays],
] as const;
const kindIcons = {
  treatment: Sparkles,
  photo: Camera,
  journal: Heart,
  report: FileText,
  routine: Droplets,
  event: CalendarDays,
};
const subtitles: Record<Page, string> = {
  overview: "每一次照顧自己，都值得被好好記錄。",
  timeline: "從療程到日常感受，留下肌膚的每一步。",
  photos: "用相同的角度，溫柔地觀察每一次變化。",
  reports: "原始資料、手動核對與整理摘要，放在一起。",
  care: "整理現在的保養，也為下一次諮詢做好準備。",
  calendar: "把療程、回診與日常追蹤，安排進生活。",
  settings: "掌握資料的保存方式，讓每一筆紀錄都安心。",
};
const allKinds: Kind[] = [
  "treatment",
  "photo",
  "journal",
  "report",
  "routine",
  "event",
];
function Botanical({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "botanical small" : "botanical"}
      viewBox="0 0 280 280"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="143" cy="139" r="102" fill="currentColor" opacity=".05" />
      <path
        d="M109 258c31-84 68-150 87-216M139 185c-48-3-77-29-81-65 41 3 73 22 81 65ZM161 141c-2-39 18-66 58-79 0 39-18 67-58 79ZM118 226c-39-2-67-19-80-48 41-7 67 8 80 48ZM181 91c-28-8-41-30-36-62 31 8 44 31 36 62ZM146 171c28-1 56-17 70-44 9 41-12 69-70 44ZM127 210c31 7 58 0 79-21-4 38-32 51-79 21Z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="m58 120 81 65m22-44 58-79m-101 164-80-48m143-87-36-62m1 142 70-44m-89 83 79-21"
        stroke="currentColor"
        strokeWidth=".6"
      />
    </svg>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">SKIN JOURNAL</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="關閉視窗">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({
  title,
  text,
  action,
  onAction,
  icon = "leaf",
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  icon?: "leaf" | "calendar";
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        {icon === "calendar" ? (
          <CalendarDays size={28} strokeWidth={1.2} />
        ) : (
          <Leaf size={30} strokeWidth={1.2} />
        )}
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Editor({
  initial,
  entries,
  onClose,
  onSave,
  cloudMode,
}: {
  cloudMode: boolean;
  initial: Entry;
  entries: Entry[];
  onClose: () => void;
  onSave: (entry: Entry) => Promise<void>;
}) {
  const [entry, setEntry] = useState<Entry>(initial);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Attachment | null>(null);
  const isNew = !entries.some((e) => e.id === initial.id);
  const dirty = JSON.stringify(entry) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const listener = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const close = () => {
    if (
      !busy &&
      !reading &&
      (!dirty || window.confirm("尚有未儲存的內容，確定離開？"))
    )
      onClose();
  };
  const field = (name: string, value: string) =>
    setEntry((e) => ({ ...e, fields: { ...e.fields, [name]: value } }));
  const input = (name: string, type = "text", placeholder = "") => (
    <input
      type={type}
      name={name}
      value={entry.fields[name] || ""}
      onChange={(e) => field(name, e.target.value)}
      onInput={(e) => field(name, e.currentTarget.value)}
      placeholder={placeholder}
      maxLength={type === "text" ? 2000 : undefined}
      min={type === "number" ? 0 : undefined}
      step={type === "number" ? "any" : undefined}
    />
  );
  const select = (name: string, options: string[]) => (
    <select
      value={entry.fields[name] || ""}
      onChange={(e) => field(name, e.target.value)}
    >
      <option value="">請選擇</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Read native date/time controls at submission as well: their change event
    // can be deferred while the user is still editing a segment.
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const fields = { ...entry.fields };
    for (const name of fieldNames[entry.kind]) {
      if (formData.has(name)) fields[name] = String(formData.get(name));
    }
    setBusy(true);
    setError("");
    try {
      if (
        entry.kind === "report" &&
        !entry.attachments.length &&
        !fields.sourceUrl &&
        !entry.metrics.length
      )
        throw new Error("請加入報告附件、來源連結或至少一個手動指標。");
      if (entry.kind === "photo" && !entry.attachments.length)
        throw new Error("請先選擇至少一張照片，確認附件縮圖出現後再儲存。");
      await onSave({
        ...entry,
        fields,
        date: String(formData.get("recordDate") || entry.date),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`${isNew ? "新增" : "編輯"}${labels[entry.kind]}`}
      onClose={close}
      wide
    >
      <form onSubmit={submit}>
        {isNew && (
          <div className="kind-picker">
            {allKinds.map((k) => {
              const Icon = kindIcons[k];
              return (
                <button
                  type="button"
                  className={entry.kind === k ? "selected" : ""}
                  key={k}
                  onClick={() => {
                    if (
                      k !== entry.kind &&
                      (!dirty ||
                        window.confirm(
                          "切換類別會清除目前未儲存內容，是否繼續？",
                        ))
                    )
                      setEntry(newEntry(k));
                  }}
                >
                  <Icon size={16} />
                  {labels[k]}
                </button>
              );
            })}
          </div>
        )}
        <div className="form-grid">
          <Field
            label={`${entry.kind === "routine" ? "保養步驟名稱" : "標題"} *`}
            full
          >
            <input
              required
              maxLength={150}
              autoFocus
              value={entry.title}
              onChange={(e) => setEntry({ ...entry, title: e.target.value })}
              placeholder={
                {
                  treatment: "例如：皮秒雷射",
                  photo: "例如：術後第 7 天・正面",
                  journal: "例如：今天的肌膚觀察",
                  report: "例如：11 月肌膚檢測",
                  routine: "例如：早晨保濕",
                  event: "例如：術後回診",
                }[entry.kind]
              }
            />
          </Field>
          <Field label={`${entry.kind === "routine" ? "開始日期" : "日期"} *`}>
            <input
              type="date"
              name="recordDate"
              min="1900-01-01"
              max="2200-12-31"
              required
              value={entry.date}
              onChange={(e) => setEntry({ ...entry, date: e.target.value })}
            />
          </Field>
          {entry.kind !== "treatment" && entry.kind !== "routine" && (
            <Field label="關聯療程（選填）">
              <select
                value={entry.treatmentId}
                onChange={(e) =>
                  setEntry({ ...entry, treatmentId: e.target.value })
                }
              >
                <option value="">不關聯療程</option>
                {sorted(entries.filter((e) => e.kind === "treatment")).map(
                  (e) => (
                    <option key={e.id} value={e.id}>
                      {e.date} · {e.title}
                    </option>
                  ),
                )}
              </select>
            </Field>
          )}
          {entry.kind === "treatment" && (
            <>
              <Field label="施作部位">
                {input("area", "text", "例如：全臉")}
              </Field>
              <Field label="診所">{input("clinic")}</Field>
              <Field label="醫師">{input("doctor")}</Field>
              <Field label="費用（NT$）">{input("cost", "number")}</Field>
              <Field label="醫囑與術後注意事項" full>
                <textarea
                  value={entry.fields.instructions || ""}
                  onChange={(e) => field("instructions", e.target.value)}
                  maxLength={20000}
                  placeholder="記錄醫師實際提供的醫囑"
                />
              </Field>
            </>
          )}
          {entry.kind === "photo" && (
            <>
              <Field label="追蹤階段">
                {select("stage", ["術前", "術後", "恢復期", "日常追蹤"])}
              </Field>
              <Field label="拍攝角度">
                {select("angle", ["正面", "左側", "右側", "局部", "其他"])}
              </Field>
            </>
          )}
          {entry.kind === "journal" && (
            <>
              <Field label="肌膚感受">
                {select("feeling", [
                  "穩定",
                  "乾燥",
                  "泛紅",
                  "出油",
                  "緊繃",
                  "其他",
                ])}
              </Field>
              <Field label="當天使用的產品" full>
                {input("products")}
              </Field>
            </>
          )}
          {entry.kind === "report" && (
            <>
              <Field label="報告來源">
                {input("source", "text", "例如：EveLab Insight")}
              </Field>
              <Field label="原始連結" full>
                {input("sourceUrl", "url", "https://…")}
              </Field>
              <div className="form-note full">
                <CircleHelp size={16} />
                連結只作為來源保存；此版不自動讀取連結、PDF
                或圖片，也不保存報告密碼。
              </div>
              <Field label="檢測儀器／型號">{input("device")}</Field>
              <Field label="報告／儀器版本">{input("version")}</Field>
              <div className="full metrics-editor">
                <div className="section-heading">
                  <h3>手動核對指標</h3>
                  <button
                    type="button"
                    className="text-button"
                    disabled={entry.metrics.length >= 30}
                    onClick={() =>
                      setEntry({
                        ...entry,
                        metrics: [
                          ...entry.metrics,
                          { name: "", value: "", unit: "", scale: "" },
                        ],
                      })
                    }
                  >
                    <Plus size={15} />
                    新增指標
                  </button>
                </div>
                <p className="muted small-text">
                  依原始報告填寫，保留單位與量尺；沒有數值可先留空整組。
                </p>
                {entry.metrics.map((m, i) => (
                  <div className="metric-row" key={i}>
                    {(["name", "value", "unit", "scale"] as const).map(
                      (key, j) => (
                        <input
                          key={key}
                          aria-label={`指標 ${i + 1} ${["名稱", "數值", "單位", "量尺"][j]}`}
                          placeholder={
                            ["名稱 *", "數值 *", "單位", "量尺（如 0–100）"][j]
                          }
                          maxLength={key === "scale" ? 200 : 100}
                          required={j < 2}
                          value={m[key]}
                          onChange={(e) =>
                            setEntry({
                              ...entry,
                              metrics: entry.metrics.map((v, n) =>
                                n === i ? { ...v, [key]: e.target.value } : v,
                              ),
                            })
                          }
                        />
                      ),
                    )}
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`移除指標 ${i + 1}`}
                      onClick={() =>
                        setEntry({
                          ...entry,
                          metrics: entry.metrics.filter((_, n) => n !== i),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {entry.kind === "routine" && (
            <>
              <Field label="使用時段">
                {select("period", ["早間", "晚間", "早晚", "依醫囑", "其他"])}
              </Field>
              <Field label="產品名稱" full>
                {input("product")}
              </Field>
              <Field label="已確認的使用方式／醫囑" full>
                <textarea
                  value={entry.fields.instructions || ""}
                  maxLength={20000}
                  onChange={(e) => field("instructions", e.target.value)}
                />
              </Field>
            </>
          )}
          {entry.kind === "event" && (
            <>
              <Field label="日程類型">
                {select("type", [
                  "療程",
                  "回診",
                  "拍照追蹤",
                  "重新檢測",
                  "諮詢",
                  "其他",
                ])}
              </Field>
              <Field label="時間（台北時間，留空為全天）">
                {input("time", "time")}
              </Field>
              <Field label="地點">{input("location")}</Field>
            </>
          )}
          <Field
            label={entry.kind === "journal" ? "主觀觀察與不適紀錄" : "備註"}
            full
          >
            <textarea
              maxLength={20000}
              rows={3}
              value={entry.notes}
              onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
              placeholder="寫下想留給未來自己的紀錄…"
            />
          </Field>
          {entry.kind !== "event" && entry.kind !== "routine" && (
            <div className="full">
              <label className="upload-area">
                <Upload size={21} />
                <span>
                  {reading
                    ? "正在讀取檔案…"
                    : entry.kind === "photo"
                      ? "選擇追蹤照片"
                      : "加入照片或原始報告"}
                </span>
                <small>
                  JPG、PNG、WebP{entry.kind !== "photo" ? "、PDF" : ""} ·
                  每檔上限 8 MB · 最多 12 個
                </small>
                <input
                  type="file"
                  multiple
                  accept={
                    entry.kind === "photo"
                      ? "image/jpeg,image/png,image/webp"
                      : "image/jpeg,image/png,image/webp,application/pdf"
                  }
                  disabled={reading || busy}
                  onInput={async (e) => {
                    const files = Array.from(e.currentTarget.files || []);
                    e.currentTarget.value = "";
                    setError("");
                    setReading(true);
                    try {
                      if (entry.attachments.length + files.length > 12)
                        throw new Error("每筆最多 12 個附件。");
                      const attachments: Entry["attachments"] = [];
                      for (const file of files)
                        attachments.push(await readAttachment(file));
                      setEntry((v) => ({
                        ...v,
                        attachments: [...v.attachments, ...attachments],
                      }));
                    } catch (error) {
                      setError((error as Error).message);
                    } finally {
                      setReading(false);
                    }
                  }}
                />
              </label>
              <div className="attachment-list">
                {entry.attachments.map((a) => (
                  <div key={a.id}>
                    <button
                      type="button"
                      className="attachment-preview-button"
                      onClick={() => setPreview(a)}
                    >
                      {a.type.startsWith("image/") ? (
                        <img src={a.data} alt="附件縮圖" />
                      ) : (
                        <FileText size={20} />
                      )}
                      <span>預覽 {a.name}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`移除 ${a.name}`}
                      onClick={() =>
                        setEntry({
                          ...entry,
                          attachments: entry.attachments.filter(
                            (v) => v.id !== a.id,
                          ),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {entry.kind === "photo" && (
                <p className="small-text muted">
                  建議維持相同光線、角度與距離。照片本身不提供診斷或 AI 分析。
                </p>
              )}
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <span>
            <LockKeyhole size={14} />
            {cloudMode ? "儲存至目前雲端帳號" : "僅儲存於此瀏覽器"}
          </span>
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={busy || reading}
          >
            取消
          </button>
          <button className="button primary" disabled={busy || reading}>
            <Check size={16} />
            {busy ? "儲存中…" : "儲存紀錄"}
          </button>
        </div>
      </form>
      {preview && (
        <PreviewDialog attachment={preview} onClose={() => setPreview(null)} />
      )}
    </Modal>
  );
}

function PreviewDialog({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="attachment-preview-dialog"
      aria-label={`預覽 ${attachment.name}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{attachment.name}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="關閉附件預覽"
        >
          <X size={20} />
        </button>
      </div>
      {attachment.type === "application/pdf" ? (
        <Suspense fallback={<p>正在載入報告預覽…</p>}>
          <AttachmentPreview attachment={attachment} />
        </Suspense>
      ) : (
        <div className="image-preview">
          <img src={attachment.data} alt={attachment.name} />
        </div>
      )}
    </dialog>
  );
}
export default function App() {
  const { user, resolved: authReady } = useAccount();
  const userId = user?.id || null;
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const [dataset, setDataset] = useState<Dataset>({ revision: 0, entries: [] });
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [page, setPage] = useState<Page>("overview");
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<Entry | null>(null);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [pendingImport, setPendingImport] = useState<Entry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [changed, setChanged] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today());
  const [compare, setCompare] = useState<[string, string]>(["", ""]);
  const importRef = useRef<HTMLInputElement>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const saving = useRef(false);
  const entries = dataset.entries;
  const treatments = sorted(entries.filter((e) => e.kind === "treatment"));
  const reports = sorted(entries.filter((e) => e.kind === "report"));
  const photos = sorted(entries.filter((e) => e.kind === "photo"));
  const routines = sorted(entries.filter((e) => e.kind === "routine"));
  const events = entries
    .filter((e) => e.kind === "event")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.fields.time || "").localeCompare(b.fields.time || ""),
    );
  const upcoming = events.filter(
    (e) => e.date >= today() && e.fields.completed !== "true",
  );
  const matches = (entry: Entry) =>
    [entry.title, entry.notes, ...Object.values(entry.fields)]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase());
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;
  const editingRef = useRef(false);
  editingRef.current = Boolean(editor || detail || pendingImport);
  useEffect(() => {
    if (!authReady) return;
    let live = true;
    setReady(false);
    setStorageError("");
    setDataset({ revision: 0, entries: [] });
    setEditor(null);
    setDetail(null);
    setPreview(null);
    setPendingImport(null);
    const read = () => (userId ? loadCloud(userId) : load());
    void read()
      .then((d) => {
        if (live) {
          setDataset(d);
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) setStorageError(e.message);
      });
    const refresh = async () => {
      if (!live || editingRef.current || saving.current) return;
      try {
        const d = await read();
        if (
          live &&
          !editingRef.current &&
          !saving.current &&
          d.revision > datasetRef.current.revision
        ) {
          setDataset(d);
          setChanged(false);
        }
        if (live) {
          setStorageError("");
          setReady(true);
        }
      } catch (e) {
        if (live)
          setStorageError(`同步失敗，請重新載入。${(e as Error).message}`);
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    const timer = window.setInterval(refresh, 30000);
    const c =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("skin-journal")
        : null;
    channel.current = c;
    if (c) c.onmessage = () => setChanged(true);
    return () => {
      live = false;
      c?.close();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [userId, authReady]);
  const refreshCloud = async () => {
    if (saving.current || editingRef.current) return;
    setReady(false);
    try {
      const d = userId ? await loadCloud(userId) : await load();
      if (activeUser.current === userId) {
        setDataset(d);
        setReady(true);
        setStorageError("");
        setChanged(false);
      }
    } catch (e) {
      setStorageError((e as Error).message);
    }
  };
  useEffect(() => {
    setMenu(false);
    setMobile(false);
    setQuery("");
    setFilter("all");
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  const commit = async (next: Entry[]) => {
    if (!ready) throw new Error("儲存空間尚未就緒。");
    if (saving.current) throw new Error("正在儲存，請稍候再試。");
    saving.current = true;
    try {
      const valid = validateEntries(next);
      const d = userId
        ? await saveCloud(valid, dataset.revision, userId)
        : await save(valid, dataset.revision);
      if (activeUser.current !== userId)
        throw new Error("帳號已切換，請重新載入目前帳號。");
      setDataset(d);
      setChanged(false);
      channel.current?.postMessage(d.revision);
    } finally {
      saving.current = false;
    }
  };
  const add = (kind: Kind, date?: string) => {
    if (!ready) return;
    const e = newEntry(kind);
    if (date) e.date = date;
    setEditor(e);
    setMenu(false);
  };
  const saveEntry = async (entry: Entry) => {
    await commit([...entries.filter((e) => e.id !== entry.id), entry]);
    setEditor(null);
    setToast(
      userId
        ? "紀錄與附件已儲存到私人雲端"
        : "已儲存於此瀏覽器；登入後可上傳雲端",
    );
  };
  const remove = async (entry: Entry) => {
    if (
      !window.confirm(
        `確定刪除「${entry.title}」及其附件？${entry.kind === "treatment" ? "關聯紀錄會保留並解除關聯。" : ""}此動作無法復原。`,
      )
    )
      return;
    try {
      await commit(
        entries
          .filter((e) => e.id !== entry.id)
          .map((e) =>
            e.treatmentId === entry.id ? { ...e, treatmentId: "" } : e,
          ),
      );
      setDetail(null);
      setToast("紀錄已刪除");
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const toggleEvent = async (entry: Entry) => {
    try {
      await commit(
        entries.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                fields: {
                  ...e.fields,
                  completed: e.fields.completed === "true" ? "false" : "true",
                },
                updatedAt: new Date().toISOString(),
              }
            : e,
        ),
      );
      setDetail(null);
      setToast(
        entry.fields.completed === "true" ? "已設為待追蹤" : "已完成這筆日程",
      );
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const exportData = () => {
    download(
      JSON.stringify(
        {
          app: "skin-journal",
          version: 1,
          exportedAt: new Date().toISOString(),
          entries,
        },
        null,
        2,
      ),
      `肌序備份-${today()}.json`,
      "application/json",
    );
    setToast("備份已下載，請妥善保管內含的私人資料");
  };
  const importData = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > MAX_BACKUP * 1.1)
        throw new Error("備份檔超過 110 MB 上限。");
      setPendingImport(parseBackup(await file.text()));
    } catch (e) {
      setToast(`無法匯入：${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };
  const showEntry = (entry: Entry) => setDetail(entry);
  const entryRows = (list: Entry[], limit?: number) => (
    <div className="entry-list">
      {list.slice(0, limit).map((e) => {
        const Icon = kindIcons[e.kind];
        return (
          <button key={e.id} className="entry-row" onClick={() => showEntry(e)}>
            <div className={`entry-icon ${e.kind}`}>
              <Icon size={19} strokeWidth={1.6} />
            </div>
            <div className="entry-main">
              <span className="entry-title">{e.title}</span>
              <span className="entry-meta">
                {displayDate(e.date, true)}
                {e.fields.clinic ? ` · ${e.fields.clinic}` : ""}
                {e.fields.feeling ? ` · ${e.fields.feeling}` : ""}
                {e.fields.stage ? ` · ${e.fields.stage}` : ""}
              </span>
            </div>
            <span className="tag">{labels[e.kind]}</span>
            <ArrowUpRight size={17} className="row-arrow" />
          </button>
        );
      })}
    </div>
  );
  const upcomingRows = (list: Entry[]) => (
    <div className="upcoming-list">
      {list.map((e) => (
        <button
          className="upcoming-row"
          key={e.id}
          onClick={() => showEntry(e)}
        >
          <div className="date-tile">
            <small>{Number(e.date.slice(5, 7))}月</small>
            <strong>{e.date.slice(8)}</strong>
          </div>
          <div>
            <span className="tag">{e.fields.type || "追蹤日程"}</span>
            <h4>{e.title}</h4>
            <p>
              {e.fields.time || "全天"}
              {e.fields.location ? ` · ${e.fields.location}` : ""}
            </p>
          </div>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-symbol">
            <Leaf size={25} strokeWidth={1.3} />
          </span>
          <div>
            <strong>
              肌序<span>Skin Journal</span>
            </strong>
            <small>讓每一次改變，有跡可循。</small>
          </div>
        </a>
        <span className="sidebar-label">MY PERSONAL SPACE</span>
        <nav aria-label="主要導覽">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => setPage(key)}
            >
              <Icon size={19} strokeWidth={1.5} />
              {label}
              {page === key && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="backup-prompt">
            <ShieldCheck size={21} />
            <h4>為紀錄，留一份備份</h4>
            <p>
              {userId
                ? "資料保存在私人雲端。"
                : "未登入：資料僅保存在此瀏覽器。"}
              <br />
              定期匯出，讓回憶安心留存。
            </p>
            <button onClick={exportData} disabled={!ready}>
              <ArrowDownToLine size={15} />
              匯出我的資料
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`settings-link ${page === "settings" ? "active" : ""}`}
            onClick={() => setPage("settings")}
          >
            <Settings2 size={18} />
            資料與設定
          </button>
          <span className="version">PERSONAL JOURNAL · V0.2</span>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-shade" onClick={() => setMobile(false)} />
      )}
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="展開導覽"
            >
              <Menu size={21} />
            </button>
            <span>我的肌膚空間</span>
            <ChevronRight size={13} />
            <strong>
              {page === "settings"
                ? "資料與設定"
                : nav.find((n) => n[0] === page)?.[1]}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <LockKeyhole size={13} />
              <button onClick={() => setPage("settings")}>
                {userId ? "已登入 · 雲端同步" : "登入跨裝置同步"}
              </button>
            </span>
            <div className="avatar" aria-label="個人空間">
              私
            </div>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "overview"
                  ? "A LITTLE CARE, EVERY DAY"
                  : "YOUR SKIN, YOUR STORY"}
              </span>
              <h1>
                {page === "overview"
                  ? "我的肌膚日常"
                  : page === "settings"
                    ? "資料與設定"
                    : nav.find((n) => n[0] === page)?.[1]}
              </h1>
              <p>{subtitles[page]}</p>
            </div>
            <div className="add-wrapper">
              <button
                className="button primary"
                disabled={!ready}
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
              >
                <Plus size={18} />
                新增紀錄
              </button>
              {menu && (
                <>
                  <div
                    className="menu-dismiss"
                    onClick={() => setMenu(false)}
                  />
                  <div className="add-menu">
                    {allKinds.map((k) => {
                      const Icon = kindIcons[k];
                      return (
                        <button key={k} onClick={() => add(k)}>
                          <Icon size={17} />
                          {labels[k]}
                          <Plus size={14} />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          {!ready && (
            <div
              className={storageError ? "error-box" : "notice"}
              role={storageError ? "alert" : "status"}
            >
              {storageError || "正在開啟你的肌膚日誌…"}
              {storageError && (
                <button
                  className="text-button"
                  onClick={() => void refreshCloud()}
                >
                  重新載入
                </button>
              )}
            </div>
          )}
          {changed && (
            <div className="notice">
              另一個分頁已更新資料。請先關閉編輯，再
              <button
                className="text-button"
                disabled={!!editor}
                onClick={async () => {
                  try {
                    setDataset(userId ? await loadCloud(userId) : await load());
                    setChanged(false);
                  } catch (e) {
                    setToast((e as Error).message);
                  }
                }}
              >
                載入最新資料
              </button>
              。
            </div>
          )}
          {page === "overview" && (
            <>
              <div className="overview-top">
                <section className="hero">
                  <div className="hero-copy">
                    <span className="eyebrow">YOUR SKIN JOURNEY</span>
                    <h2>
                      好好記錄，
                      <br />
                      讓改變有跡可循。
                    </h2>
                    <p>
                      療程、膚況與每一次細微變化，
                      <br />
                      都在這裡，慢慢累積成更懂自己的日常。
                    </p>
                    <button
                      className="button primary"
                      disabled={!ready}
                      onClick={() => add("treatment")}
                    >
                      {treatments.length ? "記錄新的療程" : "開始第一筆療程"}
                      <ArrowRight size={16} />
                    </button>
                    <span className="hero-footnote">
                      <Leaf size={13} />
                      不急著改變，先從了解自己開始。
                    </span>
                  </div>
                  <Botanical />
                </section>
                <section className="panel today-panel">
                  <span className="eyebrow">TODAY'S LITTLE CHECK-IN</span>
                  <div className="today-heading">
                    <h3>{displayDate(today())}</h3>
                    <span>
                      {new Date(today() + "T12:00:00+08:00").toLocaleDateString(
                        "zh-TW",
                        { weekday: "long" },
                      )}
                    </span>
                  </div>
                  <div className="checkin-icon">
                    <Droplets size={32} strokeWidth={1} />
                  </div>
                  <h3>今天的肌膚，感覺如何？</h3>
                  <p>
                    一點感受、一張照片，
                    <br />
                    都是認識肌膚的線索。
                  </p>
                  <button
                    className="button secondary"
                    disabled={!ready}
                    onClick={() => add("journal")}
                  >
                    <Plus size={16} />
                    寫下今日膚況
                  </button>
                </section>
              </div>
              <div className="stat-grid">
                {(
                  [
                    [
                      "療程紀錄",
                      treatments.length,
                      "次",
                      Sparkles,
                      "treatment",
                    ],
                    [
                      "追蹤照片",
                      photos.reduce(
                        (n, p) =>
                          n +
                          p.attachments.filter((a) =>
                            a.type.startsWith("image/"),
                          ).length,
                        0,
                      ),
                      "張",
                      Camera,
                      "photo",
                    ],
                    ["檢測報告", reports.length, "份", FileText, "report"],
                    ["近期安排", upcoming.length, "項", CalendarDays, "event"],
                  ] as const
                ).map(([title, value, unit, Icon, kind]) => (
                  <button
                    className="stat-card"
                    key={title}
                    onClick={() =>
                      setPage(
                        (
                          {
                            treatment: "timeline",
                            photo: "photos",
                            report: "reports",
                            event: "calendar",
                          } as const
                        )[kind],
                      )
                    }
                  >
                    <div>
                      <span>{title}</span>
                      <strong>
                        {String(value).padStart(2, "0")}
                        <small>{unit}</small>
                      </strong>
                    </div>
                    <div className={`entry-icon ${kind}`}>
                      <Icon size={21} strokeWidth={1.4} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="overview-bottom">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>最近的肌膚紀錄</h3>
                      <p>把每個值得記下的片刻，留在這裡。</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("timeline")}
                    >
                      查看全部
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {entries.filter((e) => !["routine", "event"].includes(e.kind))
                    .length ? (
                    entryRows(
                      sorted(
                        entries.filter(
                          (e) => !["routine", "event"].includes(e.kind),
                        ),
                      ),
                      4,
                    )
                  ) : (
                    <Empty
                      title="你的肌膚故事，從這裡開始"
                      text="新增療程、照片或日誌，一起串起照顧自己的足跡。"
                      action="新增第一筆紀錄"
                      onAction={() => add("treatment")}
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>接下來的安排</h3>
                      <p>為自己，留一點照顧的時間。</p>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setPage("calendar")}
                      aria-label="查看行事曆"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  {upcoming.length ? (
                    upcomingRows(upcoming.slice(0, 3))
                  ) : (
                    <Empty
                      title="還沒有待追蹤日程"
                      text="安排回診、拍照或下次檢測。"
                      icon="calendar"
                      action="新增日程"
                      onAction={() => add("event")}
                    />
                  )}
                  <div className="panel-tip">
                    <Flower2 size={16} />
                    <span>療程日期與間隔，記得和醫師一起確認。</span>
                  </div>
                </section>
              </div>
              <div className="privacy-footer">
                <ShieldCheck size={14} />
                <span>
                  {userId
                    ? "紀錄與附件僅限登入帳號讀取，不會上傳至 GitHub。"
                    : "未登入的紀錄僅存在此瀏覽器。登入後可將舊資料加入雲端。"}
                </span>
                <button onClick={() => setPage("settings")}>
                  了解資料保存
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </>
          )}
          {["timeline", "reports", "photos", "care"].includes(page) && (
            <div className="list-toolbar">
              <div className="filter-tabs">
                {(page === "timeline"
                  ? [
                      ["all", "全部紀錄"],
                      ["treatment", "療程"],
                      ["journal", "膚況日誌"],
                      ["photo", "照片"],
                      ["report", "報告"],
                    ]
                  : page === "care"
                    ? [
                        ["all", "所有時段"],
                        ["早間", "早間"],
                        ["晚間", "晚間"],
                      ]
                    : [
                        [
                          "all",
                          page === "reports"
                            ? `所有報告 · ${reports.length}`
                            : `追蹤紀錄 · ${photos.length}`,
                        ],
                      ]
                ).map(([key, title]) => (
                  <button
                    key={key}
                    className={filter === key ? "selected" : ""}
                    onClick={() => setFilter(key)}
                  >
                    {title}
                  </button>
                ))}
              </div>
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="搜尋紀錄"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋紀錄…"
                />
              </label>
            </div>
          )}
          {page === "timeline" && (
            <section className="panel">
              {sorted(
                entries.filter(
                  (e) =>
                    !["event", "routine"].includes(e.kind) &&
                    (filter === "all" || filter === e.kind) &&
                    matches(e),
                ),
              ).length ? (
                entryRows(
                  sorted(
                    entries.filter(
                      (e) =>
                        !["event", "routine"].includes(e.kind) &&
                        (filter === "all" || filter === e.kind) &&
                        matches(e),
                    ),
                  ),
                )
              ) : (
                <Empty
                  title={
                    query || filter !== "all"
                      ? "沒有符合的紀錄"
                      : "每一次照顧，都有自己的位置"
                  }
                  text={
                    query || filter !== "all"
                      ? "試試其他關鍵字或分類。"
                      : "從療程開始，接著記錄照片與每日膚況。"
                  }
                  action="新增紀錄"
                  onAction={() => add("treatment")}
                />
              )}
            </section>
          )}
          {page === "reports" && (
            <>
              <div className="notice">
                <FileText size={18} />
                <span>
                  可保存報告連結、PDF 與截圖，並手動輸入指標產生整理摘要。EveLab
                  自動擷取與 AI 分析尚未支援。
                </span>
              </div>
              {reports.filter(matches).length ? (
                <div className="report-grid">
                  {reports.filter(matches).map((e) => (
                    <button
                      className="report-card panel"
                      key={e.id}
                      onClick={() => showEntry(e)}
                    >
                      <div className="report-top">
                        <span className="entry-icon report">
                          <FileText size={22} />
                        </span>
                        <ArrowUpRight size={19} />
                      </div>
                      <span className="eyebrow">
                        {e.fields.source || "手動建立報告"}
                      </span>
                      <h3>{e.title}</h3>
                      <p>
                        {displayDate(e.date, true)} · {e.attachments.length}{" "}
                        個附件
                      </p>
                      <div className="report-metrics">
                        {e.metrics.length ? (
                          e.metrics.slice(0, 3).map((m, i) => (
                            <span key={i}>
                              <small>{m.name}</small>
                              <strong>
                                {m.value}
                                <em>{m.unit}</em>
                              </strong>
                            </span>
                          ))
                        ) : (
                          <span className="muted">尚未輸入指標</span>
                        )}
                      </div>
                      <div className="card-footer">
                        <span>手動核對 · {e.metrics.length} 個指標</span>
                        <span>
                          閱讀報告
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    title={
                      query ? "沒有符合的報告" : "讓檢測資料，有一個安穩的位置"
                    }
                    text="保存原始來源，再慢慢補齊並核對指標。"
                    action="新增檢測報告"
                    onAction={() => add("report")}
                  />
                </section>
              )}
            </>
          )}
          {page === "photos" && (
            <>
              <div className="notice">
                <Camera size={18} />
                <span>
                  同角度、同光線的照片更方便回顧。畫面只供個人觀察，未進行影像分析。
                </span>
              </div>
              {photos.some((e) => e.attachments.length) && (
                <section className="panel compare-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>並排看見變化</h3>
                      <p>選擇兩張照片，保留拍攝條件與時間脈絡。</p>
                    </div>
                    <span className="tag">照片比較</span>
                  </div>
                  <div className="compare-grid">
                    {[0, 1].map((index) => {
                      const choices = photos.flatMap((p) =>
                        p.attachments.map((a) => ({
                          entry: p,
                          attachment: a,
                          key: `${p.id}:${a.id}`,
                        })),
                      );
                      const choice = choices.find(
                        (c) => c.key === compare[index],
                      );
                      const linked = treatments.find(
                        (t) => t.id === choice?.entry.treatmentId,
                      );
                      return (
                        <div key={index}>
                          <select
                            aria-label={`比較照片 ${index + 1}`}
                            value={compare[index]}
                            onChange={(e) =>
                              setCompare((v) =>
                                index === 0
                                  ? [e.target.value, v[1]]
                                  : [v[0], e.target.value],
                              )
                            }
                          >
                            <option value="">
                              選擇{index === 0 ? "第一" : "第二"}張照片
                            </option>
                            {choices.map((c) => (
                              <option value={c.key} key={c.key}>
                                {c.entry.date} · {c.entry.title} ·{" "}
                                {c.attachment.name}
                              </option>
                            ))}
                          </select>
                          <div className="compare-image">
                            {choice ? (
                              <img
                                src={choice.attachment.data}
                                alt={choice.entry.title}
                              />
                            ) : (
                              <Camera size={35} strokeWidth={1} />
                            )}
                          </div>
                          {choice && (
                            <p className="small-text muted">
                              {choice.entry.date} ·{" "}
                              {choice.entry.fields.angle || "未標示角度"}
                              {linked
                                ? ` · 距療程 ${daysBetween(choice.entry.date, linked.date)} 天`
                                : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {photos.filter(matches).length ? (
                <div className="photo-grid">
                  {photos.filter(matches).map((e) => (
                    <button
                      className="photo-card panel"
                      key={e.id}
                      onClick={() => showEntry(e)}
                    >
                      <div className="photo-cover">
                        {e.attachments[0] ? (
                          <img src={e.attachments[0].data} alt={e.title} />
                        ) : (
                          <Camera size={35} strokeWidth={1} />
                        )}
                        <span className="tag">
                          {e.fields.stage || "追蹤照片"}
                        </span>
                      </div>
                      <div className="photo-caption">
                        <h3>{e.title}</h3>
                        <p>
                          {e.date} · {e.fields.angle || "未標示角度"} ·{" "}
                          {e.attachments.length} 張
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    title={
                      query ? "沒有符合的照片" : "把肌膚的細微變化，留下來"
                    }
                    text="上傳術前、術後或日常照片，與療程連結並排回顧。"
                    action="新增追蹤照片"
                    onAction={() => add("photo")}
                  />
                </section>
              )}
            </>
          )}
          {page === "care" && (
            <>
              <div className="care-layout">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>我的保養流程</h3>
                      <p>依自己的實際使用方式，整理日常保養。</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => add("routine")}
                    >
                      <Plus size={16} />
                      新增步驟
                    </button>
                  </div>
                  {routines.filter(
                    (e) =>
                      matches(e) &&
                      (filter === "all" ||
                        e.fields.period === filter ||
                        e.fields.period === "早晚"),
                  ).length ? (
                    entryRows(
                      routines.filter(
                        (e) =>
                          matches(e) &&
                          (filter === "all" ||
                            e.fields.period === filter ||
                            e.fields.period === "早晚"),
                      ),
                    )
                  ) : (
                    <Empty
                      title="從現在的保養開始記錄"
                      text="填入產品、使用時段及已確認的醫囑。"
                      action="新增保養步驟"
                      onAction={() => add("routine")}
                    />
                  )}
                </section>
                <section className="consultation panel">
                  <Heart size={25} strokeWidth={1.3} />
                  <span className="eyebrow">A NOTE FOR YOUR NEXT VISIT</span>
                  <h3>留給下次諮詢的問題</h3>
                  <ul>
                    <li>我目前最希望改善的是什麼？</li>
                    <li>療程後有哪些感受或不適？</li>
                    <li>現用保養品是否需要調整？</li>
                    <li>追蹤時間與下一步如何安排？</li>
                  </ul>
                  <p>
                    這是一份固定的討論清單。此版不提供個人化療程或用藥建議，適合性與間隔請由醫師確認。
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => add("event")}
                  >
                    安排諮詢
                    <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
              <section className="panel instructions-panel">
                <div className="panel-heading">
                  <div>
                    <h3>近期療程醫囑</h3>
                    <p>以下僅呈現你記錄的原始醫囑。</p>
                  </div>
                </div>
                {treatments.some((e) => e.fields.instructions) ? (
                  treatments
                    .filter((e) => e.fields.instructions)
                    .slice(0, 5)
                    .map((e) => (
                      <button
                        className="instruction"
                        key={e.id}
                        onClick={() => showEntry(e)}
                      >
                        <span className="tag">{e.date}</span>
                        <h4>{e.title}</h4>
                        <p>{e.fields.instructions}</p>
                      </button>
                    ))
                ) : (
                  <div className="simple-empty">
                    尚未記錄醫囑，可在療程紀錄中補上。
                  </div>
                )}
              </section>
            </>
          )}
          {page === "calendar" && (
            <div className="calendar-layout">
              <section className="panel calendar-panel">
                <div className="panel-heading">
                  <div className="month-title">
                    <h3>
                      {month.split("-")[0]} 年 {Number(month.split("-")[1])} 月
                    </h3>
                    <button
                      className="text-button"
                      onClick={() => {
                        setMonth(today().slice(0, 7));
                        setSelectedDate(today());
                      }}
                    >
                      今天
                    </button>
                  </div>
                  <div className="month-nav">
                    <button
                      className="icon-button"
                      aria-label="上個月"
                      disabled={month <= "1900-01"}
                      onClick={() => setMonth(shiftMonth(month, -1))}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="下個月"
                      disabled={month >= "2200-12"}
                      onClick={() => setMonth(shiftMonth(month, 1))}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
                <div className="calendar-grid">
                  {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                    <div key={d} className="weekday">
                      {d}
                    </div>
                  ))}
                  {monthDays(month).map((date, i) => (
                    <button
                      className={`calendar-day ${date === today() ? "is-today" : ""} ${date === selectedDate ? "selected" : ""}`}
                      disabled={!date}
                      key={date || `blank-${i}`}
                      aria-label={date || "空白"}
                      aria-pressed={date === selectedDate}
                      onClick={() => setSelectedDate(date)}
                    >
                      {date && (
                        <>
                          <span>{Number(date.slice(8))}</span>
                          <div className="day-events">
                            {events
                              .filter((e) => e.date === date)
                              .slice(0, 2)
                              .map((e) => (
                                <span
                                  key={e.id}
                                  className={
                                    e.fields.completed === "true" ? "done" : ""
                                  }
                                >
                                  {e.title}
                                </span>
                              ))}
                            {events.filter((e) => e.date === date).length >
                              2 && (
                              <small>
                                還有{" "}
                                {events.filter((e) => e.date === date).length -
                                  2}{" "}
                                項
                              </small>
                            )}
                          </div>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <div className="calendar-legend">
                  <span>
                    <i />
                    待追蹤
                  </span>
                  <span>
                    <i className="done" />
                    已完成
                  </span>
                  <span>時間皆為台北時間</span>
                </div>
              </section>
              <section className="panel date-agenda">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">SELECTED DAY</span>
                    <h3>{displayDate(selectedDate)}</h3>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => add("event", selectedDate)}
                    aria-label="在所選日期新增日程"
                  >
                    <Plus size={19} />
                  </button>
                </div>
                {events.filter((e) => e.date === selectedDate).length ? (
                  <div className="agenda-list">
                    {events
                      .filter((e) => e.date === selectedDate)
                      .map((e) => (
                        <div
                          key={e.id}
                          className={`agenda-item ${e.fields.completed === "true" ? "completed" : ""}`}
                        >
                          <button
                            className="complete-button"
                            aria-label={`${e.fields.completed === "true" ? "取消完成" : "完成"} ${e.title}`}
                            onClick={() => toggleEvent(e)}
                          >
                            {e.fields.completed === "true" && (
                              <Check size={13} />
                            )}
                          </button>
                          <button onClick={() => showEntry(e)}>
                            <small>
                              {e.fields.time || "全天"} ·{" "}
                              {e.fields.type || "日程"}
                            </small>
                            <strong>{e.title}</strong>
                            <span>{e.fields.location}</span>
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <Empty
                    title="這一天，留點空白也很好"
                    text="有需要追蹤的事，再慢慢安排。"
                    icon="calendar"
                    action="新增日程"
                    onAction={() => add("event", selectedDate)}
                  />
                )}
                <div className="calendar-export">
                  <button
                    className="text-button"
                    disabled={!events.length}
                    onClick={() =>
                      download(
                        calendarExport(events),
                        `肌序日程-${today()}.ics`,
                        "text/calendar;charset=utf-8",
                      )
                    }
                  >
                    <ArrowDownToLine size={16} />
                    匯出全部日程 .ics
                  </button>
                  <p>可手動加入手機或電腦行事曆。網站不會主動發送通知。</p>
                </div>
              </section>
            </div>
          )}
          {page === "settings" && (
            <>
              <CloudAccount
                user={user}
                busy={(!ready && !storageError) || !!editor || importing}
                onRefresh={() => void refreshCloud()}
                onMigrate={async () => {
                  const local = await load();
                  if (!local.entries.length)
                    throw new Error("此瀏覽器沒有舊紀錄。");
                  if (
                    !window.confirm(
                      `將此瀏覽器 ${local.entries.length} 筆紀錄與附件加入目前雲端帳號？`,
                    )
                  )
                    throw new Error("已取消上傳");
                  await commit(mergeEntries(entries, local.entries));
                }}
              />
              <div className="settings-grid">
                <section className="panel settings-panel">
                  <div className="entry-icon treatment">
                    <ShieldCheck size={23} />
                  </div>
                  <h3>資料，由你自己掌握</h3>
                  <p>
                    登入後使用私人雲端保存紀錄與附件，手機、電腦以相同帳號登入即可讀取。未登入時仍以
                    IndexedDB 保存本機資料。網站程式公開，私人資料不進 GitHub。
                  </p>
                  <dl>
                    <div>
                      <dt>目前紀錄</dt>
                      <dd>{entries.length} 筆</dd>
                    </div>
                    <div>
                      <dt>附件原始大小</dt>
                      <dd>
                        {(
                          entries.reduce(
                            (n, e) =>
                              n + e.attachments.reduce((s, a) => s + a.size, 0),
                            0,
                          ) /
                          1024 /
                          1024
                        ).toFixed(1)}{" "}
                        MB
                      </dd>
                    </div>
                    <div>
                      <dt>跨裝置同步</dt>
                      <dd>{userId ? "已啟用（同帳號）" : "請先登入"}</dd>
                    </div>
                    <div>
                      <dt>AI／報告自動讀取</dt>
                      <dd>尚未支援</dd>
                    </div>
                  </dl>
                  <div className="notice">
                    {userId
                      ? "已儲存的雲端紀錄可在清除瀏覽器資料後重新登入讀取；尚未儲存的編輯不會保留。共用裝置使用後請登出。"
                      : "本機紀錄可能因清除瀏覽器資料、更換瀏覽器或無痕模式而遺失；請先備份，或登入後明確上傳舊資料。"}
                  </div>
                </section>
                <section className="panel settings-panel">
                  <div className="entry-icon report">
                    <ArrowDownToLine size={23} />
                  </div>
                  <h3>備份與跨裝置移轉</h3>
                  <p>
                    可將目前本機或登入帳號的紀錄與附件匯出為完整 JSON
                    備份。檔案未加密，請存放在你信任的位置。登入後跨裝置不需手動移轉。
                  </p>
                  <button
                    className="button primary"
                    disabled={!ready}
                    onClick={exportData}
                  >
                    <ArrowDownToLine size={16} />
                    匯出完整備份
                  </button>
                  <hr />
                  <h4>匯入已有的備份</h4>
                  <p>
                    匯入前會驗證內容並顯示筆數。確認後會取代目前資料區（登入時為雲端帳號，未登入時為本機）的全部紀錄，不會自動合併。
                  </p>
                  <button
                    className="button secondary"
                    disabled={!ready || importing}
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={16} />
                    {importing ? "正在驗證…" : "選擇備份檔"}
                  </button>
                  <hr />
                  <h4>目前版本範圍</h4>
                  <p>
                    已提供療程、照片比較、膚況日誌、原始報告與手動指標摘要、保養紀錄、日程及備份。私人帳號、雲端同步、自動匯入、AI
                    分析與推播提醒留待後續版本。
                  </p>
                </section>
              </div>
            </>
          )}
          <footer className="site-footer">
            <span>肌序 Skin Journal</span>
            <span>
              慢慢記錄，好好照顧自己。
              <Leaf size={12} />
            </span>
          </footer>
        </div>
      </main>
      <input
        className="hidden"
        ref={importRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          importData(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {preview && (
        <PreviewDialog attachment={preview} onClose={() => setPreview(null)} />
      )}
      {editor && (
        <Editor
          key={editor.id}
          cloudMode={!!userId}
          initial={editor}
          entries={entries}
          onClose={() => setEditor(null)}
          onSave={saveEntry}
        />
      )}
      {detail && (
        <Modal title={detail.title} wide onClose={() => setDetail(null)}>
          <div className="detail-content">
            <div className="detail-meta">
              <span className={`tag ${detail.kind}`}>
                {labels[detail.kind]}
              </span>
              <span>{displayDate(detail.date, true)}</span>
              {detail.kind === "event" && (
                <span>
                  {detail.fields.time || "全天"} · 台北時間
                  {detail.fields.completed === "true" ? " · 已完成" : ""}
                </span>
              )}
            </div>
            {detail.treatmentId && (
              <p className="linked-treatment">
                關聯療程：
                {treatments.find((t) => t.id === detail.treatmentId)?.title}
              </p>
            )}
            <dl className="detail-fields">
              {Object.entries(detail.fields)
                .filter(
                  ([key, value]) =>
                    value && key !== "completed" && key !== "time",
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {(
                        {
                          area: "部位",
                          clinic: "診所",
                          doctor: "醫師",
                          cost: "費用（NT$）",
                          instructions: "已記錄醫囑／使用方式",
                          stage: "階段",
                          angle: "角度",
                          feeling: "主觀感受",
                          products: "使用產品",
                          source: "報告來源",
                          sourceUrl: "原始連結",
                          device: "儀器",
                          version: "版本",
                          period: "使用時段",
                          product: "產品",
                          type: "日程類型",
                          location: "地點",
                        } as Record<string, string>
                      )[key] || key}
                    </dt>
                    <dd>
                      {key === "sourceUrl" && safeUrl(value) ? (
                        <a
                          href={safeUrl(value)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          開啟原始報告
                          <ArrowUpRight size={13} />
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
            {detail.notes && (
              <div className="detail-notes">
                <h4>{detail.kind === "journal" ? "主觀觀察" : "你的備註"}</h4>
                <p>{detail.notes}</p>
              </div>
            )}
            {!!detail.attachments.length && (
              <div className="detail-attachments">
                <h4>原始附件（點選預覽）</h4>
                {detail.attachments.map((a) => (
                  <div key={a.id} className="detail-attachment">
                    <button
                      className="attachment-preview-button"
                      onClick={() => setPreview(a)}
                    >
                      {a.type.startsWith("image/") ? (
                        <img src={a.data} alt={a.name} />
                      ) : (
                        <>
                          <FileText size={20} />
                          線上預覽整份 PDF：{a.name}
                        </>
                      )}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        const comma = a.data.indexOf(",");
                        const binary = atob(a.data.slice(comma + 1));
                        const bytes = Uint8Array.from(binary, (c) =>
                          c.charCodeAt(0),
                        );
                        const url = URL.createObjectURL(
                          new Blob([bytes], { type: a.type }),
                        );
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = a.name;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 30000);
                      }}
                    >
                      <ArrowDownToLine size={15} />
                      {a.name}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {detail.kind === "report" && (
              <div className="report-summary">
                <div className="section-heading">
                  <h3>整理摘要</h3>
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        reportSummary(detail, entries),
                        `${detail.title.replace(/[\\/:*?"<>|]/g, "_")}-摘要.txt`,
                        "text/plain;charset=utf-8",
                      )
                    }
                  >
                    <ArrowDownToLine size={15} />
                    下載摘要
                  </button>
                </div>
                <pre>{reportSummary(detail, entries)}</pre>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="text-button danger"
              onClick={() => remove(detail)}
            >
              <Trash2 size={15} />
              刪除
            </button>
            <span className="footer-spacer" />
            {detail.kind === "event" && (
              <button
                className="button secondary"
                onClick={() => toggleEvent(detail)}
              >
                <CheckCheck size={16} />
                {detail.fields.completed === "true" ? "設為待追蹤" : "標記完成"}
              </button>
            )}
            <button
              className="button primary"
              onClick={() => {
                setEditor(detail);
                setDetail(null);
              }}
            >
              編輯紀錄
            </button>
          </div>
        </Modal>
      )}
      {pendingImport && (
        <Modal title="確認匯入備份" onClose={() => setPendingImport(null)}>
          <div className="detail-content">
            <div className="notice">
              這會取代目前全部 {entries.length}{" "}
              筆紀錄（登入時為雲端帳號資料），且無法復原。建議先匯出目前資料。
            </div>
            <h3>備份中有 {pendingImport.length} 筆紀錄</h3>
            <dl className="import-counts">
              {allKinds.map((k) => (
                <div key={k}>
                  <dt>{labels[k]}</dt>
                  <dd>{pendingImport.filter((e) => e.kind === k).length} 筆</dd>
                </div>
              ))}
            </dl>
            <button className="button secondary" onClick={exportData}>
              <ArrowDownToLine size={16} />
              先備份目前資料
            </button>
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={importing}
              onClick={() => setPendingImport(null)}
            >
              取消
            </button>
            <button
              className="button primary"
              disabled={importing}
              onClick={async () => {
                setImporting(true);
                try {
                  await commit(pendingImport);
                  setPendingImport(null);
                  setToast(
                    userId ? "備份已匯入雲端帳號" : "備份已匯入此瀏覽器",
                  );
                } catch (e) {
                  setToast((e as Error).message);
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "匯入中…" : "確認取代並匯入"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="關閉通知">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
