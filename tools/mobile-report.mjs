import { readFile, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
if (args.length !== 4)
  throw new Error('Usage: node tools/mobile-report.mjs run1.json run2.json run3.json output.json');
const url = 'https://michalmachalik.github.io/Aardvarkland-Web-Audit/servis/';
const output = args.pop();
const reports = await Promise.all(
  args.map(async (file) => JSON.parse(await readFile(file, 'utf8'))),
);
const version = reports[0].lighthouseVersion;
const runs = reports
  .map((r) => {
    if (
      r.runtimeError ||
      r.requestedUrl !== url ||
      r.finalDisplayedUrl !== url ||
      r.configSettings.formFactor !== 'mobile' ||
      r.configSettings.throttlingMethod !== 'simulate' ||
      r.lighthouseVersion !== version ||
      !Number.isFinite(Date.parse(r.fetchTime))
    )
      throw new Error('Expected comparable mobile measurements of the public service page.');
    const performance = r.categories.performance.score;
    const accessibility = r.categories.accessibility.score;
    const largestContentfulPaintMs = r.audits['largest-contentful-paint'].numericValue;
    const cumulativeLayoutShift = r.audits['cumulative-layout-shift'].numericValue;
    if (
      ![performance, accessibility, largestContentfulPaintMs, cumulativeLayoutShift].every(
        (n) => Number.isFinite(n) && n >= 0,
      ) ||
      performance > 1 ||
      accessibility > 1
    )
      throw new Error('Incomplete Lighthouse metrics.');
    return {
      date: r.fetchTime,
      performance: Math.round(performance * 100),
      accessibility: Math.round(accessibility * 100),
      largestContentfulPaintMs,
      cumulativeLayoutShift,
    };
  })
  .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
if (new Set(runs.map((run) => Date.parse(run.date))).size !== 3)
  throw new Error('Expected three distinct Lighthouse runs.');
const median = (key) => runs.map((run) => run[key]).sort((a, b) => a - b)[1];
const measurements = {
  largestContentfulPaintMs: median('largestContentfulPaintMs'),
  cumulativeLayoutShift: median('cumulativeLayoutShift'),
};
const result = {
  date: runs.at(-1).date,
  page: 'servis/',
  url,
  lighthouseVersion: version,
  platform: 'mobile',
  throttling: 'simulate',
  runs,
  metrics: {
    Výkon: median('performance') + '/100',
    Přístupnost: median('accessibility') + '/100',
    LCP:
      (measurements.largestContentfulPaintMs / 1000).toLocaleString('cs-CZ', {
        maximumFractionDigits: 2,
      }) + ' s',
    CLS: measurements.cumulativeLayoutShift.toLocaleString('cs-CZ', {
      maximumFractionDigits: 5,
    }),
  },
  measurements,
  source:
    'Tři laboratorní měření veřejného servisního webu s mobilním profilem. Souhrn uvádí medián každé metriky.',
};
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
