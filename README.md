# Aardvarkland Web Audit

[Otevřít pracovní prostor](https://michalmachalik.github.io/Aardvarkland-Web-Audit/) · [Web servisu](https://michalmachalik.github.io/Aardvarkland-Web-Audit/servis/)

Český web fiktivního servisu klimatizací. GitHub Pages obsluhuje stránky a kalkulačku. Cloudflare Worker s databází D1 přijímá poptávky, ověřuje cenu podle katalogu a zaznamenává čas převzetí.

| Průchod                                                                           | Co lze ověřit                                                                                                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Kalkulačka](https://michalmachalik.github.io/Aardvarkland-Web-Audit/#kalkulacka) | 1 až 20 jednotek, tři městské části, jedna doprava za návštěvu a celková cena včetně DPH.                                                                 |
| Poptávka                                                                          | Serverové uložení, samostatný odkaz zákazníka a servisní pohled. Převzetí se promítne i do dalšího otevřeného prohlížeče.                                 |
| [SEO audit](https://michalmachalik.github.io/Aardvarkland-Web-Audit/#seo)         | Načte HTML dvou stránek, ověří cíl odkazu, titulky, popisy a hlavní nadpisy. Oprava přepíše odkaz na skutečný oddíl v pracovní kopii a zopakuje kontroly. |
| [GEO odpovědi](https://michalmachalik.github.io/Aardvarkland-Web-Audit/#geo)      | Tři otázky, dvě verze zdrojů, šest uložených výstupů Qwen3. Citace vedou na příslušnou pasáž konkrétní verze ceníku.                                      |

## Převzetí poptávky

V kalkulačce vyberte místo, počet jednotek pro jednu návštěvu, fiktivní kontakt a preferovanou denní dobu. Po odeslání zvolte **Otevřít pohled servisu** a převezměte poptávku. Přes **Otevřít stav vašich poptávek** zákazník uvidí stav a čas převzetí. Oba odkazy fungují i v samostatných prohlížečích. Zákaznický pohled má přístup ke čtení, servisní odkaz dovoluje převzetí.

Přístup k ukázce platí sedm dní od vytvoření pracovního prostoru a je společný pro všechny jeho poptávky. Do prostoru lze uložit až 40 poptávek. Server přijímá pouze předdefinované kontakty a časy. U opakovaného odeslání vrací stejný záznam. Převzetí uchovává první čas potvrzení. Po skončení platnosti denní úloha odstraní prostor i poptávky. Prohlížeč uchovává přístupové údaje k dané ukázce. Dřívější lokální záznamy jsou v samostatném archivu.

## Data a měření

`data/service.json` je zdrojem kalkulačky a HTML ceníku. `docs/archiv/` uchovává výchozí verzi s vadným odkazem. Stránky používají `noindex`, protože firma i kontakty jsou smyšlené.

[Záznam GEO testu](docs/assets/geo-report.json) obsahuje vstupy, přesné odpovědi, parametry a identifikaci modelu. Test měří doložitelnost odpovědí nad dodanými pasážemi. Pro opakování slouží [skript pro llama.cpp](tools/replay_geo.py). [Mobilní měření](docs/assets/mobile-report.json) obsahuje tři laboratorní běhy Lighthouse nad veřejnou adresou servisní stránky a medián každé metriky. Přehled lze sestavit příkazem `node tools/mobile-report.mjs run1.json run2.json run3.json docs/assets/mobile-report.json`.

## Spuštění a testy

Vyžaduje Node.js 22 nebo novější a Python 3. Pro celý průchod běží dvě služby. Statický server na portu 4589 zobrazuje web, kalkulačku a audity. Worker na portu 8799 obsluhuje poptávky a používá místní kopii D1.

**1. Sestavte web, připravte schéma a spusťte statický server.**

```sh
npm ci
npm run build
npm test
npx wrangler d1 execute DB --local --file server/schema.sql
python -m http.server 4589 --bind 127.0.0.1 --directory docs
```

**2. Ve druhém terminálu spusťte API.**

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 8799
```

Otevřete [pracovní prostor](http://127.0.0.1:4589/). Pro ověření celého průchodu ponechte obě služby spuštěné a v dalším terminálu spusťte testy.

```sh
npx playwright install chromium firefox webkit
node --test tests/server.mjs
npm run test:browser
node tests/recovery.mjs
node tests/handover.mjs
```

Pro test nasazené verze nastavte `AUDIT_URL` na kořen aplikace včetně koncového lomítka. GitHub Pages publikuje adresář `docs/` z větve `main`.

Pro samostatné nasazení API vytvořte vlastní databázi D1. Zkopírujte `wrangler.jsonc` do `wrangler.remote.jsonc` a doplňte její identifikátor. Použijte `wrangler d1 execute DB --remote --config wrangler.remote.jsonc --file server/schema.sql` a `wrangler deploy --config wrangler.remote.jsonc`. Pro vlastní doménu nastavte veřejnou adresu v `docs/assets/service-api.js` a povolený původ ve Workeru.
