async function createEventWithDates(){
  const start=document.getElementById('newEventDate')?.value||'';
  const end=document.getElementById('newEventEnd')?.value||start;
  if(!start)return msg('eventMsg','Start date is required.');
  if(end<start)return msg('eventMsg','End date cannot be earlier than start date.');
  try{
    const publish=document.getElementById('newEventPublish');
    const venue=(document.getElementById('newEventVenue')?.value||'')+'||ENDDATE='+end;
    await authApi('create_event',{
      organizationId:document.getElementById('eventOrg')?.value||null,
      name:document.getElementById('newEventName')?.value||'',
      slug:document.getElementById('newEventSlug')?.value||'',
      eventDate:start,
      eventState:document.getElementById('newEventState')?.value||'',
      venue,
      organizerName:document.getElementById('newOrganizerName')?.value||'Organizer',
      organizerEmail:document.getElementById('newOrganizerEmail')?.value||'',
      organizerPin:document.getElementById('newOrganizerPin')?.value||'',
      status:publish&&publish.checked?'active':'draft'
    });
    ['newEventName','newEventSlug','newEventDate','newEventEnd','newEventState','newEventVenue','newOrganizerEmail','newOrganizerPin'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    msg('eventMsg',publish&&publish.checked?'Event created and published.':'Event saved as draft.',true);
    await loadEvents();
  }catch(e){msg('eventMsg',e.message)}
}
setTimeout(()=>{
  const start=document.getElementById('newEventDate'),end=document.getElementById('newEventEnd');
  if(start&&end)start.addEventListener('change',()=>{if(!end.value||end.value<start.value)end.value=start.value});
  const createBtn=[...document.querySelectorAll('#view-events button')].find(b=>b.textContent.includes('Create Event'));
  if(createBtn&&!document.getElementById('newEventPublish')){
    const field=document.createElement('div');field.className='field';
    field.innerHTML='<label style="display:flex;gap:9px;align-items:center"><input id="newEventPublish" type="checkbox" checked style="width:auto"> Publish on public Events page</label><div class="help">Untick to save this event as Draft.</div>';
    createBtn.parentNode.insertBefore(field,createBtn);
  }
},0);