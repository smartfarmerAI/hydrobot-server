const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sharp = require('sharp');

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
//   GENERATE SVG
// =============================================
function buildSVG(data) {
  const W = 520;
  const phMax = 7.5, phMin = 5.0;
  const phOk = data.ph >= 5.5 && data.ph <= 6.5;
  const tdsOk = data.tds >= 700 && data.tds <= 1200;

  // Sensor cards
  const sensors = [
    { label: 'pH', value: data.ph.toFixed(1), sub: phOk ? 'NORMAL' : 'PERIKSA!', color: phOk ? '#4ade80' : '#fbbf24' },
    { label: 'TDS ppm', value: String(data.tds), sub: tdsOk ? 'NORMAL' : 'PERIKSA!', color: tdsOk ? '#4ade80' : '#fbbf24' },
    { label: 'Level Air', value: data.level_air + '%', sub: 'RESERVOIR', color: '#60a5fa' },
    { label: 'Suhu Udara', value: data.suhu_udara + 'C', sub: 'NORMAL', color: '#4ade80' },
    { label: 'Suhu Air', value: data.suhu_air + 'C', sub: 'NORMAL', color: '#4ade80' },
    { label: 'Kelembaban', value: data.kelembaban + '%', sub: 'NORMAL', color: '#4ade80' },
  ];

  const cardW = 148, cardH = 80, cardGapX = 16, cardGapY = 10;
  const cardStartX = 20, cardStartY = 88;

  let sensorCards = '';
  sensors.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = cardStartX + col * (cardW + cardGapX);
    const y = cardStartY + row * (cardH + cardGapY);
    const isWarn = s.color === '#fbbf24';
    const borderColor = isWarn ? 'rgba(251,191,36,0.3)' : s.color === '#60a5fa' ? 'rgba(96,165,250,0.2)' : 'rgba(74,222,128,0.15)';
    const bgColor = isWarn ? 'rgba(251,191,36,0.06)' : s.color === '#60a5fa' ? 'rgba(96,165,250,0.05)' : 'rgba(74,222,128,0.04)';

    sensorCards += `
      <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${x + 12}" y="${y + 18}" font-family="Arial, sans-serif" font-size="10" fill="#6b8f6b">${s.label}</text>
      <text x="${x + 12}" y="${y + 52}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="${s.color}">${s.value}</text>
      <text x="${x + 12}" y="${y + 68}" font-family="Arial, sans-serif" font-size="9" fill="${s.color}" opacity="0.6">${s.sub}</text>
      ${isWarn ? `<text x="${x + cardW - 16}" y="${y + 18}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#fbbf24">!</text>` : ''}
    `;
  });

  // Bar chart
  const chartY = 298;
  const barAreaY = chartY + 20;
  const barAreaH = 50;
  const barW = 50, barGap = 30;

  let bars = '';
  phHistory.forEach((ph, i) => {
    const x = 20 + i * (barW + barGap);
    const ratio = Math.max(0.05, Math.min(1, (ph - phMin) / (phMax - phMin)));
    const barH = ratio * barAreaH;
    const y = barAreaY + (barAreaH - barH);
    const color = ph > 6.5 ? '#f87171' : ph > 6.0 ? '#fbbf24' : '#4ade80';

    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${color}" opacity="0.75"/>
      <text x="${x + barW / 2}" y="${y - 4}" font-family="Arial, sans-serif" font-size="10" fill="#c8d8e4" text-anchor="middle">${ph.toFixed(1)}</text>
      <text x="${x + barW / 2}" y="${barAreaY + barAreaH + 14}" font-family="Arial, sans-serif" font-size="9" fill="#6b8f6b" text-anchor="middle">${jamHistory[i]}:00</text>
    `;
  });

  // Actuators
  const actY = 416;
  const actuators = [
    { label: 'Main Pump', state: data.pump },
    { label: 'Grow Light', state: data.light },
    { label: 'Dosing', state: data.dosing },
    { label: 'pH Down', state: false },
  ];
  const actW = 108, actH = 56, actGap = 10;

  let actCards = '';
  actuators.forEach((a, i) => {
    const x = 20 + i * (actW + actGap);
    const y = actY + 14;
    const border = a.state ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)';
    const bg = a.state ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)';
    const dotColor = a.state ? '#4ade80' : 'rgba(255,255,255,0.15)';
    const textColor = a.state ? '#4ade80' : 'rgba(255,255,255,0.2)';

    actCards += `
      <rect x="${x}" y="${y}" width="${actW}" height="${actH}" rx="8" fill="${bg}" stroke="${border}" stroke-width="1"/>
      <text x="${x + 10}" y="${y + 20}" font-family="Arial, sans-serif" font-size="10" fill="#6b8f6b">${a.label}</text>
      <circle cx="${x + 16}" cy="${y + 38}" r="5" fill="${dotColor}"/>
      <text x="${x + 28}" y="${y + 43}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="${textColor}">${a.state ? 'ON' : 'OFF'}</text>
    `;
  });

  const totalH = 570;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#071a0a"/>
      <stop offset="50%" style="stop-color:#0a1f10"/>
      <stop offset="100%" style="stop-color:#061510"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="15%" r="40%">
      <stop offset="0%" style="stop-color:#4ade80;stop-opacity:0.07"/>
      <stop offset="100%" style="stop-color:#4ade80;stop-opacity:0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${totalH}" rx="20" fill="url(#bg)"/>
  <rect width="${W}" height="${totalH}" rx="20" fill="url(#glow)"/>
  <rect x="1" y="1" width="${W - 2}" height="${totalH - 2}" rx="19" fill="none" stroke="rgba(74,222,128,0.25)" stroke-width="1.5"/>

  <!-- Header -->
  <text x="20" y="42" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#4ade80" letter-spacing="1">HYDROBOT NFT</text>
  <text x="22" y="62" font-family="Arial, sans-serif" font-size="10" fill="#6b8f6b" letter-spacing="2">REAL-TIME MONITORING SYSTEM</text>

  <!-- LIVE Badge -->
  <rect x="${W - 88}" y="26" width="66" height="24" rx="12" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.3)" stroke-width="1"/>
  <circle cx="${W - 76}" cy="38" r="4" fill="#4ade80"/>
  <text x="${W - 68}" y="43" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#4ade80">LIVE</text>

  <!-- Divider 1 -->
  <line x1="20" y1="76" x2="${W - 20}" y2="76" stroke="rgba(74,222,128,0.15)" stroke-width="1"/>

  <!-- Sensor Cards -->
  ${sensorCards}

  <!-- Divider 2 -->
  <line x1="20" y1="${chartY - 8}" x2="${W - 20}" y2="${chartY - 8}" stroke="rgba(74,222,128,0.1)" stroke-width="1"/>

  <!-- Chart Title -->
  <text x="20" y="${chartY + 10}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#6b8f6b" letter-spacing="1">TREN pH -- 6 JAM TERAKHIR</text>

  <!-- Bars -->
  ${bars}

  <!-- Divider 3 -->
  <line x1="20" y1="${actY - 8}" x2="${W - 20}" y2="${actY - 8}" stroke="rgba(74,222,128,0.1)" stroke-width="1"/>

  <!-- Actuator Title -->
  <text x="20" y="${actY + 8}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#6b8f6b" letter-spacing="1">STATUS AKTUATOR</text>

  <!-- Actuator Cards -->
  ${actCards}

  <!-- Footer -->
  <line x1="20" y1="516" x2="${W - 20}" y2="516" stroke="rgba(74,222,128,0.1)" stroke-width="1"/>
  <text x="20" y="536" font-family="Arial, sans-serif" font-size="10" fill="#6b8f6b">Update: ${data.timestamp}</text>
  <text x="${W - 136}" y="536" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="rgba(74,222,128,0.4)" letter-spacing="1">SMARTFARMER AI</text>
</svg>`;
}

// =============================================
//   GENERATE IMAGE dari SVG
// =============================================
async function generateImage(data) {
  const svg = buildSVG(data);
  const imgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
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
