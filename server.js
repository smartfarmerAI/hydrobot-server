const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =============================================
//   DATA STORE
// =============================================
let sensorData = {
  suhu_udara: 28.5,
  kelembaban: 65.0,
  suhu_air: 24.2,
  ph: 6.2,
  tds: 850,
  level_air: 74,
  pump: true,
  light: true,
  dosing: false,
  timestamp: '00:00 WIB'
};

let phHistory = [6.1, 6.2, 6.3, 6.4, 6.5, 6.2];
let jamHistory = ['10', '11', '12', '13', '14', '15'];

// =============================================
//   GENERATE HTML CARD
// =============================================
function buildHTML(data) {
  const phMax = 7.5, phMin = 5.0;

  const bars = phHistory.map((ph, i) => {
    const pct = Math.max(5, ((ph - phMin) / (phMax - phMin)) * 100);
    const color = ph > 6.5 ? '#f87171' : ph > 6.0 ? '#fbbf24' : '#4ade80';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
        <span style="font-size:10px;color:#c8d8e4">${ph.toFixed(1)}</span>
        <div style="width:100%;background:rgba(255,255,255,0.05);border-radius:4px;height:50px;display:flex;align-items:flex-end">
          <div style="width:100%;height:${pct}%;background:${color};border-radius:4px;opacity:0.8"></div>
        </div>
        <span style="font-size:9px;color:#6b8f6b">${jamHistory[i]}</span>
      </div>`;
  }).join('');

  const phOk = data.ph >= 5.5 && data.ph <= 6.5;
  const tdsOk = data.tds >= 700 && data.tds <= 1200;

  const cards = [
    { label: 'pH', value: data.ph.toFixed(1), sub: phOk ? 'NORMAL' : 'PERIKSA!', color: phOk ? '#4ade80' : '#fbbf24', border: phOk ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.3)' },
    { label: 'TDS (ppm)', value: data.tds, sub: tdsOk ? 'NORMAL' : 'PERIKSA!', color: tdsOk ? '#4ade80' : '#fbbf24', border: tdsOk ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.3)' },
    { label: 'Level Air', value: data.level_air + '%', sub: 'RESERVOIR', color: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
    { label: 'Suhu Udara', value: data.suhu_udara + '°C', sub: 'NORMAL', color: '#4ade80', border: 'rgba(74,222,128,0.2)' },
    { label: 'Suhu Air', value: data.suhu_air + '°C', sub: 'NORMAL', color: '#4ade80', border: 'rgba(74,222,128,0.2)' },
    { label: 'Kelembaban', value: data.kelembaban + '%', sub: 'NORMAL', color: '#4ade80', border: 'rgba(74,222,128,0.2)' },
  ].map(c => `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${c.border};border-radius:10px;padding:12px;flex:1">
      <div style="font-size:10px;color:#6b8f6b;margin-bottom:6px">${c.label}</div>
      <div style="font-size:24px;font-weight:700;color:${c.color};margin-bottom:4px">${c.value}</div>
      <div style="font-size:9px;color:${c.color};opacity:0.6">${c.sub}</div>
    </div>`).join('');

  const actuators = [
    { label: 'Main Pump', state: data.pump },
    { label: 'Grow Light', state: data.light },
    { label: 'Dosing', state: data.dosing },
    { label: 'pH Down', state: false },
  ].map(a => `
    <div style="background:${a.state ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)'};border:1px solid ${a.state ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)'};border-radius:8px;padding:10px;flex:1;text-align:center">
      <div style="font-size:10px;color:#6b8f6b;margin-bottom:6px">${a.label}</div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${a.state ? '#4ade80' : 'rgba(255,255,255,0.15)'};margin-right:4px"></div>
      <span style="font-size:11px;font-weight:700;color:${a.state ? '#4ade80' : 'rgba(255,255,255,0.2)'}">${a.state ? 'ON' : 'OFF'}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 520px;
    background: transparent;
    font-family: 'DejaVu Sans', Arial, sans-serif;
  }
  .card {
    background: linear-gradient(160deg, #071a0a 0%, #0a1f10 50%, #061510 100%);
    border: 1.5px solid rgba(74,222,128,0.25);
    border-radius: 20px;
    padding: 20px;
    width: 520px;
  }
</style>
</head>
<body>
<div class="card">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
    <div>
      <div style="font-size:20px;font-weight:700;color:#4ade80;letter-spacing:1px">HYDROBOT NFT</div>
      <div style="font-size:10px;color:#6b8f6b;margin-top:3px;letter-spacing:2px">REAL-TIME MONITORING SYSTEM</div>
    </div>
    <div style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.25);border-radius:20px;padding:4px 12px;display:flex;align-items:center;gap:6px">
      <div style="width:7px;height:7px;border-radius:50%;background:#4ade80"></div>
      <span style="font-size:11px;font-weight:700;color:#4ade80">LIVE</span>
    </div>
  </div>

  <!-- Divider -->
  <div style="height:1px;background:rgba(74,222,128,0.12);margin-bottom:14px"></div>

  <!-- Sensor Grid row 1 -->
  <div style="display:flex;gap:10px;margin-bottom:10px">${cards.slice(0,3).join('')}</div>
  <!-- Sensor Grid row 2 -->
  <div style="display:flex;gap:10px;margin-bottom:14px">${cards.slice(3,6).join('')}</div>

  <!-- Divider -->
  <div style="height:1px;background:rgba(74,222,128,0.08);margin-bottom:10px"></div>

  <!-- Chart -->
  <div style="font-size:10px;font-weight:700;color:#6b8f6b;letter-spacing:1px;margin-bottom:8px">TREN pH -- 6 JAM TERAKHIR</div>
  <div style="display:flex;gap:8px;height:70px;align-items:flex-end;margin-bottom:14px">${bars}</div>

  <!-- Divider -->
  <div style="height:1px;background:rgba(74,222,128,0.08);margin-bottom:10px"></div>

  <!-- Aktuator -->
  <div style="font-size:10px;font-weight:700;color:#6b8f6b;letter-spacing:1px;margin-bottom:8px">STATUS AKTUATOR</div>
  <div style="display:flex;gap:8px;margin-bottom:14px">${actuators}</div>

  <!-- Footer -->
  <div style="height:1px;background:rgba(74,222,128,0.08);margin-bottom:10px"></div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:10px;color:#6b8f6b">Update: ${data.timestamp}</span>
    <span style="font-size:10px;font-weight:700;color:rgba(74,222,128,0.4);letter-spacing:1px">SMARTFARMER AI</span>
  </div>

</div>
</body>
</html>`;
}

// =============================================
//   SCREENSHOT HTML -> PNG
// =============================================
async function generateImage(data) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 520, height: 100 });
  await page.setContent(buildHTML(data), { waitUntil: 'networkidle0' });

  const element = await page.$('.card');
  const imgBuffer = await element.screenshot({ type: 'png' });
  await browser.close();
  return imgBuffer;
}

// =============================================
//   ENDPOINTS
// =============================================
app.post('/data', (req, res) => {
  const d = req.body;
  if (d.suhu_udara !== undefined) sensorData.suhu_udara = parseFloat(d.suhu_udara);
  if (d.kelembaban !== undefined) sensorData.kelembaban = parseFloat(d.kelembaban);
  if (d.suhu_air !== undefined) sensorData.suhu_air = parseFloat(d.suhu_air);
  if (d.tds !== undefined) sensorData.tds = parseFloat(d.tds);
  if (d.level_air !== undefined) sensorData.level_air = parseFloat(d.level_air);
  if (d.pump !== undefined) sensorData.pump = d.pump === true || d.pump === 'true';
  if (d.light !== undefined) sensorData.light = d.light === true || d.light === 'true';
  if (d.dosing !== undefined) sensorData.dosing = d.dosing === true || d.dosing === 'true';
  if (d.ph !== undefined) {
    sensorData.ph = parseFloat(d.ph);
    phHistory.push(parseFloat(d.ph));
    if (phHistory.length > 6) phHistory.shift();
    const now = new Date();
    jamHistory.push(String(now.getHours()));
    if (jamHistory.length > 6) jamHistory.shift();
  }
  sensorData.timestamp = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  const alerts = [];
  if (sensorData.ph < 5.5) alerts.push('pH terlalu RENDAH: ' + sensorData.ph);
  if (sensorData.ph > 6.5) alerts.push('pH terlalu TINGGI: ' + sensorData.ph);
  if (sensorData.tds < 600) alerts.push('Nutrisi KURANG: ' + sensorData.tds + ' ppm');
  if (sensorData.level_air < 20) alerts.push('Air KRITIS: ' + sensorData.level_air + '%');
  if (alerts.length > 0) {
    bot.sendMessage(CHAT_ID, '🚨 PERINGATAN HYDROBOT\n\n' + alerts.join('\n') + '\n\nSegera periksa sistem!');
  }

  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ status: 'HydroBot Server Running', uptime: process.uptime() });
});

// =============================================
//   TELEGRAM COMMANDS
// =============================================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '🌿 Selamat datang di HydroBot NFT!\n\n' +
    'Perintah tersedia:\n' +
    '/status - Lihat status sensor\n' +
    '/pompa_on - Nyalakan pompa\n' +
    '/pompa_off - Matikan pompa\n' +
    '/lampu_on - Nyalakan grow light\n' +
    '/lampu_off - Matikan grow light\n' +
    '/ping - Cek koneksi server'
  );
});

bot.onText(/\/status/, async (msg) => {
  try {
    await bot.sendChatAction(msg.chat.id, 'upload_photo');
    const imgBuffer = await generateImage(sensorData);
    await bot.sendPhoto(msg.chat.id, imgBuffer, {
      caption: 'HydroBot NFT -- Status terkini | ' + sensorData.timestamp
    });
  } catch (err) {
    console.error('Error:', err);
    bot.sendMessage(msg.chat.id, 'Error: ' + err.message);
  }
});

bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Pong! Server aktif. Uptime: ' + Math.floor(process.uptime()) + ' detik');
});

bot.onText(/\/pompa_on/, (msg) => { sensorData.pump = true; bot.sendMessage(msg.chat.id, '✅ Main Pump ON'); });
bot.onText(/\/pompa_off/, (msg) => { sensorData.pump = false; bot.sendMessage(msg.chat.id, '⭕ Main Pump OFF'); });
bot.onText(/\/lampu_on/, (msg) => { sensorData.light = true; bot.sendMessage(msg.chat.id, '✅ Grow Light ON'); });
bot.onText(/\/lampu_off/, (msg) => { sensorData.light = false; bot.sendMessage(msg.chat.id, '⭕ Grow Light OFF'); });

// =============================================
//   START
// =============================================
app.listen(PORT, () => {
  console.log('HydroBot Server running on port ' + PORT);
  bot.sendMessage(CHAT_ID, '🌿 HydroBot Server aktif! Ketik /status untuk cek data.')
    .catch(err => console.log('Notify error:', err.message));
});
