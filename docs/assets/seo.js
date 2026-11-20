import { one, element, link, resource, remember, remembered } from './common.js';
async function loadPage(url) {
  return new DOMParser().parseFromString(await resource(url, 'text'), 'text/html');
}
export async function audit(repaired) {
  const base = new URL('archiv/', document.baseURI);
  const pricing = new URL('cenik/', base);
  const [home, price] = await Promise.all([loadPage(base), loadPage(pricing)]);
  const pages = [home, price];
  const label = home.querySelector('a[data-price-link]');
  if (repaired && label) {
    const corrected = new URL(label.getAttribute('href'), base);
    corrected.hash = 'cena';
    label.setAttribute('href', corrected.href);
  }
  const target = label && new URL(label.getAttribute('href'), base);
  const works =
    target?.pathname === pricing.pathname &&
    !!target.hash &&
    !!price.getElementById(target.hash.slice(1));
  const titles = pages.map((p) => p.title.trim());
  const descriptions = pages.map((p) => p.querySelector('meta[name=description]')?.content.trim());
  return [
    {
      name: 'Odkaz na cenu servisu',
      ok: works,
      detail: works
        ? 'Odkaz v pracovní kopii vede přímo na oddíl „Cena za jednotku“.'
        : 'Odkaz míří na #ceny. V ceníku má oddíl „Cena za jednotku“ identifikátor #cena.',
      evidence: target && target.pathname.split('/').slice(-3).join('/') + target.hash,
      url: target?.href,
    },
    {
      name: 'Samostatné titulky stránek',
      ok: titles.every(Boolean) && new Set(titles).size === pages.length,
      detail: titles.join(' / '),
    },
    {
      name: 'Popis služby a ceníku',
      ok: descriptions.every(Boolean) && new Set(descriptions).size === pages.length,
      detail: descriptions.join(' / '),
    },
    {
      name: 'Hlavní nadpis na každé stránce',
      ok: pages.every(
        (p) => p.querySelectorAll('h1').length === 1 && p.querySelector('h1').textContent.trim(),
      ),
      detail: pages.map((p) => p.querySelector('h1')?.textContent || 'Chybí nadpis').join(' / '),
    },
  ];
}
let busy = false,
  version = 'archiv';
async function run(next) {
  if (busy) return;
  busy = true;
  const buttons = ['#run-seo', '#repair', '#undo-repair'].map(one);
  for (const b of buttons) b.disabled = true;
  const status = one('#seo-status');
  status.textContent = 'Kontroluji obě stránky…';
  try {
    const checks = await audit(next === 'servis');
    version = next;
    const fixed = version === 'servis';
    remember('audit', version);
    one('#seo-version').textContent = fixed
      ? 'Pracovní kopie s opraveným odkazem'
      : 'Původní verze';
    const box = one('#checks');
    box.replaceChildren();
    const failures = checks.filter((c) => !c.ok).length;
    status.replaceChildren(
      element(
        'p',
        failures
          ? 'Nalezené závady: ' + failures + ' ze ' + checks.length + ' kontrol.'
          : 'Všechny ' + checks.length + ' kontroly prošly.',
        'stat',
      ),
    );
    for (const c of checks) {
      const item = element('article', undefined, 'check'),
        heading = element('div', undefined, 'split');
      heading.append(
        element('h3', c.name),
        element('span', c.ok ? 'V pořádku' : 'K opravě', 'badge ' + (c.ok ? 'fixed' : 'warn')),
      );
      item.append(heading, element('small', c.detail));
      if (c.url) {
        const a = link('Prověřit cíl · ' + c.evidence, c.url);
        item.append(a);
      }
      box.append(item);
    }
    one('#repair-actions').hidden = false;
    one('#repair').hidden = fixed;
    one('#undo-repair').hidden = !fixed;
  } catch {
    status.replaceChildren(
      element('p', 'Stránky se nepodařilo načíst. Zkuste kontrolu znovu.', 'notice warn'),
    );
    one('#checks').replaceChildren();
    one('#repair-actions').hidden = true;
  } finally {
    busy = false;
    for (const b of buttons) b.disabled = false;
  }
}
export function setupSeo() {
  one('#run-seo').onclick = () => run(version);
  one('#repair').onclick = () => run('servis');
  one('#undo-repair').onclick = () => run('archiv');
}
export function restoreSeo() {
  const saved = remembered('audit');
  if (!one('#checks').children.length && ['archiv', 'servis'].includes(saved)) return run(saved);
}
export async function loadPerformance() {
  const p = await resource('assets/mobile-report.json');
  const box = element('section', undefined, 'panel');
  box.append(
    element('h2', 'Mobilní měření'),
    element('p', 'Lighthouse · servisní web · ' + p.date.slice(0, 10), 'meta'),
  );
  const stats = element('div', undefined, 'perf-row');
  for (const [k, v] of Object.entries(p.metrics)) {
    const s = element('span', k);
    s.append(element('b', String(v)));
    stats.append(s);
  }
  box.append(stats, link('Otevřít záznam měření', 'assets/mobile-report.json'));
  one('#perf').replaceChildren(box);
}
