import { lazy, Suspense, useRef, useState, type FormEvent } from "react";
import { FileText, Upload, Maximize2 } from "lucide-react";
import { readAttachment, safeUrl, type Attachment, type Entry } from "./model";
const PdfPreview = lazy(() => import("./AttachmentPreview"));
export default function ReportReader({
  entry,
  onAttach,
  onEnlarge,
}: {
  entry: Entry;
  onAttach: (attachments: Attachment[]) => Promise<void>;
  onEnlarge: (attachment: Attachment) => void;
}) {
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const active =
    entry.attachments.find((a) => a.id === selected) || entry.attachments[0];
  const pick = async (event: FormEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (entry.attachments.length + files.length > 12)
        throw new Error("每筆報告最多 12 個附件。");
      const attachments: Attachment[] = [];
      for (const file of files) attachments.push(await readAttachment(file));
      await onAttach(attachments);
      setSelected(attachments[0].id);
    } catch (e) {
      setError(`原始報告尚未儲存：${(e as Error).message}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="report-reader" aria-label="原始報告閱讀區">
      <div className="section-heading">
        <h3>
          <FileText size={18} />
          原始報告
        </h3>
        <span className="tag">{entry.attachments.length} 個附件</span>
      </div>
      {!active && (
        <div className="report-missing">
          <h3>尚未上傳原始報告，這筆紀錄目前無法閱讀全文</h3>
          <p>
            目前只有紀錄資料，沒有 PDF
            或報告圖片。請在這裡選擇原始檔；成功儲存後會直接顯示內容。
          </p>
          {entry.fields.sourceUrl && safeUrl(entry.fields.sourceUrl) && (
            <a
              href={safeUrl(entry.fields.sourceUrl)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              開啟已保存的原始連結
            </a>
          )}
        </div>
      )}
      <label className="report-upload button primary">
        <Upload size={16} />
        {busy
          ? "正在儲存原始報告…"
          : active
            ? "加入其他原始報告"
            : "上傳原始報告並閱讀"}
        <input
          aria-label="上傳原始報告"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={busy}
          onInput={pick}
          onChange={pick}
        />
      </label>
      <p className="small-text muted">
        PDF、JPG、PNG、WebP；每檔上限 50 MB。選擇檔案後會儲存到目前資料區。
      </p>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {active && (
        <>
          <div className="report-reader-controls">
            {entry.attachments.length > 1 ? (
              <label>
                選擇原始報告
                <select
                  value={active.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {entry.attachments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <strong>{active.name}</strong>
            )}
            <button
              className="button secondary"
              onClick={() => onEnlarge(active)}
            >
              <Maximize2 size={16} />
              放大閱讀
            </button>
          </div>
          <div className="report-reader-document">
            {active.type === "application/pdf" ? (
              <Suspense fallback={<p role="status">正在開啟原始報告全文…</p>}>
                <PdfPreview key={active.id} attachment={active} />
              </Suspense>
            ) : (
              <img src={active.data} alt={`原始報告：${active.name}`} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
