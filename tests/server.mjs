import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
const base = process.env.ORDER_API || 'http://127.0.0.1:8799';
const request = (path, method, key, data) =>
  fetch(base + path, {
    method,
    headers: {
      ...(key ? { Authorization: 'Bearer ' + key } : {}),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
test('Server stores a priced request and acknowledges receipt exactly once', async () => {
  const space = {
    id: randomUUID(),
    customer: randomBytes(32).toString('hex'),
    service: randomBytes(32).toString('hex'),
  };
  const created = await request('/v1/workspaces', 'POST', null, space);
  assert.equal(created.status, 200);
  const orders = '/v1/workspaces/' + space.id + '/orders';
  const order = {
    id: randomUUID(),
    count: 3,
    area: '5',
    contact: 'Kontakt Alfa',
    slot: 'Dopoledne',
  };
  const create = () => request(orders, 'POST', space.customer, order);
  const saved = await Promise.all([create(), create()]);
  for (const s of saved) {
    assert.equal(s.status, 200);
    assert.equal((await s.json()).order.total, 3850);
  }
  assert.equal((await request(orders, 'POST', space.customer, { ...order, count: 4 })).status, 409);
  assert.equal(
    (await request(orders, 'POST', space.customer, { ...order, id: randomUUID(), count: 0 }))
      .status,
    400,
  );
  assert.equal(
    (
      await request(orders, 'POST', space.customer, {
        ...order,
        id: randomUUID(),
        contact: 'Kontakt mimo nabídku',
      })
    ).status,
    400,
  );
  const accept = orders + '/' + order.id + '/accept';
  assert.equal((await request(accept, 'POST', space.customer)).status, 403);
  const confirmed = await Promise.all([
    request(accept, 'POST', space.service),
    request(accept, 'POST', space.service),
  ]);
  const results = await Promise.all(
    confirmed.map(async (r) => {
      assert.equal(r.status, 200);
      return (await r.json()).order.accepted;
    }),
  );
  assert.ok(results[0]);
  assert.equal(results[0], results[1]);
  const s = await request(orders, 'GET', space.customer);
  const state = await s.json();
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].accepted, results[0]);
  assert.equal(state.orders[0].total, 3850);
});
