const GIG_EMAIL_BACKFILL_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-gig-send-approval-email';
let gigEmailBackfillRunning=false;

async function gigEmailOne(providerId){
  const r=await fetch(GIG_EMAIL_BACKFILL_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionToken:adminToken,providerId})});
  let j={};try{j=await r.json()}catch{}
  if(!r.ok||!j.ok)throw new Error(j.error||'Email request failed');
  return j;
}

async function gigRefreshEmailBackfillButton(){
  const head=document.querySelector('#view-gig .gig-dash-head');
  if(!head||typeof gigAdminApi!=='function')return;
  let btn=document.getElementById('gigEmailBackfillBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='gigEmailBackfillBtn';
    btn.className='btn primary small';
    btn.style.marginLeft='8px';
    btn.onclick=gigRunApprovalEmailBackfill;
    const refresh=head.querySelector('button');
    if(refresh)refresh.before(btn);else head.appendChild(btn);
  }
  try{
    const j=await gigAdminApi('providers');
    const targets=(j.providers||[]).filter(p=>p.status==='approved'&&!p.approved_email_sent_at);
    btn.dataset.count=String(targets.length);
    btn.textContent=targets.length?`✉ Hantar Email Approval (${targets.length})`:'✓ Semua Email Approval Dah Dihantar';
    btn.disabled=gigEmailBackfillRunning||targets.length===0;
  }catch(e){
    console.warn('Unable to refresh approval email count',e);
  }
}

async function gigRunApprovalEmailBackfill(){
  if(gigEmailBackfillRunning)return;
  try{
    const j=await gigAdminApi('providers');
    const targets=(j.providers||[]).filter(p=>p.status==='approved'&&!p.approved_email_sent_at);
    if(!targets.length){await gigRefreshEmailBackfillButton();return;}
    if(!confirm(`Hantar email approval kepada ${targets.length} provider yang belum pernah menerima email?`))return;
    gigEmailBackfillRunning=true;
    const btn=document.getElementById('gigEmailBackfillBtn');
    if(btn){btn.disabled=true;btn.textContent=`Menghantar 0/${targets.length}...`}
    let sent=0,failed=0,skipped=0;
    const failures=[];
    for(let i=0;i<targets.length;i++){
      try{
        const result=await gigEmailOne(targets[i].id);
        if(result.skipped)skipped++;else sent++;
      }catch(e){failed++;failures.push(`${targets[i].display_name||'Provider'}: ${e.message}`)}
      if(btn)btn.textContent=`Menghantar ${i+1}/${targets.length}...`;
      await new Promise(r=>setTimeout(r,700));
    }
    const box=document.getElementById('gigAdminMsg');
    if(box)box.innerHTML=`<div class="alert" style="border-color:${failed?'#f0c36d':'#b7e4c7'};background:${failed?'#fff9e8':'#f0fff4'}"><b>Email approval selesai.</b> Berjaya: ${sent}${skipped?` · Skip: ${skipped}`:''}${failed?` · Gagal: ${failed}`:''}${failed?`<div class="muted2" style="margin-top:6px">${failures.slice(0,5).map(gigEsc).join('<br>')}</div>`:''}</div>`;
    await loadGigAdmin();
  }catch(e){alert(e.message)}finally{
    gigEmailBackfillRunning=false;
    await gigRefreshEmailBackfillButton();
  }
}

(function bootGigEmailBackfill(){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(document.getElementById('view-gig')&&typeof gigAdminApi==='function'){
      clearInterval(timer);
      gigRefreshEmailBackfillButton();
      const base=window.loadGigAdmin;
      if(typeof base==='function'&&!base.__emailBackfillWrapped){
        const wrapped=async function(...args){const r=await base.apply(this,args);await gigRefreshEmailBackfillButton();return r};
        wrapped.__emailBackfillWrapped=true;
        window.loadGigAdmin=wrapped;
      }
    }else if(tries>100)clearInterval(timer);
  },100);
})();
