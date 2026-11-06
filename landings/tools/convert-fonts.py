"""One-time asset preparation: Graphik TTF -> subset WOFF2 (Latin + Cyrillic + typographic signs).

Usage (from landings/):  python tools/convert-fonts.py
Requires: pip install fonttools brotli
Subsetting cuts the font roughly in half, which matters for LCP: the hero headline waits for weight 500.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT.parent / "Design System" / "tutoronline-adaptive" / "assets"
OUT = ROOT / "assets" / "fonts"

FONTS = {
    "graphik-400.woff2": "4992573dec4f6a8276d34864e1353d54.ttf",
    "graphik-500.woff2": "da73dcae762abfd8bab78fa597a5bf12.ttf",
}

# Basic Latin + Latin-1, Cyrillic (incl. Ё/ё), punctuation, ₽, №, minus, arrows used in copy.
UNICODES = "U+0020-007E,U+00A0-00FF,U+0400-045F,U+2010-2027,U+2030-203A,U+20BD,U+2116,U+2122,U+2190-2193,U+2212"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "calt", "tnum", "lnum"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    for target, source in FONTS.items():
        font = TTFont(BASE / source)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(OUT / target)
        print(f"{source} -> {target}: {(OUT / target).stat().st_size} bytes")


if __name__ == "__main__":
    main()
