(function(){
  const consent=document.getElementById('consent');
  if(!consent)return;
  const field=consent.closest('.field');
  if(!field)return;

  field.innerHTML=`
    <div class="rapat-consent-card">
      <label class="rapat-consent-label">
        <input id="consent" type="checkbox" style="width:auto;margin-top:3px">
        <span>
          <b>I agree to the use of my data for employability support.</b><br>
          My registration details and employability assessment data may be used by RAPAT, the event organizer, and relevant Malaysian government agencies involved in employment or employability support for intervention planning, programme or job matching, monitoring and outcome reporting, as described in the <a href="pdpa.html" target="_blank" rel="noopener">RAPAT Privacy &amp; PDPA Notice</a>.
        </span>
      </label>
      <div class="rapat-consent-note">Only data relevant to these purposes should be used or shared. Internal HR notes remain restricted to authorized employer and organizer users.</div>
    </div>`;

  const style=document.createElement('style');
  style.textContent=`
    .rapat-consent-card{margin-top:16px;padding:15px;border:1px solid #dce3ed;border-radius:12px;background:#f8fafc}
    .rapat-consent-label{display:flex!important;gap:10px;align-items:flex-start;font-size:12px!important;line-height:1.55;color:#334155!important;cursor:pointer}
    .rapat-consent-label span{font-weight:400}.rapat-consent-label b{font-weight:800;color:#172033}
    .rapat-consent-note{margin:9px 0 0 25px;font-size:11px;line-height:1.45;color:#718096}
  `;
  document.head.appendChild(style);
})();
