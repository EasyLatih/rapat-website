import { db, populateStates, populateDistricts, selectDistrict, lookupPostcode, escapeHtml, ensureVisitorKey, whatsappNumber, ratingStars } from './gig-config.js';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 10;
const SEARCH_BATCH_SIZE = 1000;
const pageRandomSeed = (() => {
  try {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] || 1;
  } catch {
    return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
  }
})();
let providers = [];
let providerPool = [];
let providerPoolKey = '';
let providerTotal = 0;
let selectedProvider = null;
let currentUser = null;
let postcodeLookupSeq = 0;
let currentPage = 1;
let currentSearchArgs = null;
const visitorKey = ensureVisitorKey();

function showMsg(el, text, type='notice') {
  el.innerHTML = text ? `<div class="${type}">${escapeHtml(text)}</div>` : '';
}

function providerRandomScore(providerId) {
  const text = String(providerId || '');
  let hash = (2166136261 ^ pageRandomSeed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function providerLocationRank(provider) {
  const rank = Number(provider?.match_rank);
  return Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER;
}

function randomizeProviders(list) {
  return [...list].sort((a, b) => {
    const rankDiff = providerLocationRank(a) - providerLocationRank(b);
    if (rankDiff) return rankDiff;
    const scoreDiff = providerRandomScore(a.provider_id) - providerRandomScore(b.provider_id);
    return scoreDiff || String(a.provider_id || '').localeCompare(String(b.provider_id || ''));
  });
}

async function fetchAllProviders(args) {
  const rows = [];
  let from = 0;
  let total = null;

  while (true) {
    const { data, error, count } = await db
      .rpc('gig_search_providers_keyword', args, { count: 'exact' })
      .range(from, from + SEARCH_BATCH_SIZE - 1);
    if (error) throw error;

    const batch = data || [];
    if (total === null) total = Number.isFinite(count) ? count : batch.length;
    rows.push(...batch);

    if (!batch.length || batch.length < SEARCH_BATCH_SIZE || rows.length >= total) break;
    from += SEARCH_BATCH_SIZE;
  }

  return randomizeProviders(rows);
}

async function loadAuth() {
  const { data: { user } } = await db.auth.getUser();
  currentUser = user || null;
  $('authState').innerHTML = currentUser
    ? `Signed in as <b>${escapeHtml(currentUser.email || 'Google user')}</b> · <button id="publicLogout" class="btn light small">Logout</button>`
    : 'Rating & aduan memerlukan Google Sign-In.';
  const logout = $('publicLogout');
  if (logout) logout.onclick = async () => { await db.auth.signOut(); location.reload(); };
}

async function signInFor(returnMode, providerId) {
  sessionStorage.setItem('rapatGigPendingAction', JSON.stringify({ mode: returnMode, providerId }));
  const redirectTo = `${location.origin}${location.pathname}${location.search}`;
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) alert(error.message);
}

async function applyUrlFilters() {
  const params = new URLSearchParams(location.search);
  const keyword = params.get('q');
  const postcode = String(params.get('postcode') || '').replace(/\D/g,'').slice(0,5);
  const state = params.get('state');
  const district = params.get('district');

  if (keyword) $('keywordFilter').value = keyword;

  if (postcode.length === 5) {
    $('postcodeFilter').value = postcode;
    await autofillPostcode();
  } else if (state) {
    const stateOption = [...$('stateFilter').options].find(o => o.value.toLowerCase() === state.toLowerCase());
    if (stateOption) {
      $('stateFilter').value = stateOption.value;
      populateDistricts($('districtFilter'), stateOption.value, 'Semua daerah / kawasan');
      if (district) selectDistrict($('districtFilter'), stateOption.value, district, 'Semua daerah / kawasan');
    }
  }
}

function updateUrlFromSearch() {
  const params = new URLSearchParams();
  const keyword = $('keywordFilter').value.trim();
  const postcode = $('postcodeFilter').value.trim();
  const state = $('stateFilter').value;
  const district = $('districtFilter').value;
  if (keyword) params.set('q', keyword);
  if (postcode) params.set('postcode', postcode);
  if (state) params.set('state', state);
  if (district) params.set('district', district);
  const next = params.toString() ? `${location.pathname}?${params}` : location.pathname;
  history.replaceState(null, '', next);
}

async function searchProviders({ preservePage = false, refreshResults = false } = {}) {
  $('providerList').innerHTML = '<div class="empty">Mencari penyedia servis…</div>';
  $('providerPagination').classList.add('hidden');
  const keyword = $('keywordFilter').value.trim();
  const args = {
    p_keyword: keyword || null,
    p_state: $('stateFilter').value || null,
    p_district: $('districtFilter').value || null,
    p_postcode: $('postcodeFilter').value.trim() || null
  };
  const searchKey = JSON.stringify(args);
  if (!preservePage) currentPage = 1;

  try {
    if (refreshResults || providerPoolKey !== searchKey) {
      providerPool = await fetchAllProviders(args);
      providerPoolKey = searchKey;
    }
  } catch (error) {
    $('providerList').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    $('resultCount').textContent = 'Carian gagal.';
    providers = [];
    providerPool = [];
    providerPoolKey = '';
    providerTotal = 0;
    currentSearchArgs = null;
    return;
  }

  providerTotal = providerPool.length;
  currentSearchArgs = args;
  const totalPages = Math.max(1, Math.ceil(providerTotal / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  providers = providerPool.slice(pageStart, pageStart + PAGE_SIZE);
  updateUrlFromSearch();
  renderProviders(args);
}

function matchLabel(p, args) {
  if (args.p_postcode && Number(p.match_rank) === 0) return 'Exact poskod';
  if (args.p_district && Number(p.match_rank) <= 1) return 'Kawasan sama';
  if (args.p_state) return 'Nearby';
  return '';
}

function renderProviders(args) {
  const keyword = String(args.p_keyword || '').trim();
  const totalPages = Math.max(1, Math.ceil(providerTotal / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageProviders = providers;
  const pageEnd = pageStart + pageProviders.length;
  $('resultCount').textContent = keyword
    ? `${providerTotal} penyedia ditemui untuk “${keyword}”${providerTotal ? ` · Paparan ${pageStart + 1}–${pageEnd}` : ''}`
    : `${providerTotal} penyedia servis ditemui${providerTotal ? ` · Paparan ${pageStart + 1}–${pageEnd}` : ''}`;
  window.__rapatVisibleProviders = pageProviders;
  if (!providerTotal) {
    $('providerList').innerHTML = keyword
      ? `<div class="empty">Belum ada penyedia yang sepadan dengan <b>${escapeHtml(keyword)}</b>. Cuba keyword lebih ringkas seperti “jahit”, “paip”, “aircond” atau “resume”.</div>`
      : '<div class="empty">Belum ada penyedia servis yang sepadan. Cuba lokasi lain.</div>';
    $('providerPagination').classList.add('hidden');
    window.dispatchEvent(new Event('rapat:providers-rendered'));
    return;
  }
  $('providerList').innerHTML = pageProviders.map(p => {
    const label = matchLabel(p, args);
    return `<article class="provider-card">
      <div><div class="provider-name">${escapeHtml(p.display_name)}</div>${label ? `<span class="match-badge">${escapeHtml(label)}</span>` : ''}</div>
      <div class="provider-actions"><button class="btn light small" data-details="${p.provider_id}">✓ Details</button><button class="btn whatsapp small" data-wa="${p.provider_id}">WhatsApp</button></div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-details]').forEach(b => b.onclick = () => openDetails(b.dataset.details));
  document.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => openWhatsApp(b.dataset.wa));
  renderPagination(totalPages);
  window.dispatchEvent(new Event('rapat:providers-rendered'));
}

function visiblePageNumbers(totalPages) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function renderPagination(totalPages) {
  const pagination = $('providerPagination');
  if (totalPages <= 1) {
    pagination.classList.add('hidden');
    pagination.innerHTML = '';
    return;
  }

  const pageButtons = [];
  let previousPage = 0;
  for (const page of visiblePageNumbers(totalPages)) {
    if (previousPage && page - previousPage > 1) pageButtons.push('<span class="pagination-ellipsis" aria-hidden="true">…</span>');
    pageButtons.push(`<button class="pagination-page${page === currentPage ? ' active' : ''}" data-page="${page}"${page === currentPage ? ' aria-current="page"' : ''} aria-label="Halaman ${page}">${page}</button>`);
    previousPage = page;
  }

  pagination.innerHTML = `
    <button class="btn light small pagination-nav" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Sebelumnya</button>
    <div class="pagination-pages">${pageButtons.join('')}</div>
    <span class="pagination-status">Halaman ${currentPage} daripada ${totalPages}</span>
    <button class="btn light small pagination-nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Seterusnya →</button>`;
  pagination.classList.remove('hidden');
  pagination.querySelectorAll('[data-page]:not([disabled])').forEach(button => {
    button.onclick = () => goToPage(Number(button.dataset.page));
  });
}

async function goToPage(page) {
  const totalPages = Math.max(1, Math.ceil(providerTotal / PAGE_SIZE));
  if (!currentSearchArgs || page < 1 || page > totalPages || page === currentPage) return;
  currentPage = page;
  await searchProviders({ preservePage: true });
  document.querySelector('.results-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function recordInteraction(providerId, type) {
  try { await db.rpc('gig_record_interaction', { p_provider_id: providerId, p_interaction_type: type, p_visitor_key: visitorKey }); } catch {}
}

function serviceText(p) {
  const list = Array.isArray(p.services) ? p.services : [];
  return list.map(s => `<span class="chip">${escapeHtml(s.category)} · ${escapeHtml(s.name)}</span>`).join('');
}

async function openDetails(providerId) {
  selectedProvider = providerPool.find(p => p.provider_id === providerId) || providers.find(p => p.provider_id === providerId);
  if (!selectedProvider) return;
  await recordInteraction(providerId, 'view');
  const p = selectedProvider;
  const count = Number(p.rating_count || 0);
  const avg = Number(p.average_rating || 0);
  $('providerDetails').innerHTML = `
    <h2 class="detail-title">${escapeHtml(p.display_name)}</h2>
    <div class="detail-row"><small>Servis</small><div class="chips">${serviceText(p) || '<span class="chip">Tiada servis dipaparkan</span>'}</div></div>
    <div class="detail-row"><small>Coverage Area</small><b>${escapeHtml(p.district)}, ${escapeHtml(p.state)} · ${escapeHtml(p.postcode)}</b></div>
    <div class="detail-row"><small>Social Media / Website</small><a href="${escapeHtml(p.social_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.social_url)}</a></div>
    <div class="detail-row"><small>Rating</small><div class="rating-line"><span class="stars">${ratingStars(avg)}</span><b>${count ? avg.toFixed(1) : '—'}</b><span class="auth-chip">${count} penilaian</span></div>
      <div class="rating-actions"><span class="auth-chip">Beri rating:</span>${[1,2,3,4,5].map(n => `<button class="star-btn" data-rate="${n}" title="${n} bintang">${n}★</button>`).join('')}</div>
      <div class="notice">Untuk beri rating, sila log masuk Google dahulu. Satu akaun boleh beri satu rating bagi setiap penyedia dan boleh ubah rating kemudian.</div>
    </div>
    <div class="detail-actions"><button class="btn whatsapp" id="detailWhatsapp">WhatsApp</button><button class="btn danger" id="reportProvider">Aduan</button></div>
    <div id="detailsMsg"></div>`;
  document.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => rateProvider(Number(b.dataset.rate)));
  $('detailWhatsapp').onclick = () => openWhatsApp(providerId);
  $('reportProvider').onclick = () => startReport(providerId);
  $('detailsModal').classList.remove('hidden');
}

async function rateProvider(rating) {
  if (!selectedProvider) return;
  if (!currentUser) return signInFor('rate', selectedProvider.provider_id);
  const { data: existing, error: readError } = await db.from('gig_ratings').select('id').eq('provider_id', selectedProvider.provider_id).eq('user_id', currentUser.id).maybeSingle();
  if (readError) return showMsg($('detailsMsg'), readError.message, 'notice bad');
  const query = existing ? db.from('gig_ratings').update({ rating }).eq('id', existing.id) : db.from('gig_ratings').insert({ provider_id: selectedProvider.provider_id, user_id: currentUser.id, rating });
  const { error } = await query;
  if (error) return showMsg($('detailsMsg'), error.message, 'notice bad');
  const selectedId = selectedProvider.provider_id;
  showMsg($('detailsMsg'), `Rating ${rating} bintang disimpan.`, 'notice');
  await searchProviders({ preservePage: true, refreshResults: true });
  const fresh = providerPool.find(p => p.provider_id === selectedId);
  if (fresh) { selectedProvider = fresh; await openDetails(fresh.provider_id); }
}

async function openWhatsApp(providerId) {
  const p = providerPool.find(x => x.provider_id === providerId) || providers.find(x => x.provider_id === providerId);
  if (!p) return;
  await recordInteraction(providerId, 'whatsapp');
  const num = whatsappNumber(p.whatsapp);
  const text = encodeURIComponent('Hi, saya jumpa servis anda melalui RAPAT.');
  window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener');
}

function startReport(providerId) {
  selectedProvider = providerPool.find(p => p.provider_id === providerId) || providers.find(p => p.provider_id === providerId) || selectedProvider;
  if (!currentUser) return signInFor('report', providerId);
  $('detailsModal').classList.add('hidden');
  $('reportMsg').innerHTML = '';
  $('reportModal').classList.remove('hidden');
}

async function submitReport() {
  if (!selectedProvider || !currentUser) return;
  const { error } = await db.from('gig_reports').insert({ provider_id: selectedProvider.provider_id, user_id: currentUser.id, reason: $('reportReason').value, details: $('reportDetails').value.trim() || null });
  if (error) return showMsg($('reportMsg'), error.message, 'notice bad');
  showMsg($('reportMsg'), 'Aduan diterima. Admin RAPAT akan review listing ini.', 'notice');
  $('reportDetails').value = '';
}

async function autofillPostcode() {
  const input = $('postcodeFilter');
  const postcode = input.value.replace(/\D/g,'').slice(0,5);
  input.value = postcode;
  const seq = ++postcodeLookupSeq;
  if (postcode.length !== 5) { $('postcodeHint').textContent = ''; return; }
  $('postcodeHint').textContent = 'Mencari lokasi…';
  try {
    const hit = await lookupPostcode(postcode);
    if (seq !== postcodeLookupSeq) return;
    if (!hit) { $('postcodeHint').textContent = 'Poskod tidak dijumpai. Pilih lokasi secara manual.'; return; }
    $('stateFilter').value = hit.state;
    selectDistrict($('districtFilter'), hit.state, hit.district, 'Semua daerah / kawasan');
    $('postcodeHint').textContent = `✓ ${hit.district}, ${hit.state}`;
  } catch {
    if (seq === postcodeLookupSeq) $('postcodeHint').textContent = 'Auto lokasi tak tersedia. Pilih lokasi secara manual.';
  }
}

function closeModal(id) { $(id).classList.add('hidden'); }

async function resumePendingAction() {
  const raw = sessionStorage.getItem('rapatGigPendingAction');
  if (!raw || !currentUser) return;
  sessionStorage.removeItem('rapatGigPendingAction');
  try {
    const action = JSON.parse(raw);
    if (!action.providerId) return;
    const p = providerPool.find(x => x.provider_id === action.providerId) || providers.find(x => x.provider_id === action.providerId);
    if (!p) return;
    selectedProvider = p;
    if (action.mode === 'report') startReport(action.providerId);
    else openDetails(action.providerId);
  } catch {}
}

(async function init() {
  populateStates($('stateFilter'), 'Semua negeri');
  $('stateFilter').onchange = () => populateDistricts($('districtFilter'), $('stateFilter').value, 'Semua daerah / kawasan');
  $('searchBtn').onclick = searchProviders;
  $('keywordFilter').onkeydown = e => { if (e.key === 'Enter') searchProviders(); };
  $('postcodeFilter').addEventListener('input', autofillPostcode);
  $('postcodeFilter').onkeydown = e => { if (e.key === 'Enter') searchProviders(); };
  $('closeDetails').onclick = () => closeModal('detailsModal');
  $('closeReport').onclick = () => closeModal('reportModal');
  $('submitReport').onclick = submitReport;
  $('detailsModal').onclick = e => { if (e.target.id === 'detailsModal') closeModal('detailsModal'); };
  $('reportModal').onclick = e => { if (e.target.id === 'reportModal') closeModal('reportModal'); };
  try {
    await loadAuth();
    await applyUrlFilters();
    await searchProviders();
    await resumePendingAction();
  } catch (error) {
    $('providerList').innerHTML = `<div class="empty">${escapeHtml(error.message || 'Tidak dapat memuatkan direktori.')}</div>`;
  }
})();
