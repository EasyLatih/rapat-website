function ensureEmployerReportModal(){
  if(document.getElementById('employerReportModal')) return;
  const m=document.createElement('div');
  m.id='employerReportModal';
  m.className='modal hidden';
  m.innerHTML=`<div class="modalbox" style="max-width:1250px">
    <button class="close" onclick="closeEmployerReport()">✕</button>
    <div class="eyebrow">Employer Report</div>
    <h2>Interview Evaluation Data</h2>
    <p class="muted">Quick view of your candidates and completed assessments.</p>
    <div style="overflow:auto;max-height:68vh">
      <table class="quick-report-table">
        <thead><tr><th>Candidate</th><th>Vacancy</th><th>Status</th><th>Comm.</th><th>Career</th><th>Exp.</th><th>Technical</th><th>Professional</th><th>Outcome</th><th>Primary Gap</th><th>Remarks</th><th>Internal Note</th></tr></thead>
        <tbody id="employerReportBody"></tbody>
      </table>
    </div>
  </div>`;
  document.body.appendChild(m);
  if(!document.getElementById('employerReportStyles')){
    const s=document.createElement('style');
    s.id='employerReportStyles';
    s.textContent='.quick-report-table{width:100%;border-collapse:collapse;font-size:12px}.quick-report-table th,.quick-report-table td{padding:9px;border-bottom:1px solid #e7ebf1;text-align:left;white-space:nowrap;vertical-align:top}.quick-report-table th{position:sticky;top:0;background:#fff;z-index:1}.quick-report-table .wraptext{white-space:normal;min-width:180px;max-width:280px}';
    document.head.appendChild(s);
  }
}

window.viewEmployerReport=async function(){
  try{
    const j=await api({action:'employer_report',sessionToken});
    ensureEmployerReportModal();
    const rows=(j.rows||[]).filter(r=>r.status!=='withdrawn');
    const body=document.getElementById('employerReportBody');
    body.innerHTML=rows.length?rows.map(r=>{
      const e=typeof evaluationOf==='function'?evaluationOf(r):(Array.isArray(r.evaluations)?(r.evaluations[0]||{}):(r.evaluations||{}));
      return `<tr>
        <td>${esc(r.candidates?.full_name||'')}</td>
        <td>${esc(r.vacancies?.title||'')}</td>
        <td>${esc(nice(r.status||''))}</td>
        <td>${e.communication??'-'}</td>
        <td>${e.career_role??'-'}</td>
        <td>${e.experience??'-'}</td>
        <td>${e.technical??'-'}</td>
        <td>${e.professionalism??'-'}</td>
        <td>${esc(nice(e.outcome||'-'))}</td>
        <td>${esc(nice(e.primary_gap||'-'))}</td>
        <td class="wraptext">${esc(e.remarks||'-')}</td>
        <td class="wraptext">${esc(e.internal_note||'-')}</td>
      </tr>`;
    }).join(''):'<tr><td colspan="12">No interview data yet.</td></tr>';
    document.getElementById('employerReportModal').classList.remove('hidden');
  }catch(e){alert(e.message)}
};
window.closeEmployerReport=function(){document.getElementById('employerReportModal')?.classList.add('hidden')};

(function(){
  const tabs=document.querySelector('#employer .tabs');
  if(tabs&&!document.getElementById('viewEmployerReportBtn')){
    const download=[...tabs.querySelectorAll('button')].find(b=>b.textContent.trim()==='Download Report');
    const b=document.createElement('button');
    b.id='viewEmployerReportBtn';
    b.className='tab';
    b.textContent='View Report';
    b.onclick=viewEmployerReport;
    tabs.insertBefore(b,download||null);
  }
})();