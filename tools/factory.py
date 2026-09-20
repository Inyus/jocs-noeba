#!/usr/bin/env python3
"""Rosco factory: builds the daily rosco queue from tools/raw/dict.jsonl.
Letter scheme (user spec 2026-09-20): 26 letters (5 vowels + 21 consonants);
one letter per day is swapped for Ç (always a HARD cell, "conté la ç" mode).
k/w/y/z run in "conté" mode (few Catalan words start with them).
Difficulty: 16-17 easy, 4-5 hard, 2 very hard (wordfreq zipf + length).
Output: tools/raw/roscos.json (audited batches).
"""
import json, random, re, sys, collections
from wordfreq import zipf_frequency

LETTERS = list('abcdefg hijlmnopqrstuvx'.replace(' ', ''))  # k,w,y,z removed per user 2026-09-20
CONTE_MODE = {'q', 'x', 'u', 'j'}  # user: q x u j mostly conté          # few starters; "conté la X"
MIN_STARTERS = 100
MIN_REUSE_GAP = 25                          # below this a letter flips to conté
MAX_GLOSS = 160
MIN_GLOSS = 6

def tier(w):
    z = zipf_frequency(w, 'ca')
    L = len(w)
    if z >= 2.6 and L <= 13: return 'easy'
    if z >= 1.6 and L <= 15: return 'hard'
    return 'vhard'

def norm(s):
    return s.lower().replace('l·l', 'll')

def main(n_roscos, seed=20260920, batch=1, prev_files=()):
    rows = [json.loads(l) for l in open('tools/raw/dict.jsonl', encoding='utf-8')]
    import os
    excl = set()
    if os.path.exists('tools/raw/exclude.txt'):
        excl = {l.strip().lower() for l in open('tools/raw/exclude.txt', encoding='utf-8') if l.strip()}
    rows = [r for r in rows if r['w'].lower() not in excl]
    # candidate pool per letter/mode: best-gloss entries
    pool = collections.defaultdict(list)   # (letter, mode) -> [entry]
    for e in rows:
        w = e['w']
        if not (3 <= len(w) <= 17): continue
        if '-' in w or "'" in w or '·' in w: continue
        # pick shortest decent gloss that does not contain the word itself
        best = None
        for d in e['defs']:
            g = d['gloss']
            if not (MIN_GLOSS <= len(g) <= MAX_GLOSS): continue
            import unicodedata as _ud
            _flat = lambda t: ''.join(c for c in _ud.normalize('NFD', t.lower()) if _ud.category(c) != 'Mn').replace('l·l','ll')
            ng = set(re.findall(r"[a-zàèéíïòóúüç·'-]+", _flat(g)))
            nw_ = _flat(w)
            if {nw_, nw_+'a', nw_+'na', nw_+'s', nw_+'es', nw_+'ns', nw_+'nes', nw_+'r', nw_+'da'} & ng: continue
            # skip flexion-form glosses (bad rosco answers)
            if re.match(r'(?i)^(femení|plural|masculí|forma|gerundi|participi|imperf|perfet|present|pretèrit)', g): continue
            if len(g.split()) < 2: continue  # bare-synonym glosses are ambiguous
            if re.search(r'\s,', g) or not g.endswith(('.', '?', '!')): continue  # template holes / truncated glosses
            if best is None or abs(len(g) - 80) < abs(len(best) - 80): best = g  # prefer ~80-char glosses
        if not best: continue
        e2 = {'w': w, 'gloss': best, 'pos': e['pos'][0] if e['pos'] else '', 'tier': tier(w)}
        pool[(w[0], 'comença')].append(e2)
        for L in set(w):
            pool[(L, 'conté')].append(e2)
    # decide mode per letter
    modes = {}
    for L in LETTERS:
        starters = pool[(L, 'comença')]
        modes[L] = 'conté' if L in CONTE_MODE else ('comença' if len(starters) >= MIN_STARTERS else 'conté')
    modes['ç'] = 'conté'
    print('modes:', modes)
    print({k: len(v) for k, v in pool.items() if k[0] in 'kwyzç' and k[1]=='conté'})
    rng = random.Random(seed + batch * 1000)
    used = set()  # (word) global dedupe across the batch
    last_used = {}  # word -> rosco index (for spaced reuse when a letter pool is tiny)
    for fi, pf in enumerate(prev_files):  # cross-batch dedupe: prior queue files
        off = -(len(prev_files) - fi) * 60
        for ros in json.load(open(pf, encoding='utf-8')):
            for c in ros['cells']:
                used.add(c['w']); last_used[c['w']] = ros['n'] + off
    roscos = []
    swap_letters = [L for L in LETTERS if L not in ('ç',)]
    order = swap_letters[:]
    rng.shuffle(order)
    for r in range(n_roscos):
        ç_target = order[r % len(order)]
        cells = []
        counts = collections.Counter()
        ok = True
        plan = ['easy']*15 + ['hard']*5 + ['vhard']*2  # 22 slots; ç overrides one 'hard'
        rng.shuffle(plan)
        letters_today = [L for L in LETTERS if L != ç_target] + ['ç']
        rng.shuffle(letters_today)
        for i, L in enumerate(letters_today):
            want = 'hard' if L == 'ç' else plan[i]
            cand = pool[(L, modes[L])]
            picks = [c for c in cand if c['tier'] == want and c['w'] not in used]
            if not picks:  # relax tier, prefer EASIER candidates (curve must not drift hard)
                fallbacks = ('hard',) if L == 'ç' else ('easy', 'hard', 'vhard')  # ç always hard (user spec)
                for fb in fallbacks:
                    picks = [c for c in cand if c['tier'] == fb and c['w'] not in used]
                    if picks: break
            if not picks:
                # tiny letter pool (hard ç...): reuse, least-recently used, same tier when possible
                same_tier = [c for c in cand if c['tier'] == want]
                order_lru = sorted(same_tier or cand, key=lambda c: last_used.get(c['w'], -999))
                spaced = [c for c in order_lru if r - last_used.get(c['w'], -999) >= MIN_REUSE_GAP]
                if not spaced and same_tier:  # tiny tier pool: widen to all tiers for spacing
                    order_all = sorted(cand, key=lambda c: last_used.get(c['w'], -999))
                    wide = [c for c in order_all if r - last_used.get(c['w'], -999) >= MIN_REUSE_GAP]
                    if wide:
                        order_lru, spaced = order_all, wide
                reuse_pool = (spaced or order_lru)[:max(1, len(order_lru)//3)]
                c = rng.choice(reuse_pool)
            else:
                c = rng.choice(picks)
            used.add(c['w'])
            last_used[c['w']] = r
            cells.append({'l': L, 'mode': modes[L], 'w': c['w'], 'g': c['gloss'], 'pos': c['pos'], 'tier': c['tier']})
            counts[c['tier']] += 1
        if not ok:
            print(f'rosco {r}: FAILED (no candidate)'); continue
        cells.sort(key=lambda c: 'aàbcçdeéfghiíjklmnñoópqrstuúvwxyz'.index(c['l']) if c['l'] in 'aàbcçdeéfghiíjklmnñoópqrstuúvwxyz' else 99)
        roscos.append({'n': r, 'cells': cells, 'stats': dict(counts)})
    out = 'tools/raw/roscos.json' if batch == 1 else f'tools/raw/roscos-b{batch}.json'
    json.dump(roscos, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('written:', out)
    agg = collections.Counter()
    for r in roscos: agg.update(r['stats'])
    print('roscos built:', len(roscos), '| avg per rosco:', {k: round(v/max(1,len(roscos)),1) for k,v in agg.items()})
    print('sample day 0:')
    for c in roscos[0]['cells'][:6]:
        print(' ', c['l'], c['mode'], c['tier'], c['w'], '-', c['g'][:60])

if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    main(n, batch=b, prev_files=sys.argv[3:])
