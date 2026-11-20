import { workspace, grantURL, submitRemote } from './service-api.js';
import { connectInbox } from './inbox.js';
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
function legacyOrders() {
  const box = one('#legacy-orders');
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
    one('#legacy').hidden = !rows.length;
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
let generation = 0,
  disconnect;
export function leaveOrders() {
  generation++;
  disconnect?.();
  disconnect = null;
}
export async function listOrders() {
  leaveOrders();
  const current = generation;
  legacyOrders();
  const buttons = one('#role-links'),
    status = one('#sync'),
    box = one('#orders'),
    refresh = one('#refresh');
  buttons.hidden = true;
  refresh.disabled = true;
  status.textContent = 'Načítání ze serveru…';
  try {
    const space = await workspace();
    if (current !== generation) return;
    one('#service-link').href = grantURL(space, 'service');
    one('#customer-link').href = grantURL(space, 'customer');
    buttons.hidden = false;
    disconnect = connectInbox({
      grant: { id: space.id, key: space.customer },
      role: 'customer',
      status,
      box,
      refresh,
    });
  } catch (e) {
    if (current !== generation) return;
    box.replaceChildren();
    status.textContent = e.message;
    refresh.disabled = false;
    refresh.onclick = listOrders;
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
  let sending = false;
  one('#request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pending || sending) return;
    const form = e.currentTarget;
    const payload = {
      id: pending.id,
      count: pending.count,
      area: pending.area,
      contact: one('#contact').value,
      slot: one('#slot').value,
    };
    sending = true;
    const controls = [...form.elements, ...one('#calc-form').elements];
    controls.forEach((control) => {
      control.disabled = true;
    });
    const send = form.querySelector('button[type=submit]');
    const label = send.textContent;
    send.textContent = 'Ukládání…';
    try {
      const space = await workspace();
      let previous;
      try {
        previous = JSON.parse(remembered('sending'));
      } catch {}
      const signature = [space.id, payload.count, payload.area, payload.contact, payload.slot].join(
        '|',
      );
      if (previous?.signature === signature) payload.id = previous.id;
      else if (pending.signature && pending.signature !== signature)
        payload.id = crypto.randomUUID();
      pending.signature = signature;
      pending.id = payload.id;
      remember('sending', JSON.stringify({ signature, id: payload.id }));
      const { order } = await submitRemote(space, payload);
      remember('sending', '');
      closeRequest();
      form.reset();
      one('#app-error').hidden = true;
      const notification = one('#confirmation');
      notification.hidden = false;
      notification.textContent =
        'Poptávka ' + order.id.slice(0, 8).toUpperCase() + ' je uložená na serveru.';
      location.hash = 'poptavky';
    } catch (e) {
      const error = one('#app-error');
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      sending = false;
      controls.forEach((control) => {
        control.disabled = false;
      });
      send.textContent = label;
    }
  });
  recalculate();
  one('#prepare').disabled = false;
}
