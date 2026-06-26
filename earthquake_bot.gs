// =================================================================
//  台灣地震預警 LINE 機器人 - Google Apps Script
//  功能：串接中央氣象署 API，即時推送地震通知至 LINE
//  資料庫：Google 試算表（避免重複發送）
// =================================================================

// ===================== 設定區 =====================
// 請將以下資訊替換為你自己的值

// 中央氣象署 API 授權碼（至 https://opendata.cwa.gov.tw/ 申請）
const CWA_API_KEY = 'CWA-6C434703-95D0-4AB8-B822-42F8C6E37156';

// LINE Channel Access Token（至 LINE Developers Console 取得）
const LINE_ACCESS_TOKEN = 'YjXCDwD2hSWcMhbwnDVFyHpV/mV3viKmJtKubK4alHh0f7tJAcYo2LkoyEyyaiOmThhwko0AtQuM1qMONNswRK+QEQ97eS6cYel2uprpuKwmKMt0G6hN6O5TCfy/LNE4gwc5CHhxfSuf5+0ka08EwgdB04t89/1O/w1cDnyilFU=';

// LINE 推播對象 User ID（可設定多個，用逗號分隔）
const LINE_USER_IDS = 'U6d9a50db673a7a7165a9b0840cae08a0';

// Google 試算表 ID（用於記錄已發送的地震，避免重複）
const SPREADSHEET_ID = '1i5eSFJErJjh2dPsK6SvHFDQYOX8hgLDOdKjHsfUkNOM';

// 地震貼圖設定
const STICKER_PACKAGE_ID = '446';
const STICKER_ID = '1988';

// ===================== 主程式 =====================

/**
 * 主觸發函式 - 由時間觸發器自動執行
 * 每 1 分鐘自動檢查一次地震
 */
function checkEarthquake() {
  try {
    // 1. 取得最新地震資料
    const earthquakeData = getLatestEarthquake();
    
    if (!earthquakeData) {
      Logger.log('無法取得地震資料');
      return;
    }
    
    // 2. 檢查是否為新地震（與試算表比對）
    if (isNewEarthquake(earthquakeData.id)) {
      // 3. 格式化訊息並推播
      const message = formatEarthquakeMessage(earthquakeData);
      pushToAllUsers(message);
      
      // 4. 記錄到試算表
      recordEarthquake(earthquakeData);
      
      Logger.log('新地震通知已發送：' + earthquakeData.id);
    } else {
      Logger.log('地震已通知過：' + earthquakeData.id);
    }
    
  } catch (error) {
    Logger.log('執行錯誤：' + error.toString());
  }
}

/**
 * 從中央氣象署取得最新地震資料
 * @return {Object|null} 地震資料物件
 */
function getLatestEarthquake() {
  // 顯著有感地震報告 API
  const url = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001';
  
  const params = {
    'Authorization': CWA_API_KEY,
    'format': 'JSON'
  };
  
  const options = {
    'method': 'GET',
    'headers': {
      'Accept': 'application/json'
    },
    'muteHttpExceptions': true
  };
  
  // 組合查詢參數
  const queryString = Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&');
  const fullUrl = url + '?' + queryString;
  
  const response = UrlFetchApp.fetch(fullUrl, options);
  const data = JSON.parse(response.getContentText());
  
  if (data.success !== 'true' || !data.records || !data.records.Earthquake) {
    return null;
  }
  
  // 取得最新的地震（陣列第一筆）
  const earthquakes = data.records.Earthquake;
  if (earthquakes.length === 0) {
    return null;
  }
  
  const latest = earthquakes[0];
  
  // 解析地震資訊（加入安全檢查）
  const earthquakeInfo = {
    id: latest.EarthquakeNo || '未知',
    time: (latest.EarthquakeTime && latest.EarthquakeTime.DateTime) ? latest.EarthquakeTime.DateTime : new Date().toISOString(),
    location: (latest.Epicenter && latest.Epicenter.Location) ? latest.Epicenter.Location : '未知',
    magnitude: (latest.Magnitude && latest.Magnitude.MagnitudeValue) ? latest.Magnitude.MagnitudeValue : 0,
    depth: latest.FocalDepth || 0,
    reportContent: latest.ReportContent || '',
    reportImageURI: latest.ReportImageURI || '',
    feltAreas: []
  };
  
  // 取得震度分布資訊
  if (latest.Intensity && latest.Intensity.ShakingArea) {
    const areas = latest.Intensity.ShakingArea;
    areas.forEach(function(area) {
      if (area.AreaIntensity) {
        earthquakeInfo.feltAreas.push({
          county: area.AreaName || area.CountyName,
          intensity: area.AreaIntensity
        });
      }
    });
  }
  
  return earthquakeInfo;
}

/**
 * 檢查是否為新地震（尚未通知過）
 * @param {string} earthquakeId - 地震編號
 * @return {boolean} 是否為新地震
 */
function isNewEarthquake(earthquakeId) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  // 從第二行開始檢查（第一行為標題）
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === earthquakeId.toString()) {
      return false;
    }
  }
  
  return true;
}

/**
 * 記錄地震到試算表
 * @param {Object} earthquakeData - 地震資料
 */
function recordEarthquake(earthquakeData) {
  const sheet = getOrCreateSheet();
  
  // 新增一列記錄
  sheet.appendRow([
    earthquakeData.id,
    earthquakeData.time,
    earthquakeData.location,
    earthquakeData.magnitude,
    earthquakeData.depth,
    new Date().toISOString()
  ]);
}

/**
 * 取得或建立試算表
 * @return {Sheet} Google 試算表工作表
 */
function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('地震記錄');
  
  if (!sheet) {
    // 建立工作表並設定標題
    sheet = spreadsheet.insertSheet('地震記錄');
    sheet.appendRow([
      '地震編號',
      '地震時間',
      '震央位置',
      '規模',
      '深度(km)',
      '通知時間'
    ]);
    
    // 設定標題樣式
    const headerRange = sheet.getRange(1, 1, 1, 6);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4472C4');
    headerRange.setFontColor('#FFFFFF');
  }
  
  return sheet;
}

/**
 * 格式化地震訊息（科技感排版）
 * @param {Object} earthquakeData - 地震資料
 * @return {string} 格式化後的訊息
 */
function formatEarthquakeMessage(earthquakeData) {
  // 計算震度等級顯示
  const magnitude = earthquakeData.magnitude;
  let magnitudeEmoji = '';
  let alertLevel = '';
  
  if (magnitude >= 6.5) {
    magnitudeEmoji = '🔴';
    alertLevel = '⚠️ 嚴重警報 ⚠️';
  } else if (magnitude >= 5.0) {
    magnitudeEmoji = '🟠';
    alertLevel = '🔶 警戒等級';
  } else if (magnitude >= 4.0) {
    magnitudeEmoji = '🟡';
    alertLevel = '✅ 一般等級';
  } else {
    magnitudeEmoji = '🟢';
    alertLevel = 'ℹ️ 輕微地震';
  }
  
  // 取得震度分布文字
  let intensityText = '';
  if (earthquakeData.feltAreas.length > 0) {
    // 依震度分組
    const intensityGroups = {};
    earthquakeData.feltAreas.forEach(function(area) {
      const level = area.intensity;
      if (!intensityGroups[level]) {
        intensityGroups[level] = [];
      }
      intensityGroups[level].push(area.county);
    });
    
    // 由高到低排列震度
    const sortedLevels = Object.keys(intensityGroups).sort(function(a, b) {
      return parseFloat(b) - parseFloat(a);
    });
    
    sortedLevels.forEach(function(level) {
      const counties = intensityGroups[level].join('、');
      intensityText += '\n  ⚡ ' + level + '級：' + counties;
    });
  }
  
  // 格式化時間
  const quakeTime = new Date(earthquakeData.time);
  const timeStr = Utilities.formatDate(quakeTime, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  
  // 組裝完整訊息
  const message = 
    '╔══════════════════════════╗\n' +
    '║  🌏 台灣地震速報系統  ║\n' +
    '╚══════════════════════════╝\n\n' +
    alertLevel + '\n\n' +
    '┌─────────────────────────┐\n' +
    '│ ' + magnitudeEmoji + ' 震央：' + earthquakeData.location + '\n' +
    '│ 📊 規模：M' + earthquakeData.magnitude + '\n' +
    '│ 📏 深度：' + earthquakeData.depth + ' km\n' +
    '│ 🕐 時間：' + timeStr + '\n' +
    '│ 🔢 編號：' + earthquakeData.id + '\n' +
    '└─────────────────────────┘\n\n' +
    '📍 震度分布：' + intensityText + '\n\n' +
    '══════════════════════════\n' +
    '📡 資料來源：中央氣象署\n' +
    '⏰ 更新時間：' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm:ss') + '\n' +
    '══════════════════════════';
  
  return message;
}

/**
 * 推播訊息給所有使用者
 * @param {string} message - 要推播的訊息
 */
function pushToAllUsers(message) {
  const userIds = LINE_USER_IDS.split(',');
  
  userIds.forEach(function(userId) {
    const trimmedId = userId.trim();
    if (trimmedId) {
      pushMessage(trimmedId, message);
      pushSticker(trimmedId);
      Utilities.sleep(1000); // 避免 API 限流
    }
  });
}

/**
 * 推播文字訊息至 LINE
 * @param {string} userId - LINE User ID
 * @param {string} message - 訊息內容
 */
function pushMessage(userId, message) {
  const url = 'https://api.line.me/v2/bot/message/push';
  
  const payload = {
    'to': userId,
    'messages': [
      {
        'type': 'text',
        'text': message
      }
    ]
  };
  
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    Logger.log('推播失敗 [' + userId + ']：' + response.getContentText());
  }
}

/**
 * 推播貼圖至 LINE
 * @param {string} userId - LINE User ID
 */
function pushSticker(userId) {
  const url = 'https://api.line.me/v2/bot/message/push';
  
  const payload = {
    'to': userId,
    'messages': [
      {
        'type': 'sticker',
        'packageId': STICKER_PACKAGE_ID,
        'stickerId': STICKER_ID
      }
    ]
  };
  
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    Logger.log('貼圖推播失敗 [' + userId + ']：' + response.getContentText());
  }
}

// ===================== 設定用函式 =====================

/**
 * 設定時間觸發器（每 2 分鐘執行一次）
 * 請手動執行一次此函式來建立觸發器
 */
function setupTrigger() {
  // 移除現有的觸發器
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'checkEarthquake') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 建立新的觸發器（每 1 分鐘）
  ScriptApp.newTrigger('checkEarthquake')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  Logger.log('時間觸發器已建立：每 1 分鐘執行一次');
}

/**
 * 測試用：手動執行地震檢查
 */
function testCheck() {
  checkEarthquake();
}

/**
 * 測試用：發送測試訊息至 LINE
 * 執行此函式可立即收到一則測試訊息
 */
function sendTestMessage() {
  const testMessage = 
    '╔══════════════════════════╗\n' +
    '║  🌏 台灣地震速報系統  ║\n' +
    '╚══════════════════════════╝\n\n' +
    '✅ 系統測試訊息\n\n' +
    '┌─────────────────────────┐\n' +
    '│ 🔔 此為測試訊息\n' +
    '│ 📊 系統運作正常\n' +
    '│ 🕐 測試時間：' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss') + '\n' +
    '└─────────────────────────┘\n\n' +
    '當偵測到地震時，您將收到類似格式的通知。\n\n' +
    '══════════════════════════\n' +
    '📡 資料來源：中央氣象署\n' +
    '══════════════════════════';
  
  // 發送測試訊息給所有使用者
  const userIds = LINE_USER_IDS.split(',');
  
  userIds.forEach(function(userId) {
    const trimmedId = userId.trim();
    if (trimmedId) {
      pushMessage(trimmedId, testMessage);
      pushSticker(trimmedId);
      Logger.log('測試訊息已發送至：' + trimmedId);
    }
  });
  
  Logger.log('✅ 測試訊息發送完成！');
}

/**
 * 測試用：查看試算表中的記錄
 */
function viewRecords() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  
  Logger.log('=== 地震記錄 ===');
  data.forEach(function(row) {
    Logger.log(row.join(' | '));
  });
}

/**
 * 測試用：清除所有記錄（謹慎使用！）
 */
function clearRecords() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
    Logger.log('已清除所有地震記錄');
  }
}

// ===================== Web App 函式 =====================

/**
 * Web App 入口函式 - 回傳地震資訊頁面
 * @param {Object} e - 事件物件
 * @return {HtmlOutput} HTML 頁面
 */
function doGet(e) {
  // 取得最新地震資料
  const earthquakeData = getLatestEarthquake();
  
  let html = '';
  
  if (earthquakeData) {
    // 格式化時間
    const quakeTime = new Date(earthquakeData.time);
    const timeStr = Utilities.formatDate(quakeTime, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
    
    // 計算震度顯示
    let intensityHtml = '';
    if (earthquakeData.feltAreas.length > 0) {
      const intensityGroups = {};
      earthquakeData.feltAreas.forEach(function(area) {
        const level = area.intensity;
        if (!intensityGroups[level]) {
          intensityGroups[level] = [];
        }
        intensityGroups[level].push(area.county);
      });
      
      const sortedLevels = Object.keys(intensityGroups).sort(function(a, b) {
        return parseFloat(b) - parseFloat(a);
      });
      
      sortedLevels.forEach(function(level) {
        const counties = intensityGroups[level].join('、');
        intensityHtml += '<div class="intensity-item"><span class="intensity-level">' + level + '級</span><span class="intensity-counties">' + counties + '</span></div>';
      });
    }
    
    // 震級顏色
    let magnitudeColor = '#4CAF50';
    let alertText = '輕微地震';
    if (earthquakeData.magnitude >= 6.5) {
      magnitudeColor = '#f44336';
      alertText = '嚴重警報';
    } else if (earthquakeData.magnitude >= 5.0) {
      magnitudeColor = '#ff9800';
      alertText = '警戒等級';
    } else if (earthquakeData.magnitude >= 4.0) {
      magnitudeColor = '#ffeb3b';
      alertText = '一般等級';
    }
    
    html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>台灣地震速報</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft JhengHei', sans-serif;
      background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
      min-height: 100vh;
      padding: 20px;
      color: #fff;
    }
    .container { max-width: 500px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 24px; color: #00d2ff; }
    .alert-badge {
      display: inline-block;
      background: ${magnitudeColor};
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: bold;
      margin-top: 10px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .card {
      background: rgba(255,255,255,0.1);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 15px;
      backdrop-filter: blur(10px);
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #aaa; }
    .info-value { font-weight: bold; }
    .magnitude { font-size: 48px; color: ${magnitudeColor}; text-align: center; }
    .intensity-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
    }
    .intensity-level {
      background: #ff9800;
      padding: 4px 12px;
      border-radius: 10px;
      margin-right: 10px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌏 台灣地震速報系統</h1>
      <div class="alert-badge">${alertText}</div>
    </div>
    
    <div class="card">
      <div class="magnitude">M${earthquakeData.magnitude}</div>
    </div>
    
    <div class="card">
      <div class="info-row">
        <span class="info-label">震央</span>
        <span class="info-value">${earthquakeData.location}</span>
      </div>
      <div class="info-row">
        <span class="info-label">深度</span>
        <span class="info-value">${earthquakeData.depth} km</span>
      </div>
      <div class="info-row">
        <span class="info-label">時間</span>
        <span class="info-value">${timeStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">編號</span>
        <span class="info-value">#${earthquakeData.id}</span>
      </div>
    </div>
    
    <div class="card">
      <h3 style="margin-bottom: 15px;">📍 震度分布</h3>
      ${intensityHtml}
    </div>
    
    <div class="footer">
      資料來源：中央氣象署<br>
      更新時間：${Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm:ss')}
    </div>
  </div>
</body>
</html>`;
  } else {
    html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>台灣地震速報</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft JhengHei', sans-serif;
      background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      color: #fff;
    }
    .no-data {
      text-align: center;
      padding: 40px;
    }
    .no-data h2 { color: #4CAF50; margin-bottom: 10px; }
    .no-data p { color: #aaa; }
  </style>
</head>
<body>
  <div class="no-data">
    <div style="font-size: 60px; margin-bottom: 20px;">🌏</div>
    <h2>目前無地震資訊</h2>
    <p>系統運作正常，持續監測中...</p>
    <p style="margin-top: 20px; color: #666;">更新時間：${Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm:ss')}</p>
  </div>
</body>
</html>`;
  }
  
  return HtmlService.createHtmlOutput(html)
    .setTitle('台灣地震速報系統')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Web App 入口函式 - 處理 POST 請求（LINE Webhook）
 * @param {Object} e - 事件物件
 * @return {ContentService} 回應
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const event = data.events[0];
    
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;
      const replyToken = event.replyToken;
      
      // 處理不同的用戶訊息
      let replyMessage = '';
      
      if (userMessage === '地震' || userMessage === '最新') {
        const earthquakeData = getLatestEarthquake();
        if (earthquakeData) {
          replyMessage = formatEarthquakeMessage(earthquakeData);
        } else {
          replyMessage = '目前沒有地震資訊。';
        }
      } else if (userMessage === '幫助' || userMessage === 'help') {
        replyMessage = '【台灣地震速報系統】\n\n' +
          '指令說明：\n' +
          '📍 地震 - 查看最新地震資訊\n' +
          '📍 最新 - 查看最新地震資訊\n' +
          '📍 幫助 - 顯示此說明\n\n' +
          '系統將自動推播地震通知。';
      } else {
        replyMessage = '您說了：「' + userMessage + '」\n\n' +
          '輸入「地震」查看最新資訊\n輸入「幫助」查看所有指令';
      }
      
      // 回覆訊息
      replyMessage(replyToken, replyMessage);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Webhook 錯誤：' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({status: 'error'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 回覆訊息至 LINE
 * @param {string} replyToken - 回覆 Token
 * @param {string} message - 訊息內容
 */
function replyMessage(replyToken, message) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  
  const payload = {
    'replyToken': replyToken,
    'messages': [
      {
        'type': 'text',
        'text': message
      }
    ]
  };
  
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  UrlFetchApp.fetch(url, options);
}
