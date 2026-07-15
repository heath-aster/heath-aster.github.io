#!/usr/bin/env python3

import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "_data" / "presentations.json"
OUTPUT = ROOT / "_generated" / "cv_presentations.tex"


def tex_escape(text: str) -> str:
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(char, char) for char in text)


def load_talks() -> list[dict]:
    data = json.loads(SOURCE.read_text())
    talks = []
    for project in data["projects"].values():
        talks.extend(project["talks"])
    return talks


def sort_key(talk: dict) -> tuple[int, int]:
    year_str, month_str = talk["date"].split("-", 1)
    return int(year_str), int(month_str)


def build_year_entries(talks: list[dict]) -> dict[int, dict[str, list[str]]]:
    grouped = defaultdict(lambda: {"past": [], "upcoming": []})
    seen = defaultdict(set)

    eligible = [talk for talk in talks if talk.get("include_in_cv")]
    for talk in sorted(eligible, key=sort_key):
        year = int(talk["date"][:4])
        label = talk.get("cv_label", talk["venue"])
        bucket = "upcoming" if talk.get("upcoming") else "past"
        if label in seen[(year, bucket)]:
            continue
        seen[(year, bucket)].add(label)
        grouped[year][bucket].append(label)

    return grouped


def render_year(year: int, entries: dict[str, list[str]]) -> str:
    parts = []
    if entries["past"]:
        parts.append(", ".join(tex_escape(label) for label in entries["past"]))
    if entries["upcoming"]:
        scheduled = ", ".join(tex_escape(label) for label in entries["upcoming"])
        parts.append(r"\textit{Scheduled: " + scheduled + "}")
    return r"\regentry{" + "; ".join(parts) + "}{" + str(year) + "}"


def main() -> None:
    talks = load_talks()
    year_entries = build_year_entries(talks)

    lines = [
        "% Generated from _data/presentations.json by scripts/generate_cv_presentations.py"
    ]
    for year in sorted(year_entries, reverse=True):
        lines.append(render_year(year, year_entries[year]))

    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
