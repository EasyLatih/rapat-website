(function(){
  const DELETE_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-gig-admin-delete';

  function getAdminToken(){
    try{return adminToken||localStorage.getItem('rapatSuperadmin')||''}catch{return localStorage.getItem('rapatSuperadmin')||''}
  }

  async function deleteProviderAccount(providerId,displayName){
    const name=displayName||'penyedia ini';
    if(!confirm(`Padam akaun ${name} secara kekal? Listing dan data berkaitan akan dipadam.`))return;
    const phrase=prompt('Untuk sahkan, taip: PADAM AKAUN');
    if((phrase||'').trim().toUpperCase()!=='PADAM AKAUN')return;

    const token=getAdminToken();
    if(!token){alert('Sesi superadmin tidak sah. Sila login semula.');return}
    try{
      const response=await fetch(DELETE_API,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'delete_provider_account',sessionToken:token,providerId})
      });
      let result={};try{result=await response.json()}catch{}
      if(!response.ok||!result.ok)throw new Error(result.error||'Tidak dapat memadam akaun penyedia.');
      alert(`Akaun ${result.displayName||name} telah dipadam.`);
      if(typeof loadGigAdmin==='function')await loadGigAdmin();
    }catch(error){alert(error.message||'Tidak dapat memadam akaun penyedia.')}
  }

  function mountDeleteButtons(){
    document.querySelectorAll('#gigProviders tr[data-provider-id]').forEach(row=>{
      if(row.querySelector('[data-gig-delete-account]'))return;
      const providerId=row.getAttribute('data-provider-id');
      const actionCell=row.lastElementChild;
      if(!providerId||!actionCell)return;
      const actionWrap=actionCell.querySelector('div')||actionCell;
      const displayName=row.querySelector('td b')?.textContent?.trim()||'penyedia ini';
      const button=document.createElement('button');
      button.type='button';
      button.className='btn light small';
      button.dataset.gigDeleteAccount='1';
      button.textContent='Delete Account';
      button.style.cssText='border-color:#d84b4b;color:#a52222';
      button.onclick=()=>deleteProviderAccount(providerId,displayName);
      actionWrap.appendChild(button);
    });
  }

  const observer=new MutationObserver(mountDeleteButtons);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountDeleteButtons);
  else mountDeleteButtons();
})();
