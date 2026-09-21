/* Capicua — daily Catalan word game. All logic client-side. */
(function () {
  'use strict';

  // ---------- one-time migration from jocs.noeba.cat ----------
  (function migrate() {
    // Fallback (l'script inline del <head> ja ho fa abans del primer pintat).
    // Neteja el hash encara que la importació falli.
    let h, m;
    try { h = location.hash || ''; } catch (e) { return; }
    if (h.indexOf('#m=') !== 0) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    try {
      m = h.match(/^#m=([A-Za-z0-9+\/_-]+=*)/);
      if (!m) return;
      const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const data = JSON.parse(new TextDecoder('utf-8').decode(bytes));
      if (data && Array.isArray(data.k)) {
        for (const pair of data.k) {
          const k = pair[0], v = pair[1];
          if (typeof k === 'string' && k.indexOf('jocs.capicua.') === 0 &&
              typeof v === 'string' && localStorage.getItem(k) === null) {
            localStorage.setItem(k, v);
          }
        }
      }
    } catch (e) {}
  })();

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
    track: document.getElementById('track'),
    bigLetter: document.getElementById('bigLetter'),
    dirBack: document.getElementById('dirBack'),
    dirFwd: document.getElementById('dirFwd'),
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
    timer: document.getElementById('timer'),
    streak: document.getElementById('streak'),
    errModal: document.getElementById('errModal'),
    errAnswer: document.getElementById('errAnswer'),
    errClose: document.getElementById('errClose'),
    resultTitle: document.getElementById('resultTitle'),
    resultScore: document.getElementById('resultScore'),
    resultTrack: document.getElementById('resultTrack'),
    review: document.getElementById('review'),
    shareX: document.getElementById('shareX'),
    shareFB: document.getElementById('shareFB'),
    shareWA: document.getElementById('shareWA'),
    shareCopy: document.getElementById('shareCopy'),
    jokerBtn: document.getElementById('jokerBtn'),
    helpBtn: document.getElementById('helpBtn'),
    helpModal: document.getElementById('helpModal'),
    helpClose: document.getElementById('helpClose'),
  };

  if (DAY_IDX < 0 || DAY_IDX >= DAYS.length) {
    els.nogame.hidden = false;
    return;
  }
  const day = DAYS[DAY_IDX];
  const N = day.cells.length;              // cells incl. the ç joker question
  const CIDX = day.cells.findIndex(c => c.l === 'ç');
  const Q = N - (CIDX >= 0 ? 1 : 0);       // questions per game (letter slots)
  const SLOTS = day.cells.map((_, i) => i).filter(i => i !== CIDX); // track order, no ç

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
  const LS_GAME = `jocs.capicua.day.${DAY_IDX}`;
  const LS_STREAK = 'jocs.capicua.streak';
  const LS_LAST = 'jocs.capicua.lastDay';
  let state;
  try { state = JSON.parse(localStorage.getItem(LS_GAME)) || null; } catch (e) { state = null; }
  if (!state || !Array.isArray(state.cells) || state.cells.length !== N ||
      (state.joker !== 'unused' && state.joker !== 'spent')) {
    state = { cells: day.cells.map(() => ({ s: 'pending', ans: '' })), cur: 0, done: false,
              elapsed: 0, awaiting: 'answer', joker: 'unused', swap: null };
  }
  if (typeof state.elapsed !== 'number') state.elapsed = 0;
  if (state.awaiting !== 'dir' && state.awaiting !== 'answer') state.awaiting = 'answer';
  function save() { try { localStorage.setItem(LS_GAME, JSON.stringify(state)); } catch (e) {} }

  // ---------- timer ----------
  let timerOn = false, timerId = null;
  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function paintTimer() {
    els.timer.textContent = `⏱ ${fmtTime(state.elapsed)}`;
    els.timer.hidden = !timerOn && state.elapsed === 0;
  }
  function startTimer() {
    if (timerOn || state.done) return;
    timerOn = true;
    paintTimer();
    timerId = setInterval(() => {
      state.elapsed += 1;
      if (state.elapsed % 5 === 0) save();
      paintTimer();
    }, 1000);
  }
  function stopTimer() {
    timerOn = false;
    if (timerId) { clearInterval(timerId); timerId = null; }
    save();
    paintTimer();
  }

  // ---------- sounds (WebAudio, no assets) ----------
  let actx = null;
  function tone(freq, t0, dur, type, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      const start = actx.currentTime + t0;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(start); o.stop(start + dur + 0.03);
    } catch (e) {}
  }
  function sndOk() { tone(523.25, 0, .11, 'sine', .16); tone(783.99, .10, .16, 'sine', .16); }
  function sndBad() { tone(146.83, 0, .20, 'square', .07); tone(110.00, .05, .22, 'square', .07); }

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

  // ---------- questions (comodí swap) ----------
  function isSwapped(i) { return state.swap && state.swap.slot === i; }
  function questionFor(i) { return isSwapped(i) ? day.cells[CIDX] : day.cells[i]; }
  function audioIdxFor(i) { return isSwapped(i) ? CIDX : i; }

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
    player = new Audio(`/audio/d${DAY_IDX}/${audioIdxFor(state.cur)}.ogg`);
    player.play().catch(() => {});
  });

  // ---------- 7-tile window ----------
  const WIN = 7, HALF = 3;
  const tileEls = [];
  function buildTrack() {
    els.track.innerHTML = '';
    tileEls.length = 0;
    for (let k = 0; k < WIN; k++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.dataset.pos = k - HALF; // -3..3 around current
      els.track.appendChild(b);
      tileEls.push(b);
    }
  }
  function tileIndexAt(pos) {
    const p = SLOTS.indexOf(state.cur);
    return SLOTS[((p + pos) % Q + Q) % Q];
  }
  function paintWindow() {
    for (let k = 0; k < WIN; k++) {
      const pos = k - HALF;
      const i = tileIndexAt(pos);
      const b = tileEls[k];
      const st = state.cells[i].s;
      b.textContent = day.cells[i].l;
      b.className = 'tile' +
        (Math.abs(pos) === 3 ? ' edge2' : Math.abs(pos) === 2 ? ' edge1' : '') +
        (st === 'ok' ? ' ok' : st === 'bad' ? ' bad' : st === 'pass' ? ' pass' : '') +
        (isSwapped(i) ? ' swapped' : '') +
        (pos === 0 && !state.done ? ' current' : '');
      b.title = '';
      const tappable = !state.done && unanswered(i);
      b.disabled = !tappable && pos !== 0;
      b.onclick = () => {
        if (state.done) return;
        if (unanswered(i)) jumpTo(i);
      };
    }
  }
  function slideWindow(dir) {
    // dir: +1 forward (tiles slide left), -1 backward, 0 = soft fade
    const w = tileEls[0] ? (tileEls[0].offsetWidth + 7) : 55;
    els.track.classList.remove('slide-anim');
    if (dir !== 0) {
      els.track.style.transform = `translateX(${dir * w}px)`;
      els.track.style.opacity = '.35';
    } else {
      els.track.style.opacity = '.25';
    }
    void els.track.offsetWidth; // reflow
    els.track.classList.add('slide-anim');
    els.track.style.transform = 'translateX(0)';
    els.track.style.opacity = '1';
  }

  // ---------- flow ----------
  function unanswered(i) {
    if (i === CIDX) return false;
    const s = state.cells[i].s;
    return s === 'pending' || s === 'pass';
  }
  function nextUnanswered(from, dir) {
    for (let k = 0; k < N; k++) {
      const i = ((from + dir * k) % N + N) % N;
      if (unanswered(i)) return i;
    }
    return -1;
  }
  function counts() {
    let ok = 0, bad = 0;
    state.cells.forEach((c, i) => {
      if (i === CIDX) return;
      if (c.s === 'ok') ok++; else if (c.s === 'bad') bad++;
    });
    return { ok, bad, left: Q - ok - bad };
  }
  function paintScore() {
    const k = counts();
    els.scoreOk.textContent = k.ok;
    els.scoreBad.textContent = k.bad;
    els.scoreLeft.textContent = k.left;
  }
  function setAwaiting(mode) {
    state.awaiting = mode;
    const answering = mode === 'answer';
    els.input.disabled = !answering;
    els.passo.disabled = !answering;
    els.form.querySelector('button[type=submit]').disabled = !answering;
    els.dirBack.disabled = answering;
    els.dirFwd.disabled = answering;
    paintWindow();
    paintJoker();
  }
  function showCurrent(animDir) {
    const i = state.cur;
    const c = questionFor(i);
    els.bigLetter.textContent = c.l;
    els.clueIntro.textContent = (isSwapped(i) ? 'Comodí · ' : '') + (c.m === 'comença'
      ? `Comença amb la lletra ${c.l.toUpperCase()}:`
      : `Conté la lletra ${c.l.toUpperCase()}:`);
    els.clueText.textContent = c.q;
    els.input.value = '';
    paintScore();
    paintWindow();
    paintJoker();
    if (typeof animDir === 'number') slideWindow(animDir);
    if (state.awaiting === 'answer') setTimeout(() => els.input.focus(), 50);
  }
  function move(dir) {
    startTimer();
    const nxt = nextUnanswered(state.cur + dir, dir);
    if (nxt === -1) { finish(); return; }
    state.cur = nxt;
    setAwaiting('answer');
    save();
    showCurrent(dir);
  }
  function jumpTo(i) {
    if (state.done || !unanswered(i)) return;
    startTimer();
    const prev = state.cur;
    state.cur = i;
    setAwaiting('answer');
    save();
    const fwd = ((SLOTS.indexOf(i) - SLOTS.indexOf(prev)) % Q + Q) % Q;
    const bwd = ((SLOTS.indexOf(prev) - SLOTS.indexOf(i)) % Q + Q) % Q;
    showCurrent(fwd <= bwd ? 1 : -1);
  }
  els.dirBack.addEventListener('click', () => { if (state.awaiting === 'dir') move(-1); });
  els.dirFwd.addEventListener('click', () => { if (state.awaiting === 'dir') move(1); });

  function paintJoker() {
    const active = !state.done && state.joker === 'unused' && state.awaiting === 'answer';
    els.jokerBtn.disabled = !active;
    els.jokerBtn.className = 'joker-btn' +
      (state.joker === 'spent' ? ' spent' : '') +
      (!state.done && isSwapped(state.cur) ? ' active' : '');
    els.jokerBtn.title = state.joker === 'spent'
      ? 'Comodí gastat'
      : 'Comodí: canvia la pregunta actual per la de la Ç';
  }
  els.jokerBtn.addEventListener('click', () => { useJoker(); });

  function useJoker() {
    if (state.joker !== 'unused' || state.awaiting !== 'answer' || state.done) return;
    if (state.cur === CIDX) return;
    startTimer();
    state.joker = 'spent';
    state.swap = { slot: state.cur };
    save();
    showCurrent(0); // same slot, question changes to the ç word
  }

  function afterAnswer() {
    // answered/passed: player now picks a direction (or taps a tile)
    const k = counts();
    if (k.left === 0) { finish(); return; }
    setAwaiting('dir');
    save();
    els.input.value = '';
    els.clueIntro.textContent = 'Tria la direcció:';
    els.clueText.textContent = 'Prem ◀ Enrere o Endavant ▶ per anar a una altra lletra, o toca directament una lletra lliure de la tira.';
    paintScore();
    paintWindow();
  }
  function answer(val) {
    startTimer();
    const i = state.cur;
    const c = questionFor(i);
    const good = norm(val) === norm(c.a);
    state.cells[i] = { s: good ? 'ok' : 'bad', ans: val };
    save();
    if (player) { player.pause(); player = null; }
    if (good) {
      sndOk();
      afterAnswer();
    } else {
      sndBad();
      els.errAnswer.textContent = c.a.toUpperCase();
      els.errModal.hidden = false;
      paintWindow();
      setTimeout(() => els.errClose.focus(), 50);
    }
  }
  els.errClose.addEventListener('click', () => {
    els.errModal.hidden = true;
    afterAnswer();
  });
  els.errModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      els.errModal.hidden = true;
      afterAnswer();
    }
  });
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.awaiting !== 'answer') return;
    const v = els.input.value.trim();
    if (!v) return;
    answer(v);
  });
  els.passo.addEventListener('click', () => {
    if (state.awaiting !== 'answer') return;
    startTimer();
    const i = state.cur;
    if (state.cells[i].s === 'pending') state.cells[i].s = 'pass';
    save();
    afterAnswer();
  });

  // ---------- results ----------
  function finish() {
    state.done = true;
    stopTimer();
    save();
    paintWindow();
    paintJoker();
    const st = updateStreak();
    paintStreak();
    els.game.hidden = true;
    els.results.hidden = false;
    const k = counts();
    els.resultTitle.textContent = k.ok === Q ? 'Capicua perfecte!' :
      k.ok >= Q * 0.7 ? 'Molt bon capicua!' : 'Capicua acabat!';
    els.resultScore.textContent = `${k.ok} de ${Q} encerts` +
      (k.bad ? ` · ${k.bad} errors` : '') + ` · ⏱ ${fmtTime(state.elapsed)}`;
    els.resultTrack.innerHTML = '';
    for (let i = 0; i < N; i++) {
      if (i === CIDX) continue;
      const d = document.createElement('div');
      d.className = 'cell ' + (state.cells[i].s === 'ok' ? 'ok' : 'bad') + (isSwapped(i) ? ' swapped' : '');
      d.textContent = day.cells[i].l;
      els.resultTrack.appendChild(d);
    }
    els.review.innerHTML = '';
    for (let i = 0; i < N; i++) {
      if (i === CIDX) continue;
      const c = questionFor(i);
      const stt = state.cells[i].s;
      const item = document.createElement('div');
      item.className = 'review-item ' + (stt === 'ok' ? 'ok' : 'bad');
      const viaJoker = isSwapped(i) ? ' ★' : '';
      const userBit = stt === 'ok' ? '' :
        ` <span class="userans">(has dit: ${state.cells[i].ans || '—'})</span>`;
      item.innerHTML = `<span class="rw">${day.cells[i].l}${viaJoker}: ${c.a}</span>${userBit} — ${c.q}`;
      els.review.appendChild(item);
    }
    const emoji = state.cells.filter((_, i) => i !== CIDX)
      .map(c => c.s === 'ok' ? '🟢' : '🔴').join('') + (state.joker === 'spent' ? '★' : '');
    const text = `Capicua del ${dayLabel()}\n${k.ok}/${Q} encerts · ⏱ ${fmtTime(state.elapsed)}\n${emoji}\nhttps://capicua.noeba.cat`;
    const enc = encodeURIComponent(text);
    els.shareX.href = `https://twitter.com/intent/tweet?text=${enc}`;
    els.shareFB.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://capicua.noeba.cat')}&quote=${enc}`;
    els.shareWA.href = `https://wa.me/?text=${enc}`;
    els.shareCopy.onclick = () => {
      const done = () => { els.shareCopy.textContent = 'Copiat!'; setTimeout(() => { els.shareCopy.textContent = 'Copia'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else { done(); }
    };
  }

  // ---------- help modal ----------
  const LS_HELP = 'jocs.capicua.seenHelp';
  function openHelp() { els.helpModal.hidden = false; setTimeout(() => els.helpClose.focus(), 50); }
  function closeHelp() {
    els.helpModal.hidden = true;
    try { localStorage.setItem(LS_HELP, '1'); } catch (e) {}
  }
  els.helpBtn.addEventListener('click', openHelp);
  els.helpClose.addEventListener('click', closeHelp);
  els.helpModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeHelp(); }
  });

  // ---------- boot ----------
  buildTrack();
  paintStreak();
  if (state.done) {
    els.game.hidden = true;
    finish();
  } else {
    if (!unanswered(state.cur)) {
      state.cur = nextUnanswered(state.cur, 1);
      if (state.cur === -1) state.cur = 0;
    }
    els.game.hidden = false;
    setAwaiting(state.awaiting);
    paintTimer();
    showCurrent();
    if (state.elapsed > 0) startTimer();
    let seenHelp = null;
    try { seenHelp = localStorage.getItem(LS_HELP); } catch (e) {}
    if (!seenHelp && state.elapsed === 0 && state.cells.every(c => c.s === 'pending')) openHelp();
  }
})();
