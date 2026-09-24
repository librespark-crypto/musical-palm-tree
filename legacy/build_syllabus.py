#!/usr/bin/env python3
"""Decode the compact syllabus JSON into the full app syllabus + build the single-file app."""
import json, os, re, sys, hashlib, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "src", "data")

MAP = {"b": (True, True), "m": (True, False), "a": (False, True)}

def slug(text, used=None):
    s = text.lower()
    s = s.replace("&", " and ").replace("/", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-+", "-", s)
    return s or "x"

def decode_chapter(raw, subject_code, cidx):
    jm = ja = False
    topics = []
    for ti, t in enumerate(raw.get("topics", [])):
        tjm, tja = MAP[t["e"]]
        tid = f"{subject_code}.c{cidx}.t{ti}"
        subs = []
        for si, s in enumerate(t.get("subs", [])):
            mark, _, name = s.partition(": ")
            sjm, sja = MAP[mark.strip()]
            subs.append({
                "id": f"{tid}.s{si}",
                "name": name.strip(),
                "jm": sjm,
                "ja": sja,
                "slug": slug(name),
            })
            tjm = tjm or sjm
            tja = tja or sja
        topic = {
            "id": tid,
            "name": t["n"],
            "jm": tjm,
            "ja": tja,
            "slug": slug(t["n"]),
        }
        if t.get("note"):
            topic["note"] = t["note"]
        topic["subs"] = subs
        topics.append(topic)
        jm = jm or tjm
        ja = ja or tja
    ch = {
        "id": f"{subject_code}.c{cidx}",
        "name": raw["n"],
        "unit": raw.get("unit", ""),
        "jm": jm,
        "ja": ja,
        "slug": slug(raw["n"]),
        "topics": topics,
    }
    for key in ("srcJM", "srcJA", "note"):
        if raw.get(key):
            ch[key] = raw[key]
    return ch

def load_subject(files, subject_code):
    chapters = []
    meta = {}
    for f in files:
        with open(os.path.join(DATA, f), encoding="utf-8") as fh:
            raw = json.load(fh)
        meta = {k: raw[k] for k in ("subject",) if k in raw}
        for c in raw.get("chapters", []):
            chapters.append(decode_chapter(c, subject_code, len(chapters)))
    return chapters, meta

def build_syllabus():
    subjects = []
    for name, code, files in (
        ("Physics", "phy", ["physics_a.json", "physics_b.json"]),
        ("Chemistry", "chem", ["chem_a.json", "chem_b.json"]),
        ("Mathematics", "math", ["math.json"]),
    ):
        chapters, _ = load_subject(files, code)
        subjects.append({"name": name, "code": code, "chapters": chapters})
    return {
        "meta": {
            "mainYear": 2026,
            "advancedYear": 2026,
            "mainSource": "Syllabus for JEE (Main) 2026, Paper 1 (B.E./B.Tech.) - Mathematics, Physics and Chemistry, National Testing Agency (NTA)",
            "mainUrl": "https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf",
            "advancedSource": "JEE (Advanced) 2026 Syllabus, Joint Admission Board / IIT Roorkee, jeeadv.ac.in",
            "advancedUrl": "https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf",
            "retrieved": "2026-09-24",
            "note": "Structure used in the app: SUBJECT -> CHAPTER/UNIT -> TOPIC -> SUBTOPIC. JM = JEE Main, JA = JEE Advanced. Marker text is taken from the official syllabus documents listed above.",
        },
        "subjects": subjects,
    }

def stats(syl):
    for s in syl["subjects"]:
        t = sum(len(c["topics"]) for c in s["chapters"])
        sub = sum(len(tp["subs"]) for c in s["chapters"] for tp in c["topics"])
        jm = sum(1 for c in s["chapters"] for tp in c["topics"] for x in tp["subs"] if x["jm"])
        ja = sum(1 for c in s["chapters"] for tp in c["topics"] for x in tp["subs"] if x["ja"])
        print(f"{s['name']:12s} chapters={len(s['chapters']):3d} topics={t:4d} subtopics={sub:4d} JM-leaves={jm:4d} JA-leaves={ja:4d}")
    tot = sum(len(c["topics"]) for s in syl["subjects"] for c in s["chapters"])
    subs = sum(len(tp["subs"]) for s in syl["subjects"] for c in s["chapters"] for tp in c["topics"])
    print(f"TOTAL chapters={sum(len(s['chapters']) for s in syl['subjects'])} topics={tot} subtopics={subs}")

if __name__ == "__main__":
    syl = build_syllabus()
    stats(syl)
    if "--dump" in sys.argv:
        out = os.path.join(ROOT, "src", "data", "syllabus.full.json")
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(syl, fh, ensure_ascii=False, separators=(",", ":"))
        print("wrote", out, os.path.getsize(out), "bytes")
