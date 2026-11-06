"""One-time asset preparation: tutor photos -> WebP + AVIF at 160/320/500/640 px.

Usage (from landings/):  python tools/convert-images.py
Requires: pip install "pillow>=11.2"  (AVIF support)
No upscaling: widths above the source width are skipped.
"""
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT.parent / "Design System" / "tutoronline-adaptive" / "assets"
OUT = ROOT / "assets" / "tutors"
WIDTHS = (160, 320, 500, 640)

SOURCES = {
    "roman-yurievich": "754ff25f1ef0dfcda810fa24054075ca.jpg",
    "amet-memetovich": "90384372b5bf63caff9218e6f7edfd97.jpg",
    "galina-vladimirovna": "c85036e15b776c226936397210041fe3.jpg",
    "evgenia-nikolaevna": "3fc880345ec02d1e591f47bb318e99a7.jpg",
    "rustam-ravilevich": "5565c44c6df69d1d34027fa8c3734ee1.jpg",
    "pavel-stepanovich": "6ed1be156fbedf6fd5e5f4e369b702fa.webp",
    "inna-ivanovna": "6669d86ffbc4f90f53f4762d4381736c.webp",
    "ekaterina-olegovna": "fef4129c2c0cf78e0fdb37cbd8e3ce59.webp",
}


def main() -> None:
    if not features.check("avif"):
        raise SystemExit("Pillow without AVIF support: pip install 'pillow>=11.2'")
    OUT.mkdir(parents=True, exist_ok=True)
    for tutor_id, source in SOURCES.items():
        image = Image.open(BASE / source)
        image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
        made = []
        for width in WIDTHS:
            if width > image.width:
                continue
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.LANCZOS)
            resized.save(OUT / f"{tutor_id}-{width}.webp", "WEBP", quality=80, method=6)
            resized.save(OUT / f"{tutor_id}-{width}.avif", "AVIF", quality=55)
            made.append(width)
        print(f"{tutor_id}: source {image.width}x{image.height}, widths {made}")


if __name__ == "__main__":
    main()
