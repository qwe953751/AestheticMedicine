# 架構與資料格式（0.2）

## 網站與顯示邊界

React／TypeScript／Vite 靜態產出由組織 GitHub Pages 提供。唯一正式網址為 `https://frank-aestheticmedicine.github.io/`，base 與 favicon 使用根目錄。`site-access.ts` 限制正式版只在該 HTTPS 根路徑、無 query 且非 iframe 時載入 App；舊來源與 view 入口、404 皆為無腳本的空白頁。Supabase 驗證回傳使用根網址及 implicit hash，無需 query 頁面例外。

## 資料分區

- 未登入：`storage.ts` 使用 IndexedDB `skin-journal-v1` → `journal` → key `data`。完整 `{revision,entries}` 含附件 data URL，與前版備份相容。
- 已登入：`cloud.ts` 讀寫獨立 Supabase AestheticMedicine 專案 `jazinwkendlnctjnmwuf`。資料表 `public.journal_states` 每位使用者一列，primary key `user_id`、revision、entries JSONB、updated_at。
- 雲端 JSON 只含紀錄 metadata，附件使用 `{id,name,type,size,path}`；原始位元組位於私人 `journal-files` bucket，路徑為 `<auth.uid()>/<SHA-256>`。載入以使用者 JWT 下載，校驗 hash 後還原 data URL，供現有 UI 與完整備份使用。
- 雲端附件只在記憶體快取；不將雲端資料灌進未登入的本機 IndexedDB。登出清除記憶體快取。
- 登入不自動合併本機資料；使用者按明確上傳按鈕後，`merge.ts` 合併未重複的紀錄，重複 ID 不同內容則拒絕，完整資料再做一次驗證。

## 認證與授權

Supabase email/password 登入，保留信箱驗證。前端 publishable key 可公開，絕不使用 service role。Auth 的 Site URL 與 redirect allowlist 只有正式根網址。未開通自訂 SMTP；內建寄信服務有團隊信箱及寄送速率限制。

RLS 使用 `(select auth.uid()) = user_id`，資料表授權只有 authenticated 的 select／insert／update；沒有 anon 權限。Storage select／insert／delete policies 同時檢查 bucket 與使用者路徑；bucket 非公開，附件不產生永久公開連結。檔案不可覆寫，變更內容取得新 hash。

`save_journal(expected_revision,new_entries)` 為 security invoker，固定空 search_path，確認 uid 後以單次 insert 或 conditional update 比對 revision，版本不一致回 `PT409`／HTTP 409。沒有 security definer 或 user_metadata 授權。SQL metadata 限 2 MiB、5,000 筆；原始附件 8 MiB MIME 白名單在 bucket 限制。

移除紀錄不立即回收已無參照的私人物件，以免並行裝置／失敗保存誤刪共用 hash。後端垃圾回收仍待實作；資料表不再引用的檔案仍私人，不能聲稱立即實體刪除。

## 同步與錯誤

App 於登入帳號切換時清空畫面資料並讀取對應區。讀取或上傳失敗保留錯誤，不退回本機。保存成功才更新畫面；寫入前以 auth.getUser 驗證目前帳號，並在回應後檢查帳號沒有切換。

開啟頁面、前景 focus／visibility、每 30 秒讀取更新；有編輯／檢視／備份確認視窗或正在儲存時不自動取代。revision 只接受較新版本。RPC 拒絕跨裝置舊寫入；本機 IndexedDB transaction 也檢查 revision。BroadcastChannel 僅作同瀏覽器提示，不是跨裝置同步來源。

## 預覽

`AttachmentPreview.tsx` 使用 PDF.js 與同站 worker；只有開啟 PDF 才 lazy load。顯示文件全部頁面，canvas 按可見區載入、離開後釋放，支援縮放、密碼解鎖（僅當次）及讀取錯誤。照片預覽直接顯示原圖。預覽 dialog 可疊於編輯視窗，關閉後保留表單。

選檔成功顯示附件縮圖／預覽按鈕；讀取期間禁止保存。照片不可空附件，報告至少有附件、來源連結或手動指標。單檔仍驗證 MIME、檔頭、大小；React 文字渲染不使用 raw HTML。PDF 不是 iframe，沒有開放嵌入網站的例外，也不執行 PDF 內的 JavaScript。

## 備份格式

```ts
type Entry = {
  id: string; kind: 'treatment'|'photo'|'journal'|'report'|'routine'|'event';
  title: string; date: string; notes: string; treatmentId: string;
  fields: Record<string,string>;
  attachments: {id:string;name:string;type:string;size:number;data:string}[];
  metrics: {name:string;value:string;unit:string;scale:string}[];
  createdAt:string; updatedAt:string;
};
// exported envelope: {app:'skin-journal',version:1,exportedAt,entries}
```

匯出前畫面資料已還原附件，所以完整 JSON 在本機與雲端皆可還原。登入時匯入取代當前帳號，未登入時取代本機；須確認、先通過格式／關聯／附件驗證，再單次保存，不會自動合併。

## 驗證與部署

`npm test`：模型、本機 transaction、入口限制、雲端傳輸／hash／衝突／合併單元測試。`tests/sql/cloud-rls.sql` 在新專案確認真實授權並 rollback；`verify-cloud-live.mjs` 使用獨立合成登入連線驗證私檔 round trip、跨帳號與匿名拒絕，完成後清理檔案、登出並移除測試使用者。

資料庫 migrations 以 Supabase MCP 已實際套用；Pages CI 僅發佈前端，不會自動對任意資料庫套 migration。未變更 Investment 資料庫。所有機密、私人照片及測試密碼都不進 Git。
