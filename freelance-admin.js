function gigMountAdminUI(){
  if(!document.querySelector('link[data-gig-admin-dashboard]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='freelance-admin-dashboard.css?v=1';link.dataset.gigAdminDashboard='1';
    document.head.appendChild(link);
  }
  const nav=document.querySelector('.admin-nav');
  if(nav&&!document.getElementById('gigAdminTab')){
    const b=document.createElement('button');b.id='gigAdminTab';b.className='tab';b.textContent='Service Directory';b.onclick=()=>adminTab('gig',b);
    const audit=[...nav.querySelectorAll('button')].find(x=>x.textContent.trim()==='Audit Log');nav.insertBefore(b,audit||nav.lastElementChild);
  }
  const app=document.getElementById('adminApp');
  if(app&&!document.getElementById('view-gig')){
    const s=document.createElement('section');s.id='view-gig';s.className='admin-view';s.innerHTML=`
      <div id="gigAdminMsg"></div>
      <div class="gig-dash-head">
        <div><div class="eyebrow">RAPAT Service Directory</div><h2>Ringkasan Penyedia Servis</h2><p class="muted">Data live daripada pendaftaran penyedia servis RAPAT.</p></div>
        <button class="btn light small" onclick="loadGigAdmin()">↻ Refresh</button>
      </div>
      <div id="gigStats" class="gig-kpi-grid"></div>
      <div class="gig-dashboard-main">
        <div class="panel"><div class="sectiontitle"><div><h2>Pendaftaran 30 Hari Terakhir</h2><div id="gigTrendMeta" class="muted2"></div></div></div><div id="gigRegistrationChart"></div></div>
        <div class="panel"><h2>Penyedia Mengikut Negeri</h2><p class="muted2">Approved & published</p><div id="gigStateChart"></div></div>
      </div>
      <div class="gig-dashboard-two">
        <div class="panel"><h2>Top Servis</h2><p class="muted2">Servis paling banyak ditawarkan oleh listing live.</p><div id="gigTopServices"></div></div>
        <div class="panel"><h2>Kategori Paling Popular</h2><p class="muted2">Kategori berdasarkan listing live.</p><div id="gigTopCategories"></div></div>
      </div>
      <div class="panel" style="margin-top:16px"><div class="sectiontitle"><div><h2>Pendaftaran Terkini</h2><p class="muted2">Penyedia terbaru yang mendaftar di RAPAT.</p></div><span id="gigRecentMeta" class="muted2"></span></div><div id="gigRecentProviders"></div></div>

      <div class="gig-manage-head"><div><div class="eyebrow">Operations</div><h2>Manage Service Directory</h2></div><div id="gigOpsMeta" class="muted2"></div></div>
      <div class="grid2" style="margin-top:16px"><div class="panel"><h2>Service Providers</h2><p class="muted">Approve, reject or suspend provider listings.</p><div id="gigProviders"></div></div><div class="panel"><h2>Reports / Aduan</h2><p class="muted">Review public reports and take action where necessary.</p><div id="gigReports"></div></div></div>
      <div class="grid2" style="margin-top:16px"><div class="panel"><h2>Add Category</h2><div class="field"><label>Category Name</label><input id="gigNewCategory" placeholder="e.g. Pet Care"></div><button class="btn primary" onclick="gigCreateCategory()">+ Add Category</button><hr style="border:0;border-top:1px solid #e7ebf1;margin:20px 0"><h2>Add Service</h2><div class="field"><label>Category</label><select id="gigCategorySelect"></select></div><div class="field"><label>Service Name</label><input id="gigNewService" placeholder="e.g. Cat Sitting"></div><button class="btn primary" onclick="gigCreateService()">+ Add Service</button></div><div class="panel"><h2>Categories & Services</h2><p class="muted">Click a service to enable or disable it.</p><div id="gigCategories"></div></div></div>`;
    const audit=document.getElementById('view-audit');audit?.before(s);
  }
}
gigMountAdminUI();

const GIG_ADMIN_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-gig-admin';
const gig$=id=>document.getElementById(id);
const gigEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const gigNice=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const gigMYDateTime=d=>new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d));
const gigDateKey=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));

async function gigAdminApi(action,data={}){
  const r=await fetch(GIG_ADMIN_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,sessionToken:adminToken,...data})});
  let j={};try{j=await r.json()}catch{}
  if(!r.ok||!j.ok)throw new Error(j.error||'Request failed');
  return j;
}

function gigServiceEntries(p){
  const rows=Array.isArray(p.gig_provider_services)?p.gig_provider_services:[];
  const standard=rows.map(x=>{
    const s=Array.isArray(x.gig_services)?x.gig_services[0]:x.gig_services;
    const c=Array.isArray(s?.gig_categories)?s.gig_categories[0]:s?.gig_categories;
    return s?.name?{category:c?.name||'Lain-lain',name:s.name}:null;
  }).filter(Boolean).filter(x=>!(x.category==='Lain-lain'&&x.name==='Lain-lain'));
  const custom=(Array.isArray(p.gig_provider_custom_services)?p.gig_provider_custom_services:[]).map(x=>x?.name?{category:'Lain-lain',name:x.name}:null).filter(Boolean);
  return [...standard,...custom];
}
function gigProviderServices(p){const all=gigServiceEntries(p);return all.length?all.map(x=>`${x.category} · ${x.name}`).join(', '):'-'}
function gigJoined(x,key){const v=x?.[key];return Array.isArray(v)?v[0]:v}
function gigCountBy(items,keyFn){const map=new Map();for(const item of items){const key=keyFn(item);if(!key)continue;map.set(key,(map.get(key)||0)+1)}return [...map.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))}
function gigLastNDays(rows,n=30){
  const counts=new Map();for(const r of rows){const k=gigDateKey(r.created_at);counts.set(k,(counts.get(k)||0)+1)}
  const out=[];const now=new Date();
  for(let i=n-1;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const key=gigDateKey(d);out.push({key,label:new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short'}).format(d),count:counts.get(key)||0})}
  return out;
}
function gigLineChart(data){
  const w=720,h=210,pad=28,max=Math.max(1,...data.map(x=>x.count));
  const pts=data.map((x,i)=>({x:pad+i*(w-pad*2)/Math.max(1,data.length-1),y:h-pad-(x.count/max)*(h-pad*2),...x}));
  const path=pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area=`${path} L ${pts.at(-1).x.toFixed(1)} ${h-pad} L ${pts[0].x.toFixed(1)} ${h-pad} Z`;
  const ticks=[0,Math.ceil(max/2),max],labels=[0,Math.floor((data.length-1)/3),Math.floor((data.length-1)*2/3),data.length-1];
  return `<svg class="gig-line-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Pendaftaran 30 hari terakhir">${ticks.map(t=>{const y=h-pad-(t/max)*(h-pad*2);return `<line x1="${pad}" x2="${w-pad}" y1="${y}" y2="${y}" class="gig-gridline"/><text x="4" y="${y+4}" class="gig-axis">${t}</text>`}).join('')}<path d="${area}" class="gig-area"/><path d="${path}" class="gig-line"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" class="gig-dot"><title>${gigEsc(p.label)}: ${p.count}</title></circle>`).join('')}${labels.map(i=>`<text x="${pts[i].x}" y="${h-5}" text-anchor="middle" class="gig-axis">${gigEsc(pts[i].label)}</text>`).join('')}</svg>`;
}
function gigBarList(items,limit=8){const top=items.slice(0,limit),max=Math.max(1,...top.map(x=>x.count));if(!top.length)return '<div class="empty">Belum ada data.</div>';return `<div class="gig-bar-list">${top.map((x,i)=>`<div class="gig-bar-row"><div class="gig-bar-label"><span>${i+1}. ${gigEsc(x.name)}</span><b>${x.count}</b></div><div class="gig-bar-track"><i style="width:${Math.max(5,x.count/max*100)}%"></i></div></div>`).join('')}</div>`}
function gigDashboardData(rows){
  const live=rows.filter(p=>p.status==='approved'&&p.is_published),entriesAll=rows.flatMap(p=>gigServiceEntries(p)),liveEntries=live.flatMap(p=>gigServiceEntries(p));
  const states=gigCountBy(live,p=>p.state),services=gigCountBy(liveEntries,x=>x.name),categories=gigCountBy(liveEntries,x=>x.category),today=gigDateKey(new Date()),weekAgo=Date.now()-6*86400000;
  return {live,entriesAll,states,services,categories,today:rows.filter(p=>gigDateKey(p.created_at)===today).length,last7:rows.filter(p=>new Date(p.created_at).getTime()>=weekAgo).length,trend:gigLastNDays(rows,30)};
}
function renderGigDashboard(rows,dash,reports){
  const d=gigDashboardData(rows),s=dash.stats||{};
  const statCards=[['👥','Total Penyedia Servis',s.providers??rows.length,'Semua pendaftaran'],['✓','Approved',s.approved??rows.filter(x=>x.status==='approved').length,'Listing diluluskan'],['◷','Pending Approval',s.pending??rows.filter(x=>x.status==='pending').length,'Perlu tindakan admin'],['▣','Jumlah Servis Ditawarkan',d.entriesAll.length,'Standard + custom'],['⌖','Negeri Diliputi',`${d.states.length}/16`,'Approved & published']];
  gig$('gigStats').innerHTML=statCards.map((x,i)=>`<div class="admin-stat gig-kpi gig-kpi-${i+1}"><div class="gig-kpi-top"><span class="gig-kpi-icon">${x[0]}</span><span>${gigEsc(x[1])}</span></div><b>${x[2]}</b><small>${gigEsc(x[3])}</small></div>`).join('');
  gig$('gigTrendMeta').textContent=`${d.today} daftar hari ini · ${d.last7} dalam 7 hari`;
  gig$('gigRegistrationChart').innerHTML=gigLineChart(d.trend);gig$('gigStateChart').innerHTML=gigBarList(d.states,8);gig$('gigTopServices').innerHTML=gigBarList(d.services,8);gig$('gigTopCategories').innerHTML=gigBarList(d.categories,8);
  const recent=rows.slice(0,7);gig$('gigRecentMeta').textContent=`${rows.length} jumlah provider`;
  gig$('gigRecentProviders').innerHTML=recent.length?`<div style="overflow:auto"><table class="admin-table gig-recent-table"><thead><tr><th>Nama</th><th>Negeri</th><th>Servis</th><th>Status</th><th>Tarikh Daftar</th></tr></thead><tbody>${recent.map(p=>{const entries=gigServiceEntries(p),shown=entries.slice(0,2).map(x=>x.name).join(', '),extra=Math.max(0,entries.length-2);return `<tr><td><b>${gigEsc(p.display_name)}</b><div class="muted2">${gigEsc(p.district||'')}</div></td><td>${gigEsc(p.state||'-')}</td><td>${gigEsc(shown||'-')}${extra?` <span class="muted2">+${extra} lagi</span>`:''}</td><td><span class="badge ${p.status==='approved'?'ok':p.status==='pending'?'wait':''}">${gigEsc(gigNice(p.status))}</span></td><td>${gigEsc(gigMYDateTime(p.created_at))}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pendaftaran.</div>';
  const open=(reports||[]).filter(r=>r.status==='open'||r.status==='reviewing').length;gig$('gigOpsMeta').textContent=`${s.pending||0} pending approval · ${open} open report · ${s.interactions||0} tracked actions`;
}

async function loadGigAdmin(){
  try{
    const [dash,providers,reports,categories]=await Promise.all([gigAdminApi('dashboard'),gigAdminApi('providers'),gigAdminApi('reports'),gigAdminApi('categories')]);
    const providerRows=providers.providers||[],reportRows=reports.reports||[];renderGigDashboard(providerRows,dash,reportRows);renderGigProviders(providerRows);renderGigReports(reportRows);renderGigCategories(categories.categories||[]);
  }catch(e){if(String(e.message).includes('access'))return adminLogout();gig$('gigAdminMsg').innerHTML=`<div class="alert">${gigEsc(e.message)}</div>`}
}

function renderGigProviders(rows){gig$('gigProviders').innerHTML=rows.length?`<div style="overflow:auto"><table class="admin-table"><thead><tr><th>Provider</th><th>Coverage</th><th>Services</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(p=>`<tr><td><b>${gigEsc(p.display_name)}</b><div class="muted2">${gigEsc(p.whatsapp)}</div><a href="${gigEsc(p.social_url)}" target="_blank" rel="noopener noreferrer">Social / Website</a></td><td>${gigEsc(p.postcode)}<br>${gigEsc(p.district)}, ${gigEsc(p.state)}</td><td style="min-width:230px">${gigEsc(gigProviderServices(p))}</td><td><span class="badge ${p.status==='approved'?'ok':p.status==='pending'?'wait':''}">${gigEsc(gigNice(p.status))}</span><div class="muted2">${p.is_published?'Published':'Unpublished'}</div></td><td style="min-width:205px"><div style="display:flex;gap:6px;flex-wrap:wrap">${p.status!=='approved'?`<button class="btn primary small" onclick="gigSetProviderStatus('${p.id}','approved')">Approve</button>`:''}${p.status!=='rejected'?`<button class="btn light small" onclick="gigSetProviderStatus('${p.id}','rejected')">Reject</button>`:''}${p.status!=='suspended'?`<button class="btn light small" onclick="gigSetProviderStatus('${p.id}','suspended')">Suspend</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No service providers yet.</div>'}
async function gigSetProviderStatus(providerId,status){try{await gigAdminApi('set_provider_status',{providerId,status});await loadGigAdmin()}catch(e){alert(e.message)}}
function renderGigReports(rows){gig$('gigReports').innerHTML=rows.length?rows.map(r=>{const p=gigJoined(r,'gig_providers')||{};return `<div class="journey-card"><div class="sectiontitle"><div><b>${gigEsc(p.display_name||'Provider')}</b><div class="muted2">${gigEsc([p.postcode,p.district,p.state].filter(Boolean).join(' · '))}</div></div><span class="badge ${r.status==='resolved'||r.status==='dismissed'?'ok':'wait'}">${gigEsc(gigNice(r.status))}</span></div><p><b>Reason:</b> ${gigEsc(gigNice(r.reason))}</p><p>${gigEsc(r.details||'No additional details.')}</p><div class="field"><label>Admin Note</label><input id="gig-note-${r.id}" value="${gigEsc(r.admin_note||'')}" placeholder="Optional internal note"></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn light small" onclick="gigSetReportStatus('${r.id}','reviewing')">Reviewing</button><button class="btn primary small" onclick="gigSetReportStatus('${r.id}','resolved')">Resolved</button><button class="btn light small" onclick="gigSetReportStatus('${r.id}','dismissed')">Dismiss</button>${p.status!=='suspended'&&r.provider_id?`<button class="btn light small" onclick="gigSetProviderStatus('${r.provider_id}','suspended')">Suspend Provider</button>`:''}</div></div>`}).join(''):'<div class="empty">No reports yet.</div>'}
async function gigSetReportStatus(reportId,status){try{await gigAdminApi('set_report_status',{reportId,status,adminNote:gig$(`gig-note-${reportId}`)?.value||''});await loadGigAdmin()}catch(e){alert(e.message)}}
function renderGigCategories(rows){gig$('gigCategorySelect').innerHTML=rows.filter(c=>c.active).map(c=>`<option value="${c.id}">${gigEsc(c.name)}</option>`).join('');gig$('gigCategories').innerHTML=rows.map(c=>`<div class="journey-card"><div class="sectiontitle"><div><b>${gigEsc(c.name)}</b><div class="muted2">${gigEsc(c.slug)}</div></div><button class="btn light small" onclick="gigToggleCategory('${c.id}',${!c.active})">${c.active?'Disable':'Enable'}</button></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${(c.gig_services||[]).map(s=>`<button class="btn light small" title="Click to ${s.active?'disable':'enable'}" onclick="gigToggleService('${s.id}',${!s.active})">${s.active?'✓':'○'} ${gigEsc(s.name)}</button>`).join('')||'<span class="muted">No services.</span>'}</div></div>`).join('')}
async function gigCreateCategory(){const name=gig$('gigNewCategory').value.trim();if(!name)return;try{await gigAdminApi('create_category',{name});gig$('gigNewCategory').value='';await loadGigAdmin()}catch(e){alert(e.message)}}
async function gigCreateService(){const name=gig$('gigNewService').value.trim(),categoryId=gig$('gigCategorySelect').value;if(!name||!categoryId)return;try{await gigAdminApi('create_service',{name,categoryId});gig$('gigNewService').value='';await loadGigAdmin()}catch(e){alert(e.message)}}
async function gigToggleCategory(categoryId,active){try{await gigAdminApi('set_category_active',{categoryId,active});await loadGigAdmin()}catch(e){alert(e.message)}}
async function gigToggleService(serviceId,active){try{await gigAdminApi('set_service_active',{serviceId,active});await loadGigAdmin()}catch(e){alert(e.message)}}

const baseAdminTab=adminTab;
adminTab=function(name,b){baseAdminTab(name,b);if(name==='gig')loadGigAdmin()};
