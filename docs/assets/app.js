import { icons, one, titles } from './common.js';
import { setupOrders, listOrders } from './orders.js';
import { setupSeo, loadPerformance, restoreSeo } from './seo.js';
import { setupGeo } from './geo.js';
let active;
const loaded = new Map();
function loadOnce(key, task, route) {
  if (!loaded.has(key))
    loaded.set(
      key,
      task().catch(() => {
        loaded.delete(key);
        if (active === route) {
          one('#app-error').textContent =
            'Podklady se nepodařilo načíst. Obnovte stránku nebo tuto sekci znovu otevřete.';
          one('#app-error').hidden = false;
        }
      }),
    );
}
function route(moveFocus = false) {
  const key = location.hash.slice(1);
  if (key === 'main') {
    one('#main').focus();
    return;
  }
  active = Object.hasOwn(titles, key) ? key : 'prehled';
  one('#app-error').hidden = true;
  for (const section of document.querySelectorAll('[data-page]'))
    section.hidden = section.dataset.page !== active;
  for (const a of document.querySelectorAll('.rail nav a')) {
    if (a.hash === '#' + active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  one('#route-name').textContent = titles[active];
  document.title = titles[active] + ' · Aardvarkland Web Audit';
  if (active === 'kalkulacka') loadOnce('orders', setupOrders, active);
  if (active === 'poptavky') listOrders();
  else one('#confirmation').hidden = true;
  if (active === 'geo') loadOnce('geo', setupGeo, active);
  if (active === 'seo') {
    restoreSeo();
    loadOnce('perf', loadPerformance, active);
  }
  if (moveFocus) {
    one('#main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
icons();
setupSeo();
route();
one('.skip').onclick = (e) => {
  e.preventDefault();
  one('#main').focus();
};
window.addEventListener('hashchange', () => route(true));
