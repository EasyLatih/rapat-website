const API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-api';
const BRANDING_API='https://afyqxqvflchgwbtmoogd.supabase.co/functions/v1/rapat-branding';
let slug=new URLSearchParams(location.search).get('event')||'pilot-15-aug-2026';
let eventData=null,role=null,currentApp=null,scoreState={},allStates=[];
let sessionToken=localStorage.getItem(`rapatSession:${slug}`)||'';
let candidateToken=localStorage.getItem(`rapatCandidate:${slug}`)||'';
const $=id=>document.getElementById(id);
const sections=['loading','setup','landing','candidate','login','employer','organizer'];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const nice=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
function show(id){sections.forEach(x=>$(x).classList.toggle('hidden',x!==id));scrollTo(0,0)}
function msg(id,text,good=false){$(id).innerHTML=text?`<div class="alert ${good?'success':''}">${esc(text)}</div>`:''}
async function api(data){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});let j={};try{j=await r.json()}catch{}if(!r.ok||!j.ok)throw new Error(j.error||'Request failed');return j}
function validEmail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(s||'').trim())}

async function init(){
  try{
    const j=await api({action:'public_event',slug});eventData=j.event;renderLanding(j);await prepareLocationFields();
    if(sessionToken){try{const h=await api({action:'session_home',sessionToken});if(h.role==='organizer')return openOrganizer();if(h.role==='employer')return openEmployer()}catch{clearSession()}}
    show('landing');
  }catch(e){
    if(e.message==='Event not found'){show('setup');await prepareSetupStates()}
    else $('loading').innerHTML=`<div class="alert">${esc(e.message)}</div>`;
  }
}
function renderLanding(j){
  eventData=j.event;$('eventName').textContent=j.event.name;
  $('eventDate').textContent=j.event.event_date?'📅 '+formatDate(j.event.event_date):'📅 Date TBC';
  $('eventVenue').textContent=j.event.venue?'📍 '+j.event.venue:'📍 Venue TBC';
  $('eventStatePill').textContent=j.event.event_state?'🗺️ '+j.event.event_state:'🗺️ State TBC';
  $('publicStats').textContent=`${j.stats.employers} employers · ${j.stats.vacancies} vacancies · ${j.stats.candidates} registered`;
  if(j.event.collaborator_logo_url){$('collabWrap').classList.remove('hidden');$('collabLogo').src=j.event.collaborator_logo_url}else $('collabWrap').classList.add('hidden');
  if(j.event.banner_url){$('eventBanner').src=j.event.banner_url;$('eventBanner').classList.remove('hidden')}else $('eventBanner').classList.add('hidden');
}
async function refreshPublic(){const j=await api({action:'public_event',slug});renderLanding(j);return j}
function formatDate(d){try{return new Date(d+'T00:00:00').toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})}catch{return d}}

async function getLocations(state=''){return api({action:'locations',state})}
function orderedStates(states,eventState){const clean=[...new Set(states)];if(eventState&&clean.includes(eventState))return [eventState,...clean.filter(s=>s!==eventState)];return clean}
async function prepareLocationFields(){
  const j=await getLocations();allStates=orderedStates(j.states||[],eventData?.event_state);
  $('cState').innerHTML=allStates.map(s=>`<option value="${esc(s)}">${esc(s)}${s===eventData?.event_state?' — Event State':''}</option>`).join('');
  if(eventData?.event_state)$('cState').value=eventData.event_state;
  await loadDuns();
  if(eventData?.event_state)$('stateNote').textContent=`${eventData.event_state} is preselected because this event is held in ${eventData.event_state}. Change it only if you are from another state.`;
}
async function loadDuns(){
  const state=$('cState').value;$('cDun').disabled=true;$('cDun').innerHTML='<option>Loading DUN…</option>';
  try{const j=await getLocations(state);$('cDun').innerHTML='<option value="">Select DUN</option>'+j.duns.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');$('cDun').disabled=false}catch(e){$('cDun').innerHTML='<option value="">Unable to load DUN</option>';msg('candMsg',e.message)}
}
async function prepareSetupStates(){
  try{const j=await getLocations();allStates=j.states||[];$('setupState').innerHTML='<option value="">Select state</option>'+allStates.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');$('setupState').value='Pahang'}catch(e){msg('setupMsg',e.message)}
}

async function bootstrap(){
  try{msg('setupMsg','');const rel=$('setupRelease').value?new Date($('setupRelease').value).toISOString():null;
    const j=await api({action:'bootstrap',setupKey:$('setupKey').value,eventName:$('setupName').value,slug:$('setupSlug').value,eventDate:$('setupDate').value,venue:$('setupVenue').value,eventState:$('setupState').value,resultReleaseAt:rel,organizerName:'RAPAT Organizer',pin:$('setupPin').value});
    slug=j.event.slug;location.href='events.html?event='+encodeURIComponent(slug);
  }catch(e){msg('setupMsg',e.message)}
}
function goLanding(){show('landing');refreshPublic().catch(()=>{})}
function openCandidate(){show('candidate');if(candidateToken)loadCandidate();else{$('candidateRegister').classList.remove('hidden');$('candidateHome').classList.add('hidden')}}
async function registerCandidate(){
  if(!$('consent').checked)return msg('candMsg','Please provide consent to continue.');
  const email=$('cEmail').value.trim();if(!validEmail(email))return msg('candMsg','Please enter a valid email address, for example nama@gmail.com.');
  if(!$('cState').value||!$('cDun').value)return msg('candMsg','Please select your state and DUN.');
  try{
    const j=await api({action:'candidate_register',slug,fullName:$('cName').value,ic:$('cIc').value,phone:$('cPhone').value,email,state:$('cState').value,dun:$('cDun').value});
    candidateToken=j.candidate.access_token;localStorage.setItem(`rapatCandidate:${slug}`,candidateToken);msg('candMsg','Registration successful.',true);await loadCandidate();
  }catch(e){msg('candMsg',e.message)}
}
async function loadCandidate(){
  try{
    $('candidateRegister').classList.add('hidden');$('candidateHome').classList.remove('hidden');
    const [v,h]=await Promise.all([api({action:'vacancies',slug}),api({action:'candidate_home',candidateToken})]);
    $('candTitle').textContent='Hi, '+h.candidate.full_name;
    $('candLocation').textContent=[h.candidate.state,h.candidate.dun].filter(Boolean).join(' · ');
    const applied=new Set(h.applications.map(x=>x.vacancy_id));
    $('vacancyList').innerHTML=v.vacancies.length?v.vacancies.map(x=>`<div class="row"><div><h4>${esc(x.title)}</h4><small>${esc(x.employers.name)}${x.employers.booth?' · Booth '+esc(x.employers.booth):''}</small><div class="reqs">${(x.requirements||[]).map(r=>`<span class="req">${esc(r)}</span>`).join('')}</div></div><button class="btn ${applied.has(x.id)?'light':'primary'} small" ${applied.has(x.id)?'disabled':''} onclick="applyJob('${x.id}')">${applied.has(x.id)?'Selected ✓':'I Want to Interview'}</button></div>`).join(''):'<div class="empty">No vacancies published yet.</div>';
    $('appList').innerHTML=h.applications.length?h.applications.map(a=>`<div class="row"><div><h4>${esc(a.vacancies.title)}</h4><small>${esc(a.vacancies.employers.name)}${a.vacancies.employers.booth?' · Booth '+esc(a.vacancies.employers.booth):''}</small></div><span class="badge ${a.status==='completed'?'ok':'wait'}">${a.status==='completed'?'Completed ✓':'Waiting'}</span></div>`).join(''):'<div class="empty">Select a vacancy above to add it to My Interviews.</div>';
    renderResult(h);
  }catch(e){msg('candHomeMsg',e.message)}
}
async function applyJob(id){try{await api({action:'candidate_apply',candidateToken,vacancyId:id});await loadCandidate()}catch(e){msg('candHomeMsg',e.message)}}
function renderResult(h){
  const block=$('resultBlock'),evals=h.applications.flatMap(a=>a.evaluations||[]);
  if(!h.released){block.innerHTML=`<div class="panel"><h3>Interview Feedback</h3><p class="muted">Your rating will be released after <b>${h.event.result_release_at?new Date(h.event.result_release_at).toLocaleString('en-MY'):'the event'}</b>.</p></div>`;return}
  if(!evals.length){block.innerHTML='<div class="panel"><h3>Your Employability Profile</h3><p class="muted">Complete at least one evaluated interview to generate your profile.</p></div>';return}
  const keys=['communication','career_role','experience','technical','professionalism'],labels=['Communication','Career & Role','Experience','Technical','Professionalism'];
  const av=keys.map(k=>evals.reduce((s,e)=>s+Number(e[k]||0),0)/evals.length),overall=av.reduce((a,b)=>a+b,0)/av.length,min=Math.min(...av),max=Math.max(...av),gapIndex=av.indexOf(min),strIndex=av.indexOf(max);
  block.innerHTML=`<div class="panel"><div class="eyebrow">Your RAPAT Employability Profile</div><h2>Overall Readiness ${overall.toFixed(1)} / 5</h2><div class="radarwrap"><canvas id="radar" class="radar" width="300" height="300"></canvas><div><p><b>Strength:</b> ${labels[strIndex]} — ${max.toFixed(1)}/5</p><p><b>Priority Gap:</b> ${labels[gapIndex]} — ${min.toFixed(1)}/5</p><div class="intervention"><b>Recommended Next Step</b><p class="muted">${intervention(keys[gapIndex])}</p></div><p class="mini muted">Profile is aggregated from ${evals.length} completed interview evaluation(s).</p></div></div></div>`;
  setTimeout(()=>drawRadar(av,['Communication','Career','Experience','Technical','Professional']),30);
}
function intervention(k){return({communication:'Interview Communication, STAR Technique and Mock Interview',career_role:'Career Clarity, Job Research and Interview Preparation',experience:'Internship, Apprenticeship or Project-Based Work Exposure',technical:'Role-specific technical upskilling or certification',professionalism:'Workplace Readiness and Professional Etiquette'})[k]||'Targeted follow-up intervention'}
function drawRadar(vals,labels){const c=$('radar');if(!c)return;const x=c.getContext('2d'),cx=150,cy=150,R=103,n=5;x.clearRect(0,0,300,300);x.strokeStyle='#dce4ef';x.fillStyle='#607089';x.font='10px Inter';for(let l=1;l<=5;l++){x.beginPath();for(let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n,r=R*l/5,px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.stroke()}for(let i=0;i<n;i++){const a=-Math.PI/2+i*2*Math.PI/n;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);x.stroke();const tx=cx+Math.cos(a)*(R+23),ty=cy+Math.sin(a)*(R+23);x.textAlign=tx<cx-5?'right':tx>cx+5?'left':'center';x.fillText(labels[i],tx,ty)}x.beginPath();vals.forEach((v,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,r=R*v/5,px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py)});x.closePath();x.fillStyle='rgba(36,88,220,.18)';x.fill();x.strokeStyle='#2458dc';x.lineWidth=2;x.stroke()}

function showLogin(r){role=r;$('loginRole').textContent=r==='organizer'?'Organizer Login':'Employer Login';$('loginPin').value='';msg('loginMsg','');show('login')}
async function login(){try{const j=await api({action:'login',slug,role,pin:$('loginPin').value});sessionToken=j.session.token;localStorage.setItem(`rapatSession:${slug}`,sessionToken);role==='organizer'?openOrganizer():openEmployer()}catch(e){msg('loginMsg',e.message)}}
function clearSession(){localStorage.removeItem(`rapatSession:${slug}`);sessionToken='';role=null}
function logout(){clearSession();show('landing')}

async function openEmployer(){
  try{const h=await api({action:'session_home',sessionToken});if(h.role!=='employer')throw Error('Employer access required');role='employer';$('empName').textContent=h.employer.name;$('empMeta').textContent=(h.employer.booth?'Booth '+h.employer.booth+' · ':'')+h.event.name;renderEmployerVacancies(h.vacancies);show('employer');await loadEmployerApps()}catch(e){clearSession();showLogin('employer')}
}
function renderEmployerVacancies(vs){$('empVacList').innerHTML=vs.length?vs.map(v=>`<div class="row"><div><h4>${esc(v.title)}</h4><small>${v.openings} opening(s)</small><div class="reqs">${(v.requirements||[]).map(r=>`<span class="req">${esc(r)}</span>`).join('')}</div></div></div>`).join(''):'<div class="empty">No vacancies yet.</div>'}
function empTab(t,b){document.querySelectorAll('#employer .tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('empApplications').classList.toggle('hidden',t!=='applications');$('empVacancies').classList.toggle('hidden',t!=='vacancies');if(t==='applications')loadEmployerApps()}
async function loadEmployerApps(){try{const j=await api({action:'employer_applications',sessionToken});$('empAppList').innerHTML=j.applications.length?j.applications.map(a=>`<div class="row"><div><h4>${esc(a.candidates.full_name)}</h4><small>${esc(a.vacancies.title)} · ${esc(a.candidates.state||'')} ${a.candidates.dun?'· '+esc(a.candidates.dun):''}</small></div>${a.status==='completed'?'<span class="badge ok">Completed ✓</span>':`<button class="btn primary small" onclick='openEval(${JSON.stringify(JSON.stringify(a))})'>Evaluate</button>`}</div>`).join(''):'<div class="empty">No candidates have selected your vacancies yet.</div>'}catch(e){$('empAppList').innerHTML=`<div class="alert">${esc(e.message)}</div>`}}
async function saveEmployerVacancy(){try{await api({action:'save_vacancy',sessionToken,title:$('evTitle').value,openings:$('evOpen').value,requirements:$('evReq').value.split(',')});msg('evMsg','Vacancy added.',true);$('evTitle').value='';$('evReq').value='';const h=await api({action:'session_home',sessionToken});renderEmployerVacancies(h.vacancies)}catch(e){msg('evMsg',e.message)}}

const criteria=[
  {k:'communication',name:'Communication Readiness',guide:['1 — Difficult to understand or unable to explain answers','2 — Answers are unclear or need substantial prompting','3 — Communicates basic answers clearly','4 — Clear, structured answers supported by examples','5 — Concise, structured and highly convincing communication']},
  {k:'career_role',name:'Career & Role Readiness',guide:['1 — No clear understanding of the role or motivation','2 — Limited role understanding and weak motivation','3 — Basic understanding and reasonable interest','4 — Good research, clear motivation and role understanding','5 — Strong role insight, motivation and career alignment']},
  {k:'experience',name:'Experience Readiness',guide:['1 — No relevant evidence or exposure demonstrated','2 — Very limited or mostly unrelated exposure','3 — Some relevant work, internship, project or transferable evidence','4 — Strong relevant experience with clear examples','5 — Highly relevant experience with strong evidence of impact']},
  {k:'technical',name:'Technical Readiness',guide:['1 — Lacks essential knowledge or skill for the role','2 — Limited technical foundation; significant development needed','3 — Meets the basic technical requirement','4 — Strong technical readiness with practical application','5 — Excellent technical command for the role level']},
  {k:'professionalism',name:'Professionalism',guide:['1 — Poor preparation or inappropriate professional conduct','2 — Inconsistent preparation, attitude or presentation','3 — Meets normal professional expectations','4 — Well prepared, positive and professional throughout','5 — Exceptional preparation, maturity and professional presence']}
];
function openEval(raw){currentApp=JSON.parse(raw);scoreState={};$('evalCandidate').textContent=currentApp.candidates.full_name;$('evalJob').textContent=currentApp.vacancies.title;$('ratings').innerHTML=criteria.map(c=>`<div class="field"><label>${c.name}</label><div class="stars">${[1,2,3,4,5].map(n=>`<button type="button" class="scorebtn" id="s-${c.k}-${n}" onclick="setScore('${c.k}',${n})">${n}</button>`).join('')}</div><div class="rating-guide">${c.guide.map(g=>`<div>${esc(g)}</div>`).join('')}</div></div>`).join('');$('evalOutcome').value='';$('evalGap').value='';$('evalRemarks').value='';$('evalNote').value='';msg('evalMsg','');$('evalModal').classList.remove('hidden')}
function closeEval(){$('evalModal').classList.add('hidden')}
function setScore(k,n){scoreState[k]=n;for(let i=1;i<=5;i++)$('s-'+k+'-'+i).classList.toggle('on',i===n)}
function toggleRemarks(){$('remarksReq').textContent=$('evalGap').value==='other'?'(required)':'(required if Other)'}
async function submitEval(){try{const p={action:'submit_evaluation',sessionToken,applicationId:currentApp.id,outcome:$('evalOutcome').value,primaryGap:$('evalGap').value,remarks:$('evalRemarks').value,internalNote:$('evalNote').value,...scoreState};await api(p);msg('evalMsg','Evaluation saved.',true);setTimeout(()=>{closeEval();loadEmployerApps()},450)}catch(e){msg('evalMsg',e.message)}}
async function downloadReport(){try{const j=await api({action:'employer_report',sessionToken});const rows=[['Candidate','IC','Phone','Email','State','DUN','Vacancy','Status','Communication','Career & Role','Experience','Technical','Professionalism','Outcome','Primary Gap','Remarks','Internal Note']];j.rows.forEach(r=>{const e=(r.evaluations||[])[0]||{};rows.push([r.candidates.full_name,r.candidates.ic,r.candidates.phone,r.candidates.email,r.candidates.state||'',r.candidates.dun,r.vacancies.title,r.status,e.communication||'',e.career_role||'',e.experience||'',e.technical||'',e.professionalism||'',e.outcome||'',e.primary_gap||'',e.remarks||'',e.internal_note||''])});const csv=rows.map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='rapat-employer-report.csv';a.click();URL.revokeObjectURL(u)}catch(e){alert(e.message)}}

async function openOrganizer(){
  try{const h=await api({action:'session_home',sessionToken});if(h.role!=='organizer')throw Error('Organizer access required');role='organizer';eventData=h.event;$('orgEvent').textContent=h.event.name;renderOrgLists(h);renderBranding(h.event);show('organizer');await loadOrgDashboard()}catch(e){clearSession();showLogin('organizer')}
}
function orgTab(t,b){document.querySelectorAll('#organizer .tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');['orgDashboard','orgEmployers','orgBranding'].forEach(id=>$(id).classList.add('hidden'));if(t==='dashboard'){$('orgDashboard').classList.remove('hidden');loadOrgDashboard()}else if(t==='employers'){$('orgEmployers').classList.remove('hidden');refreshOrgHome()}else{$('orgBranding').classList.remove('hidden');refreshBranding()}}
async function refreshOrgHome(){const h=await api({action:'session_home',sessionToken});renderOrgLists(h)}
function renderOrgLists(h){$('ovEmployer').innerHTML=h.employers.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');$('orgEmployerList').innerHTML=h.employers.length?h.employers.map(e=>`<div class="row"><div><h4>${esc(e.name)}</h4><small>${e.booth?'Booth '+esc(e.booth):'No booth set'}</small></div></div>`).join(''):'<div class="empty">No employers yet.</div>';$('orgVacancyList').innerHTML=h.vacancies.length?h.vacancies.map(v=>`<div class="row"><div><h4>${esc(v.title)}</h4><small>${esc(v.employers.name)} · ${v.openings} opening(s)</small></div></div>`).join(''):'<div class="empty">No vacancies yet.</div>'}
async function saveEmployer(){try{await api({action:'organizer_save_employer',sessionToken,name:$('oeName').value,booth:$('oeBooth').value,contactName:$('oeContact').value,contactEmail:$('oeEmail').value,pin:$('oePin').value});msg('oeMsg','Employer account created. Share the access code securely with the employer.',true);['oeName','oeBooth','oeContact','oeEmail','oePin'].forEach(id=>$(id).value='');await refreshOrgHome();await loadOrgDashboard()}catch(e){msg('oeMsg',e.message)}}
async function saveOrgVacancy(){try{await api({action:'save_vacancy',sessionToken,employerId:$('ovEmployer').value,title:$('ovTitle').value,openings:$('ovOpen').value,requirements:$('ovReq').value.split(',')});msg('ovMsg','Vacancy added.',true);$('ovTitle').value='';$('ovReq').value='';await refreshOrgHome();await loadOrgDashboard()}catch(e){msg('ovMsg',e.message)}}
async function loadOrgDashboard(){try{const j=await api({action:'organizer_dashboard',sessionToken});const s=j.stats;$('stats').innerHTML=[['Employers',s.employers],['Vacancies',s.vacancies],['Candidates',s.candidates],['Interviews',s.applications],['Completed',s.completed]].map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');$('gapBars').innerHTML=bars(j.gaps,{communication:'Communication',career_role:'Career & Role',experience:'Experience',technical:'Technical',professionalism:'Professionalism',prerequisite:'Pre-requisite',other:'Other'});$('stateBars').innerHTML=bars(j.states||{});$('dunBars').innerHTML=bars(j.dun);$('outcomeStats').innerHTML=Object.entries(j.outcomes).map(([k,v])=>`<div class="stat"><b>${v}</b><span>${nice(k)}</span></div>`).join('')}catch(e){$('stats').innerHTML=`<div class="alert">${esc(e.message)}</div>`}}
function bars(obj,map={}){const arr=Object.entries(obj||{}).sort((a,b)=>Number(b[1])-Number(a[1])),max=Math.max(1,...arr.map(x=>Number(x[1])));return arr.length?arr.map(([k,v])=>`<div style="margin:13px 0"><div class="sectiontitle mini"><b>${map[k]||esc(k)}</b><span>${v}</span></div><div class="bar"><i style="width:${Number(v)/max*100}%"></i></div></div>`).join(''):'<p class="muted">No data yet.</p>'}

function renderBranding(e){$('logoPreview').innerHTML=e.collaborator_logo_url?`<img src="${esc(e.collaborator_logo_url)}" alt="Collaborator logo">`:'<span class="muted">No collaborator logo uploaded.</span>';$('bannerPreview').innerHTML=e.banner_url?`<img src="${esc(e.banner_url)}" alt="Event banner">`:'<span class="muted">No event banner uploaded.</span>'}
async function refreshBranding(){const h=await api({action:'session_home',sessionToken});eventData=h.event;renderBranding(h.event)}
async function uploadBranding(kind){const input=$(kind==='logo'?'logoFile':'bannerFile'),status=$(kind==='logo'?'logoStatus':'bannerStatus');if(!input.files[0]){status.textContent='Please select an image first.';return}const f=input.files[0];if(f.size>5*1024*1024){status.textContent='Image must be 5MB or smaller.';return}const fd=new FormData();fd.append('sessionToken',sessionToken);fd.append('kind',kind);fd.append('file',f);status.innerHTML='<span class="spinner"></span> Uploading…';try{const r=await fetch(BRANDING_API,{method:'POST',body:fd}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Upload failed');status.textContent='Uploaded successfully.';await refreshBranding();await refreshPublic()}catch(e){status.textContent=e.message}}

init();