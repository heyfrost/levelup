/* PDF audio recording (like GoodNotes): record while you read, replay later with the page and marks following along */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon, A = window.Android;
  let rc = null;  // active recording { id, docId, name, events, lastPage, paused, timer }
  let pl = null;  // active playback { rec, a, pos, page, key, speed }
  const SPEEDS = [1, 1.25, 1.5, 2];

  const el = () => (LU.rd && LU.rd.R ? LU.rd.R.el : null);
  const elapsed = () => { try { return A && A.recElapsed ? A.recElapsed() : 0; } catch (e) { return 0; } };
  const recs = (docId) => { const d = LU.doc(docId); return d ? (d.recs = d.recs || []) : []; };

  /* ---------- hooks used by the reader ---------- */
  LU.recStamp = (docId) => (rc && rc.docId === docId && !rc.paused ? { r: rc.id, t: Math.round(elapsed()) } : null);
  LU.recPage = (n) => {
    if (!rc || rc.paused || rc.lastPage === n) return;
    rc.lastPage = n; rc.events.push({ t: Math.round(elapsed()), p: n });
  };
  LU.recHide = (x) => !!(pl && x.rt && x.rt.r === pl.rec.id && x.rt.t > pl.pos + 250);
  LU.recOnClose = (docId) => {
    if (rc && rc.docId === docId) stopRec(true);
    if (pl) stopPlay();
  };
  /* tap a mark you made while recording: play from that moment */
  LU.recTapMark = (pg, x, y) => {
    const R = LU.rd && LU.rd.R; if (!R || rc) return false;
    const list = recs(R.id); if (!list.length) return false;
    const m = 0.012; let hit = null;
    (R.ink.strokes || []).forEach((s) => { if (hit || s.pg !== pg || !s.rt) return; const b = LU.strokeBox(s); if (x >= b[0] - m && x <= b[2] + m && y >= b[1] - m && y <= b[3] + m) hit = s; });
    if (!hit) (R.ink.notes || []).forEach((n) => { if (!hit && n.pg === pg && n.rt && Math.abs(n.x - x) < 0.04 && Math.abs(n.y - y) < 0.03) hit = n; });
    if (!hit) return false;
    const rec = list.find((r) => r.id === hit.rt.r); if (!rec) return false;
    playRec(rec, Math.max(0, hit.rt.t - 1500));
    LU.toast('Playing from when you made this mark', { sys: false, ms: 1800 });
    return true;
  };

  /* ---------- bars inside the reader ---------- */
  const bar = (cls, html) => {
    const r = el(); if (!r) return null;
    LU.$$('.' + cls, r).forEach((x) => x.remove());
    const b = document.createElement('div'); b.className = 'rcb ' + cls; b.innerHTML = html; r.appendChild(b); return b;
  };
  const recBarHtml = () => `<span class="recdot ${rc.paused ? 'off' : ''}"></span><b class="num" id="rcTm">0:00</b><div class="lv grow"><i id="rcLv"></i></div>
    <button class="iconbtn" data-rc="pause" aria-label="Pause">${I(rc.paused ? 'play' : 'pause')}</button><button class="btn danger sm" data-rc="stop">${I('stop')}Stop</button>`;
  const plBarHtml = () => `<button class="aplay on" data-rc="pp" aria-label="Play or pause">${I(pl.a.paused ? 'play' : 'pause')}</button>
    <div class="agrow"><input type="range" class="aseek" id="plSeek" min="0" max="${Math.max(1, pl.rec.ms)}" value="${Math.round(pl.pos)}"><span class="atime" id="plTm">${LU.clock(pl.pos)} / ${LU.clock(pl.rec.ms)}</span></div>
    <button class="chip" data-rc="spd" id="plSpd">${pl.speed}×</button><button class="iconbtn" data-rc="close" aria-label="Close">${I('x')}</button>`;
  const wireBar = (b) => { b.onclick = (e) => { const t = e.target.closest('[data-rc]'); if (t) act(t.dataset.rc); }; };

  function act(a) {
    if (a === 'stop') stopRec();
    else if (a === 'pause') {
      if (!rc) return;
      try { A[rc.paused ? 'recResume' : 'recPause'](); } catch (e) {}
      rc.paused = !rc.paused;
      if (!rc.paused) rc.lastPage = 0, LU.recPage(LU.rd.page());
      const b = LU.$('.rcbar'); if (b) { b.innerHTML = recBarHtml(); }
    } else if (a === 'pp') {
      if (!pl) return; if (pl.a.paused) pl.a.play(); else pl.a.pause(); refreshPl();
    } else if (a === 'spd') {
      if (!pl) return; pl.speed = SPEEDS[(SPEEDS.indexOf(pl.speed) + 1) % SPEEDS.length]; pl.a.playbackRate = pl.speed; refreshPl();
    } else if (a === 'close') stopPlay();
  }

  /* ---------- recording ---------- */
  function startRec() {
    const R = LU.rd.R; if (!R) return;
    if (pl) stopPlay();
    if (!LU.ensureMic()) return;
    const id = 'r' + LU.uid(), name = 'p' + id;
    let r = ''; try { r = String(A.recStart(name, false, false)); } catch (e) { r = 'Error: ' + e.message; }
    if (r !== 'ok') { LU.toast(r.replace(/^Error: /, ''), { ms: 4000 }); return; }
    const pg = LU.rd.page();
    rc = { id, docId: R.id, name, events: [{ t: 0, p: pg }], lastPage: pg, paused: false, at: Date.now() };
    const b = bar('rcbar', recBarHtml()); wireBar(b);
    const mb = LU.$('#rdRecB', R.el); if (mb) mb.classList.add('live');
    rc.timer = setInterval(() => {
      const tm = LU.$('#rcTm'); if (!tm) return;
      tm.textContent = LU.clock(elapsed()); const lv = LU.$('#rcLv'); if (lv) lv.style.width = Math.max(4, A.recLevel()) + '%';
    }, 250);
    LU.sfx('tap'); LU.toast('Recording. Your marks and page turns are remembered.', { sys: false, ms: 2200 });
  }
  function stopRec(silent) {
    if (!rc) return;
    const c = rc; rc = null; clearInterval(c.timer);
    const r0 = el(); if (r0) { LU.$$('.rcbar', r0).forEach((x) => x.remove()); const mb = LU.$('#rdRecB', r0); if (mb) mb.classList.remove('live'); }
    let r = ''; try { r = String(A.recStop()); } catch (e) { r = 'Error: ' + e.message; }
    if (/^Error/.test(r)) { LU.toast(r.replace(/^Error: /, ''), { ms: 4000 }); return; }
    const [file, ms, size] = r.split('|');
    if (+ms < 2000) { try { A.recDelete(file); } catch (e) {} if (!silent) LU.toast('Too short, not saved.', { sys: false }); return; }
    const list = recs(c.docId);
    list.push({ id: c.id, file, ms: +ms, size: +size, at: c.at, name: 'Recording ' + (list.length + 1), p0: c.events[0].p, ev: c.events });
    LU.saveInk(c.docId, true); LU.save(true); LU.sfx('done');
    if (!silent) LU.toast(`Saved: ${LU.clock(+ms)} of audio on this PDF`, { ms: 2600 });
  }

  /* ---------- playback ---------- */
  function playRec(rec, from) {
    if (rc) { LU.toast('Stop recording first.', { sys: false }); return; }
    stopPlay(true);
    const a = new Audio(LU.recUrl(rec.file)); a.playbackRate = 1;
    pl = { rec, a, pos: from || 0, page: 0, key: -1, speed: 1 };
    a.addEventListener('loadedmetadata', () => { if (from) a.currentTime = from / 1000; });
    a.addEventListener('timeupdate', tick);
    a.addEventListener('ended', () => { if (pl) { pl.pos = rec.ms; refreshPl(); } });
    a.addEventListener('error', () => { LU.toast('This recording could not be played.'); stopPlay(); });
    a.play().catch(() => { LU.toast('This recording could not be played.'); stopPlay(); });
    LU.closeSheet(true);
    const b = bar('plbar', plBarHtml()); wireBar(b);
    const sk = LU.$('#plSeek', b);
    sk.oninput = () => { sk.dataset.drag = 1; };
    sk.onchange = () => { delete sk.dataset.drag; pl.a.currentTime = +sk.value / 1000; tick(); };
    if (from) { pl.a.currentTime = from / 1000; }
    tick();
  }
  function tick() {
    if (!pl) return;
    const t = pl.a.currentTime * 1000; pl.pos = t;
    let ev = null; (pl.rec.ev || []).forEach((e) => { if (e.t <= t + 150) ev = e; });
    if (ev && ev.p !== pl.page) { pl.page = ev.p; LU.rd.goTo(ev.p); }
    const R = LU.rd.R;
    if (R) {
      let key = 0; (R.ink.strokes || []).forEach((s) => { if (s.rt && s.rt.r === pl.rec.id && s.rt.t <= t + 250) key++; });
      (R.ink.notes || []).forEach((s) => { if (s.rt && s.rt.r === pl.rec.id && s.rt.t <= t + 250) key++; });
      if (key !== pl.key) { pl.key = key; LU.rd.redraw(); }
    }
    refreshPl();
  }
  function refreshPl() {
    if (!pl) return;
    const sk = LU.$('#plSeek'), tm = LU.$('#plTm'), pp = LU.$('[data-rc="pp"]'), sp = LU.$('#plSpd');
    if (sk && !sk.dataset.drag) sk.value = Math.round(pl.pos);
    if (tm) tm.textContent = LU.clock(pl.pos) + ' / ' + LU.clock(pl.rec.ms);
    if (pp) pp.innerHTML = I(pl.a.paused ? 'play' : 'pause');
    if (sp) sp.textContent = pl.speed + '×';
  }
  function stopPlay(keepBar) {
    if (!pl) return;
    const p = pl; pl = null;
    try { p.a.pause(); p.a.removeAttribute('src'); p.a.load(); } catch (e) {}
    const r0 = el(); if (r0 && !keepBar) LU.$$('.plbar', r0).forEach((x) => x.remove());
    if (LU.rd) LU.rd.redraw();
  }

  /* ---------- list of recordings ---------- */
  LU.recorderOpen = (R) => {
    if (!LU.hasVoice) { LU.toast('Recording works inside the installed app.'); return; }
    const list = recs(R.id);
    const body = () => `${rc ? `<div class="card" style="border-color:rgba(255,93,122,.5)"><div class="row"><span class="recdot"></span><div class="grow"><b>Recording now</b><div class="small muted">Tap Stop on the bar at the top of the page.</div></div></div></div>`
      : `<button class="btn block rec" id="rcGo">${I('mic')}Start recording</button><div class="tiny dim" style="margin:8px 2px 14px">Talk or record a lecture while you read. Highlights, notes and page turns are tied to the audio. Keep LevelUp open and the screen on.</div>`}
      <div class="sec-title" style="margin-top:6px">Recordings on this PDF <span class="muted">${list.length}</span></div>
      <div class="list">${list.slice().reverse().map((r) => `<div class="li" data-rcp="${r.id}"><button class="aplay" data-play="${r.id}" aria-label="Play">${I('play')}</button><div class="grow"><div class="lt">${esc(r.name)}</div><div class="ls">${new Date(r.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${LU.clock(r.ms)} · from page ${r.p0}</div></div><button class="iconbtn" data-more="${r.id}" aria-label="Options">${I('dots')}</button></div>`).join('') || '<div class="li"><div class="grow small muted">No recordings yet.</div></div>'}</div>
      ${list.length ? `<p class="tiny dim" style="margin-top:10px">Tip: tap a highlight you made while recording to hear it from that moment. Recordings stay on this phone and are not part of the backup file.</p>` : ''}`;
    LU.sheet({
      title: 'Audio notes', body: body(),
      mount: (s) => {
        const go = LU.$('#rcGo', s); if (go) go.onclick = () => { LU.closeSheet(true); startRec(); };
        LU.$$('[data-play]', s).forEach((b) => (b.onclick = () => { const r = list.find((x) => x.id === b.dataset.play); if (r) playRec(r, 0); }));
        LU.$$('[data-more]', s).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); recMenu(R, list.find((x) => x.id === b.dataset.more)); }));
      },
    });
  };
  function recMenu(R, r) {
    if (!r) return;
    LU.sheet({
      title: r.name, body: `<div class="list">
        <div class="li" id="rmRen"><span class="lic">${I('edit')}</span><div class="grow lt">Rename</div></div>
        <div class="li" id="rmExp"><span class="lic">${I('save')}</span><div class="grow"><div class="lt">Save a copy</div><div class="ls">Download/LevelUp</div></div></div>
        <div class="li" id="rmDel"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('trash')}</span><div class="grow lt">Delete</div></div></div>`,
      mount: (s) => {
        LU.$('#rmRen', s).onclick = () => LU.sheet({
          title: 'Rename recording', body: `<div class="field"><label>Name</label><input class="inp" id="rnR" maxlength="60" value="${esc(r.name)}"></div>`,
          foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="rnRok">Save</button>`,
          mount: (s2) => { LU.$('#rnRok', s2).onclick = () => { const v = LU.$('#rnR', s2).value.trim(); if (v) { r.name = v; LU.save(true); } LU.closeSheet(true); LU.recorderOpen(R); }; },
        });
        LU.$('#rmExp', s).onclick = () => { const o = String(A.recExport(r.file, `LevelUp-${(R.d.name || 'notes').replace(/[^\w]+/g, '-').slice(0, 30)}-${r.name.replace(/[^\w]+/g, '-')}.m4a`)); LU.closeSheet(true); LU.toast(/^Error/.test(o) ? o : 'Saved to ' + o, { ms: 3500 }); };
        LU.$('#rmDel', s).onclick = () => { LU.closeSheet(true); LU.confirm('Delete this recording?', 'The audio is removed from your phone. Your marks stay.', 'Delete', () => {
          if (pl && pl.rec === r) stopPlay();
          try { A.recDelete(r.file); } catch (e) {}
          const d = LU.doc(R.id); d.recs = d.recs.filter((x) => x !== r); LU.save(true); LU.recorderOpen(R);
        }, true); };
      },
    });
  }
})();
