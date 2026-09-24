#!/usr/bin/env python3
"""Assemble the self-contained single-file JEE PCM Tracker app.

Output: /home/user/jee-tracker.html  (all CSS, JS and the syllabus database inline,
so it works from the file system, from a static server, and inside sandboxed previews)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_syllabus import build_syllabus

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "jee-tracker.html")

JS_ORDER = [
    "js/core.js", "js/gemini.js", "js/ui.js", "js/forms.js",
    "js/screens1.js", "js/screens2.js", "js/screens3.js",
    "js/sample.js", "js/app.js",
]

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FBF6EC">
<meta name="description" content="JEE PCM Syllabus &amp; Performance Tracker - official JEE Main 2026 and JEE Advanced 2026 syllabus tracking, lectures, revisions, questions, error book, mock tests, analytics and Gemini analysis.">
<title>JEE PCM Syllabus &amp; Performance Tracker</title>
<style>
%s
</style>
</head>
<body>
<div class="app" id="app"></div>
<noscript><div style="padding:20px">This tracker needs JavaScript.</div></noscript>
<script>
/* ---- syllabus database: official JEE Main 2026 (NTA) + JEE Advanced 2026 (IIT Roorkee) ---- */
window.__SYLLABUS__ = %s;
</script>
<script>
%s
</script>
</body>
</html>
"""


def main():
    syl = build_syllabus()
    with open(os.path.join(SRC, "styles.css"), encoding="utf-8") as fh:
        css = fh.read()
    parts = []
    for rel in JS_ORDER:
        p = os.path.join(SRC, rel)
        with open(p, encoding="utf-8") as fh:
            parts.append("/* ===== %s ===== */\n%s" % (rel, fh.read()))
    js = "\n".join(parts)
    syl_json = json.dumps(syl, ensure_ascii=False, separators=(",", ":"))
    html = HEAD % (css, syl_json, js)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    kb = os.path.getsize(OUT) / 1024
    print("built %s (%.0f KB)" % (OUT, kb))
    print("  css %.0f KB | syllabus %.0f KB | js %.0f KB" % (len(css) / 1024, len(syl_json) / 1024, len(js) / 1024))


if __name__ == "__main__":
    main()
