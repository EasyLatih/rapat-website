// RAPAT public navigation enhancements.
const core=document.createElement('script');
core.src='app-core.js?v=2';
core.onload=()=>{
  document.querySelectorAll('a').forEach(a=>{if(a.textContent.trim()==='Events')a.href='events-directory.html'});

  const desktop=document.querySelector('.nav-links');
  if(desktop&&!desktop.querySelector('a[href="freelance.html"]')){
    const link=document.createElement('a');link.href='freelance.html';link.textContent='Freelance / Gig';
    const before=desktop.querySelector('a[href="contribute.html"]');desktop.insertBefore(link,before||desktop.lastElementChild);
  }

  const mobile=document.querySelector('#mobileMenu > div');
  if(mobile&&!mobile.querySelector('a[href="freelance.html"]')){
    const link=document.createElement('a');link.href='freelance.html';link.textContent='Freelance / Gig';
    const before=mobile.querySelector('a[href="contribute.html"]');mobile.insertBefore(link,before||null);
  }

  const footer=document.querySelector('.footer-links');
  if(footer&&!footer.querySelector('a[href="freelance.html"]')){
    const link=document.createElement('a');link.href='freelance.html';link.textContent='Freelance / Gig';footer.appendChild(link);
  }
};
document.body.appendChild(core);

async function addHomepageServiceBrowse(){
  const serviceInput=document.getElementById('homeService');
  if(!serviceInput||document.getElementById('homeBrowseService'))return;

  const serviceField=serviceInput.closest('.finder-field');
  if(!serviceField)return;

  const browseField=document.createElement('div');
  browseField.className='finder-field';
  browseField.innerHTML='<label for="homeBrowseService">Atau Browse Servis</label><select id="homeBrowseService" aria-label="Browse servis"><option value="">Memuatkan servis…</option></select>';
  serviceField.insertAdjacentElement('afterend',browseField);

  const select=browseField.querySelector('select');
  Object.assign(select.style,{width:'100%',border:'0',outline:'0',background:'transparent',font:'inherit',fontSize:'13px',fontWeight:'700',color:'#293b5a',padding:'5px 0',cursor:'pointer'});

  try{
    const {db}=await import('./gig-config.js?v=2');
    const [{data:categories,error:categoryError},{data:services,error:serviceError}]=await Promise.all([
      db.from('gig_categories').select('id,name,slug,sort_order').eq('active',true).order('sort_order').order('name'),
      db.from('gig_services').select('id,category_id,name,slug,sort_order').eq('active',true).order('sort_order').order('name')
    ]);
    if(categoryError||serviceError)throw categoryError||serviceError;

    select.innerHTML='<option value="">Pilih servis untuk browse</option>';
    for(const category of categories||[]){
      const items=(services||[]).filter(service=>service.category_id===category.id&&service.slug!=='servis-lain-lain');
      if(!items.length)continue;
      const group=document.createElement('optgroup');
      group.label=category.name;
      for(const service of items){
        const option=document.createElement('option');
        option.value=service.name;
        option.textContent=service.name;
        group.appendChild(option);
      }
      select.appendChild(group);
    }

    select.addEventListener('change',()=>{
      if(!select.value)return;
      serviceInput.value=select.value;
      serviceInput.dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('homePostcode')?.focus();
    });
  }catch(error){
    select.innerHTML='<option value="">Browse servis tidak tersedia</option>';
    select.disabled=true;
  }
}

addHomepageServiceBrowse();

// Progressive Web App support.
(function enableRapatPWA(){
  if(!document.querySelector('link[rel="manifest"]')){
    const manifest=document.createElement('link');
    manifest.rel='manifest';
    manifest.href='/manifest.webmanifest';
    document.head.appendChild(manifest);
  }

  const metaTags=[
    ['apple-mobile-web-app-capable','yes'],
    ['apple-mobile-web-app-status-bar-style','default'],
    ['apple-mobile-web-app-title','RAPAT']
  ];
  for(const [name,content] of metaTags){
    if(!document.querySelector(`meta[name="${name}"]`)){
      const meta=document.createElement('meta');
      meta.name=name;
      meta.content=content;
      document.head.appendChild(meta);
    }
  }

  if(!document.querySelector('link[rel="apple-touch-icon"]')){
    const icon=document.createElement('link');
    icon.rel='apple-touch-icon';
    icon.href='/favicon.svg';
    document.head.appendChild(icon);
  }

  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('/service-worker.js').catch(error=>console.warn('RAPAT PWA service worker:',error));
    });
  }
})();