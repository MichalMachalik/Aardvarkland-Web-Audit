import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { checkCostAnswer } from '../docs/assets/geo.js';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const report = JSON.parse(await read('docs/assets/geo-report.json'));
const data = JSON.parse(await read('docs/assets/catalog.json'));
test('The calculator uses the source catalogue', async () => {
  const source = JSON.parse(await read('data/service.json'));
  assert.deepEqual(data, {
    unitPrice: source.unitPrice,
    maxUnits: source.maxUnits,
    areas: source.areas,
  });
  assert.equal(data.unitPrice * 3 + data.areas['6'], 3600);
});
test('Every model passage matches the current public HTML', async () => {
  for (const [side, dir] of [
    ['before', 'archiv'],
    ['after', 'servis'],
  ]) {
    const html = await read('docs/' + dir + '/cenik/index.html');
    for (const [id, text] of Object.entries(report.sources[side])) {
      assert.ok(html.includes('id="' + id + '"><h2>'));
      assert.ok(html.includes('<p data-passage>' + text + '</p>'));
    }
    for (const c of report.cases) {
      const { answer, citations, raw } = c[side];
      assert.deepEqual(JSON.parse(raw), { answer, citations });
      for (const id of citations) assert.ok(Object.hasOwn(report.sources[side], id));
    }
  }
});
test('The evidence covers price, scope and a missing fact', () => {
  assert.deepEqual(
    report.cases.map((c) => c.id),
    ['cena', 'rozsah', 'vikend'],
  );
  const cost = report.cases[0].after;
  assert.match(cost.answer, /3\s?600/);
  assert.deepEqual(cost.citations.sort(), ['cena', 'doprava']);
  const weekend = report.cases[2];
  for (const answer of [weekend.before, weekend.after]) {
    assert.equal(answer.citations.length, 0);
    assert.match(answer.answer, /neuvádí/i);
  }
});
test('Published and baseline price links have their intended targets', async () => {
  assert.match(await read('docs/archiv/index.html'), /data-price-link href="cenik\/#ceny"/);
  assert.match(await read('docs/servis/index.html'), /data-price-link href="cenik\/#cena"/);
  assert.doesNotMatch(await read('docs/archiv/cenik/index.html'), /id="ceny"/);
  assert.match(await read('docs/servis/cenik/index.html'), /id="cena"/);
});
test('The displayed total requires the current catalogue price and both verified passages', () => {
  const recorded = report.cases.find((c) => c.id === 'cena').after;
  const ids = new Set(recorded.citations);
  assert.deepEqual(checkCostAnswer(recorded, data, ids), { expected: 3600, matches: true });
  assert.equal(checkCostAnswer(recorded, data, new Set(['cena'])).matches, false);
  assert.equal(checkCostAnswer(recorded, { ...data, unitPrice: 1500 }, ids).matches, false);
  for (const answer of ['3 600,50 Kč', '3 600 Kč nebo 4 600 Kč', '−3600 Kč', 'Cena chybí.']) {
    assert.equal(checkCostAnswer({ answer }, data, ids).matches, false);
  }
  assert.equal(checkCostAnswer({ answer: '3\u202f600,00 Kč.' }, data, ids).matches, true);
});
