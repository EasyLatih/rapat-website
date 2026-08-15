import { db, escapeHtml } from './gig-config.js';

const $ = id => document.getElementById(id);
let decorating = false;
let queued = null;

function searchArgs() {
  const serviceValue = $('serviceFilter')?.value || '';
  const serviceArgs = !serviceValue
    ? { p_service_id: null, p_custom_service: null }
    : serviceValue.startsWith('custom:')
      ? { p_service_id: null, p_custom_service: decodeURIComponent(serviceValue.slice(7)) }
      : { p_service_id: serviceValue, p_custom_service: null };

  return {
    ...serviceArgs,
    p_state: $('stateFilter')?.value || null,
    p_district: $('districtFilter')?.value || null,
    p_postcode: $('postcodeFilter')?.value?.trim() || null
  };
}

function providerMetaHtml(provider) {
  const list = Array.isArray(provider.services) ? provider.services : [];
  const primary = list[0] || null;
  const extra = Math.max(0, list.length - 1);
  const serviceLine = primary
    ? `${escapeHtml(primary.category || 'Lain-lain')} · ${escapeHtml(primary.name || 'Servis')}`
    : 'Servis belum dinyatakan';
  const location = [provider.district, provider.state].filter(Boolean).map(escapeHtml).join(', ');

  return `
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
    const { data, error } = await db.rpc('gig_search_providers', searchArgs());
    if (error) return;
    const byId = new Map((data || []).map(provider => [String(provider.provider_id), provider]));

    cards.forEach(card => {
      if (card.dataset.metaReady === '1') return;
      const detailsBtn = card.querySelector('[data-details]');
      const provider = detailsBtn ? byId.get(String(detailsBtn.dataset.details)) : null;
      const info = card.firstElementChild;
      if (!provider || !info) return;

      const meta = document.createElement('div');
      meta.className = 'provider-card-meta';
      meta.innerHTML = providerMetaHtml(provider);
      const badge = info.querySelector('.match-badge');
      if (badge) info.insertBefore(meta, badge);
      else info.appendChild(meta);
      card.dataset.metaReady = '1';
    });
  } finally {
    decorating = false;
  }
}

function queueDecorate() {
  clearTimeout(queued);
  queued = setTimeout(decorateCards, 40);
}

const observer = new MutationObserver(queueDecorate);
const listEl = $('providerList');
if (listEl) observer.observe(listEl, { childList: true, subtree: false });

queueDecorate();
