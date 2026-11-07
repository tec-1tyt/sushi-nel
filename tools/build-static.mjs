// Builds a static copy of the site for GitHub Pages into dist/. Run: npm run build:static
// GitHub Pages has no server, so forms show a "call us" message instead of sending.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.PAGES_BASE || '/sushi-nel';
process.env.NODE_ENV = 'production';
process.env.SITE_URL = process.env.PAGES_URL || `https://tec-1tyt.github.io${BASE}`;
process.env.CSRF_SECRET = 'static-build-has-no-forms-so-this-value-is-never-used';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { content } = await import('../server/content.js');
const { renderHome } = await import('../server/render/home.js');
const { renderNotFound, renderPrivacy } = await import('../server/render/privacy.js');
const { robotsTxt, sitemapXml } = await import('../server/render/seo.js');

// Root-relative addresses gain the repository prefix
const rebase = (html) => html
  .replace(/<html lang="(\w+)" class="no-js">/, '<html lang="$1" class="no-js" data-static>')
  .replace(/\b(href|src)="\/(?!\/)/g, `$1="${BASE}/`)
  .replace(/\b(srcset|imagesrcset)="([^"]*)"/g, (_, attr, value) => `${attr}="${value.replace(/\/(img)\//g, `${BASE}/$1/`)}"`);

function page(path, html) {
  const file = join(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, rebase(html));
}

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, 'public'), dist, { recursive: true });

const c = content();
page('index.html', renderHome(c, 'cs'));
page('soukromi/index.html', renderPrivacy(c, 'cs'));
for (const lang of ['uk', 'en']) {
  page(`${lang}/index.html`, renderHome(c, lang));
  page(`${lang}/soukromi/index.html`, renderPrivacy(c, lang));
}
page('404.html', renderNotFound(c, 'cs'));

writeFileSync(join(dist, 'robots.txt'), robotsTxt());
writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(c.version));
writeFileSync(join(dist, '.nojekyll'), '');
writeFileSync(join(dist, 'site.webmanifest'), JSON.stringify({
  name: c.site.name,
  short_name: c.site.name,
  start_url: `${BASE}/`,
  display: 'standalone',
  background_color: '#0b0a0a',
  theme_color: '#0b0a0a',
  icons: [{ src: `${BASE}/img/logo/icon-192.png`, sizes: '192x192', type: 'image/png' }, { src: `${BASE}/img/logo/icon-512.png`, sizes: '512x512', type: 'image/png' }],
}));

// Absolute paths inside stylesheets and scripts
const css = join(dist, 'css', 'site.css');
writeFileSync(css, readFileSync(css, 'utf8').replaceAll('url(/fonts/', 'url(../fonts/'));
const mapJs = join(dist, 'js', 'map.js');
writeFileSync(mapJs, readFileSync(mapJs, 'utf8').replaceAll("'/vendor/", `'${BASE}/vendor/`));

const size = (dir) => readdirSync(dir).reduce((sum, f) => {
  const p = join(dir, f);
  const s = statSync(p);
  return sum + (s.isDirectory() ? size(p) : s.size);
}, 0);
console.log(`dist ready: ${(size(dist) / 1e6).toFixed(1)} MB, address ${process.env.SITE_URL}/`);
