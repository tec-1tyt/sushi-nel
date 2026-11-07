// Runs before first paint. Marks JS as available and sets up failsafes so a broken script can never hide the page.
(function () {
  var d = document.documentElement;
  d.classList.remove('no-js');
  d.classList.add('js');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) d.classList.add('rm');
  var seen = false;
  try { seen = sessionStorage.getItem('sn_pre') === '1'; } catch (e) { /* storage blocked */ }
  // Slow connections and data saver skip the preloader
  var c = navigator.connection;
  var slow = c && (c.saveData || /2g/.test(c.effectiveType || ''));
  if (slow) d.classList.add('lite');
  if (reduced || seen || slow) d.classList.add('pre-done');
  // Preloader can never outlive this, even if every other script fails to load
  setTimeout(function () { d.classList.add('pre-done'); }, 3200);
})();
