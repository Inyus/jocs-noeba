#!/usr/bin/env python3
"""Audit a rosco queue against the quality bar. Usage: audit.py [queue.json] [report.txt]"""
import json, re, sys, collections, unicodedata

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn').replace('l·l','ll')

def main(path='tools/raw/roscos.json', report='tools/raw/audit-report.txt'):
    roscos = json.load(open(path, encoding='utf-8'))
    issues = []
    queue_words = collections.Counter()
    for ros in roscos:
        seen = set()
        counts = collections.Counter()
        for c in ros['cells']:
            w, L, mode, g = c['w'], c['l'], c['mode'], c['g']
            counts[c['tier']] += 1
            queue_words[w] += 1
            if w in seen: issues.append((ros['n'], L, w, 'dup in rosco'))
            seen.add(w)
            nw = norm(w)
            if mode == 'comença' and not nw.startswith(norm(L)):
                issues.append((ros['n'], L, w, 'comença mismatch'))
            if mode == 'conté' and norm(L) not in nw:
                issues.append((ros['n'], L, w, 'conté mismatch'))
            gwords = set(re.findall(r"[a-zàèéíïòóúüç·'-]+", norm(g)))
            variants = {nw, nw+'a', nw+'na', nw+'s', nw+'es', nw+'ns', nw+'nes', nw+'r', nw+'da'}
            if gwords & variants:
                issues.append((ros['n'], L, w, 'spoiler in gloss'))
            if '{{' in g or '[[' in g or '}}' in g:
                issues.append((ros['n'], L, w, 'wikitext residue'))
            if '<' in g:
                issues.append((ros['n'], L, w, 'html residue'))
            if re.search(r'\s,', g) or not g.endswith(('.', '?', '!')):
                issues.append((ros['n'], L, w, 'hole/truncated gloss'))
            if len(g) < 10 or len(g) > 170:
                issues.append((ros['n'], L, w, f'gloss length {len(g)}'))
            if re.match(r'(?i)^(femení|plural|masculí|forma |gerundi|participi)', g):
                issues.append((ros['n'], L, w, 'flexion gloss'))
            if re.search(r'\b\w*ñ\w*\b', g.lower()):
                issues.append((ros['n'], L, w, 'possible Spanish (ñ in gloss)'))
        if counts['easy'] < 14 or counts['vhard'] > 4:
            issues.append((ros['n'], '-', '-', f'curve off: {dict(counts)}'))
    dups = {w: n for w, n in queue_words.items() if n > 1}
    for w, n in dups.items():
        issues.append(('-', '-', w, f'queue dup x{n}'))
    rep = open(report, 'w', encoding='utf-8')
    rep.write(f'roscos: {len(roscos)} | issues: {len(issues)} | queue dups: {len(dups)}\n')
    by = collections.Counter(i[3].split()[0] for i in issues)
    rep.write(f'by type: {dict(by)}\n\n')
    for i in issues:
        rep.write(str(i) + '\n')
    rep.close()
    print(f'issues: {len(issues)} by type: {dict(by)}')
    hard = [i for i in issues if i[3] in ('comença mismatch', 'conté mismatch', 'wikitext residue', 'html residue', 'dup in rosco')]
    print('HARD failures:', len(hard))
    sys.exit(1 if hard else 0)

if __name__ == '__main__':
    main(*sys.argv[1:])
