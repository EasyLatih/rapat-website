const RAPAT_API_URL='https://script.google.com/macros/s/AKfycbwqv_1iSUYlHx0AD2U_-HH0DxqyJyCeyORtfFgX5gEmzOIep23ziPNWFGb7iTtX4WGVfA/exec';
const form=document.getElementById('pilotForm');
const statusBox=document.getElementById('formStatus');
const submitButton=document.getElementById('submitButton');
form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  submitButton.disabled=true;submitButton.textContent='Submitting...';statusBox.className='status';statusBox.textContent='';
  const fd=new FormData(form);
  const payload={organisation:fd.get('organisation'),organisationType:fd.get('organisationType'),contactPerson:fd.get('contactPerson'),position:fd.get('position'),email:fd.get('email'),phone:fd.get('phone'),careerProgramme:fd.get('careerProgramme'),upcomingEvent:fd.get('upcomingEvent'),estimatedParticipants:fd.get('estimatedParticipants'),challenge:fd.get('challenge'),openToDiscussion:fd.get('openToDiscussion')};
  try{
    await fetch(RAPAT_API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    statusBox.textContent='Thank you. Your pilot request has been submitted. We will contact you to discuss the next step.';statusBox.className='status ok';form.reset();
  }catch(err){statusBox.textContent='We could not submit your request. Please try again.';statusBox.className='status err'}
  finally{submitButton.disabled=false;submitButton.textContent='Request Pilot Access'}
});