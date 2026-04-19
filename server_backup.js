function generateStatusImage(data) {
  const width = 720;
  const height = 920;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // =========================
  // BACKGROUND
  // =========================
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#05060a');
  bg.addColorStop(0.5, '#0b1220');
  bg.addColorStop(1, '#05060a');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Glow
  const glow = ctx.createRadialGradient(620, 80, 0, 620, 80, 220);
  glow.addColorStop(0, 'rgba(0,255,180,0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // =========================
  // HEADER
  // =========================
  ctx.fillStyle = '#00ffb3';
  ctx.font = 'bold 34px Arial';
  ctx.fillText('HYDROBOT PRO X', 28, 48);

  ctx.fillStyle = '#9aa4b2';
  ctx.font = '16px Arial';
  ctx.fillText('AI SMART HYDROPONIC MONITORING', 30, 72);

  // LIVE Badge
  roundRect(ctx, 560, 28, 120, 38, 12, '#11281f', '#00ff99');
  ctx.fillStyle = '#00ff99';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('● LIVE', 585, 53);

  line(ctx, 25, 95, width - 25, 95);

  // =========================
  // SENSOR CARDS
  // =========================
  const cards = [
    ['pH', data.ph.toFixed(2), '#00ff99'],
    ['TDS', data.tds + ' ppm', '#00d9ff'],
    ['Water Temp', data.suhu_air + '°C', '#00ff99'],
    ['Air Temp', data.suhu_udara + '°C', '#ffd000'],
    ['Humidity', data.kelembaban + '%', '#ff7b00'],
    ['Water Level', data.level_air + '%', '#b86bff']
  ];

  let x = 28;
  let y = 120;

  cards.forEach((c, i) => {
    premiumCard(ctx, x, y, 205, 105, c[0], c[1], c[2]);

    x += 230;
    if ((i + 1) % 3 === 0) {
      x = 28;
      y += 130;
    }
  });

  // =========================
  // STATUS SYSTEM
  // =========================
  line(ctx, 25, 410, width - 25, 410);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('SYSTEM STATUS', 28, 442);

  const stat = [
    ['Pump', data.pump],
    ['Light', data.light],
    ['Dosing', data.dosing],
    ['Server', true]
  ];

  let sx = 28;
  stat.forEach((s) => {
    statusBox(ctx, sx, 465, 155, 72, s[0], s[1]);
    sx += 170;
  });

  // =========================
  // AI ANALYSIS
  // =========================
  line(ctx, 25, 575, width - 25, 575);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('AI ANALYSIS', 28, 607);

  let rekom = 'All parameters stable.';
  if (data.ph < 5.5) rekom = 'pH too low. Add pH Up.';
  if (data.ph > 6.5) rekom = 'pH too high. Add pH Down.';
  if (data.level_air < 20) rekom = 'Water level critical.';
  if (data.tds < 700) rekom = 'Nutrient concentration low.';

  roundRect(ctx, 28, 625, 664, 110, 18, '#101826', '#00ff99');

  ctx.fillStyle = '#9ae6b4';
  ctx.font = '18px Arial';
  wrapText(ctx, rekom, 45, 670, 620, 28);

  // =========================
  // FOOTER
  // =========================
  line(ctx, 25, 790, width - 25, 790);

  ctx.fillStyle = '#6b7280';
  ctx.font = '16px Arial';
  ctx.fillText('Updated: ' + data.timestamp, 28, 835);

  ctx.fillStyle = '#00ff99';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('SMARTFARMER AI ENGINE', 455, 835);

  return canvas.toBuffer('image/png');
}

// =========================
// HELPER FUNCTIONS
// =========================
function line(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function premiumCard(ctx, x, y, w, h, title, value, color) {
  roundRect(ctx, x, y, w, h, 18, '#0d1320', color);

  ctx.fillStyle = '#9aa4b2';
  ctx.font = '16px Arial';
  ctx.fillText(title, x + 16, y + 28);

  ctx.fillStyle = color;
  ctx.font = 'bold 28px Arial';
  ctx.fillText(value, x + 16, y + 72);
}

function statusBox(ctx, x, y, w, h, label, on) {
  roundRect(
    ctx,
    x,
    y,
    w,
    h,
    14,
    '#111827',
    on ? '#00ff99' : '#444'
  );

  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial';
  ctx.fillText(label, x + 15, y + 28);

  ctx.fillStyle = on ? '#00ff99' : '#999';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(on ? 'ON' : 'OFF', x + 15, y + 56);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
