#!/usr/bin/env python3
"""Re-bake Capicua audio for cells replaced in replacements.json.
Reads:  replacements.json  (day, cell, w, g)
Writes: site/audio/d<day>/<cell>.ogg  (Matxa TTS v2, Elia spk=2, opus 32k)
Model:  matxa_multiaccent_wavenext_e2e.onnx (projecte-aina/matxa-tts-cat-multiaccent, HF)
Usage:  python3 rebake_audio.py <model_path> [replacements.json]
Needs:  onnxruntime, numpy, ffmpeg (+ffprobe) on PATH."""
import json, os, re, sys, subprocess, wave
import numpy as np
import onnxruntime as ort
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from num2ca import spoken

MODEL = sys.argv[1] if len(sys.argv) > 1 else 'matxa.onnx'
REPL = sys.argv[2] if len(sys.argv) > 2 else 'replacements.json'
SPK = 2            # Elia (Central) — same voice config as the original bake
TEMP, RATE = 0.667, 1.0
SR = 22050
OUT = 'site/audio'

_pad = "_"
_punctuation = ';:,.!?¡¿—…"«»“”()- '
_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
_letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪɝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ"
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

def main():
    repls = json.load(open(REPL, encoding='utf-8'))
    done, failed = 0, []
    for k, r in enumerate(repls):
        p = os.path.join(OUT, f"d{r['day']}", f"{r['cell']}.ogg")
        try:
            save_ogg(synth(r['g']), p)
            done += 1
        except Exception as e:
            failed.append((r['day'], r['cell'], str(e)[:120]))
        if (k + 1) % 100 == 0:
            print(f'{k+1}/{len(repls)} baked', flush=True)
    # verify: every replaced clip exists, non-trivial size, decodable duration
    bad = []
    for r in repls:
        p = os.path.join(OUT, f"d{r['day']}", f"{r['cell']}.ogg")
        if not os.path.exists(p) or os.path.getsize(p) < 3000:
            bad.append((r['day'], r['cell'], 'missing/tiny')); continue
        try:
            d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                      '-of', 'csv=p=0', p], capture_output=True, text=True, check=True).stdout.strip())
            if not (1.0 <= d <= 20.0): bad.append((r['day'], r['cell'], f'duration {d}'))
        except Exception as e:
            bad.append((r['day'], r['cell'], 'ffprobe: ' + str(e)[:80]))
    print(f'DONE baked={done} failed={len(failed)} verify_bad={len(bad)}', flush=True)
    if failed: print('FAILED:', failed[:20])
    if bad: print('VERIFY_BAD:', bad[:20])

if __name__ == '__main__':
    main()
