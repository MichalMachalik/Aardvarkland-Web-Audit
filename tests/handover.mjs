import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
const base = new URL(process.env.AUDIT_URL || 'http://127.0.0.1:4589/');
const [customerEngine, serviceEngine] = await Promise.all([chromium.launch(), firefox.launch()]);
try {
  const owner = await customerEngine.newPage();
  await owner.goto(new URL('#poptavky', base).href);
  const launcher = owner.locator('#service-link');
  await launcher.waitFor();
  const desk = await serviceEngine.newPage();
  await desk.goto(await launcher.getAttribute('href'));
  await desk.getByText('Nové poptávky se zde objeví automaticky.').waitFor();
  const customer = await customerEngine.newPage({ viewport: { width: 320, height: 740 } });
  const listed = customer.waitForResponse((res) =>
    res.request().method() === 'GET' && res.url().endsWith('/orders'),
  );
  await customer.goto(await owner.locator('#customer-link').getAttribute('href'));
  const { expires } = await (await listed).json();
  const expiryLabel = 'Přístup k ukázce do ' + new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Prague',
  }).format(expires);
  await customer.getByRole('heading', { name: 'Stav vašich poptávek' }).waitFor();
  await customer.getByText(expiryLabel, { exact: false }).waitFor();
  await customer.getByText('Zatím tu není žádná serverová poptávka.').waitFor();
  await owner.goto(new URL('#kalkulacka', base).href);
  await owner.selectOption('#area', '6');
  await owner.fill('#units', '10');
  await owner.locator('#prepare').click();
  await owner.getByText('10 jednotek · 1 návštěva · Praha 6 · 12 000 Kč včetně DPH').waitFor();
  await owner.selectOption('#contact', 'Kontakt Beta');
  await owner.selectOption('#slot', 'Odpoledne');
  await owner.getByRole('button', { name: 'Odeslat testovací poptávku' }).click();
  await owner.locator('.order-row').waitFor();
  await desk.getByRole('button', { name: 'Převzít poptávku' }).waitFor();
  await customer.getByText('Čeká na převzetí', { exact: true }).waitFor();
  for (const page of [owner, desk, customer]) {
    await page.getByText('10 jednotek · 1 návštěva · Preferovaný čas odpoledne · 12 000 Kč', {
      exact: true,
    }).waitFor();
    await page.getByText(expiryLabel, { exact: false }).waitFor();
  }
  assert.equal(await customer.getByRole('button', { name: 'Převzít poptávku' }).count(), 0);
  await desk.getByRole('button', { name: 'Převzít poptávku' }).click();
  await customer.getByText('Převzato servisem', { exact: true }).waitFor();
  await customer.reload();
  await customer.getByText('Převzato servisem', { exact: true }).waitFor();
  assert.match(await customer.locator('.order-row').innerText(), /Potvrzeno/);
  await customer.getByText(expiryLabel, { exact: false }).waitFor();
  assert.ok(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const separate = await customerEngine.newPage();
  await separate.goto(new URL('#poptavky', base).href);
  await separate.getByText('Zatím tu není žádná serverová poptávka.').waitFor();
  assert.equal(await separate.locator('.order-row').count(), 0);
  await customer.route('**/v1/workspaces/*/orders', (route) =>
    route.fulfill({ status: 410, json: { error: 'Platnost pracovního prostoru skončila.' } }),
  );
  await customer.getByRole('button', { name: 'Obnovit stav' }).click();
  await customer.getByText('Přístup k této ukázce vypršel.', { exact: true }).waitFor();
  assert.equal(await customer.locator('.order-row').count(), 0);
  console.log(
    'Potvrzeno mezi Chromiem a Firefoxem: převzetí, automatická aktualizace, obnova i izolovaný druhý návštěvník.',
  );
} finally {
  await Promise.all([customerEngine.close(), serviceEngine.close()]);
}
