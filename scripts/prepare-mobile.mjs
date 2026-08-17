import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const dist = join(root, 'dist');
const allowedExtensions = new Set(['.html','.js','.css','.svg','.png','.jpg','.jpeg','.webp','.txt','.xml','.ico']);
const excludedTopLevel = new Set(['.git','.github','node_modules','dist','android','ios','mobile','scripts']);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

async function copyTree(srcDir, dstDir, topLevel = false) {
  await mkdir(dstDir, { recursive: true });
  for (const entry of await readdir(srcDir, { withFileTypes: true })) {
    if (topLevel && excludedTopLevel.has(entry.name)) continue;
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(src, dst, false);
      continue;
    }
    if (!allowedExtensions.has(extname(entry.name).toLowerCase())) continue;
    await cp(src, dst);
  }
}

await copyTree(root, dist, true);
await cp(join(root, 'mobile', 'mobile-native.css'), join(dist, 'mobile-native.css'));

execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'esbuild',
  'mobile/mobile-runtime.entry.js',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--outfile=dist/mobile-runtime.js'
], { stdio: 'inherit' });

const appPages = ['index.html','freelance.html','freelance-provider.html','events-live.html'];
for (const page of appPages) {
  const file = join(dist, page);
  let html;
  try { html = await readFile(file, 'utf8'); } catch { continue; }
  if (!html.includes('mobile-native.css')) {
    html = html.replace('</head>', '<link rel="stylesheet" href="mobile-native.css">\n</head>');
  }
  if (!html.includes('mobile-runtime.js')) {
    html = html.replace('</body>', '<script src="mobile-runtime.js"></script>\n</body>');
  }
  await writeFile(file, html, 'utf8');
}

console.log(`Prepared Capacitor web bundle at ${relative(root, dist)}/`);
