import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Attachment } from "./model";
GlobalWorkerOptions.workerSrc = workerUrl;
function Page({
  document,
  number,
  zoom,
}: {
  document: PDFDocumentProxy;
  number: number;
  zoom: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([value]) =>
      setWidth(value.contentRect.width),
    );
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "500px" },
    );
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    const c = canvas.current!;
    const draw = async () => {
      try {
        const page = await document.getPage(number);
        if (cancelled) return;
        const natural = page.getViewport({ scale: 1 });
        const renderWidth = Math.max(240, width) * zoom;
        const viewport = page.getViewport({
          scale: renderWidth / natural.width,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.floor(viewport.width * ratio);
        c.height = Math.floor(viewport.height * ratio);
        c.style.width = `${viewport.width}px`;
        c.style.height = `${viewport.height}px`;
        render = page.render({
          canvas: c,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await render.promise;
      } catch (e) {
        if (!cancelled)
          setError(`第 ${number} 頁無法顯示：${(e as Error).message}`);
      }
    };
    void draw();
    return () => {
      cancelled = true;
      render?.cancel();
      c.width = 1;
      c.height = 1;
    };
  }, [document, number, zoom, visible, width]);
  return (
    <div ref={host} className="pdf-page">
      <span>第 {number} 頁</span>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <canvas ref={canvas} aria-label={`報告第 ${number} 頁`} />
      )}
    </div>
  );
}
export default function AttachmentPreview({
  attachment,
}: {
  attachment: Attachment;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [challenge, setChallenge] = useState<{
    submit: (password: string) => void;
  } | null>(null);
  const [password, setPassword] = useState("");
  useEffect(() => {
    if (attachment.type !== "application/pdf") return;
    let live = true;
    const binary = atob(attachment.data.split(",")[1]);
    const raw = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) raw[i] = binary.charCodeAt(i);
    const task = getDocument({
      data: raw,
      cMapUrl: new URL("/pdfjs/cmaps/", window.location.origin).href,
      cMapPacked: true,
      standardFontDataUrl: new URL(
        "/pdfjs/standard_fonts/",
        window.location.origin,
      ).href,
      wasmUrl: new URL("/pdfjs/wasm/", window.location.origin).href,
    });
    task.onPassword = (submit: (password: string) => void) => {
      if (live) setChallenge({ submit });
    };
    task.promise
      .then((value) => {
        if (live) {
          setPdf(value);
          setChallenge(null);
        }
      })
      .catch((e) => {
        if (live) setError(`無法預覽這份 PDF：${e.message}`);
      });
    return () => {
      live = false;
      void task.destroy();
    };
  }, [attachment]);
  if (attachment.type.startsWith("image/"))
    return (
      <div className="image-preview">
        <img src={attachment.data} alt={attachment.name} />
      </div>
    );
  return (
    <div className="pdf-preview">
      {challenge && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            challenge.submit(password);
            setPassword("");
            setChallenge(null);
          }}
        >
          <label>
            這份 PDF 需要密碼
            <input
              type="password"
              autoComplete="off"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary">解鎖預覽</button>
          <p>密碼僅用於這次預覽，不會保存。</p>
        </form>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {!pdf && !error && !challenge && <p role="status">正在載入完整報告…</p>}
      {pdf && (
        <>
          <div className="pdf-toolbar">
            <span>完整 PDF · 共 {pdf.numPages} 頁</span>
            <label>
              縮放
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>符合寬度</option>
                <option value={1.5}>150%</option>
                <option value={2}>200%</option>
              </select>
            </label>
          </div>
          <div className="pdf-pages">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <Page document={pdf} number={i + 1} zoom={zoom} key={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
