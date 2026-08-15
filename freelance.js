import { db, populateStates, populateDistricts, selectDistrict, lookupPostcode, escapeHtml, ensureVisitorKey, whatsappNumber, ratingStars } from './gig-config.js';

const $ = id => document.getElementById(id);
let categories = [];
let services = [];
let providers = [];
let selectedProvider = null;
let currentUser = null;
let postcodeLookupSeq = 0;
const visitorKey = ensureVisitorKey();

function showMsg(el, text, type='notice') {
  el.innerHTML = text ? `<div class="${type}">${escapeHtml(text)}</div>` : '';
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
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) alert(error.message);
}

async function loadTaxonomy() {
  const [{ data: cats, error: ce }, { data: svcs, error: se }, { data: custom, error: cse }] = await Promise.all([
    db.from('gig_categories').select('id,name,slug,sort_order').order('sort_order').order('name'),
    db.from('gig_services').select('id,category_id,name,slug,sort_order').order('sort_order').order('name'),
    db.rpc('gig_searchable_custom_services')
  ]);
  if (ce) throw ce;
  if (se) throw se;
  if (cse) throw cse;
  categories = cats || [];
  const standard = (svcs || []).map(s => ({ ...s, custom:false }));
  const otherCategory = categories.find(c => c.slug === 'lain-lain');
  const standardNames = new Set(standard.map(s => s.name.trim().toLowerCase()));
  const dynamic = (custom || [])
    .filter(x => x.name && !standardNames.has(String(x.name).trim().toLowerCase()))
    .map((x,i) => ({
      id:`custom:${encodeURIComponent(x.name)}`,
      category_id:otherCategory?.id || '',
      name:x.name,
      slug:`custom-${i}`,
      sort_order:200+i,
      custom:true,
      provider_count:Number(x.provider_count||0)
    }));
  services = [...standard, ...dynamic];
  $('categoryFilter').innerHTML = '<option value="">Semua kategori</option>' + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  renderServiceFilter();
}

function renderServiceFilter() {
  const cat = $('categoryFilter').value;
  const list = (cat ? services.filter(s => s.category_id === cat) : services)
    .slice().sort((a,b)=>(a.sort_order-b.sort_order)||a.name.localeCompare(b.name));
  $('serviceFilter').innerHTML = '<option value="">Semua servis</option>' + list.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${s.custom && !cat ? ' · Lain-lain' : ''}</option>`).join('');
}

function selectedServiceArgs() {
  const value = $('serviceFilter').value || '';
  if (!value) return { p_service_id:null, p_custom_service:null };
  if (value.startsWith('custom:')) return { p_service_id:null, p_custom_service:decodeURIComponent(value.slice(7)) };
  return { p_service_id:value, p_custom_service:null };
}

async function searchProviders() {
  $('providerList').innerHTML = '<div class="empty">Mencari penyedia servis…</div>';
  const args = {
    ...selectedServiceArgs(),
    p_state: $('stateFilter').value || null,
    p_district: $('districtFilter').value || null,
    p_postcode: $('postcodeFilter').value.trim() || null
  };
  const { data, error } = await db.rpc('gig_search_providers', args);
  if (error) {
    $('providerList').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    $('resultCount').textContent = 'Carian gagal.';
    return;
  }
  providers = data || [];
  renderProviders(args);
}

function matchLabel(p, args) {
  if (args.p_postcode && Number(p.match_rank) === 0) return 'Exact poskod';
  if (args.p_district && Number(p.match_rank) <= 1) return 'Kawasan sama';
  if (args.p_state) return 'Nearby';
  return '';
}

function renderProviders(args) {
  $('resultCount').textContent = `${providers.length} penyedia servis ditemui`;
  if (!providers.length) {
    $('providerList').innerHTML = '<div class="empty">Belum ada penyedia servis yang sepadan. Cuba lokasi atau servis lain.</div>';
    return;
  }
  $('providerList').innerHTML = providers.map(p => {
    const label = matchLabel(p, args);
    return `<article class="provider-card">
      <div><div class="provider-name">${escapeHtml(p.display_name)}</div>${label ? `<span class="match-badge">${escapeHtml(label)}</span>` : ''}</div>
      <div class="provider-actions"><button class="btn light small" data-details="${p.provider_id}">✓ Details</button><button class="btn whatsapp small" data-wa="${p.provider_id}">WhatsApp</button></div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-details]').forEach(b => b.onclick = () => openDetails(b.dataset.details));
  document.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => openWhatsApp(b.dataset.wa));
}

async function recordInteraction(providerId, type) {
  try { await db.rpc('gig_record_interaction', { p_provider_id: providerId, p_interaction_type: type, p_visitor_key: visitorKey }); } catch {}
}

function serviceText(p) {
  const list = Array.isArray(p.services) ? p.services : [];
  return list.map(s => `<span class="chip">${escapeHtml(s.category)} · ${escapeHtml(s.name)}</span>`).join('');
}

async function openDetails(providerId) {
  selectedProvider = providers.find(p => p.provider_id === providerId);
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
  showMsg($('detailsMsg'), `Rating ${rating} bintang disimpan.`, 'notice');
  await searchProviders();
  const fresh = providers.find(p => p.provider_id === selectedProvider.provider_id);
  if (fresh) { selectedProvider = fresh; await openDetails(fresh.provider_id); }
}

async function openWhatsApp(providerId) {
  const p = providers.find(x => x.provider_id === providerId);
  if (!p) return;
  await recordInteraction(providerId, 'whatsapp');
  const num = whatsappNumber(p.whatsapp);
  const text = encodeURIComponent('Hi, saya jumpa servis anda melalui RAPAT.');
  window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener');
}

function startReport(providerId) {
  selectedProvider = providers.find(p => p.provider_id === providerId) || selectedProvider;
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
    const p = providers.find(x => x.provider_id === action.providerId);
    if (!p) return;
    selectedProvider = p;
    if (action.mode === 'report') startReport(action.providerId);
    else openDetails(action.providerId);
  } catch {}
}

(async function init() {
  populateStates($('stateFilter'), 'Semua negeri');
  $('stateFilter').onchange = () => populateDistricts($('districtFilter'), $('stateFilter').value, 'Semua daerah / kawasan');
  $('categoryFilter').onchange = renderServiceFilter;
  $('searchBtn').onclick = searchProviders;
  $('postcodeFilter').addEventListener('input', autofillPostcode);
  $('postcodeFilter').onkeydown = e => { if (e.key === 'Enter') searchProviders(); };
  $('closeDetails').onclick = () => closeModal('detailsModal');
  $('closeReport').onclick = () => closeModal('reportModal');
  $('submitReport').onclick = submitReport;
  $('detailsModal').onclick = e => { if (e.target.id === 'detailsModal') closeModal('detailsModal'); };
  $('reportModal').onclick = e => { if (e.target.id === 'reportModal') closeModal('reportModal'); };
  try {
    await Promise.all([loadAuth(), loadTaxonomy()]);
    await searchProviders();
    await resumePendingAction();
  } catch (error) {
    $('providerList').innerHTML = `<div class="empty">${escapeHtml(error.message || 'Tidak dapat memuatkan direktori.')}</div>`;
  }
})();
