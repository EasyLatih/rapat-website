import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://rapat.my';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'penyedia';
}

function providerSlug(provider) {
  const id = String(provider.provider_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  return `${slugify(provider.display_name)}-${id || 'profil'}`;
}

function providerPath(provider) {
  return `/penyedia/${providerSlug(provider)}/`;
}

function queryUrl(service, state, district) {
  const params = new URLSearchParams({ q: service || '', state: state || '', district: district || '' });
  return `/freelance.html?${params.toString()}`;
}

function whatsappUrl(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `60${digits.slice(1)}`;
  if (!digits.startsWith('60') && digits.length >= 9 && digits.length <= 11) digits = `60${digits}`;
  return /^60\d{8,11}$/.test(digits) ? `https://wa.me/${digits}` : '';
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

async function getSupabaseConfig() {
  const source = await fs.readFile(path.join(ROOT, 'gig-config.js'), 'utf8');
  const url = source.match(/const SUPABASE_URL='([^']+)'/)?.[1];
  const key = source.match(/const SUPABASE_KEY='([^']+)'/)?.[1];
  if (!url || !key) throw new Error('Supabase public config tidak ditemui dalam gig-config.js');
  return { url, key };
}

async function fetchProviders() {
  const { url, key } = await getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/gig_search_providers`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_service_id: null,
      p_custom_service: null,
      p_state: null,
      p_district: null,
      p_postcode: null
    })
  });
  if (!response.ok) throw new Error(`Supabase provider SEO fetch gagal: ${response.status} ${await response.text()}`);
  return await response.json();
}

function uniqueServices(provider) {
  const seen = new Set();
  const services = [];
  for (const service of Array.isArray(provider.services) ? provider.services : []) {
    const name = String(service?.name || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    services.push(name);
  }
  return services;
}

function buildServicePathLookup(providers) {
  const groups = new Map();
  for (const provider of providers || []) {
    const district = String(provider.district || '').trim();
    const state = String(provider.state || '').trim();
    if (!district || !state) continue;
    for (const service of uniqueServices(provider)) {
      const key = `${service.toLowerCase()}|${district.toLowerCase()}|${state.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { service, district, state });
    }
  }

  const baseCounts = new Map();
  for (const group of groups.values()) {
    const base = `${slugify(group.service)}/${slugify(group.district)}`;
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
  }

  const lookup = new Map();
  for (const [key, group] of groups) {
    const serviceSlug = slugify(group.service);
    const districtSlug = slugify(group.district);
    const base = `${serviceSlug}/${districtSlug}`;
    const locationSlug = baseCounts.get(base) > 1 ? `${districtSlug}-${slugify(group.state)}` : districtSlug;
    lookup.set(key, `/servis/${serviceSlug}/${locationSlug}/`);
  }
  return lookup;
}

function servicePath(provider, service, lookup) {
  const key = `${String(service).toLowerCase()}|${String(provider.district || '').trim().toLowerCase()}|${String(provider.state || '').trim().toLowerCase()}`;
  return lookup.get(key) || queryUrl(service, provider.state, provider.district);
}

function providerJsonLd(provider, services) {
  const urlPath = providerPath(provider);
  const primary = services[0] || 'penyedia servis';
  const description = `${provider.display_name} menyediakan ${primary} di ${provider.district}, ${provider.state} melalui direktori RAPAT.`;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${BASE_URL}${urlPath}#webpage`,
        url: `${BASE_URL}${urlPath}`,
        name: `${provider.display_name} | ${primary} di ${provider.district} - RAPAT`,
        description
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'RAPAT', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Penyedia Servis', item: `${BASE_URL}/penyedia/` },
          { '@type': 'ListItem', position: 3, name: provider.display_name, item: `${BASE_URL}${urlPath}` }
        ]
      }
    ]
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function providerPageHtml(provider, serviceLookup, relatedProviders) {
  const services = uniqueServices(provider);
  const primary = services[0] || 'Servis';
  const location = [provider.district, provider.state].filter(Boolean).join(', ');
  const title = `${provider.display_name} | ${primary} di ${provider.district || provider.state || 'Malaysia'} - RAPAT`;
  const description = `${provider.display_name} menawarkan ${services.slice(0, 3).join(', ') || 'perkhidmatan'} di ${location || 'Malaysia'}. Semak servis, rating dan hubungi penyedia terus melalui RAPAT.`;
  const wa = whatsappUrl(provider.whatsapp);
  const social = safeExternalUrl(provider.social_url);
  const ratingCount = Number(provider.rating_count || 0);
  const rating = Number(provider.average_rating || 0);
  const ratingText = ratingCount > 0 ? `${rating.toFixed(1)} ★ · ${ratingCount} rating` : 'Belum ada rating';

  const serviceLinks = services.map(service => {
    const href = servicePath(provider, service, serviceLookup);
    return `<a class="service-chip" href="${escapeHtml(href)}">${escapeHtml(service)}</a>`;
  }).join('');

  const related = relatedProviders.slice(0, 6).map(item => {
    const itemServices = uniqueServices(item);
    return `<a class="related-card" href="${providerPath(item)}"><strong>${escapeHtml(item.display_name)}</strong><span>${escapeHtml(itemServices.slice(0, 2).join(' · ') || 'Penyedia servis')}</span><small>${escapeHtml(item.district)}, ${escapeHtml(item.state)}</small></a>`;
  }).join('');

  const liveUrl = queryUrl(primary, provider.state, provider.district);

  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${BASE_URL}${providerPath(provider)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${BASE_URL}${providerPath(provider)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/freelance.css">
<style>
.provider-main{max-width:960px;margin:0 auto;padding:38px 20px 70px}.breadcrumbs{font-size:12px;color:#6b778c;margin-bottom:20px}.breadcrumbs a{color:#315f9d}.profile{border:1px solid #e3e8ef;border-radius:22px;background:#fff;overflow:hidden}.profile-top{padding:30px;background:linear-gradient(135deg,#f4f8ff,#fff)}.profile h1{margin:0;color:#09265e;font-size:34px;line-height:1.15}.location{margin-top:8px;color:#66758c;font-size:14px}.rating{display:inline-block;margin-top:14px;background:#fff5d9;color:#8a5a00;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800}.profile-body{padding:26px 30px}.profile-body h2,.related h2{margin:0 0 12px;color:#0b1d42;font-size:20px}.service-list{display:flex;gap:8px;flex-wrap:wrap}.service-chip{display:inline-block;padding:9px 11px;border-radius:999px;background:#eef4ff;color:#1854a0;font-size:12px;font-weight:800}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.note{margin-top:26px;padding:16px 18px;border-radius:14px;background:#f7f9fc;color:#5b687d;font-size:13px;line-height:1.6}.related{margin-top:28px}.related-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.related-card{border:1px solid #e3e8ef;border-radius:14px;padding:15px;background:#fff;display:flex;flex-direction:column;gap:5px;color:#253b5b}.related-card span{font-size:12px;color:#465a77}.related-card small{font-size:11px;color:#7a8799}.seo-provider-name{color:#0b1d42;text-decoration:none}@media(max-width:700px){.provider-main{padding:28px 15px 55px}.profile h1{font-size:29px}.profile-top,.profile-body{padding:23px}.related-grid{grid-template-columns:1fr}}
</style>
<script type="application/ld+json">${providerJsonLd(provider, services)}</script>
</head>
<body data-generated-daily="true">
<header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/">Home</a><a href="/freelance.html">Cari Servis</a><a href="/servis/">Servis Ikut Lokasi</a><a href="/penyedia/" class="active">Penyedia</a></nav></div></header>
<main class="provider-main">
  <div class="breadcrumbs"><a href="/">RAPAT</a> › <a href="/penyedia/">Penyedia Servis</a> › ${escapeHtml(provider.display_name)}</div>
  <article class="profile">
    <div class="profile-top">
      <h1>${escapeHtml(provider.display_name)}</h1>
      <div class="location">${escapeHtml(location || 'Malaysia')}${provider.postcode ? ` · ${escapeHtml(provider.postcode)}` : ''}</div>
      <span class="rating">${escapeHtml(ratingText)}</span>
    </div>
    <div class="profile-body">
      <h2>Servis ditawarkan</h2>
      <div class="service-list">${serviceLinks || '<span>Servis akan dikemas kini.</span>'}</div>
      <div class="actions">
        ${wa ? `<a class="btn primary" href="${escapeHtml(wa)}" rel="nofollow noopener" target="_blank">WhatsApp Penyedia →</a>` : ''}
        <a class="btn light" href="${escapeHtml(liveUrl)}">Lihat carian RAPAT</a>
        ${social ? `<a class="btn light" href="${escapeHtml(social)}" rel="nofollow noopener" target="_blank">Laman / Sosial</a>` : ''}
      </div>
      <div class="note">RAPAT ialah platform direktori yang membantu pengguna menemui penyedia servis. Skop kerja, harga dan pembayaran dipersetujui terus antara pengguna dan penyedia. Semak rating dan gunakan fungsi laporan di RAPAT jika perlu.</div>
    </div>
  </article>
  ${related ? `<section class="related"><h2>Penyedia lain berdekatan</h2><div class="related-grid">${related}</div></section>` : ''}
</main>
</body>
</html>`;
}

function providerHubHtml(providers) {
  const cards = providers.map(provider => {
    const services = uniqueServices(provider);
    const ratingCount = Number(provider.rating_count || 0);
    const rating = Number(provider.average_rating || 0);
    const ratingText = ratingCount > 0 ? `${rating.toFixed(1)} ★ · ${ratingCount} rating` : 'Belum ada rating';
    return `<article class="provider-card"><a class="provider-name" href="${providerPath(provider)}">${escapeHtml(provider.display_name)}</a><div class="meta">${escapeHtml(provider.district)}, ${escapeHtml(provider.state)}${provider.postcode ? ` · ${escapeHtml(provider.postcode)}` : ''}</div><div class="services">${escapeHtml(services.slice(0, 4).join(' · ') || 'Penyedia servis')}</div><small>${escapeHtml(ratingText)}</small><a class="btn light small" href="${providerPath(provider)}">Lihat profil →</a></article>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Penyedia Servis Malaysia | Direktori RAPAT</title>
<meta name="description" content="Lihat penyedia servis aktif di RAPAT mengikut lokasi dan jenis servis. Semak profil dan hubungi penyedia terus.">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${BASE_URL}/penyedia/">
<link rel="stylesheet" href="/freelance.css">
<style>.hub{max-width:1040px;margin:auto;padding:42px 22px 70px}.hub h1{color:#0b1d42;font-size:38px}.hub>p{color:#5f6d81;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:26px}.provider-card{border:1px solid #e3e8ef;border-radius:16px;padding:18px;background:#fff}.provider-name{display:block;font-size:17px;font-weight:800;color:#0b1d42}.meta{font-size:12px;color:#6b778c;margin-top:6px}.services{font-size:12px;color:#34445f;margin:11px 0;line-height:1.5}.provider-card small{display:block;color:#7b8798;margin-bottom:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}.hub h1{font-size:31px}}</style>
</head>
<body data-generated-daily="true"><header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/">Home</a><a href="/freelance.html">Cari Servis</a><a href="/servis/">Servis Ikut Lokasi</a><a href="/penyedia/" class="active">Penyedia</a></nav></div></header><main class="hub"><h1>Penyedia servis di RAPAT</h1><p>Profil di bawah dijana daripada penyedia yang telah diluluskan dan sedang diterbitkan di RAPAT. Gunakan profil untuk semak servis, lokasi dan rating sebelum menghubungi penyedia.</p><div class="grid">${cards || '<p>Belum ada penyedia untuk dipaparkan.</p>'}</div></main></body>
</html>`;
}

async function writeFile(relative, content) {
  const target = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

async function walkHtml(dir) {
  const files = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

async function linkProviderCards(providers) {
  const files = await walkHtml(path.join(ROOT, 'servis'));
  if (!files.length) return 0;
  let changed = 0;
  for (const file of files) {
    let html = await fs.readFile(file, 'utf8');
    let next = html;
    for (const provider of providers) {
      const name = escapeHtml(provider.display_name);
      const oldMarkup = `<div class="seo-provider-name">${name}</div>`;
      const newMarkup = `<a class="seo-provider-name" href="${providerPath(provider)}">${name}</a>`;
      next = next.split(oldMarkup).join(newMarkup);
    }
    if (next !== html) {
      if (!next.includes('.seo-provider-name{text-decoration:none')) {
        next = next.replace('</style>', '.seo-provider-name{text-decoration:none}</style>');
      }
      await fs.writeFile(file, next, 'utf8');
      changed += 1;
    }
  }
  return changed;
}

async function appendProviderUrlsToSitemap(providers) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = await fs.readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/penyedia/', ...providers.map(providerPath)];
  const entries = urls
    .filter(url => !xml.includes(`<loc>${BASE_URL}${url}</loc>`))
    .map(url => `  <url><loc>${BASE_URL}${url}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  if (entries) xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  await fs.writeFile(sitemapPath, xml, 'utf8');
}

async function main() {
  const providers = await fetchProviders();
  const serviceLookup = buildServicePathLookup(providers);
  const providerRoot = path.join(ROOT, 'penyedia');
  await fs.rm(providerRoot, { recursive: true, force: true });
  await fs.mkdir(providerRoot, { recursive: true });

  for (const provider of providers) {
    const related = providers.filter(item =>
      item.provider_id !== provider.provider_id &&
      (String(item.district || '').toLowerCase() === String(provider.district || '').toLowerCase() ||
       String(item.state || '').toLowerCase() === String(provider.state || '').toLowerCase())
    );
    await writeFile(`penyedia/${providerSlug(provider)}/index.html`, providerPageHtml(provider, serviceLookup, related));
  }

  const sorted = [...providers].sort((a, b) =>
    String(a.state || '').localeCompare(String(b.state || '')) ||
    String(a.district || '').localeCompare(String(b.district || '')) ||
    String(a.display_name || '').localeCompare(String(b.display_name || ''))
  );
  await writeFile('penyedia/index.html', providerHubHtml(sorted));
  const linkedFiles = await linkProviderCards(providers);
  await appendProviderUrlsToSitemap(providers);
  console.log(`Provider SEO pages generated: ${providers.length} profiles, ${linkedFiles} service pages linked.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
