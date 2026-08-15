import { db, populateStates, populateDistricts, escapeHtml } from './gig-config.js';

const $ = id => document.getElementById(id);
let user = null;
let provider = null;
let categories = [];
let services = [];
let selectedServiceIds = new Set();

function msg(text, good=false) {
  $('saveMsg').innerHTML = text ? `<div class="notice ${good ? '' : 'bad'}">${escapeHtml(text)}</div>` : '';
}

async function googleLogin() {
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) $('loginMsg').innerHTML = `<div class="notice bad">${escapeHtml(error.message)}</div>`;
}

async function loadTaxonomy() {
  const [{ data: cats, error: ce }, { data: svcs, error: se }] = await Promise.all([
    db.from('gig_categories').select('id,name,sort_order').order('sort_order').order('name'),
    db.from('gig_services').select('id,category_id,name,sort_order').order('sort_order').order('name')
  ]);
  if (ce) throw ce;
  if (se) throw se;
  categories = cats || [];
  services = svcs || [];
  renderServices();
}

function renderServices() {
  $('serviceGroups').innerHTML = categories.map(c => {
    const list = services.filter(s => s.category_id === c.id);
    return `<div class="service-group"><h4>${escapeHtml(c.name)}</h4>${list.map(s => `<label class="check"><input type="checkbox" value="${s.id}" ${selectedServiceIds.has(s.id) ? 'checked' : ''}><span>${escapeHtml(s.name)}</span></label>`).join('')}</div>`;
  }).join('');
  $('serviceGroups').querySelectorAll('input[type=checkbox]').forEach(input => {
    input.onchange = () => input.checked ? selectedServiceIds.add(input.value) : selectedServiceIds.delete(input.value);
  });
}

async function loadProvider() {
  const { data, error } = await db.from('gig_providers').select('*').maybeSingle();
  if (error) throw error;
  provider = data || null;
  if (!provider) {
    $('formTitle').textContent = 'Daftar sebagai Penyedia Servis';
    renderStatus();
    renderMetrics(null);
    return;
  }
  const { data: links, error: le } = await db.from('gig_provider_services').select('service_id').eq('provider_id', provider.id);
  if (le) throw le;
  selectedServiceIds = new Set((links || []).map(x => x.service_id));
  $('formTitle').textContent = 'Urus Listing Anda';
  $('displayName').value = provider.display_name || '';
  $('whatsapp').value = provider.whatsapp || '';
  $('socialUrl').value = provider.social_url || '';
  $('providerState').value = provider.state || '';
  populateDistricts($('providerDistrict'), provider.state || '');
  $('providerDistrict').value = provider.district || '';
  $('providerPostcode').value = provider.postcode || '';
  $('publishSelect').value = String(provider.is_published);
  renderServices();
  renderStatus();
  const { data: metrics, error: me } = await db.rpc('gig_my_metrics');
  if (!me) renderMetrics((metrics || [])[0] || null);
}

function renderStatus() {
  if (!provider) {
    $('statusBox').innerHTML = '<div class="notice warn">Belum ada listing. Selepas submit, status akan jadi <b>Pending Approval</b>.</div>';
    return;
  }
  const label = { pending:'Pending Approval', approved:'Approved', rejected:'Rejected', suspended:'Suspended' }[provider.status] || provider.status;
  let note = '';
  if (provider.status === 'pending') note = 'Admin RAPAT perlu approve listing pertama sebelum ia muncul dalam carian.';
  if (provider.status === 'approved' && !provider.is_published) note = 'Listing anda diluluskan tetapi sedang unpublished.';
  if (provider.status === 'rejected') note = 'Listing belum diluluskan. Semak dan kemas kini maklumat; admin masih boleh review semula.';
  if (provider.status === 'suspended') note = 'Listing digantung oleh admin RAPAT dan tidak dipaparkan kepada public.';
  $('statusBox').innerHTML = `<div class="notice"><span class="status-pill status-${escapeHtml(provider.status)}">${escapeHtml(label)}</span>${note ? ` &nbsp; ${escapeHtml(note)}` : ''}</div>`;
}

function renderMetrics(m) {
  const values = m || { profile_views:0, whatsapp_clicks:0, average_rating:0, rating_count:0 };
  $('metrics').innerHTML = `
    <div class="metric"><b>${Number(values.profile_views || 0)}</b><span>Profile Views</span></div>
    <div class="metric"><b>${Number(values.whatsapp_clicks || 0)}</b><span>WhatsApp Clicks</span></div>
    <div class="metric"><b>${Number(values.average_rating || 0).toFixed(1)}</b><span>Average Rating</span></div>
    <div class="metric"><b>${Number(values.rating_count || 0)}</b><span>Jumlah Ratings</span></div>`;
}

function validateForm() {
  const name = $('displayName').value.trim();
  const whatsapp = $('whatsapp').value.trim();
  const social = $('socialUrl').value.trim();
  const state = $('providerState').value;
  const district = $('providerDistrict').value;
  const postcode = $('providerPostcode').value.trim();
  if (!name || !whatsapp || !social || !state || !district || !postcode) throw new Error('Lengkapkan semua maklumat wajib.');
  if (!/^https?:\/\//i.test(social)) throw new Error('Social media / website mesti bermula dengan http:// atau https://');
  if (!/^\d{5}$/.test(postcode)) throw new Error('Poskod mesti 5 digit.');
  if (!selectedServiceIds.size) throw new Error('Pilih sekurang-kurangnya satu servis.');
  return { display_name:name, whatsapp, social_url:social, state, district, postcode, is_published:$('publishSelect').value === 'true' };
}

async function syncServices(providerId) {
  const { data: current, error } = await db.from('gig_provider_services').select('service_id').eq('provider_id', providerId);
  if (error) throw error;
  const old = new Set((current || []).map(x => x.service_id));
  const add = [...selectedServiceIds].filter(id => !old.has(id));
  const remove = [...old].filter(id => !selectedServiceIds.has(id));
  if (add.length) {
    const { error: ie } = await db.from('gig_provider_services').insert(add.map(service_id => ({ provider_id: providerId, service_id })));
    if (ie) throw ie;
  }
  for (const serviceId of remove) {
    const { error: de } = await db.from('gig_provider_services').delete().eq('provider_id', providerId).eq('service_id', serviceId);
    if (de) throw de;
  }
}

async function saveProvider() {
  try {
    msg('');
    const payload = validateForm();
    if (!provider) {
      const { data, error } = await db.from('gig_providers').insert({ ...payload, user_id:user.id }).select().single();
      if (error) throw error;
      provider = data;
      await syncServices(provider.id);
      msg('Pendaftaran dihantar. Listing sedang menunggu kelulusan admin RAPAT.', true);
    } else {
      const { data, error } = await db.from('gig_providers').update(payload).eq('id', provider.id).select().single();
      if (error) throw error;
      provider = data;
      await syncServices(provider.id);
      msg('Maklumat listing berjaya dikemas kini.', true);
    }
    await loadProvider();
  } catch (error) { msg(error.message || 'Tidak dapat menyimpan listing.'); }
}

async function initAuth() {
  const { data: { user: u } } = await db.auth.getUser();
  user = u || null;
  if (!user) {
    $('loginPanel').classList.remove('hidden');
    $('providerApp').classList.add('hidden');
    $('providerAuth').textContent = '';
    return;
  }
  $('loginPanel').classList.add('hidden');
  $('providerApp').classList.remove('hidden');
  $('providerAuth').innerHTML = `<span class="auth-chip">${escapeHtml(user.email || 'Google user')}</span>`;
}

(async function init() {
  populateStates($('providerState'));
  $('providerState').onchange = () => populateDistricts($('providerDistrict'), $('providerState').value);
  $('googleLogin').onclick = googleLogin;
  $('logoutBtn').onclick = async () => { await db.auth.signOut(); location.reload(); };
  $('saveProvider').onclick = saveProvider;
  try {
    await initAuth();
    if (user) {
      await loadTaxonomy();
      await loadProvider();
    }
  } catch (error) {
    $('saveMsg').innerHTML = `<div class="notice bad">${escapeHtml(error.message || 'Tidak dapat memuatkan dashboard.')}</div>`;
  }
})();
