# Cloud Function 部署指南

## 前置準備

### 1. 安裝 Google Cloud SDK

前往 https://cloud.google.com/sdk/docs/install 下載並安裝。

### 2. 登入 GCP

```bash
gcloud auth login
```

### 3. 設定專案

```bash
gcloud config set project YOUR_PROJECT_ID
```

---

## 部署步驟

### 步驟 1：啟用必要 API

前往 GCP Console 啟用：
- Cloud Functions API
- Firestore API
- Cloud Build API

### 步驟 2：部署 Cloud Function

```bash
gcloud functions deploy earthquake-bot ^
  --gen2 ^
  --runtime=python310 ^
  --region=asia-east1 ^
  --source=cloud_function ^
  --entry-point=check_earthquake ^
  --trigger-http ^
  --timeout=60s ^
  --memory=256MB ^
  --set-env-vars CWA_API_KEY=CWA-6C434703-95D0-4AB8-B822-42F8C6E37156,LINE_ACCESS_TOKEN=YjXCDwD2hSWcMhbwnDVFyHpV/mV3viKmJtKubK4alHh0f7tJAcYo2LkoyEyyaiOmThhwko0AtQuM1qMONNswRK+QEQ97eS6cYel2uprpuKwmKMt0G6hN6O5TCfy/LNE4gwc5CHhxfSuf5+0ka08EwgdB04t89/1O/w1cDnyilFU=,LINE_USER_IDS=U6d9a50db673a7a7165a9b0840cae08a0
```

### 步驟 3：取得觸發 URL

部署完成後，執行以下指令取得 URL：

```bash
gcloud functions describe earthquake-bot --gen2 --region=asia-east1 --format="value(serviceConfig.uri)"
```

### 步驟 4：設定 cron-job.org

1. 前往 https://cron-job.org/ 註冊
2. 建立新 Job：
   - **Schedule**：`*/30 * * * * *`
   - **URL**：貼上 Cloud Function URL
   - **Request Method**：POST
   - **Headers**：`Content-Type: application/json`

---

## 常見問題

### Q: 部署失敗怎麼辦？

A: 檢查以下幾點：
1. 確認已啟用所有必要 API
2. 確認 gcloud 已登入正確帳號
3. 確認專案 ID 正確

### Q: 如何查看執行記錄？

A: 前往 GCP Console → Cloud Functions → earthquake-bot → Logs

### Q: 如何更新程式碼？

A: 修改 `cloud_function/main.py` 後，重新執行部署指令即可。
