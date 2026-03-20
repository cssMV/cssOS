import json
import os
from pathlib import Path

lang = os.environ["CSS_LANG"]
title_hint = os.environ.get("CSS_TITLE_HINT", "")
prompt_json = Path(os.environ["CSS_PROMPT_JSON"])
out_json = Path(os.environ["CSS_OUT_JSON"])

prompt = json.loads(prompt_json.read_text(encoding="utf-8"))

title = title_hint.strip() or "Untitled"

data = {
    "schema": "css.lyrics.v1",
    "lang": lang,
    "title": title,
    "lines": [
        {"t": 0.0, "text": f"{title}"},
        {"t": 1.5, "text": "A new song begins"},
        {"t": 3.0, "text": "cssMV keeps moving"},
    ],
}

out_json.parent.mkdir(parents=True, exist_ok=True)
out_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
