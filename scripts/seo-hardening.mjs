import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

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
    else if (entry.isFile() && entry.name === 'index.html') files.push(full);
  }
  return files;
}

function getServiceLocationMeta(html, file) {
  const breadcrumb = html.match(/<div class="seo-breadcrumbs"><a[^>]*>RAPAT<\/a>\s*›\s*<a[^>]*>Servis<\/a>\s*›\s*([^<]+?)\s*›\s*([^<]+?)<\/div>/);
  const canonical = html.match(/<link rel="canonical" href="https:\/\/rapat\.my([^"]+)">/);
  if (!breadcrumb || !canonical) return null;
  return {
    file,
    html,
    service: breadcrumb[1].trim(),
    district: breadcrumb[2].trim(),
    urlPath: canonical[1]
  };
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.urlPath)) return false;
    seen.add(item.urlPath);
    return true;
  });
}

function relatedSection(page, pages) {
  const sameDistrict = pages
    .filter(item => item.urlPath !== page.urlPath && item.district === page.district && item.service !== page.service)
    .sort((a, b) => a.service.localeCompare(b.service));

  const sameService = pages
    .filter(item => item.urlPath !== page.urlPath && item.service === page.service)
    .sort((a, b) => a.district.localeCompare(b.district));

  const related = uniqueByUrl([
    ...sameDistrict.slice(0, 4),
    ...sameService.slice(0, 4)
  ]).slice(0, 8);

  if (!related.length) return '';
  const links = related
    .map(item => `<a href="${item.urlPath}">${item.service} ${item.district}</a>`)
    .join('');

  return `<section class="seo-related"><h2>Carian servis berkaitan</h2><div class="seo-related-links">${links}</div></section>`;
}

async function hardenRelatedLinks() {
  const files = await walkHtml(path.join(ROOT, 'servis'));
  const pages = [];

  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const meta = getServiceLocationMeta(html, file);
    if (meta) pages.push(meta);
  }

  let changed = 0;
  for (const page of pages) {
    const section = relatedSection(page, pages);
    const pattern = /<section class="seo-related">[\s\S]*?<\/section>/;
    let next = page.html;

    if (pattern.test(next)) {
      next = section ? next.replace(pattern, section) : next.replace(pattern, '');
    } else if (section) {
      next = next.replace('</main>', `  ${section}\n</main>`);
    }

    if (next !== page.html) {
      await fs.writeFile(page.file, next, 'utf8');
      changed += 1;
    }
  }

  return { pages: pages.length, changed };
}

async function removeUnreliableLastmod() {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  let xml = await fs.readFile(sitemapPath, 'utf8');
  const next = xml.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  if (next !== xml) {
    await fs.writeFile(sitemapPath, next, 'utf8');
    return true;
  }
  return false;
}

async function main() {
  const related = await hardenRelatedLinks();
  const sitemapChanged = await removeUnreliableLastmod();
  console.log(`SEO hardening complete: ${related.changed}/${related.pages} service-location pages refined; sitemap lastmod stripped: ${sitemapChanged}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
