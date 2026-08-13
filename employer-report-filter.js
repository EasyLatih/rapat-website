(function(){
  const oldDownload=window.downloadReport;
  window.downloadReport=async function(){
    const j=await api({action:'employer_report',sessionToken});
    j.rows=(j.rows||[]).filter(r=>r.status!=='withdrawn');
    if(!j.rows.length){alert('No active interview data yet.');return;}
    const rows=[['Candidate','Vacancy','Status','Communication','Career & Role','Experience','Technical','Professionalism','Outcome','Primary Gap','Remarks','Internal Note']];
    j.rows.forEach(r=>{const e=typeof evaluationOf==='function'?evaluationOf(r):(r.evaluations||{});rows.push([r.candidates?.full_name||'',r.vacancies?.title||'',r.status||'',e.communication??'',e.career_role??'',e.experience??'',e.technical??'',e.professionalism??'',e.outcome||'',e.primary_gap||'',e.remarks||'',e.internal_note||''])});
    const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    const csv='\uFEFF'+rows.map(r=>r.map(q).join(',')).join('\r\n');
    const b=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`rapat-${slug}-employer-report.csv`;a.click();URL.revokeObjectURL(u);
  };
})();