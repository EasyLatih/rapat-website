(function(){
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function mount(){
    const groups=document.getElementById('serviceGroups');
    if(!groups||document.getElementById('providerServiceSearch'))return false;

    const wrap=document.createElement('div');
    wrap.className='provider-service-search-wrap';
    wrap.innerHTML=`<div class="provider-service-search-box"><span aria-hidden="true">⌕</span><input id="providerServiceSearch" type="search" autocomplete="off" placeholder="Cari servis... contoh: aircond, tutor, catering"><button id="providerServiceSearchClear" type="button" aria-label="Padam carian" title="Padam carian">×</button></div><div id="providerServiceSearchMeta" class="provider-service-search-meta">Taip nama servis untuk cari dengan cepat.</div>`;
    groups.parentNode.insertBefore(wrap,groups);

    const style=document.createElement('style');
    style.textContent=`
      .provider-service-search-wrap{margin:0 0 14px}.provider-service-search-box{display:flex;align-items:center;gap:9px;border:1px solid #dbe3ee;background:#fff;border-radius:12px;padding:0 11px;box-shadow:0 4px 14px rgba(11,29,66,.04)}.provider-service-search-box:focus-within{border-color:#0f5cc8;box-shadow:0 0 0 3px rgba(15,92,200,.09)}.provider-service-search-box>span{font-size:20px;color:#728096;line-height:1}.provider-service-search-box input{flex:1;min-width:0;border:0!important;outline:0!important;box-shadow:none!important;padding:12px 0!important;background:transparent!important;font:inherit}.provider-service-search-box button{border:0;background:transparent;color:#8491a3;font-size:22px;cursor:pointer;padding:3px 5px;display:none}.provider-service-search-box.has-query button{display:block}.provider-service-search-meta{font-size:11px;color:#748399;margin-top:6px}.service-search-empty{border:1px dashed #ccd6e3;border-radius:12px;padding:18px;text-align:center;color:#718096;background:#fafcff;margin-top:8px}.provider-channel-after-save{margin-top:10px}.provider-channel-after-save a{display:inline-block;margin-top:8px;font-weight:800;text-decoration:none}
    `;
    document.head.appendChild(style);

    const input=document.getElementById('providerServiceSearch');
    const clear=document.getElementById('providerServiceSearchClear');
    const meta=document.getElementById('providerServiceSearchMeta');
    let empty=null;

    function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
    function apply(){
      const q=norm(input.value);
      wrap.querySelector('.provider-service-search-box').classList.toggle('has-query',Boolean(q));
      const groupEls=[...groups.querySelectorAll('.service-group')];
      let visibleServices=0,totalServices=0,visibleGroups=0;
      groupEls.forEach(group=>{
        const heading=group.querySelector('h4');
        const category=norm(heading?.textContent);
        const labels=[...group.querySelectorAll('label.check')];
        totalServices+=labels.length;
        const categoryMatch=q&&category.includes(q);
        let groupVisible=0;
        labels.forEach(label=>{
          const name=norm(label.textContent);
          const show=!q||categoryMatch||name.includes(q);
          label.style.display=show?'':'none';
          if(show){groupVisible++;visibleServices++;}
        });
        const showGroup=!q||groupVisible>0;
        group.style.display=showGroup?'':'none';
        if(showGroup)visibleGroups++;
      });
      if(empty){empty.remove();empty=null;}
      if(q&&visibleServices===0){
        empty=document.createElement('div');empty.className='service-search-empty';empty.innerHTML=`Tak jumpa servis “<b>${esc(input.value.trim())}</b>”. Cuba perkataan lain atau pilih <b>Lain-lain</b>.`;
        groups.after(empty);
      }
      meta.textContent=q?`${visibleServices} servis dijumpai dalam ${visibleGroups} kategori.`:`${totalServices} servis tersedia. Taip untuk cari dengan cepat.`;
    }

    input.addEventListener('input',apply);
    clear.addEventListener('click',()=>{input.value='';apply();input.focus();});
    new MutationObserver(apply).observe(groups,{childList:true,subtree:true});
    apply();
    return true;
  }

  function mountSuccessChannel(){
    const saveMsg=document.getElementById('saveMsg');
    if(!saveMsg)return false;
    const addChannel=()=>{
      const notice=saveMsg.querySelector('.notice');
      if(!notice||!notice.textContent.includes('Pendaftaran dihantar')||notice.querySelector('.provider-channel-after-save'))return;
      const box=document.createElement('div');
      box.className='provider-channel-after-save';
      box.innerHTML='📢 Jangan terlepas makluman penting RAPAT.<br><a href="https://whatsapp.com/channel/0029Vb9PjziIXnljC6kVrc04" target="_blank" rel="noopener">Sertai WhatsApp Channel Rasmi RAPAT →</a>';
      notice.appendChild(box);
    };
    new MutationObserver(addChannel).observe(saveMsg,{childList:true,subtree:true});
    addChannel();
    return true;
  }

  if(!mount()){
    const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('DOMContentLoaded',mount,{once:true});
  }
  if(!mountSuccessChannel())window.addEventListener('DOMContentLoaded',mountSuccessChannel,{once:true});
})();