import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Network } from '@capacitor/network';
import { Share } from '@capacitor/share';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://afyqxqvflchgwbtmoogd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mFbkAT7UVw1v8SPmC25WSw_8wQVQc4c';
const CALLBACK_URL = 'my.rapat.app://login-callback';
const isNative = Capacitor.isNativePlatform();

if (isNative) {
  document.documentElement.classList.add('rapat-native');

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  async function signInFor(returnMode, providerId) {
    sessionStorage.setItem('rapatGigPendingAction', JSON.stringify({ mode: returnMode, providerId }));
    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: CALLBACK_URL,
        skipBrowserRedirect: true
      }
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Google Sign-In URL tidak tersedia.');
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }

  async function completeAuth(url) {
    if (!url?.startsWith(CALLBACK_URL)) return;
    try { await Browser.close(); } catch {}

    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const query = parsed.searchParams;
    const accessToken = hash.get('access_token') || query.get('access_token');
    const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
    const code = query.get('code');

    if (accessToken && refreshToken) {
      const { error } = await db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } else if (code) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }

    location.href = 'freelance.html';
  }

  window.RAPAT_NATIVE = { signInFor };
  App.addListener('appUrlOpen', ({ url }) => completeAuth(url).catch(err => alert(err.message)));

  function createOfflineBanner() {
    if (document.getElementById('rapatOfflineBanner')) return;
    const el = document.createElement('div');
    el.id = 'rapatOfflineBanner';
    el.className = 'rapat-offline-banner';
    el.textContent = 'Tiada sambungan internet. Sesetengah fungsi RAPAT mungkin tidak tersedia.';
    document.body.appendChild(el);
  }

  async function updateNetwork() {
    const status = await Network.getStatus();
    document.body.classList.toggle('rapat-is-offline', !status.connected);
    if (!status.connected) createOfflineBanner();
  }

  Network.addListener('networkStatusChange', status => {
    document.body.classList.toggle('rapat-is-offline', !status.connected);
    if (!status.connected) createOfflineBanner();
  });

  function addNativeNav() {
    if (document.getElementById('rapatNativeNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'rapatNativeNav';
    nav.className = 'rapat-native-nav';
    nav.innerHTML = `
      <a href="index.html"><span>⌂</span><small>Utama</small></a>
      <a href="freelance.html"><span>⌕</span><small>Cari</small></a>
      <a href="freelance-provider.html"><span>＋</span><small>Daftar</small></a>
      <button type="button" id="rapatNativeShare"><span>↗</span><small>Kongsi</small></button>`;
    document.body.appendChild(nav);
    document.getElementById('rapatNativeShare')?.addEventListener('click', async () => {
      try {
        await Share.share({
          title: 'RAPAT.my',
          text: 'Cari servis lokal di seluruh Malaysia melalui RAPAT.my',
          url: 'https://rapat.my'
        });
      } catch {}
    });
  }

  App.addListener('backButton', () => {
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) {
      openModal.classList.add('hidden');
      return;
    }
    if (history.length > 1) history.back();
    else App.exitApp();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addNativeNav();
      updateNetwork().catch(() => {});
    });
  } else {
    addNativeNav();
    updateNetwork().catch(() => {});
  }
}
