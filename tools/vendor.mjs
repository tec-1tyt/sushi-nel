// Copies front-end libraries out of node_modules into public/, so the site never depends on a CDN.
// Run after updating a dev dependency: npm run vendor
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public');
const cp = (from, to) => {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  copyFileSync(join(nm, from), join(out, to));
  console.log('copied', to);
};

cp('gsap/dist/gsap.min.js', 'vendor/gsap.min.js');
cp('lenis/dist/lenis.min.js', 'vendor/lenis.min.js');
cp('leaflet/dist/leaflet.js', 'vendor/leaflet.js');
cp('leaflet/dist/leaflet.css', 'vendor/leaflet.css');
