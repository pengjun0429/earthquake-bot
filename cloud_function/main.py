import os
import json
import requests
from datetime import datetime
from google.cloud import firestore

# ===================== 設定區 =====================
CWA_API_KEY = os.environ.get('CWA_API_KEY')
LINE_ACCESS_TOKEN = os.environ.get('LINE_ACCESS_TOKEN')
LINE_USER_IDS = os.environ.get('LINE_USER_IDS', '').split(',')
STICKER_PACKAGE_ID = '446'
STICKER_ID = '1988'

# Firestore 用戶端
db = firestore.Client()

# ===================== 主程式 =====================

def check_earthquake(request):
    """Cloud Function 入口點 - 檢查地震並推播"""
    try:
        # 1. 取得最新地震
        earthquake = get_latest_earthquake()
        if not earthquake:
            return {'status': 'no_data', 'message': '無法取得地震資料'}, 200
        
        # 2. 檢查是否已通知
        if is_new_earthquake(earthquake['id']):
            # 3. 格式化訊息並推播
            message = format_message(earthquake)
            push_to_all_users(message)
            push_sticker_to_all_users()
            
            # 4. 記錄到 Firestore
            record_earthquake(earthquake)
            
            print(f'新地震通知已發送：{earthquake["id"]}')
            return {'status': 'sent', 'earthquake_id': earthquake['id']}, 200
        else:
            print(f'地震已通知過：{earthquake["id"]}')
            return {'status': 'already_sent', 'earthquake_id': earthquake['id']}, 200
            
    except Exception as e:
        print(f'執行錯誤：{str(e)}')
        return {'status': 'error', 'message': str(e)}, 500

# ===================== 地震資料函式 =====================

def get_latest_earthquake():
    """從中央氣象署取得最新地震資料"""
    url = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001'
    params = {
        'Authorization': CWA_API_KEY,
        'format': 'JSON'
    }
    
    response = requests.get(url, params=params, timeout=30)
    data = response.json()
    
    if data.get('success') != 'true':
        print(f'CWA API 回傳失敗：{data}')
        return None
    
    earthquakes = data.get('records', {}).get('Earthquake', [])
    if not earthquakes:
        print('無地震資料')
        return None
    
    latest = earthquakes[0]
    
    # 解析震度分布
    felt_areas = []
    intensity_data = latest.get('Intensity', {}).get('ShakingArea', [])
    for area in intensity_data:
        if area.get('AreaIntensity'):
            felt_areas.append({
                'county': area.get('AreaName') or area.get('CountyName', '未知'),
                'intensity': area['AreaIntensity']
            })
    
    return {
        'id': latest.get('EarthquakeNo', '未知'),
        'time': latest.get('EarthquakeTime', {}).get('DateTime', datetime.now().isoformat()),
        'location': latest.get('Epicenter', {}).get('Location', '未知'),
        'magnitude': latest.get('Magnitude', {}).get('MagnitudeValue', 0),
        'depth': latest.get('FocalDepth', 0),
        'felt_areas': felt_areas
    }

# ===================== Firestore 函式 =====================

def is_new_earthquake(earthquake_id):
    """檢查是否為新地震（尚未通知過）"""
    doc_ref = db.collection('earthquakes').document(str(earthquake_id))
    doc = doc_ref.get()
    return not doc.exists

def record_earthquake(earthquake):
    """記錄地震到 Firestore"""
    doc_ref = db.collection('earthquakes').document(str(earthquake['id']))
    doc_ref.set({
        'id': earthquake['id'],
        'time': earthquake['time'],
        'location': earthquake['location'],
        'magnitude': earthquake['magnitude'],
        'depth': earthquake['depth'],
        'notified_at': firestore.SERVER_TIMESTAMP
    })
    print(f'地震 {earthquake["id"]} 已記錄到 Firestore')

# ===================== 訊息格式化 =====================

def format_message(earthquake):
    """格式化地震訊息（科技感排版）"""
    magnitude = earthquake['magnitude']
    
    # 依規模分級
    if magnitude >= 6.5:
        alert_level = '⚠️ 嚴重警報 ⚠️'
        emoji = '🔴'
    elif magnitude >= 5.0:
        alert_level = '🔶 警戒等級'
        emoji = '🟠'
    elif magnitude >= 4.0:
        alert_level = '✅ 一般等級'
        emoji = '🟡'
    else:
        alert_level = 'ℹ️ 輕微地震'
        emoji = '🟢'
    
    # 震度分布文字
    intensity_text = ''
    if earthquake['felt_areas']:
        groups = {}
        for area in earthquake['felt_areas']:
            level = area['intensity']
            if level not in groups:
                groups[level] = []
            groups[level].append(area['county'])
        
        for level in sorted(groups.keys(), key=float, reverse=True):
            counties = '、'.join(groups[level])
            intensity_text += f'\n  ⚡ {level}級：{counties}'
    
    # 時間格式化
    try:
        quake_time = datetime.fromisoformat(earthquake['time'].replace('+08:00', '+08:00'))
        time_str = quake_time.strftime('%Y/%m/%d %H:%M:%S')
    except:
        time_str = earthquake['time']
    
    # 組裝完整訊息
    message = f"""╔══════════════════════════╗
║  🌏 台灣地震速報系統  ║
╚══════════════════════════╝

{alert_level}

┌─────────────────────────┐
│ {emoji} 震央：{earthquake['location']}
│ 📊 規模：M{earthquake['magnitude']}
│ 📏 深度：{earthquake['depth']} km
│ 🕐 時間：{time_str}
│ 🔢 編號：{earthquake['id']}
└─────────────────────────┘

📍 震度分布：{intensity_text}

══════════════════════════
📡 資料來源：中央氣象署
⏰ 更新時間：{datetime.now().strftime('%H:%M:%S')}
══════════════════════════"""
    
    return message

# ===================== LINE 推播函式 =====================

def push_to_all_users(message):
    """推播文字訊息給所有使用者"""
    url = 'https://api.line.me/v2/bot/message/push'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {LINE_ACCESS_TOKEN}'
    }
    
    for user_id in LINE_USER_IDS:
        user_id = user_id.strip()
        if not user_id:
            continue
        
        payload = {
            'to': user_id,
            'messages': [
                {
                    'type': 'text',
                    'text': message
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=payload)
        print(f'推播至 {user_id}：{response.status_code}')

def push_sticker_to_all_users():
    """推播貼圖給所有使用者"""
    url = 'https://api.line.me/v2/bot/message/push'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {LINE_ACCESS_TOKEN}'
    }
    
    for user_id in LINE_USER_IDS:
        user_id = user_id.strip()
        if not user_id:
            continue
        
        payload = {
            'to': user_id,
            'messages': [
                {
                    'type': 'sticker',
                    'packageId': STICKER_PACKAGE_ID,
                    'stickerId': STICKER_ID
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=payload)
        print(f'貼圖推播至 {user_id}：{response.status_code}')
