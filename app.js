// RAPAT public Events directory navigation.
const core=document.createElement('script');
core.src='app-core.js?v=1';
core.onload=()=>{
  document.querySelectorAll('a').forEach(a=>{if(a.textContent.trim()==='Events')a.href='events-directory.html'});
};
document.body.appendChild(core);