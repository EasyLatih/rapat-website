(function(){
  const KEYS=['communication','career_role','experience','technical','professionalism'];
  const LABELS=['Communication','Career & Role','Experience','Technical','Professionalism'];

  function evaluationOfRow(row){
    if(Array.isArray(row?.evaluations)) return row.evaluations[0]||{};
    return row?.evaluations||{};
  }

  function candidateKey(row,index){
    const c=row?.candidates||{};
    return c.ic || c.email || c.full_name || `candidate-${index}`;
  }

  function averageByCandidate(rows){
    const grouped=new Map();
    (rows||[]).forEach((row,index)=>{
      const e=evaluationOfRow(row);
      if(!KEYS.every(k=>Number(e[k])>=1 && Number(e[k])<=5)) return;
      const key=candidateKey(row,index);
      if(!grouped.has(key)) grouped.set(key,{sums:Object.fromEntries(KEYS.map(k=>[k,0])),count:0});
      const g=grouped.get(key);
      KEYS.forEach(k=>g.sums[k]+=Number(e[k]));
      g.count++;
    });
    const candidates=[...grouped.values()].map(g=>Object.fromEntries(KEYS.map(k=>[k,g.sums[k]/g.count])));
    if(!candidates.length) return {count:0,values:KEYS.map(()=>0)};
    const values=KEYS.map(k=>candidates.reduce((sum,c)=>sum+c[k],0)/candidates.length);
    return {count:candidates.length,values};
  }

  function drawOrganizerRadar(values){
    const canvas=document.getElementById('orgRadarCanvas');
    if(!canvas) return;
    const ctx=canvas.getContext('2d'),cx=160,cy=150,R=100,n=5;
    ctx.clearRect(0,0,320,300);
    ctx.font='11px Inter, Arial, sans-serif';
    ctx.lineWidth=1;
    for(let level=1;level<=5;level++){
      ctx.beginPath();
      for(let i=0;i<n;i++){
        const a=-Math.PI/2+i*2*Math.PI/n,r=R*level/5,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.closePath();ctx.strokeStyle='#dce4ef';ctx.stroke();
    }
    for(let i=0;i<n;i++){
      const a=-Math.PI/2+i*2*Math.PI/n;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);ctx.strokeStyle='#dce4ef';ctx.stroke();
      const tx=cx+Math.cos(a)*(R+28),ty=cy+Math.sin(a)*(R+28);
      ctx.fillStyle='#607089';ctx.textAlign=tx<cx-5?'right':tx>cx+5?'left':'center';
      const label=LABELS[i];
      if(label==='Career & Role'){ctx.fillText('Career & Role',tx,ty)} else ctx.fillText(label,tx,ty);
    }
    ctx.beginPath();
    values.forEach((v,i)=>{
      const a=-Math.PI/2+i*2*Math.PI/n,r=R*(Math.max(0,Math.min(5,v))/5),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    });
    ctx.closePath();ctx.fillStyle='rgba(36,88,220,.18)';ctx.fill();ctx.strokeStyle='#2458dc';ctx.lineWidth=2;ctx.stroke();
    values.forEach((v,i)=>{
      const a=-Math.PI/2+i*2*Math.PI/n,r=R*(Math.max(0,Math.min(5,v))/5),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle='#2458dc';ctx.fill();
    });
  }

  async function renderOrganizerRadar(){
    const dashboard=document.getElementById('orgDashboard');
    const organizer=document.getElementById('organizer');
    if(!dashboard||!organizer||organizer.classList.contains('hidden')||typeof orgReport!=='function') return;
    let panel=document.getElementById('orgRadarPanel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='orgRadarPanel';panel.className='panel';panel.style.marginTop='16px';
      const stats=document.getElementById('stats');
      if(stats&&stats.parentNode===dashboard) stats.insertAdjacentElement('afterend',panel); else dashboard.prepend(panel);
    }
    panel.innerHTML='<div class="sectiontitle"><div><div class="eyebrow">Overall Employability Readiness</div><h3 style="margin:6px 0 4px">Average Rating — All Evaluated Candidates</h3><p class="muted" id="orgRadarMeta">Loading candidate averages…</p></div><button class="btn light small" id="orgRadarRefresh" type="button">Refresh</button></div><div class="radarwrap"><canvas id="orgRadarCanvas" width="320" height="300" style="width:320px;max-width:100%;height:auto"></canvas><div id="orgRadarScores"></div></div>';
    document.getElementById('orgRadarRefresh').onclick=renderOrganizerRadar;
    try{
      const report=await orgReport();
      const result=averageByCandidate(report.rows||[]);
      const meta=document.getElementById('orgRadarMeta'),scores=document.getElementById('orgRadarScores');
      if(!result.count){
        meta.textContent='No completed evaluations yet.';
        scores.innerHTML='<div class="empty">The spider chart will appear once employers complete candidate evaluations.</div>';
        drawOrganizerRadar([0,0,0,0,0]);
        return;
      }
      meta.textContent=`Based on ${result.count} evaluated candidate${result.count===1?'':'s'}. Each candidate is weighted equally, even if they attended multiple interviews.`;
      scores.innerHTML=result.values.map((v,i)=>`<div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #edf1f5"><span>${LABELS[i]}</span><b>${v.toFixed(2)} / 5</b></div>`).join('');
      drawOrganizerRadar(result.values);
    }catch(e){
      const meta=document.getElementById('orgRadarMeta');if(meta)meta.textContent=e?.message||'Unable to load rating averages.';
    }
  }

  const originalOpenOrganizer=window.openOrganizer;
  if(typeof originalOpenOrganizer==='function'){
    window.openOrganizer=async function(){
      const result=await originalOpenOrganizer.apply(this,arguments);
      setTimeout(renderOrganizerRadar,100);
      return result;
    };
  }
  const originalOrgTab=window.orgTab;
  if(typeof originalOrgTab==='function'){
    window.orgTab=function(tab,button){
      const result=originalOrgTab.apply(this,arguments);
      if(tab==='dashboard') setTimeout(renderOrganizerRadar,50);
      return result;
    };
  }
  setTimeout(renderOrganizerRadar,700);
})();
