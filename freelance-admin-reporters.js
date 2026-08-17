(function(){
  const REPORTER_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-gig-reporters';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let installed=false;

  async function loadReporters(){
    const r=await fetch(REPORTER_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionToken:window.adminToken||adminToken})});
    let j={};try{j=await r.json()}catch{}
    if(!r.ok||!j.ok)throw new Error(j.error||'Unable to load reporter details');
    return j.reporters||[];
  }

  function install(){
    if(installed||typeof window.renderGigReports!=='function')return false;
    installed=true;
    const base=window.renderGigReports;
    window.renderGigReports=function(rows){
      base(rows);
      const host=document.getElementById('gigReports');
      if(!host||!Array.isArray(rows)||!rows.length)return;
      loadReporters().then(reporters=>{
        const map=new Map(reporters.map(x=>[x.report_id,x]));
        const cards=[...host.querySelectorAll('.journey-card')];
        rows.forEach((r,i)=>{
          const card=cards[i],person=map.get(r.id);
          if(!card||card.querySelector('.gig-reporter-box'))return;
          const name=person?.name||'Nama tidak tersedia';
          const email=person?.email||'Email tidak tersedia';
          const box=document.createElement('div');
          box.className='gig-reporter-box';
          box.style.cssText='margin:10px 0 12px;padding:10px 12px;border:1px solid #e1e8f2;border-radius:10px;background:#f8fbff;font-size:12px;line-height:1.55';
          box.innerHTML=`<div style="font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:800;color:#728096;margin-bottom:3px">Reported by · Superadmin only</div><b>${esc(name)}</b><div>${esc(email)}</div><div style="color:#728096;margin-top:2px">${esc(new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(r.created_at)))}</div>`;
          const reason=[...card.querySelectorAll('p')].find(p=>p.textContent.trim().startsWith('Reason:'));
          if(reason)reason.before(box);else card.appendChild(box);
        });
      }).catch(e=>console.warn('Reporter details:',e));
    };
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer)},100);
  }
})();