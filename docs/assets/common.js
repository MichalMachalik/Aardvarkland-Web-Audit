export const one = (selector) => document.querySelector(selector);
export const money = (value) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value);
export const titles = {
  prehled: 'Přehled',
  kalkulacka: 'Kalkulačka',
  poptavky: 'Poptávky',
  seo: 'SEO audit',
  geo: 'GEO odpovědi',
};
export function remembered(key) {
  try {
    return sessionStorage.getItem('web-audit.' + key);
  } catch {
    return null;
  }
}
export function remember(key, value) {
  try {
    sessionStorage.setItem('web-audit.' + key, value);
  } catch {
    /* Browsing also works without session storage. */
  }
}
export function element(tag, text, css) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (css) node.className = css;
  return node;
}
export function link(text, href) {
  const a = element('a', text, 'text-link');
  a.href = href;
  return a;
}
export async function resource(url, type = 'json') {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error('Soubor se nepodařilo načíst.');
  return type === 'json' ? response.json() : response.text();
}
const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  calc: 'M5 2h14v20H5z M8 6h8 M8 11h1 M14 11h1 M8 15h1 M14 15h1 M8 18h1 M14 18h1',
  inbox: 'M3 13l3-8h12l3 8v6H3z M3 13h5l2 3h4l2-3h5',
  scan: 'M3 8V4h4 M17 4h4v4 M21 16v4h-4 M7 20H3v-4 M7 12l3 3 6-6',
  quote: 'M5 5h6v7l-4 5H4l3-5H4V5z M15 5h6v7l-4 5h-3l3-5h-3V5z',
  panel: 'M3 4h18v16H3z M9 4v16',
  external: 'M14 3h7v7 M21 3l-11 11 M10 5H4v15h15v-6',
  layers: 'M12 3l9 5-9 5-9-5z M4 12l8 5 8-5 M4 16l8 5 8-5',
  chevron: 'M9 5l7 7-7 7',
};
export function icons() {
  for (const slot of document.querySelectorAll('[data-icon]')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[slot.dataset.icon]);
    svg.append(path);
    slot.replaceWith(svg);
  }
}
