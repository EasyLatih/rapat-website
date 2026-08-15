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

const STATE_ALIASES={
  'Wp Kuala Lumpur':'W.P. Kuala Lumpur','WP Kuala Lumpur':'W.P. Kuala Lumpur','Kuala Lumpur':'W.P. Kuala Lumpur',
  'Wp Putrajaya':'W.P. Putrajaya','WP Putrajaya':'W.P. Putrajaya','Putrajaya':'W.P. Putrajaya',
  'Wp Labuan':'W.P. Labuan','WP Labuan':'W.P. Labuan','Labuan':'W.P. Labuan'
};
const postcodeCache=new Map();

export function populateStates(select,placeholder='Pilih negeri'){
  select.innerHTML=`<option value="">${placeholder}</option>`+Object.keys(MALAYSIA_AREAS).map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
}
export function populateDistricts(select,state,placeholder='Pilih daerah / kawasan'){
  const list=MALAYSIA_AREAS[state]||[];
  select.innerHTML=`<option value="">${placeholder}</option>`+list.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  select.disabled=!state;
}
export function selectDistrict(select,state,district,placeholder='Pilih daerah / kawasan'){
  populateDistricts(select,state,placeholder);
  if(district&&!Array.from(select.options).some(o=>o.value.toLowerCase()===String(district).toLowerCase())){
    const o=document.createElement('option');o.value=district;o.textContent=district;select.appendChild(o);
  }
  const match=Array.from(select.options).find(o=>o.value.toLowerCase()===String(district||'').toLowerCase());
  if(match)select.value=match.value;
}
export async function lookupPostcode(value){
  const postcode=String(value||'').replace(/\D/g,'').slice(0,5);
  if(!/^\d{5}$/.test(postcode))return null;
  if(postcodeCache.has(postcode))return postcodeCache.get(postcode);
  const prefix=postcode.slice(0,2);
  const url=`https://cdn.jsdelivr.net/npm/@acfatah/malaysia-postcodes-data@2.2.1/dist/${prefix}xxx-postcodes.json`;
  const res=await fetch(url,{cache:'force-cache'});
  if(!res.ok)throw new Error('Postcode lookup tidak tersedia.');
  const rows=await res.json();
  const hit=Array.isArray(rows)?rows.find(x=>String(x.postcode)===postcode):null;
  if(!hit){postcodeCache.set(postcode,null);return null;}
  const state=STATE_ALIASES[String(hit.state||'').trim()]||String(hit.state||'').trim();
  const result={postcode,state,district:String(hit.city||'').trim()};
  postcodeCache.set(postcode,result);
  return result;
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
