const heroImage=document.querySelector('.hero-image img');
if(heroImage){heroImage.src='hero-career-fair.png';heroImage.removeAttribute('style');}

const desktopNav=document.querySelector('.nav-links');
if(desktopNav && !desktopNav.querySelector('a[href="events-live.html"]')){
  const eventsLink=document.createElement('a');
  eventsLink.href='events-live.html';
  eventsLink.textContent='Events';
  const firstSpecial=desktopNav.querySelector('a[href="contribute.html"]') || desktopNav.querySelector('.nav-cta');
  desktopNav.insertBefore(eventsLink,firstSpecial || null);
}
if(desktopNav && !desktopNav.querySelector('a[href="contribute.html"]')){
  const contributeLink=document.createElement('a');
  contributeLink.href='contribute.html';
  contributeLink.textContent='Contribute';
  const pilotCta=desktopNav.querySelector('.nav-cta');
  desktopNav.insertBefore(contributeLink,pilotCta || null);
}

const mobileNav=document.querySelector('#mobileMenu > div');
if(mobileNav && !mobileNav.querySelector('a[href="events-live.html"]')){
  const eventsMobile=document.createElement('a');
  eventsMobile.href='events-live.html';
  eventsMobile.textContent='Events';
  mobileNav.appendChild(eventsMobile);
}
if(mobileNav && !mobileNav.querySelector('a[href="contribute.html"]')){
  const contributeMobile=document.createElement('a');
  contributeMobile.href='contribute.html';
  contributeMobile.textContent='Contribute to Malaysia’s Workforce';
  mobileNav.appendChild(contributeMobile);
}

const footerLinks=document.querySelector('.footer-links');
if(footerLinks && !footerLinks.querySelector('a[href="events-live.html"]')){
  const eventsFooter=document.createElement('a');
  eventsFooter.href='events-live.html';
  eventsFooter.textContent='Events';
  footerLinks.appendChild(eventsFooter);
}
if(footerLinks && !footerLinks.querySelector('a[href="contribute.html"]')){
  const contributeFooter=document.createElement('a');
  contributeFooter.href='contribute.html';
  contributeFooter.textContent='Contribute to Malaysia’s Workforce';
  footerLinks.appendChild(contributeFooter);
}

const RAPAT_API_URL='https://script.google.com/macros/s/AKfycbwqv_1iSUYlHx0AD2U_-HH0DxqyJyCeyORtfFgX5gEmzOIep23ziPNWFGb7iTtX4WGVfA/exec';
const form=document.getElementById('pilotForm');
const statusBox=document.getElementById('formStatus');
const submitButton=document.getElementById('submitButton');
if(form && statusBox && submitButton){
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
}