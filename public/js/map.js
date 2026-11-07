// Interactive dark map. Nothing is requested from OpenStreetMap until the visitor clicks or has allowed the map.
import { getConsent, onConsent } from './consent.js';

let loading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/vendor/leaflet.css';
      document.head.append(css);
      const s = document.createElement('script');
      s.src = '/vendor/leaflet.js';
      s.onload = res;
      s.onerror = rej;
      document.head.append(s);
    });
  }
  return loading;
}

export function initMap({ data }) {
  const box = document.querySelector('[data-map]');
  if (!box) return;
  const canvas = box.querySelector('[data-map-canvas]');
  const poster = box.querySelector('[data-map-poster]');
  const btn = box.querySelector('[data-map-load]');
  let started = false;

  async function start() {
    if (started) return;
    started = true;
    try {
      await loadLeaflet();
      const L = window.L;
      const map = L.map(canvas, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([data.geo.lat, data.geo.lng], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({ className: 'sn-marker', html: '<span aria-hidden="true">桜</span>', iconSize: [40, 40], iconAnchor: [20, 20] });
      L.marker([data.geo.lat, data.geo.lng], { icon, title: data.placeName, alt: data.placeName }).addTo(map);
      poster.hidden = true;
    } catch {
      started = false;
    }
  }

  btn?.addEventListener('click', start);

  // With consent, load only as the section comes near, to keep the first page load light
  const whenNear = () => {
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); start(); }
    }, { rootMargin: '400px' });
    io.observe(box);
  };
  if (getConsent() === 'map') whenNear();
  onConsent((v) => { if (v === 'map') whenNear(); });
}
