const SEMAK_MULE_URL = 'https://semakmule.rmp.gov.my/';

let pendingWhatsappButton = null;
let previousFocus = null;
let bypassSafetyOnce = false;

function buildSafetyModal() {
  if (document.getElementById('waSafetyModal')) return;

  const modal = document.createElement('div');
  modal.id = 'waSafetyModal';
  modal.className = 'wa-safety-modal hidden';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="wa-safety-sheet" role="dialog" aria-modal="true" aria-labelledby="waSafetyTitle" aria-describedby="waSafetyDesc">
      <div class="wa-safety-handle" aria-hidden="true"></div>
      <button type="button" class="wa-safety-close" id="waSafetyClose" aria-label="Tutup">×</button>
      <div class="wa-safety-icon" aria-hidden="true">🛡️</div>
      <h2 id="waSafetyTitle">Berurusan dengan selamat</h2>
      <p id="waSafetyDesc">RAPAT tidak mengendalikan pembayaran antara anda dan penyedia servis.</p>
      <p>Sebelum membuat bayaran, anda digalakkan menyemak nombor telefon atau akaun bank melalui portal rasmi PDRM.</p>

      <a class="wa-safety-mule" href="${SEMAK_MULE_URL}" target="_blank" rel="noopener noreferrer">
        <span class="wa-safety-mule-icon" aria-hidden="true">🔎</span>
        <span><strong>Semak di Semak Mule PDRM</strong><small>Semak nombor telefon atau akaun bank sebelum membuat transaksi.</small></span>
        <span aria-hidden="true">↗</span>
      </a>

      <div class="wa-safety-tip"><strong>💡 Ingat:</strong><span>Elakkan bayaran penuh di awal dan simpan resit atau bukti pembayaran.</span></div>

      <button type="button" class="btn whatsapp wa-safety-continue" id="waSafetyContinue">Teruskan ke WhatsApp</button>
      <button type="button" class="btn light wa-safety-cancel" id="waSafetyCancel">Batal</button>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById('waSafetyClose')?.addEventListener('click', closeSafetyModal);
  document.getElementById('waSafetyCancel')?.addEventListener('click', closeSafetyModal);
  document.getElementById('waSafetyContinue')?.addEventListener('click', continueToWhatsapp);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeSafetyModal();
  });
}

function openSafetyModal(button) {
  buildSafetyModal();
  pendingWhatsappButton = button;
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modal = document.getElementById('waSafetyModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('wa-safety-open');
  requestAnimationFrame(() => document.getElementById('waSafetyContinue')?.focus());
}

function closeSafetyModal({ restoreFocus = true } = {}) {
  const modal = document.getElementById('waSafetyModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('wa-safety-open');
  pendingWhatsappButton = null;
  if (restoreFocus && previousFocus) previousFocus.focus();
  previousFocus = null;
}

function continueToWhatsapp() {
  const button = pendingWhatsappButton;
  if (!button || !document.contains(button)) {
    closeSafetyModal();
    return;
  }
  closeSafetyModal({ restoreFocus: false });
  bypassSafetyOnce = true;
  button.click();
  bypassSafetyOnce = false;
}

function interceptWhatsappClick(event) {
  const button = event.target instanceof Element
    ? event.target.closest('button[data-wa], #detailWhatsapp')
    : null;
  if (!button || bypassSafetyOnce) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openSafetyModal(button);
}

function createDetailsSafetyStrip() {
  const strip = document.createElement('div');
  strip.className = 'semak-mule-strip';
  strip.innerHTML = `
    <span class="semak-mule-strip-icon" aria-hidden="true">🛡️</span>
    <span class="semak-mule-strip-copy"><strong>Semak sebelum membuat bayaran</strong><small>Untuk keselamatan anda, semak nombor telefon atau akaun bank melalui portal rasmi PDRM.</small></span>
    <a href="${SEMAK_MULE_URL}" target="_blank" rel="noopener noreferrer">Semak di Semak Mule <span aria-hidden="true">↗</span></a>`;
  return strip;
}

function ensureDetailsSafetyStrip() {
  const container = document.getElementById('providerDetails');
  if (!container || container.querySelector('.semak-mule-strip')) return;
  const actions = container.querySelector('.detail-actions');
  if (!actions) return;
  actions.insertAdjacentElement('afterend', createDetailsSafetyStrip());
}

buildSafetyModal();
document.addEventListener('click', interceptWhatsappClick, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('waSafetyModal')?.classList.contains('hidden')) {
    closeSafetyModal();
  }
});

const detailsContainer = document.getElementById('providerDetails');
if (detailsContainer) {
  new MutationObserver(ensureDetailsSafetyStrip).observe(detailsContainer, { childList: true, subtree: true });
  ensureDetailsSafetyStrip();
}
