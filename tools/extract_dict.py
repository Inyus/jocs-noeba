#!/usr/bin/env python3
"""Extract Catalan entries from the cawiktionary XML dump (Viccionari, CC BY-SA 3.0).
Emits JSONL: {"w": word, "pos": [..], "defs": [{"pos","gloss","regs":[]}]}
Only common words (lowercase, no spaces/digits), Catalan section only.
"""
import re, html, json, sys

SRC = 'tools/raw/cawiktionary.xml'
OUT = 'tools/raw/dict.jsonl'

POS_MAP = {
    'nom': 'nom', 'verb': 'verb', 'adjectiu': 'adj', 'adverbi': 'adv',
    'adjectiu i nom': 'adj', 'prefix': 'prefix', 'sufix': 'sufix',
    'conjunció': 'conj', 'preposició': 'prep', 'interjecció': 'interj',
    'pronom': 'pronom', 'determinant': 'det', 'article': 'art', 'numeral': 'num',
}
SKIP_POS = {'nom propi', 'sigles', 'acrònim', 'símbol', 'forma verbal', 'forma de nom',
            'forma pronominal', 'forma adjectiva', 'contracció', 'etimologia', 'pronunciació'}

LINK_RE = re.compile(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]')
TPL_RE = re.compile(r'\{\{[^{}]*\}\}')

def clean(text):
    text = LINK_RE.sub(r'\1', text)
    # keep register/marca labels as plain text hint
    text = re.sub(r'\{\{marca\|ca\|([^{}]*)\}\}', r'(\1) ', text)
    prev = None
    while prev != text:
        prev = text
        text = TPL_RE.sub('', text)
    text = re.sub(r'<ref[^>]*>.*?</ref>', '', text)
    text = re.sub(r'<ref[^>]*/>', '', text)
    text = re.sub(r'</?(sub|sup|small|big|i|b|u|span|font|nowiki)[^>]*>', '', text)
    text = re.sub(r"''+", '', text)
    text = re.sub(r'\s+', ' ', text).strip(' ;,')
    return text

def parse_entry(title, body):
    m = re.search(r'==\s*\{\{-ca-\}\}\s*==(.*?)(?:\n==\s*\{\{-[^c]|\Z)', body, re.S)
    if not m:
        return None
    sec = m.group(1)
    defs = []
    pos = None
    cur_pos_label = None
    for line in sec.split('\n'):
        h = re.match(r'===\s*([^=]+?)\s*===', line)
        if h:
            cur_pos_label = h.group(1).strip().lower()
            pos = POS_MAP.get(cur_pos_label, None)
            continue
        if line.startswith('#:') or line.startswith('##') or line.startswith('#*'):
            continue
        if line.startswith('# '):
            if pos is None or (cur_pos_label and cur_pos_label in SKIP_POS):
                continue
            g = clean(line[2:])
            if len(g) >= 8 and not g.startswith('('):
                defs.append({'pos': pos, 'gloss': g})
            elif len(g) >= 8:
                g2 = g.lstrip('() ').split(') ', 1)[-1]
                if len(g2) >= 8:
                    defs.append({'pos': pos, 'gloss': g2})
    if not defs:
        return None
    posses = sorted({d['pos'] for d in defs if d['pos']})
    return {'w': title, 'pos': posses, 'defs': defs}

def main():
    title = None
    in_text = False
    buf = []
    n_out = 0
    out = open(OUT, 'w', encoding='utf-8')
    with open(SRC, encoding='utf-8') as f:
        for line in f:
            if not in_text:
                tm = re.match(r'\s*<title>([^<]*)</title>', line)
                if tm:
                    title = tm.group(1)
                if title and '<text' in line:
                    m = re.search(r'<text[^>]*>(.*)', line, re.S)
                    buf = [m.group(1)] if m else []
                    if '</text>' in buf[0]:
                        body = buf[0].rsplit('</text>', 1)[0]
                        emit(title, body, out)
                        title = None
                        n_out += 1
                        continue
                    in_text = True
            else:
                if '</text>' in line:
                    buf.append(line.split('</text>')[0])
                    emit(title, ''.join(buf), out)
                    title = None
                    in_text = False
                    n_out += 1
                else:
                    buf.append(line)
    out.close()
    print('entries written:', n_out)

_counter = {'kept': 0, 'skipped': 0}
def emit(title, body, out):
    if not title or ':' in title:
        return
    if not re.fullmatch(r"[a-zàèéíïòóúüç·'-]+", title):
        _counter['skipped'] += 1
        return
    body = html.unescape(body)
    e = parse_entry(title, body)
    if e and e['defs']:
        out.write(json.dumps(e, ensure_ascii=False) + '\n')
        _counter['kept'] += 1
    else:
        _counter['skipped'] += 1

if __name__ == '__main__':
    main()
    print('kept:', _counter['kept'], 'skipped:', _counter['skipped'])
