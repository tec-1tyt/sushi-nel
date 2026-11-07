// "Open until 22:00" computed in Prague time, wherever the visitor is.
const ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function pragueNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { day: SHORT[get('weekday')], time: `${get('hour')}:${get('minute')}` };
}

export function initStatus(data) {
  const els = document.querySelectorAll('[data-status]');
  const { hours, status: T } = data;
  const short = (t) => t.replace(/^0/, '');

  function update() {
    const now = pragueNow();
    const key = ORDER[now.day];
    const today = hours[key];
    document.querySelectorAll('[data-day]').forEach((r) => r.classList.toggle('is-today', r.dataset.day === key));
    let text, open = false;
    if (today && now.time >= today[0] && now.time < today[1]) {
      text = T.open.replace('{t}', short(today[1]));
      open = true;
    } else {
      // Find the next opening time
      let found = null;
      for (let i = 0; i < 8; i += 1) {
        const d = (now.day + i) % 7;
        const h = hours[ORDER[d]];
        if (!h) continue;
        if (i === 0 && now.time >= h[0]) continue;
        found = { i, d, h };
        break;
      }
      if (found) {
        const word = found.i === 0 ? T.days.today : found.i === 1 ? T.days.tomorrow : T.days[ORDER[found.d]];
        text = T.closed.replace('{d}', word).replace('{t}', short(found.h[0]));
      }
    }
    els.forEach((el) => {
      el.textContent = text || '';
      el.classList.toggle('is-open', open);
      el.classList.toggle('is-closed', !open);
    });
  }
  update();
  setInterval(update, 60000);
}
