import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const base = new URL(process.env.AUDIT_URL || 'http://127.0.0.1:4589/');
const browsers = { chromium, firefox, webkit };
const clean = (text) => text.replace(/[\u202f\u00a0]/g, ' ');
async function exercise(name, width) {
  const browser = await browsers[name].launch();
  try {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const page = await context.newPage();
    const faults = [],
      bad = [];
    page.on('pageerror', (e) => faults.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) bad.push(r.status() + ' ' + r.url());
    });
    const goto = async (route) => {
      await page.goto(new URL('#' + route, base).href);
      await page.locator('[data-page="' + route + '"]').waitFor();
    };
    const click = async (s) => page.locator(s).click();
    const text = async (s) => clean(await page.locator(s).innerText());
    async function checkPage() {
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'Horizontal overflow',
      );
      if (name === 'chromium') {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          results.violations.map((r) => r.id + ': ' + r.nodes.map((n) => n.target).join(',')),
          [],
        );
      }
    }
    await goto('prehled');
    await checkPage();
    await click('.service-hero .button');
    await page.locator('#area option').first().waitFor({ state: 'attached' });
    for (const area of ['4', '5', '6']) {
      await page.selectOption('#area', area);
      for (let units = 1; units <= 20; units++) {
        await page.fill('#units', String(units));
        const expected = units * 1200 + { 4: 400, 5: 250, 6: 0 }[area];
        assert.equal(
          await text('.total strong'),
          clean(new Intl.NumberFormat('cs-CZ').format(expected)) + ' Kč',
        );
      }
    }
    for (const invalid of ['', '0', '21', '1.5']) {
      await page.fill('#units', invalid);
      assert.equal(await page.locator('#units').evaluate((e) => e.checkValidity()), false);
      assert.equal(await page.locator('#breakdown .total').count(), 0);
    }
    await page.fill('#units', '3');
    await click('#prepare');
    await page.selectOption('#contact', 'Kontakt Beta');
    await page.fill('#units', '4');
    assert.equal(await page.locator('#request-form').isHidden(), true);
    await page.fill('#units', '3');
    await click('#prepare');
    await click('#cancel');
    assert.equal(await page.locator('#request-form').isHidden(), true);
    await click('#prepare');
    await page.selectOption('#contact', 'Kontakt Alfa');
    await page.selectOption('#slot', 'Odpoledne');
    await checkPage();
    await page.locator('#request-form').evaluate((f) => {
      f.requestSubmit();
      f.requestSubmit();
    });
    await page.waitForURL('**/#poptavky');
    await page.locator('#orders .order-row').waitFor();
    assert.equal(await page.locator('.order-row').count(), 1);
    assert.match(await text('#confirmation'), /uložená/);
    await page.reload();
    await page.locator('.order-row').waitFor();
    assert.match(await text('.order-row'), /3 600 Kč/);
    await checkPage();
    const serviceURL = await page.locator('#service-link').getAttribute('href');
    const other = await browser.newContext({ viewport: { width, height: 850 } });
    const service = await other.newPage();
    await service.goto(serviceURL);
    await service.getByRole('button', { name: 'Převzít poptávku' }).click();
    await service.getByText('Převzato servisem', { exact: true }).waitFor();
    await click('#refresh');
    await page.getByText('Převzato servisem', { exact: true }).waitFor();
    await other.close();
    await goto('seo');
    await click('#run-seo');
    await page.getByText('K opravě', { exact: true }).waitFor();
    assert.equal(await page.locator('.check').count(), 4);
    assert.equal(await page.locator('.badge.warn').count(), 1);
    await click('#repair');
    await page.getByText('Všechny 4 kontroly prošly.').waitFor();
    await checkPage();
    await page.reload();
    await page.getByText('Všechny 4 kontroly prošly.').waitFor();
    const corrected = await page.locator('.check a').getAttribute('href');
    const evidence = await context.newPage();
    await evidence.goto(corrected);
    assert.equal(await evidence.locator(':target h2').innerText(), 'Cena za jednotku');
    await evidence.close();
    await click('#undo-repair');
    await page.getByText('K opravě', { exact: true }).waitFor();
    await goto('geo');
    await page.locator('.answer-card').first().waitFor();
    await checkPage();
    for (const [id, expected] of [
      ['cena', 2],
      ['rozsah', 2],
      ['vikend', 0],
    ]) {
      await page.selectOption('#question', id);
      assert.equal(await page.locator('.answer-card').count(), 2);
      if (id === 'rozsah') {
        await page.locator('.source-links a').first().click();
        await page.locator(':target').waitFor();
        await page.goBack();
        await page.locator('.answer-card').first().waitFor();
        assert.equal(await page.inputValue('#question'), 'rozsah');
      }
      const links = page.locator('.source-links a');
      assert.equal(await links.count(), expected);
      for (const anchor of await links.all()) {
        const href = await anchor.getAttribute('href'),
          quote = await anchor.locator('..').locator('blockquote').innerText();
        const tab = await context.newPage();
        await tab.goto(new URL(href, base).href);
        assert.equal(await tab.locator(':target [data-passage]').innerText(), quote);
        await tab.close();
      }
    }
    await goto('prehled');
    await click('.web-link');
    await click('[data-price-link]');
    assert.equal(await page.locator(':target h2').innerText(), 'Cena za jednotku');
    await checkPage();
    await page.getByRole('link', { name: 'Otevřít kalkulačku' }).click();
    await page.locator('#area option').first().waitFor({ state: 'attached' });
    assert.deepEqual(faults, []);
    assert.deepEqual(bad, []);
    console.log(name + ' ' + width + 'px · OK');
  } finally {
    await browser.close();
  }
}
for (const name of (process.env.BROWSERS || 'chromium,firefox,webkit').split(',')) {
  for (const width of (process.env.WIDTHS || '1366,375').split(',').map(Number))
    await exercise(name, width);
}
