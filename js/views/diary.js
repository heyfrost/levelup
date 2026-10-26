/* Diary: private entries you type or speak. Locked with fingerprint, then a 4-digit PIN. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon, A = window.Android;
  let unlocked = false, lockMode = null, buf = '', first = '', fails = 0, until = 0, search = '';
  let E = null; // entry being edited
  let emode = 'note'; // which tab of the entry is open: 'rec' or 'note'
  const rec = { on: false, paused: false, speak: false, timer: null, name: '' };

  const D = () => { const s = LU.state; s.diary = Object.assign({ entries: [], pin: null, bio: true }, s.diary || {}); return s.diary; };
  const needPad = () => !unlocked || lockMode === 'reset' || !D().pin;
  LU.voiceBusy = () => rec.on || rec.speak;

  const hash = async (pin, salt) => {
    const t = salt + ':' + pin;
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 5381; for (const c of t) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + h; }
  };

  /* ---------- lock screen ---------- */
  const lockHtml = () => {
    const d = D(), setup = !d.pin || lockMode === 'reset';
    const title = setup ? (first ? 'Confirm your PIN' : lockMode === 'reset' && d.pin ? 'Choose a new PIN' : 'Create a diary PIN') : 'Diary locked';
    const sub = setup ? (first ? 'Enter the same 4 digits again.' : 'Four digits. You will use fingerprint first and this PIN as backup.') : 'Use your fingerprint or enter your PIN.';
    const bio = !setup && d.bio && LU.voiceInfo().bio;
    return `<div class="dlock"><div class="topbar" style="width:100%"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>Diary</h1></div>
      <div class="dl-ic">${I('lock')}</div><div class="dl-t">${title}</div><div class="dl-s">${sub}</div>
      <div class="dots" id="dDots">${[0, 1, 2, 3].map((i) => `<i class="${i < buf.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-act="dk" data-k="${n}">${n}</button>`).join('')}
        ${bio ? `<button data-act="dk" data-k="bio" aria-label="Fingerprint">${I('fingerprint')}</button>` : '<span></span>'}
        <button data-act="dk" data-k="0">0</button><button data-act="dk" data-k="del" aria-label="Delete">${I('backspace')}</button></div>
      ${!setup ? `<button class="link dl-f" data-act="dForgot">Forgot PIN?</button>` : lockMode === 'reset' && d.pin ? `<button class="link dl-f" data-act="dCancelReset">Cancel</button>` : ''}</div>`;
  };
  const paintDots = () => { LU.$$('#dDots i').forEach((x, i) => x.classList.toggle('on', i < buf.length)); };
  const tryBio = () => { if (needPad() && !LU.$('.dlock')) return; if (!D().pin || lockMode === 'reset') return; if (!(A && A.bioAuth) || !D().bio || !LU.voiceInfo().bio) return; try { A.bioAuth('Unlock your diary'); } catch (e) {} };
  const afterLock = () => { buf = ''; first = ''; LU.render(false); };

  LU.actions.dk = async (el) => {
    const k = el.dataset.k;
    if (k === 'bio') { tryBio(); return; }
    if (Date.now() < until) { LU.toast(`Too many tries. Wait ${Math.ceil((until - Date.now()) / 1000)} seconds.`, { sys: false }); return; }
    if (k === 'del') buf = buf.slice(0, -1); else if (buf.length < 4) buf += k;
    LU.vibrate(8); paintDots();
    if (buf.length < 4) return;
    const d = D();
    if (!d.pin || lockMode === 'reset') {
      if (!first) { first = buf; buf = ''; LU.render(false); return; }
      if (first !== buf) { LU.toast('The PINs did not match. Try again.', { sys: false }); first = ''; buf = ''; LU.render(false); return; }
      const salt = LU.uid(); d.pin = { s: salt, h: await hash(buf, salt) };
      lockMode = null; unlocked = true; LU.save(true); LU.toast('Diary lock saved'); afterLock(); return;
    }
    const h = await hash(buf, d.pin.s);
    if (h === d.pin.h) { unlocked = true; fails = 0; afterLock(); return; }
    fails++; buf = ''; LU.vibrate(60);
    const dots = LU.$('#dDots'); if (dots) { dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); }
    if (fails >= 5) { until = Date.now() + 30000; fails = 0; LU.toast('Too many tries. Wait 30 seconds.', { sys: false }); }
    setTimeout(paintDots, 250);
  };
  LU.actions.dForgot = () => {
    if (!(A && A.deviceAuth)) { LU.toast('Resetting the PIN works inside the installed app.'); return; }
    LU.confirm('Reset your PIN?', 'You will confirm with your phone’s screen lock (pattern, PIN or fingerprint). Your entries are kept.', 'Continue', () => { try { A.deviceAuth('Reset diary PIN'); } catch (e) {} });
  };
  LU.actions.dCancelReset = () => { lockMode = null; first = ''; buf = ''; LU.render(false); };
  window.LU_bio = (r) => { if (r === 'ok') { unlocked = true; afterLock(); } else if (r === 'na') LU.toast('Fingerprint is not available. Use your PIN.', { sys: false }); };
  window.LU_devauth = (r) => {
    if (r === 'ok') { lockMode = 'reset'; unlocked = false; first = ''; buf = ''; LU.render(false); }
    else if (r === 'none') LU.toast('Your phone has no screen lock, so the PIN cannot be reset. Set a screen lock in phone settings first.', { ms: 5000 });
    else LU.toast('Not confirmed. The PIN was not changed.', { sys: false });
  };
  document.addEventListener('visibilitychange', () => {
    const top = LU.top && LU.top();
    if (document.hidden) { if (!LU.voiceBusy()) unlocked = false; return; }
    if (!unlocked && top && /^diary/.test(top.name)) { LU.render(false); setTimeout(tryBio, 350); }
  });

  LU.openDiary = () => { unlocked = false; buf = ''; first = ''; lockMode = null; search = ''; LU.push('diary'); };
  LU.actions.openDiary = () => LU.openDiary();

  /* ---------- list ---------- */
  const snip = (t) => { t = (t || '').replace(/\s+/g, ' ').trim(); return t.length > 150 ? t.slice(0, 150) + '…' : t; };
  const trText = (e) => (e.recs || []).map((c) => (c.tx && c.tx.s === 'done' && c.tx.t) || '').filter(Boolean).join(' ');
  const allText = (e) => [e.text || '', trText(e)].filter(Boolean).join(' ');
  const timeOf = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

  LU.views.diary = {
    render() {
      if (needPad()) return lockHtml();
      const d = D(), q = search.trim().toLowerCase();
      const list = d.entries.slice().sort((a, b) => b.t - a.t).filter((e) => !q || allText(e).toLowerCase().includes(q));
      let last = '';
      return `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>Diary<span class="sub">${d.entries.length} entr${d.entries.length === 1 ? 'y' : 'ies'} · private</span></h1>
        <div class="daynav"><button class="iconbtn" data-act="dLockNow" aria-label="Lock now">${I('lock')}</button><button class="iconbtn" data-act="dSettings" aria-label="Diary settings">${I('dots')}</button></div></div>
        <div class="row" style="gap:10px"><button class="btn gold grow" data-act="dNew" data-rec="1">${I('mic')}Record</button><button class="btn grow" data-act="dNew">${I('pen')}Notes</button></div>
        ${d.entries.length ? `<div class="search" style="margin-top:14px">${I('search')}<input id="dSearch" type="text" placeholder="Search your diary" value="${esc(search)}" autocomplete="off"></div>` : ''}
        ${list.map((e) => { const k = LU.keyOf(new Date(e.t)); const head = k !== last ? `<div class="paper">${LU.niceDate(k)}</div>` : ''; last = k;
          return `${head}<div class="card tap dent" data-act="dOpen" data-id="${e.id}"><div class="row" style="align-items:flex-start"><div class="grow"><div class="tiny muted">${timeOf(e.t)}</div><div class="dsn">${esc(snip(allText(e))) || '<span class="dim">Voice note</span>'}</div></div>${(e.recs || []).length ? `<span class="pill gold">${I('mic')}${LU.clock((e.recs || []).reduce((a, c) => a + (c.ms || 0), 0))}</span>` : ''}</div></div>`; }).join('')}
        ${!d.entries.length ? `<div class="empty">${I('diary')}Nothing here yet. Write what happened today, or tap Speak and just talk.</div>` : !list.length ? `<div class="empty">No entry matches “${esc(search)}”.</div>` : ''}
        <div style="height:16px"></div>`;
    },
    mount(el) {
      if (needPad()) { setTimeout(tryBio, 350); return; }
      const inp = LU.$('#dSearch', el);
      if (inp) { let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { search = inp.value; LU.render(); const n = LU.$('#dSearch'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); }; }
    },
  };
  LU.actions.dLockNow = () => { unlocked = false; buf = ''; LU.render(false); setTimeout(tryBio, 300); };
  LU.actions.dNew = (el) => { E = { id: 'e' + LU.uid(), t: Date.now(), text: '', recs: [] }; emode = el && el.dataset.rec ? 'rec' : 'note'; LU.push('diaryEntry', { auto: 0 }); };
  LU.actions.dOpen = (el) => { E = D().entries.find((x) => x.id === el.dataset.id); if (E) { emode = !(E.text || '').trim() && (E.recs || []).length ? 'rec' : 'note'; LU.push('diaryEntry', {}); } };

  /* ---------- editor ---------- */
  const persist = () => {
    if (!E) return; const d = D();
    if (!d.entries.includes(E) && (E.text.trim() || (E.recs || []).length)) { d.entries.unshift(E); if (LU.rpg) LU.rpg.add('diary', 1); }
    LU.save();
  };
  /* ---------- transcripts: each saved recording is written out by the phone itself, no internet ---------- */
  const txHtml = (c) => {
    const t = c.tx || null, f = esc(c.file);
    if (!t) return `<button class="btn ghost sm" data-act="dTxGo" data-f="${f}">${I('pen')}Write the words</button>`;
    if (t.s === 'wait') return `<div class="small muted">Waiting to write the words…</div><div style="margin-top:6px"><button class="btn ghost sm" data-act="dTxCancel" data-f="${f}">Cancel</button></div>`;
    if (t.s === 'run') { const p = Math.round((t.p || 0) * 100); return `<div class="small muted">Writing the words… ${p}%</div>${LU.bar((t.p || 0.01), 'thin')}${t.t ? `<div class="dtxt2" style="margin-top:8px">${esc(t.t)}</div>` : ''}<div style="margin-top:8px"><button class="btn ghost sm" data-act="dTxCancel" data-f="${f}">Stop</button></div>`; }
    if (t.s === 'setup') {
      const why = { nolib: 'The offline speech engine is not in this app yet. Run  bash tools/get_stt.sh  in Termux, then build the app again.', noaccess: 'LevelUp needs permission to read the speech model from your storage.', nomodel: 'The speech model is not on this phone yet. Run  bash tools/get_stt.sh  in Termux.' }[t.c] || 'Offline transcription is not ready.';
      return `<div class="small muted">${esc(why)}</div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${t.c === 'noaccess' ? `<button class="btn sm" data-act="dTxAccess">Allow file access</button>` : ''}<button class="btn ghost sm" data-act="dTxGo" data-f="${f}">Try again</button></div>`;
    }
    if (t.s === 'fail') return `<div class="small" style="color:var(--red)">${esc(t.m || 'The words could not be written.')}</div><div style="margin-top:8px"><button class="btn ghost sm" data-act="dTxGo" data-f="${f}">${I('loop')}Try again</button></div>`;
    const empty = !(t.t || '').trim();
    return `<div class="dtxt2">${empty ? '<span class="dim">No speech was found in this recording.</span>' : esc(t.t)}</div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="dTxCopy" data-f="${f}">Copy</button><button class="btn ghost sm" data-act="dTxEdit" data-f="${f}">${I('edit')}Edit</button><button class="btn ghost sm" data-act="dTxAdd" data-f="${f}">${I('plus')}Add to note</button><button class="btn ghost sm" data-act="dTxGo" data-f="${f}">${I('loop')}Redo</button></div>
      <div class="tiny dim" style="margin-top:6px">${t.l ? 'Language: ' + esc(t.l) + ' · ' : ''}written on this phone${t.edited ? ' · edited' : ''}</div>`;
  };
  const clipsHtml = () => (E.recs || []).map((c, i) => `<div class="dclip"><div class="tiny muted" style="margin-bottom:6px">Recording ${i + 1} · ${timeOf(c.at || E.t)}</div>${LU.audioHtml(c, { del: true, exp: true })}<div class="dtx" data-file="${esc(c.file)}" style="margin-top:10px">${txHtml(c)}</div></div>`).join('');
  const clipOf = (file) => { for (const e of D().entries.concat(E && !D().entries.includes(E) ? [E] : [])) { const c = (e.recs || []).find((x) => x.file === file); if (c) return { e, c }; } return null; };
  const paintTx = (file) => { const el = Array.from(document.querySelectorAll('.dtx')).find((x) => x.dataset.file === file), o = clipOf(file); if (el && o) el.innerHTML = txHtml(o.c); };

  const idleHtml = () => emode === 'rec'
    ? `<button class="btn block rec" data-act="dRec">${I('mic')}Record</button>
       <div class="tiny dim" id="dMode" style="margin-top:8px">${LU.hasVoice ? 'Records your voice and saves it. When you stop, the words are written out on this phone, with no internet.' : 'Voice works inside the installed app.'}</div>`
    : `<button class="btn ghost block" data-act="dSpeak">${I('mic')}Speak to type</button>
       <div class="tiny dim" id="dMode" style="margin-top:8px">${LU.hasVoice ? 'Your spoken words are typed into the note. Nothing is recorded.' : 'Voice works inside the installed app.'}</div>`;
  const activeHtml = () => `<div class="recbar"><span class="recdot ${rec.paused ? 'off' : ''}"></span><b class="num" id="dTm">0:00</b><div class="lv grow"><i id="dLv"></i></div>
    ${rec.on ? `<button class="iconbtn" data-act="dPause" id="dPauseB" aria-label="Pause">${I(rec.paused ? 'play' : 'pause')}</button>` : ''}
    <button class="btn danger sm" data-act="dStop">${I('stop')}Stop</button></div><div class="tiny dim" id="dNote" style="margin-top:8px">${rec.speak ? 'Listening. Your words are added to the note.' : 'Recording. Keep LevelUp open and the screen on.'}</div>`;

  LU.views.diaryEntry = {
    render() {
      if (needPad()) return lockHtml();
      if (!E) return '<div class="empty">Entry not found.</div>';
      const body = emode === 'rec'
        ? `<div class="card" id="dVoice">${rec.on || rec.speak ? activeHtml() : idleHtml()}</div>
           <div id="dClips">${clipsHtml() || ''}</div>
           ${(E.recs || []).length ? '' : `<div class="empty" id="dNoClips">${I('mic')}No recordings yet. Tap Record and talk.</div>`}`
        : `<textarea id="dTxt" class="inp dtxt" placeholder="What is on your mind?" spellcheck="true">${esc(E.text)}</textarea>
           <div class="dhear" id="dHear" hidden></div>
           <div class="card" id="dVoice">${rec.on || rec.speak ? activeHtml() : idleHtml()}</div>
           ${(E.recs || []).length ? `<div class="card tap" data-act="dTab" data-m="rec" style="margin-top:12px"><div class="row"><span class="lic">${I('mic')}</span><div class="grow"><div class="lt">${E.recs.length} recording${E.recs.length === 1 ? '' : 's'}</div><div class="ls">Open to listen and read the words</div></div><span class="chev">${I('chev')}</span></div></div>` : ''}`;
      return `<div class="dedit"><div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>${LU.niceDate(LU.keyOf(new Date(E.t)))}<span class="sub">${timeOf(E.t)}</span></h1>
        <button class="iconbtn" data-act="dDel" aria-label="Delete entry">${I('trash')}</button></div>
        <div class="seg" id="dTabs" style="margin-bottom:12px"><button type="button" data-act="dTab" data-m="rec" class="${emode === 'rec' ? 'on' : ''}">Record</button><button type="button" data-act="dTab" data-m="note" class="${emode === 'note' ? 'on' : ''}">Notes</button></div>
        ${body}<div style="height:24px"></div></div>`;
    },
    mount(el, params) {
      if (needPad()) { setTimeout(tryBio, 350); return; }
      const ta = LU.$('#dTxt', el);
      if (ta) {
        let t; ta.oninput = () => { E.text = ta.value; clearTimeout(t); t = setTimeout(persist, 400); };
        if (!E.text && !rec.on && !rec.speak) setTimeout(() => ta.focus(), 250);
      }
      LU.wireAudio(el, { onDelete: clipDel, onExport: clipExp });
      if (rec.on || rec.speak) startPoll();
      if (E && emode === 'rec' && D().entries.includes(E)) LU.txPump();
    },
  };
  LU.actions.dTab = (el) => {
    const m = el.dataset.m;
    if (m === emode) return;
    if (rec.on || rec.speak) { LU.toast('Stop first, then switch.', { sys: false }); return; }
    emode = m; LU.render(false);
  };

  const startPoll = () => {
    clearInterval(rec.timer);
    rec.timer = setInterval(() => {
      if (!(A && A.recElapsed)) return;
      const tm = LU.$('#dTm'); if (!tm) return;
      if (rec.on) { tm.textContent = LU.clock(A.recElapsed()); const lv = LU.$('#dLv'); if (lv) lv.style.width = Math.max(4, A.recLevel()) + '%'; }
      else { rec.t0 = rec.t0 || Date.now(); tm.textContent = LU.clock(Date.now() - rec.t0); }
    }, 250);
  };
  const addText = (txt) => {
    const ta = LU.$('#dTxt'); if (!ta || !txt) return;
    const t = LU.tidy(txt); ta.value = (ta.value.trim() ? ta.value.replace(/\s*$/, '') + ' ' : '') + t;
    ta.scrollTop = ta.scrollHeight; E.text = ta.value; persist();
  };
  const hear = (t) => { const h = LU.$('#dHear'); if (!h) return; h.hidden = !t; h.textContent = t ? '“' + t + '”' : ''; };
  const sttOn = () => {
    LU.sttHandler = (m) => {
      if (m.k === 'p') hear(m.t);
      else if (m.k === 'f') { hear(''); addText(m.t); }
      else if (m.k === 'e') { const n = LU.$('#dNote'); if (n) n.textContent = LU.sttMessage(m.c); }
    };
  };
  const setVoiceUI = () => { const v = LU.$('#dVoice'); if (v) v.innerHTML = rec.on || rec.speak ? activeHtml() : idleHtml(); };

  LU.actions.dRec = () => {
    if (rec.on || rec.speak || !E) return;
    if (!LU.ensureMic()) return;
    const name = 'd' + E.id + '_' + Date.now().toString(36);
    let r = ''; try { r = String(A.recStart(name, true, false)); } catch (e) { r = 'Error: ' + e.message; }
    if (r !== 'ok') { LU.toast(r.replace(/^Error: /, ''), { ms: 4000 }); return; }
    rec.on = true; rec.paused = false; rec.name = name; setVoiceUI(); startPoll(); LU.sfx('tap');
  };
  LU.actions.dPause = () => {
    if (!rec.on) return;
    try { A[rec.paused ? 'recResume' : 'recPause'](); } catch (e) {}
    rec.paused = !rec.paused; const d = LU.$('.recdot'); if (d) d.classList.toggle('off', rec.paused);
    const b = LU.$('#dPauseB'); if (b) b.innerHTML = I(rec.paused ? 'play' : 'pause');
  };
  LU.actions.dSpeak = () => {
    if (rec.on || rec.speak || !E) return;
    if (!LU.ensureMic()) return;
    if (!LU.voiceInfo().stt) { LU.toast('Speech recognition is not available on this phone.', { ms: 4000 }); return; }
    let r = ''; try { r = String(A.sttOnly()); } catch (e) { r = 'Error: ' + e.message; }
    if (r !== 'ok') { LU.toast(r.replace(/^Error: /, ''), { ms: 4000 }); return; }
    rec.speak = true; rec.t0 = 0; sttOn(); setVoiceUI(); startPoll();
  };
  const stopAll = () => {
    clearInterval(rec.timer); LU.sttHandler = null;
    if (rec.speak) { try { A.sttStop(); } catch (e) {} rec.speak = false; rec.t0 = 0; hear(''); }
    if (rec.on) {
      rec.on = false;
      let r = ''; try { r = String(A.recStop()); } catch (e) { r = 'Error: ' + e.message; }
      hear('');
      if (/^Error/.test(r)) LU.toast(r.replace(/^Error: /, ''), { ms: 4000 });
      else {
        const [file, ms, size, peak] = r.split('|');
        if (+ms < 1000) { try { A.recDelete(file); } catch (e) {} LU.toast('Too short, not saved.', { sys: false }); }
        else if (peak !== undefined && +peak < 8) { try { A.recDelete(file); } catch (e) {} LU.toast('The recording was silent, so it was not saved. Check that LevelUp may use the microphone and no other app is recording.', { ms: 6000 }); }
        else if (E) { E.recs = E.recs || []; E.recs.push({ file, ms: +ms, size: +size, at: Date.now(), tx: { s: 'wait' } }); persist(); LU.save(true); LU.sfx('done'); setTimeout(() => LU.txPump(), 300); }
      }
    }
  };
  LU.actions.dStop = () => {
    const ta = LU.$('#dTxt');
    stopAll(); setVoiceUI();
    const c = LU.$('#dClips'); if (c && E) { c.innerHTML = clipsHtml(); LU.wireAudio(c, { onDelete: clipDel, onExport: clipExp }); const nc = LU.$('#dNoClips'); if (nc && (E.recs || []).length) nc.remove(); }
    if (ta) ta.blur();
  };
  const origPop = LU.pop;
  LU.pop = function () { if ((rec.on || rec.speak)) { stopAll(); } LU.stopAudio && LU.stopAudio(); return origPop.apply(this, arguments); };

  const clipDel = (file) => LU.confirm('Delete this recording?', 'The audio is removed from your phone. The text stays.', 'Delete', () => {
    try { A.recDelete(file); } catch (e) {}
    E.recs = (E.recs || []).filter((c) => c.file !== file); persist(); LU.save(true);
    const c = LU.$('#dClips'); if (c) { c.innerHTML = clipsHtml(); LU.wireAudio(c, { onDelete: clipDel, onExport: clipExp }); }
  }, true);
  const clipExp = (file) => {
    if (!(A && A.recExport)) { LU.toast('Saving a copy works inside the installed app.'); return; }
    const r = String(A.recExport(file, 'LevelUp-diary-' + LU.keyOf(new Date(E.t)) + '-' + file.slice(-8))); LU.toast(/^Error/.test(r) ? r : 'Saved to ' + r, { ms: 3500 });
  };
  LU.actions.dDel = () => LU.confirm('Delete this entry?', 'The text and its recordings will be removed from this phone.', 'Delete', () => {
    stopAll();
    (E.recs || []).forEach((c) => { try { A && A.recDelete && A.recDelete(c.file); } catch (e) {} });
    const d = D(); d.entries = d.entries.filter((x) => x !== E); E = null; LU.save(true); LU.pop();
  }, true);

  const txReady = () => { let s = 'not in this app'; try { s = String(A.txState()); } catch (e) {} return { ok: 'ready', nolib: 'speech engine missing (run tools/get_stt.sh, then build)', noaccess: 'needs file access (open a recording and tap Allow file access)', nomodel: 'model missing (run tools/get_stt.sh)' }[s] || s; };

  /* ---------- diary settings ---------- */
  LU.actions.dSettings = () => {
    const d = D(), vi = LU.voiceInfo();
    LU.sheet({
      title: 'Diary settings',
      body: `<div class="list">
        <div class="li" data-act="dChangePin"><span class="lic">${I('lock')}</span><div class="grow"><div class="lt">Change PIN</div></div><span class="chev">${I('chev')}</span></div>
        <div class="li" data-act="dBioTog"><span class="lic">${I('fingerprint')}</span><div class="grow"><div class="lt">Unlock with fingerprint</div><div class="ls">${vi.bio ? 'Fingerprint first, PIN as backup' : 'Not available on this phone'}</div></div><span class="switch ${d.bio && vi.bio ? 'on' : ''}"></span></div>
        <div class="li" data-act="dWipe"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('trash')}</span><div class="grow"><div class="lt">Delete the whole diary</div></div></div></div>
        <div class="card small muted" style="margin-top:12px"><b>Voice check</b><br>Microphone: ${vi.mic ? 'allowed' : 'not allowed yet'}<br>Speech to text: ${vi.stt ? 'available' : 'not available'}<br>Offline transcription: ${txReady()}</div>
        <p class="tiny dim" style="margin-top:12px">The lock hides the diary inside LevelUp. Entries are stored on this phone only. Voice recordings are not part of the backup file.</p>`,
    });
  };
  LU.actions.dChangePin = () => { LU.closeSheet(true); lockMode = 'reset'; first = ''; buf = ''; LU.render(false); };
  LU.actions.dBioTog = () => { const d = D(); d.bio = !d.bio; LU.save(); LU.closeSheet(true); LU.actions.dSettings(); };
  LU.actions.dWipe = () => LU.confirm('Delete the whole diary?', 'Every entry and recording is removed from this phone. This cannot be undone.', 'Delete all', () => {
    const d = D(); d.entries.forEach((e) => (e.recs || []).forEach((c) => { try { A && A.recDelete && A.recDelete(c.file); } catch (x) {} }));
    d.entries = []; LU.save(true); LU.render();
  }, true);

  /* ---------- transcript queue ---------- */
  let txFresh = true;
  const allClips = () => { const out = []; D().entries.forEach((e) => (e.recs || []).forEach((c) => out.push(c))); return out; };
  LU.txPump = () => {
    if (!(A && A.txStart) || rec.on) return;
    const cl = allClips();
    if (txFresh) { txFresh = false; let busy = false; try { busy = !!A.txBusy(); } catch (e) {} if (!busy) cl.forEach((c) => { if (c.tx && c.tx.s === 'run') c.tx.s = 'wait'; }); }
    if (cl.some((c) => c.tx && c.tx.s === 'run')) return;
    const c = cl.find((x) => x.tx && x.tx.s === 'wait'); if (!c) return;
    let r = 'fail'; try { r = String(A.txStart(c.file)); } catch (e) { r = 'fail'; }
    if (r === 'ok') c.tx = { s: 'run', p: 0.01, t: '' };
    else if (r === 'nolib' || r === 'noaccess' || r === 'nomodel') c.tx = { s: 'setup', c: r };
    else c.tx = { s: 'fail', m: 'The words could not be started.' };
    LU.save(true); paintTx(c.file);
  };
  window.LU_tx = (m) => {
    const o = clipOf(m.f); if (!o) { setTimeout(LU.txPump, 200); return; }
    const c = o.c;
    if (m.k === 'p') { c.tx = Object.assign(c.tx || {}, { s: 'run', p: m.p, t: m.t }); }
    else if (m.k === 'd') { c.tx = { s: 'done', t: LU.tidy ? LU.tidy(m.t) : m.t, l: m.l || '', at: Date.now() }; LU.save(true); LU.sfx && LU.sfx('done'); }
    else if (m.k === 'e') { c.tx = m.c === 'cancel' ? { s: 'fail', m: 'Stopped. Tap Try again to write the words.' } : { s: 'fail', m: m.m || 'The words could not be written.' }; LU.save(true); }
    paintTx(m.f);
    if (m.k !== 'p') setTimeout(LU.txPump, 400);
  };
  LU.actions.dTxGo = (el) => { const o = clipOf(el.dataset.f); if (!o) return; o.c.tx = { s: 'wait' }; LU.save(true); paintTx(el.dataset.f); LU.txPump(); };
  LU.actions.dTxCancel = (el) => { const o = clipOf(el.dataset.f); if (!o) return; try { A.txCancel(el.dataset.f); } catch (e) {} if (o.c.tx && o.c.tx.s === 'wait') { o.c.tx = { s: 'fail', m: 'Stopped. Tap Try again to write the words.' }; LU.save(true); paintTx(el.dataset.f); } };
  LU.actions.dTxAccess = () => { try { A.txAccess(); } catch (e) {} LU.toast('Turn on “Allow access to manage all files” for LevelUp, then come back and tap Try again.', { ms: 5000 }); };
  LU.actions.dTxCopy = async (el) => { const o = clipOf(el.dataset.f); if (!o || !o.c.tx) return; LU.toast((await LU.copyText(o.c.tx.t || '')) ? 'Copied' : 'Could not copy', { sys: false }); };
  LU.actions.dTxAdd = (el) => {
    const o = clipOf(el.dataset.f); if (!o || !o.c.tx || !o.c.tx.t) return;
    E.text = ((E.text || '').trim() ? E.text.replace(/\s*$/, '') + '\n\n' : '') + o.c.tx.t; persist(); LU.save(true); LU.toast('Added to your note', { sys: false });
  };
  LU.actions.dTxEdit = (el) => {
    const o = clipOf(el.dataset.f); if (!o || !o.c.tx) return;
    LU.sheet({
      title: 'Edit the words', body: `<div class="field"><textarea class="inp" id="txE" rows="10" style="width:100%">${esc(o.c.tx.t || '')}</textarea></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="txOk">Save</button>`,
      mount: (sh) => { LU.$('#txOk', sh).onclick = () => { o.c.tx.t = LU.$('#txE', sh).value; o.c.tx.edited = 1; LU.save(true); LU.closeSheet(); paintTx(el.dataset.f); }; },
    });
  };
  const start = () => setTimeout(() => { try { LU.txPump(); } catch (e) {} }, 7000);
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
