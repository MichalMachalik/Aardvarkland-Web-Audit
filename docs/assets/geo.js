import { one, element, link, money, resource, remember, remembered } from './common.js';
const sides = {
  before: { title: 'Původní ceník', folder: 'archiv' },
  after: { title: 'Upravený ceník', folder: 'servis' },
};
const labels = { cena: 'Cena za jednotku', doprava: 'Doprava po Praze', rozsah: 'Rozsah servisu' };

export function checkCostAnswer(output, catalog, verifiedIds) {
  const travel = catalog.areas['6'];
  const expected = 3 * catalog.unitPrice + travel;
  const amounts = Array.from(
    output.answer.matchAll(
      /(?<![\d.,])([−-]?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+))(?:[,.](\d{1,2}))?[ \u00a0\u202f]*Kč(?!\p{L})/gu,
    ),
    (match) => Number(match[1].replace(/\s/g, '').replace('−', '-') + '.' + (match[2] || '0')),
  );
  return {
    expected,
    matches:
      amounts.length === 1 &&
      amounts[0] === expected &&
      verifiedIds.has('cena') &&
      verifiedIds.has('doprava'),
  };
}

function verifyAnswer(card, caseId, side, output, catalog, verifiedIds, passages) {
  if (caseId === 'cena' && side === 'after') {
    const check = checkCostAnswer(output, catalog, verifiedIds);
    const detail = check.matches
      ? 'Kalkulačka potvrzuje součet 3 × ' +
        money(catalog.unitPrice) +
        ' + ' +
        money(catalog.areas['6']) +
        ' za dopravu = ' +
        money(check.expected) +
        '.'
      : 'Zkontrolujte cenu a obě citace oproti kalkulačce.';
    card.append(element('p', detail, check.matches ? 'stat' : 'notice warn'));
  }
  if (caseId === 'vikend') {
    const mentionsWeekend = passages.some((text) => /sobot|víkend/iu.test(text));
    const missing = output.citations.length === 0 && /^Web neuvádí(?:\s|,)/u.test(output.answer);
    const supportsUnknown = passages.length > 0 && !mentionsWeekend && missing;
    card.append(
      element(
        'p',
        supportsUnknown
          ? 'Žádná z porovnávaných pasáží nezmiňuje sobotu ani víkend.'
          : 'Odpověď o sobotním provozu vyžaduje kontrolu zdrojů.',
        supportsUnknown ? 'stat' : 'notice warn',
      ),
    );
  }
}

export async function setupGeo() {
  const [report, catalog, before, after] = await Promise.all([
    resource('assets/geo-report.json'),
    resource('assets/catalog.json'),
    ...Object.values(sides).map((s) => resource(s.folder + '/cenik/', 'text')),
  ]);
  const pages = {
    before: new DOMParser().parseFromString(before, 'text/html'),
    after: new DOMParser().parseFromString(after, 'text/html'),
  };
  const select = one('#question');
  select.replaceChildren();
  select.disabled = false;
  for (const c of report.cases) select.add(new Option(c.question, c.id));
  const saved = remembered('question');
  if (report.cases.some((c) => c.id === saved)) select.value = saved;
  function show() {
    const c = report.cases.find((item) => item.id === select.value);
    remember('question', c.id);
    const grid = element('div', undefined, 'compare');
    for (const [side, info] of Object.entries(sides)) {
      const output = c[side],
        card = element('article', undefined, 'panel answer-card');
      card.append(element('h2', info.title), element('p', output.answer));
      const links = element('div', undefined, 'source-links');
      const verifiedIds = new Set();
      if (!output.citations.length && c.id !== 'vikend')
        links.append(element('small', 'Odpověď neuvádí citaci.', 'meta'));
      for (const id of output.citations) {
        const passage = pages[side]
          .getElementById(id)
          ?.querySelector('[data-passage]')?.textContent;
        if (!passage || passage !== report.sources[side][id]) {
          links.append(element('span', 'Citaci se nepodařilo ověřit.', 'badge warn'));
          continue;
        }
        verifiedIds.add(id);
        const block = element('div');
        block.append(
          link(labels[id], info.folder + '/cenik/#' + id),
          element('blockquote', passage),
        );
        links.append(block);
      }
      const passages = [...pages[side].querySelectorAll('[data-passage]')].map(
        (p) => p.textContent,
      );
      verifyAnswer(card, c.id, side, output, catalog, verifiedIds, passages);
      card.append(links);
      grid.append(card);
    }
    one('#answers').replaceChildren(grid);
  }
  select.onchange = show;
  show();
  const meta = element('p', undefined, 'meta');
  meta.append(
    document.createTextNode('Uložené odpovědi z ceníku · ' + report.model.split('-')[0] + ' · '),
    link('Záznam odpovědí', 'assets/geo-report.json'),
  );
  one('#geo-note').replaceChildren(meta);
}
