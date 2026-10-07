/* Voice helpers shared by the Diary and the PDF recorder (talks to Android; nothing here works in a plain browser) */
(function () {
  const LU = window.LU, A = window.Android;
  LU.hasVoice = !!(A && A.recStart);
  LU.voiceInfo = () => {
    const o = { mic: false, stt: false, pipe: false, bio: false, secure: false, sdk: 0 };
    if (!A || !A.voiceInfo) return o;
    try { String(A.voiceInfo()).split(',').forEach((p) => { const [k, v] = p.split('='); o[k] = k === 'sdk' ? +v : v === '1'; }); } catch (e) {}
    return o;
  };
  LU.recUrl = (file) => '/__rec/' + encodeURIComponent(file);
  LU.clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' + LU.pad(m) : m) + ':' + LU.pad(s % 60); };
  LU.ensureMic = () => {
    if (!LU.hasVoice) { LU.toast('Recording works inside the installed app.'); return false; }
    if (!LU.voiceInfo().mic) { try { A.askMic(); } catch (e) {} LU.toast('Allow the microphone, then tap record again.', { ms: 3500 }); return false; }
    return true;
  };
  window.LU_stt = (m) => { if (LU.sttHandler) LU.sttHandler(m); };
  LU.sttMessage = (c) => c === -1 ? 'Words need Android 13 or newer. The audio is still being saved.'
    : c === 12 || c === 13 ? 'English (India) offline voice is not installed. Install it in Google voice settings. The audio is still being saved.'
    : c === 2 || c === 1 || c === 4 ? 'Speech to text needs its voice pack downloaded for offline use. The audio is still being saved.'
    : 'Words are not available right now. The audio is still being saved.';
  /* tidy dictated text: capital first letter, full stop at the end */
  LU.tidy = (t) => { t = String(t || '').trim(); if (!t) return ''; t = t.charAt(0).toUpperCase() + t.slice(1); return /[.!?]$/.test(t) ? t : t + '.'; };

  /* ---------- small audio players: <div class="aud" data-file data-ms> ---------- */
  let cur = null;
  LU.stopAudio = () => { if (cur) { try { cur.a.pause(); } catch (e) {} cur.set(false); cur = null; } };
  LU.wireAudio = (root, o = {}) => {
    LU.$$('.aud', root).forEach((box) => {
      if (box.dataset.wired) return; box.dataset.wired = 1;
      const file = box.dataset.file, ms = +box.dataset.ms || 0;
      const btn = LU.$('.aplay', box), seek = LU.$('.aseek', box), tm = LU.$('.atime', box);
      let a = null;
      const set = (playing) => { btn.classList.toggle('on', playing); btn.innerHTML = LU.icon(playing ? 'pause' : 'play'); };
      const show = () => { const t = a ? a.currentTime * 1000 : 0, d = a && isFinite(a.duration) ? a.duration * 1000 : ms; tm.textContent = LU.clock(t) + ' / ' + LU.clock(d || ms); if (!seek.dataset.drag) { seek.max = Math.max(1, Math.round(d || ms)); seek.value = Math.round(t); } };
      const get = () => {
        if (a) return a;
        a = new Audio(LU.recUrl(file)); a.preload = 'metadata';
        a.addEventListener('timeupdate', show); a.addEventListener('loadedmetadata', show);
        a.addEventListener('ended', () => { set(false); a.currentTime = 0; show(); if (cur && cur.a === a) cur = null; });
        a.addEventListener('error', () => { LU.toast('This recording could not be played.'); set(false); });
        return a;
      };
      btn.onclick = () => {
        const x = get();
        if (!x.paused) { x.pause(); set(false); return; }
        if (cur && cur.a !== x) LU.stopAudio();
        cur = { a: x, set }; x.play().then(() => set(true)).catch(() => LU.toast('This recording could not be played.'));
      };
      seek.oninput = () => { seek.dataset.drag = 1; tm.textContent = LU.clock(+seek.value) + ' / ' + LU.clock(+seek.max); };
      seek.onchange = () => { delete seek.dataset.drag; const x = get(); x.currentTime = +seek.value / 1000; show(); };
      const dl = LU.$('.adel', box); if (dl && o.onDelete) dl.onclick = () => o.onDelete(file, box);
      const ex = LU.$('.aexp', box); if (ex && o.onExport) ex.onclick = () => o.onExport(file, box);
      set(false); show();
    });
  };
  LU.audioHtml = (clip, opts = {}) => `<div class="aud" data-file="${LU.esc(clip.file)}" data-ms="${clip.ms || 0}"><button class="aplay" aria-label="Play">${LU.icon('play')}</button><div class="agrow"><input type="range" class="aseek" min="0" max="${Math.max(1, clip.ms || 1)}" value="0" aria-label="Seek"><span class="atime">0:00 / ${LU.clock(clip.ms || 0)}</span></div>${opts.exp ? `<button class="iconbtn aexp" aria-label="Save a copy">${LU.icon('save')}</button>` : ''}${opts.del ? `<button class="iconbtn adel" aria-label="Delete recording">${LU.icon('trash')}</button>` : ''}</div>`;
})();
