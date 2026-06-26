# 台灣地震速報系統 - 完整設定指南

## 目錄
1. [申請中央氣象署 API](#1-申請中央氣象署-api)
2. [申請 LINE Messaging API](#2-申請-line-messaging-api)
3. [建立 Google 試算表](#3-建立-google-試算表)
4. [設定 Google Apps Script](#4-設定-google-apps-script)
5. [部署網站](#5-部署網站)

---

## 1. 申請中央氣象署 API

### 步驟
1. 前往 https://opendata.cwa.gov.tw/
2. 點選右上角「登入/註冊」
3. 點選「氣象會員登入」→「加入會員」
4. 填寫註冊資料並完成驗證
5. 登入後，點選右上角「API 授權碼」
6. 點選「取得授權碼」
7. **複製授權碼**（這就是您的 `CWA_API_KEY`）

### 設定權限
1. 登入後點選「會員專區」→「API 授權碼」
2. 確認權限包含「地震海嘯」類別
3. 如果沒有，點選「編輯」加入權限

---

## 2. 申請 LINE Messaging API

### 步驟
1. 前往 https://developers.line.biz/console/
2. 使用 LINE 帳號登入
3. 點選「Create a new provider」建立供應商
4. 點選「Create a new channel」建立頻道
5. 選擇「Messaging API」
6. 填寫以下資訊：
   - Channel name: 台灣地震速報
   - Channel description: 即時地震資訊推播
   - Category: Information
   - Subcategory: News
7. 同意條款並建立

### 取得 Token
1. 進入剛建立的 Channel
2. 點選上方「Messaging API」分頁
3. 點選底部「Channel access token」區塊的「Issue」
4. **複製 Token**（這就是您的 `LINE_ACCESS_TOKEN`）

### 取得 User ID
1. 使用 LINE 掃描頁面上的 QR Code 加入機器人好友
2. 傳送任意訊息給機器人
3. 前往 https://developers.line.biz/console/
4. 進入您的 Channel →「Metrics」→「API usage」
5. 點選「Webhooks」→「Delivery status」
6. 在請求內容中找到您的 User ID（格式：Uxxxxxxxxxx）
7. **複製 User ID**（這就是您的 `LINE_USER_IDS`）

### 設定 Webhook（可選）
1. 在「Messaging API」分頁找到「Webhook settings」
2. 輸入您的 Webhook URL（部署後取得）
3. 點選「Verify」確認
4. 啟用「Use webhook」

---

## 3. 建立 Google 試算表

### 步驟
1. 前往 https://sheets.google.com/
2. 點選「+ 建立」建立新試算表
3. 將標題命名為「地震速報系統資料庫」
4. 記下網址中的試算表 ID
   - 範例：`https://docs.google.com/spreadsheets/d/`**`1ABC123...`**`/edit`
   - 複製粗體部分的 ID

### 設定試算表
1. 點選右上角「共用」
2. 將「一般存取權」改為「知道連結的人」
3. 欁限設為「檢視者」
4. 點選「完成」

---

## 4. 設定 Google Apps Script

### 建立專案
1. 前往 https://script.google.com/
2. 點選左上角「+ 新專案」
3. 將標題命名為「台灣地震速報系統」

### 貼上程式碼
1. 刪除預設程式碼
2. 將 `earthquake_bot.gs` 的完整內容貼上
3. 儲存專案（Ctrl + S）

### 填入設定值
找到程式碼頂部的設定區，替換以下值：

```javascript
// 中央氣象署 API 授權碼
const CWA_API_KEY = '您的CWA_API_KEY';

// LINE Channel Access Token
const LINE_ACCESS_TOKEN = '您的LINE_ACCESS_TOKEN';

// LINE 推播對象 User ID（多個用逗號分隔）
const LINE_USER_IDS = 'Uxxxxxxxxxx,Uyyyyyyyyyy';

// Google 試算表 ID
const SPREADSHEET_ID = '您的試算表ID';
```

### 授權與測試
1. 點選上方工具列的「執行」按鈕
2. 選擇 `testCheck` 函式
3. 點選「執行」
4. 首次執行會要求授權：
   - 點選「審查權限」
   - 選擇您的 Google 帳號
   - 點選「進階」→「前往「台灣地震速報系統」（不安全）」
   - 點選「允許」
5. 檢查執行記錄是否有錯誤

### 建立定時觸發器
1. 選擇 `setupTrigger` 函式
2. 點選「執行」
3. 確認執行記錄顯示「時間觸發器已建立」
4. 系統將每 2 分鐘自動檢查一次地震

### 查看記錄
- 執行 `viewRecords` 可查看試算表中的地震記錄
- 執行 `clearRecords` 可清除所有記錄（謹慎使用）

---

## 5. 部署網站

### 方法一：GitHub Pages（免費）

1. 建立 GitHub 帳號（https://github.com）
2. 建立新儲存庫，名稱為 `earthquake-bot`
3. 上傳 `index.html` 到儲存庫
4. 進入儲存庫 →「Settings」→「Pages」
5. Source 選擇「Deploy from a branch」
6. Branch 選擇「main」，資料夾選「/ (root)」
7. 點選「Save」
8. 網站將部署至 `https://您的用戶名.github.io/earthquake-bot/`

### 方法二：Netlify（免費）

1. 前往 https://www.netlify.com/
2. 註冊並登入
3. 點選「Add new site」→「Deploy manually」
4. 將 `index.html` 拖曳上傳
5. 點選「Deploy site」
6. 取得網站網址

### 方法三：Google Sites

1. 前往 https://sites.google.com/
2. 點選「空白」建立新網站
3. 將 `index.html` 的內容嵌入
4. 點選「發布」取得網址

### 修改網站設定

在 `index.html` 中找到以下行並替換：

```html
<!-- 替換為您的 LINE 官方帳號 ID -->
<a href="https://line.me/R/ti/p/@您的LINE_ID" class="line-badge" target="_blank">

<!-- 替換為您的 QR Code 圖片網址 -->
<img src="您的QR_CODE圖片網址" alt="LINE QR Code">
```

### 取得 QR Code
1. 進入 LINE Developers Console
2. 進入您的 Channel
3. 點選「Messaging API」分頁
4. 找到「QR code」區塊
5. 點選「Download」下載 QR Code 圖片
6. 上傳至圖片托管服務（如 Imgur）取得網址

---

## 常見問題

### Q: 執行時出現「授權碼無效」
A: 請確認 CWA API Key 是否正確，且權限包含「地震海嘯」

### Q: LINE 推播失敗
A: 請確認：
1. LINE_ACCESS_TOKEN 是否正確
2. LINE_USER_IDS 是否正確（格式：Uxxxxxxxxxx）
3. 機器人是否已加入好友

### Q: 試算表無法寫入
A: 請確認：
1. SPREADSHEET_ID 是否正確
2. 試算表已開啟共用
3. 已授予 GAS 存取權限

### Q: 網站無法顯示 QR Code
A: 請確認圖片網址正確，且為 HTTPS 連結

---

## 聯絡方式

如有問題，請至 GitHub Issues 回報：
https://github.com/您的用戶名/earthquake-bot/issues
