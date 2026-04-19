const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { createCanvas } = require('canvas');

const app = express();
app.use(express.json());

// =============================================
//   CONFIG — isi via Environment Variables
// =============================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =============================================
//   DATA STORE (in-memory)
// =============================================
let sensorData = {
  suhu_udara: 28.5,
  kelembaban: 65,
  suhu_air: 24.2,
  ph: 6.2,
  tds: 850,
  level_air: 74,
  pump: true,
  light: true,
  dosing: false,
  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
};

// pH history untuk grafik (6 data terakhir)
let phHistory = [6.1, 6.2, 6.3, 6.4, 6.5, 6.2];
let hours = ['10', '11', '12', '13', '14', '15'];

// =============================================
//   GENERATE GAMBAR STATUS
// =============================================
function generateStatusImage(data) {
  const width = 520;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071a0a');
  bgGrad.addColorStop(0.5, '#0a1f10');
  bgGrad.addColorStop(1, '#061510');
  ctx.fillStyle = bgGrad;
  ctx.roundRect(0, 0, width, height, 20);
  ctx.fill();

  // Glow top-right
  const glow = ctx.createRadialGradient(width - 80, 80, 0, width - 80, 80, 160);
  glow.addColorStop(0, 'rgba(74,222,128,0.08)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = 'rgba(74,222,128,0.2)';
  ctx.lineWidth = 1.5;
  ctx.roundRect(1, 1, width - 2, height - 2, 20);
  ctx.stroke();

  // ── HEADER ──
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('🌿 HYDROBOT NFT', 24, 44);

  ctx.fillStyle = 'rgba(107,143,107,0.8)';
  ctx.font = '11px monospace';
  ctx.fillText('REAL-TIME MONITORING SYSTEM', 26, 64);

  // LIVE badge
  ctx.fillStyle = 'rgba(74,222,128,0.12)';
  ctx.strokeStyle = 'rgba(74,222,128,0.25)';
  ctx.lineWidth = 1;
  ctx.roundRect(width - 90, 28, 68, 24, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('● LIVE', width - 76, 44);

  // Divider
  ctx.strokeStyle = 'rgba(74,222,128,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 80);
  ctx.lineTo(width - 24, 80);
  ctx.stroke();

  // ── SENSOR GRID (3x2) ──
  const metrics = [
    { icon: '⚗️', label: 'pH', value: data.ph.toFixed(1), unit: '', status: data.ph >= 5.5 && data.ph <= 6.5 ? 'ok' : 'warn' },
    { icon: '📊', label: 'TDS', value: data.tds, unit: 'ppm', status: data.tds >= 700 && data.tds <= 1200 ? 'ok' : 'warn' },
    { icon: '📏', label: 'Level Air', value: data.level_air + '%', unit: '', status: 'info' },
    { icon: '🌡️', label: 'Suhu Udara', value: data.suhu_udara + '°C', unit: '', status: 'ok' },
    { icon: '🌊', label: 'Suhu Air', value: data.suhu_air + '°C', unit: '', status: 'ok' },
    { icon: '💧', label: 'Kelembaban', value: data.kelembaban + '%', unit: '', status: 'ok' },
  ];

  const cardW = 148;
  const cardH = 80;
  const startX = 24;
  const startY = 96;
  const gapX = 16;
  const gapY = 12;

  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card bg
    const isWarn = m.status === 'warn';
    ctx.fillStyle = isWarn ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.03)';
    ctx.strokeStyle = isWarn ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.1)';
    ctx.lineWidth = 1;
    ctx.roundRect(x, y, cardW, cardH, 10);
    ctx.fill();
    ctx.stroke();

    // Value color
    const valColor = m.status === 'ok' ? '#4ade80' : m.status === 'warn' ? '#fbbf24' : '#60a5fa';

    ctx.font = '18px monospace';
    ctx.fillText(m.icon, x + 12, y + 28);

    ctx.fillStyle = valColor;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(m.value, x + 12, y + 54);

    ctx.fillStyle = 'rgba(107,143,107,0.7)';
    ctx.font = '10px monospace';
    ctx.fillText(m.label, x + 12, y + 70);

    if (isWarn) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('⚠️', x + cardW - 24, y + 18);
    }
  });

  // ── MINI BAR CHART pH ──
  const chartY = 310;
  ctx.fillStyle = 'rgba(107,143,107,0.6)';
  ctx.font = '10px monospace';
  ctx.fillText('📈 TREN pH — 6 JAM TERAKHIR', 24, chartY);

  const barAreaY = chartY + 12;
  const barAreaH = 50;
  const barW = 52;
  const barGap = 28;
  const maxPH = 7.5;
  const minPH = 5.0;

  phHistory.forEach((ph, i) => {
    const x = 24 + i * (barW + barGap);
    const ratio = (ph - minPH) / (maxPH - minPH);
    const barH = ratio * barAreaH;
    const y = barAreaY + (barAreaH - barH);

    const isHigh = ph > 6.5;
    const barColor = isHigh ? 'rgba(248,113,113,0.7)' : ph > 6.0 ? 'rgba(251,191,36,0.6)' : 'rgba(74,222,128,0.6)';

    ctx.fillStyle = barColor;
    ctx.roundRect(x, y, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(200,216,228,0.6)';
    ctx.font = '10px monospace';
    ctx.fillText(ph.toFixed(1), x + 8, y - 4);

    ctx.fillStyle = 'rgba(107,143,107,0.5)';
    ctx.font = '9px monospace';
    ctx.fillText(hours[i], x + 18, barAreaY + barAreaH + 14);
  });

  // Divider
  ctx.strokeStyle = 'rgba(74,222,128,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 400);
  ctx.lineTo(width - 24, 400);
  ctx.stroke();

  // ── AKTUATOR ──
  ctx.fillStyle = 'rgba(107,143,107,0.6)';
  ctx.font = '10px monospace';
  ctx.fillText('⚡ STATUS AKTUATOR', 24, 420);

  const actuators = [
    { icon: '🔄', label: 'Main Pump', state: data.pump },
    { icon: '💡', label: 'Grow Light', state: data.light },
    { icon: '💊', label: 'Dosing', state: data.dosing },
    { icon: '🧪', label: 'pH Down', state: false },
  ];

  const actW = 106;
  actuators.forEach((a, i) => {
    const x = 24 + i * (actW + 12);
    const y = 430;

    ctx.fillStyle = a.state ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)';
    ctx.strokeStyle = a.state ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.roundRect(x, y, actW, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '16px monospace';
    ctx.fillText(a.icon, x + 10, y + 24);

    ctx.fillStyle = 'rgba(107,143,107,0.7)';
    ctx.font = '9px monospace';
    ctx.fillText(a.label, x + 10, y + 40);

    ctx.fillStyle = a.state ? '#4ade80' : 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(a.state ? '● ON' : '○ OFF', x + 10, y + 54);
  });

  // ── FOOTER ──
  ctx.strokeStyle = 'rgba(74,222,128,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 502);
  ctx.lineTo(width - 24, 502);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,143,107,0.5)';
  ctx.font = '10px monospace';
  ctx.fillText('⏰ Update: ' + data.timestamp, 24, 522);

  ctx.fillStyle = 'rgba(74,222,128,0.3)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('SMARTFARMER AI', width - 130, 522);

  return canvas.toBuffer('image/png');
}

// =============================================
//   ENDPOINT — terima data dari ESP8266
// =============================================
app.post('/data', (req, res) => {
  const d = req.body;

  if (d.suhu_udara) sensorData.suhu_udara = parseFloat(d.suhu_udara);
  if (d.kelembaban) sensorData.kelembaban = parseFloat(d.kelembaban);
  if (d.suhu_air) sensorData.suhu_air = parseFloat(d.suhu_air);
  if (d.ph) {
    sensorData.ph = parseFloat(d.ph);
    phHistory.push(parseFloat(d.ph));
    if (phHistory.length > 6) phHistory.shift();
    const now = new Date();
    hours.push(now.getHours().toString());
    if (hours.length > 6) hours.shift();
  }
  if (d.tds) sensorData.tds = parseFloat(d.tds);
  if (d.level_air) sensorData.level_air = parseFloat(d.level_air);
  if (d.pump !== undefined) sensorData.pump = d.pump === true || d.pump === 'true';
  if (d.light !== undefined) sensorData.light = d.light === true || d.light === 'true';

  sensorData.timestamp = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  // Cek alert otomatis
  let alerts = [];
  if (sensorData.ph < 5.5) alerts.push(`⚠️ pH terlalu RENDAH: ${sensorData.ph}`);
  if (sensorData.ph > 6.5) alerts.push(`⚠️ pH terlalu TINGGI: ${sensorData.ph}`);
  if (sensorData.tds < 600) alerts.push(`⚠️ Nutrisi KURANG: ${sensorData.tds} ppm`);
  if (sensorData.level_air < 20) alerts.push(`🚨 Air KRITIS: ${sensorData.level_air}%`);

  if (alerts.length > 0) {
    const alertMsg = `🚨 *PERINGATAN HYDROBOT*\n\n${alerts.join('\n')}\n\n_Segera periksa sistem\\!_`;
    bot.sendMessage(CHAT_ID, alertMsg, { parse_mode: 'MarkdownV2' });
  }

  res.json({ status: 'ok', received: sensorData });
});

// Endpoint health check
app.get('/', (req, res) => {
  res.json({ status: 'HydroBot Server Running 🌿', uptime: process.uptime() });
});

// =============================================
//   TELEGRAM BOT COMMANDS
// =============================================
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    const imgBuffer = generateStatusImage(sensorData);
    await bot.sendPhoto(chatId, imgBuffer, {
      caption: `🌿 *HydroBot NFT* — Status terkini\n⏰ ${sensorData.timestamp}`,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ Gagal generate gambar. Coba lagi.');
  }
});

bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, '🏓 Pong\\! Server aktif\\.', { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/pompa_on/, (msg) => {
  sensorData.pump = true;
  bot.sendMessage(msg.chat.id, '✅ Main Pump *ON*', { parse_mode: 'Markdown' });
});

bot.onText(/\/pompa_off/, (msg) => {
  sensorData.pump = false;
  bot.sendMessage(msg.chat.id, '⭕ Main Pump *OFF*', { parse_mode: 'Markdown' });
});

bot.onText(/\/lampu_on/, (msg) => {
  sensorData.light = true;
  bot.sendMessage(msg.chat.id, '✅ Grow Light *ON*', { parse_mode: 'Markdown' });
});

bot.onText(/\/lampu_off/, (msg) => {
  sensorData.light = false;
  bot.sendMessage(msg.chat.id, '⭕ Grow Light *OFF*', { parse_mode: 'Markdown' });
});

bot.onText(/\/start/, (msg) => {
  const welcome = `🌿 *Selamat datang di HydroBot NFT\\!*\n\nPerintah yang tersedia:\n/status — Lihat status sensor\n/pompa\\_on — Nyalakan pompa\n/pompa\\_off — Matikan pompa\n/lampu\\_on — Nyalakan grow light\n/lampu\\_off — Matikan grow light\n/ping — Cek koneksi server`;
  bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'MarkdownV2' });
});

// =============================================
//   START SERVER
// =============================================
app.listen(PORT, () => {
  console.log(`🌿 HydroBot Server running on port ${PORT}`);
  bot.sendMessage(CHAT_ID, '🌿 *HydroBot Server aktif\\!* Ketik /status untuk cek data\\.', { parse_mode: 'MarkdownV2' })
    .catch(err => console.log('Telegram notify error:', err.message));
});
