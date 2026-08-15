const GIG_ADMIN_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-gig-admin';
const gig$=id=>document.getElementById(id);
const gigEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const gigNice=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());

async function gigAdminApi(action,data={}){
  const r=await fetch(GIG_ADMIN_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,sessionToken:adminToken,...data})});
  let j={};try{j=await r.json()}catch{}
  if(!r.ok||!j.ok)throw new Error(j.error||'Request failed');
  return j;
}

function gigProviderServices(p){
  const rows=Array.isArray(p.gig_provider_services)?p.gig_provider_services:[];
  return rows.map(x=>{const s=Array.isArray(x.gig_services)?x.gig_services[0]:x.gig_services;const c=Array.isArray(s?.gig_categories)?s.gig_categories[0]:s?.gig_categories;return [c?.name,s?.name].filter(Boolean).join(' · ')}).filter(Boolean).join(', ')||'-';
}
function gigJoined(x,key){const v=x?.[key];return Array.isArray(v)?v[0]:v}

async function loadGigAdmin(){
  try{
    const [dash,providers,reports,categories]=await Promise.all([
      gigAdminApi('dashboard'),gigAdminApi('providers'),gigAdminApi('reports'),gigAdminApi('categories')
    ]);
    const s=dash.stats;
    gig$('gigStats').innerHTML=[['Providers',s.providers],['Pending Approval',s.pending],['Approved',s.approved],['Open Reports',s.openReports],['Tracked Actions',s.interactions]].map(x=>`<div class="admin-stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
    renderGigProviders(providers.providers||[]);
    renderGigReports(reports.reports||[]);
    renderGigCategories(categories.categories||[]);
  }catch(e){
    if(String(e.message).includes('access'))return adminLogout();
    gig$('gigAdminMsg').innerHTML=`<div class="alert">${gigEsc(e.message)}</div>`;
  }
}

function renderGigProviders(rows){
  gig$('gigProviders').innerHTML=rows.length?`<div style="overflow:auto"><table class="admin-table"><thead><tr><th>Provider</th><th>Coverage</th><th>Services</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(p=>`<tr><td><b>${gigEsc(p.display_name)}</b><div class="muted2">${gigEsc(p.whatsapp)}</div><a href="${gigEsc(p.social_url)}" target="_blank" rel="noopener noreferrer">Social / Website</a></td><td>${gigEsc(p.postcode)}<br>${gigEsc(p.district)}, ${gigEsc(p.state)}</td><td style="min-width:230px">${gigEsc(gigProviderServices(p))}</td><td><span class="badge ${p.status==='approved'?'ok':p.status==='pending'?'wait':''}">${gigEsc(gigNice(p.status))}</span><div class="muted2">${p.is_published?'Published':'Unpublished'}</div></td><td style="min-width:205px"><div style="display:flex;gap:6px;flex-wrap:wrap">${p.status!=='approved'?`<button class="btn primary small" onclick="gigSetProviderStatus('${p.id}','approved')">Approve</button>`:''}${p.status!=='rejected'?`<button class="btn light small" onclick="gigSetProviderStatus('${p.id}','rejected')">Reject</button>`:''}${p.status!=='suspended'?`<button class="btn light small" onclick="gigSetProviderStatus('${p.id}','suspended')">Suspend</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No service providers yet.</div>';
}

async function gigSetProviderStatus(providerId,status){
  try{await gigAdminApi('set_provider_status',{providerId,status});await loadGigAdmin()}catch(e){alert(e.message)}
}

function renderGigReports(rows){
  gig$('gigReports').innerHTML=rows.length?rows.map(r=>{const p=gigJoined(r,'gig_providers')||{};return `<div class="journey-card"><div class="sectiontitle"><div><b>${gigEsc(p.display_name||'Provider')}</b><div class="muted2">${gigEsc([p.postcode,p.district,p.state].filter(Boolean).join(' · '))}</div></div><span class="badge ${r.status==='resolved'||r.status==='dismissed'?'ok':'wait'}">${gigEsc(gigNice(r.status))}</span></div><p><b>Reason:</b> ${gigEsc(gigNice(r.reason))}</p><p>${gigEsc(r.details||'No additional details.')}</p><div class="field"><label>Admin Note</label><input id="gig-note-${r.id}" value="${gigEsc(r.admin_note||'')}" placeholder="Optional internal note"></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn light small" onclick="gigSetReportStatus('${r.id}','reviewing')">Reviewing</button><button class="btn primary small" onclick="gigSetReportStatus('${r.id}','resolved')">Resolved</button><button class="btn light small" onclick="gigSetReportStatus('${r.id}','dismissed')">Dismiss</button>${p.status!=='suspended'&&r.provider_id?`<button class="btn light small" onclick="gigSetProviderStatus('${r.provider_id}','suspended')">Suspend Provider</button>`:''}</div></div>`}).join(''):'<div class="empty">No reports yet.</div>';
}

async function gigSetReportStatus(reportId,status){
  try{await gigAdminApi('set_report_status',{reportId,status,adminNote:gig$(`gig-note-${reportId}`)?.value||''});await loadGigAdmin()}catch(e){alert(e.message)}
}

function renderGigCategories(rows){
  gig$('gigCategorySelect').innerHTML=rows.filter(c=>c.active).map(c=>`<option value="${c.id}">${gigEsc(c.name)}</option>`).join('');
  gig$('gigCategories').innerHTML=rows.map(c=>`<div class="journey-card"><div class="sectiontitle"><div><b>${gigEsc(c.name)}</b><div class="muted2">${gigEsc(c.slug)}</div></div><button class="btn light small" onclick="gigToggleCategory('${c.id}',${!c.active})">${c.active?'Disable':'Enable'}</button></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(c.gig_services||[]).map(s=>`<button class="btn light small" title="Click to ${s.active?'disable':'enable'}" onclick="gigToggleService('${s.id}',${!s.active})">${s.active?'✓':'○'} ${gigEsc(s.name)}</button>`).join('')||'<span class="muted">No services.</span>'}</div></div>`).join('');
}

async function gigCreateCategory(){
  const name=gig$('gigNewCategory').value.trim();if(!name)return;
  try{await gigAdminApi('create_category',{name});gig$('gigNewCategory').value='';await loadGigAdmin()}catch(e){alert(e.message)}
}
async function gigCreateService(){
  const name=gig$('gigNewService').value.trim(),categoryId=gig$('gigCategorySelect').value;if(!name||!categoryId)return;
  try{await gigAdminApi('create_service',{name,categoryId});gig$('gigNewService').value='';await loadGigAdmin()}catch(e){alert(e.message)}
}
async function gigToggleCategory(categoryId,active){try{await gigAdminApi('set_category_active',{categoryId,active});await loadGigAdmin()}catch(e){alert(e.message)}}
async function gigToggleService(serviceId,active){try{await gigAdminApi('set_service_active',{serviceId,active});await loadGigAdmin()}catch(e){alert(e.message)}}

const baseAdminTab=adminTab;
adminTab=function(name,b){baseAdminTab(name,b);if(name==='gig')loadGigAdmin()};
