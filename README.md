# Aardvarkland Web Audit

[Otevřít pracovní prostor](https://michalmachalik.github.io/Aardvarkland-Web-Audit/) · [Web servisu](https://michalmachalik.github.io/Aardvarkland-Web-Audit/servis/)

Statická aplikace v češtině pro fiktivní servis klimatizací. Veřejný web a ceník fungují také bez JavaScriptu. Interaktivní pracovní prostor používá ES moduly a Web Storage.

| Průchod                                                                           | Co lze ověřit                                                                                                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Kalkulačka](https://michalmachalik.github.io/Aardvarkland-Web-Audit/#kalkulacka) | 1 až 20 jednotek, tři městské části, jedna doprava za návštěvu a celková cena včetně DPH.                                                                 |
| Poptávka                                                                          | Přenos kalkulace, volba fiktivního kontaktu a potvrzení s identifikátorem. Záznam se ukládá pouze do prohlížeče návštěvníka.                              |
| [SEO audit](https://michalmachalik.github.io/Aardvarkland-Web-Audit/#seo)         | Načte HTML dvou stránek, ověří cíl odkazu, titulky, popisy a hlavní nadpisy. Oprava přepíše odkaz na skutečný oddíl v pracovní kopii a zopakuje kontroly. |
| [GEO odpovědi](https://michalmachalik.github.io/Aardvarkland-Web-Audit/#geo)      | Tři otázky, dvě verze zdrojů, šest uložených výstupů Qwen3. Citace vedou na příslušnou pasáž konkrétní verze ceníku.                                      |

## Data a měření

`data/service.json` je zdrojem kalkulačky a HTML ceníku. `docs/archiv/` uchovává výchozí verzi s vadným odkazem. Stránky používají `noindex`, protože firma i kontakty jsou smyšlené.

[Záznam GEO testu](docs/assets/geo-report.json) obsahuje vstupy, přesné odpovědi, parametry a identifikaci modelu. Test měří doložitelnost odpovědí nad dodanými pasážemi. Pro opakování slouží [skript pro llama.cpp](tools/replay_geo.py). [Mobilní měření](docs/assets/mobile-report.json) vzniklo v Lighthouse nad servisní stránkou. Nástroj `tools/mobile-report.mjs` převádí výstup Lighthouse do publikovaného přehledu.

## Spuštění a testy

Vyžaduje Node.js 22 nebo novější. Python 3 slouží k místnímu spuštění HTTP serveru.

```sh
npm ci
npm run build
npm test
python -m http.server 4589 --bind 127.0.0.1 --directory docs
```

V druhém terminálu spusťte prohlížečové kontroly.

```sh
npx playwright install chromium firefox webkit
npm run test:browser
node tests/recovery.mjs
```

Pro test nasazené verze nastavte `AUDIT_URL` na kořen aplikace včetně koncového lomítka. GitHub Pages publikuje adresář `docs/` z větve `main`.
