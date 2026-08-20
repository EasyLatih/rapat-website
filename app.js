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

// Progressive Web App support + install experience.
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

  if(!document.getElementById('rapatPwaStyles')){
    const style=document.createElement('style');
    style.id='rapatPwaStyles';
    style.textContent=`
      #rapatInstallBtn{background:#fff4d8;color:#06245f;border:1.5px solid #f6b917;cursor:pointer}
      #rapatInstallBtn:hover{background:#ffe9a8}
      #rapatInstallBtn:disabled{opacity:.65;cursor:wait}
      .rapat-install-icon{font-size:16px;margin-right:6px}
      .rapat-pwa-modal{position:fixed;inset:0;background:rgba(4,18,48,.62);display:grid;place-items:end center;z-index:99999;padding:18px}
      .rapat-pwa-panel{width:min(100%,520px);background:#fff;border-radius:22px 22px 16px 16px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);color:#23344f}
      .rapat-pwa-panel h3{margin:0 38px 8px 0;color:#06245f;font-size:21px;line-height:1.2}
      .rapat-pwa-panel p{margin:0 0 16px;color:#627087;font-size:13px;line-height:1.6}
      .rapat-pwa-steps{display:grid;gap:10px;margin:0 0 18px}
      .rapat-pwa-step{display:flex;gap:11px;align-items:flex-start;background:#f7f9fc;border:1px solid #e5eaf1;border-radius:13px;padding:11px 12px;font-size:13px;line-height:1.45}
      .rapat-pwa-step b{width:25px;height:25px;border-radius:50%;background:#06245f;color:#fff;display:grid;place-items:center;flex:0 0 auto;font-size:11px}
      .rapat-pwa-close{position:absolute;right:19px;top:16px;border:0;background:#eef2f7;color:#06245f;width:34px;height:34px;border-radius:50%;font-size:21px;cursor:pointer}
      .rapat-pwa-panel-wrap{position:relative}
      .rapat-pwa-ok{width:100%;border:0;border-radius:12px;background:#06245f;color:#fff;padding:13px 16px;font:inherit;font-weight:800;cursor:pointer}
      @media(min-width:700px){.rapat-pwa-modal{place-items:center}.rapat-pwa-panel{border-radius:22px}}
    `;
    document.head.appendChild(style);
  }

  let deferredPrompt=null;
  const ua=navigator.userAgent||'';
  const isAndroid=/Android/i.test(ua);
  const isIOS=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;

  function removeInstallUI(){
    document.getElementById('rapatInstallBtn')?.remove();
    document.getElementById('rapatPwaModal')?.remove();
  }

  function showInstallGuide(platform){
    document.getElementById('rapatPwaModal')?.remove();
    const isApple=platform==='ios';
    const modal=document.createElement('div');
    modal.id='rapatPwaModal';
    modal.className='rapat-pwa-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Cara pasang RAPAT');

    const steps=isApple?[
      'Buka <strong>rapat.my</strong> menggunakan Safari.',
      'Tekan ikon <strong>Share</strong> (kotak dengan anak panah ke atas).',
      'Pilih <strong>Add to Home Screen</strong>.',
      'Tekan <strong>Add</strong>. Ikon RAPAT akan muncul di skrin utama.'
    ]:[
      'Buka <strong>rapat.my</strong> menggunakan Chrome.',
      'Tekan menu <strong>⋮</strong> di penjuru kanan atas.',
      'Pilih <strong>Add to Home screen</strong> atau <strong>Install app</strong> jika dipaparkan.',
      'Sahkan pemasangan. Ikon RAPAT akan muncul di skrin utama.'
    ];

    modal.innerHTML=`<div class="rapat-pwa-panel"><div class="rapat-pwa-panel-wrap"><button class="rapat-pwa-close" type="button" aria-label="Tutup">×</button><h3>${isApple?'Pasang RAPAT di iPhone':'Pasang RAPAT di Android'}</h3><p>${isApple?'iPhone menggunakan fungsi Add to Home Screen dalam Safari.':'Jika prompt pemasangan automatik tidak muncul, gunakan langkah ini.'}</p><div class="rapat-pwa-steps">${steps.map((step,index)=>`<div class="rapat-pwa-step"><b>${index+1}</b><span>${step}</span></div>`).join('')}</div><button class="rapat-pwa-ok" type="button">Faham</button></div></div>`;

    const close=()=>modal.remove();
    modal.querySelector('.rapat-pwa-close').addEventListener('click',close);
    modal.querySelector('.rapat-pwa-ok').addEventListener('click',close);
    modal.addEventListener('click',event=>{if(event.target===modal)close()});
    document.addEventListener('keydown',function esc(event){if(event.key==='Escape'){close();document.removeEventListener('keydown',esc)}});
    document.body.appendChild(modal);
  }

  function ensureInstallButton(){
    if(isStandalone()||(!isAndroid&&!isIOS)||document.getElementById('rapatInstallBtn'))return;
    const actions=document.querySelector('.home-actions');
    if(!actions)return;

    const button=document.createElement('button');
    button.id='rapatInstallBtn';
    button.type='button';
    button.className='btn';
    button.innerHTML='<span class="rapat-install-icon" aria-hidden="true">↓</span>Pasang RAPAT';
    button.addEventListener('click',async()=>{
      if(isAndroid&&deferredPrompt){
        const original=button.innerHTML;
        button.disabled=true;
        button.textContent='Membuka pemasangan…';
        try{
          await deferredPrompt.prompt();
          const choice=await deferredPrompt.userChoice;
          deferredPrompt=null;
          if(choice.outcome==='accepted'){
            removeInstallUI();
            return;
          }
          button.disabled=false;
          button.innerHTML=original;
        }catch(error){
          deferredPrompt=null;
          button.disabled=false;
          button.innerHTML=original;
          showInstallGuide('android');
        }
        return;
      }
      showInstallGuide(isIOS?'ios':'android');
    });
    actions.appendChild(button);
  }

  if(!isStandalone()&&(isAndroid||isIOS))ensureInstallButton();

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    ensureInstallButton();
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    removeInstallUI();
  });

  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('/service-worker.js').catch(error=>console.warn('RAPAT PWA service worker:',error));
    });
  }
})();