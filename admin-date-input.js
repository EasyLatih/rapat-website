async function createEventWithDates(){
  const start=document.getElementById('newEventDate')?.value||'';
  const end=document.getElementById('newEventEnd')?.value||start;
  if(!start)return msg('eventMsg','Start date is required.');
  if(end<start)return msg('eventMsg','End date cannot be earlier than start date.');
  const venue=document.getElementById('newEventVenue');
  const original=venue.value;
  venue.value=(original||'')+'||ENDDATE='+end;
  await createEvent();
  if(venue.value.includes('||ENDDATE='))venue.value=original;
}
setTimeout(()=>{
  const start=document.getElementById('newEventDate'),end=document.getElementById('newEventEnd');
  if(start&&end)start.addEventListener('change',()=>{if(!end.value||end.value<start.value)end.value=start.value});
},0);