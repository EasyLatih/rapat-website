// Measure SEO profile views/WhatsApp intent using the existing deduplicated RAPAT RPC.
// Link navigation is never blocked by analytics failures.
import { db, ensureVisitorKey } from './gig-config.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const visitorKey = ensureVisitorKey();
function record(providerId,type) {
  if(!uuid.test(String(providerId||'')))return;
  Promise.resolve(db.rpc('gig_record_interaction',{
    p_provider_id:providerId,p_interaction_type:type,p_visitor_key:visitorKey
  })).catch(()=>{});
}
const profileId=document.body.dataset.rapatProviderId;
if(profileId)record(profileId,'view');
document.addEventListener('click',event=>{
  const link=event.target.closest('a[data-rapat-whatsapp-provider]');
  if(link)record(link.dataset.rapatWhatsappProvider,'whatsapp');
});
