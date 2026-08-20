import { db } from './gig-config.js';

const DELETE_ACCOUNT_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-gig-account';
const byId=id=>document.getElementById(id);

function mountDeletePanel(){
  const app=byId('providerApp');
  if(!app)return;
  let panel=byId('providerDeletePanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='providerDeletePanel';
    panel.className='panel hidden';
    panel.style.cssText='margin-top:16px;border:1px solid #f1c3c3;background:#fffafa';
    panel.innerHTML=`<h2 style="margin-top:0;color:#a52222">Padam Akaun</h2><p class="auth-chip">Tindakan ini kekal. Akaun Google/Supabase RAPAT anda, listing servis serta data berkaitan akan dipadam dan tidak boleh dipulihkan.</p><button id="deleteProviderAccount" class="btn light" style="border-color:#d84b4b;color:#a52222">Padam Akaun Saya</button><div id="deleteProviderMsg"></div>`;
    app.appendChild(panel);
    byId('deleteProviderAccount').onclick=deleteAccount;
  }
  syncDeletePanel();
}

function syncDeletePanel(){
  const panel=byId('providerDeletePanel');
  const title=(byId('formTitle')?.textContent||'').trim();
  if(panel)panel.classList.toggle('hidden',title!=='Urus Listing Anda');
}

function setDeleteMessage(text,bad=true){
  const host=byId('deleteProviderMsg');
  if(!host)return;
  host.innerHTML=text?`<div class="notice ${bad?'bad':''}" style="margin-top:12px"></div>`:'';
  if(text)host.firstElementChild.textContent=text;
}

async function deleteAccount(){
  const button=byId('deleteProviderAccount');
  if(!button)return;
  if(!confirm('Padam akaun RAPAT anda secara kekal? Listing dan data berkaitan akan dipadam.'))return;
  const phrase=prompt('Untuk sahkan, taip: PADAM AKAUN');
  if((phrase||'').trim().toUpperCase()!=='PADAM AKAUN'){
    setDeleteMessage('Pembatalan berjaya. Akaun anda tidak dipadam.',false);
    return;
  }

  button.disabled=true;
  const oldText=button.textContent;
  button.textContent='Memadam…';
  setDeleteMessage('');
  try{
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session?.access_token)throw new Error('Sesi telah tamat. Sila sign in semula.');
    const response=await fetch(DELETE_ACCOUNT_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({action:'delete_account'})
    });
    let result={};try{result=await response.json()}catch{}
    if(!response.ok||!result.ok)throw new Error(result.error||'Tidak dapat memadam akaun.');
    try{await db.auth.signOut({scope:'local'})}catch{}
    location.replace('freelance-provider.html?account_deleted=1');
  }catch(error){
    setDeleteMessage(error.message||'Tidak dapat memadam akaun.');
    button.disabled=false;
    button.textContent=oldText;
  }
}

function showDeletedNotice(){
  const params=new URLSearchParams(location.search);
  if(params.get('account_deleted')!=='1')return;
  const host=byId('loginMsg');
  if(host)host.innerHTML='<div class="notice">Akaun anda telah dipadam daripada RAPAT.</div>';
  params.delete('account_deleted');
  const query=params.toString();
  history.replaceState({},'',`${location.pathname}${query?`?${query}`:''}`);
}

mountDeletePanel();
showDeletedNotice();
const title=byId('formTitle');
if(title)new MutationObserver(syncDeletePanel).observe(title,{childList:true,subtree:true,characterData:true});
const app=byId('providerApp');
if(app)new MutationObserver(syncDeletePanel).observe(app,{attributes:true,attributeFilter:['class']});
setTimeout(syncDeletePanel,0);
