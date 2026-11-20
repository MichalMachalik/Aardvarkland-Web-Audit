import { readFile, writeFile } from 'node:fs/promises';
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error('Usage: node tools/mobile-report.mjs report.json output.json');
const r = JSON.parse(await readFile(input, 'utf8'));
if (
  r.runtimeError ||
  r.configSettings.formFactor !== 'mobile' ||
  !new URL(r.finalDisplayedUrl).pathname.endsWith('/servis/')
)
  throw new Error('Expected a completed mobile service-page audit');
const result = {
  date: r.fetchTime,
  page: 'servis/',
  lighthouseVersion: r.lighthouseVersion,
  platform: r.configSettings.formFactor,
  throttling: r.configSettings.throttlingMethod,
  metrics: {
    Výkon: Math.round(r.categories.performance.score * 100) + '/100',
    Přístupnost: Math.round(r.categories.accessibility.score * 100) + '/100',
    LCP:
      (r.audits['largest-contentful-paint'].numericValue / 1000).toLocaleString('cs-CZ', {
        maximumFractionDigits: 2,
      }) + ' s',
    CLS: r.audits['cumulative-layout-shift'].numericValue.toLocaleString('cs-CZ', {
      maximumFractionDigits: 4,
    }),
  },
  measurements: {
    largestContentfulPaintMs: r.audits['largest-contentful-paint'].numericValue,
    cumulativeLayoutShift: r.audits['cumulative-layout-shift'].numericValue,
  },
  source: 'Jedno laboratorní měření místní kopie servisního webu s mobilním profilem.',
};
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
