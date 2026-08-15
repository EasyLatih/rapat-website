// RAPAT public navigation enhancements.
const core=document.createElement('script');
core.src='app-core.js?v=1';
core.onload=()=>{
  document.querySelectorAll('a').forEach(a=>{if(a.textContent.trim()==='Events')a.href='events-directory.html'});

  const desktop=document.querySelector('.nav-links');
  if(desktop&&!desktop.querySelector('a[href="freelance.html"]')){
    const link=document.createElement('a');link.href='freelance.html';link.textContent='Freelance / Gig';
    const before=desktop.querySelector('a[href="contribute.html"]');desktop.insertBefore(link,before||desktop.lastElementChild);
  }

  const mobile=document.querySelector('#mobileMenu > div');
  if(mobile&&!mobile.querySelector('a[href="freelance.html"]')){
    const link=document.createElement('a');link.href='freelance.html';link.textContent='Freelance / Gig';
    const before=mobile.querySelector('a[href="contribute.html"]');mobile.insertBefore(link,before||null);
  }

  const footer=document.querySelector('.footer-links');
  if(footer&&!footer.querySelector('a[href="freelance.html"]')){
    const link=document.createElement('a');link.href='freelance.html';link.textContent='Freelance / Gig';footer.appendChild(link);
  }
};
document.body.appendChild(core);