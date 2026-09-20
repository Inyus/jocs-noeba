"""Number-to-Catalan speech helpers for TTS gloss cleanup."""
import re

ONES = ['zero','u','dos','tres','quatre','cinc','sis','set','vuit','nou','deu',
        'onze','dotze','tretze','catorze','quinze','setze','disset','divuit','dinou']
TENS = {2:'vint',3:'trenta',4:'quaranta',5:'cinquanta',6:'seixanta',7:'setanta',8:'vuitanta',9:'noranta'}
ORD = ['','primer','segon','tercer','quart','cinquè','sisè','setè','vuitè','novè','desè',
       'onzè','dotzè','tretzè','catorzè','quinzè','setzè','dissetè','divuitè','dinovè','vintè']
ROMAN = {'I':1,'V':5,'X':10,'L':50,'C':100,'D':500,'M':1000}

def card(n):
    if n < 20: return ONES[n]
    if n < 30:
        return 'vint' if n == 20 else 'vint-i-' + ONES[n-20]
    if n < 100:
        t, r = divmod(n, 10)
        return TENS[t] if r == 0 else TENS[t] + '-' + ONES[r]
    if n < 200:
        return 'cent' if n == 100 else 'cent ' + card(n-100)
    if n < 1000:
        h, r = divmod(n, 100)
        base = ONES[h] + '-cents' if h != 2 else 'dos-cents'
        return base if r == 0 else base + ' ' + card(r)
    if n < 2000:
        return 'mil' if n == 1000 else 'mil ' + card(n-1000)
    if n < 1000000:
        k, r = divmod(n, 1000)
        base = card(k) + ' mil'
        return base if r == 0 else base + ' ' + card(r)
    return str(n)

def roman2int(s):
    total, prev = 0, 0
    for ch in reversed(s):
        v = ROMAN[ch]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total

def _roman_sub(m):
    ctx = m.group(1).lower()
    n = roman2int(m.group(2))
    if 'segle' in ctx and 0 < n <= 20:
        return m.group(1) + ORD[n]
    return m.group(1) + card(n)

def _digit_sub(m):
    return card(int(m.group(0)))

def spoken(text):
    """Convert digits and roman numerals in a gloss to spoken Catalan."""
    text = re.sub(r'\b((?i:segle|segles|any|anys)\s+)([IVXLCDM]{1,7})\b', _roman_sub, text)
    text = re.sub(r'\b([IVXLCDM]{2,7})\b', lambda m: card(roman2int(m.group(1))), text)
    text = re.sub(r'\b\d+\b', _digit_sub, text)
    return text

if __name__ == '__main__':
    tests = ['Segle XIX a Europa', 'Nascut el 1888', 'Té 21 anys i 3 fills', 'Segle V aC', 'Any 1492']
    for t in tests: print(t, '->', spoken(t))
