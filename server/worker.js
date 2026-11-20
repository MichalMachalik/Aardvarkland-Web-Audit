import catalogue from '../docs/assets/catalog.json';
const day = 86_400_000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const token = /^[a-f0-9]{64}$/;
const contacts = ['Kontakt Alfa', 'Kontakt Beta'];
const slots = ['Dopoledne', 'Odpoledne'];
const fields = 'id, contact, slot, units AS count, area, total, created AS at, accepted';
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function requireValue(ok, status, message) {
  if (!ok) throw new HttpError(status, message);
}
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
}
async function input(req, keys) {
  requireValue(
    req.headers.get('content-type')?.split(';')[0] === 'application/json',
    415,
    'Očekává se JSON.',
  );
  const reader = req.body?.getReader();
  requireValue(reader, 400, 'Chybí formulář.');
  const parts = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1024) {
      await reader.cancel();
      throw new HttpError(413, 'Příliš dlouhý formulář.');
    }
    parts.push(value);
  }
  let obj;
  try {
    obj = JSON.parse(await new Blob(parts).text());
  } catch {
    throw new HttpError(400, 'Neplatný formulář.');
  }
  requireValue(
    obj &&
      typeof obj === 'object' &&
      Object.keys(obj).length === keys.length &&
      keys.every((k) => Object.hasOwn(obj, k)),
    400,
    'Neplatná pole formuláře.',
  );
  return obj;
}
function roleFor(caps, hash) {
  return hash === caps.customer_hash ? 'customer' : hash === caps.service_hash ? 'service' : null;
}
async function handle(req, db) {
  const path = new URL(req.url).pathname;
  const method = req.method;
  if (path === '/health' && method === 'GET') {
    await db.prepare('SELECT id FROM workspaces LIMIT 1').first();
    return { status: 'ready' };
  }
  if (path === '/v1/workspaces' && method === 'POST') {
    const { id, customer, service } = await input(req, ['id', 'customer', 'service']);
    requireValue(
      typeof id === 'string' &&
        uuid.test(id) &&
        typeof customer === 'string' &&
        typeof service === 'string' &&
        token.test(customer) &&
        token.test(service) &&
        customer !== service,
      400,
      'Neplatný pracovní prostor.',
    );
    const [a, b] = await Promise.all([digest(customer), digest(service)]);
    const now = Date.now();
    await db
      .prepare(
        'INSERT OR IGNORE INTO workspaces(id,customer_hash,service_hash,expires) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM workspaces)<3000',
      )
      .bind(id, a, b, now + 7 * day)
      .run();
    const row = await db
      .prepare('SELECT customer_hash, service_hash, expires FROM workspaces WHERE id=?')
      .bind(id)
      .first();
    requireValue(row, 429, 'Kapacita ukázky je naplněná. Zkuste to později.');
    requireValue(row.customer_hash === a && row.service_hash === b, 409, 'Prostor nelze otevřít.');
    requireValue(row.expires > now, 410, 'Platnost pracovního prostoru skončila.');
    return { expires: row.expires };
  }
  const match = /^\/v1\/workspaces\/([^/]+)\/orders(?:\/([^/]+)\/accept)?$/.exec(path);
  requireValue(
    match && uuid.test(match[1]) && (!match[2] || uuid.test(match[2])),
    404,
    'Odkaz nebyl nalezen.',
  );
  const [, workspace, orderId] = match;
  const key = req.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  requireValue(key, 401, 'Chybí přístupový odkaz.');
  const caps = await db
    .prepare('SELECT customer_hash,service_hash,expires FROM workspaces WHERE id=?')
    .bind(workspace)
    .first();
  const role = caps && roleFor(caps, await digest(key));
  requireValue(role, 403, 'Tento přístupový odkaz není platný.');
  requireValue(caps.expires > Date.now(), 410, 'Platnost pracovního prostoru skončila.');
  if (!orderId && method === 'GET') {
    const rows = await db
      .prepare('SELECT ' + fields + ' FROM orders WHERE workspace=? ORDER BY created DESC,id DESC')
      .bind(workspace)
      .all();
    return { orders: rows.results, expires: caps.expires };
  }
  if (orderId && method === 'POST') {
    requireValue(role === 'service', 403, 'Převzetí vyžaduje servisní pohled.');
    const now = new Date().toISOString();
    const order = await db
      .prepare(
        'UPDATE orders SET accepted=COALESCE(accepted,?) WHERE workspace=? AND id=? RETURNING ' +
          fields,
      )
      .bind(now, workspace, orderId)
      .first();
    requireValue(order, 404, 'Poptávka nebyla nalezena.');
    return { order };
  }
  if (!orderId && method === 'POST') {
    requireValue(role === 'customer', 403, 'Nová poptávka vyžaduje zákaznický pohled.');
    const { id, count, area, contact, slot } = await input(req, [
      'id',
      'count',
      'area',
      'contact',
      'slot',
    ]);
    requireValue(
      typeof id === 'string' &&
        uuid.test(id) &&
        Number.isInteger(count) &&
        count >= 1 &&
        count <= catalogue.maxUnits &&
        typeof area === 'string' &&
        Object.hasOwn(catalogue.areas, area) &&
        contacts.includes(contact) &&
        slots.includes(slot),
      400,
      'Vyberte platné údaje z formuláře.',
    );
    const total = count * catalogue.unitPrice + catalogue.areas[area];
    await db
      .prepare(
        'INSERT OR IGNORE INTO orders(workspace,id,contact,slot,units,area,total,created) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM orders WHERE workspace=?)<40',
      )
      .bind(workspace, id, contact, slot, count, area, total, new Date().toISOString(), workspace)
      .run();
    const order = await db
      .prepare('SELECT ' + fields + ' FROM orders WHERE workspace=? AND id=?')
      .bind(workspace, id)
      .first();
    requireValue(order, 429, 'V tomto prostoru lze vytvořit až 40 poptávek.');
    requireValue(
      order.contact === contact &&
        order.slot === slot &&
        order.count === count &&
        order.area === area,
      409,
      'Tato poptávka už je uložená s jinými údaji.',
    );
    return { order };
  }
  throw new HttpError(405, 'Nepodporovaná metoda.');
}
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    const localHost = ['localhost', '127.0.0.1'].includes(new URL(req.url).hostname);
    const allowed =
      !origin ||
      origin === 'https://michalmachalik.github.io' ||
      (localHost && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin));
    const headers = {
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    if (!allowed) return Response.json({ error: 'Nepovolený původ.' }, { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (req.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
        },
      });
    try {
      return Response.json(await handle(req, env.DB), { headers });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : 'Server je dočasně nedostupný. Zkuste to znovu.',
        },
        { status: error instanceof HttpError ? error.status : 503, headers },
      );
    }
  },
  async scheduled(_event, env) {
    await env.DB.prepare('DELETE FROM workspaces WHERE expires<=?').bind(Date.now()).run();
  },
};
