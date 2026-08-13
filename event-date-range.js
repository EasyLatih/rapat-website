(function(){
  function fmt(start,end){
    if(!start)return 'Date TBC';end=end||start;
    const a=new Date(start+'T00:00:00'),b=new Date(end+'T00:00:00');
    if(start===end)return a.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'});
    if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())return `${a.getDate()}–${b.getDate()} ${b.toLocaleDateString('en-MY',{month:'short',year:'numeric'})}`;
    if(a.getFullYear()===b.getFullYear())return `${a.toLocaleDateString('en-MY',{day:'numeric',month:'short'})}–${b.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})}`;
    return `${a.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})}–${b.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})}`;
  }
  const base=window.renderLanding;
  if(typeof base==='function')window.renderLanding=function(j){base(j);if(j?.event&&document.getElementById('eventDate'))document.getElementById('eventDate').textContent='📅 '+fmt(j.event.start_date||j.event.event_date,j.event.end_date||j.event.start_date||j.event.event_date)};
  if(window.eventData&&document.getElementById('eventDate'))document.getElementById('eventDate').textContent='📅 '+fmt(eventData.start_date||eventData.event_date,eventData.end_date||eventData.start_date||eventData.event_date);
})();