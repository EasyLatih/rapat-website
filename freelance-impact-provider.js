import { db } from './gig-config.js';
const $ = id => document.getElementById(id);
function impactNum(n){return Number(n||0).toLocaleString('ms-MY');}
function impactProviderRows(data){
  const entries=(data.daily||[]).slice(-7).reverse();
  if(!entries.length) return '<p class="auth-chip">Belum ada interaksi direkod dalam tempoh ini.</p>';
  return '<div class="impact-provider-days">'+entries.map(d=>
    '<div><span>'+String(d.date).slice(0,10)+'</span><span>Profil: '+impactNum(d.views)+'</span><b>WhatsApp: '+impactNum(d.whatsapp)+'</b></div>'
  ).join('')+'</div>';
}
function mountImpact(){
  const target=$('metrics');
  if(!target||$('providerImpact'))return;
  const section=document.createElement('section');
  section.id='providerImpact';
  section.className='panel impact-panel';
  section.innerHTML='<div class="impact-heading"><div><h2>Prestasi Profil RAPAT</h2><p class="auth-chip">Interaksi unik direkod mengikut pelayar dan hari, bukan jumlah pelanggan sebenar.</p></div>'+
    '<div class="impact-controls"><label for="providerImpactDays">Tempoh</label><select id="providerImpactDays"><option value="7">7 hari</option><option value="30" selected>30 hari</option><option value="90">90 hari</option></select></div></div>'+
    '<div id="providerImpactMessage" class="auth-chip"></div><div id="providerImpactStats" class="impact-grid"></div>'+
    '<h3>Aktiviti Terkini</h3><div id="providerImpactDaysList"></div>'+
    '<p class="auth-chip">Klik WhatsApp menunjukkan minat untuk menghubungi anda. RAPAT tidak dapat mengesahkan mesej dihantar atau kerja berjaya diperoleh.</p>';
  target.after(section);
  $('providerImpactDays').onchange=loadImpact;
}
async function loadImpact(){
  const message=$('providerImpactMessage');
  if (!message) return;
  message.textContent='Memuatkan statistik…';
  const {data,error}=await db.rpc('gig_my_impact',{p_days:Number($('providerImpactDays').value)});
  if(error){message.textContent='Statistik tidak tersedia: '+error.message;return;}
  message.textContent='';
  $('providerImpactStats').innerHTML=
    '<div class="impact-stat"><span>Paparan Profil</span><b>'+impactNum(data.views)+'</b><small>Dalam tempoh dipilih</small></div>'+
    '<div class="impact-stat"><span>Klik WhatsApp</span><b>'+impactNum(data.whatsapp_clicks)+'</b><small>Dalam tempoh dipilih</small></div>';
  $('providerImpactDaysList').innerHTML=impactProviderRows(data);
}
(async()=>{
  mountImpact();
  try {
    const {data:{user}}=await db.auth.getUser();
    if(user) await loadImpact();
  }catch(error){
    if($('providerImpactMessage')) $('providerImpactMessage').textContent='Statistik belum dapat dimuatkan.';
  }
})();
