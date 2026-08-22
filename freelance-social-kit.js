(() => {
  'use strict';

  const SOCIAL_STYLE_ID = 'gig-social-kit-styles';
  const SOCIAL_KIT_ID = 'gigSocialKit';
  const UNKNOWN_STATE_KEY = '__tanpa_negeri__';
  const POSTED_STORAGE_KEY = 'rapat_social_posted_provider_ids_v1';
  let socialProviders = [];
  let activeProviderId = '';
  let captionVariant = 0;
  let resizeObserver = null;

  const fallbackEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const esc = value => typeof window.gigEsc === 'function' ? window.gigEsc(value) : fallbackEsc(value);

  function loadPostedProviderIds() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(POSTED_STORAGE_KEY) || '[]');
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch {
      return new Set();
    }
  }

  let postedProviderIds = loadPostedProviderIds();

  function persistPostedProviderIds() {
    try {
      window.localStorage.setItem(POSTED_STORAGE_KEY, JSON.stringify(Array.from(postedProviderIds)));
    } catch (error) {
      console.warn('Unable to save posted provider status.', error);
    }
  }

  function isProviderPosted(provider) {
    return postedProviderIds.has(String(provider?.id ?? ''));
  }

  function providerStateKey(provider) {
    const state = String(provider?.state || '').trim();
    return state ? state.toLocaleLowerCase('ms') : UNKNOWN_STATE_KEY;
  }

  function interleaveProvidersByState(providers) {
    const groups = new Map();

    providers.forEach(provider => {
      const key = providerStateKey(provider);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(provider);
    });

    groups.forEach(group => {
      group.sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'ms'));
    });

    const stateKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === UNKNOWN_STATE_KEY) return 1;
      if (b === UNKNOWN_STATE_KEY) return -1;
      return a.localeCompare(b, 'ms');
    });

    const ordered = [];
    let round = 0;
    let added = true;

    while (added) {
      added = false;
      stateKeys.forEach(key => {
        const provider = groups.get(key)?.[round];
        if (!provider) return;
        ordered.push(provider);
        added = true;
      });
      round += 1;
    }

    return ordered;
  }

  function injectStyles() {
    if (document.getElementById(SOCIAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SOCIAL_STYLE_ID;
    style.textContent = `
      .gig-social-kit{margin-top:16px}
      .gig-social-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .gig-social-controls{display:grid;grid-template-columns:minmax(220px,1.2fr) minmax(220px,1fr) auto;gap:10px;align-items:end;margin-top:16px}
      .gig-social-controls .field{margin:0}
      .gig-social-grid{display:grid;grid-template-columns:minmax(320px,540px) minmax(300px,1fr);gap:22px;align-items:start;margin-top:18px}
      .gig-social-stage{position:relative;width:100%;max-width:540px;aspect-ratio:1;overflow:hidden;border:1px solid #e4eaf2;border-radius:22px;background:#f4f6f9;box-shadow:0 12px 34px rgba(31,45,61,.08)}
      .rapat-social-card{position:absolute;left:0;top:0;width:1080px;height:1080px;box-sizing:border-box;overflow:hidden;background:#fff;color:#101828;font-family:Inter,Arial,sans-serif;padding:82px 84px 76px;transform-origin:top left}
      .rapat-social-card *{box-sizing:border-box}
      .rapat-social-accent{position:absolute;right:-165px;top:-175px;width:470px;height:470px;border-radius:50%;background:#f5c84b}
      .rapat-social-accent2{position:absolute;right:-95px;bottom:-160px;width:360px;height:360px;border-radius:50%;background:#e84c4f}
      .rapat-social-top{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}
      .rapat-social-brand{font-size:54px;line-height:1;font-weight:900;letter-spacing:-3px;color:#111827}
      .rapat-social-brand .p{color:#e84c4f}.rapat-social-brand .a{color:#e5ad18}
      .rapat-social-hash{font-size:24px;font-weight:800;letter-spacing:.3px;background:#f7f8fa;border:1px solid #e7eaf0;border-radius:999px;padding:14px 22px}
      .rapat-social-body{position:relative;z-index:2;margin-top:120px;max-width:820px}
      .rapat-social-kicker{display:inline-block;font-size:23px;line-height:1;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#d63f44;margin-bottom:24px}
      .rapat-social-service{font-size:72px;line-height:1.04;letter-spacing:-3.2px;font-weight:900;margin:0;overflow-wrap:anywhere}
      .rapat-social-provider{font-size:38px;line-height:1.2;font-weight:800;margin-top:30px;overflow-wrap:anywhere}
      .rapat-social-location{display:flex;align-items:center;gap:12px;font-size:28px;line-height:1.35;font-weight:650;color:#475467;margin-top:18px}
      .rapat-social-pin{width:17px;height:17px;border-radius:50%;background:#e84c4f;box-shadow:0 0 0 7px rgba(232,76,79,.12);flex:0 0 auto}
      .rapat-social-more{font-size:24px;line-height:1.35;font-weight:650;color:#667085;margin-top:22px}
      .rapat-social-footer{position:absolute;left:84px;right:84px;bottom:76px;z-index:2;border-top:2px solid #eaecf0;padding-top:28px;display:flex;align-items:flex-end;justify-content:space-between;gap:30px}
      .rapat-social-footer-label{font-size:23px;line-height:1.35;color:#667085;font-weight:650}
      .rapat-social-url{font-size:34px;line-height:1;font-weight:900;letter-spacing:-1px}
      .gig-social-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .gig-social-caption{width:100%;min-height:250px;resize:vertical;font:15px/1.55 Inter,Arial,sans-serif}
      .gig-social-note{font-size:12px;color:#718096;margin-top:8px}
      .gig-social-toast{min-height:22px;margin-top:8px;font-size:13px;font-weight:700;color:#17803d}
      @media(max-width:900px){
        .gig-social-controls{grid-template-columns:1fr 1fr}
        .gig-social-controls .gig-social-random{grid-column:1/-1}
        .gig-social-grid{grid-template-columns:1fr}
      }
      @media(max-width:560px){
        .gig-social-controls{grid-template-columns:1fr}
        .gig-social-controls .gig-social-random{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function providerServices(provider) {
    if (!provider) return [];
    if (typeof window.gigServiceEntries === 'function') return window.gigServiceEntries(provider);
    return [];
  }

  function providerLocation(provider) {
    return [provider?.district, provider?.state].filter(Boolean).join(', ') || 'Malaysia';
  }

  function currentProvider() {
    return socialProviders.find(provider => provider.id === activeProviderId) || socialProviders[0] || null;
  }

  function currentService() {
    const select = document.getElementById('gigSocialService');
    const provider = currentProvider();
    const services = providerServices(provider);
    if (!services.length) return { category: 'Servis Lokal', name: 'Penyedia Servis' };
    return services.find((_, index) => String(index) === String(select?.value)) || services[0];
  }

  function mountSocialKit() {
    injectStyles();
    const view = document.getElementById('view-gig');
    if (!view || document.getElementById(SOCIAL_KIT_ID)) return;

    const panel = document.createElement('div');
    panel.id = SOCIAL_KIT_ID;
    panel.className = 'panel gig-social-kit';
    panel.innerHTML = `
      <div class="gig-social-head">
        <div>
          <div class="eyebrow">Social Content Kit</div>
          <h2 style="margin-bottom:6px">#RAPATkanRezeki</h2>
          <p class="muted" style="margin:0">Provider disusun berselang-seli ikut negeri supaya content lebih seimbang. Provider yang sudah dipost akan dikeluarkan daripada giliran.</p>
        </div>
      </div>

      <div class="gig-social-controls">
        <div class="field">
          <label>Service Provider</label>
          <select id="gigSocialProvider" onchange="gigSocialSelectProvider(this.value)"></select>
        </div>
        <div class="field">
          <label>Servis untuk diketengahkan</label>
          <select id="gigSocialService" onchange="gigSocialRender()"></select>
        </div>
        <button class="btn light gig-social-random" type="button" onclick="gigSocialPickRandom()">Provider Seterusnya</button>
      </div>

      <div id="gigSocialEmpty" class="empty" style="display:none;margin-top:16px">Belum ada provider approved & published yang belum dipost.</div>

      <div id="gigSocialWorkspace" class="gig-social-grid" style="display:none">
        <div>
          <div id="gigSocialStage" class="gig-social-stage">
            <div id="gigSocialCard" class="rapat-social-card"></div>
          </div>
          <div class="gig-social-actions">
            <button class="btn primary" type="button" onclick="gigSocialDownload()">Download PNG</button>
            <button class="btn light" type="button" onclick="gigSocialMarkPosted()">✓ Dah Posted</button>
          </div>
          <div class="gig-social-note">1080 × 1080 px · RAPAT branding sahaja · status posted disimpan pada browser ini</div>
        </div>

        <div>
          <div class="field" style="margin-top:0">
            <label>Copywriting</label>
            <textarea id="gigSocialCaption" class="gig-social-caption"></textarea>
          </div>
          <div class="gig-social-actions">
            <button class="btn primary" type="button" onclick="gigSocialCopyCaption()">Copy Caption</button>
            <button class="btn light" type="button" onclick="gigSocialNextCaption()">Tukar Ayat</button>
          </div>
          <div id="gigSocialToast" class="gig-social-toast" aria-live="polite"></div>
        </div>
      </div>
    `;

    const opsHead = view.querySelector('.gig-manage-head');
    if (opsHead) opsHead.before(panel);
    else view.appendChild(panel);

    const stage = document.getElementById('gigSocialStage');
    if (stage && window.ResizeObserver) {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(scaleCardPreview);
      resizeObserver.observe(stage);
    }
  }

  function syncProviderOptions() {
    mountSocialKit();
    const providerSelect = document.getElementById('gigSocialProvider');
    const empty = document.getElementById('gigSocialEmpty');
    const workspace = document.getElementById('gigSocialWorkspace');
    if (!providerSelect || !empty || !workspace) return;

    if (!socialProviders.length) {
      providerSelect.innerHTML = '<option value="">Tiada provider</option>';
      activeProviderId = '';
      empty.style.display = 'block';
      workspace.style.display = 'none';
      return;
    }

    if (!socialProviders.some(provider => provider.id === activeProviderId)) activeProviderId = socialProviders[0].id;

    providerSelect.innerHTML = socialProviders.map(provider => (
      `<option value="${esc(provider.id)}" ${provider.id === activeProviderId ? 'selected' : ''}>${esc(provider.display_name || 'Provider')} · ${esc(providerLocation(provider))}</option>`
    )).join('');

    empty.style.display = 'none';
    workspace.style.display = 'grid';
    syncServiceOptions();
  }

  function syncServiceOptions() {
    const provider = currentProvider();
    const serviceSelect = document.getElementById('gigSocialService');
    if (!provider || !serviceSelect) return;

    const services = providerServices(provider);
    serviceSelect.innerHTML = services.length
      ? services.map((service, index) => `<option value="${index}">${esc(service.name)}${service.category ? ` · ${esc(service.category)}` : ''}</option>`).join('')
      : '<option value="0">Penyedia Servis</option>';

    captionVariant = Math.abs(hashString(provider.id)) % 3;
    renderSocialKit();
  }

  function hashString(value) {
    let hash = 0;
    for (const char of String(value || '')) hash = ((hash << 5) - hash) + char.charCodeAt(0);
    return hash | 0;
  }

  function socialCardMarkup(provider, service) {
    const location = providerLocation(provider);
    const allServices = providerServices(provider);
    const otherCount = Math.max(0, allServices.length - 1);
    const serviceName = service?.name || 'Penyedia Servis';
    const category = service?.category && service.category !== 'Lain-lain' ? service.category : 'Servis Lokal';

    return `
      <div class="rapat-social-accent"></div>
      <div class="rapat-social-accent2"></div>
      <div class="rapat-social-top">
        <div class="rapat-social-brand">RA<span class="p">P</span><span class="a">A</span>T<span style="font-size:.48em;letter-spacing:-1px">.my</span></div>
        <div class="rapat-social-hash">#RAPATkanRezeki</div>
      </div>
      <div class="rapat-social-body">
        <div class="rapat-social-kicker">${esc(category)}</div>
        <h3 class="rapat-social-service">${esc(serviceName)}</h3>
        <div class="rapat-social-provider">${esc(provider?.display_name || 'Penyedia Servis')}</div>
        <div class="rapat-social-location"><span class="rapat-social-pin"></span><span>${esc(location)}</span></div>
        ${otherCount ? `<div class="rapat-social-more">Turut menawarkan ${otherCount} servis lain di RAPAT.</div>` : ''}
      </div>
      <div class="rapat-social-footer">
        <div class="rapat-social-footer-label">Cari & sokong<br>penyedia servis lokal.</div>
        <div class="rapat-social-url">RAPAT.my</div>
      </div>
    `;
  }

  function captionFor(provider, service, variant) {
    const name = provider?.display_name || 'penyedia servis ini';
    const serviceName = service?.name || 'servis tempatan';
    const location = providerLocation(provider);
    const templates = [
      `#RAPATkanRezeki\n\nHari ini kita kenalkan ${name}, yang menawarkan servis ${serviceName} sekitar ${location}.\n\nKalau anda sedang mencari servis ini, boleh semak penyedia servis di RAPAT.my.\n\nTak perlukan sekarang? Share pun mungkin boleh bantu rezeki orang lokal. 🤝\n\n#ServisLokal #RAPAT`,
      `${location}, tengah cari ${serviceName}?\n\nKenali ${name}, salah satu penyedia servis yang tersenarai di RAPAT.my.\n\nSimpan atau kongsikan post ini—mungkin ada orang dalam circle anda yang sedang mencari servis macam ni.\n\n#RAPATkanRezeki #ServisLokal`,
      `Support servis lokal hari ini. 🙌\n\n${name} menawarkan ${serviceName} sekitar ${location} dan kini boleh ditemui melalui RAPAT.my.\n\nKalau kenal orang yang perlukan servis ini, tolong tag atau share.\n\n#RAPATkanRezeki #RAPAT`
    ];
    return templates[((variant % templates.length) + templates.length) % templates.length];
  }

  function renderSocialKit() {
    const provider = currentProvider();
    const card = document.getElementById('gigSocialCard');
    const caption = document.getElementById('gigSocialCaption');
    if (!provider || !card || !caption) return;

    const service = currentService();
    card.innerHTML = socialCardMarkup(provider, service);
    caption.value = captionFor(provider, service, captionVariant);
    requestAnimationFrame(scaleCardPreview);
  }

  function scaleCardPreview() {
    const stage = document.getElementById('gigSocialStage');
    const card = document.getElementById('gigSocialCard');
    if (!stage || !card) return;
    const scale = Math.max(0.1, stage.clientWidth / 1080);
    card.style.transform = `scale(${scale})`;
  }

  function selectProvider(providerId) {
    activeProviderId = providerId;
    const providerSelect = document.getElementById('gigSocialProvider');
    if (providerSelect) providerSelect.value = providerId;
    syncServiceOptions();
  }

  function findNextProviderAvoidingState(stateKey, startIndex = 0) {
    if (!socialProviders.length) return null;
    const safeStart = ((startIndex % socialProviders.length) + socialProviders.length) % socialProviders.length;

    for (let offset = 0; offset < socialProviders.length; offset += 1) {
      const candidate = socialProviders[(safeStart + offset) % socialProviders.length];
      if (providerStateKey(candidate) !== stateKey) return candidate;
    }

    return socialProviders[safeStart] || socialProviders[0] || null;
  }

  function pickNextProvider() {
    if (!socialProviders.length) return;
    const current = currentProvider();
    const currentIndex = socialProviders.findIndex(provider => provider.id === activeProviderId);
    const startIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % socialProviders.length;
    const next = findNextProviderAvoidingState(providerStateKey(current), startIndex);
    if (next) selectProvider(next.id);
  }

  function markCurrentProviderPosted() {
    const provider = currentProvider();
    if (!provider) return;

    const providerId = String(provider.id ?? '');
    const previousStateKey = providerStateKey(provider);
    const currentIndex = socialProviders.findIndex(item => String(item.id) === providerId);
    postedProviderIds.add(providerId);
    persistPostedProviderIds();
    socialProviders = socialProviders.filter(item => String(item.id) !== providerId);

    if (!socialProviders.length) {
      activeProviderId = '';
      syncProviderOptions();
      return;
    }

    const startIndex = currentIndex < 0 || currentIndex >= socialProviders.length ? 0 : currentIndex;
    const next = findNextProviderAvoidingState(previousStateKey, startIndex);
    activeProviderId = next?.id || socialProviders[0].id;
    syncProviderOptions();
    showToast('Provider ditanda dah posted. Negeri lain dipilih seterusnya.');
  }

  function nextCaption() {
    captionVariant = (captionVariant + 1) % 3;
    renderSocialKit();
  }

  function showToast(message) {
    const toast = document.getElementById('gigSocialToast');
    if (!toast) return;
    toast.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { if (toast) toast.textContent = ''; }, 2200);
  }

  async function copyCaption() {
    const field = document.getElementById('gigSocialCaption');
    if (!field) return;
    const text = field.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      field.focus();
      field.select();
      document.execCommand('copy');
      field.setSelectionRange(text.length, text.length);
    }
    showToast('Caption copied.');
  }

  function inlineComputedStyles(source, target) {
    const computed = window.getComputedStyle(source);
    let css = '';
    for (const property of computed) css += `${property}:${computed.getPropertyValue(property)};`;
    target.setAttribute('style', css);

    const sourceChildren = Array.from(source.children);
    const targetChildren = Array.from(target.children);
    sourceChildren.forEach((child, index) => {
      if (targetChildren[index]) inlineComputedStyles(child, targetChildren[index]);
    });
  }

  async function downloadPng() {
    const source = document.getElementById('gigSocialCard');
    const provider = currentProvider();
    if (!source || !provider) return;

    const clone = source.cloneNode(true);
    inlineComputedStyles(source, clone);
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top left';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';

    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
        <foreignObject x="0" y="0" width="1080" height="1080">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:1080px;height:1080px">${serialized}</div>
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 1080, 1080);
      context.drawImage(image, 0, 0, 1080, 1080);

      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
      if (!pngBlob) throw new Error('PNG generation failed');

      const downloadUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      const safeName = String(provider.display_name || 'provider').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'provider';
      link.href = downloadUrl;
      link.download = `rapat-${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      showToast('PNG ready.');
    } catch (error) {
      console.error(error);
      alert('Gagal generate PNG. Cuba refresh dan generate semula.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function hookProviderRenderer() {
    const original = window.renderGigProviders;
    if (typeof original !== 'function' || original.__rapatSocialHook) return;

    function wrappedRenderGigProviders(rows) {
      const eligibleProviders = (Array.isArray(rows) ? rows : [])
        .filter(provider => provider.status === 'approved' && provider.is_published)
        .filter(provider => !isProviderPosted(provider));

      socialProviders = interleaveProvidersByState(eligibleProviders);

      const result = original(rows);
      syncProviderOptions();
      return result;
    }

    wrappedRenderGigProviders.__rapatSocialHook = true;
    window.renderGigProviders = wrappedRenderGigProviders;
  }

  window.gigSocialSelectProvider = selectProvider;
  window.gigSocialPickRandom = pickNextProvider;
  window.gigSocialMarkPosted = markCurrentProviderPosted;
  window.gigSocialRender = renderSocialKit;
  window.gigSocialNextCaption = nextCaption;
  window.gigSocialCopyCaption = copyCaption;
  window.gigSocialDownload = downloadPng;

  injectStyles();
  mountSocialKit();
  hookProviderRenderer();

  if (typeof window.renderGigProviders !== 'function') {
    window.addEventListener('load', () => {
      mountSocialKit();
      hookProviderRenderer();
    }, { once: true });
  }
})();
