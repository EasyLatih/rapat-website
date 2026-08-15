import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';

const SUPABASE_URL='https://afyqxqvflchgwbtmoogd.supabase.co';
const SUPABASE_KEY='sb_publishable_mFbkAT7UVw1v8SPmC25WSw_8wQVQc4c';
export const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

export const MALAYSIA_AREAS={
  'Johor':['Batu Pahat','Johor Bahru','Kluang','Kota Tinggi','Kulai','Mersing','Muar','Pontian','Segamat','Tangkak'],
  'Kedah':['Baling','Bandar Baharu','Kota Setar','Kuala Muda','Kubang Pasu','Kulim','Langkawi','Padang Terap','Pendang','Pokok Sena','Sik','Yan'],
  'Kelantan':['Bachok','Gua Musang','Jeli','Kota Bharu','Kuala Krai','Machang','Pasir Mas','Pasir Puteh','Tanah Merah','Tumpat'],
  'Melaka':['Alor Gajah','Jasin','Melaka Tengah'],
  'Negeri Sembilan':['Jelebu','Jempol','Kuala Pilah','Port Dickson','Rembau','Seremban','Tampin'],
  'Pahang':['Bentong','Bera','Cameron Highlands','Jerantut','Kuantan','Lipis','Maran','Pekan','Raub','Rompin','Temerloh'],
  'Perak':['Bagan Datuk','Batang Padang','Hilir Perak','Hulu Perak','Kampar','Kerian','Kinta','Kuala Kangsar','Larut, Matang dan Selama','Manjung','Muallim','Perak Tengah','Selama'],
  'Perlis':['Kangar'],
  'Pulau Pinang':['Barat Daya','Seberang Perai Selatan','Seberang Perai Tengah','Seberang Perai Utara','Timur Laut'],
  'Sabah':['Beaufort','Beluran','Keningau','Kinabatangan','Kota Belud','Kota Kinabalu','Kota Marudu','Kuala Penyu','Kudat','Kunak','Lahad Datu','Nabawan','Papar','Penampang','Pitas','Putatan','Ranau','Sandakan','Semporna','Sipitang','Tambunan','Tawau','Tenom','Tongod','Tuaran'],
  'Sarawak':['Asajaya','Bau','Belaga','Beluru','Betong','Bintulu','Dalat','Daro','Julau','Kabong','Kanowit','Kapit','Kuching','Lawas','Limbang','Lubok Antu','Lundu','Maradong','Marudi','Matu','Meradong','Miri','Mukah','Pakan','Pusa','Samarahan','Saratok','Sarikei','Sebauh','Selangau','Serian','Sibu','Simunjan','Song','Sri Aman','Subis','Tatau'],
  'Selangor':['Gombak','Hulu Langat','Hulu Selangor','Klang','Kuala Langat','Kuala Selangor','Petaling','Sabak Bernam','Sepang'],
  'Terengganu':['Besut','Dungun','Hulu Terengganu','Kemaman','Kuala Nerus','Kuala Terengganu','Marang','Setiu'],
  'W.P. Kuala Lumpur':['Kuala Lumpur'],
  'W.P. Labuan':['Labuan'],
  'W.P. Putrajaya':['Putrajaya']
};

export function populateStates(select,placeholder='Pilih negeri'){
  select.innerHTML=`<option value="">${placeholder}</option>`+Object.keys(MALAYSIA_AREAS).map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
}
export function populateDistricts(select,state,placeholder='Pilih daerah'){
  const list=MALAYSIA_AREAS[state]||[];
  select.innerHTML=`<option value="">${placeholder}</option>`+list.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  select.disabled=!state;
}
export function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
export function ensureVisitorKey(){
  let key=localStorage.getItem('rapatGigVisitor');
  if(!key){key=crypto.randomUUID();localStorage.setItem('rapatGigVisitor',key)}
  return key;
}
export function whatsappNumber(raw){
  let n=String(raw||'').replace(/\D/g,'');
  if(n.startsWith('0'))n='60'+n.slice(1);
  return n;
}
export function ratingStars(avg){
  const n=Math.max(0,Math.min(5,Math.round(Number(avg||0))));
  return '★'.repeat(n)+'☆'.repeat(5-n);
}
