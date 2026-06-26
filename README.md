# 🌏 台灣地震預警 LINE 機器人

即時地震資訊推播系統，偵測到新地震後 30 秒內推送通知至 LINE。

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────┐
│              主動推播（自動） - 每 30 秒                  │
├─────────────────────────────────────────────────────────┤
│  cron-job.org → Cloud Function → CWA API → LINE 推播   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              被動查詢（用戶觸發）                         │
├─────────────────────────────────────────────────────────┤
│  用戶傳「地震」→ GAS Webhook → LINE 回覆                │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 檔案結構

```
earthquake-bot/
├── cloud_function/          # Google Cloud Function
│   ├── main.py             # 主程式
│   ├── requirements.txt    # Python 依賴
│   └── .gcloudignore
├── gas/                     # Google Apps Script
│   └── earthquake_bot.gs   # 備援+Webhook
├── web/                     # 好友加入網站
│   └── index.html
├── qrcode.png              # LINE QR Code
└── SETUP_GUIDE.md          # 設定指南
```

---

## 🚀 快速開始

### 前置需求

- Google Cloud 帳號（免費）
- LINE Developers 帳號
- 中央氣象署 API Key

### 步驟 1：部署 Cloud Function

```bash
# 安裝 Google Cloud SDK（如果還沒安裝）
# https://cloud.google.com/sdk/docs/install

# 登入 GCP
gcloud auth login

# 設定專案
gcloud config set project YOUR_PROJECT_ID

# 部署 Cloud Function
gcloud functions deploy earthquake-bot \
  --gen2 \
  --runtime=python310 \
  --region=asia-east1 \
  --source=cloud_function \
  --entry-point=check_earthquake \
  --trigger-http \
  --timeout=60s \
  --memory=256MB \
  --set-env-vars CWA_API_KEY=您的CWA_API_KEY,LINE_ACCESS_TOKEN=您的LINE_TOKEN,LINE_USER_IDS=您的USER_ID
```

### 步驟 2：設定 cron-job.org（免費觸發）

1. 前往 https://cron-job.org/ 註冊帳號
2. 建立新 Job：
   - **Schedule**：`*/30 * * * * *`（每 30 秒）
   - **URL**：Cloud Function 的觸發 URL
   - **Request Method**：POST
   - **Headers**：`Content-Type: application/json`

### 步驟 3：設定 GAS 備援

1. 前往 https://script.google.com/
2. 建立新專案，貼上 `gas/earthquake_bot.gs` 內容
3. 執行 `setupTrigger` 建立每 1 分鐘的備援觸發器

### 步驟 4：啟用 Webhook

1. 在 GAS 部署 Web App
2. 到 LINE Developers Console 設定 Webhook URL
3. 啟用 Webhook

---

## 💰 費用

**完全免費！**

| 服務 | 免費額度 | 預估使用 |
|------|---------|---------|
| Cloud Functions | 200 萬次/月 | ~8,640 次 |
| Firestore | 1 GB | < 10 MB |
| cron-job.org | 無限 | 1 個 Job |
| GAS | 無限 | 備用 |

---

## 📝 環境變數

| 變數名稱 | 說明 | 取得方式 |
|---------|------|---------|
| `CWA_API_KEY` | 中央氣象署 API Key | https://opendata.cwa.gov.tw/ |
| `LINE_ACCESS_TOKEN` | LINE Channel Access Token | LINE Developers Console |
| `LINE_USER_IDS` | LINE User ID（逗號分隔） | LINE Developers Console |

---

## 🔧 測試

### 測試 Cloud Function

```bash
# 本地測試
functions-framework --target=check_earthquake

# 或直接呼叫 Cloud Function URL
curl -X POST YOUR_CLOUD_FUNCTION_URL
```

### 測試 GAS

在 GAS 編輯器中執行：
- `sendTestMessage` - 發送測試訊息
- `testCheck` - 手動檢查地震

---

## 📚 相關資源

- [中央氣象署開放資料平台](https://opendata.cwa.gov.tw/)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [Google Cloud Functions](https://cloud.google.com/functions)
- [cron-job.org](https://cron-job.org/)

---

## 📄 授權

MIT License
