import { one, element, link, resource, remember, remembered } from './common.js';
async function loadPage(url) {
  return new DOMParser().parseFromString(await resource(url, 'text'), 'text/html');
}
export async function audit(repaired) {
  const base = new URL('archiv/', document.baseURI);
  const pricing = new URL('cenik/', base);
  const [home, price] = await Promise.all([loadPage(base), loadPage(pricing)]);
  const pages = [home, price];
  const label = home.querySelector('a[data-price-link][href]');
  if (repaired && label) {
    label.setAttribute('href', 'cenik/#cena');
  }
  const target = label && new URL(label.getAttribute('href'), base);
  const priceHeading = price.getElementById('cena')?.querySelector('h2')?.textContent.trim();
  const works =
    target?.origin === pricing.origin &&
    target.pathname === pricing.pathname &&
    target.hash === '#cena' &&
    !!priceHeading;
  const titles = pages.map((p) => p.title.trim());
  const descriptions = pages.map((p) => p.querySelector('meta[name=description]')?.content.trim());
  const checks = [
    {
      name: 'Odkaz na cenu servisu',
      ok: works,
      detail: works
        ? 'Odkaz vede přímo na oddíl „' + priceHeading + '“.'
        : 'Cílem odkazu má být oddíl #cena na stránce ceníku.',
      evidence: target && target.pathname.split('/').slice(-3).join('/') + target.hash,
      url: target?.origin === pricing.origin ? target.href : undefined,
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
  const pageEvidence = pages.map((page, i) => ({
    name: i === 0 ? 'Servisní web' : 'Ceník servisu',
    url: i === 0 ? base.href : pricing.href,
    title: titles[i],
    description: descriptions[i],
    robots: page.querySelector('meta[name="robots"]')?.content || '',
  }));
  return { checks, pageEvidence };
}

function renderSearchPreview(pages) {
  const details = element('details', undefined, 'below');
  details.append(element('summary', 'Náhled titulků a popisů z HTML'));
  for (const page of pages) {
    const section = element('section', undefined, 'source-section');
    section.append(
      element('small', page.name, 'meta'),
      element('h3', page.title || 'Titulek chybí'),
      element('p', page.description || 'Popis chybí'),
      link('Otevřít stránku', page.url),
    );
    if (
      page.robots
        .toLowerCase()
        .split(/[\s,]+/)
        .includes('noindex')
    ) {
      section.append(element('p', 'Stránka má pro vyhledávače nastaveno noindex.', 'meta'));
    }
    details.append(section);
  }
  return details;
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
    const { checks, pageEvidence } = await audit(next === 'servis');
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
    box.append(renderSearchPreview(pageEvidence));
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
  const title = element('h2', 'Mobilní měření');
  title.id = 'performance-title';
  const meta = element('p', 'Lighthouse ' + p.lighthouseVersion + ' · ', 'meta');
  meta.append(
    link('Veřejný servisní web', p.url),
    ' · ' +
      new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' }).format(new Date(p.date)),
  );
  const table = element('table', undefined, 'performance-table');
  table.setAttribute('aria-labelledby', title.id);
  const header = table.createTHead().insertRow();
  for (const text of ['Běh', 'Výkon', 'Přístupnost', 'LCP', 'CLS']) {
    const th = element('th', text);
    th.scope = 'col';
    header.append(th);
  }
  function row(section, label, values) {
    const tr = section.insertRow();
    const th = element('th', label);
    th.scope = 'row';
    tr.append(th);
    for (const text of values) tr.insertCell().textContent = text;
  }
  const body = table.createTBody();
  p.runs.forEach((run, i) =>
    row(body, String(i + 1), [
      run.performance + '/100',
      run.accessibility + '/100',
      (run.largestContentfulPaintMs / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) +
        ' s',
      run.cumulativeLayoutShift.toLocaleString('cs-CZ', { maximumFractionDigits: 5 }),
    ]),
  );
  row(table.createTFoot(), 'Medián', [
    p.metrics.Výkon,
    p.metrics.Přístupnost,
    p.metrics.LCP,
    p.metrics.CLS,
  ]);
  box.append(title, meta, table, link('Otevřít záznam měření', 'assets/mobile-report.json'));
  one('#perf').replaceChildren(box);
}
