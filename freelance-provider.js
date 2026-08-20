import { db, populateStates, populateDistricts, selectDistrict, lookupPostcode, escapeHtml } from './gig-config.js';

const $ = id => document.getElementById(id);
let user = null;
let provider = null;
let categories = [];
let services = [];
let selectedServiceIds = new Set();
let postcodeLookupSeq = 0;

function msg(text, good=false) {
  $('saveMsg').innerHTML = text ? `<div class="notice ${good ? '' : 'bad'}">${escapeHtml(text)}</div>` : '';
}
function citizenshipMsg(text, good=false) {
  $('citizenshipMsg').innerHTML = text ? `<div class="notice ${good ? '' : 'bad'}" style="margin-top:12px">${escapeHtml(text)}</div>` : '';
}

async function googleLogin() {
  const redirectTo = `${location.origin}${location.pathname}${location.search || ''}`;
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) $('loginMsg').innerHTML = `<div class="notice bad">${escapeHtml(error.message)}</div>`;
}

function otherService() { return services.find(s => s.slug === 'servis-lain-lain'); }
function mainEligibleServices(categoryId='') {
  return services.filter(s => s.slug !== 'servis-lain-lain' && (!categoryId || s.category_id === categoryId));
}
function mainServiceById(serviceId) {
  return mainEligibleServices().find(s => String(s.id) === String(serviceId || '')) || null;
}
function categoryById(categoryId) {
  return categories.find(c => String(c.id) === String(categoryId || '')) || null;
}

function renderMainCategoryOptions(selectedCategoryId='') {
  const select = $('mainCategory');
  if (!select) return;
  select.innerHTML = '<option value="">Pilih kategori utama</option>' + categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  select.value = categories.some(c => String(c.id) === String(selectedCategoryId)) ? String(selectedCategoryId) : '';
}

function renderMainServiceOptions(categoryId='', selectedServiceId='') {
  const select = $('mainService');
  if (!select) return;
  const list = mainEligibleServices(categoryId);
  select.innerHTML = '<option value="">Pilih servis utama</option>' + list.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  select.disabled = !categoryId;
  select.value = list.some(s => String(s.id) === String(selectedServiceId)) ? String(selectedServiceId) : '';
}

function renderMainServiceStatus() {
  const box = $('mainServiceStatus');
  if (!box) return;
  if (!provider || !provider.main_service_confirmation_required) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  const svc = mainServiceById(provider.main_service_id);
  const cat = svc ? categoryById(svc.category_id) : null;
  const current = svc ? ` Pilihan sementara sekarang: <b>${escapeHtml(cat?.name || '')} · ${escapeHtml(svc.name)}</b>.` : '';
  box.innerHTML = `<div class="auth-chip" style="border-left:3px solid #e5b000;padding-left:10px"><b>Servis utama belum disahkan.</b>${current} Semak pilihan di bawah dan klik <b>Simpan Listing</b>.</div>`;
  box.classList.remove('hidden');
}

function renderMainServiceControls() {
  const selected = mainServiceById(provider?.main_service_id || '');
  const categoryId = selected?.category_id || '';
  renderMainCategoryOptions(categoryId);
  renderMainServiceOptions(categoryId, selected?.id || '');
  renderMainServiceStatus();
}

function ensureMainServiceSelected(serviceId) {
  if (!serviceId) return;
  selectedServiceIds.add(String(serviceId));
  renderServices();
}

function toggleCustomServiceField() {
  const other = otherService();
  const on = Boolean(other && selectedServiceIds.has(other.id));
  $('customServiceField').classList.toggle('hidden', !on);
  if (!on) $('customServices').value = '';
}

function parseCustomServices() {
  const names = $('customServices').value.split(',').map(x => x.trim().replace(/\s+/g,' ')).filter(Boolean);
  const unique = [...new Map(names.map(x => [x.toLowerCase(), x])).values()];
  if (unique.length > 5) throw new Error('Maksimum 5 servis Lain-lain bagi satu listing.');
  if (unique.some(x => x.length < 2 || x.length > 80)) throw new Error('Setiap servis Lain-lain mesti antara 2 hingga 80 aksara.');
  const standardNames = new Set(services.filter(s => s.slug !== 'servis-lain-lain').map(s => s.name.trim().toLowerCase()));
  const duplicate = unique.find(x => standardNames.has(x.toLowerCase()));
  if (duplicate) throw new Error(`Servis "${duplicate}" sudah ada dalam senarai. Sila pilih servis tersebut, bukan Lain-lain.`);
  return unique;
}

async function loadTaxonomy() {
  const [{ data: cats, error: ce }, { data: svcs, error: se }] = await Promise.all([
    db.from('gig_categories').select('id,name,slug,sort_order').order('sort_order').order('name'),
    db.from('gig_services').select('id,category_id,name,slug,sort_order').order('sort_order').order('name')
  ]);
  if (ce) throw ce;
  if (se) throw se;
  categories = cats || [];
  services = svcs || [];
  renderServices();
  renderMainServiceControls();
}

function renderServices() {
  $('serviceGroups').innerHTML = categories.map(c => {
    const list = services.filter(s => s.category_id === c.id);
    return `<div class="service-group"><h4>${escapeHtml(c.name)}</h4>${list.map(s => `<label class="check"><input type="checkbox" value="${s.id}" ${selectedServiceIds.has(s.id) ? 'checked' : ''}><span>${escapeHtml(s.name)}</span></label>`).join('')}</div>`;
  }).join('');
  $('serviceGroups').querySelectorAll('input[type=checkbox]').forEach(input => {
    input.onchange = () => {
      if (input.checked) {
        selectedServiceIds.add(input.value);
      } else {
        selectedServiceIds.delete(input.value);
        if ($('mainService')?.value === input.value) $('mainService').value = '';
      }
      toggleCustomServiceField();
    };
  });
  toggleCustomServiceField();
}

function renderCitizenship() {
  const panel = $('citizenshipPanel');
  const newField = $('newCitizenshipField');
  const saveBtn = $('saveProvider');
  if (!provider) {
    panel.classList.add('hidden');
    newField.classList.remove('hidden');
    saveBtn.disabled = false;
    return;
  }

  newField.classList.add('hidden');
  const status = provider.citizenship_status || 'pending';
  if (status === 'pending') {
    panel.classList.remove('hidden');
    saveBtn.disabled = true;
    citizenshipMsg('Sila sahkan status warganegara sebelum mengemas kini listing anda.');
    return;
  }

  if (status === 'non_malaysian') {
    panel.classList.remove('hidden');
    panel.querySelector('h2').textContent = 'Pendaftaran Tidak Layak';
    panel.querySelectorAll('input[name="existingCitizenship"]').forEach(x => x.disabled = true);
    $('confirmCitizenship').classList.add('hidden');
    saveBtn.disabled = true;
    citizenshipMsg('Buat masa ini, pendaftaran penyedia servis RAPAT.my hanya dibuka kepada warganegara Malaysia. Listing anda telah ditolak dan tidak dipaparkan kepada umum.');
    return;
  }

  panel.classList.add('hidden');
  saveBtn.disabled = false;
}

async function confirmCitizenship() {
  try {
    citizenshipMsg('');
    const choice = document.querySelector('input[name="existingCitizenship"]:checked')?.value || '';
    if (!choice) throw new Error('Sila pilih Ya atau Tidak terlebih dahulu.');
    const { data, error } = await db.from('gig_providers')
      .update({ citizenship_status: choice, citizenship_confirmed_at: new Date().toISOString() })
      .eq('id', provider.id)
      .select('*').single();
    if (error) throw error;
    provider = data;
    if (choice === 'malaysian') citizenshipMsg('Terima kasih. Status warganegara anda telah disahkan.', true);
    else citizenshipMsg('Pendaftaran penyedia servis RAPAT.my hanya untuk warganegara Malaysia. Listing anda telah ditolak.');
    await loadProvider();
  } catch (error) {
    citizenshipMsg(error.message || 'Tidak dapat menyimpan pengesahan.');
  }
}

async function loadProvider() {
  const { data, error } = await db.from('gig_providers').select('*').maybeSingle();
  if (error) throw error;
  provider = data || null;
  if (!provider) {
    selectedServiceIds = new Set();
    $('formTitle').textContent = 'Daftar sebagai Penyedia Servis';
    renderStatus();
    renderMetrics(null);
    renderCitizenship();
    renderServices();
    renderMainServiceControls();
    return;
  }
  const [{ data: links, error: le }, { data: custom, error: cse }] = await Promise.all([
    db.from('gig_provider_services').select('service_id').eq('provider_id', provider.id),
    db.from('gig_provider_custom_services').select('name').eq('provider_id', provider.id).order('name')
  ]);
  if (le) throw le;
  if (cse) throw cse;
  selectedServiceIds = new Set((links || []).map(x => x.service_id));
  $('formTitle').textContent = 'Urus Listing Anda';
  $('displayName').value = provider.display_name || '';
  $('whatsapp').value = provider.whatsapp || '';
  $('socialUrl').value = provider.social_url || '';
  $('providerPostcode').value = provider.postcode || '';
  $('providerState').value = provider.state || '';
  selectDistrict($('providerDistrict'), provider.state || '', provider.district || '');
  $('publishSelect').value = String(provider.is_published);
  $('customServices').value = (custom || []).map(x => x.name).join(', ');
  renderServices();
  renderMainServiceControls();
  renderStatus();
  renderCitizenship();
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
  if (provider.status === 'rejected') note = provider.citizenship_status === 'non_malaysian' ? 'Pendaftaran penyedia servis RAPAT.my hanya dibuka kepada warganegara Malaysia.' : 'Listing belum diluluskan. Semak dan kemas kini maklumat; admin masih boleh review semula.';
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

async function autofillPostcode() {
  const input = $('providerPostcode');
  const postcode = input.value.replace(/\D/g,'').slice(0,5);
  input.value = postcode;
  const seq = ++postcodeLookupSeq;
  if (postcode.length !== 5) { $('providerPostcodeHint').textContent = ''; return; }
  $('providerPostcodeHint').textContent = 'Mencari lokasi poskod…';
  try {
    const hit = await lookupPostcode(postcode);
    if (seq !== postcodeLookupSeq) return;
    if (!hit) { $('providerPostcodeHint').textContent = 'Poskod tidak dijumpai. Pilih negeri dan daerah/kawasan secara manual.'; return; }
    $('providerState').value = hit.state;
    selectDistrict($('providerDistrict'), hit.state, hit.district);
    $('providerPostcodeHint').textContent = `✓ ${hit.district}, ${hit.state}`;
  } catch {
    if (seq === postcodeLookupSeq) $('providerPostcodeHint').textContent = 'Auto lokasi tak tersedia. Pilih negeri dan daerah/kawasan secara manual.';
  }
}

function validateForm() {
  const name = $('displayName').value.trim();
  const whatsapp = $('whatsapp').value.trim();
  const social = $('socialUrl').value.trim();
  const state = $('providerState').value;
  const district = $('providerDistrict').value;
  const postcode = $('providerPostcode').value.trim();
  const mainCategoryId = $('mainCategory').value;
  const mainServiceId = $('mainService').value;
  if (!provider) {
    const citizenship = $('citizenshipSelect').value;
    if (!citizenship) throw new Error('Sila sahkan status warganegara Malaysia.');
    if (citizenship !== 'malaysian') throw new Error('Buat masa ini, pendaftaran penyedia servis RAPAT.my hanya dibuka kepada warganegara Malaysia.');
  } else if ((provider.citizenship_status || 'pending') === 'pending') {
    throw new Error('Sila sahkan status warganegara Malaysia terlebih dahulu.');
  } else if (provider.citizenship_status === 'non_malaysian') {
    throw new Error('Pendaftaran penyedia servis RAPAT.my hanya dibuka kepada warganegara Malaysia.');
  }
  if (!name || !whatsapp || !social || !state || !district || !postcode) throw new Error('Lengkapkan semua maklumat wajib.');
  if (!/^https?:\/\//i.test(social)) throw new Error('Social media / website mesti bermula dengan http:// atau https://');
  if (!/^\d{5}$/.test(postcode)) throw new Error('Poskod mesti 5 digit.');
  if (!mainCategoryId) throw new Error('Pilih Kategori Utama.');
  if (!mainServiceId) throw new Error('Pilih Servis Utama.');
  const mainService = mainServiceById(mainServiceId);
  if (!mainService || String(mainService.category_id) !== String(mainCategoryId)) throw new Error('Servis Utama tidak sah. Sila pilih semula.');
  selectedServiceIds.add(mainServiceId);
  if (!selectedServiceIds.size) throw new Error('Pilih sekurang-kurangnya satu servis.');
  const other = otherService();
  const customServices = other && selectedServiceIds.has(other.id) ? parseCustomServices() : [];
  if (other && selectedServiceIds.has(other.id) && !customServices.length) throw new Error('Bila pilih Lain-lain, sila nyatakan servis tersebut.');
  return { payload:{ display_name:name, whatsapp, social_url:social, state, district, postcode, is_published:$('publishSelect').value === 'true' }, customServices, mainServiceId };
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

async function syncCustomServices(providerId, names) {
  const { error: de } = await db.from('gig_provider_custom_services').delete().eq('provider_id', providerId);
  if (de) throw de;
  if (names.length) {
    const { error: ie } = await db.from('gig_provider_custom_services').insert(names.map(name => ({ provider_id:providerId, name })));
    if (ie) throw ie;
  }
}

async function confirmMainService(providerId, mainServiceId) {
  const { data, error } = await db.from('gig_providers').update({
    main_service_id: mainServiceId,
    main_service_confirmed_at: new Date().toISOString(),
    main_service_confirmation_required: false
  }).eq('id', providerId).select().single();
  if (error) throw error;
  provider = data;
}

async function saveProvider() {
  try {
    msg('');
    const { payload, customServices, mainServiceId } = validateForm();
    if (!provider) {
      const { data, error } = await db.from('gig_providers').insert({
        ...payload,
        user_id:user.id,
        citizenship_status:'malaysian',
        citizenship_confirmed_at:new Date().toISOString(),
        main_service_confirmation_required:false
      }).select().single();
      if (error) throw error;
      provider = data;
      await syncServices(provider.id);
      await syncCustomServices(provider.id, customServices);
      await confirmMainService(provider.id, mainServiceId);
      msg('Pendaftaran dihantar. Listing sedang menunggu kelulusan admin RAPAT.', true);
    } else {
      const { data, error } = await db.from('gig_providers').update(payload).eq('id', provider.id).select().single();
      if (error) throw error;
      provider = data;
      await syncServices(provider.id);
      await syncCustomServices(provider.id, customServices);
      await confirmMainService(provider.id, mainServiceId);
      msg('Maklumat listing dan Servis Utama berjaya dikemas kini.', true);
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
  $('providerPostcode').addEventListener('input', autofillPostcode);
  $('mainCategory').onchange = () => renderMainServiceOptions($('mainCategory').value, '');
  $('mainService').onchange = () => ensureMainServiceSelected($('mainService').value);
  $('googleLogin').onclick = googleLogin;
  $('logoutBtn').onclick = async () => { await db.auth.signOut(); location.reload(); };
  $('saveProvider').onclick = saveProvider;
  $('confirmCitizenship').onclick = confirmCitizenship;
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
