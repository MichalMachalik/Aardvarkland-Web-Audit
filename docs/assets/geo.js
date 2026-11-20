import { one, element, link, resource, remember, remembered } from './common.js';
const sides = {
  before: { title: 'Původní ceník', folder: 'archiv' },
  after: { title: 'Upravený ceník', folder: 'servis' },
};
const labels = { cena: 'Cena za jednotku', doprava: 'Doprava po Praze', rozsah: 'Rozsah servisu' };
export async function setupGeo() {
  const [report, before, after] = await Promise.all([
    resource('assets/geo-report.json'),
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
      if (!output.citations.length)
        links.append(element('small', 'Odpověď neuvádí citaci.', 'meta'));
      for (const id of output.citations) {
        const passage = pages[side]
          .getElementById(id)
          ?.querySelector('[data-passage]')?.textContent;
        if (!passage || passage !== report.sources[side][id]) {
          links.append(element('span', 'Citaci se nepodařilo ověřit.', 'badge warn'));
          continue;
        }
        const block = element('div');
        block.append(
          link(labels[id], info.folder + '/cenik/#' + id),
          element('blockquote', passage),
        );
        links.append(block);
      }
      card.append(links);
      grid.append(card);
    }
    one('#answers').replaceChildren(grid);
  }
  select.onchange = show;
  show();
  const meta = element('p', undefined, 'meta');
  meta.append(
    document.createTextNode('Uložený test nad obsahem ceníku · ' + report.model + ' · '),
    link('Záznam odpovědí', 'assets/geo-report.json'),
  );
  one('#geo-note').replaceChildren(meta);
}
