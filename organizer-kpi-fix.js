(function(){
  const base=window.loadOrgDashboard;
  if(typeof base!=='function')return;
  window.loadOrgDashboard=async function(){
    await base.apply(this,arguments);
    try{
      const report=await orgReport();
      const active=(report.rows||[]).filter(r=>r.status!=='withdrawn').length;
      const completed=(report.rows||[]).filter(r=>r.status==='completed').length;
      document.querySelectorAll('#stats .stat').forEach(card=>{
        const label=card.querySelector('span')?.textContent?.trim();
        if(label==='Interviews')card.querySelector('b').textContent=String(active);
        if(label==='Completed')card.querySelector('b').textContent=String(completed);
      });
    }catch(e){console.warn('Unable to refresh interview KPI',e)}
  };
})();