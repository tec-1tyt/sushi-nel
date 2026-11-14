// Privacy policy. The operator's legal details come from data/site.json. Have a lawyer read this before launch.
import { page } from './layout.js';
import { esc, placeholder } from './util.js';

const COPY = {
  cs: {
    title: 'Zásady ochrany soukromí',
    updated: 'Platné od',
    missing: 'název firmy, IČO, sídlo, e-mail',
    sections: [
      ['Kdo vaše údaje zpracovává', 'Správcem osobních údajů je provozovatel podniku sushiNEL:'],
      ['Jaké údaje a proč', 'Kontaktní formulář: jméno, telefon nebo e-mail, zpráva. Slouží k odpovědi (oprávněný zájem, písm. f).\nTechnické údaje: IP adresa se krátce drží v paměti serveru kvůli ochraně proti spamu a přetížení (oprávněný zájem, písm. f).'],
      ['Komu údaje předáváme', 'Údaje z formulářů dorazí provozovateli přes Telegram nebo e-mail a zpracovává je poskytovatel hostingu webu. Pokud přes MenuForma, Instagram nebo jinou službu objednáte přímo, platí zásady dané služby. Údaje neprodáváme.'],
      ['Jak dlouho', 'Zprávy uchováváme nejdéle 12 měsíců.'],
      ['Vaše práva', 'Máte právo na přístup k údajům, opravu, výmaz, omezení zpracování, přenositelnost a námitku. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (uoou.gov.cz).'],
    ],
    cookiesTitle: 'Cookies a úložiště prohlížeče',
    cookies: [
      ['Bezpečnostní cookie formulářů', 'Nutná. Chrání formuláře před zneužitím. Platnost 12 hodin. Neslouží ke sledování.'],
      ['Volba cookies (localStorage)', 'Pamatuje si, zda jste povolili mapu.'],
      ['Mapa OpenStreetMap', 'Volitelná. Po povolení nebo kliknutí se dlaždice mapy načítají ze serverů OpenStreetMap, které tak vidí vaši IP adresu.'],
    ],
    noTrack: 'Web nepoužívá analytické ani reklamní cookies.',
    back: 'Zpět na úvod',
  },
  uk: {
    title: 'Політика конфіденційності',
    updated: 'Чинна від',
    missing: 'назва фірми, IČO, адреса, e-mail',
    sections: [
      ['Хто обробляє ваші дані', 'Адміністратором персональних даних є оператор закладу sushiNEL:'],
      ['Які дані й навіщо', 'Форма контакту: ім\'я, телефон або e-mail, повідомлення. Потрібні, щоб відповісти (законний інтерес, п. f).\nТехнічні дані: IP-адреса коротко зберігається в пам\'яті сервера для захисту від спаму й перевантаження (законний інтерес, п. f).'],
      ['Кому передаємо дані', 'Дані з форм надходять оператору через Telegram або e-mail і обробляються хостинг-провайдером сайту. Якщо ви замовляєте напряму через MenuForma, Instagram чи інший сервіс, діють правила цього сервісу. Дані не продаємо.'],
      ['Як довго', 'Повідомлення зберігаємо не довше 12 місяців.'],
      ['Ваші права', 'Ви маєте право на доступ до даних, виправлення, видалення, обмеження обробки, перенесення й заперечення. Скаргу можна подати до чеського Управління із захисту персональних даних (uoou.gov.cz).'],
    ],
    cookiesTitle: 'Cookies і сховище браузера',
    cookies: [
      ['Безпековий cookie форм', 'Необхідний. Захищає форми від зловживань. Діє 12 годин. Не використовується для стеження.'],
      ['Вибір cookies (localStorage)', 'Пам\'ятає, чи дозволили ви карту.'],
      ['Карта OpenStreetMap', 'За бажанням. Після дозволу або кліку фрагменти карти завантажуються із серверів OpenStreetMap, які бачать вашу IP-адресу.'],
    ],
    noTrack: 'Сайт не використовує аналітичних і рекламних cookies.',
    back: 'На головну',
  },
  en: {
    title: 'Privacy policy',
    updated: 'Effective from',
    missing: 'company name, IČO, registered address, e-mail',
    sections: [
      ['Who processes your data', 'The data controller is the operator of sushiNEL:'],
      ['What data and why', 'Contact form: name, phone or e-mail, message. Used to reply to you (legitimate interest, point f).\nTechnical data: your IP address is held briefly in server memory to protect against spam and overload (legitimate interest, point f).'],
      ['Who receives your data', 'Form data reaches the operator through Telegram or e-mail, and is processed by the website hosting provider. If you order directly through MenuForma, Instagram or another service, that service\'s policy applies. We do not sell data.'],
      ['How long we keep it', 'Messages are kept for 12 months at most.'],
      ['Your rights', 'You have the right to access, correct, erase, restrict and port your data, and to object. You can complain to the Czech Office for Personal Data Protection (uoou.gov.cz).'],
    ],
    cookiesTitle: 'Cookies and browser storage',
    cookies: [
      ['Form security cookie', 'Necessary. Protects forms from abuse. Lasts 12 hours. Not used for tracking.'],
      ['Cookie choice (localStorage)', 'Remembers whether you allowed the map.'],
      ['OpenStreetMap map', 'Optional. Once allowed or clicked, map tiles load from OpenStreetMap servers, which see your IP address.'],
    ],
    noTrack: 'This site uses no analytics or advertising cookies.',
    back: 'Back to the start',
  },
};

export function renderPrivacy(c, lang) {
  const t = c.i18n[lang];
  const p = COPY[lang];
  const s = c.site;
  const controller = s.legal.company
    ? `<p>${esc(s.legal.company)}${s.legal.ico ? `, IČO ${esc(s.legal.ico)}` : ''}${s.legal.seat ? `, ${esc(s.legal.seat)}` : ''}${s.email ? `, ${esc(s.email)}` : ''}</p>`
    : `<p>${placeholder(p.missing)}</p>`;
  const sections = p.sections.map(([h, text], i) => `<h2>${esc(h)}</h2>${text.split('\n').map((x) => `<p>${esc(x)}</p>`).join('')}${i === 0 ? `${controller}<p>${esc(s.address.street)}, ${esc(s.address.zip)} ${esc(s.address.city)}, ${esc(s.phoneDisplay)}</p>` : ''}`).join('');
  const body = `<article class="legal">
  <h1 class="h-sec">${esc(p.title)}</h1>
  ${sections}
  <h2 id="cookies">${esc(p.cookiesTitle)}</h2>
  <dl>${p.cookies.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  <p>${esc(p.noTrack)}</p>
  <p><a class="tlink tlink--light" href="${lang === 'cs' ? '/' : `/${lang}/`}">${esc(p.back)}</a></p>
</article>`;
  return page({ lang, c, t, title: `${p.title} · ${s.name}`, description: `${p.title}. ${s.name}, ${s.address.street}, ${s.address.zip} ${s.address.city}.`, path: '/soukromi', body });
}

export function renderNotFound(c, lang) {
  const t = c.i18n[lang];
  const body = `<article class="legal legal--404"><h1 class="h-sec">${esc(t.notFound.title)}</h1><p>${esc(t.notFound.text)}</p><p><a class="tlink tlink--light" href="${lang === 'cs' ? '/' : `/${lang}/`}">${esc(t.notFound.cta)}</a></p></article>`;
  return page({ lang, c, t, title: `${t.notFound.title} · ${c.site.name}`, description: t.notFound.text, path: '/', body, noindex: true });
}
