#!/usr/bin/env python3
"""
Image pipeline for the sushiNEL site. Needs: pip install pillow numpy scipy opencv-python

  python tools/prepare_images.py dish <photo> <dish-id>    one new dish photo, background cut if it is white
  python tools/prepare_images.py all <menu-images-dir> <imgmap.json> <venue-photos-dir>    full rebuild

Outputs land in public/img. Every file stays well under 300 KB.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'img')
PAGE_BLACK = (11, 10, 10)


def border_stats(rgb):
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    return float(np.mean(border.min(axis=1) > 205))


def cut_white(rgb):
    """Alpha mask for a dish shot on a white or light studio background."""
    a = rgb.astype(np.int16)
    mn, mx = a.min(axis=2), a.max(axis=2)
    chroma = mx - mn
    corners = np.array([rgb[2, 2], rgb[2, -3], rgb[-3, 2], rgb[-3, -3]]).min(axis=1)
    level = min(214, int(np.median(corners)) - 26)   # handles off-white and grey sweeps
    cand = (mn >= level) & (chroma <= 20)
    lab, _ = ndi.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge != 0])
    # contact shadow: neutral and fairly bright, connected to the background
    lab2, _ = ndi.label(((mn >= 150) & (chroma <= 11)) | bg)
    keep = np.unique(lab2[bg])
    bg2 = np.isin(lab2, keep[keep != 0])
    mask = np.full(rgb.shape[:2], cv2.GC_PR_FGD, np.uint8)
    mask[bg] = cv2.GC_BGD
    mask[bg2 & ~bg] = cv2.GC_PR_BGD
    mask[ndi.binary_erosion(~bg2, iterations=9)] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(rgb[:, :, ::-1].copy(), mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    fg = ndi.binary_opening(fg, iterations=1)
    lab3, n = ndi.label(fg)
    if n > 1:
        sizes = ndi.sum(fg, lab3, range(1, n + 1))
        fg[np.isin(lab3, 1 + np.where(sizes < 0.004 * fg.size)[0])] = False
    alpha = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 0.9)
    return np.clip((alpha - 0.35) / 0.55, 0, 1)    # shrink the fringe so no white halo survives on black


def cut_black(rgb):
    """Alpha for shots on a near-black background, so no dark rectangle shows against the page."""
    lum = rgb.max(axis=2)
    lab, _ = ndi.label(lum < 46)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge != 0])
    alpha = cv2.GaussianBlur((~bg).astype(np.float32), (0, 0), 1.6)
    return np.clip(alpha * 1.25, 0, 1)


def decontaminate(rgb, alpha, bgval=250.0):
    c = rgb.astype(np.float32)
    a = np.maximum(alpha[..., None], 0.2)
    f = (c - (1 - a) * bgval) / a
    return np.clip(np.where(alpha[..., None] > 0.98, c, f), 0, 255).astype(np.uint8)


def vignette(shape, inner=0.42, outer=1.0):
    """1 in the middle, 0 at the border, along a rounded-square shape so corners fade too."""
    h, w = shape
    y = np.linspace(-1, 1, h)[:, None]
    x = np.linspace(-1, 1, w)[None, :]
    d = (np.abs(x) ** 3 + np.abs(y) ** 3) ** (1 / 3)   # between a circle and a square: no straight edge survives
    t = np.clip((outer - d) / (outer - inner), 0, 1)
    return t * t * (3 - 2 * t)


def rounded(shape, radius=0.09):
    """Rounded-rectangle alpha with an antialiased edge."""
    h, w = shape
    r = radius * min(h, w)
    SS = 4
    m = np.zeros((h * SS, w * SS), np.uint8)
    rr = int(r * SS)
    cv2.rectangle(m, (rr, 0), (w * SS - rr, h * SS), 255, -1)
    cv2.rectangle(m, (0, rr), (w * SS, h * SS - rr), 255, -1)
    for cx, cy in ((rr, rr), (w * SS - rr, rr), (rr, h * SS - rr), (w * SS - rr, h * SS - rr)):
        cv2.circle(m, (cx, cy), rr, 255, -1, lineType=cv2.LINE_AA)
    return cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


def edge_fade(alpha, frac=0.04):
    h, w = alpha.shape
    n = max(3, int(min(h, w) * frac))
    xs = np.minimum(np.arange(w), w - 1 - np.arange(w))
    ys = np.minimum(np.arange(h), h - 1 - np.arange(h))
    ramp = np.clip(np.minimum(xs[None, :], ys[:, None]) / n, 0, 1)
    return alpha * (ramp * ramp * (3 - 2 * ramp))


def dish(src, dish_id, out_dir=None):
    out_dir = out_dir or os.path.join(ROOT, 'menu')
    im = Image.open(src).convert('RGB')
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2)).resize((512, 512), Image.LANCZOS)
    rgb = np.array(im)
    if border_stats(rgb) > 0.42:
        # White studio shot: cut the dish out so it sits straight on the page
        alpha = cut_white(rgb)
        rgb = decontaminate(rgb, alpha)
        alpha = edge_fade(alpha, 0.07)
    else:
        # A photo with its own background reads best on the pastel page as a clean rounded tile
        alpha = rounded(rgb.shape[:2])
    rgba = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), 'RGBA')
    rgba.resize((480, 480), Image.LANCZOS).save(os.path.join(out_dir, f'{dish_id}-480.avif'), quality=58, speed=4)
    rgba.resize((480, 480), Image.LANCZOS).save(os.path.join(out_dir, f'{dish_id}-480.webp'), quality=78, method=6, alpha_quality=88)
    rgba.resize((360, 360), Image.LANCZOS).save(os.path.join(out_dir, f'{dish_id}-360.avif'), quality=57, speed=4)
    rgba.resize((360, 360), Image.LANCZOS).save(os.path.join(out_dir, f'{dish_id}-360.webp'), quality=77, method=6, alpha_quality=86)
    rgba.resize((240, 240), Image.LANCZOS).save(os.path.join(out_dir, f'{dish_id}-240.webp'), quality=76, method=6, alpha_quality=85)
    rgba.resize((240, 240), Image.LANCZOS).save(os.path.join(out_dir, f'{dish_id}-240.avif'), quality=56, speed=4)


def save_set(img, base, widths, avif_q=58, webp_q=78):
    for w in widths:
        h = round(img.height * w / img.width)
        r = img.resize((w, h), Image.LANCZOS) if w != img.width else img
        r.save(f'{base}-{w}.avif', quality=avif_q, speed=4)
        r.save(f'{base}-{w}.webp', quality=webp_q, method=6)


def logo(src):
    """Only the white square around the round logo goes. The artwork itself is untouched."""
    rgb = np.array(Image.open(src).convert('RGB'))
    a = rgb.astype(np.int16)
    white = (a.min(axis=2) >= 244)
    lab, _ = ndi.label(white)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge != 0])
    alpha = cv2.GaussianBlur((~bg).astype(np.float32), (0, 0), 0.7)
    alpha = np.clip((alpha - 0.2) / 0.6, 0, 1)
    fixed = decontaminate(rgb, alpha, 254.0)
    img = Image.fromarray(np.dstack([fixed, (alpha * 255).astype(np.uint8)]), 'RGBA')
    out = os.path.join(ROOT, 'logo')
    for s in (96, 192, 320, 512):
        r = img.resize((s, s), Image.LANCZOS)
        r.save(os.path.join(out, f'logo-{s}.webp'), quality=88, method=6, alpha_quality=95)
    img.resize((512, 512), Image.LANCZOS).save(os.path.join(out, 'logo-512.png'), optimize=True)
    # Favicons sit on the logo's own black so they read on any browser chrome
    for s, name in ((32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')):
        bg_img = Image.new('RGB', (s, s), PAGE_BLACK)
        r = img.resize((s, s), Image.LANCZOS)
        bg_img.paste(r, (0, 0), r)
        bg_img.save(os.path.join(out, name), optimize=True)
    return img


def hero(venue):
    """The signature shot: rolls cut into hearts, stacked as a sakura flower, on a white plate lifted off the street."""
    im = Image.open(os.path.join(venue, 'photo_19_2026-11-07_17-03-40.jpg')).convert('RGB')
    arr = np.array(im)
    h, w = arr.shape[:2]
    poly = np.array([[650, 465], [959, 664], [959, 974], [407, 1216], [0, 586]], np.int32)
    mask = np.zeros((h * 4, w * 4), np.uint8)
    cv2.fillPoly(mask, [poly * 4], 255, lineType=cv2.LINE_AA)
    mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_AREA)
    g = arr.min(axis=2).astype(np.float32)
    soft = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 1.2)
    core = cv2.erode(mask, np.ones((9, 9), np.uint8))
    alpha = np.where(core > 0, 1.0, soft * np.clip((g - 120) / 60, 0, 1))
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 0.6)
    rgba = np.dstack([arr, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    crop = Image.fromarray(rgba[455:1228, 0:960], 'RGBA')
    crop = crop.resize((int(crop.width * 1.6), int(crop.height * 1.6)), Image.LANCZOS)
    r, g2, b, a = crop.split()
    rgb = Image.merge('RGB', (r, g2, b)).filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
    n = np.array(rgb).astype(np.float32)
    n *= np.array([0.965, 0.945, 0.905])        # phone-white plate -> warm rice white, no glare on black
    img = Image.fromarray(np.dstack([np.clip(n, 0, 255).astype(np.uint8), np.array(a)]), 'RGBA')
    save_set(img, os.path.join(ROOT, 'hero', 'plate'), (720, 1100, 1536), avif_q=60, webp_q=80)
    return img


# Crops drop Wi-Fi stickers, QR codes, beer coasters with garbled print and cleaning signs.
VENUE = {
    'night': ('photo_13_2026-11-07_17-03-40.jpg', (0, 0, 960, 1040), (520, 900)),
    'lamp': ('photo_4_2026-11-07_17-03-40.jpg', (40, 0, 530, 563), (490,)),
    'triptych': ('photo_5_2026-11-07_17-03-40.jpg', (40, 0, 780, 372), (740,)),
    'tempura': ('photo_6_2026-11-07_17-03-40.jpg', (0, 40, 960, 1200), (520, 900)),
    'box': ('photo_12_2026-11-07_17-03-40.jpg', (0, 40, 560, 1000), (420, 560)),
    'cake': ('photo_14_2026-11-07_17-03-40.jpg', (130, 170, 880, 860), (420, 750)),
    'reserved': ('photo_9_2026-11-07_17-03-40.jpg', (0, 62, 1280, 960), (640, 1000)),
    'funcoza': ('photo_11_2026-11-07_17-03-40.jpg', (130, 620, 950, 1200), (480, 820)),
    'promo-tempura': ('photo_6_2026-11-07_17-03-40.jpg', (190, 640, 960, 1010), (480, 770)),
    'poke': ('photo_8_2026-11-07_17-03-40.jpg', (110, 600, 760, 1250), (420, 650)),
}


def venue_photos(venue):
    for name, (src, box, widths) in VENUE.items():
        im = Image.open(os.path.join(venue, src)).convert('RGB').crop(box)
        im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=45, threshold=2))
        save_set(im, os.path.join(ROOT, 'venue', name), widths, avif_q=56, webp_q=76)


def og_image(logo_img, plate):
    W, H = 1200, 630
    canvas = Image.new('RGB', (W, H), PAGE_BLACK)
    p = plate.resize((860, round(plate.height * 860 / plate.width)), Image.LANCZOS)
    canvas.paste(p, (W - 760, -40), p)
    l = logo_img.resize((320, 320), Image.LANCZOS)
    canvas.paste(l, (52, 150), l)
    canvas.save(os.path.join(ROOT, 'og.jpg'), quality=86, optimize=True, progressive=True)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'dish':
        dish(sys.argv[2], sys.argv[3])
        print('done', sys.argv[3])
    elif mode == 'venue':
        venue_photos(sys.argv[2])
    elif mode == 'all':
        menu_dir, imgmap_path, venue = sys.argv[2:5]
        imgmap = json.load(open(imgmap_path, encoding='utf-8'))
        fallback = {'ebi-tempura': None}
        done = 0
        for dish_id, fname in imgmap.items():
            if not fname or not os.path.exists(os.path.join(menu_dir, fname)):
                print('no source image:', dish_id)
                continue
            dish(os.path.join(menu_dir, fname), dish_id)
            done += 1
        lg = logo(os.path.join(menu_dir, 'uyW9nIMZkggF_3a5e2f2e.webp'))
        pl = hero(venue)
        venue_photos(venue)
        og_image(lg, pl)
        print('dishes', done)
    else:
        print(__doc__)
