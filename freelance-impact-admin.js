import { db } from './gig-config.js';
// Only report aggregated data after the database verifies a valid superadmin session.
const $impact = id => document.getElementById(id);
const escImpact = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nImpact = value => Number(value || 0).toLocaleString('ms-MY');
function impactCard(title,value,note) {
  return '<div class="impact-stat"><span>'+escImpact(title)+'</span><b>'+nImpact(value)+'</b><small>'+escImpact(note)+'</small></div>';
}
function impactTop(items, labelKey, valueKey) {
  if (!items?.length) return '<div class="muted2">Tiada data untuk tempoh dipilih.</div>';
  const maximum=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));
  return '<div class="impact-ranks">'+items.map((item,i) =>
    '<div class="impact-rank"><div class="impact-rank-title"><span>'+String(i+1)+'. '+escImpact(item[labelKey])+'</span><b>'+nImpact(item[valueKey])+'</b></div>'+
    '<div class="impact-track"><i style="width:'+Math.min(100,Math.max(3,Number(item[valueKey]||0)/maximum*100))+'%"></i></div></div>'
  ).join('')+'</div>';
}
function impactTrend(data, days) {
  const map = new Map((data.daily||[]).map(x=>[x.date,x]));
  const myToday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const origin=Date.parse(myToday+'T00:00:00Z');
  const n=Math.min(days||30,30), points=[];
  for(let i=n-1;i>=0;i--){
    const day=new Date(origin-i*86400000).toISOString().slice(0,10);
    const entry=map.get(day)||{};
    points.push({label:day.slice(5),count:Number(entry.whatsapp||0)});
  }
  return typeof gigLineChart==='function' ? gigLineChart(points) : '';
}
function mountImpact(){
  const before=document.querySelector('#view-gig .gig-manage-head');
  if (!before || $impact('gigImpact')) return;
  const section=document.createElement('section');
  section.id='gigImpact';
  section.className='panel impact-panel';
  section.innerHTML='<div class="impact-heading"><div><div class="eyebrow">RAPAT Impact & Analytics</div><h2>Interaksi & Klik WhatsApp</h2>'+
    '<p class="muted2">Rekod unik mengikut penyedia, pelayar dan hari. Klik bukan bukti mesej dihantar atau kerja diperoleh.</p></div>'+
    '<div class="impact-controls"><label for="impactPeriod">Tempoh</label><select id="impactPeriod"><option value="7">7 hari</option><option value="30" selected>30 hari</option><option value="90">90 hari</option><option value="0">Semua rekod</option></select>'+
    '<button id="impactRefresh" class="btn light small">↻ Refresh</button></div></div>'+
    '<div id="impactError" aria-live="polite"></div><div id="impactStats" class="impact-grid"></div>'+
    '<div class="impact-split"><div><h3>Trend Klik WhatsApp (hingga 30 hari)</h3><div id="impactTrend"></div></div>'+
    '<div><h3>Negeri Paling Banyak Klik</h3><div id="impactStates"></div></div></div>'+
    '<div class="impact-split"><div><h3>Top 10 Penyedia Diklik</h3><div id="impactProviders"></div></div>'+
    '<div><h3>Kategori Paling Banyak Diklik</h3><div id="impactCategories"></div></div></div>'+
    '<p class="muted2 impact-note">Anggaran pelayar unik bukan bilangan manusia. Statistik ini hanya meliputi interaksi yang direkod melalui RAPAT; tempahan dan hasil kerja belum disahkan.</p>';
  before.before(section);
  $impact('impactPeriod').onchange=loadImpact;
  $impact('impactRefresh').onclick=loadImpact;
}
async function loadImpact(){
  mountImpact();
  if (!$impact('gigImpact')) return;
  const token=localStorage.getItem('rapatSuperadmin');
  if (!token) return;
  const days=Number($impact('impactPeriod').value);
  $impact('impactError').textContent='Memuatkan analitik…';
  try {
    const {data,error}=await db.rpc('gig_admin_impact',{p_session_token:token,p_days:days});
    if(error) throw error;
    $impact('impactError').textContent='';
    $impact('impactStats').innerHTML=[
      impactCard('Klik WhatsApp',data.whatsapp_clicks,'Interaksi direkod'),
      impactCard('Paparan Profil',data.views,'Interaksi direkod'),
      impactCard('Penyedia Menerima Klik',data.providers_contacted,'Sekurang-kurangnya satu klik'),
      impactCard('Anggaran Pelayar Unik',data.approx_unique_browsers,'Bukan pelanggan disahkan')
    ].join('');
    $impact('impactTrend').innerHTML=impactTrend(data,days);
    $impact('impactProviders').innerHTML=impactTop(data.top_providers,'name','clicks');
    $impact('impactStates').innerHTML=impactTop(data.top_states,'name','count');
    $impact('impactCategories').innerHTML=impactTop(data.top_categories,'name','count');
  } catch(error) {
    $impact('impactError').textContent='Tidak dapat memuatkan analitik: '+(error.message||'Sila cuba lagi.');
  }
}
mountImpact();
$impact('gigAdminTab')?.addEventListener('click',loadImpact);
