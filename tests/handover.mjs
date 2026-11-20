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
  const customer = await customerEngine.newPage();
  await customer.goto(await owner.locator('#customer-link').getAttribute('href'));
  await customer.getByText('Zatím tu není žádná serverová poptávka.').waitFor();
  await owner.goto(new URL('#kalkulacka', base).href);
  await owner.locator('#prepare').click();
  await owner.selectOption('#contact', 'Kontakt Beta');
  await owner.getByRole('button', { name: 'Odeslat testovací poptávku' }).click();
  await owner.locator('.order-row').waitFor();
  await desk.getByRole('button', { name: 'Převzít poptávku' }).waitFor();
  await customer.getByText('Čeká na převzetí', { exact: true }).waitFor();
  assert.equal(await customer.getByRole('button', { name: 'Převzít poptávku' }).count(), 0);
  await desk.getByRole('button', { name: 'Převzít poptávku' }).click();
  await customer.getByText('Převzato servisem', { exact: true }).waitFor();
  await customer.reload();
  await customer.getByText('Převzato servisem', { exact: true }).waitFor();
  assert.match(await customer.locator('.order-row').innerText(), /Potvrzeno/);
  const separate = await customerEngine.newPage();
  await separate.goto(new URL('#poptavky', base).href);
  await separate.getByText('Zatím tu není žádná serverová poptávka.').waitFor();
  assert.equal(await separate.locator('.order-row').count(), 0);
  console.log(
    'Potvrzeno mezi Chromiem a Firefoxem: převzetí, automatická aktualizace, obnova i izolovaný druhý návštěvník.',
  );
} finally {
  await Promise.all([customerEngine.close(), serviceEngine.close()]);
}
