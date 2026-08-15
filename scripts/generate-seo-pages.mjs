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
    .replace(/^-+|-+$/g, '') || 'servis';
}

function queryUrl(service, state, district) {
  const params = new URLSearchParams({ q: service, state, district });
  return `/freelance.html?${params.toString()}`;
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
  if (!response.ok) throw new Error(`Supabase SEO fetch gagal: ${response.status} ${await response.text()}`);
  return await response.json();
}

function buildGroups(providers) {
  const groups = new Map();
  for (const provider of providers || []) {
    const district = String(provider.district || '').trim();
    const state = String(provider.state || '').trim();
    if (!district || !state) continue;

    for (const service of Array.isArray(provider.services) ? provider.services : []) {
      const serviceName = String(service?.name || '').trim();
      if (!serviceName) continue;
      const key = `${serviceName.toLowerCase()}|${district.toLowerCase()}|${state.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { service: serviceName, district, state, providers: [] });
      groups.get(key).providers.push(provider);
    }
  }

  const list = [...groups.values()];
  const pathCounts = new Map();
  for (const group of list) {
    const base = `${slugify(group.service)}/${slugify(group.district)}`;
    pathCounts.set(base, (pathCounts.get(base) || 0) + 1);
  }
  for (const group of list) {
    const serviceSlug = slugify(group.service);
    const districtSlug = slugify(group.district);
    const base = `${serviceSlug}/${districtSlug}`;
    group.serviceSlug = serviceSlug;
    group.locationSlug = pathCounts.get(base) > 1 ? `${districtSlug}-${slugify(group.state)}` : districtSlug;
    group.urlPath = `/servis/${group.serviceSlug}/${group.locationSlug}/`;
  }
  return list.sort((a, b) => a.state.localeCompare(b.state) || a.district.localeCompare(b.district) || a.service.localeCompare(b.service));
}

function jsonLd(group) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${BASE_URL}${group.urlPath}#webpage`,
        url: `${BASE_URL}${group.urlPath}`,
        name: `${group.service} ${group.district} | RAPAT`,
        description: `Cari ${group.service} di ${group.district}, ${group.state}. Semak penyedia servis lokal dan hubungi terus melalui RAPAT.`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'RAPAT', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Servis Mengikut Lokasi', item: `${BASE_URL}/servis/` },
          { '@type': 'ListItem', position: 3, name: group.service, item: `${BASE_URL}/servis/${group.serviceSlug}/` },
          { '@type': 'ListItem', position: 4, name: group.district, item: `${BASE_URL}${group.urlPath}` }
        ]
      }
    ]
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function pageHtml(group, relatedGroups) {
  const title = `${group.service} ${group.district} | Cari Penyedia Servis - RAPAT`;
  const description = `Cari ${group.service} di ${group.district}, ${group.state}. ${group.providers.length} penyedia servis disenaraikan di RAPAT. Semak pilihan dan hubungi penyedia terus melalui WhatsApp.`;
  const liveUrl = queryUrl(group.service, group.state, group.district);
  const providerCards = group.providers.map(provider => {
    const allServices = (Array.isArray(provider.services) ? provider.services : []).map(s => escapeHtml(s.name)).join(' · ');
    return `<article class="seo-provider-card">
      <div class="seo-provider-name">${escapeHtml(provider.display_name)}</div>
      <div class="seo-provider-meta">${escapeHtml(group.district)}, ${escapeHtml(group.state)}${provider.postcode ? ` · ${escapeHtml(provider.postcode)}` : ''}</div>
      <div class="seo-provider-services">${allServices || escapeHtml(group.service)}</div>
      <a class="btn light small" href="${escapeHtml(liveUrl)}">Semak di RAPAT →</a>
    </article>`;
  }).join('\n');

  const related = relatedGroups.slice(0, 8).map(item => `<a href="${item.urlPath}">${escapeHtml(item.service)} ${escapeHtml(item.district)}</a>`).join('');

  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${BASE_URL}${group.urlPath}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/freelance.css">
<style>
.seo-main{max-width:1040px;margin:0 auto;padding:42px 22px 70px}.seo-breadcrumbs{font-size:12px;color:#6b778c;margin-bottom:22px}.seo-breadcrumbs a{color:#315f9d}.seo-hero{background:linear-gradient(135deg,#f5f9ff,#fff);border:1px solid #e5eaf1;border-radius:22px;padding:32px;margin-bottom:26px}.seo-hero h1{margin:0 0 12px;color:#09265e;font-size:38px;line-height:1.12}.seo-hero p{margin:0;color:#56647a;line-height:1.7;max-width:780px}.seo-count{display:inline-block;margin-top:17px;background:#eaf3ff;color:#0f5cc8;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800}.seo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.seo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.seo-provider-card{border:1px solid #e3e8ef;border-radius:16px;padding:20px;background:#fff}.seo-provider-name{font-size:17px;font-weight:800;color:#0b1d42}.seo-provider-meta{font-size:12px;color:#6b778c;margin-top:6px}.seo-provider-services{font-size:12px;color:#34445f;margin:13px 0;line-height:1.55}.seo-info{margin:30px 0;padding:24px;border-radius:18px;background:#f7f9fc}.seo-info h2,.seo-related h2{margin:0 0 10px;color:#0b1d42;font-size:22px}.seo-info p{margin:0;color:#5f6d81;line-height:1.7;font-size:14px}.seo-related{margin-top:28px}.seo-related-links{display:flex;gap:9px;flex-wrap:wrap}.seo-related-links a{padding:9px 11px;border-radius:999px;background:#f1f4f8;color:#30435f;font-size:12px;font-weight:700}@media(max-width:700px){.seo-hero h1{font-size:31px}.seo-grid{grid-template-columns:1fr}.seo-hero{padding:24px}.seo-main{padding:30px 16px 55px}}
</style>
<script type="application/ld+json">${jsonLd(group)}</script>
</head>
<body>
<header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/">Home</a><a href="/freelance.html">Cari Servis</a><a href="/freelance-provider.html">Daftar Servis</a><a href="/servis/" class="active">Servis Ikut Lokasi</a></nav></div></header>
<main class="seo-main">
  <div class="seo-breadcrumbs"><a href="/">RAPAT</a> › <a href="/servis/">Servis</a> › ${escapeHtml(group.service)} › ${escapeHtml(group.district)}</div>
  <section class="seo-hero">
    <h1>Cari ${escapeHtml(group.service)} di ${escapeHtml(group.district)}</h1>
    <p>Perlukan ${escapeHtml(group.service)} sekitar ${escapeHtml(group.district)}, ${escapeHtml(group.state)}? RAPAT membantu anda menemui penyedia servis lokal berdasarkan kawasan. Semak pilihan di bawah dan teruskan ke carian live RAPAT untuk hubungi penyedia melalui WhatsApp.</p>
    <span class="seo-count">${group.providers.length} penyedia servis disenaraikan</span>
    <div class="seo-actions"><a class="btn primary" href="${escapeHtml(liveUrl)}">Lihat Carian Live →</a><a class="btn light" href="/freelance-provider.html">Daftar Servis Anda</a></div>
  </section>
  <section>
    <div class="results-head"><span>Penyedia ${escapeHtml(group.service)} sekitar ${escapeHtml(group.district)}</span></div>
    <div class="seo-grid">${providerCards}</div>
  </section>
  <section class="seo-info">
    <h2>Cara cari penyedia servis di RAPAT</h2>
    <p>Gunakan servis dan lokasi sebagai penapis, semak profil penyedia yang tersedia, kemudian hubungi mereka terus. RAPAT tidak mengendalikan bayaran atau transaksi; skop kerja, harga dan pembayaran dipersetujui terus antara pelanggan dan penyedia servis.</p>
  </section>
  ${related ? `<section class="seo-related"><h2>Carian servis berkaitan</h2><div class="seo-related-links">${related}</div></section>` : ''}
</main>
</body>
</html>`;
}

function serviceIndexHtml(service, groups) {
  const serviceSlug = slugify(service);
  const links = groups.map(g => `<article class="seo-provider-card"><div class="seo-provider-name">${escapeHtml(service)} di ${escapeHtml(g.district)}</div><div class="seo-provider-meta">${escapeHtml(g.state)} · ${g.providers.length} penyedia</div><a class="btn light small" href="${g.urlPath}">Lihat →</a></article>`).join('\n');
  const description = `Cari ${service} mengikut lokasi di Malaysia melalui RAPAT.`;
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(service)} Mengikut Lokasi | RAPAT</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${BASE_URL}/servis/${serviceSlug}/"><link rel="stylesheet" href="/freelance.css"><style>.seo-main{max-width:1040px;margin:auto;padding:42px 22px}.seo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.seo-provider-card{border:1px solid #e3e8ef;border-radius:16px;padding:20px;background:#fff}.seo-provider-name{font-size:17px;font-weight:800;color:#0b1d42}.seo-provider-meta{font-size:12px;color:#6b778c;margin:7px 0 14px}@media(max-width:700px){.seo-grid{grid-template-columns:1fr}}</style></head><body><header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/freelance.html">Cari Servis</a><a class="active" href="/servis/">Servis Ikut Lokasi</a></nav></div></header><main class="seo-main"><p><a href="/servis/">← Semua servis</a></p><h1>${escapeHtml(service)} mengikut lokasi</h1><p>${escapeHtml(description)}</p><div class="seo-grid">${links}</div></main></body></html>`;
}

function hubHtml(groups) {
  const byState = new Map();
  for (const group of groups) {
    if (!byState.has(group.state)) byState.set(group.state, []);
    byState.get(group.state).push(group);
  }
  const sections = [...byState.entries()].map(([state, items]) => `<section class="hub-state"><h2>${escapeHtml(state)}</h2><div class="hub-links">${items.map(g => `<a href="${g.urlPath}">${escapeHtml(g.service)} — ${escapeHtml(g.district)} <small>${g.providers.length} penyedia</small></a>`).join('')}</div></section>`).join('\n');
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cari Servis Mengikut Lokasi Malaysia | RAPAT</title><meta name="description" content="Cari penyedia servis lokal mengikut servis dan lokasi di seluruh Malaysia melalui RAPAT."><link rel="canonical" href="${BASE_URL}/servis/"><link rel="stylesheet" href="/freelance.css"><style>.hub{max-width:1040px;margin:auto;padding:42px 22px 70px}.hub h1{color:#0b1d42;font-size:38px}.hub>p{color:#5f6d81;line-height:1.7}.hub-state{margin-top:30px}.hub-state h2{color:#0b1d42}.hub-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hub-links a{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid #e3e8ef;border-radius:13px;background:#fff;color:#28405f;font-weight:700}.hub-links small{color:#778398;font-weight:600}@media(max-width:700px){.hub-links{grid-template-columns:1fr}.hub h1{font-size:31px}}</style></head><body><header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/">Home</a><a href="/freelance.html">Cari Servis</a><a href="/freelance-provider.html">Daftar Servis</a><a class="active" href="/servis/">Servis Ikut Lokasi</a></nav></div></header><main class="hub"><h1>Cari servis lokal mengikut lokasi</h1><p>Halaman ini dibina daripada penyedia servis yang benar-benar aktif di RAPAT. Bila penyedia baharu diluluskan di sesuatu kawasan, carian servis × lokasi akan ditambah secara automatik.</p>${sections || '<p>Belum ada servis untuk dipaparkan.</p>'}</main></body></html>`;
}

function sitemapXml(groups) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    '/', '/freelance.html', '/freelance-provider.html', '/events-live.html', '/servis/',
    ...[...new Set(groups.map(g => `/servis/${g.serviceSlug}/`))],
    ...groups.map(g => g.urlPath)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${BASE_URL}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}

async function writeFile(relative, content) {
  const target = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

async function main() {
  const providers = await fetchProviders();
  const groups = buildGroups(providers);
  const serviceRoot = path.join(ROOT, 'servis');
  await fs.rm(serviceRoot, { recursive: true, force: true });
  await fs.mkdir(serviceRoot, { recursive: true });

  for (const group of groups) {
    const related = groups.filter(item => item !== group && (item.state === group.state || item.service === group.service));
    await writeFile(`servis/${group.serviceSlug}/${group.locationSlug}/index.html`, pageHtml(group, related));
  }

  const byService = new Map();
  for (const group of groups) {
    if (!byService.has(group.service)) byService.set(group.service, []);
    byService.get(group.service).push(group);
  }
  for (const [service, serviceGroups] of byService) {
    await writeFile(`servis/${slugify(service)}/index.html`, serviceIndexHtml(service, serviceGroups));
  }

  await writeFile('servis/index.html', hubHtml(groups));
  await writeFile('sitemap.xml', sitemapXml(groups));
  console.log(`SEO pages generated: ${groups.length} service-location pages, ${byService.size} service hubs, ${providers.length} live providers.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
