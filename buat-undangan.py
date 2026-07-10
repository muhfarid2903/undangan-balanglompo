#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
buat-undangan.py — generator undangan dari sebuah model di demo/.

Satu file untuk SEMUA model. Menyalin demo/<model> -> pesanan/<slug>,
mengganti blok CONFIG di index.html dengan data pelanggan, lalu mengolah
foto (galeri jumlah-bebas + thumbnail + WebP, background, foto pasangan).

Butuh: Python 3.8+, Pillow  (pip install Pillow)

Pemakaian:
    python buat-undangan.py pesanan-input/bima-alika
    python buat-undangan.py pesanan-input/bima-alika --force

Struktur folder input:
    pesanan-input/bima-alika/
      data.json        <- lihat contoh di README bawah file ini
      foto/            <- foto mentah pelanggan (nama bebas, dirujuk dari data.json)

Hasil:
    pesanan/<slug>/    <- undangan siap di-push (GitHub Pages)
"""

import argparse
import itertools
import json
import re
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow belum terpasang. Jalankan: pip install Pillow")

ROOT = Path(__file__).resolve().parent
DEMO_DIR = ROOT / "demo"
OUT_DIR = ROOT / "pesanan"

# Ukuran olah gambar
THUMB_MAX_W = 700       # lebar maksimum thumbnail grid galeri
FULL_MAX_W = 1600       # lebar maksimum foto galeri penuh (lightbox)
BG_MAX_W = 1920         # lebar maksimum background
WEBP_Q = 80
JPG_Q = 85

CONFIG_RE = re.compile(r"(const CONFIG = )(\{.*?\n\});", re.S)


# --------------------------------------------------------------------------- #
# util
# --------------------------------------------------------------------------- #
def die(msg):
    sys.exit(f"✗ {msg}")


def info(msg):
    print(f"  {msg}")


def deep_merge(base, over):
    """Gabung dict `over` ke `base` secara rekursif (over menang)."""
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v
    return base


def read_model_config(model_index):
    src = model_index.read_text(encoding="utf-8")
    m = CONFIG_RE.search(src)
    if not m:
        die(f"Blok CONFIG tak ditemukan di {model_index}")
    return json.loads(m.group(2))


def write_config(index_path, cfg):
    src = index_path.read_text(encoding="utf-8")
    dumped = json.dumps(cfg, ensure_ascii=False, indent=2)
    new = CONFIG_RE.sub(lambda m: m.group(1) + dumped + ";", src, count=1)
    index_path.write_text(new, encoding="utf-8")


def load_image(path):
    im = Image.open(path)
    # buang orientasi EXIF agar tidak terputar, dan ratakan alpha ke putih
    try:
        from PIL import ImageOps
        im = ImageOps.exif_transpose(im)
    except Exception:
        pass
    if im.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    return im


def resize_max_w(im, max_w):
    if im.width <= max_w:
        return im
    h = round(im.height * max_w / im.width)
    return im.resize((max_w, h), Image.LANCZOS)


def save_variants(im, dest_jpg, max_w, make_webp=True):
    """Simpan .jpg (+ .webp bila diminta) hasil resize <= max_w."""
    dest_jpg.parent.mkdir(parents=True, exist_ok=True)
    out = resize_max_w(im, max_w)
    out.save(dest_jpg, "JPEG", quality=JPG_Q, optimize=True)
    if make_webp:
        out.save(dest_jpg.with_suffix(".webp"), "WEBP", quality=WEBP_Q, method=6)


# --------------------------------------------------------------------------- #
# langkah utama
# --------------------------------------------------------------------------- #
def process_gallery(data, foto_dir, dest, cfg):
    """Galeri jumlah-bebas: galeri1.. + thumb/ + webp. Tulis CONFIG.gallery."""
    names = data.get("foto", {}).get("galeri")
    if not names:
        info("galeri: tidak ada di data.json — pakai foto bawaan model.")
        return
    gallery_cfg = []
    for i, name in enumerate(names, start=1):
        src = foto_dir / name
        if not src.exists():
            die(f"foto galeri tidak ditemukan: {src}")
        im = load_image(src)
        base = f"galeri{i}"
        save_variants(im, dest / f"{base}.jpg", FULL_MAX_W)                 # penuh (lightbox)
        save_variants(im, dest / "thumb" / f"{base}.jpg", THUMB_MAX_W)      # kecil (grid)
        gallery_cfg.append(f"{base}.webp")   # kode punya fallback .webp -> .jpg
    cfg["gallery"] = gallery_cfg
    cfg["desktopPhoto"] = gallery_cfg[0]
    # buang foto galeri bawaan model yang tersisa di luar jumlah baru (file yatim)
    n = len(gallery_cfg)
    removed = 0
    for f in list(dest.glob("galeri*.*")) + list((dest / "thumb").glob("galeri*.*")):
        mm = re.match(r"galeri(\d+)\.", f.name)
        if mm and int(mm.group(1)) > n:
            f.unlink()
            removed += 1
    if removed:
        info(f"galeri: {removed} berkas bawaan berlebih dibersihkan.")
    # amankan intro photo yang menunjuk galeriN di luar jumlah baru
    for seg in cfg.get("intro", []):
        s = seg.get("src", "")
        mm = re.match(r"galeri(\d+)\.(jpg|webp)$", s)
        if mm and int(mm.group(1)) > n:
            seg["src"] = gallery_cfg[0]
    info(f"galeri: {n} foto (penuh + thumb + webp) OK.")


def process_backgrounds(data, foto_dir, dest, cfg):
    """Background: satu untuk semua, atau per-bagian. Tulis CONFIG.backgrounds."""
    foto = data.get("foto", {})
    dest_bg = dest / "bg"

    def put(name, out_stem):
        src = foto_dir / name
        if not src.exists():
            die(f"background tidak ditemukan: {src}")
        dest_bg.mkdir(parents=True, exist_ok=True)
        save_variants(load_image(src), dest_bg / f"{out_stem}.jpg", BG_MAX_W, make_webp=False)
        return f"bg/{out_stem}.jpg"

    if foto.get("backgrounds"):  # per-bagian: {"opening": "a.jpg", ...}
        for section, name in foto["backgrounds"].items():
            if section not in cfg.get("backgrounds", {}):
                info(f"  (lewati) bagian background tak dikenal: {section}")
                continue
            cfg["backgrounds"][section]["src"] = put(name, f"bg-{section}")
        info(f"background: {len(foto['backgrounds'])} bagian diganti.")
    elif foto.get("background"):  # satu untuk semua bagian
        seksi = list(cfg.get("backgrounds", {}))
        if not seksi:
            # Model tanpa background foto per-bagian (koran/teduh/walasuji):
            # menyalin file hanya akan menghasilkan berkas mati.
            info("background: model ini tak memakai background foto — 'foto.background' diabaikan.")
        else:
            ref = put(foto["background"], "bg")
            for section in seksi:
                cfg["backgrounds"][section]["src"] = ref
            info(f"background: 1 foto dipakai untuk {len(seksi)} bagian.")
    else:
        info("background: tidak diubah — pakai bawaan model.")


def wire_backend(data, slug, dest, cfg):
    """Sambungkan ke backend TERPUSAT: set eventId (=slug) & sheetUrl (URL Web App
    bersama), lalu isi SHEET_URL + EVENT_ID di 3 halaman pengelola."""
    # URL Web App bersama: prioritas data.json > undangan.config.json > config.sheetUrl
    global_cfg = {}
    gpath = ROOT / "undangan.config.json"
    if gpath.exists():
        global_cfg = json.loads(gpath.read_text(encoding="utf-8"))
    url = data.get("sheetUrl") or global_cfg.get("sheetUrl") or cfg.get("sheetUrl") or ""

    cfg["eventId"] = slug            # pemisah data per acara di backend terpusat
    cfg["sheetUrl"] = url            # dipakai index.html (RSVP/ucapan/ping dibuka)

    # halaman pengelola: isi konstanta SHEET_URL & EVENT_ID
    for fn in ("kelola-tamu.html", "dasbor.html", "checkin.html"):
        fp = dest / fn
        if not fp.exists():
            continue
        s = fp.read_text(encoding="utf-8")
        s = s.replace('const SHEET_URL = "";', f'const SHEET_URL = "{url}";', 1)
        s = s.replace('const EVENT_ID = "";', f'const EVENT_ID = "{slug}";', 1)
        fp.write_text(s, encoding="utf-8")
    if url:
        info(f"backend terpusat: eventId='{slug}', sheetUrl terisi (RSVP/tamu/check-in aktif).")
    else:
        info(f"backend terpusat: eventId='{slug}' diset, tapi sheetUrl kosong "
             "(isi undangan.config.json atau data.json untuk mengaktifkan RSVP).")


def process_couple(data, foto_dir, dest, cfg):
    """Foto pria/wanita + cover (opsional)."""
    foto = data.get("foto", {})
    mapping = [
        ("pria", "foto-pria", ("groom", "photo")),
        ("wanita", "foto-wanita", ("bride", "photo")),
    ]
    for key, stem, cfgpath in mapping:
        if foto.get(key):
            src = foto_dir / foto[key]
            if not src.exists():
                die(f"foto {key} tidak ditemukan: {src}")
            save_variants(load_image(src), dest / f"{stem}.jpg", FULL_MAX_W)
            cfg[cfgpath[0]][cfgpath[1]] = f"{stem}.jpg"
            info(f"foto {key}: OK.")
    if foto.get("cover"):
        src = foto_dir / foto["cover"]
        if not src.exists():
            die(f"foto cover tidak ditemukan: {src}")
        save_variants(load_image(src), dest / "cover.jpg", FULL_MAX_W)
        info("cover: OK.")


def remap_aset_model(dest, cfg):
    """Ganti sisa rujukan foto bawaan demo (../_aset/…) dengan foto pelanggan.

    Model koran/teduh/walasuji memakai ../_aset/ di intro & sampul. Path itu benar
    saat model dibuka sebagai demo (demo/<model>/ -> demo/_aset/), tapi begitu
    disalin ke pesanan/<slug>/ ia menunjuk pesanan/_aset/ yang tidak ada — dan
    slide intro tidak punya fallback, jadi gagal diam-diam.
    """
    def hilang(ref):
        return bool(ref) and not (dest / ref).exists()

    # Kandidat pengganti: galeri pelanggan dulu, lalu cover/foto pasangan.
    kandidat = [g for g in cfg.get("gallery", []) if not hilang(g)]
    kandidat += [f for f in ("cover.jpg", "foto-pria.jpg", "foto-wanita.jpg")
                 if not hilang(f)]
    if not kandidat:
        info("aset model: tidak ada foto pelanggan untuk mengganti ../_aset/ — dilewati.")
        return

    diganti = 0
    putar = itertools.cycle(kandidat)

    # 1) Slide intro: bg/src diganti; video bawaan demo dibuang (pelanggan tak punya).
    for seg in cfg.get("intro", []):
        if hilang(seg.get("video")):
            del seg["video"]
            seg.pop("loop", None)
            diganti += 1
        for key in ("bg", "src"):
            if hilang(seg.get(key)):
                seg[key] = next(putar)
                diganti += 1
        # slide yang kehilangan video-nya butuh latar agar tidak kosong
        if seg.get("type") in ("hero", "ayat", "couple", "hormat") \
                and not seg.get("bg") and not seg.get("video"):
            seg["bg"] = next(putar)
            diganti += 1

    # 2) Rujukan tunggal di luar intro.
    if hilang(cfg.get("desktopPhoto")):
        cfg["desktopPhoto"] = kandidat[0]
        diganti += 1
    for who in ("groom", "bride"):
        if hilang(cfg.get(who, {}).get("photo")):
            cfg[who]["photo"] = kandidat[0]
            diganti += 1

    # 3) Sisa ../_aset/ yang tertulis langsung di HTML (mis. <img id="cover-photo">).
    html_path = dest / "index.html"
    src_html = html_path.read_text(encoding="utf-8")
    sisa = set(re.findall(r"\.\./_aset/[\w.-]+", src_html))
    if sisa:
        pengganti = "cover.jpg" if not hilang("cover.jpg") else kandidat[0]
        for ref in sisa:
            src_html = src_html.replace(ref, pengganti)
        html_path.write_text(src_html, encoding="utf-8")
        diganti += len(sisa)

    if diganti:
        info(f"aset model: {diganti} rujukan ../_aset/ diarahkan ke foto pelanggan.")


def build(input_dir, force=False):
    input_dir = Path(input_dir).resolve()
    data_file = input_dir / "data.json"
    foto_dir = input_dir / "foto"
    if not data_file.exists():
        die(f"data.json tidak ada di {input_dir}")
    data = json.loads(data_file.read_text(encoding="utf-8"))

    slug = data.get("slug") or input_dir.name
    model = data.get("model")
    if not model:
        die("field 'model' wajib ada di data.json (mis. \"emerald\").")

    model_dir = DEMO_DIR / model
    if not (model_dir / "index.html").exists():
        die(f"model '{model}' tidak ada di demo/. Pilihan: "
            + ", ".join(sorted(p.name for p in DEMO_DIR.iterdir() if p.is_dir())))

    dest = OUT_DIR / slug
    if dest.exists():
        if not force:
            die(f"folder tujuan sudah ada: {dest} (pakai --force untuk timpa)")
        shutil.rmtree(dest)

    print(f"→ Membuat undangan '{slug}' dari model '{model}'")
    shutil.copytree(model_dir, dest)
    info(f"salin demo/{model} → pesanan/{slug} OK.")

    cfg = read_model_config(dest / "index.html")
    if data.get("config"):
        deep_merge(cfg, data["config"])
        info("CONFIG digabung dengan data pelanggan OK.")

    if foto_dir.exists():
        process_gallery(data, foto_dir, dest, cfg)
        process_backgrounds(data, foto_dir, dest, cfg)
        process_couple(data, foto_dir, dest, cfg)
        remap_aset_model(dest, cfg)
    else:
        info("folder foto/ tidak ada — hanya mengganti teks CONFIG.")

    wire_backend(data, slug, dest, cfg)
    write_config(dest / "index.html", cfg)
    # verifikasi hasil masih JSON valid
    read_model_config(dest / "index.html")
    print(f"✓ Selesai: {dest}")
    print(f"  Cek lokal:  python -m http.server  lalu buka /pesanan/{slug}/")
    if not cfg.get("sheetUrl"):
        print("  Catatan: sheetUrl masih kosong — RSVP/buku tamu/check-in belum aktif.")


def main():
    ap = argparse.ArgumentParser(description="Generator undangan dari model demo/.")
    ap.add_argument("input_dir", help="folder input pesanan (berisi data.json + foto/)")
    ap.add_argument("--force", action="store_true", help="timpa folder pesanan bila sudah ada")
    args = ap.parse_args()
    build(args.input_dir, force=args.force)


if __name__ == "__main__":
    main()
