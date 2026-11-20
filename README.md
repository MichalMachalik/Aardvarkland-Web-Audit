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

V kalkulačce vyberte místo, počet jednotek a jeden z fiktivních kontaktů. Po odeslání otevřete **Pohled servisu**, převezměte poptávku a v **Potvrzení zákazníka** ověřte stav a čas převzetí. Oba odkazy fungují i v samostatných prohlížečích. Zákaznický pohled má přístup ke čtení, servisní odkaz dovoluje převzetí.

Pracovní prostor má platnost sedm dní a pojme 40 poptávek. Server přijímá pouze předdefinované kontakty a časy. U opakovaného odeslání vrací stejný záznam. Převzetí uchovává první čas potvrzení. Po skončení platnosti denní úloha odstraní prostor i poptávky. Prohlížeč uchovává přístupové údaje k dané ukázce. Dřívější lokální záznamy jsou v samostatném archivu.

## Data a měření

`data/service.json` je zdrojem kalkulačky a HTML ceníku. `docs/archiv/` uchovává výchozí verzi s vadným odkazem. Stránky používají `noindex`, protože firma i kontakty jsou smyšlené.

[Záznam GEO testu](docs/assets/geo-report.json) obsahuje vstupy, přesné odpovědi, parametry a identifikaci modelu. Test měří doložitelnost odpovědí nad dodanými pasážemi. Pro opakování slouží [skript pro llama.cpp](tools/replay_geo.py). [Mobilní měření](docs/assets/mobile-report.json) obsahuje tři laboratorní běhy Lighthouse nad veřejnou adresou servisní stránky a medián každé metriky. Přehled lze sestavit příkazem `node tools/mobile-report.mjs run1.json run2.json run3.json docs/assets/mobile-report.json`.

## Spuštění a testy

Vyžaduje Node.js 22 nebo novější. Python 3 slouží k místnímu spuštění HTTP serveru.

```sh
npm ci
npm run build
npm test
npx wrangler d1 execute DB --local --file server/schema.sql
python -m http.server 4589 --bind 127.0.0.1 --directory docs
```

Ve druhém terminálu spusťte API pomocí `npx wrangler dev --local --ip 127.0.0.1 --port 8799`. Web poté otevřete na `http://127.0.0.1:4589/`. V dalším terminálu lze ověřit server a uživatelské průchody.

```sh
npx playwright install chromium firefox webkit
node --test tests/server.mjs
npm run test:browser
node tests/recovery.mjs
node tests/handover.mjs
```

Pro test nasazené verze nastavte `AUDIT_URL` na kořen aplikace včetně koncového lomítka. GitHub Pages publikuje adresář `docs/` z větve `main`.

Pro samostatné nasazení API vytvořte vlastní databázi D1. Zkopírujte `wrangler.jsonc` do `wrangler.remote.jsonc` a doplňte její identifikátor. Použijte `wrangler d1 execute DB --remote --config wrangler.remote.jsonc --file server/schema.sql` a `wrangler deploy --config wrangler.remote.jsonc`. Pro vlastní doménu nastavte veřejnou adresu v `docs/assets/service-api.js` a povolený původ ve Workeru.
