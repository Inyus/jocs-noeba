#!/usr/bin/env python3
"""Bake rosco audio (Matxa TTS v2, Elia spk=2) into site/audio/d<day>/<i>.ogg."""
import json, os, re, sys, subprocess, wave
import numpy as np
import onnxruntime as ort
sys.path.insert(0, os.path.dirname(__file__))
from num2ca import spoken

MODEL = '/tmp/matxa.onnx'
SPK = 2            # Elia (Central)
TEMP, RATE = 0.667, 1.0
SR = 22050
OUT = 'site/audio'

_pad = "_"
_punctuation = ';:,.!?¡¿—…"«»“”()- '
_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
_letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ"
_letters_accented = "àáèéìíòóùú·üïöñ’#´"
SYMS = [_pad] + list(_punctuation) + list(_letters) + list(_letters_ipa) + list(_letters_accented)
S2I = {s: i for i, s in enumerate(SYMS)}

def clean(text):
    text = spoken(text).lower()
    text = ''.join(c for c in text if c in S2I)
    return re.sub(r'\s+', ' ', text).strip()

_sess = None
def synth(text):
    global _sess
    if _sess is None:
        _sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    seq = [S2I[c] for c in clean(text)]
    ids = [0] * (len(seq) * 2 + 1)   # intersperse pad (official matcha pipeline)
    ids[1::2] = seq
    x = np.array([ids], dtype=np.int64)
    xl = np.array([len(ids)], dtype=np.int64)
    scales = np.array([TEMP, RATE], dtype=np.float32)
    spks = np.array([SPK], dtype=np.int64)
    mel_len, wav = _sess.run(None, {'x': x, 'x_lengths': xl, 'scales': scales, 'spks': spks})
    return np.clip(wav[0], -1.0, 1.0)

def save_ogg(wavf, path):
    tmp = path + '.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((wavf * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libopus', '-b:a', '32k', path], check=True)
    os.remove(tmp)

def all_days():
    import glob
    files = ['tools/raw/roscos.json'] + sorted(glob.glob('tools/raw/roscos-b*.json'))
    days = []
    for f in files:
        days.extend(json.load(open(f, encoding='utf-8')))
    return days

def main(d0, d1):
    days = all_days()
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {'days': []}
    for n in range(d0, min(d1, len(days))):
        ddir = os.path.join(OUT, f'd{n}')
        os.makedirs(ddir, exist_ok=True)
        for i, c in enumerate(days[n]['cells']):
            p = os.path.join(ddir, f'{i}.ogg')
            if os.path.exists(p): continue
            save_ogg(synth(c['g']), p)
        if n not in man['days']:
            man['days'].append(n)
        man['days'].sort()
        json.dump(man, open(man_path, 'w'))
        print(f'day {n} baked ({len(days[n]["cells"])} clips)', flush=True)
    print('done', flush=True)

if __name__ == '__main__':
    main(int(sys.argv[1]), int(sys.argv[2]))
