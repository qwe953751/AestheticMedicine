# 肌序 Skin Journal

個人醫美與肌膚管理日誌，支援手機與電腦的響應式網站。

**網站：https://frank-aestheticmedicine.github.io/**

## 第一版功能

- 療程：日期、部位、診所、醫師、費用、醫囑與原始附件。
- 膚況日誌：主觀感受、當日產品、文字與照片。
- 照片追蹤：術前／術後／恢復期、角度、關聯療程、任選兩張並排比較與距療程天數。
- 檢測報告：保存外部連結、PDF、截圖；手動核對指標、單位、量尺、儀器與版本，產生並下載文字摘要。
- 保養與諮詢：產品與早晚步驟、已記錄的醫囑、固定的下次諮詢清單。
- 行事曆：月曆、療程／回診／拍照／檢測／諮詢日程、完成狀態、台北時間與 `.ics` 匯出。
- 所有紀錄均可新增、查看、編輯、刪除；療程刪除後保留子紀錄並解除關聯。
- JSON 完整備份與匯入，含附件；匯入前預覽筆數並確認取代。

## 資料保存與限制

此版沿用既有 **GitHub Pages 靜態網站**。沒有後端或帳號登入，資料與附件儲存在目前瀏覽器的 **IndexedDB**，不會送到 GitHub，也不會自動同步到其他裝置。網站本身與程式碼是公開的；本機紀錄並非以密碼或應用層加密保護。

請定期到「資料與設定」匯出備份。更換瀏覽器、清除網站資料或結束無痕模式可能失去紀錄；本機與正式站屬不同來源，各自保存資料。備份是包含私人資料與附件的未加密 JSON，請妥善保存。跨裝置移轉需手動匯出、傳送及匯入；匯入會取代目的端全部資料，不會合併。

- 單檔最多 8 MiB；每筆最多 12 個附件；支援 JPG、PNG、WebP、PDF。照片紀錄只接受圖片。
- 最多 5,000 筆紀錄；附件 data URL 的總字元量限制為 100 MiB，實際儲存另受瀏覽器配額影響。
- 儲存錯誤會保留編輯視窗；多分頁舊版本寫入會拒絕覆蓋並提示載入最新資料。
- 草稿僅存在尚未關閉的表單，未儲存離開會提示；沒有自動草稿或跨裝置續編。
- **EveLab 自動匯入、PDF／截圖文字辨識、AI 照片與文字分析、個人化療程建議、推播提醒、雙向日曆同步尚未實作。**
- 摘要只是整理手動填寫資料，不代表已讀取來源。不同儀器、版本、量尺不直接推論趨勢或因果。療程適合性、間隔與保養調整由醫師確認。
- 不要把私人照片、檢測報告、報告密碼、備份或個人連結提交到公開 repository。

## 開發

建議 Node.js 22.16 以上（CI 使用 Node 22），npm。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

開發路徑為 `http://127.0.0.1:5173/`。正式輸出在 `dist/`；Vite 的 `base` 為 `/`，網站直接發佈在專用網域根目錄。

技術：React 19、TypeScript、Vite、Lucide、IndexedDB、Vitest。無外部 API、分析追蹤或遠端字型依賴。

## 發佈

推送來源 repository 的 `main` 後，`.github/workflows/deploy.yml` 自動安裝依賴、執行測試及編譯，再使用既有專用 deploy key，透過 `scripts/publish-pages.sh` 將 `dist/` 發佈到 `frank-AestheticMedicine/frank-aestheticmedicine.github.io` 的 `gh-pages`。該組織網站使用 GitHub Pages 分支建置；CI 不再部署到來源帳號的 Pages。部署 commit 使用 GitHub Actions bot 身分，不把個人帳號寫入網站資產或網站 Git 作者。

唯一允許顯示網站的正式網址是 `https://frank-aestheticmedicine.github.io/`。正式版僅在此 HTTPS 根目錄、沒有 query 且直接開啟時載入應用程式；其他來源、路徑或 iframe 皆為空白。開發模式仍可於 localhost 操作。舊來源入口與 AestheticMedicine-view 入口皆為完全空白頁，沒有轉址、iframe 或備份移轉功能；404 頁面亦為空白。此變更不刪除瀏覽器既有 IndexedDB 資料。

在 [GitHub Actions](https://github.com/qwe953751/AestheticMedicine/actions) 確認部署成功後開啟正式網址。程式更新不會自動清除 IndexedDB；更改資料格式前需設計遷移並保留備份相容性。

## 文件

- [第一版規格與驗收](docs/SPEC.md)
- [架構與資料格式](docs/ARCHITECTURE.md)
- [本次實作交接](docs/SESSION-2026-11-08.md)
- [版本紀錄](CHANGELOG.md)
