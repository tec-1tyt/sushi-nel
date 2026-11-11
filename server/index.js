// sushiNEL web server. Pages are rendered once from data/*.json and cached until a data file changes.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { apiRouter } from './api.js';
import { ROOT, config } from './config.js';
import { content, onContentChange, watchContent } from './content.js';
import { notifyConfigured } from './notify.js';
import { renderHome } from './render/home.js';
import { renderNotFound, renderPrivacy } from './render/privacy.js';
import { robotsTxt, sitemapXml } from './render/seo.js';
import { securityDirectives } from './security.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: securityDirectives() },
    strictTransportSecurity: config.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=()');
    next();
  });
  app.use(compression());

  // Rendered-page cache. In development it stays empty, so template edits show on refresh.
  const cache = new Map();
  onContentChange(() => cache.clear());
  const cached = (key, render) => {
    if (!config.isProd) return render();
    if (!cache.has(key)) cache.set(key, render());
    return cache.get(key);
  };
  const sendHtml = (res, html, status = 200) => {
    res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' }).send(html);
  };

  app.use('/api', apiRouter());

  app.get('/healthz', (_req, res) => res.json({ ok: true, notify: notifyConfigured() }));
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsTxt()));
  app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(sitemapXml(content().version)));
  app.get('/site.webmanifest', (_req, res) => res.type('application/manifest+json').json({
    name: content().site.name,
    short_name: content().site.name,
    start_url: '/',
    display: 'standalone',
    background_color: '#fbeef1',
    theme_color: '#fbeef1',
    icons: [{ src: '/img/logo/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/logo/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }));

  app.get('/', (_req, res) => sendHtml(res, cached('home:cs', () => renderHome(content(), 'cs'))));
  for (const lang of ['uk', 'en']) {
    // Express matches /uk and /uk/ with one route. The trailing-slash form is the canonical one.
    app.get(`/${lang}`, (req, res) => {
      if (!req.path.endsWith('/')) return res.redirect(301, `/${lang}/`);
      return sendHtml(res, cached(`home:${lang}`, () => renderHome(content(), lang)));
    });
  }
  app.get('/soukromi', (_req, res) => sendHtml(res, cached('privacy:cs', () => renderPrivacy(content(), 'cs'))));
  app.get('/uk/soukromi', (_req, res) => sendHtml(res, cached('privacy:uk', () => renderPrivacy(content(), 'uk'))));
  app.get('/en/soukromi', (_req, res) => sendHtml(res, cached('privacy:en', () => renderPrivacy(content(), 'en'))));

  app.use(express.static(join(ROOT, 'public'), {
    index: false,
    dotfiles: 'ignore',
    setHeaders(res, path, stat) {
      void stat;
      const versioned = res.req?.query?.v;
      if (versioned) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else if (/\.(avif|webp|jpg|png|woff2)$/.test(path)) res.setHeader('Cache-Control', 'public, max-age=2592000');
      else res.setHeader('Cache-Control', 'public, max-age=3600');
    },
  }));

  app.use((req, res) => {
    const lang = req.path.startsWith('/uk') ? 'uk' : req.path.startsWith('/en') ? 'en' : 'cs';
    sendHtml(res, renderNotFound(content(), lang), 404);
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[server]', err.message);
    res.status(500).type('text/plain').send('Something went wrong. Please call +420 770 699 364.');
  });
  return app;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  watchContent();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`sushiNEL running on http://localhost:${config.port}`);
    if (!notifyConfigured()) {
      console.warn(config.isProd
        ? 'WARNING: no Telegram or SMTP settings. Orders will be refused until you set them in .env.'
        : '[dev] no Telegram or SMTP settings. Submissions are printed here instead of being sent.');
    }
  });
}
