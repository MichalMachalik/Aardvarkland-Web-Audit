import { element, money } from './common.js';
import { listRemote, acceptRemote } from './service-api.js';
function date(value) {
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Prague',
  }).format(new Date(value));
}
function row(order, onAccept) {
  const card = element('article', undefined, 'order-row'),
    body = element('div'),
    meta = element('div', undefined, 'order-meta');
  body.append(
    element('strong', order.contact + ' · Praha ' + order.area),
    element('small', order.count + ' × servis · ' + order.slot + ' · ' + money(order.total)),
    element(
      'small',
      'Poptávka ' + order.id.slice(0, 8).toUpperCase() + ' · Odesláno ' + date(order.at),
    ),
  );
  const state = element(
    'span',
    order.accepted ? 'Převzato servisem' : 'Čeká na převzetí',
    'badge ' + (order.accepted ? 'fixed' : 'warn'),
  );
  meta.append(state);
  if (order.accepted) meta.append(element('small', 'Potvrzeno ' + date(order.accepted)));
  else if (onAccept) {
    const b = element('button', 'Převzít poptávku', 'primary');
    b.type = 'button';
    b.onclick = () => onAccept(order.id, b);
    meta.append(b);
  }
  card.append(body, meta);
  return card;
}
export function connectInbox({ grant, box, status, refresh, role }) {
  let alive = true,
    busy = false,
    timer,
    last,
    again = false;
  let acceptedCount;
  const pending = new Set();
  async function update() {
    if (!alive) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    refresh.disabled = true;
    clearTimeout(timer);
    try {
      const result = await listRemote(grant.id, grant.key);
      if (!alive) return;
      const stamp = JSON.stringify(result.orders);
      if (stamp !== last) {
        box.replaceChildren(
          ...result.orders.map((order) => row(order, role === 'service' ? accept : null)),
        );
        if (!result.orders.length)
          box.append(
            element(
              'p',
              role === 'service'
                ? 'Nové poptávky se zde objeví automaticky.'
                : 'Zatím tu není žádná serverová poptávka.',
              'empty',
            ),
          );
        last = stamp;
      }
      const accepted = result.orders.filter((order) => order.accepted).length;
      const changed = acceptedCount !== undefined && accepted > acceptedCount;
      acceptedCount = accepted;
      const message =
        (changed ? 'Servis potvrdil převzetí. ' : '') +
        'Aktualizováno ' +
        date(Date.now()) +
        ' · Platnost do ' +
        date(result.expires);
      if (status.textContent !== message) status.textContent = message;
    } catch (e) {
      if (alive) status.textContent = e.message;
    } finally {
      busy = false;
      if (alive) {
        refresh.disabled = false;
        if (!document.hidden) timer = setTimeout(update, again ? 0 : 8500);
        again = false;
      }
    }
  }
  async function accept(id, b) {
    if (pending.has(id)) return;
    pending.add(id);
    b.disabled = true;
    try {
      await acceptRemote(grant.id, grant.key, id);
      if (alive) {
        last = undefined;
        await update();
      }
    } catch (e) {
      if (alive) status.textContent = e.message;
    } finally {
      pending.delete(id);
      b.disabled = false;
    }
  }
  function visibility() {
    if (!document.hidden) update();
    else clearTimeout(timer);
  }
  refresh.onclick = update;
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', update);
  update();
  return () => {
    alive = false;
    clearTimeout(timer);
    refresh.onclick = null;
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('focus', update);
  };
}
