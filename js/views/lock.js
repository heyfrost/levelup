/* Part 10: app lock. A PIN (and fingerprint) over the whole app. Locks when the app starts and after 30 seconds away. */
(function () {
  const LU = window.LU, I = LU.icon, A = window.Android;
  const cfg = () => { const s = LU.state.settings; s.appLock = Object.assign({ on: false, pin: null, bio: true }, s.appLock || {}); return s.appLock; };
  const AWAY_MS = 30000;
  let locked = false, buf = '', fails = 0, el = null, resetting = false, lastActive = Date.now();

  const hash = async (pin, salt) => {
    const t = 'app:' + salt + ':' + pin;
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 5381; for (const c of t) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + h; }
  };
  const bioOk = () => { try { return !!(A && A.bioAuth && LU.voiceInfo && LU.voiceInfo().bio && cfg().bio); } catch (e) { return false; } };

  const paint = () => {
    if (!el) return;
    el.querySelectorAll('.pdots i').forEach((d, i) => d.classList.toggle('on', i < buf.length));
  };
  const show = () => {
    if (!cfg().on || !cfg().pin || el) return;
    locked = true; buf = '';
    el = document.createElement('div');
    el.className = 'applock';
    el.innerHTML = `<h2>LevelUp is locked</h2><div class="small muted">Enter your PIN</div><div class="pdots"><i></i><i></i><i></i><i></i></div><div class="err" id="alErr"></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="bio" aria-label="Fingerprint" ${bioOk() ? '' : 'style="visibility:hidden"'}>${I('fingerprint')}</button><button data-k="0">0</button><button data-k="del" aria-label="Delete">⌫</button></div>
      <button class="link" id="alForgot" style="margin-top:8px">Forgot PIN?</button>`;
    document.body.appendChild(el);
    el.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'alForgot') { forgot(); return; }
      const k = b.dataset.k; if (!k) return;
      if (k === 'bio') { tryBio(); return; }
      if (k === 'del') buf = buf.slice(0, -1);
      else if (buf.length < 4) buf += k;
      paint();
      if (buf.length === 4) check();
    };
    if (bioOk()) setTimeout(tryBio, 350);
  };
  const hide = () => { locked = false; resetting = false; fails = 0; if (el) { el.remove(); el = null; } lastActive = Date.now(); };
  const check = async () => {
    const h = await hash(buf, cfg().pin.s);
    if (h === cfg().pin.h) { hide(); return; }
    fails++; buf = ''; paint();
    const e = document.getElementById('alErr'); if (e) e.textContent = fails >= 5 ? 'Too many tries. Use “Forgot PIN?” if needed.' : 'Wrong PIN. Try again.';
    LU.vibrate && LU.vibrate(60);
  };
  const tryBio = () => { if (!locked || !bioOk()) return; try { A.bioAuth('Unlock LevelUp'); } catch (e) {} };
  const forgot = () => {
    if (!(A && A.deviceAuth)) { LU.toast('Resetting works inside the installed app.'); return; }
    resetting = true; try { A.deviceAuth('Reset app lock'); } catch (e) {}
  };
  /* share the two global callbacks with the diary: ours first while the lock is up */
  const prevBio = window.LU_bio, prevDev = window.LU_devauth;
  window.LU_bio = (r) => { if (locked) { if (r === 'ok') hide(); else if (r === 'na') LU.toast('Fingerprint is not available. Use your PIN.', { sys: false }); } else if (prevBio) prevBio(r); };
  window.LU_devauth = (r) => {
    if (locked && resetting) {
      resetting = false;
      if (r === 'ok') { const c = cfg(); c.on = false; c.pin = null; LU.save(); hide(); LU.toast('App lock is off. Turn it on again in More to set a new PIN.', { ms: 5000 }); }
      else if (r === 'none') LU.toast('Your phone has no screen lock, so the PIN cannot be reset.', { ms: 5000 });
      else LU.toast('Not confirmed.', { sys: false });
    } else if (prevDev) prevDev(r);
  };

  /* lock after time away */
  const wake = () => { if (cfg().on && cfg().pin && !locked && Date.now() - lastActive > AWAY_MS) show(); lastActive = Date.now(); };
  setInterval(() => { if (!locked && !document.hidden) lastActive = Date.now(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('focus', wake);
  LU.appLockWake = wake;
  LU.appLockBoot = () => { show(); };

  /* ---------- setting it up ---------- */
  const setup = () => {
    LU.sheet({
      title: 'Set an app PIN',
      body: `<div class="field"><label>New PIN (4 digits)</label><input class="inp" id="alP1" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off"></div>
        <div class="field"><label>Same PIN again</label><input class="inp" id="alP2" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off"></div>
        <p class="small muted">If you forget it, “Forgot PIN?” on the lock screen lets you switch the lock off after you confirm with your phone’s screen lock.</p>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="alOk">Turn on</button>`,
      mount: (s) => {
        LU.$('#alOk', s).onclick = async () => {
          const a = LU.$('#alP1', s).value, b = LU.$('#alP2', s).value;
          if (!/^\d{4}$/.test(a)) { LU.toast('Use exactly 4 digits.'); return; }
          if (a !== b) { LU.toast('The two PINs do not match.'); return; }
          const c = cfg(), salt = LU.uid(); c.pin = { s: salt, h: await hash(a, salt) }; c.on = true; LU.save(); LU.closeSheet(); LU.toast('App lock is on.', { sys: false }); LU.render();
        };
        setTimeout(() => LU.focusField && LU.focusField(LU.$('#alP1', s)), 350);
      },
    });
  };
  LU.actions.alToggle = () => {
    const c = cfg();
    if (c.on) LU.confirm('Turn off app lock?', 'Anyone who opens LevelUp will see your data.', 'Turn off', () => { c.on = false; c.pin = null; LU.save(); LU.render(); }, true);
    else setup();
  };
  LU.actions.alChange = () => setup();
  LU.actions.alBio = () => { const c = cfg(); c.bio = !c.bio; LU.save(); LU.render(); };
  LU.lockRows = () => {
    const c = cfg(), sw = (on) => `<span class="switch ${on ? 'on' : ''}"></span>`;
    const li = (act, icon, t, sub, extra) => `<div class="li" data-act="${act}"><span class="lic">${I(icon)}</span><div class="grow"><div class="lt">${t}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div>${extra || `<span class="chev">${I('chev')}</span>`}</div>`;
    return li('alToggle', 'lock', 'App lock', c.on ? 'On. Asks for your PIN after 30 seconds away' : 'Ask for a PIN (and fingerprint) to open LevelUp', sw(c.on))
      + (c.on ? li('alChange', 'lock', 'Change PIN', '') + li('alBio', 'fingerprint', 'Unlock with fingerprint', bioOk() || (A && A.bioAuth) ? 'Fingerprint first, PIN as backup' : 'Not available on this phone', sw(c.bio)) : '');
  };
})();
