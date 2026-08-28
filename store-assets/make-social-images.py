#!/usr/bin/env python3
"""
Paylaşılabilir söz görselleri üretir — uygulamanın kendi fontu ve rengiyle.

Bir söz uygulamasının pazarlama malzemesi zaten ürünün içinde: sözlerin kendisi.
Bu betik `src/data/quotes.json`'dan kısa ve vurucu olanları seçip üç formatta
kart üretiyor (Instagram karesi, story/TikTok, Pinterest), her biri hem Türkçe
hem İngilizce.

    python3 store-assets/make-social-images.py [--count 24] [--out ~/Desktop/DriftStop-Social]

Bağımlılık yok: HTML üretilip **headless Chrome** ile piksel tam render ediliyor,
sonra `sips` ile JPEG'e çevriliyor. ImageMagick gerekmiyor (bu makinede yok).
Fontlar `node_modules/@expo-google-fonts` içinden base64 gömülüyor, böylece kart
uygulamayla aynı el yazısını kullanıyor.
"""
import argparse, base64, html, json, os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Instagram karesi · story/Reels/TikTok · Pinterest
FORMATS = {"instagram-kare": (1080, 1080), "story-tiktok": (1080, 1920), "pinterest": (1000, 1500)}

TPL = """<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Caveat;src:url(data:font/ttf;base64,__CAVEAT__) format('truetype');}
@font-face{font-family:Kalam;src:url(data:font/ttf;base64,__KALAM__) format('truetype');}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:__W__px;height:__H__px;overflow:hidden}
body{background:#1C1A16;position:relative;-webkit-font-smoothing:antialiased}
.glow{position:absolute;inset:0;background:radial-gradient(__GW__px __GH__px at 50% 38%,rgba(200,146,58,.11),transparent 70%)}
.margin{position:absolute;left:__ML__px;top:0;bottom:0;width:2px;background:rgba(150,70,50,.26)}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:0 __PAD__px;text-align:center}
.mark{font-family:Caveat;font-size:__MARK__px;color:rgba(200,146,58,.5);line-height:.6;margin-bottom:__MG__px}
.q{font-family:Caveat;font-size:__QS__px;line-height:1.3;color:#F0EAD6}
.by{font-family:Kalam;font-size:__BY__px;color:#C8923A;margin-top:__BM__px}
.brand{position:absolute;left:0;right:0;bottom:__BB__px;display:flex;align-items:center;justify-content:center;gap:14px}
.brand img{width:__FL__px;height:__FL__px;object-fit:contain}
.brand span{font-family:Caveat;font-size:__BS__px;color:#9C9075}
</style>
<div class="glow"></div><div class="margin"></div>
<div class="wrap">
  <div class="mark">&ldquo;</div>
  <div class="q">__TEXT__</div>
  <div class="by">— __AUTHOR__</div>
</div>
<div class="brand"><img src="data:image/png;base64,__FLAME__"><span>DriftStop</span></div>"""


def b64(rel: str) -> str:
    return base64.b64encode((ROOT / rel).read_bytes()).decode()


def page(text: str, author: str, w: int, h: int, fonts: dict) -> str:
    scale = w / 1080
    # Uzun sözde punto düşür, yoksa karttan taşıyor.
    qs = 74 if len(text) < 60 else (64 if len(text) < 90 else 56)
    vals = {
        "__W__": w, "__H__": h, "__GW__": int(700 * scale), "__GH__": int(700 * scale * h / w),
        "__ML__": int(104 * scale), "__PAD__": int(96 * scale),
        "__MARK__": int(130 * scale), "__MG__": int(30 * scale),
        "__QS__": int(qs * scale), "__BY__": int(38 * scale), "__BM__": int(52 * scale),
        "__BB__": int(90 * scale), "__FL__": int(54 * scale), "__BS__": int(46 * scale),
        "__TEXT__": html.escape(text), "__AUTHOR__": html.escape(author), **fonts,
    }
    out = TPL
    for k, v in vals.items():
        out = out.replace(k, str(v))
    return out


def pick(count: int):
    quotes = json.loads((ROOT / "src/data/quotes.json").read_text(encoding="utf8"))
    # Karta sığsın diye kısa olanlar; aynı yazardan en fazla iki tane.
    short = [q for q in quotes if 25 <= len(q["text"]) <= 95 and len(q["textTr"]) <= 95]
    seen, out = {}, []
    for q in short:
        if seen.get(q["author"], 0) >= 2:
            continue
        seen[q["author"]] = seen.get(q["author"], 0) + 1
        out.append(q)
        if len(out) >= count:
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=24)
    ap.add_argument("--out", default=os.path.expanduser("~/Desktop/DriftStop-Social"))
    a = ap.parse_args()

    if not os.path.exists(CHROME):
        print("Chrome bulunamadı:", CHROME); return 1

    fonts = {
        "__CAVEAT__": b64("node_modules/@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf"),
        "__KALAM__": b64("node_modules/@expo-google-fonts/kalam/400Regular/Kalam_400Regular.ttf"),
        "__FLAME__": b64("assets/images/android-icon-foreground.png"),
    }
    dest = pathlib.Path(a.out)
    tmp = dest / ".html"
    tmp.mkdir(parents=True, exist_ok=True)

    made = 0
    for i, q in enumerate(pick(a.count)):
        for lang, key in (("tr", "textTr"), ("en", "text")):
            for name, (w, h) in FORMATS.items():
                (dest / name).mkdir(parents=True, exist_ok=True)
                stem = f"{i:02d}-{lang}"
                src = tmp / f"{stem}-{name}.html"
                src.write_text(page(q[key], q["author"], w, h, fonts), encoding="utf8")
                png = tmp / f"{stem}-{name}.png"
                subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                                "--force-device-scale-factor=1", f"--window-size={w},{h}",
                                f"--screenshot={png}", f"file://{src}"],
                               capture_output=True)
                subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "88",
                                str(png), "--out", str(dest / name / f"{stem}.jpg")],
                               capture_output=True)
                made += 1
                print(f"  {stem}-{name}", flush=True)
    print(f"\n{made} görsel → {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
