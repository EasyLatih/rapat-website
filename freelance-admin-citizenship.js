(function(){
  let installed=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const label=s=>({malaysian:'Warganegara Malaysia',non_malaysian:'Bukan Warganegara',pending:'Belum Disahkan'})[s]||'Belum Disahkan';
  const badge=s=>s==='malaysian'?'ok':s==='pending'?'wait':'';

  function install(){
    if(installed||typeof window.renderGigDashboard!=='function'||typeof window.renderGigProviders!=='function')return false;
    installed=true;

    const baseDashboard=window.renderGigDashboard;
    window.renderGigDashboard=function(rows,dash,reports){
      baseDashboard(rows,dash,reports);
      const s=dash?.stats||{};
      const values={
        malaysian:s.malaysian??rows.filter(x=>x.citizenship_status==='malaysian').length,
        nonMalaysian:s.nonMalaysian??rows.filter(x=>x.citizenship_status==='non_malaysian').length,
        citizenshipPending:s.citizenshipPending??rows.filter(x=>(x.citizenship_status||'pending')==='pending').length
      };
      const host=document.getElementById('gigStats');
      if(host&&!host.querySelector('[data-citizenship-kpi]')){
        const cards=[
          ['🇲🇾','Warganegara Malaysia',values.malaysian,'Telah disahkan'],
          ['⚠','Bukan Warganegara',values.nonMalaysian,'Tidak layak sebagai provider'],
          ['?','Belum Disahkan',values.citizenshipPending,'Perlu pengesahan']
        ];
        cards.forEach((x,i)=>{
          const div=document.createElement('div');
          div.className=`admin-stat gig-kpi gig-kpi-${6+i}`;
          div.dataset.citizenshipKpi='1';
          div.innerHTML=`<div class="gig-kpi-top"><span class="gig-kpi-icon">${x[0]}</span><span>${esc(x[1])}</span></div><b>${x[2]}</b><small>${esc(x[3])}</small>`;
          host.appendChild(div);
        });
      }
      const ops=document.getElementById('gigOpsMeta');
      if(ops&&!ops.textContent.includes('belum sah warganegara')) ops.textContent+=` · ${values.citizenshipPending} belum sah warganegara`;
    };

    const baseProviders=window.renderGigProviders;
    window.renderGigProviders=function(rows){
      baseProviders(rows);
      const host=document.getElementById('gigProviders');
      const table=host?.querySelector('table');
      if(!table||table.querySelector('th[data-citizenship]'))return;
      const head=table.querySelector('thead tr');
      const th=document.createElement('th');th.dataset.citizenship='1';th.textContent='Warganegara';
      const statusHead=head?.children[3];statusHead?head.insertBefore(th,statusHead):head?.appendChild(th);
      [...table.querySelectorAll('tbody tr')].forEach((tr,i)=>{
        const p=rows[i]||{};
        const td=document.createElement('td');
        td.dataset.citizenship='1';
        td.innerHTML=`<span class="badge ${badge(p.citizenship_status)}">${esc(label(p.citizenship_status||'pending'))}</span>${p.citizenship_confirmed_at?'<div class="muted2">Disahkan</div>':'<div class="muted2">Menunggu pengesahan</div>'}`;
        const statusCell=tr.children[3];statusCell?tr.insertBefore(td,statusCell):tr.appendChild(td);
      });
    };

    const baseReports=window.renderGigReports;
    window.renderGigReports=function(rows){
      baseReports(rows);
      const host=document.getElementById('gigReports');
      const cards=[...(host?.querySelectorAll('.journey-card')||[])];
      rows.forEach((r,i)=>{
        const card=cards[i],p=Array.isArray(r.gig_providers)?r.gig_providers[0]:r.gig_providers;
        if(!card||card.querySelector('[data-provider-citizenship]'))return;
        const line=document.createElement('div');
        line.dataset.providerCitizenship='1';
        line.className='muted2';
        line.style.margin='5px 0 10px';
        line.innerHTML=`Status warganegara provider: <b>${esc(label(p?.citizenship_status||'pending'))}</b>`;
        const reason=[...card.querySelectorAll('p')].find(x=>x.textContent.trim().startsWith('Reason:'));
        reason?reason.before(line):card.appendChild(line);
      });
    };

    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
  }
})();