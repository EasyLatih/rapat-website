import { db, escapeHtml } from './gig-config.js';

const $ = id => document.getElementById(id);
let decorating = false;
let queued = null;

function providerMetaHtml(provider, declaredMalaysian = false) {
  const list = Array.isArray(provider.services) ? provider.services : [];
  const primary = list.find(service => service?.is_main === true) || list[0] || null;
  const extra = Math.max(0, list.length - (primary ? 1 : 0));
  const serviceLine = primary
    ? `${escapeHtml(primary.category || 'Lain-lain')} · ${escapeHtml(primary.name || 'Servis')}`
    : 'Servis belum dinyatakan';
  const location = [provider.district, provider.state].filter(Boolean).map(escapeHtml).join(', ');

  return `
    ${declaredMalaysian ? `<div><span class="provider-citizenship-badge" title="Status ini diisytihar sendiri oleh penyedia servis dan bukan pengesahan identiti oleh RAPAT.my.">🇲🇾 Diisytihar Warganegara Malaysia</span></div>` : ''}
    <div class="provider-service-line">${serviceLine}${extra ? ` <span class="provider-more">+${extra} lagi servis</span>` : ''}</div>
    ${location ? `<div class="provider-location-line">${location}</div>` : ''}`;
}

async function decorateCards() {
  if (decorating) return;
  const listEl = $('providerList');
  const cards = listEl ? [...listEl.querySelectorAll('.provider-card')] : [];
  if (!cards.length || cards.every(card => card.dataset.metaReady === '1')) return;

  decorating = true;
  try {
    const visibleProviders = Array.isArray(window.__rapatVisibleProviders) ? window.__rapatVisibleProviders : [];
    const byId = new Map(visibleProviders.map(provider => [String(provider.provider_id), provider]));
    const providerIds = cards.map(card => String(card.querySelector('[data-details]')?.dataset.details || '')).filter(Boolean);
    if (!providerIds.length || !byId.size) return;
    const citizenshipResult = await db.rpc('gig_declared_malaysian_providers').in('provider_id', providerIds);
    const declaredIds = new Set(
      citizenshipResult.error ? [] : (citizenshipResult.data || []).map(row => String(row.provider_id))
    );

    cards.forEach(card => {
      if (card.dataset.metaReady === '1') return;
      const detailsBtn = card.querySelector('[data-details]');
      const providerId = detailsBtn ? String(detailsBtn.dataset.details) : '';
      const provider = providerId ? byId.get(providerId) : null;
      const info = card.firstElementChild;
      if (!provider || !info) return;

      const meta = document.createElement('div');
      meta.className = 'provider-card-meta';
      meta.innerHTML = providerMetaHtml(provider, declaredIds.has(providerId));
      const badge = info.querySelector('.match-badge');
      if (badge) info.insertBefore(meta, badge);
      else info.appendChild(meta);
      card.dataset.metaReady = '1';
    });
  } finally {
    decorating = false;
    const currentCards = listEl ? [...listEl.querySelectorAll('.provider-card')] : [];
    if (currentCards.some(card => !cards.includes(card))) queueDecorate();
  }
}

function improveEmptyState() {
  const listEl = $('providerList');
  const keyword = String($('keywordFilter')?.value || '').trim();
  const visibleProviders = Array.isArray(window.__rapatVisibleProviders) ? window.__rapatVisibleProviders : null;
  if (!listEl || !keyword || !visibleProviders || visibleProviders.length) return;

  const postcode = String($('postcodeFilter')?.value || '').trim();
  const state = String($('stateFilter')?.value || '').trim();
  const district = String($('districtFilter')?.value || '').trim();
  const hasLocation = Boolean(postcode || state || district);
  const location = district && state ? `${district}, ${state}` : state || (postcode ? `poskod ${postcode}` : '');

  listEl.innerHTML = `<div class="empty">
    Belum ada penyedia <b>${escapeHtml(keyword)}</b>${location ? ` yang sepadan di <b>${escapeHtml(location)}</b>` : ' yang benar-benar sepadan'}.
    <div style="margin-top:8px">RAPAT tidak akan paparkan servis lain yang tidak berkaitan hanya untuk memenuhi hasil carian.</div>
    ${hasLocation ? '<div style="margin-top:14px"><button class="btn light small" id="expandServiceSearch">Cari seluruh Malaysia</button></div>' : ''}
  </div>`;

  const expandButton = $('expandServiceSearch');
  if (expandButton) {
    expandButton.onclick = () => {
      $('postcodeFilter').value = '';
      $('postcodeHint').textContent = '';
      $('stateFilter').value = '';
      $('stateFilter').dispatchEvent(new Event('change'));
      $('searchBtn').click();
    };
  }
}

function queueDecorate() {
  clearTimeout(queued);
  queued = setTimeout(() => {
    decorateCards();
    improveEmptyState();
  }, 40);
}

const observer = new MutationObserver(queueDecorate);
const listEl = $('providerList');
if (listEl) observer.observe(listEl, { childList: true, subtree: false });
window.addEventListener('rapat:providers-rendered', queueDecorate);

queueDecorate();
