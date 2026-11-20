import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root = new URL(process.env.AUDIT_URL || 'http://127.0.0.1:4589/');
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const p = await ctx.newPage();
  await p.goto(root.href);
  await p.keyboard.press('Tab');
  await p.keyboard.press('Enter');
  assert.ok(await p.locator('#main').evaluate((el) => el === document.activeElement));
  await p.route('**/assets/geo-report.json', (route) => route.abort());
  await p.goto(new URL('#geo', root).href);
  await p.locator('#app-error').waitFor();
  await p.unroute('**/assets/geo-report.json');
  await p.goto(new URL('#prehled', root).href);
  await p.goto(new URL('#geo', root).href);
  await p.locator('.answer-card').first().waitFor();
  assert.equal(await p.locator('#app-error').isHidden(), true);
  await p.route('**/archiv/cenik/', (route) => route.abort());
  await p.goto(new URL('#seo', root).href);
  await p.locator('#run-seo').click();
  await p.getByText('Stránky se nepodařilo načíst.', { exact: false }).waitFor();
  await p.unroute('**/archiv/cenik/');
  await p.locator('#run-seo').click();
  await p.getByText('K opravě', { exact: true }).waitFor();
  await p.goto(new URL('#kalkulacka', root).href);
  await p.locator('#prepare').click();
  await p.selectOption('#contact', 'Kontakt Beta');
  await p.evaluate(() => {
    window.originalWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === localStorage) throw new DOMException('Full', 'QuotaExceededError');
      window.originalWrite.call(this, k, v);
    };
  });
  await p.locator('#request-form button[type=submit]').click();
  await p.locator('#app-error').waitFor();
  assert.equal(await p.locator('#request-form').isVisible(), true);
  await p.evaluate(() => {
    Storage.prototype.setItem = window.originalWrite;
    localStorage.setItem('aardvarkland.web-audit.order.v1.invalid', '{');
  });
  const orderEndpoint = '**/v1/workspaces/*/orders';
  await p.route(orderEndpoint, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const saved = await route.fetch();
    assert.equal(saved.status(), 200);
    await route.abort();
  });
  await p.locator('#request-form button[type=submit]').click();
  await p.getByText('Server se nepodařilo kontaktovat.', { exact: false }).waitFor();
  await p.unroute(orderEndpoint);
  await p.locator('#request-form button[type=submit]').click();
  await p.locator('.order-row').waitFor();
  assert.equal(await p.locator('.order-row').count(), 1);
  for (const route of ['prehled', 'kalkulacka', 'poptavky', 'seo', 'geo']) {
    await p.goto(new URL('#' + route, root).href);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route);
  }
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const site = await plain.newPage();
  await site.goto(new URL('servis/', root).href);
  await site.getByRole('link', { name: 'Ceník servisu', exact: true }).click();
  assert.match(await site.locator('#cena').innerText(), /1 200 Kč/);
  console.log('Obnova po chybě sítě a úložiště, klávesnice, šířka 320 px a web bez skriptů · OK');
} finally {
  await browser.close();
}
