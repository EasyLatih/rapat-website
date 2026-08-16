(() => {
  'use strict';

  function text(selector, fallback = '') {
    return document.querySelector(selector)?.textContent?.trim() || fallback;
  }

  function safeFilename(value) {
    return String(value || 'provider')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'provider';
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, value, maxWidth, maxLines = Infinity) {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines - 1) break;
      }
    }

    if (line && lines.length < maxLines) {
      const usedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
      const remaining = words.slice(usedWords).join(' ');
      let finalLine = remaining || line;
      if (lines.length === maxLines - 1 && ctx.measureText(finalLine).width > maxWidth) {
        while (finalLine.length > 1 && ctx.measureText(`${finalLine}…`).width > maxWidth) {
          finalLine = finalLine.slice(0, -1);
        }
        finalLine = `${finalLine.trim()}…`;
      }
      lines.push(finalLine);
    }

    return lines.slice(0, maxLines);
  }

  function drawWrapped(ctx, value, x, y, maxWidth, lineHeight, maxLines) {
    const lines = wrapLines(ctx, value, maxWidth, maxLines);
    lines.forEach((line, index) => ctx.fillText(line, x, y + (index * lineHeight)));
    return { lines, bottom: y + ((lines.length - 1) * lineHeight) };
  }

  function drawBrand(ctx) {
    const y = 122;
    let x = 84;
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 54px Arial, sans-serif';

    const parts = [
      ['RA', '#111827'],
      ['P', '#e84c4f'],
      ['A', '#e5ad18'],
      ['T', '#111827']
    ];

    parts.forEach(([part, colour]) => {
      ctx.fillStyle = colour;
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    });

    ctx.font = '800 26px Arial, sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText('.my', x + 4, y);
  }

  function drawHashtag(ctx) {
    const label = '#RAPATkanRezeki';
    ctx.font = '800 24px Arial, sans-serif';
    const width = ctx.measureText(label).width + 44;
    const height = 53;
    const x = 996 - width;
    const y = 80;

    ctx.fillStyle = '#f7f8fa';
    ctx.strokeStyle = '#e7eaf0';
    ctx.lineWidth = 1.5;
    roundedRect(ctx, x, y, width, height, 27);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 22, y + (height / 2) + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function renderCanvas() {
    const card = document.getElementById('gigSocialCard');
    if (!card) throw new Error('Social card not found');

    const category = text('#gigSocialCard .rapat-social-kicker', 'SERVIS LOKAL');
    const service = text('#gigSocialCard .rapat-social-service', 'Penyedia Servis');
    const provider = text('#gigSocialCard .rapat-social-provider', 'Penyedia Servis');
    const location = text('#gigSocialCard .rapat-social-location span:last-child', 'Malaysia');
    const more = text('#gigSocialCard .rapat-social-more', '');

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1080, 1080);

    ctx.fillStyle = '#f5c84b';
    ctx.beginPath();
    ctx.arc(1080 + 70, 60, 235, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e84c4f';
    ctx.beginPath();
    ctx.arc(1080 + 85, 1080 + 20, 180, 0, Math.PI * 2);
    ctx.fill();

    drawBrand(ctx);
    drawHashtag(ctx);

    ctx.fillStyle = '#d63f44';
    ctx.font = '900 23px Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(category.toUpperCase(), 84, 320);

    let serviceFont = 72;
    let serviceLines = [];
    do {
      ctx.font = `900 ${serviceFont}px Arial, sans-serif`;
      serviceLines = wrapLines(ctx, service, 820, 4);
      if (serviceLines.length <= 3) break;
      serviceFont -= 4;
    } while (serviceFont > 52);

    ctx.fillStyle = '#101828';
    ctx.font = `900 ${serviceFont}px Arial, sans-serif`;
    const serviceLineHeight = Math.round(serviceFont * 1.08);
    const serviceBlock = drawWrapped(ctx, service, 84, 402, 820, serviceLineHeight, 4);

    let cursorY = serviceBlock.bottom + 58;
    ctx.font = '800 38px Arial, sans-serif';
    ctx.fillStyle = '#101828';
    const providerBlock = drawWrapped(ctx, provider, 84, cursorY, 820, 46, 2);
    cursorY = providerBlock.bottom + 48;

    ctx.fillStyle = 'rgba(232,76,79,.14)';
    ctx.beginPath();
    ctx.arc(93, cursorY - 7, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e84c4f';
    ctx.beginPath();
    ctx.arc(93, cursorY - 7, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '650 28px Arial, sans-serif';
    ctx.fillStyle = '#475467';
    const locationBlock = drawWrapped(ctx, location, 120, cursorY, 780, 36, 2);
    cursorY = locationBlock.bottom + 42;

    if (more && cursorY < 820) {
      ctx.font = '650 24px Arial, sans-serif';
      ctx.fillStyle = '#667085';
      drawWrapped(ctx, more, 84, cursorY, 800, 32, 2);
    }

    ctx.strokeStyle = '#eaecf0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 900);
    ctx.lineTo(996, 900);
    ctx.stroke();

    ctx.fillStyle = '#667085';
    ctx.font = '650 23px Arial, sans-serif';
    ctx.fillText('Cari & sokong', 84, 948);
    ctx.fillText('penyedia servis lokal.', 84, 980);

    ctx.fillStyle = '#101828';
    ctx.font = '900 34px Arial, sans-serif';
    const url = 'RAPAT.my';
    ctx.fillText(url, 996 - ctx.measureText(url).width, 976);

    return { canvas, provider };
  }

  function dataUrlToFile(dataUrl, filename) {
    const [meta, data] = dataUrl.split(',');
    const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/png';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  function toast(message) {
    const node = document.getElementById('gigSocialToast');
    if (!node) return;
    node.textContent = message;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { node.textContent = ''; }, 4500);
  }

  async function downloadCanvasPng() {
    try {
      const { canvas, provider } = renderCanvas();
      const filename = `rapat-${safeFilename(provider)}.png`;
      const dataUrl = canvas.toDataURL('image/png', 1);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS && navigator.share && navigator.canShare) {
        const file = dataUrlToFile(dataUrl, filename);
        if (navigator.canShare({ files: [file] })) {
          try {
            toast('Pilih Save Image atau Save to Files.');
            await navigator.share({ files: [file], title: 'RAPAT Social Card' });
            return;
          } catch (error) {
            if (error?.name === 'AbortError') return;
            console.warn('Native share failed, using download fallback.', error);
          }
        }
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('PNG downloaded.');

      if (isIOS) {
        window.setTimeout(() => {
          if (document.visibilityState === 'visible') toast('Jika tiada fail keluar, tekan semula dan pilih Save Image / Save to Files.');
        }, 900);
      }
    } catch (error) {
      console.error('RAPAT PNG export failed:', error);
      alert('Download PNG gagal. Refresh page dan cuba semula.');
    }
  }

  function improveIOSHint() {
    const note = document.querySelector('#gigSocialKit .gig-social-note');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (note && isIOS) note.textContent = '1080 × 1080 px · iPhone: tekan Download PNG, kemudian pilih Save Image atau Save to Files.';
  }

  window.gigSocialDownload = downloadCanvasPng;
  improveIOSHint();
  window.addEventListener('load', improveIOSHint, { once: true });
})();