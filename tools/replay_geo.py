"""Replay six independent source-grounded questions using a local llama.cpp server.

Start llama-server b12556 with the model below, --host 127.0.0.1 --port 8138
--alias geo-demo --ctx-size 4096 --parallel 1 --threads 6 --n-gpu-layers 0.
Run python replay_geo.py --output new-geo-report.json and compare the answers.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.request import Request, urlopen


MODEL = "Qwen3-4B-Instruct-2507-Q4_K_M"
MODEL_REVISION = "a06e946bb6b655725eafa393f4a9745d460374c9"
MODEL_SHA256 = "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597"
SOURCES = {
    "before": {
        "cena": "Cena servisu se odvíjí od počtu nástěnných jednotek.",
        "doprava": "Servis zajišťujeme v Praze.",
        "rozsah": "Při servisu kontrolujeme provoz klimatizace.",
    },
    "after": {
        "cena": "Servis jedné nástěnné jednotky stojí 1 200 Kč včetně DPH. Cena se násobí počtem jednotek.",
        "doprava": "Doprava za jednu návštěvu stojí 0 Kč pro Prahu 6, 250 Kč pro Prahu 5 a 400 Kč pro Prahu 4.",
        "rozsah": "Servis zahrnuje čištění filtrů, kontrolu odvodu kondenzátu a zkoušku chlazení.",
    },
}
QUESTIONS = {
    "cena": "Kolik zaplatím za servis tří nástěnných jednotek na Praze 6 včetně dopravy?",
    "rozsah": "Jaké práce servis klimatizace zahrnuje?",
    "vikend": "Přijedete na servis také v sobotu?",
}
INSTRUCTION = (
    "Jsi český redaktor. Odpověz česky jednou až dvěma stručnými větami na otázku "
    "zákazníka výhradně podle dodaných pasáží. Při dotazu na celkovou cenu ji "
    "spočítej, pokud jsou uvedeny všechny částky. Uveď celkovou cenu jen jednou. "
    "Když odpověď nelze zjistit, použij jedinou větu začínající slovy „Web neuvádí“, "
    "pojmenuj chybějící údaj a vynech okolní detaily. Absence údaje neznamená, že "
    "služba není k dispozici. "
    "Vrať JSON s poli answer (text bez značek citací) a citations (seznam ID těch "
    "pasáží, z nichž vychází konkrétní sdělené údaje). Jestliže pouze říkáš, "
    "že informace chybí, nech seznam citací prázdný. Cituj pouze relevantní pasáže."
)
SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "citations": {
            "type": "array",
            "items": {"type": "string", "enum": list(SOURCES["after"])},
        },
    },
    "required": ["answer", "citations"],
    "additionalProperties": False,
}
OPTIONS = {"temperature": 0, "seed": 42, "max_tokens": 300}


def query(endpoint, question, sources):
    passages = "\n".join(f"[{anchor}] {content}" for anchor, content in sources.items())
    messages = [
        {"role": "system", "content": INSTRUCTION},
        {"role": "user", "content": f"Pasáže webu:\n{passages}\n\nOtázka: {question}"},
    ]
    payload = {
        "model": "geo-demo",
        "messages": messages,
        "response_format": {
            "type": "json_schema", "json_schema": {"name": "answer", "schema": SCHEMA}
        },
        **OPTIONS,
    }
    request = Request(endpoint, data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=360) as response:
        completion = json.load(response)["choices"][0]
    if completion["finish_reason"] != "stop":
        raise ValueError(f"Incomplete generation: {completion['finish_reason']}")
    raw = completion["message"]["content"]
    parsed = json.loads(raw)
    if (set(parsed) != {"answer", "citations"} or not parsed["answer"].strip()
            or not isinstance(parsed["citations"], list)
            or any(anchor not in sources for anchor in parsed["citations"])):
        raise ValueError("Invalid answer or citation")
    return {**parsed, "raw": raw}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default="http://127.0.0.1:8138/v1/chat/completions")
    parser.add_argument("--output", type=Path, default=Path("new-geo-report.json"))
    args = parser.parse_args()
    cases = []
    for case_id, question in QUESTIONS.items():
        case = {"id": case_id, "question": question}
        for version, passages in SOURCES.items():
            case[version] = query(args.endpoint, question, passages)
            print(f"{case_id} / {version} complete", flush=True)
        cases.append(case)
    report = {
        "model": MODEL, "modelSha256": MODEL_SHA256, "engine": "llama.cpp b12556",
        "modelFile": f"https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/{MODEL_REVISION}/{MODEL}.gguf",
        "recordedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "instruction": INSTRUCTION, "sampling": OPTIONS, "sources": SOURCES, "cases": cases,
    }
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
