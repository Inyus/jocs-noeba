/* La Rosca — daily Catalan word game. All logic client-side. */
(function () {
  'use strict';

  // ---------- data ----------
  function decodeDays() {
    const bin = atob(ROSCO_DAYS_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }
  const DAYS = decodeDays();

  function todayIndex() {
    const fmt = new Intl.DateTimeFormat('ca-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = fmt.format(new Date()).split('/');
    const todayStr = `${p[2]}-${p[1]}-${p[0]}`;
    const launch = new Date(ROSCO_LAUNCH + 'T00:00:00Z');
    const today = new Date(todayStr + 'T00:00:00Z');
    return Math.round((today - launch) / 86400000);
  }

  const DAY_IDX = todayIndex();
  const els = {
    game: document.getElementById('game'),
    results: document.getElementById('results'),
    nogame: document.getElementById('nogame'),
    wheel: document.getElementById('wheel'),
    bigLetter: document.getElementById('bigLetter'),
    clueIntro: document.getElementById('clueIntro'),
    clueText: document.getElementById('clueText'),
    listenBtn: document.getElementById('listenBtn'),
    form: document.getElementById('answerForm'),
    input: document.getElementById('answerInput'),
    passo: document.getElementById('passoBtn'),
    scoreOk: document.getElementById('scoreOk'),
    scoreBad: document.getElementById('scoreBad'),
    scoreLeft: document.getElementById('scoreLeft'),
    dayLabel: document.getElementById('dayLabel'),
    streak: document.getElementById('streak'),
    resultTitle: document.getElementById('resultTitle'),
    resultScore: document.getElementById('resultScore'),
    resultWheel: document.getElementById('resultWheel'),
    review: document.getElementById('review'),
    shareX: document.getElementById('shareX'),
    shareFB: document.getElementById('shareFB'),
    shareWA: document.getElementById('shareWA'),
    shareCopy: document.getElementById('shareCopy'),
  };

  if (DAY_IDX < 0 || DAY_IDX >= DAYS.length) {
    els.nogame.hidden = false;
    return;
  }
  const day = DAYS[DAY_IDX];
  const N = day.cells.length;

  const MONTHS = ['de gener','de febrer','de març','d\'abril','de maig','de juny','de juliol','d\'agost','de setembre','d\'octubre','de novembre','de desembre'];
  function dayLabel() {
    const d = new Date(new Date(ROSCO_LAUNCH + 'T00:00:00Z').getTime() + DAY_IDX * 86400000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  els.dayLabel.textContent = dayLabel();

  // ---------- normalization (accent/ç-insensitive, l·l tolerant) ----------
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ç/g, 'c').replace(/l·l/g, 'll').replace(/·/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  // ---------- persistence ----------
  const LS_GAME = `jocs.rosco.day.${DAY_IDX}`;
  const LS_STREAK = 'jocs.rosco.streak';
  const LS_LAST = 'jocs.rosco.lastDay';
  let state;
  try { state = JSON.parse(localStorage.getItem(LS_GAME)) || null; } catch (e) { state = null; }
  if (!state || !Array.isArray(state.cells) || state.cells.length !== N) {
    state = { cells: day.cells.map(() => ({ s: 'pending', ans: '' })), cur: 0, done: false };
  }
  function save() { try { localStorage.setItem(LS_GAME, JSON.stringify(state)); } catch (e) {} }

  // ---------- streak ----------
  function streakInfo() {
    let st = 0;
    try { st = parseInt(localStorage.getItem(LS_STREAK) || '0', 10) || 0; } catch (e) {}
    return st;
  }
  function updateStreak() {
    let last = -1;
    try { last = parseInt(localStorage.getItem(LS_LAST) || '-1', 10); } catch (e) {}
    let st = streakInfo();
    if (last === DAY_IDX) return st;
    st = (last === DAY_IDX - 1) ? st + 1 : 1;
    try {
      localStorage.setItem(LS_STREAK, String(st));
      localStorage.setItem(LS_LAST, String(DAY_IDX));
    } catch (e) {}
    return st;
  }
  function paintStreak() {
    const st = streakInfo();
    els.streak.textContent = st > 0 ? `🔥 ${st}` : '';
  }

  // ---------- audio ----------
  let audioDays = null;
  let player = null;
  fetch('/audio/manifest.json').then(r => r.ok ? r.json() : null).then(m => {
    audioDays = m && Array.isArray(m.days) ? m.days : [];
    updateListen();
  }).catch(() => { audioDays = []; });
  function updateListen() {
    els.listenBtn.hidden = !(audioDays && audioDays.indexOf(DAY_IDX) !== -1 && !state.done);
  }
  els.listenBtn.addEventListener('click', () => {
    if (player) { player.pause(); player = null; }
    player = new Audio(`/audio/d${DAY_IDX}/${state.cur}.ogg`);
    player.play().catch(() => {});
  });

  // ---------- wheel ----------
  const btnEls = [];
  function buildWheel() {
    els.wheel.innerHTML = '';
    btnEls.length = 0;
    const R = 50; // percent radius
    for (let i = 0; i < N; i++) {
      const b = document.createElement('div');
      b.className = 'wheel-btn';
      b.textContent = day.cells[i].l;
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / N;
      b.style.left = (50 + R * Math.cos(ang)) + '%';
      b.style.top = (50 + R * Math.sin(ang)) + '%';
      els.wheel.appendChild(b);
      btnEls.push(b);
    }
  }
  function renderWheel() {
    for (let i = 0; i < N; i++) {
      const st = state.cells[i].s;
      btnEls[i].className = 'wheel-btn' +
        (st === 'ok' ? ' ok' : st === 'bad' ? ' bad' : st === 'pass' ? ' pass' : '') +
        (i === state.cur && !state.done ? ' current' : '');
    }
  }

  // ---------- flow ----------
  function unanswered(i) { const s = state.cells[i].s; return s === 'pending' || s === 'pass'; }
  function nextUnanswered(from) {
    for (let k = 0; k < N; k++) {
      const i = (from + k) % N;
      if (unanswered(i)) return i;
    }
    return -1;
  }
  function counts() {
    let ok = 0, bad = 0;
    state.cells.forEach(c => { if (c.s === 'ok') ok++; else if (c.s === 'bad') bad++; });
    return { ok, bad, left: N - ok - bad };
  }
  function showCurrent() {
    const i = state.cur;
    const c = day.cells[i];
    els.bigLetter.textContent = c.l;
    els.clueIntro.textContent = c.m === 'comença'
      ? `Comença amb la lletra ${c.l.toUpperCase()}:`
      : `Conté la lletra ${c.l.toUpperCase()}:`;
    els.clueText.textContent = c.q;
    els.input.value = '';
    const k = counts();
    els.scoreOk.textContent = k.ok;
    els.scoreBad.textContent = k.bad;
    els.scoreLeft.textContent = k.left;
    renderWheel();
    setTimeout(() => els.input.focus(), 50);
  }
  function advance() {
    const nxt = nextUnanswered(state.cur);
    if (nxt === -1) { finish(); return; }
    state.cur = nxt;
    save();
    showCurrent();
  }
  function answer(val) {
    const i = state.cur;
    const c = day.cells[i];
    const good = norm(val) === norm(c.a);
    state.cells[i] = { s: good ? 'ok' : 'bad', ans: val };
    save();
    if (player) { player.pause(); player = null; }
    advance();
  }
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = els.input.value.trim();
    if (!v) return;
    answer(v);
  });
  els.passo.addEventListener('click', () => {
    const i = state.cur;
    if (state.cells[i].s === 'pending') state.cells[i].s = 'pass';
    save();
    advance();
  });

  // ---------- results ----------
  function finish() {
    state.done = true;
    save();
    renderWheel(); // final colors before swapping panels
    const st = updateStreak();
    paintStreak();
    els.game.hidden = true;
    els.results.hidden = false;
    const k = counts();
    els.resultTitle.textContent = k.ok === N ? 'Rosca perfecta!' :
      k.ok >= N * 0.7 ? 'Molt bona rosca!' : 'Rosca acabada!';
    els.resultScore.textContent = `${k.ok} de ${N} encerts` + (k.bad ? ` · ${k.bad} errors` : '');
    els.resultWheel.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const d = document.createElement('div');
      d.className = 'cell ' + (state.cells[i].s === 'ok' ? 'ok' : 'bad');
      d.textContent = day.cells[i].l;
      els.resultWheel.appendChild(d);
    }
    els.review.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const c = day.cells[i];
      const stt = state.cells[i].s;
      const item = document.createElement('div');
      item.className = 'review-item ' + (stt === 'ok' ? 'ok' : 'bad');
      const userBit = stt === 'ok' ? '' :
        ` <span class="userans">(has dit: ${state.cells[i].ans || '—'})</span>`;
      item.innerHTML = `<span class="rw">${c.l}: ${c.a}</span>${userBit} — ${c.q}`;
      els.review.appendChild(item);
    }
    const emoji = state.cells.map(c => c.s === 'ok' ? '🟢' : '🔴').join('');
    const text = `La Rosca del ${dayLabel()}\n${k.ok}/${N} encerts\n${emoji}\nhttps://jocs.noeba.cat`;
    const enc = encodeURIComponent(text);
    els.shareX.href = `https://twitter.com/intent/tweet?text=${enc}`;
    els.shareFB.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://jocs.noeba.cat')}&quote=${enc}`;
    els.shareWA.href = `https://wa.me/?text=${enc}`;
    els.shareCopy.onclick = () => {
      const done = () => { els.shareCopy.textContent = 'Copiat!'; setTimeout(() => { els.shareCopy.textContent = 'Copia'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else { done(); }
    };
  }

  // ---------- boot ----------
  buildWheel();
  paintStreak();
  if (state.done) {
    els.game.hidden = true;
    finish();
  } else {
    state.cur = nextUnanswered(state.cur);
    if (state.cur === -1) state.cur = 0;
    els.game.hidden = false;
    showCurrent();
  }
})();
