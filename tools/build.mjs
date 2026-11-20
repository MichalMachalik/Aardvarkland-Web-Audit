import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const docs = path.join(root, 'docs');
const config = JSON.parse(await readFile(path.join(root, 'data/service.json'), 'utf8'));
const number = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const names = { cena: 'Cena za jednotku', doprava: 'Doprava po Praze', rozsah: 'Rozsah servisu' };
const areas = Object.entries(config.areas).sort((a, b) => b[0] - a[0]);
const travel = areas.map(([area, fee]) => number(fee) + ' Kč pro Prahu ' + area);
const after = {
  cena:
    'Servis jedné nástěnné jednotky stojí ' +
    number(config.unitPrice) +
    ' Kč včetně DPH. Cena se násobí počtem jednotek.',
  doprava:
    'Doprava za jednu návštěvu stojí ' +
    travel.slice(0, -1).join(', ') +
    ' a ' +
    travel.at(-1) +
    '.',
  rozsah: config.scope,
};
await writeFile(
  path.join(docs, 'assets/catalog.json'),
  JSON.stringify(
    { unitPrice: config.unitPrice, maxUnits: config.maxUnits, areas: config.areas },
    null,
    2,
  ) + '\n',
);
for (const [folder, content] of [
  ['servis', after],
  ['archiv', config.before],
]) {
  const original = folder === 'archiv';
  for (const price of [false, true]) {
    const dir = path.join(docs, folder, price ? 'cenik' : '');
    const back = price ? '../../' : '../';
    const home = price ? '../' : './';
    const priceUrl = price ? './' : 'cenik/';
    const title = price ? 'Ceník servisu klimatizací' : 'Servis nástěnných klimatizací v Praze';
    const subtitle = price
      ? 'Ceny za jednotku, doprava a rozsah jedné návštěvy.'
      : 'Čištění a pravidelná kontrola nástěnných jednotek v bytech a malých kancelářích.';
    const sections = Object.entries(content)
      .map(
        ([key, value]) =>
          '<section class="source-section" id="' +
          key +
          '"><h2>' +
          names[key] +
          '</h2><p data-passage>' +
          value +
          '</p></section>',
      )
      .join('\n');
    const sourceLink = priceUrl + (original ? '#ceny' : '#cena');
    const hero =
      '<div class="service-hero"><div><p class="overline">Větrovka servis</p><h1>' +
      title +
      '</h1><p>' +
      subtitle +
      '</p><a class="button primary" data-price-link href="' +
      sourceLink +
      '">Ceník servisu</a></div><img src="' +
      back +
      'assets/interier.webp" alt="Nástěnná klimatizace v obytné místnosti" width="1024" height="683"></div>';
    const details =
      '<header class="heading"><p class="overline">Větrovka servis</p><h1>' +
      title +
      '</h1><p>' +
      subtitle +
      '</p></header>' +
      sections;
    const body =
      '<header class="site-head"><a href="' +
      home +
      '">Větrovka servis</a><nav aria-label="Navigace servisu"><a href="' +
      priceUrl +
      '">Ceník</a><a href="' +
      back +
      '#prehled">Web Audit</a></nav></header><main class="client-main" id="main">' +
      (price ? details : hero) +
      '<div class="service-cta"><div><h2>Spočítat cenu návštěvy</h2><p>Zvolte počet jednotek a místo servisu.</p></div><a class="button" href="' +
      back +
      '#kalkulacka">Otevřít kalkulačku</a></div></main>';
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'index.html'),
      '<!doctype html>\n<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="description" content="' +
        subtitle +
        '"><link rel="icon" href="' +
        back +
        'assets/aardvarkland.png"><link rel="stylesheet" href="' +
        back +
        'assets/style.css"><title>' +
        title +
        ' | Větrovka servis</title></head><body><a class="skip" href="#main">Přejít na obsah</a>' +
        body +
        '</body></html>\n',
    );
  }
}
