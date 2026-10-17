/* Maps: World and India, political and physical. Pins are linked to a PDF page and grouped by subject. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const pins = () => (LU.state.mapPins = LU.state.mapPins || []);
  const cfg = () => Object.assign({ mode: 'pol', online: false }, (LU.state.settings || {}).map || {});
  const setCfg = (o) => { LU.state.settings.map = Object.assign(cfg(), o); LU.save(); };
  const OTHER = { id: 'other', name: 'Other', color: '#8EA4C6' };
  const subjInfo = (id) => { if (id === 'other' || !id) return OTHER; const s = LU.subject(id); return s ? { id: s.id, name: s.name, color: s.color || '#5CE1FF' } : OTHER; };
  const pinSubj = (p) => { const d = p.doc && LU.doc(p.doc); const id = d ? d.subj : p.subj; return id && id !== 'qp' && LU.subject(id) ? id : 'other'; };

  /* ---------- online tile sources ---------- */
  const TILES = {
    pol: { max: 19, attr: 'Map © Esri', url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}` },
    phy: { max: 17, attr: '© OpenTopoMap (CC-BY-SA), OpenStreetMap', url: (z, x, y) => `https://a.tile.opentopomap.org/${z}/${x}/${y}.png` },
  };
  const tileCache = new Map();

  let M = null; // the open map

  const nx = (lon) => LU.mapNX(lon), ny = (lat) => LU.mapNY(lat);
  const S = () => 256 * Math.pow(2, M.z);
  const bounds = () => M.scope === 'india' ? { x0: nx(58), x1: nx(106), y0: ny(42), y1: ny(0) } : { x0: 0, x1: 1, y0: 0.02, y1: 0.98 };
  const minZ = () => { const b = bounds(); return Math.max(Math.log2(M.w / 256 / (b.x1 - b.x0)), Math.log2(M.h / 256 / (b.y1 - b.y0)), 0.3); };
  const maxZ = () => (cfg().online ? TILES[cfg().mode].max : 10);
  const clamp = () => {
    M.z = Math.max(minZ(), Math.min(maxZ(), M.z));
    const b = bounds(), s = S(), hx = M.w / 2 / s, hy = M.h / 2 / s;
    M.cx = b.x1 - b.x0 <= 2 * hx ? (b.x0 + b.x1) / 2 : Math.max(b.x0 + hx, Math.min(b.x1 - hx, M.cx));
    M.cy = b.y1 - b.y0 <= 2 * hy ? (b.y0 + b.y1) / 2 : Math.max(b.y0 + hy, Math.min(b.y1 - hy, M.cy));
  };
  const sx = (x) => (x - M.cx) * S() + M.w / 2, sy = (y) => (y - M.cy) * S() + M.h / 2;
  const dirty = () => { if (M && !M.raf) M.raf = requestAnimationFrame(() => { if (M) { M.raf = 0; draw(); } }); };

  /* ---------- drawing ---------- */
  const PAL = ['#F4D9A8', '#C9E2B3', '#F6C7C7', '#CBD9F2', '#E8D1F0', '#FAEBA5', '#B9E4DC', '#F0C9A6'];
  const hashOf = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const regionColor = (c) => {
    c = (c || '').toLowerCase();
    if (/range|mtn|mount/.test(c)) return 'rgba(176,128,78,.42)';
    if (/plateau|foothill/.test(c)) return 'rgba(214,170,98,.42)';
    if (/desert|dune/.test(c)) return 'rgba(240,215,140,.55)';
    if (/plain|lowland|basin|delta|wetland|valley|depress/.test(c)) return 'rgba(140,190,110,.38)';
    if (/tundra/.test(c)) return 'rgba(190,200,200,.45)';
    return 'rgba(200,190,150,.25)';
  };

  const pathOf = (ctx, f, closed) => {
    const s = S(), ox = M.w / 2 - M.cx * s, oy = M.h / 2 - M.cy * s;
    ctx.beginPath();
    for (let k = 0; k < f.r.length; k++) {
      const r = f.r[k]; let px = -1e9, py = -1e9;
      for (let i = 0; i < r.length; i += 2) {
        const X = r[i] * s + ox, Y = r[i + 1] * s + oy;
        if (i > 0 && i < r.length - 2 && Math.abs(X - px) + Math.abs(Y - py) < 1.1) continue;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        px = X; py = Y;
      }
      if (closed) ctx.closePath();
    }
  };
  const visible = (f) => {
    const s = S(), b = f.b, ox = M.w / 2 - M.cx * s, oy = M.h / 2 - M.cy * s;
    const x0 = b[0] * s + ox, x1 = b[2] * s + ox, y0 = b[1] * s + oy, y1 = b[3] * s + oy;
    if (x1 < 0 || y1 < 0 || x0 > M.w || y0 > M.h) return false;
    return x1 - x0 > 0.5 || y1 - y0 > 0.5;
  };

  const placed = [];
  const hit = (a) => { for (const b of placed) if (a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]) return true; return false; };
  const label = (ctx, text, x, y, o = {}) => {
    ctx.font = o.font; const tw = ctx.measureText(text).width, th = o.size || 11;
    const r = [x - tw / 2 - 2, y - th / 2 - 1, x + tw / 2 + 2, y + th / 2 + 1];
    if (r[0] < 0 || r[2] > M.w || r[1] < 0 || r[3] > M.h) return false;
    if (!o.force && hit(r)) return false;
    placed.push(r);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = o.halo || 'rgba(255,255,255,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
    ctx.fillStyle = o.color || '#1d2733'; ctx.fillText(text, x, y);
    return true;
  };
  const fitsLabel = (ctx, f, text, minPx) => {
    const s = S(), bw = (f.b[2] - f.b[0]) * s, bh = (f.b[3] - f.b[1]) * s;
    if (bw < minPx || bh < 8) return false;
    const tw = ctx.measureText(text).width;
    return tw * 0.8 < bw;
  };

  const drawVector = (ctx, mode, z) => {
    const D = LU.mapData, india = M.scope === 'india';
    const C = D.countries || [], ST = D.states || [];
    ctx.lineJoin = 'round';
    if (mode === 'pol') {
      C.forEach((f) => { if (!visible(f)) return; pathOf(ctx, f, true); ctx.fillStyle = india && f.a3 !== 'IND' ? '#E9E4D6' : PAL[hashOf(f.a || f.n) % PAL.length]; ctx.fill('evenodd'); });
      if (india) ST.forEach((f) => { if (f.a3 !== 'IND' || !visible(f)) return; pathOf(ctx, f, true); ctx.fillStyle = PAL[hashOf(f.n) % PAL.length]; ctx.fill('evenodd'); });
    } else {
      ctx.fillStyle = '#EDE6CD'; C.forEach((f) => { if (!visible(f)) return; pathOf(ctx, f, true); ctx.fill('evenodd'); });
      (D.regions || []).forEach((f) => { if (!visible(f)) return; pathOf(ctx, f, true); ctx.fillStyle = regionColor(f.c); ctx.fill('evenodd'); });
    }
    if (z >= 2.2) (D.lakes || []).forEach((f) => { if (!visible(f)) return; pathOf(ctx, f, true); ctx.fillStyle = mode === 'pol' ? '#CFE6F5' : '#A9D1EA'; ctx.fill('evenodd'); });
    if (mode === 'phy') {
      ctx.strokeStyle = '#4C8FC0'; ctx.lineCap = 'round';
      (D.rivers || []).forEach((f) => { if (!visible(f)) return; if (f.sr > 6 && z < 3.2) return; ctx.lineWidth = Math.max(0.7, (8 - Math.min(f.sr || 5, 7)) * 0.28 + 0.4) * Math.min(1.8, 0.7 + z * 0.12); pathOf(ctx, f, false); ctx.stroke(); });
    }
    /* state borders, then country borders */
    if (ST.length && z >= 2.2) {
      ctx.strokeStyle = mode === 'pol' ? 'rgba(90,100,120,.45)' : 'rgba(120,100,80,.4)'; ctx.lineWidth = 0.7; ctx.setLineDash(z < 4 ? [] : [4, 3]);
      ST.forEach((f) => { if (!visible(f)) return; pathOf(ctx, f, true); ctx.stroke(); });
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = mode === 'pol' ? '#46506a' : '#7a6a58'; ctx.lineWidth = 1.1;
    C.forEach((f) => { if (!visible(f)) return; pathOf(ctx, f, true); ctx.stroke(); });
    if (india) { ctx.strokeStyle = '#1d2740'; ctx.lineWidth = 2; C.forEach((f) => { if (f.a3 === 'IND' && visible(f)) { pathOf(ctx, f, true); ctx.stroke(); } }); }
  };

  const drawLabels = (ctx, mode, z) => {
    const D = LU.mapData, india = M.scope === 'india', s = S();
    const at = (f) => [sx(f.l[0]), sy(f.l[1])];
    const fs = Math.max(9, Math.min(15, 8.5 + z * 1.1));
    if (mode === 'phy') {
      (D.regions || []).forEach((f) => {
        if (!f.n || !visible(f)) return; ctx.font = `italic 600 ${fs - 1}px Inter, sans-serif`;
        if (!fitsLabel(ctx, f, f.n, 30) && z < 5) return; const [x, y] = at(f);
        label(ctx, f.n, x, y, { font: ctx.font, size: fs, color: '#6b4a2a' });
      });
    }
    ctx.font = `700 ${fs}px Inter, sans-serif`;
    (D.countries || []).slice().sort((a, b) => (b.b[2] - b.b[0]) * (b.b[3] - b.b[1]) - (a.b[2] - a.b[0]) * (a.b[3] - a.b[1])).forEach((f) => {
      if (!f.n || !visible(f)) return; if (!fitsLabel(ctx, f, f.n, 36)) return;
      const [x, y] = at(f); label(ctx, f.n.toUpperCase().length < 14 && z < 3 ? f.n.toUpperCase() : f.n, x, y, { font: ctx.font, size: fs, color: '#222c3f' });
    });
    if (z >= (india ? 3.4 : 4.2)) {
      ctx.font = `italic 500 ${Math.max(9, fs - 2)}px Inter, sans-serif`;
      (D.states || []).forEach((f) => { if (!f.n || !visible(f)) return; if (!fitsLabel(ctx, f, f.n, 30) && z < 6) return; const [x, y] = at(f); label(ctx, f.n, x, y, { font: ctx.font, size: fs - 2, color: '#3a4560' }); });
    }
    if (mode === 'phy' && z >= 4) {
      (D.peaks || []).forEach((p) => {
        const X = sx(p.x), Y = sy(p.y); if (X < 0 || Y < 0 || X > M.w || Y > M.h) return;
        ctx.fillStyle = '#8a4b2a'; ctx.beginPath(); ctx.moveTo(X, Y - 5); ctx.lineTo(X - 4.5, Y + 3); ctx.lineTo(X + 4.5, Y + 3); ctx.closePath(); ctx.fill();
        if (p.n) { ctx.font = `600 ${fs - 2}px Inter, sans-serif`; label(ctx, p.n + (p.el ? ' ' + Math.round(p.el) + ' m' : ''), X, Y + 13, { font: ctx.font, size: fs - 2, color: '#5a2f18' }); }
      });
    }
  };

  const drawTiles = (ctx) => {
    const T = TILES[cfg().mode], zi = Math.max(0, Math.min(T.max, Math.round(M.z + 0.2))), n = Math.pow(2, zi), s = S();
    const ts = s / n, ox = M.w / 2 - M.cx * s, oy = M.h / 2 - M.cy * s;
    const tx0 = Math.max(0, Math.floor(-ox / ts)), tx1 = Math.min(n - 1, Math.floor((M.w - ox) / ts));
    const ty0 = Math.max(0, Math.floor(-oy / ts)), ty1 = Math.min(n - 1, Math.floor((M.h - oy) / ts));
    let want = 0, got = 0;
    for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) {
      const url = T.url(zi, x, y); want++;
      let im = tileCache.get(url);
      if (!im) {
        im = new Image(); im.dataset.state = 'load';
        im.onload = () => { im.dataset.state = 'ok'; dirty(); };
        im.onerror = () => { im.dataset.state = 'err'; M && (M.tileErr = Date.now()); updateHint(); };
        im.src = url; tileCache.set(url, im);
        if (tileCache.size > 500) { const k = tileCache.keys().next().value; tileCache.delete(k); }
      }
      if (im.dataset.state === 'ok') { got++; ctx.drawImage(im, Math.round(x * ts + ox), Math.round(y * ts + oy), Math.ceil(ts) + 1, Math.ceil(ts) + 1); }
    }
    M.tileWant = want; M.tileGot = got;
  };

  /* ---------- pins ---------- */
  const visiblePins = () => pins().filter((p) => (M.lock ? pinSubj(p) === M.lock : M.filter === 'all' || pinSubj(p) === M.filter));
  const clusters = () => {
    const out = [];
    visiblePins().forEach((p) => {
      const x = sx(nx(p.lon)), y = sy(ny(p.lat));
      const c = out.find((k) => Math.abs(k.x - x) < 20 && Math.abs(k.y - y) < 20);
      if (c) c.pins.push(p); else out.push({ x, y, pins: [p] });
    });
    return out;
  };
  const drawPin = (ctx, x, y, color, n, text) => {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-13, -14, -11, -27, 0, -27); ctx.bezierCurveTo(11, -27, 13, -14, 0, 0); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -17, 4, 0, 6.3); ctx.fillStyle = '#fff'; ctx.fill();
    if (n > 1) { ctx.beginPath(); ctx.arc(11, -27, 9, 0, 6.3); ctx.fillStyle = '#0B1630'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n > 99 ? '99+' : n, 11, -26.5); }
    ctx.restore();
    if (text) { ctx.font = '600 11.5px Inter, sans-serif'; label(ctx, text.length > 22 ? text.slice(0, 21) + '…' : text, x, y + 9, { font: ctx.font, size: 11.5, force: true, color: '#0B1630' }); }
  };

  const draw = () => {
    if (!M) return;
    const ctx = M.ctx, mode = cfg().mode, online = cfg().online;
    ctx.setTransform(M.dpr, 0, 0, M.dpr, 0, 0);
    clamp();
    ctx.fillStyle = mode === 'pol' ? '#CFE6F5' : '#A9D1EA'; ctx.fillRect(0, 0, M.w, M.h);
    placed.length = 0;
    if (LU.mapReady()) drawVector(ctx, mode, M.z);
    if (online) drawTiles(ctx);
    if (LU.mapReady() && !(online && M.tileGot && M.tileGot >= M.tileWant)) drawLabels(ctx, mode, M.z);
    M.cl = clusters();
    M.cl.forEach((c) => {
      const cnt = {}; c.pins.forEach((p) => { const k = pinSubj(p); cnt[k] = (cnt[k] || 0) + 1; });
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      drawPin(ctx, c.x, c.y, subjInfo(top).color, c.pins.length, c.pins.length === 1 && M.z >= 3 ? c.pins[0].label : '');
    });
    if (M.found) { const x = sx(M.found.x), y = sy(M.found.y); ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.3); ctx.fillStyle = 'rgba(45,140,255,.18)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2D8CFF'; ctx.stroke(); drawPin(ctx, x, y, '#2D8CFF', 1, M.found.name); }
    if (M.draft) { const x = sx(nx(M.draft.lon)), y = sy(ny(M.draft.lat)); drawPin(ctx, x, y, '#FF5D7A', 1, ''); }
    const sc = LU.$('#mapScale'); if (sc) sc.textContent = '';
  };

  /* ---------- gestures ---------- */
  const zoomAt = (x, y, dz) => {
    const before = [(x - M.w / 2) / S() + M.cx, (y - M.h / 2) / S() + M.cy];
    M.z = Math.max(minZ(), Math.min(maxZ(), M.z + dz));
    M.cx = before[0] - (x - M.w / 2) / S(); M.cy = before[1] - (y - M.h / 2) / S();
    dirty();
  };
  const wire = (cv) => {
    const P = new Map(); let g = null, moved = 0, t0 = 0, lastTap = 0;
    const pts = () => Array.from(P.values());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const r = cv.getBoundingClientRect(); P.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
      if (P.size === 1) { moved = 0; t0 = Date.now(); }
      const a = pts(); g = { n: a.length, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 };
      if (a.length > 1) moved = 99;
    });
    cv.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) return;
      const r = cv.getBoundingClientRect(), p = P.get(e.pointerId), nxp = e.clientX - r.left, nyp = e.clientY - r.top;
      const dx = nxp - p.x, dy = nyp - p.y; p.x = nxp; p.y = nyp;
      const a = pts();
      if (a.length === 1) { moved += Math.abs(dx) + Math.abs(dy); M.cx -= dx / S(); M.cy -= dy / S(); dirty(); }
      else if (a.length >= 2) {
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
        if (g && g.d > 10) zoomAt(mx, my, Math.log2(d / g.d));
        M.cx -= dx / 2 / S(); M.cy -= dy / 2 / S();
        g.d = d; dirty();
      }
    });
    const up = (e) => {
      if (!P.has(e.pointerId)) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const wasOne = P.size === 1; P.delete(e.pointerId);
      if (wasOne && moved < 9 && Date.now() - t0 < 500 && e.type === 'pointerup') {
        const now = Date.now();
        if (now - lastTap < 320) { zoomAt(x, y, 1); lastTap = 0; } else { lastTap = now; setTimeout(() => { if (lastTap === now) { lastTap = 0; tap(x, y); } }, 330); }
      }
      const a = pts(); g = a.length ? { n: a.length, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 } : null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, -e.deltaY / 400); }, { passive: false });
  };

  /* ---------- tapping ---------- */
  const tap = (x, y) => {
    if (!M) return;
    if (closeResults()) { LU.$('#mapQ', M.el).blur(); return; }
    if (M.adding) {
      const lon = LU.mapLon((x - M.w / 2) / S() + M.cx), lat = LU.mapLat((y - M.h / 2) / S() + M.cy);
      M.draft = { lon, lat }; dirty(); addSheet(); return;
    }
    let best = null, bd = 1e9;
    (M.cl || []).forEach((c) => { const d = Math.hypot(c.x - x, c.y - 13 - y); if (d < 24 && d < bd) { bd = d; best = c; } });
    if (best) tagsSheet(best.pins);
  };

  /* ---------- sheets ---------- */
  const docName = (p) => { const d = p.doc && LU.doc(p.doc); return d ? d.name : ''; };
  const groupBySubj = (list) => {
    const g = {}; list.forEach((p) => { (g[pinSubj(p)] = g[pinSubj(p)] || []).push(p); });
    return Object.keys(g).sort((a, b) => (a === 'other') - (b === 'other') || subjInfo(a).name.localeCompare(subjInfo(b).name)).map((k) => ({ s: subjInfo(k), list: g[k] }));
  };
  const rowHtml = (p) => `<div class="li mrow" data-pid="${p.id}"><div class="grow"><div class="lt">${esc(p.label)}</div>${p.doc ? `<div class="ls">${LU.doc(p.doc) ? 'Page ' + (p.page || 1) : 'PDF removed'}</div>` : ''}</div>
    ${p.doc && LU.doc(p.doc) ? `<button class="iconbtn" data-open="${p.id}" aria-label="Open the PDF page">${I('notes')}</button>` : ''}<button class="iconbtn" data-edit="${p.id}" aria-label="Edit">${I('dots')}</button></div>`;
  const groupsHtml = (list) => groupBySubj(list).map((g) => `<div class="msec"><i style="background:${g.s.color}"></i>${esc(g.s.name)}</div><div class="list">${g.list.map(rowHtml).join('')}</div>`).join('');
  const wireRows = (root) => {
    LU.$$('[data-pid]', root).forEach((r) => (r.onclick = (e) => {
      if (e.target.closest('[data-edit],[data-open]')) return;
      const p = pins().find((x) => x.id === r.dataset.pid); if (p) openPin(p);
    }));
    LU.$$('[data-open]', root).forEach((b) => (b.onclick = () => { const p = pins().find((x) => x.id === b.dataset.open); if (p) openPin(p); }));
    LU.$$('[data-edit]', root).forEach((b) => (b.onclick = () => { const p = pins().find((x) => x.id === b.dataset.edit); if (p) editSheet(p); }));
  };
  const tagsSheet = (list) => {
    LU.sheet({ title: list.length === 1 ? 'Tag' : `${list.length} tags here`, body: `<div class="mtags">${groupsHtml(list)}</div>`, mount: (sh) => wireRows(sh) });
  };
  const openPin = (p) => {
    const d = p.doc && LU.doc(p.doc);
    if (!d) { LU.toast('This tag has no PDF linked.', { sys: false }); return; }
    LU.closeSheet(true); closeMap(true);
    if (LU.rd && LU.rd.R && LU.rd.R.id === d.id) { LU.rd.goTo(p.page || 1, true); return; }
    if (LU.readerOpen && LU.readerOpen()) LU.closeReader(true);
    setTimeout(() => LU.openReader(d.id, { page: p.page || 1 }), 60);
  };
  const addSheet = () => {
    const fromDoc = M.doc && LU.doc(M.doc), docs = LU.docs();
    const subjOpts = [OTHER].concat(LU.syllabus.map((s) => ({ id: s.id, name: s.name })));
    LU.sheet({
      title: 'New tag',
      body: `<div class="field"><label>What is here? (topic or your own words)</label><input class="inp" id="mpL" maxlength="120" placeholder="e.g. Harappa, Indus Valley site" value="${esc(M.draftLabel || '')}"></div>
        ${fromDoc ? `<div class="small muted" style="margin:-2px 2px 10px">Linked to <b>${esc(fromDoc.name)}</b></div>` : `<div class="field"><label>Link to a PDF</label><select class="inp" id="mpD"><option value="">No PDF</option>${docs.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>
        <div class="field" id="mpSw"><label>Subject</label><select class="inp" id="mpS">${subjOpts.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>`}
        <div class="field" id="mpPw"${fromDoc ? '' : ' hidden'}><label>PDF page</label><input class="inp" id="mpP" type="number" min="1" inputmode="numeric" value="${fromDoc ? M.page() : 1}"></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="mpOk">Save tag</button>`,
      onClose: () => { if (M) { M.draft = null; M.draftLabel = ''; dirty(); } },
      mount: (sh) => {
        const d = LU.$('#mpD', sh);
        if (d) d.onchange = () => { const has = !!d.value; LU.$('#mpPw', sh).hidden = !has; LU.$('#mpSw', sh).hidden = has; };
        setTimeout(() => LU.$('#mpL', sh) && LU.$('#mpL', sh).focus(), 250);
        LU.$('#mpOk', sh).onclick = () => {
          const label = LU.$('#mpL', sh).value.trim(); if (!label) { LU.toast('Write what this place is about.', { sys: false }); return; }
          const doc = fromDoc ? fromDoc.id : (d && d.value) || null;
          const p = { id: LU.uid(), lat: M.draft.lat, lon: M.draft.lon, label, doc, page: doc ? Math.max(1, +LU.$('#mpP', sh).value || 1) : 0, subj: doc ? null : (LU.$('#mpS', sh) ? LU.$('#mpS', sh).value : 'other'), at: Date.now() };
          pins().push(p); LU.save(true); M.draft = null; M.draftLabel = ''; M.adding = false; syncUI(); LU.closeSheet(true); dirty(); LU.toast('Tag saved');
        };
      },
    });
  };
  const editSheet = (p) => {
    LU.sheet({
      title: 'Edit tag',
      body: `<div class="field"><label>Text</label><input class="inp" id="meL" maxlength="120" value="${esc(p.label)}"></div>
        ${p.doc ? `<div class="field"><label>PDF page</label><input class="inp" id="meP" type="number" min="1" value="${p.page || 1}"></div><div class="small muted" style="margin:-4px 2px 8px">${esc(docName(p) || 'PDF removed')}</div>` : ''}
        <div class="li" id="meDel"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('trash')}</span><div class="grow lt">Delete this tag</div></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="meOk">Save</button>`,
      mount: (sh) => {
        LU.$('#meOk', sh).onclick = () => { const v = LU.$('#meL', sh).value.trim(); if (!v) return; p.label = v; if (p.doc) p.page = Math.max(1, +LU.$('#meP', sh).value || 1); LU.save(true); LU.closeSheet(true); dirty(); };
        LU.$('#meDel', sh).onclick = () => { LU.confirm('Delete this tag?', p.label, 'Delete', () => { LU.state.mapPins = pins().filter((x) => x.id !== p.id); LU.save(true); LU.closeSheet(true); dirty(); }, true); };
      },
    });
  };
  const listSheet = () => {
    const all = visiblePins();
    const body = (q) => { const l = all.filter((p) => !q || p.label.toLowerCase().includes(q)); return l.length ? groupsHtml(l) : '<p class="small muted" style="margin:10px 2px">No tags yet. Tap + Tag, then tap the map.</p>'; };
    LU.sheet({
      title: `All tags · ${all.length}`,
      body: `<div class="field"><input class="inp" id="mlQ" placeholder="Search tags"></div><div id="mlB">${body('')}</div>`,
      mount: (sh) => {
        const fill = () => { const b = LU.$('#mlB', sh); b.innerHTML = body(LU.$('#mlQ', sh).value.trim().toLowerCase()); wireRows(b); LU.$$('[data-pid]', b).forEach((r) => { const old = r.onclick; r.onclick = (e) => { if (e.target.closest('[data-edit],[data-open]')) return; const p = pins().find((x) => x.id === r.dataset.pid); if (p) { LU.closeSheet(true); flyTo(p); } }; }); };
        LU.$('#mlQ', sh).oninput = fill; fill();
      },
    });
  };
  const flyTo = (p) => { M.z = Math.max(M.z, Math.min(5.5, maxZ())); M.cx = nx(p.lon); M.cy = ny(p.lat); dirty(); };
  const fitPins = () => {
    const l = visiblePins(); if (!l.length) { LU.toast('No tags to show yet.', { sys: false }); return; }
    let x0 = 2, y0 = 2, x1 = -1, y1 = -1; l.forEach((p) => { const x = nx(p.lon), y = ny(p.lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    M.cx = (x0 + x1) / 2; M.cy = (y0 + y1) / 2;
    const span = Math.max((x1 - x0) * 1.4, (y1 - y0) * 1.4, 0.004);
    M.z = Math.min(Math.log2(Math.min(M.w, M.h) / 256 / span), 8); dirty();
  };

  const menuSheet = () => {
    const st = LU.mapStatus(), ready = LU.mapReady(), allOk = st.every((x) => x.ok), mb = st.reduce((a, x) => a + x.mb, 0);
    LU.sheet({
      title: 'Map settings',
      body: `<div class="sec-title" style="margin-top:4px">Offline map data</div>
        <div class="list">${st.map((x) => `<div class="li"><div class="grow"><div class="lt">${esc(x.name)}</div></div><span class="pill ${x.ok ? 'gold' : ''}">${x.ok ? 'Saved' : 'Missing'}</span></div>`).join('')}</div>
        ${allOk ? '' : `<button class="btn block" id="mnDl" style="margin-top:12px">Download missing (about ${mb} MB)</button>`}
        ${ready ? `<button class="btn ghost block" id="mnDel" style="margin-top:10px">Delete offline map data</button>` : ''}
        <p class="tiny dim" style="margin-top:12px">Offline borders, rivers and mountains come from Natural Earth (free, public domain). Online maps come from Esri and OpenTopoMap and may draw some borders differently from India’s official map.</p>`,
      mount: (sh) => {
        const dl = LU.$('#mnDl', sh); if (dl) dl.onclick = () => { LU.closeSheet(true); startDownload(); };
        const del = LU.$('#mnDel', sh); if (del) del.onclick = () => LU.confirm('Delete offline map data?', 'You can download it again later. Your tags are kept.', 'Delete', async () => { await LU.mapDelete(); LU.closeSheet(true); syncUI(); dirty(); }, true);
      },
    });
  };

  /* ---------- data download ---------- */
  const startDownload = async () => {
    const box = LU.$('#mapDl', M.el); if (!box) return;
    box.hidden = false; box.innerHTML = `<b>Downloading map data…</b><div class="small muted" id="mdT" style="margin:6px 0">Starting</div><div class="bar thin"><i id="mdB" style="width:2%"></i></div><div class="tiny dim" style="margin-top:8px">Keep the app open. This happens only once.</div>`;
    let failed = [];
    try {
      failed = await LU.mapDownload((t, f) => { const a = LU.$('#mdT', box), b = LU.$('#mdB', box); if (a) a.textContent = t; if (b) b.style.width = Math.max(3, Math.round(f * 100)) + '%'; });
    } catch (e) { failed = [e.message]; }
    if (!M) return;
    if (failed.length) { box.innerHTML = `<b>Some parts could not be downloaded</b><div class="small muted" style="margin:6px 0">${esc(failed.join('; '))}</div><div class="small muted">Check your internet connection, then try again.</div><button class="btn block" id="mdRe" style="margin-top:12px">Try again</button><button class="btn ghost block" id="mdHide" style="margin-top:8px">Close</button>`; LU.$('#mdRe', box).onclick = startDownload; LU.$('#mdHide', box).onclick = () => { box.hidden = true; }; }
    else box.hidden = true;
    syncUI(); dirty();
  };

  /* ---------- screen ---------- */
  const title = () => M.lock ? (M.lock === 'other' ? 'Other tags' : subjInfo(M.lock).name + ' map') : M.scope === 'india' ? 'India map' : 'World map';
  const chipsHtml = () => {
    if (M.lock) return '';
    const cnt = {}; pins().forEach((p) => { const k = pinSubj(p); cnt[k] = (cnt[k] || 0) + 1; });
    const ks = Object.keys(cnt).sort((a, b) => (a === 'other') - (b === 'other') || subjInfo(a).name.localeCompare(subjInfo(b).name));
    return `<button class="chip ${M.filter === 'all' ? 'on' : ''}" data-f="all">All ${pins().length}</button>` + ks.map((k) => `<button class="chip ${M.filter === k ? 'on' : ''}" data-f="${k}"><i class="sdot" style="background:${subjInfo(k).color}"></i>${esc(subjInfo(k).name)} ${cnt[k]}</button>`).join('');
  };
  const updateHint = () => {
    if (!M) return; const h = LU.$('#mapHint', M.el); if (!h) return;
    let t = '';
    if (M.adding) t = 'Tap the map where you want the tag';
    else if (cfg().online && M.tileErr && Date.now() - M.tileErr < 8000) t = 'No internet. Showing the offline map.';
    else if (!LU.mapReady() && !cfg().online) t = 'Download the map data, or switch on Online detail';
    h.textContent = t; h.hidden = !t;
  };
  const syncUI = () => {
    if (!M) return;
    const c = cfg();
    LU.$('#mapTitle', M.el).textContent = title();
    LU.$$('[data-sc]', M.el).forEach((b) => b.classList.toggle('on', b.dataset.sc === M.scope));
    LU.$$('[data-md]', M.el).forEach((b) => b.classList.toggle('on', b.dataset.md === c.mode));
    LU.$('#mapOn', M.el).classList.toggle('on', !!c.online);
    LU.$('#mapChips', M.el).innerHTML = chipsHtml(); LU.$('#mapChips', M.el).hidden = !!M.lock;
    LU.$('#mapAdd', M.el).classList.toggle('on', M.adding);
    LU.$('#mapAdd', M.el).innerHTML = M.adding ? `${I('x')}Cancel` : `${I('pin')}Tag`;
    const need = !LU.mapReady();
    const box = LU.$('#mapDl', M.el);
    if (need && !M.dlStarted && box.hidden !== false) {
      const mb = LU.mapStatus().reduce((a, x) => a + x.mb, 0);
      box.hidden = false; box.innerHTML = `<b>Get the map data</b><p class="small muted" style="margin:6px 0 12px">Download it once (about ${mb} MB, best on Wi‑Fi). After that the maps work without internet, including rivers, mountains and states of every country.</p><button class="btn block" id="mdGo">Download now</button><button class="btn ghost block" id="mdLater" style="margin-top:8px">Not now</button>`;
      LU.$('#mdGo', box).onclick = () => { M.dlStarted = true; startDownload(); };
      LU.$('#mdLater', box).onclick = () => { M.dlStarted = true; box.hidden = true; updateHint(); };
    }
    updateHint();
  };
  const setScope = (sc) => {
    M.scope = sc;
    if (sc === 'india') { M.z = 4.1; M.cx = nx(82.5); M.cy = ny(22.5); } else { M.z = 1.4; M.cx = 0.5; M.cy = ny(22); }
    syncUI(); dirty();
  };

  const startMap = (o, scope) => {
    closeMap(true);
    const doc = o.doc && LU.doc(o.doc);
    const el = document.createElement('div'); el.className = 'mapv';
    el.innerHTML = `<div class="map-top"><button class="iconbtn" data-m="close" aria-label="Back">${I('back')}</button><h1 id="mapTitle"></h1>
        <div class="seg"><button data-sc="world">World</button><button data-sc="india">India</button></div>
        <button class="iconbtn" data-m="list" aria-label="All tags">${I('list')}</button><button class="iconbtn" data-m="menu" aria-label="Map settings">${I('dots')}</button></div>
      <div class="map-search"><span class="ms-ic">${I('search')}</span><input id="mapQ" placeholder="Search rivers, lakes, states, places…" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search"><button class="iconbtn" id="mapQx" aria-label="Clear" hidden>${I('x')}</button></div>
      <div class="map-sub"><div class="seg"><button data-md="pol">Political</button><button data-md="phy">Physical</button></div><button class="chip" id="mapOn" data-m="online">Online detail</button></div>
      <div class="map-chips" id="mapChips"></div>
      <div class="map-stage"><canvas id="mapCv"></canvas>
        <div class="map-res" id="mapRes" hidden></div>
        <div class="map-hint" id="mapHint" hidden></div>
        <div class="map-found" id="mapFound" hidden></div>
        <div class="map-zoom"><button data-m="zin" aria-label="Zoom in">${I('plus')}</button><button data-m="zout" aria-label="Zoom out">${I('minus')}</button><button data-m="fit" aria-label="Show all tags">${I('target')}</button></div>
        <button class="btn map-add" id="mapAdd" data-m="add"></button>
        <div class="map-attr" id="mapAttr"></div>
        <div class="map-dl card" id="mapDl" hidden></div></div>`;
    document.body.appendChild(el);
    const cv = LU.$('#mapCv', el);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    M = { el, cv, ctx: cv.getContext('2d'), dpr, w: 360, h: 500, z: 1.4, cx: 0.5, cy: 0.5, scope, filter: 'all', lock: doc ? (doc.subj && doc.subj !== 'qp' && LU.subject(doc.subj) ? doc.subj : 'other') : null, doc: doc ? doc.id : null, page: () => (LU.rd && LU.rd.page ? LU.rd.page() : 1), adding: false, draft: null, raf: 0, dlStarted: false };
    const size = () => { const r = cv.parentElement.getBoundingClientRect(); M.w = Math.max(50, r.width); M.h = Math.max(50, r.height); cv.width = Math.round(M.w * dpr); cv.height = Math.round(M.h * dpr); cv.style.width = M.w + 'px'; cv.style.height = M.h + 'px'; dirty(); };
    M.ro = new ResizeObserver(size); M.ro.observe(cv.parentElement);
    size(); wire(cv); wireSearch();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !M) return;
      if (b.dataset.sc) { setScope(b.dataset.sc); return; }
      if (b.dataset.md) { setCfg({ mode: b.dataset.md }); syncUI(); attr(); dirty(); return; }
      if (b.dataset.f) { M.filter = b.dataset.f; syncUI(); dirty(); return; }
      const m = b.dataset.m;
      if (m === 'close') closeMap();
      else if (m === 'zin') { zoomAt(M.w / 2, M.h / 2, 1); }
      else if (m === 'zout') { zoomAt(M.w / 2, M.h / 2, -1); }
      else if (m === 'fit') fitPins();
      else if (m === 'list') listSheet();
      else if (m === 'menu') menuSheet();
      else if (m === 'online') { setCfg({ online: !cfg().online }); M.tileErr = 0; syncUI(); attr(); dirty(); }
      else if (m === 'tagfound') { if (M.found) { const f = M.found; M.draft = { lon: LU.mapLon(f.x), lat: LU.mapLat(f.y) }; M.draftLabel = f.name; addSheet(); } }
      else if (m === 'clearfound') { M.found = null; LU.$('#mapQ', M.el).value = ''; LU.$('#mapQx', M.el).hidden = true; syncFound(); dirty(); }
      else if (m === 'add') { M.adding = !M.adding; M.draft = null; syncUI(); dirty(); }
    });
    const attr = () => { LU.$('#mapAttr', el).textContent = cfg().online ? TILES[cfg().mode].attr : LU.mapReady() ? 'Natural Earth' : ''; };
    M.attr = attr;
    setScope(scope); attr();
    LU.mapLoad().then(() => { if (M && M.el === el) { syncUI(); attr(); dirty(); } });
  };
  const closeMap = (quick) => {
    if (!M) return; const m = M; M = null;
    try { m.ro.disconnect(); } catch (e) {}
    m.el.remove();
  };
  LU.mapIsOpen = () => !!M;
  LU.mapClusters = () => (M && M.cl ? M.cl.map((c) => ({ x: c.x, y: c.y, n: c.pins.length })) : []);
  LU.mapClose = closeMap;


  /* ---------- search ---------- */
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const KIND = { Country: 0, 'State / province': 1, River: 2, Lake: 3, Mountain: 4, Peak: 4, Region: 5 };
  let IDX = null, IDXKEY = '';
  const regionType = (c) => { c = (c || '').toLowerCase(); return /range|mtn/.test(c) ? 'Mountain range' : /plateau/.test(c) ? 'Plateau' : /plain|lowland/.test(c) ? 'Plain' : /desert|dune/.test(c) ? 'Desert' : /basin|depress/.test(c) ? 'Basin' : /delta/.test(c) ? 'Delta' : /island|archipel/.test(c) ? 'Islands' : /peninsula|pen\/cape/.test(c) ? 'Peninsula' : /valley|gorge/.test(c) ? 'Valley' : /tundra/.test(c) ? 'Tundra' : 'Region'; };
  const buildIndex = () => {
    const D = LU.mapData, key = Object.keys(D).join(',');
    if (IDX && key === IDXKEY) return IDX;
    const out = [], seen = new Map();
    const add = (e) => {
      if (!e.n) return; e.nl = norm(e.n); if (!e.nl) return;
      const k = e.t + '|' + e.nl, old = seen.get(k);
      const size = e.b ? (e.b[2] - e.b[0]) + (e.b[3] - e.b[1]) : 0;
      if (old) { if (size > old.size) { old.e.f = e.f; old.e.b = e.b; old.e.x = e.x; old.e.y = e.y; old.size = size; } return; }
      seen.set(k, { e, size }); out.push(e);
    };
    const mid = (f) => { let best = f.r[0]; f.r.forEach((r) => { if (r.length > best.length) best = r; }); const i = (best.length / 4 | 0) * 2; return [best[i], best[i + 1]]; };
    (D.countries || []).forEach((f) => add({ n: f.n, t: 'Country', sub: '', b: f.b, x: f.l[0], y: f.l[1] }));
    (D.states || []).forEach((f) => add({ n: f.n, t: 'State / province', sub: f.a || '', b: f.b, x: f.l[0], y: f.l[1] }));
    (D.rivers || []).forEach((f) => { const m = mid(f); add({ n: f.n, t: 'River', sub: '', b: f.b, x: m[0], y: m[1] }); });
    (D.lakes || []).forEach((f) => add({ n: f.n, t: 'Lake', sub: '', b: f.b, x: f.l[0], y: f.l[1] }));
    (D.regions || []).forEach((f) => add({ n: f.n, t: regionType(f.c), sub: '', b: f.b, x: f.l[0], y: f.l[1] }));
    (D.peaks || []).forEach((p) => add({ n: p.n, t: 'Peak', sub: p.el ? Math.round(p.el) + ' m' : '', b: null, x: p.x, y: p.y, pt: true }));
    IDX = out; IDXKEY = key; return out;
  };
  const searchLocal = (q) => {
    const ql = norm(q), res = [];
    if (!ql) return res;
    pins().forEach((p) => { const n = norm(p.label); const i = n.indexOf(ql); if (i >= 0) res.push({ sc: i === 0 ? -1 : 0, tag: p, n: p.label, t: 'Your tag', sub: '' }); });
    buildIndex().forEach((e) => {
      const i = e.nl.indexOf(ql); if (i < 0) return;
      const sc = e.nl === ql ? 0 : i === 0 ? 1 : e.nl.charAt(i - 1) === ' ' ? 2 : 3;
      res.push({ sc, e, n: e.n, t: e.t, sub: e.sub, k: (KIND[e.t] === undefined ? 5 : KIND[e.t]) });
    });
    res.sort((a, b) => a.sc - b.sc || (a.k || 0) - (b.k || 0) || a.n.length - b.n.length);
    return res.slice(0, 10);
  };

  let onlineTimer = 0, onlineCtl = null, shown = [];
  const resBox = () => LU.$('#mapRes', M.el);
  const rowsHtml = (list) => list.map((r, i) => `<button class="mres" data-ri="${i}"><span class="mr-t"><b>${esc(r.n)}</b><small>${esc(r.t)}${r.sub ? ' · ' + esc(r.sub) : ''}</small></span>${I('chev')}</button>`).join('');
  const paintResults = (local, online, note) => {
    if (!M) return; const box = resBox();
    shown = local.concat(online || []);
    let h = rowsHtml(local);
    if (online && online.length) h += `<div class="mres-h">Places online</div>` + rowsHtml(online).replace(/data-ri="(\d+)"/g, (m, i) => `data-ri="${+i + local.length}"`);
    if (note) h += `<div class="mres-n">${esc(note)}</div>`;
    if (!h) h = `<div class="mres-n">No match. Try another spelling.</div>`;
    box.innerHTML = h; box.hidden = false;
  };
  const closeResults = () => { if (!M) return false; const b = resBox(); const was = !b.hidden; b.hidden = true; return was; };
  const searchOnline = async (q, local) => {
    if (onlineCtl) onlineCtl.abort();
    if (navigator.onLine === false || q.length < 3) return;
    onlineCtl = new AbortController();
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&q=' + encodeURIComponent(q), { signal: onlineCtl.signal });
      if (!r.ok) throw new Error('x');
      const j = await r.json();
      if (!M || LU.$('#mapQ', M.el).value.trim() !== q) return;
      const seen = new Set(local.map((x) => norm(x.n) + x.t));
      const on = j.map((o) => {
        const parts = String(o.display_name || '').split(',').map((x) => x.trim());
        const name = o.name || parts[0]; const bb = (o.boundingbox || []).map(Number);
        return { n: name, t: String(o.addresstype || o.type || 'place').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), sub: parts.slice(1, 3).join(', '), lat: +o.lat, lon: +o.lon, bb, online: true };
      }).filter((o) => !isNaN(o.lat) && !isNaN(o.lon));
      paintResults(local, on);
    } catch (e) { if (e.name !== 'AbortError' && M && LU.$('#mapQ', M.el).value.trim() === q) paintResults(local, [], local.length ? '' : 'Could not reach online search. Offline matches only.'); }
  };
  const onQuery = () => {
    const inp = LU.$('#mapQ', M.el), q = inp.value.trim();
    LU.$('#mapQx', M.el).hidden = !inp.value;
    clearTimeout(onlineTimer); if (onlineCtl) onlineCtl.abort();
    if (!q) { closeResults(); return; }
    const local = searchLocal(q);
    paintResults(local, null, q.length >= 3 && navigator.onLine !== false ? 'Searching places online…' : '');
    if (q.length >= 3) onlineTimer = setTimeout(() => searchOnline(q, local), 650);
  };
  const fitBox = (x0, y0, x1, y1, maxz) => {
    M.cx = (x0 + x1) / 2; M.cy = (y0 + y1) / 2;
    const sw = Math.max((x1 - x0) * 1.5, 1e-6), sh = Math.max((y1 - y0) * 1.5, 1e-6);
    M.z = Math.min(Math.log2(M.w / 256 / sw), Math.log2(M.h / 256 / sh), maxz);
  };
  const pickResult = (r) => {
    closeResults(); const inp = LU.$('#mapQ', M.el); inp.blur();
    if (r.tag) { inp.value = ''; LU.$('#mapQx', M.el).hidden = true; M.found = null; flyTo(r.tag); syncFound(); return; }
    let x, y, b = null, name = r.n;
    if (r.online) { x = nx(r.lon); y = ny(r.lat); if (r.bb && r.bb.length === 4) b = [nx(r.bb[2]), ny(r.bb[1]), nx(r.bb[3]), ny(r.bb[0])]; }
    else { x = r.e.x; y = r.e.y; b = r.e.b; }
    /* make sure the place is inside the current map (switch India -> World if needed) */
    const bb = bounds(); if (M.scope === 'india' && (x < bb.x0 || x > bb.x1 || y < bb.y0 || y > bb.y1)) { M.scope = 'world'; }
    const cap = maxZ();
    if (b && (b[2] - b[0] > 1e-5 || b[3] - b[1] > 1e-5)) fitBox(b[0], b[1], b[2], b[3], Math.min(cap, 11));
    else { M.cx = x; M.cy = y; M.z = Math.min(cap, r.t === 'Peak' ? 8 : 9); }
    M.found = { x, y, name }; syncUI(); syncFound(); dirty();
  };
  const syncFound = () => {
    if (!M) return; const el = LU.$('#mapFound', M.el);
    if (!M.found) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = `<span class="mf-n">${esc(M.found.name)}</span><button class="btn sm" data-m="tagfound">${I('pin')}Tag here</button><button class="iconbtn" data-m="clearfound" aria-label="Clear">${I('x')}</button>`;
  };
  const wireSearch = () => {
    const inp = LU.$('#mapQ', M.el), box = resBox();
    inp.addEventListener('input', onQuery);
    inp.addEventListener('focus', () => { if (inp.value.trim()) onQuery(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (shown[0]) pickResult(shown[0]); } });
    LU.$('#mapQx', M.el).onclick = () => { inp.value = ''; LU.$('#mapQx', M.el).hidden = true; closeResults(); M.found = null; syncFound(); dirty(); inp.focus(); };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-ri]'); if (b && shown[+b.dataset.ri]) pickResult(shown[+b.dataset.ri]); });
  };
  LU.mapView = () => (M ? { z: M.z, cx: M.cx, cy: M.cy, scope: M.scope, found: M.found || null } : null);

  /* ---------- entry: choose World or India ---------- */
  LU.mapOpen = (o = {}) => {
    const doc = o.doc && LU.doc(o.doc);
    const sub = doc ? (doc.subj && doc.subj !== 'qp' && LU.subject(doc.subj) ? LU.subject(doc.subj).name : 'Other') : null;
    LU.sheet({
      title: 'Choose a map',
      body: `${sub ? `<p class="small muted" style="margin:0 2px 12px">Showing only tags of <b>${esc(sub)}</b>. New tags link to this PDF page.</p>` : ''}
        <div class="mapch"><button data-pick="world"><span>${I('map')}</span><b>World map</b><small>Countries and their states, rivers, mountains</small></button>
        <button data-pick="india"><span>${I('map')}</span><b>India map</b><small>States, rivers, mountains, plateaus</small></button></div>`,
      mount: (sh) => LU.$$('[data-pick]', sh).forEach((b) => (b.onclick = () => { LU.closeSheet(true); startMap(o, b.dataset.pick); })),
    });
  };
  LU.actions.openMap = () => LU.mapOpen({});

  /* Back button */
  const prevBack = window.LU_back;
  window.LU_back = () => {
    if (M) {
      if (LU.closeOverlay()) return true;
      if (LU.closeSheet()) return true;
      if (closeResults()) return true;
      if (M.adding) { M.adding = false; M.draft = null; syncUI(); dirty(); return true; }
      closeMap(); return true;
    }
    return prevBack();
  };
})();
