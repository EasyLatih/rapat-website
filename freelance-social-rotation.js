(() => {
  'use strict';

  let providerRows = [];
  let initialized = false;
  let lastAutoPickedSignature = '';

  const eligible = () => providerRows.filter(p => p.status === 'approved' && p.is_published);
  const byId = id => eligible().find(p => String(p.id) === String(id)) || null;

  function formatDate(value) {
    if (!value) return 'Belum pernah dipost';
    try {
      return new Intl.DateTimeFormat('ms-MY', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function randomItem(rows) {
    return rows[Math.floor(Math.random() * rows.length)] || null;
  }

  function fairRandomPool(rows) {
    if (!rows.length) return [];

    const neverPosted = rows.filter(p => !p.last_featured_at || Number(p.feature_count || 0) === 0);
    if (neverPosted.length) return neverPosted;

    const minCount = Math.min(...rows.map(p => Number(p.feature_count || 0)));
    const leastFeatured = rows.filter(p => Number(p.feature_count || 0) === minCount);
    const oldestFirst = leastFeatured.slice().sort((a, b) => {
      const aTime = new Date(a.last_featured_at || 0).getTime();
      const bTime = new Date(b.last_featured_at || 0).getTime();
      return aTime - bTime;
    });

    const batchSize = Math.min(6, Math.max(2, Math.ceil(oldestFirst.length * 0.25)));
    return oldestFirst.slice(0, Math.min(batchSize, oldestFirst.length));
  }

  function pickFairRandom({ excludeCurrent = false } = {}) {
    const rows = eligible();
    if (!rows.length) return null;

    const currentId = document.getElementById('gigSocialProvider')?.value || '';
    let pool = fairRandomPool(rows);
    if (excludeCurrent && pool.length > 1 && currentId) {
      const withoutCurrent = pool.filter(p => String(p.id) !== String(currentId));
      if (withoutCurrent.length) pool = withoutCurrent;
    }

    const chosen = randomItem(pool);
    if (chosen && typeof window.gigSocialSelectProvider === 'function') {
      window.gigSocialSelectProvider(chosen.id);
      window.setTimeout(updateRotationUi, 0);
    }
    return chosen;
  }

  function mountRotationUi() {
    const kit = document.getElementById('gigSocialKit');
    if (!kit || document.getElementById('gigSocialRotationMeta')) return;

    const workspace = document.getElementById('gigSocialWorkspace');
    const captionSide = workspace?.lastElementChild;
    const actions = captionSide?.querySelector('.gig-social-actions');
    if (actions && !document.getElementById('gigSocialMarkPosted')) {
      const button = document.createElement('button');
      button.id = 'gigSocialMarkPosted';
      button.type = 'button';
      button.className = 'btn light';
      button.textContent = '✓ Mark as Posted';
      button.onclick = markCurrentPosted;
      actions.appendChild(button);
    }

    const controls = kit.querySelector('.gig-social-controls');
    if (controls) {
      const meta = document.createElement('div');
      meta.id = 'gigSocialRotationMeta';
      meta.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:#667085;padding-top:2px';
      controls.after(meta);
    }
  }

  function updateProviderOptionLabels() {
    const select = document.getElementById('gigSocialProvider');
    if (!select) return;
    [...select.options].forEach(option => {
      const p = byId(option.value);
      if (!p) return;
      const count = Number(p.feature_count || 0);
      const base = `${p.display_name || 'Provider'} · ${[p.district, p.state].filter(Boolean).join(', ') || 'Malaysia'}`;
      option.textContent = count > 0 ? `${base} · Posted ${count}x` : `${base} · BELUM POST`;
    });
  }

  function updateRotationUi() {
    mountRotationUi();
    updateProviderOptionLabels();

    const meta = document.getElementById('gigSocialRotationMeta');
    const button = document.getElementById('gigSocialMarkPosted');
    const currentId = document.getElementById('gigSocialProvider')?.value || '';
    const current = byId(currentId);
    const rows = eligible();
    const remaining = rows.filter(p => !p.last_featured_at || Number(p.feature_count || 0) === 0).length;

    if (meta) {
      if (!rows.length) {
        meta.textContent = 'Tiada provider approved & published.';
      } else if (current) {
        const count = Number(current.feature_count || 0);
        const status = count > 0
          ? `Pernah dipost ${count}x · kali terakhir ${formatDate(current.last_featured_at)}`
          : 'Belum pernah dipost';
        meta.innerHTML = `<b style="color:#344054">${remaining} belum dipromote</b><span>·</span><span>${status}</span><span>·</span><span>Random akan utamakan yang belum pernah dipost.</span>`;
      }
    }

    if (button) {
      button.disabled = !current;
      button.textContent = current && Number(current.feature_count || 0) > 0 ? '✓ Mark Posted Again' : '✓ Mark as Posted';
    }
  }

  async function markCurrentPosted() {
    const providerId = document.getElementById('gigSocialProvider')?.value || '';
    const provider = byId(providerId);
    if (!provider || typeof window.gigAdminApi !== 'function') return;

    const button = document.getElementById('gigSocialMarkPosted');
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving…';
    }

    try {
      await window.gigAdminApi('mark_provider_featured', { providerId });
      const toast = document.getElementById('gigSocialToast');
      if (toast) toast.textContent = `${provider.display_name || 'Provider'} ditanda sebagai posted.`;
      if (typeof window.loadGigAdmin === 'function') await window.loadGigAdmin();
    } catch (error) {
      alert(error?.message || 'Tak dapat simpan status posted.');
      updateRotationUi();
    }
  }

  function signature(rows) {
    return rows.map(p => `${p.id}:${p.feature_count || 0}:${p.last_featured_at || ''}`).sort().join('|');
  }

  function hookProviderRenderer() {
    const current = window.renderGigProviders;
    if (typeof current !== 'function' || current.__rapatRotationHook) return;

    function wrapped(rows) {
      providerRows = Array.isArray(rows) ? rows.slice() : [];
      const result = current(rows);
      mountRotationUi();
      updateRotationUi();

      const sig = signature(eligible());
      if (sig && sig !== lastAutoPickedSignature) {
        lastAutoPickedSignature = sig;
        window.setTimeout(() => pickFairRandom({ excludeCurrent: false }), 0);
      }
      return result;
    }

    wrapped.__rapatRotationHook = true;
    window.renderGigProviders = wrapped;
  }

  window.gigSocialPickRandom = () => pickFairRandom({ excludeCurrent: true });
  window.gigSocialMarkPosted = markCurrentPosted;

  function init() {
    if (initialized) return;
    initialized = true;
    mountRotationUi();
    hookProviderRenderer();

    const providerSelect = document.getElementById('gigSocialProvider');
    if (providerSelect) providerSelect.addEventListener('change', () => window.setTimeout(updateRotationUi, 0));
  }

  init();
  window.addEventListener('load', init, { once: true });
})();
