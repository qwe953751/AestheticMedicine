# 肌序 Skin Journal

個人醫美與肌膚管理日誌，支援手機與電腦。

**唯一正式網站：https://frank-aestheticmedicine.github.io/**

## 0.2 功能與使用方式

- 療程、照片、膚況日誌、檢測報告、保養步驟與日程的新增、查看、編輯、刪除與療程關聯。
- 照片選檔後即有縮圖及預覽按鈕，可點開大圖；保存後仍可預覽、下載及並排比較。新增照片紀錄必須至少附上一張圖片。
- PDF 報告可以在網站內閱讀全部頁面、捲動與縮放；支援密碼 PDF 的當次解鎖，密碼不保存。圖片型報告可放大檢視。沒有附件、連結或指標的空報告不能儲存。
- 報告詳細頁優先直接顯示 PDF／圖片原文；舊有 0 附件紀錄會明確提示缺少原檔，可在同一視窗「上傳原始報告並閱讀」，成功保存後立即開啟。無資料的空摘要不再顯示；有手動指標或備註時，摘要收合並標示非原文。
- 手動核對檢測指標、單位、量尺、儀器及版本，產生並下載摘要。PDF 預覽不等於 OCR 或 AI 分析，外部連結仍只保存來源。
- 私人雲端帳號：到「資料與設定」註冊、驗證信箱並登入；手機與電腦登入同一帳號即可讀取相同紀錄及附件。
- 登入後的保存直接寫入雲端，讀取失敗或網路中斷會提示，不會偷偷改存本機。開啟頁面、回到前景或每 30 秒檢查更新；編輯／檢視對話框開啟時暫停自動取代資料，避免覆蓋。
- 未登入仍可使用本機 IndexedDB。登入不會自動上傳或覆蓋舊資料；請在「資料與設定」點「將此瀏覽器舊資料加入雲端」。遇相同 ID 的不同版本會停止，需先備份確認。
- 全量 JSON 備份含附件。登入時匯入取代目前雲端帳號，未登入時取代本機；匯入前有確認，不會自動合併。
- 月曆、完成狀態、台北時間與 `.ics` 匯出；保養產品、醫囑與固定諮詢清單。

## 雲端與隱私

使用者同意在 Frank 組織建立獨立 Supabase「AestheticMedicine」專案，建立時報價每月 US$0，未變更既有 Investment 專案。免費方案仍有容量、流量與寄信限制；未開通付費 SMTP。

- 使用電子郵件及密碼登入，註冊保留信箱驗證。目前 Supabase 內建寄信服務僅寄至專案團隊授權信箱，一般對外註冊須先配置自訂 SMTP。正式驗證返回網址只設定 `https://frank-aestheticmedicine.github.io/`。
- `journal_states` 啟用 RLS，只允許本人讀寫；私人 Storage `journal-files` 同樣按帳號隔離。附件沒有永久公開網址，使用登入授權下載。
- 前端只有 publishable key，不含 service-role key、資料庫密碼或管理金鑰。個人紀錄不進 Git repository。
- 不同裝置的舊版本寫入以 revision 比對拒絕，提示重新載入；不靜默覆蓋。
- 本機資料與雲端帳號區分保存；登出清除記憶體中的雲端附件並返回本機資料。共用裝置請登出。備份檔未加密，請妥善保存。
- 移除雲端紀錄會移除資料表內的有效參照；已無參照或失敗上傳的私人檔案目前不自動回收，需後端維護清理，並非立即實體刪檔。這些檔案仍受私人存取規則保護。

## 限制

單檔上限 8 MiB，每筆最多 12 個附件，支援 JPG／PNG／WebP／PDF。最多 5,000 筆；本機驗證附件 data URL 總量上限 100 MiB，雲端紀錄 metadata 上限 2 MiB，實際容量另受方案配額限制。

AI 分析、EveLab 自動擷取、OCR、外部連結整份資料抓取、跨裝置離線編輯、自動草稿及推播通知尚未提供。不同儀器或量尺不直接推論趨勢／療程因果，療程適合性由醫師確認。

## 開發、測試及部署

建議 Node.js 22.16 以上的受支援 LTS，CI 使用 Node 22。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

開發網址 `http://127.0.0.1:5173/`，Vite base 為 `/`。正式版只允許指定 HTTPS 根目錄、無 query、直接開啟；其他 host、路徑、query、iframe 皆空白。開發模式可使用 localhost。

推送來源 `main` 後，GitHub Actions 跑測試與 build，再以既有專用 deploy key，透過 `scripts/publish-pages.sh` 將 `dist/` 發佈到 `frank-AestheticMedicine/frank-aestheticmedicine.github.io` 的 `gh-pages`。舊來源站與 AestheticMedicine-view 都保持完全空白，沒有 iframe、轉址或備份移轉入口。

`supabase/migrations/` 保存已套用的四份 schema／policy／RPC migration，不可修改已套用歷史。資料庫隔離驗證見 `tests/sql/cloud-rls.sql`，使用合成使用者並 rollback；`scripts/verify-cloud-live.mjs` 只供專用合成帳號的實際連線驗證，憑證須透過隱藏 stdin 提供，不能寫入檔案或 CI log。

## 文件

- [功能規格與驗收](docs/SPEC.md)
- [目前架構與資料格式](docs/ARCHITECTURE.md)
- [0.2 Session 交接](docs/SESSION-2026-11-09.md)
- [前次交接與網址歷史](docs/SESSION-2026-11-08.md)
- [版本紀錄](CHANGELOG.md)
