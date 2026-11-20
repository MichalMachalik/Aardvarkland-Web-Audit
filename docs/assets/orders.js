import { one, element, money, resource, remember, remembered } from './common.js';
const prefix = 'aardvarkland.web-audit.order.v1.';
const contacts = ['Kontakt Alfa', 'Kontakt Beta'];
const slots = ['Dopoledne', 'Odpoledne'];
let catalog, pending;
function quote() {
  const count = one('#units').valueAsNumber,
    area = one('#area').value;
  if (
    !catalog ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > catalog.maxUnits ||
    !Object.hasOwn(catalog.areas, area)
  )
    return null;
  const service = count * catalog.unitPrice,
    travel = catalog.areas[area];
  return { count, area, service, travel, total: service + travel };
}
function row(title, value, css) {
  const n = element('div', undefined, css);
  n.append(element('span', title), element('strong', value));
  return n;
}
function closeRequest() {
  pending = null;
  one('#request-form').hidden = true;
}
function recalculate() {
  closeRequest();
  const q = quote(),
    box = one('#breakdown');
  if (!q) {
    box.replaceChildren(
      element('p', 'Zadejte celé číslo od 1 do ' + catalog.maxUnits + '.', 'stat'),
    );
    return;
  }
  remember('units', String(q.count));
  remember('area', q.area);
  box.replaceChildren(
    row(q.count + ' × ' + money(catalog.unitPrice), money(q.service), 'money-line'),
    row('Doprava · Praha ' + q.area, money(q.travel), 'money-line'),
    row('Celkem včetně DPH', money(q.total), 'total'),
  );
}
function validRecord(r) {
  return (
    r &&
    typeof r.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(r.id) &&
    contacts.includes(r.contact) &&
    slots.includes(r.slot) &&
    ['4', '5', '6'].includes(r.area) &&
    Number.isInteger(r.count) &&
    r.count > 0 &&
    r.count <= 20 &&
    Number.isSafeInteger(r.total) &&
    r.total >= 0 &&
    Number.isFinite(Date.parse(r.at))
  );
}
export function listOrders() {
  const box = one('#orders');
  try {
    const rows = [];
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
      let r;
      try {
        r = JSON.parse(localStorage.getItem(key));
      } catch {
        continue;
      }
      if (validRecord(r) && key === prefix + r.id) rows.push(r);
    }
    box.replaceChildren();
    if (!rows.length)
      box.append(
        element('p', 'Zatím tu nejsou žádné poptávky. První vytvoříte v kalkulačce.', 'empty'),
      );
    for (const r of rows.sort((a, b) => b.at.localeCompare(a.at))) {
      const n = element('article', undefined, 'order-row'),
        body = element('div');
      body.append(
        element('strong', r.contact + ' · Praha ' + r.area),
        element(
          'small',
          r.count + ' × servis · ' + r.slot + ' · ' + new Date(r.at).toLocaleString('cs-CZ'),
        ),
        element('small', 'Poptávka ' + r.id.slice(0, 8).toUpperCase()),
      );
      n.append(body, element('strong', money(r.total)));
      box.append(n);
    }
  } catch {
    box.replaceChildren(element('p', 'Seznam vyžaduje povolené úložiště prohlížeče.', 'empty'));
  }
}
export async function setupOrders() {
  catalog = await resource('assets/catalog.json');
  const area = one('#area');
  for (const id of Object.keys(catalog.areas).sort((a, b) => b - a))
    area.add(new Option('Praha ' + id, id));
  one('#units').max = catalog.maxUnits;
  const savedCount = Number(remembered('units')),
    savedArea = remembered('area');
  if (Number.isInteger(savedCount) && savedCount >= 1 && savedCount <= catalog.maxUnits)
    one('#units').value = savedCount;
  if (Object.hasOwn(catalog.areas, savedArea)) area.value = savedArea;
  one('#limit').textContent = 'Jedna návštěva zahrnuje 1 až ' + catalog.maxUnits + ' jednotek.';
  one('#calc-form').addEventListener('input', recalculate);
  one('#calc-form').addEventListener('change', recalculate);
  one('#calc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = quote();
    if (!q) return;
    if (!pending) pending = { ...q, id: crypto.randomUUID() };
    one('#request-form').hidden = false;
    one('#request-quote').textContent =
      q.count + ' × servis · Praha ' + q.area + ' · ' + money(q.total) + ' včetně DPH';
    one('#contact').focus();
  });
  one('#cancel').addEventListener('click', () => {
    closeRequest();
    one('#prepare').focus();
  });
  one('#request-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pending) return;
    const order = {
      ...pending,
      contact: one('#contact').value,
      slot: one('#slot').value,
      at: new Date().toISOString(),
    };
    if (!validRecord(order)) return;
    const notification = one('#confirmation');
    try {
      localStorage.setItem(prefix + order.id, JSON.stringify(order));
    } catch {
      const err = one('#app-error');
      err.textContent = 'Poptávku se nepodařilo uložit. Povolte úložiště a zkuste to znovu.';
      err.hidden = false;
      return;
    }
    closeRequest();
    e.target.reset();
    one('#app-error').hidden = true;
    notification.hidden = false;
    notification.textContent =
      'Poptávka ' + order.id.slice(0, 8).toUpperCase() + ' je uložená v tomto prohlížeči.';
    location.hash = 'poptavky';
  });
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.startsWith(prefix)) listOrders();
  });
  recalculate();
  one('#prepare').disabled = false;
}
