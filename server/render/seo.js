// schema.org data, robots and sitemap.
import { config } from '../config.js';
import { livePromotions } from '../content.js';

const DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export const langPath = (lang) => (lang === 'cs' ? '/' : `/${lang}/`);

export function jsonLd(c, lang) {
  const { site, menu, promos } = c;
  const url = config.siteUrl;
  const pageUrl = `${url}${langPath(lang)}`;
  const openingHoursSpecification = Object.entries(site.hours)
    .filter(([, v]) => v)
    .map(([d, v]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY[d], opens: v[0], closes: v[1] }));

  const offer = (price) => ({ '@type': 'Offer', price, priceCurrency: 'CZK' });
  const hasMenuSection = menu.categories
    .filter((cat) => !['poukazy', 'omacky'].includes(cat.id))
    .map((cat) => ({
      '@type': 'MenuSection',
      name: cat.name[lang],
      hasMenuItem: cat.items.map((d) => ({
        '@type': 'MenuItem',
        name: d.name[lang],
        ...(d.desc?.[lang] ? { description: d.desc[lang] } : {}),
        offers: d.variants ? d.variants.map((v) => ({ ...offer(v.price), name: v.label[lang] })) : offer(d.price),
      })),
    }));

  const restaurant = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${url}/#restaurant`,
    name: site.name,
    url: pageUrl,
    image: `${url}/img/og.jpg`,
    logo: `${url}/img/logo/logo-512.png`,
    telephone: site.phone,
    ...(site.email ? { email: site.email } : {}),
    servesCuisine: ['Sushi', 'Japanese', 'Poke'],
    priceRange: '100-2250 Kč',
    currenciesAccepted: 'CZK',
    acceptsReservations: true,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      postalCode: site.address.zip,
      addressLocality: site.address.city,
      addressCountry: site.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    openingHoursSpecification,
    sameAs: [site.socials.instagram, site.socials.threads].filter(Boolean),
    potentialAction: site.ordering.menuforma
      ? { '@type': 'OrderAction', target: site.ordering.menuforma, deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet' }
      : undefined,
    hasMenu: { '@type': 'Menu', name: `${site.name} menu`, inLanguage: lang, hasMenuSection },
  };
  const active = livePromotions(promos.promotions).filter((p) => !p.placeholder);
  if (active.length) {
    restaurant.makesOffer = active.map((p) => ({ '@type': 'Offer', name: p.title[lang], description: p.text[lang] || undefined }));
  }
  // Prevent "</script>" inside JSON from closing the tag
  return JSON.stringify(restaurant).replace(/</g, '\\u003c');
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
}

export function sitemapXml(lastmod) {
  const date = new Date(lastmod).toISOString().slice(0, 10);
  const langs = ['cs', 'uk', 'en'];
  const entry = (path, priority) => langs.map((l) => {
    const p = `${l === 'cs' ? '' : `/${l}`}${path}`;
    const alts = langs.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${config.siteUrl}${a === 'cs' ? '' : `/${a}`}${path}"/>`).join('');
    return `<url><loc>${config.siteUrl}${p || '/'}</loc><lastmod>${date}</lastmod><priority>${priority}</priority>${alts}</url>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entry('/', '1.0')}${entry('/soukromi', '0.2')}</urlset>\n`;
}
