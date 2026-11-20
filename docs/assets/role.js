import { one } from './common.js';
import { parseGrant } from './service-api.js';
import { connectInbox } from './inbox.js';
let stop;
function open() {
  stop?.();
  const grant = parseGrant(location.hash);
  one('#orders').replaceChildren();
  one('#refresh').hidden = !grant;
  if (!grant) {
    one('#role-title').textContent = 'Neplatný přístupový odkaz';
    one('#role-intro').textContent = 'Otevřete nový odkaz ze sekce Poptávky.';
    one('#sync').textContent = '';
    return;
  }
  const service = grant.role === 'service';
  one('#role-title').textContent = service ? 'Převzetí servisem' : 'Potvrzení zákazníka';
  document.title = one('#role-title').textContent + ' · Web Audit';
  one('#role-intro').textContent = service
    ? 'Převezměte poptávku. Zákazník uvidí čas potvrzení.'
    : 'Po převzetí servisem se zde automaticky zobrazí potvrzení.';
  stop = connectInbox({
    grant,
    box: one('#orders'),
    status: one('#sync'),
    refresh: one('#refresh'),
    role: grant.role,
  });
}
open();
window.addEventListener('hashchange', open);
