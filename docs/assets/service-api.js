const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
export const endpoint = local
  ? 'http://127.0.0.1:8799'
  : 'https://aardvarkland-web-audit-api.dso-activation.workers.dev';
const spaceKey = 'aardvarkland.web-audit.workspace.v2';
const grantPattern = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const roles = ['customer', 'service'];
let setup;
function secret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
async function api(path, method = 'GET', body, key) {
  let r;
  try {
    r = await fetch(endpoint + path, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { Authorization: 'Bearer ' + key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(14000),
    });
  } catch {
    throw new Error('Server se nepodařilo kontaktovat. Zkontrolujte připojení a zkuste to znovu.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(data.error || 'Server je dočasně nedostupný.');
    error.status = r.status;
    throw error;
  }
  return data;
}
async function openWorkspace() {
  let space;
  try {
    const stored = localStorage.getItem(spaceKey);
    if (stored) {
      try {
        space = JSON.parse(stored);
      } catch {
        space = null;
      }
    }
    if (
      !space ||
      !uuid.test(space.id) ||
      !grantPattern.test(space.customer) ||
      !grantPattern.test(space.service) ||
      space.expires <= Date.now()
    ) {
      space = {
        id: crypto.randomUUID(),
        customer: secret(),
        service: secret(),
        expires: Date.now() + 7 * 86400000,
      };
      localStorage.setItem(spaceKey, JSON.stringify(space));
    }
  } catch {
    throw new Error('Povolte úložiště prohlížeče, aby šel bezpečně uchovat přístup k poptávce.');
  }
  const { id, customer, service } = space;
  const { expires } = await api('/v1/workspaces', 'POST', { id, customer, service });
  return { ...space, expires };
}
export function workspace() {
  if (!setup) {
    setup = (
      navigator.locks ? navigator.locks.request(spaceKey, openWorkspace) : openWorkspace()
    ).catch((error) => {
      setup = null;
      throw error;
    });
  }
  return setup.then((space) => {
    if (space.expires <= Date.now()) {
      setup = null;
      return workspace();
    }
    return space;
  });
}
export function grantURL(space, role) {
  const url = new URL('role.html', document.baseURI);
  url.hash = [role, space.id, space[role]].join('/');
  return url.href;
}
export function parseGrant(hash) {
  const parts = hash.replace(/^#/, '').split('/');
  if (
    parts.length !== 3 ||
    !roles.includes(parts[0]) ||
    !uuid.test(parts[1]) ||
    !grantPattern.test(parts[2])
  )
    return null;
  return { role: parts[0], id: parts[1], key: parts[2] };
}
export const listRemote = (id, key) => api('/v1/workspaces/' + id + '/orders', 'GET', null, key);
export const submitRemote = (space, payload) =>
  api('/v1/workspaces/' + space.id + '/orders', 'POST', payload, space.customer);
export const acceptRemote = (id, key, order) =>
  api('/v1/workspaces/' + id + '/orders/' + order + '/accept', 'POST', null, key);
