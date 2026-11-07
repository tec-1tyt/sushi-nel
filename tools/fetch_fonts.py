#!/usr/bin/env python3
"""
Downloads tiny self-hosted font subsets from Google Fonts (all three families are SIL OFL).
Only the weights and characters the site uses are kept, which cuts first-load font weight by more than half.
Needs: pip install fonttools brotli
Run once, or again if a language with new letters is added:  python tools/fetch_fonts.py
"""
import io
import os
import re
import urllib.parse
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'fonts')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'}

PUNCT = '–—‘’“”„…·×©°€№ '
LATIN = ''.join(chr(c) for c in range(0x20, 0x7F)) + ''.join(chr(c) for c in range(0xA1, 0x100)) + 'ČčĎďĚěŇňŘřŠšŤťŮůŽžŁłŃńŚśŹźŻżĄąĘę' + PUNCT
CYRILLIC = 'АБВГҐДЕЄЁЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯЪЫЭабвгґдеєёжзиіїйклмнопрстуфхцчшщьюяъыэ' + "ʼ" + PUNCT + ' 0123456789.,:;!?()-+/%\'"'

FAMILIES = {
    'display': 'Sofia+Sans+Extra+Condensed:wght@700..800',
    'text': 'Sofia+Sans:wght@400..700',
    'ink': 'Bona+Nova:ital@1',
}

# Axis limits applied after download. Display is pinned to one weight, text keeps a short range.
LIMITS = {'display': {'wght': 780}, 'text': {'wght': (400, 650)}}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


for name, family in FAMILIES.items():
    for script, chars in (('latin', LATIN), ('cyrillic', CYRILLIC)):
        css = get(f'https://fonts.googleapis.com/css2?family={family}&display=swap&text={urllib.parse.quote(chars)}').decode()
        url = re.search(r'url\((https://[^)]+)\)', css).group(1)
        data = get(url)
        if name in LIMITS:
            font = TTFont(io.BytesIO(data))
            instancer.instantiateVariableFont(font, LIMITS[name], inplace=True)
            font.flavor = 'woff2'
            buf = io.BytesIO()
            font.save(buf)
            data = buf.getvalue()
        path = os.path.join(OUT, f'{name}-{script}.woff2')
        with open(path, 'wb') as f:
            f.write(data)
        print(f'{name}-{script}.woff2', len(data), 'bytes')
