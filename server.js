const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Data sensor
let data = {
  suhu_udara: 28.5,
  kelembaban: 65,
  suhu_air: 24.2,
  ph: 6.2,
  tds: 850,
  level_air: 74,
  pump: true,
  light: true,
  dosing: false
};

// Format pesan status
function statusMsg() {
  const phOk = data.ph >= 5.5 && data.ph <= 6.5;
  const tdsOk = data.tds >= 700 && data.tds <= 1200;
  const now = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  });

  return `🌿 *HYDROBOT NFT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌡️ Suhu Udara  : ${data.suhu_udara}°C\n` +
    `💧 Kelembaban  : ${data.kelembaban}%\n` +
    `🌊 Suhu Air    : ${data.suhu_air}°C\n` +
    `⚗️ pH          : ${data.ph} ${phOk ? '✅' : '⚠️'}\n` +
    `📊 TDS         : ${data.tds} ppm ${tdsOk ? '✅' : '⚠️'}\n` +
    `📏 Level Air   : ${data.level_air}%\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔄 Main Pump   : ${data.pump ? 'ON ✅' : 'OFF ⭕'}\n` +
    `💡 Grow Light  : ${data.light ? 'ON ✅' : 'OFF ⭕'}\n` +
    `💊 Dosing      : ${data.dosing ? 'ON ✅' : 'OFF ⭕'}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ ${now} WIB`;
}

// Terima data dari ESP8266
app.post('/data', (req, res) => {
  const d = req.body;
  if (d.suhu_udara) data.suhu_udara = parseFloat(d.suhu_udara);
  if (d.kelembaban) data.kelembaban = parseFloat(d.kelembaban);
  if (d.suhu_air) data.suhu_air = parseFloat(d.suhu_air);
  if (d.ph) data.ph = parseFloat(d.ph);
  if (d.tds) data.tds = parseFloat(d.tds);
  if (d.level_air) data.level_air = parseFloat(d.level_air);
  if (d.pump !== undefined) data.pump = d.pump === true || d.pump === 'true';
  if (d.light !== undefined) data.light = d.light === true || d.light === 'true';
  if (d.dosing !== undefined) data.dosing = d.dosing === true || d.dosing === 'true';

  // Auto alert
  if (data.ph < 5.5) bot.sendMessage(CHAT_ID, '⚠️ pH terlalu RENDAH: ' + data.ph);
  if (data.ph > 6.5) bot.sendMessage(CHAT_ID, '⚠️ pH terlalu TINGGI: ' + data.ph);
  if (data.tds < 600) bot.sendMessage(CHAT_ID, '⚠️ Nutrisi KURANG: ' + data.tds + ' ppm');
  if (data.level_air < 20) bot.sendMessage(CHAT_ID, '🚨 Air KRITIS: ' + data.level_air + '%');

  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ status: 'HydroBot Running', uptime: process.uptime() });
});

// Telegram commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '🌿 Selamat datang di HydroBot NFT!\n\n' +
    '/status - Cek semua sensor\n' +
    '/pompa_on - Nyalakan pompa\n' +
    '/pompa_off - Matikan pompa\n' +
    '/lampu_on - Nyalakan grow light\n' +
    '/lampu_off - Matikan grow light\n' +
    '/ping - Cek koneksi'
  );
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id, statusMsg(), { parse_mode: 'Markdown' });
});

bot.onText(/\/ping/, (msg) => {
  bot.sendMessage(msg.chat.id, '🏓 Pong! Server aktif.');
});

bot.onText(/\/pompa_on/, (msg) => {
  data.pump = true;
  bot.sendMessage(msg.chat.id, '✅ Main Pump ON');
});

bot.onText(/\/pompa_off/, (msg) => {
  data.pump = false;
  bot.sendMessage(msg.chat.id, '⭕ Main Pump OFF');
});

bot.onText(/\/lampu_on/, (msg) => {
  data.light = true;
  bot.sendMessage(msg.chat.id, '✅ Grow Light ON');
});

bot.onText(/\/lampu_off/, (msg) => {
  data.light = false;
  bot.sendMessage(msg.chat.id, '⭕ Grow Light OFF');
});

app.listen(PORT, () => {
  console.log('HydroBot running on port ' + PORT);
  bot.sendMessage(CHAT_ID, '🌿 HydroBot aktif! Ketik /status untuk cek data.')
    .catch(err => console.log('Error:', err.message));
});
