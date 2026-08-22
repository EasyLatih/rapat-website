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
    .replace(/^-+|-+$/g, '') || 'kategori';
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
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_service_id: null,
      p_custom_service: null,
      p_state: null,
      p_district: null,
      p_postcode: null
    })
  });
  if (!response.ok) throw new Error(`Supabase category SEO fetch gagal: ${response.status} ${await response.text()}`);
  return await response.json();
}

function buildCategories(providers) {
  const categories = new Map();

  for (const provider of providers || []) {
    const providerId = String(provider.provider_id || provider.id || provider.display_name || 'provider');
    const seen = new Set();

    for (const service of Array.isArray(provider.services) ? provider.services : []) {
      const category = String(service?.category || '').trim();
      const serviceName = String(service?.name || '').trim();
      if (!category || !serviceName || category.toLowerCase() === 'lain-lain') continue;

      const pairKey = `${category.toLowerCase()}|${serviceName.toLowerCase()}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      if (!categories.has(category)) {
        categories.set(category, {
          name: category,
          slug: slugify(category),
          providers: new Set(),
          services: new Map()
        });
      }

      const cat = categories.get(category);
      cat.providers.add(providerId);
      if (!cat.services.has(serviceName)) {
        cat.services.set(serviceName, { name: serviceName, slug: slugify(serviceName), providers: new Set() });
      }
      cat.services.get(serviceName).providers.add(providerId);
    }
  }

  return [...categories.values()]
    .map(cat => ({
      ...cat,
      providerCount: cat.providers.size,
      services: [...cat.services.values()]
        .map(service => ({ ...service, providerCount: service.providers.size }))
        .sort((a, b) => b.providerCount - a.providerCount || a.name.localeCompare(b.name, 'ms'))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'));
}

function categoryJsonLd(category) {
  const url = `${BASE_URL}/kategori/${category.slug}/`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: `${category.name} | RAPAT`,
        description: `Cari servis dalam kategori ${category.name} di Malaysia melalui RAPAT.`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'RAPAT', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Kategori Servis', item: `${BASE_URL}/kategori/` },
          { '@type': 'ListItem', position: 3, name: category.name, item: url }
        ]
      },
      {
        '@type': 'ItemList',
        itemListElement: category.services.map((service, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: service.name,
          url: `${BASE_URL}/servis/${service.slug}/`
        }))
      }
    ]
  }).replace(/</g, '\\u003c');
}

function categoryPage(category) {
  const title = `${category.name} | Cari Servis di Malaysia - RAPAT`;
  const description = `Cari penyedia ${category.name} di Malaysia. Semak ${category.services.length} jenis servis dan ${category.providerCount} penyedia aktif melalui RAPAT.`;
  const serviceCards = category.services.map(service => `<article class="category-card">
    <h2>${escapeHtml(service.name)}</h2>
    <p>${service.providerCount} penyedia aktif</p>
    <a href="/servis/${service.slug}/">Cari ${escapeHtml(service.name)} →</a>
  </article>`).join('\n');

  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${BASE_URL}/kategori/${category.slug}/">
<link rel="stylesheet" href="/freelance.css">
<style>
.category-main{max-width:1040px;margin:auto;padding:42px 22px 70px}.breadcrumbs{font-size:12px;color:#6b778c;margin-bottom:22px}.breadcrumbs a{color:#315f9d}.hero{background:linear-gradient(135deg,#f4efff,#fff);border:1px solid #e7def8;border-radius:22px;padding:32px}.hero h1{margin:0 0 12px;color:#32146f;font-size:38px;line-height:1.15}.hero p{margin:0;color:#5d5870;line-height:1.7;max-width:760px}.stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.stats span{background:#efe7ff;color:#5e2ca5;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:26px}.category-card{border:1px solid #e4e1eb;border-radius:16px;background:#fff;padding:20px}.category-card h2{font-size:17px;color:#21123f;margin:0 0 8px}.category-card p{font-size:12px;color:#737080;margin:0 0 14px}.category-card a{font-size:13px;font-weight:800;color:#6339c7}.cta{margin-top:30px;padding:24px;border-radius:18px;background:#f7f5fb}.cta h2{margin:0 0 8px;color:#21123f}.cta p{margin:0 0 16px;color:#666173;line-height:1.6}@media(max-width:700px){.grid{grid-template-columns:1fr}.hero h1{font-size:31px}.hero{padding:24px}.category-main{padding:30px 16px 55px}}
</style>
<script type="application/ld+json">${categoryJsonLd(category)}</script>
</head>
<body>
<header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/freelance.html">Cari Servis</a><a href="/kategori/" class="active">Kategori</a><a href="/freelance-provider.html">Daftar Servis</a></nav></div></header>
<main class="category-main">
  <div class="breadcrumbs"><a href="/">RAPAT</a> › <a href="/kategori/">Kategori Servis</a> › ${escapeHtml(category.name)}</div>
  <section class="hero">
    <h1>${escapeHtml(category.name)}</h1>
    <p>${escapeHtml(description)} Pilih jenis servis di bawah untuk melihat penyedia mengikut lokasi.</p>
    <div class="stats"><span>${category.services.length} jenis servis</span><span>${category.providerCount} penyedia aktif</span></div>
  </section>
  <section class="grid">${serviceCards}</section>
  <section class="cta"><h2>Ada servis dalam kategori ini?</h2><p>Daftar listing anda di RAPAT supaya pengguna boleh menemui servis anda melalui carian servis dan lokasi.</p><a class="btn primary" href="/freelance-provider.html">Daftar Servis Anda</a></section>
</main>
</body>
</html>`;
}

function hubPage(categories) {
  const cards = categories.map(category => `<article class="category-card">
    <h2>${escapeHtml(category.name)}</h2>
    <p>${category.services.length} jenis servis · ${category.providerCount} penyedia aktif</p>
    <a href="/kategori/${category.slug}/">Lihat kategori →</a>
  </article>`).join('\n');
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kategori Servis Malaysia | RAPAT</title><meta name="description" content="Terokai kategori servis di Malaysia dan cari penyedia tempatan melalui RAPAT."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${BASE_URL}/kategori/"><link rel="stylesheet" href="/freelance.css"><style>.category-main{max-width:1040px;margin:auto;padding:42px 22px 70px}.category-main h1{color:#32146f;font-size:38px}.category-main>p{color:#666173;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:26px}.category-card{border:1px solid #e4e1eb;border-radius:16px;background:#fff;padding:20px}.category-card h2{font-size:17px;color:#21123f;margin:0 0 8px}.category-card p{font-size:12px;color:#737080;margin:0 0 14px}.category-card a{font-size:13px;font-weight:800;color:#6339c7}@media(max-width:700px){.grid{grid-template-columns:1fr}.category-main h1{font-size:31px}.category-main{padding:30px 16px 55px}}</style></head><body><header class="gig-header"><div class="gig-nav"><a class="gig-brand" href="/">RA<span class="r">P</span><span class="y">A</span>T</a><nav class="gig-links"><a href="/freelance.html">Cari Servis</a><a href="/kategori/" class="active">Kategori</a><a href="/freelance-provider.html">Daftar Servis</a></nav></div></header><main class="category-main"><h1>Kategori servis di RAPAT</h1><p>Pilih kategori untuk melihat jenis servis yang tersedia dan cari penyedia mengikut lokasi di Malaysia.</p><section class="grid">${cards}</section></main></body></html>`;
}

async function writeFile(relative, content) {
  const target = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

async function updateSitemap(categories) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = await fs.readFile(sitemapPath, 'utf8');
  xml = xml.replace(/\s*<url><loc>https:\/\/rapat\.my\/kategori\/[^<]*<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?<\/url>\n?/g, '');
  const urls = ['/kategori/', ...categories.map(category => `/kategori/${category.slug}/`)];
  const entries = urls.map(url => `  <url><loc>${BASE_URL}${url}</loc></url>`).join('\n');
  xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  await fs.writeFile(sitemapPath, xml, 'utf8');
}

async function main() {
  const providers = await fetchProviders();
  const categories = buildCategories(providers);
  const categoryRoot = path.join(ROOT, 'kategori');
  await fs.rm(categoryRoot, { recursive: true, force: true });
  await fs.mkdir(categoryRoot, { recursive: true });

  for (const category of categories) {
    await writeFile(`kategori/${category.slug}/index.html`, categoryPage(category));
  }
  await writeFile('kategori/index.html', hubPage(categories));
  await updateSitemap(categories);
  console.log(`Category SEO pages generated: ${categories.length} categories from ${providers.length} live providers.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
