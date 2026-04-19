const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { createCanvas } = require('canvas');

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
  timestamp: '19:51 WIB'
};

let phHistory = [6.1, 6.2, 6.3, 6.4, 6.5, 6.2];
let hours = ['10', '11', '12', '13', '14', '15'];

// =============================================
//   GENERATE GAMBAR
// =============================================
function generateStatusImage(data) {
  const width = 520;
  const height = 580;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071a0a');
  bgGrad.addColorStop(0.5, '#0a1f10');
  bgGrad.addColorStop(1, '#061510');
  ctx.fillStyle = bgGrad;
  ctx.roundRect(0, 0, width, height, 20);
  ctx.fill();

  // Glow
  const glow = ctx.createRadialGradient(width - 80, 80, 0, width - 80, 80, 160);
  glow.addColorStop(0, 'rgba(74,222,128,0.07)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = 'rgba(74,222,128,0.25)';
  ctx.lineWidth = 1.5;
  ctx.roundRect(1, 1, width - 2, height - 2, 20);
  ctx.stroke();

  // ── HEADER ──
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('HYDROBOT NFT', 24, 44);

  ctx.fillStyle = 'rgba(107,143,107,0.8)';
  ctx.font = '11px sans-serif';
  ctx.fillText('REAL-TIME MONITORING SYSTEM', 26, 64);

  // LIVE badge
  ctx.fillStyle = 'rgba(74,222,128,0.12)';
  ctx.strokeStyle = 'rgba(74,222,128,0.3)';
  ctx.lineWidth = 1;
  ctx.roundRect(width - 88, 26, 66, 24, 12);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(width - 76, 38, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#4ade80';
  ctx.fill();

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('LIVE', width - 68, 43);

  // Divider
  ctx.strokeStyle = 'rgba(74,222,128,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 78);
  ctx.lineTo(width - 24, 78);
  ctx.stroke();

  // ── SENSOR CARDS ──
  const metrics = [
    { label: 'pH', value: data.ph.toFixed(1), sub: data.ph >= 5.5 && data.ph <= 6.5 ? 'NORMAL' : 'PERIKSA!', status: data.ph >= 5.5 && data.ph <= 6.5 ? 'ok' : 'warn' },
    { label: 'TDS (ppm)', value: String(data.tds), sub: data.tds >= 700 && data.tds <= 1200 ? 'NORMAL' : 'PERIKSA!', status: data.tds >= 700 && data.tds <= 1200 ? 'ok' : 'warn' },
    { label: 'Level Air', value: data.level_air + '%', sub: 'RESERVOIR', status: 'info' },
    { label: 'Suhu Udara', value: data.suhu_udara + 'C', sub: 'NORMAL', status: 'ok' },
    { label: 'Suhu Air', value: data.suhu_air + 'C', sub: 'NORMAL', status: 'ok' },
    { label: 'Kelembaban', value: data.kelembaban + '%', sub: 'NORMAL', status: 'ok' },
  ];

  const cardW = 148;
  const cardH = 82;
  const startX = 24;
  const startY = 92;
  const gapX = 16;
  const gapY = 10;

  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    const isWarn = m.status === 'warn';
    const isInfo = m.status === 'info';

    ctx.fillStyle = isWarn ? 'rgba(251,191,36,0.06)' : isInfo ? 'rgba(96,165,250,0.05)' : 'rgba(74,222,128,0.04)';
    ctx.strokeStyle = isWarn ? 'rgba(251,191,36,0.25)' : isInfo ? 'rgba(96,165,250,0.2)' : 'rgba(74,222,128,0.15)';
    ctx.lineWidth = 1;
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(107,143,107,0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText(m.label, x + 12, y + 18);

    const valColor = isWarn ? '#fbbf24' : isInfo ? '#60a5fa' : '#4ade80';
    ctx.fillStyle = valColor;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(m.value, x + 12, y + 52);

    ctx.fillStyle = isWarn ? 'rgba(251,191,36,0.7)' : 'rgba(107,143,107,0.5)';
    ctx.font = '9px sans-serif';
    ctx.fillText(m.sub, x + 12, y + 68);

    if (isWarn) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('!', x + cardW - 16, y + 18);
    }
  });

  // ── CHART pH ──
  const chartY = 300;

  ctx.strokeStyle = 'rgba(74,222,128,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, chartY - 8);
  ctx.lineTo(width - 24, chartY - 8);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,143,107,0.7)';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('TREN pH -- 6 JAM TERAKHIR', 24, chartY + 8);

  const barAreaY = chartY + 18;
  const barAreaH = 52;
  const barW = 50;
  const barGap = 30;
  const maxPH = 7.5;
  const minPH = 5.0;

  phHistory.forEach((ph, i) => {
    const x = 24 + i * (barW + barGap);
    const ratio = Math.max(0, Math.min(1, (ph - minPH) / (maxPH - minPH)));
    const barH = Math.max(4, ratio * barAreaH);
    const y = barAreaY + (barAreaH - barH);

    const barColor = ph > 6.5
      ? 'rgba(248,113,113,0.75)'
      : ph > 6.0
        ? 'rgba(251,191,36,0.65)'
        : 'rgba(74,222,128,0.65)';

    ctx.fillStyle = barColor;
    ctx.roundRect(x, y, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(220,230,220,0.8)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(ph.toFixed(1), x + 8, y - 5);

    ctx.fillStyle = 'rgba(107,143,107,0.6)';
    ctx.font = '9px sans-serif';
    ctx.fillText(hours[i] + ':00', x + 4, barAreaY + barAreaH + 14);
  });

  // ── AKTUATOR ──
  const actY = 416;

  ctx.strokeStyle = 'rgba(74,222,128,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, actY - 8);
  ctx.lineTo(width - 24, actY - 8);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,143,107,0.7)';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('STATUS AKTUATOR', 24, actY + 8);

  const actuators = [
    { label: 'Main Pump', state: data.pump },
    { label: 'Grow Light', state: data.light },
    { label: 'Dosing', state: data.dosing },
    { label: 'pH Down', state: false },
  ];

  const actW = 108;
  const actH = 58;

  actuators.forEach((a, i) => {
    const x = 24 + i * (actW + 10);
    const y = actY + 16;

    ctx.fillStyle = a.state ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)';
    ctx.strokeStyle = a.state ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.roundRect(x, y, actW, actH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(180,200,180,0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText(a.label, x + 10, y + 20);

    ctx.beginPath();
    ctx.arc(x + 16, y + 38, 5, 0, Math.PI * 2);
    ctx.fillStyle = a.state ? '#4ade80' : 'rgba(255,255,255,0.15)';
    ctx.fill();

    ctx.fillStyle = a.state ? '#4ade80' : 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(a.state ? 'ON' : 'OFF', x + 28, y + 43);
  });

  // ── FOOTER ──
  const footerY = 520;

  ctx.strokeStyle = 'rgba(74,222,128,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, footerY);
  ctx.lineTo(width - 24, footerY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,143,107,0.5)';
  ctx.font = '10px sans-serif';
  ctx.fillText('Update: ' + data.timestamp, 24, footerY + 20);

  ctx.fillStyle = 'rgba(74,222,128,0.4)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('SMARTFARMER AI', width - 134, footerY + 20);

  return canvas.toBuffer('image/png');
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
    hours.push(String(now.getHours()));
    if (hours.length > 6) hours.shift();
  }

  sensorData.timestamp = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  // Auto alert
  const alerts = [];
  if (sensorData.ph < 5.5) alerts.push('pH terlalu RENDAH: ' + sensorData.ph);
  if (sensorData.ph > 6.5) alerts.push('pH terlalu TINGGI: ' + sensorData.ph);
  if (sensorData.tds < 600) alerts.push('Nutrisi KURANG: ' + sensorData.tds + ' ppm');
  if (sensorData.level_air < 20) alerts.push('Air KRITIS: ' + sensorData.level_air + '%');

  if (alerts.length > 0) {
    bot.sendMessage(CHAT_ID,
      '🚨 PERINGATAN HYDROBOT\n\n' + alerts.join('\n') + '\n\nSegera periksa sistem!'
    );
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
    const imgBuffer = generateStatusImage(sensorData);
    await bot.sendPhoto(msg.chat.id, imgBuffer, {
      caption: 'HydroBot NFT -- Status terkini | ' + sensorData.timestamp
    });
  } catch (err) {
    console.error('Error generate image:', err);
    bot.sendMessage(msg.chat.id, 'Gagal generate gambar: ' + err.message);
  }
});

bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Pong! Server aktif. Uptime: ' + Math.floor(process.uptime()) + ' detik');
});

bot.onText(/\/pompa_on/, (msg) => {
  sensorData.pump = true;
  bot.sendMessage(msg.chat.id, '✅ Main Pump ON');
});

bot.onText(/\/pompa_off/, (msg) => {
  sensorData.pump = false;
  bot.sendMessage(msg.chat.id, '⭕ Main Pump OFF');
});

bot.onText(/\/lampu_on/, (msg) => {
  sensorData.light = true;
  bot.sendMessage(msg.chat.id, '✅ Grow Light ON');
});

bot.onText(/\/lampu_off/, (msg) => {
  sensorData.light = false;
  bot.sendMessage(msg.chat.id, '⭕ Grow Light OFF');
});

// =============================================
//   START
// =============================================
app.listen(PORT, () => {
  console.log('HydroBot Server running on port ' + PORT);
  bot.sendMessage(CHAT_ID, '🌿 HydroBot Server aktif! Ketik /status untuk cek data.')
    .catch(err => console.log('Notify error:', err.message));
});
