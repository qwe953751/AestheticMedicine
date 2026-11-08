# 架構與資料格式

## 執行架構

GitHub Pages 提供 Vite 編譯的靜態資產，React 在瀏覽器執行，IndexedDB 保存資料。無後端、無密鑰、無遠端分析。頁面透過 React 狀態切換，無需 SPA 伺服器重寫規則。

- `src/App.tsx`：頁面、共用對話框、編輯表單、資料操作與備份流程。
- `src/model.ts`：型別、驗證、日期、ICS、報告摘要、附件讀取及備份解析。
- `src/storage.ts`：IndexedDB 讀寫與樂觀版本鎖。
- `src/styles.css`：響應式版面、焦點、表單、對話框與減少動態偏好。
- `tests/`：資料與持久化測試。

## 資料庫

資料庫：`skin-journal-v1`，版本 1。Object store：`journal`，key：`data`。

```ts
type Dataset = { revision: number; entries: Entry[] };
type Entry = {
  id: string;
  kind: 'treatment' | 'photo' | 'journal' | 'report' | 'routine' | 'event';
  title: string;
  date: string; // YYYY-MM-DD，台北行事曆日期
  notes: string;
  treatmentId: string; // 空字串或同份資料中的療程 ID
  fields: Record<string, string>;
  attachments: Attachment[];
  metrics: Metric[];
  createdAt: string; // ISO timestamp
  updatedAt: string;
};
type Attachment = { id: string; name: string; type: string; size: number; data: string };
type Metric = { name: string; value: string; unit: string; scale: string };
```

`fields` 依類別限制允許欄位：

| 類別 | 欄位 |
| --- | --- |
| treatment | area, clinic, doctor, cost, instructions |
| photo | stage, angle |
| journal | feeling, products |
| report | source, sourceUrl, device, version |
| routine | period, product, instructions |
| event | type, time, location, completed |

附件採 data URL，是為了讓第一版備份自足；有 base64 額外容量與全量複製成本，並非未來大量照片的雲端儲存方案。附件只檢查基本檔頭，不代表完整病毒掃描。個人資料不進 Git。

寫入先驗證完整 dataset，再於同一個 IndexedDB readwrite transaction 比較 revision、寫入 revision + 1；不一致會 abort。BroadcastChannel 通知其他分頁顯示重新載入提示，不會強制覆蓋正在編輯的內容。沒有 BroadcastChannel 的瀏覽器仍以 transaction revision 防止舊寫入。

## 備份合約

```json
{"app":"skin-journal","version":1,"exportedAt":"ISO timestamp","entries":[]}
```

匯入先驗證所有紀錄、附件與關聯，再經使用者在網站確認後取代，使用目前裝置的新 revision，不採用備份中的 revision。匯入沒有遠端副作用。未知備份版本不嘗試猜測。後續資料格式升版須保留明確遷移策略。

## 安全與功能邊界

- 網站公開不等於紀錄公開，但這一版也沒有使用者登入或應用層加密。共用裝置、瀏覽器資料清除及手動備份需由使用者管理。
- React 以文字渲染輸入，不使用 `dangerouslySetInnerHTML`；連結只接受無帳密的 HTTP(S)，另開分頁帶 `noopener noreferrer`。
- PDF 只保存及下載，不在頁面執行。圖片只接受 JPEG／PNG／WebP。
- 不包含交接文件的真實報告 URL、密碼、檢測結果或任何私人照片。
- 摘要為確定性文字排版，不呼叫模型、不分析圖片、不自動抓取 URL。
- 無 Service Worker／離線快取承諾、無通知服務、無外部雲端帳號。

## 部署

來源 `main` → GitHub Actions → npm ci → test → TypeScript/Vite build → `scripts/publish-pages.sh` → 專用組織網站 `gh-pages` → GitHub Pages 分支建置。部署目標固定為 `frank-AestheticMedicine/frank-aestheticmedicine.github.io`。使用既有 `FRANK_AESTHETICMEDICINE_DEPLOY_KEY`；GitHub SSH 主機金鑰固定驗證，不以個人 token 退回部署。GITHUB_TOKEN 只有 contents:read，checkout 不保留憑證；發佈 commit 作者為 Actions bot。

唯一正式網址為 `https://frank-aestheticmedicine.github.io/`，Vite base 與 favicon 使用根目錄 `/`。網站升版不應更改 IndexedDB 名稱。`src/site-access.ts` 限制正式版只能在指定 HTTPS 根目錄、無 query 且非 iframe 時載入 App 與樣式；不符合時清空 body 與標題。`legacy/index.html`、`legacy/404.html` 及正式站 `public/404.html` 為無文字、腳本、連結、iframe 或轉址的空白 HTML。舊來源入口及 AestheticMedicine-view 入口均發佈同樣空白頁，不再提供備份入口。
