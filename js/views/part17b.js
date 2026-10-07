/* Part 17b: sync between two devices on the same Wi-Fi. Press Sync on both, type a code, done. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, (x) => CODE_ABC[x % CODE_ABC.length]).join(''); };
  const fmtCode = (c) => c.slice(0, 4) + '-' + c.slice(4);
  const cleanCode = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').slice(0, 8);
  const devName = () => (LU.ios ? 'iPad' : window.Android ? 'Phone' : 'Browser');
  const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';
  let S = { busy: false, log: [], bytes: 0, total: 0, files: true, cancel: null };

  /* ---------- UI helpers (update the page without redrawing it) ---------- */
  const say = (t) => { S.log.push(t); const e = LU.$('#synLog'); if (e) e.textContent = S.log.slice(-6).join('\n'); };
  const prog = () => { const e = LU.$('#synBar'); if (e) e.innerHTML = LU.bar(S.total ? Math.min(1, S.bytes / S.total) : 0, 'thin'); };

  /* ---------- signalling through a free public relay (only the short connection note passes through it) ---------- */
  const topicOf = async (code) => { const h = await crypto.subtle.digest('SHA-256', enc.encode('levelup-sync-' + code)); return 'lvlup' + Array.from(new Uint8Array(h)).slice(0, 14).map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const Relay = async (code) => {
    const topic = await topicOf(code), base = 'https://ntfy.sh/' + topic;
    let es = null;
    return {
      publish: async (msg) => { const r = await fetch(base, { method: 'POST', body: JSON.stringify(msg) }); if (!r.ok) throw new Error('relay ' + r.status); },
      subscribe: (cb) => { es = new EventSource(base + '/sse?since=all'); es.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.event === 'message') cb(JSON.parse(m.message)); } catch (x) {} }; return es; },
      close: () => { try { es && es.close(); } catch (e) {} },
    };
  };

  /* ---------- the direct connection ---------- */
  const lanIp = () => { try { return window.Android && Android.localIp ? String(Android.localIp() || '') : ''; } catch (e) { return ''; } };
  /* browsers hide their address behind a random .local name; on the phone we put the real address back so the iPad can reach it */
  const fixSdp = (sdp) => { const ip = lanIp(); return ip ? sdp.replace(/(a=candidate:\S+ \d+ \w+ \d+ )\S+\.local /g, '$1' + ip + ' ') : sdp; };
  const gather = (pc) => new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 3500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  const newPc = () => new RTCPeerConnection({ iceServers: [] });

  /* wrap a data channel: JSON notes, byte streams in pieces, a queue to wait on */
  const Chan = (dc) => {
    dc.binaryType = 'arraybuffer'; dc.bufferedAmountLowThreshold = 262144;
    const inbox = [], waiters = []; let cur = null, sid = 0, closed = false;
    const push = (m) => { const i = waiters.findIndex((w) => w.pred(m)); if (i >= 0) { const w = waiters.splice(i, 1)[0]; w.res(m); } else inbox.push(m); };
    dc.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const m = JSON.parse(e.data);
        if (m.t === 'bs') cur = { meta: m.meta, parts: [], size: m.size };
        else if (m.t === 'be') { const c = cur; cur = null; push({ t: 'stream', meta: c.meta, blob: new Blob(c.parts) }); }
        else push(m);
      } else if (cur) { cur.parts.push(e.data); S.bytes += e.data.byteLength; prog(); }
    };
    dc.onclose = () => { closed = true; waiters.splice(0).forEach((w) => w.rej(new Error('The other device disconnected.'))); };
    const drain = () => new Promise((res) => { if (dc.bufferedAmount < 1048576) return res(); const f = () => { dc.removeEventListener('bufferedamountlow', f); res(); }; dc.addEventListener('bufferedamountlow', f); });
    return {
      send: (o) => dc.send(JSON.stringify(o)),
      sendStream: async (meta, blob) => {
        const id = ++sid; dc.send(JSON.stringify({ t: 'bs', id, meta, size: blob.size }));
        const CH = 32768;
        for (let i = 0; i < blob.size; i += CH) { const buf = await blob.slice(i, i + CH).arrayBuffer(); await drain(); dc.send(buf); S.bytes += buf.byteLength; if (i % (CH * 16) === 0) prog(); }
        dc.send(JSON.stringify({ t: 'be', id }));
      },
      sendJSON: async function (meta, obj) { return this.sendStream(meta, new Blob([enc.encode(JSON.stringify(obj))])); },
      next: (pred, ms) => new Promise((res, rej) => {
        const i = inbox.findIndex(pred); if (i >= 0) return res(inbox.splice(i, 1)[0]);
        if (closed) return rej(new Error('The other device disconnected.'));
        const w = { pred, res: (m) => { clearTimeout(t); res(m); }, rej: (e) => { clearTimeout(t); rej(e); } };
        const t = setTimeout(() => { const j = waiters.indexOf(w); if (j >= 0) waiters.splice(j, 1); rej(new Error('The other device stopped answering.')); }, ms || 120000);
        waiters.push(w);
      }),
      close: () => { try { dc.close(); } catch (e) {} },
    };
  };
  const nextT = (ch, t, ms) => ch.next((m) => m.t === t, ms);
  const nextStream = (ch, k, ms) => ch.next((m) => m.t === 'stream' && m.meta.k === k, ms);
  const readJSON = async (m) => JSON.parse(dec.decode(await m.blob.arrayBuffer()));

  /* ---------- what each device has ---------- */
  const inventory = async () => {
    const st = LU.state, ink = {};
    for (const d of (st.docs || [])) { const v = await LU.idb.get('ink', d.id).catch(() => null); if (v) ink[d.id] = LU.inkSig(v); }
    const keys = async (s) => (await LU.idb.keys(s).catch(() => [])).map(String);
    const files = (await keys('files')).filter((k) => !k.startsWith('bak:')), thumbs = await keys('thumbs');
    const cards = (await keys('snaps')).filter((k) => k.startsWith('card:') || k.startsWith('reftxt:'));
    return { ink, files, thumbs, cards };
  };
  const getItem = async (it) => { const v = await LU.idb.get(it.store, it.key); return v instanceof Blob ? v : new Blob([enc.encode(typeof v === 'string' ? v : JSON.stringify(v))]); };
  const putItem = async (it, blob) => { if (it.store === 'files') { LU._noStamp = true; try { await LU.idb.put('files', it.key, new Blob([blob], { type: 'application/pdf' })); } finally { LU._noStamp = false; } } else await LU.idb.put(it.store, it.key, dec.decode(await blob.arrayBuffer())); };
  const sendItems = async (ch, items) => { for (const it of items) { say('Sending ' + (it.store === 'files' ? 'a PDF' : 'a picture')); await ch.sendStream({ k: 'item', store: it.store, key: it.key }, await getItem(it)); } };
  const recvItems = async (ch, n) => { for (let i = 0; i < n; i++) { const m = await nextStream(ch, 'item', 600000); await putItem({ store: m.meta.store, key: m.meta.key }, m.blob); S.got = (S.got || 0) + (m.meta.store === 'files' ? 1 : 0); say(`Received ${i + 1} of ${n}`); } };

  /* ---------- both sides: save what we are about to change, then switch to the merged data ---------- */
  const applyMerged = async (merged, mergedInk) => {
    const own = LU.state;
    try {
      await LU.idb.clearPrefix('snaps', 'presync:ink:');
      await LU.idb.put('snaps', 'presync:state', JSON.stringify(own));
      for (const id of Object.keys(mergedInk)) { const old = await LU.idb.get('ink', id).catch(() => null); if (old) await LU.idb.put('snaps', 'presync:ink:' + id, old); }
    } catch (e) {}
    for (const id of Object.keys(mergedInk)) await LU.idb.put('ink', id, mergedInk[id]);
    LU.keepOwn(merged, own);
    merged.syncBase = { xp: merged.xp, stats: JSON.parse(JSON.stringify(merged.stats || {})), at: Date.now() };
    for (const id of Object.keys(merged.tomb || {})) { await LU.idb.del('files', id).catch(() => {}); await LU.idb.del('thumbs', id).catch(() => {}); await LU.idb.del('ink', id).catch(() => {}); await LU.idb.del('files', 'ref:' + id).catch(() => {}); await LU.idb.del('snaps', 'reftxt:' + id).catch(() => {}); }
    LU.frozen = true;
    localStorage.setItem('levelup.state.v1', JSON.stringify(merged));
  };
  const finish = (summary) => {
    S.busy = false; say('Done. ' + summary);
    const e = LU.$('#synStatus'); if (e) e.innerHTML = `<div class="card" style="text-align:center"><div class="lt">Synced</div><div class="small muted" style="margin-top:4px">${esc(summary)}</div></div>`;
    LU.toast('Synced. ' + summary, { ms: 3500 }); setTimeout(() => location.reload(), 1800);
  };

  /* ---------- the host asks for the merge, the joiner follows ---------- */
  async function runHost(ch, opts) {
    const hello = await nextT(ch, 'hello', 60000); say('Connected to the ' + (hello.dev || 'other device') + '.');
    const jState = await readJSON(await nextStream(ch, 'state', 120000)), jInv = await readJSON(await nextStream(ch, 'inv', 120000));
    say('Comparing…');
    const hState = LU.state, hInv = await inventory();
    const merged = LU.mergeStates(hState, jState);
    await ch.sendJSON({ k: 'merged' }, merged);
    /* marks on PDFs */
    const ids = Object.keys(Object.assign({}, jInv.ink, hInv.ink)), baseAt = hState.syncBase && jState.syncBase ? Math.min(hState.syncBase.at || 0, jState.syncBase.at || 0) : 0;
    const need = ids.filter((id) => jInv.ink[id] && jInv.ink[id] !== hInv.ink[id]);
    ch.send({ t: 'inkReq', ids: need });
    const theirs = {};
    for (let i = 0; i < need.length; i++) { const m = await nextStream(ch, 'ink', 120000); theirs[m.meta.id] = await LU.inkIn(await readJSON(m)); }
    const mergedInk = {}, back = [];
    for (const id of ids) {
      const mine = await LU.idb.get('ink', id).catch(() => null);
      const hd = (hState.docs || []).find((d) => d.id === id), jd = (jState.docs || []).find((d) => d.id === id);
      const fc = hd && jd ? Math.sign((jd.fileAt || 0) - (hd.fileAt || 0)) : 0;
      let f = mine; if (fc > 0 && theirs[id]) f = theirs[id]; else if (fc < 0) f = mine; else if (theirs[id]) f = mine ? LU.mergeInk(mine, theirs[id], hd && hd.inkAt, jd && jd.inkAt, baseAt) : theirs[id];
      if (!f) continue;
      if (theirs[id] || !jInv.ink[id]) mergedInk[id] = f;
      if (LU.inkSig(f) !== jInv.ink[id]) back.push(id);
    }
    ch.send({ t: 'inkBack', n: back.length });
    for (const id of back) await ch.sendStream({ k: 'ink', id }, new Blob([enc.encode(JSON.stringify(await LU.inkOut(mergedInk[id] || await LU.idb.get('ink', id))))]));
    /* PDFs, thumbnails, card pictures */
    const alive = new Set((merged.docs || []).map((d) => d.id).concat((merged.refs || []).map((b) => 'ref:' + b.id)));
    const okSnap = (k) => !String(k).startsWith('reftxt:') || alive.has('ref:' + String(k).slice(7));
    const mkItems = (A, B, store, ok) => A.filter((k) => !B.includes(k) && ok(k)).map((key) => ({ store, key }));
    const okDoc = (k) => alive.has(k);
    const pushJ = (jInv.wantFiles ? mkItems(hInv.files, jInv.files, 'files', okDoc) : []).concat(mkItems(hInv.thumbs, jInv.thumbs, 'thumbs', okDoc), mkItems(hInv.cards, jInv.cards, 'snaps', okSnap));
    const fromJ = (opts.files ? mkItems(jInv.files, hInv.files, 'files', okDoc) : []).concat(mkItems(jInv.thumbs, hInv.thumbs, 'thumbs', okDoc), mkItems(jInv.cards, hInv.cards, 'snaps', okSnap));
    /* PDFs whose pages were changed on one side: send the newer file over the older one */
    (hState.docs || []).forEach((hd) => {
      const jd = (jState.docs || []).find((d) => d.id === hd.id); if (!jd || !alive.has(hd.id) || (hd.fileAt || 0) === (jd.fileAt || 0)) return;
      const it = { store: 'files', key: hd.id }, mine = (hd.fileAt || 0) > (jd.fileAt || 0), has = (arr) => arr.some((x) => x.store === 'files' && x.key === hd.id);
      if (mine) { if (jInv.wantFiles && !has(pushJ)) pushJ.push(it); } else if (opts.files && !has(fromJ)) fromJ.push(it);
    });
    const size = (it) => (it.store === 'files' ? (((merged.docs || []).find((d) => d.id === it.key) || (merged.refs || []).find((b) => 'ref:' + b.id === it.key) || {}).size || 0) : 20000);
    S.total = pushJ.concat(fromJ).reduce((a, it) => a + size(it), 0); S.bytes = 0; prog();
    ch.send({ t: 'push', items: pushJ, fromYou: fromJ });
    say(pushJ.length || fromJ.length ? `Copying ${pushJ.length + fromJ.length} items (${mb(S.total)})` : 'Nothing else to copy.');
    await sendItems(ch, pushJ);
    await recvItems(ch, fromJ.length);
    ch.send({ t: 'done' });
    await applyMerged(merged, mergedInk);
    finish(`${(merged.docs || []).length} PDFs, ${S.got || 0} received, XP ${merged.xp}.`);
  }
  async function runJoin(ch, opts) {
    ch.send({ t: 'hello', v: 1, dev: devName() });
    await ch.sendJSON({ k: 'state' }, LU.state);
    const inv = await inventory(); inv.wantFiles = !!opts.files;
    await ch.sendJSON({ k: 'inv' }, inv);
    say('Waiting for the other device to compare…');
    const merged = await readJSON(await nextStream(ch, 'merged', 180000));
    const req = await nextT(ch, 'inkReq', 120000);
    for (const id of req.ids) { const v = await LU.idb.get('ink', id).catch(() => null); await ch.sendStream({ k: 'ink', id }, new Blob([enc.encode(JSON.stringify(await LU.inkOut(v || {})))])); }
    const back = await nextT(ch, 'inkBack', 120000), mergedInk = {};
    for (let i = 0; i < back.n; i++) { const m = await nextStream(ch, 'ink', 120000); mergedInk[m.meta.id] = await LU.inkIn(await readJSON(m)); }
    const push = await nextT(ch, 'push', 120000);
    S.total = (push.items || []).length * 400000 + (push.fromYou || []).length * 400000; S.bytes = 0;
    say(push.items.length || push.fromYou.length ? `Copying ${push.items.length + push.fromYou.length} items` : 'Nothing else to copy.');
    await recvItems(ch, push.items.length);
    await sendItems(ch, push.fromYou);
    await nextT(ch, 'done', 600000);
    await applyMerged(merged, mergedInk);
    finish(`${(merged.docs || []).length} PDFs, ${S.got || 0} received, XP ${merged.xp}.`);
  }
  const fail = (e) => {
    S.busy = false; say('Stopped: ' + ((e && e.message) || e));
    const el = LU.$('#synStatus'); if (el) el.innerHTML = `<div class="card small" style="color:var(--red)">${esc((e && e.message) || String(e))}</div>`;
    if (S.cancel) { try { S.cancel(); } catch (x) {} }
    const b = LU.$('#synCancel'); if (b) b.textContent = 'Close';
  };

  /* ---------- connecting ---------- */
  const startHost = async () => {
    if (S.busy) return; S.busy = true; S.log = []; S.got = 0;
    const code = newCode(), view = LU.$('#synPanel');
    view.innerHTML = `<div class="syncbox"><div class="small muted">On the other device, open More › Sync with another device › Enter a code, and type:</div><div class="syncbig">${fmtCode(code)}</div><div id="synStatus"></div><div id="synBar"></div><div class="synclog" id="synLog"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost block" id="synCancel">Cancel</button><button class="btn ghost block" id="synMan">No internet? Use manual codes</button></div></div>`;
    let pc = null, relay = null;
    S.cancel = () => { try { relay && relay.close(); } catch (e) {} };
    LU.$('#synCancel').onclick = () => { S.busy = false; S.cancel(); try { pc && pc.close(); } catch (e) {} LU.render(true); };
    LU.$('#synMan').onclick = () => { S.busy = false; S.cancel(); try { pc && pc.close(); } catch (e) {} manual('host'); };
    try {
      pc = newPc(); const dc = pc.createDataChannel('sync', { ordered: true });
      const ch = Chan(dc); let started = false;
      dc.onopen = () => { if (started) return; started = true; S.cancel(); say('Connected.'); runHost(ch, { files: S.files }).catch(fail); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') fail(new Error('Could not connect. Check that both devices are on the same Wi-Fi, or try manual codes.')); };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await gather(pc);
      relay = await Relay(code); S.cancel = () => relay.close();
      relay.subscribe(async (m) => { if (m.t === 'answer' && pc.signalingState === 'have-local-offer') { say('Other device found. Connecting…'); try { await pc.setRemoteDescription({ type: 'answer', sdp: (await unpack(m.z)).sdp }); } catch (e) { fail(e); } } });
      await relay.publish({ t: 'offer', z: await pack({ sdp: fixSdp(pc.localDescription.sdp) }) });
      say('Waiting for the other device… (code works for a few minutes)');
      setTimeout(() => { if (S.busy && !started) fail(new Error('Nobody connected. Check the code, or try manual codes.')); }, 240000);
    } catch (e) { fail(new Error('Could not reach the code service. Check your internet, or use manual codes. (' + (e.message || e) + ')')); }
  };
  const startJoin = async (codeRaw) => {
    const code = cleanCode(codeRaw); if (code.length !== 8) { LU.toast('Type the 8 letters shown on the other device.'); return; }
    if (S.busy) return; S.busy = true; S.log = []; S.got = 0;
    const view = LU.$('#synPanel');
    view.innerHTML = `<div class="syncbox"><div class="lt">Connecting…</div><div id="synStatus"></div><div id="synBar"></div><div class="synclog" id="synLog"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost block" id="synCancel">Cancel</button><button class="btn ghost block" id="synMan">Use manual codes</button></div></div>`;
    let pc = null, relay = null; S.cancel = () => { try { relay && relay.close(); } catch (e) {} };
    LU.$('#synCancel').onclick = () => { S.busy = false; S.cancel(); try { pc && pc.close(); } catch (e) {} LU.render(true); };
    LU.$('#synMan').onclick = () => { S.busy = false; S.cancel(); try { pc && pc.close(); } catch (e) {} manual('join'); };
    try {
      relay = await Relay(code); S.cancel = () => relay.close();
      let got = false;
      relay.subscribe(async (m) => {
        if (got || m.t !== 'offer') return; got = true; say('Found the other device.');
        try {
          pc = newPc(); let started = false;
          pc.ondatachannel = (e) => { const ch = Chan(e.channel); e.channel.onopen = () => {}; const go = () => { if (started) return; started = true; S.cancel(); say('Connected.'); runJoin(ch, { files: S.files }).catch(fail); }; if (e.channel.readyState === 'open') go(); else e.channel.addEventListener('open', go); };
          pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') fail(new Error('Could not connect. Check that both devices are on the same Wi-Fi, or try manual codes.')); };
          await pc.setRemoteDescription({ type: 'offer', sdp: (await unpack(m.z)).sdp });
          const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); await gather(pc);
          await relay.publish({ t: 'answer', z: await pack({ sdp: fixSdp(pc.localDescription.sdp) }) });
          say('Connecting…');
          setTimeout(() => { if (S.busy && !started) fail(new Error('Could not connect. Check that both devices are on the same Wi-Fi, or try manual codes.')); }, 30000);
        } catch (e) { fail(e); }
      });
      say('Looking for code ' + fmtCode(code) + '…');
      setTimeout(() => { if (S.busy && !got) fail(new Error('No device is showing that code. Check the code and try again.')); }, 20000);
    } catch (e) { fail(new Error('Could not reach the code service. Check your internet, or use manual codes. (' + (e.message || e) + ')')); }
  };

  /* ---------- manual codes: copy a long code across, no internet needed ---------- */
  const pack = async (o) => { const s = JSON.stringify(o); if (window.CompressionStream) { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(enc.encode(s)); w.close(); const b = new Uint8Array(await new Response(cs.readable).arrayBuffer()); let t = ''; b.forEach((x) => (t += String.fromCharCode(x))); return 'Z' + btoa(t); } return 'P' + btoa(unescape(encodeURIComponent(s))); };
  const unpack = async (t) => { t = String(t).trim().replace(/\s+/g, ''); if (t[0] === 'Z') { const bin = atob(t.slice(1)), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(b); w.close(); return JSON.parse(await new Response(ds.readable).text()); } return JSON.parse(decodeURIComponent(escape(atob(t.slice(1))))); };
  function manual(role) {
    const view = LU.$('#synPanel'); S.busy = true; S.log = []; S.got = 0;
    const copyBtn = (id, src) => `<button class="btn ghost sm" id="${id}">${I('copy')}Copy</button>`;
    let pc = null;
    const cancel = () => { S.busy = false; try { pc && pc.close(); } catch (e) {} LU.render(true); };
    if (role === 'host') {
      view.innerHTML = `<div class="syncbox"><div class="lt">Manual codes · this device first</div><div class="small muted" style="margin:6px 0">1. Copy this code and send it to the other device (message, notes…).</div><textarea class="inp" id="mnA" rows="4" readonly>Making the code…</textarea><div style="margin:6px 0">${copyBtn('mnAc')}</div><div class="small muted">2. Paste the reply code here:</div><textarea class="inp" id="mnB" rows="4" placeholder="Reply code"></textarea><div id="synStatus"></div><div id="synBar"></div><div class="synclog" id="synLog"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost block" id="synCancel">Cancel</button><button class="btn block" id="mnGo">Connect</button></div></div>`;
      LU.$('#synCancel').onclick = cancel;
      pc = newPc(); const dc = pc.createDataChannel('sync', { ordered: true }), ch = Chan(dc); let started = false;
      dc.onopen = () => { if (started) return; started = true; runHost(ch, { files: S.files }).catch(fail); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') fail(new Error('Could not connect. Both devices must be on the same Wi-Fi.')); };
      (async () => { const o = await pc.createOffer(); await pc.setLocalDescription(o); await gather(pc); LU.$('#mnA').value = await pack({ t: 'offer', sdp: fixSdp(pc.localDescription.sdp) }); })();
      LU.$('#mnAc').onclick = async () => LU.toast((await LU.copyText(LU.$('#mnA').value)) ? 'Copied.' : 'Could not copy. Select the text and copy it.', { sys: false });
      LU.$('#mnGo').onclick = async () => { try { const m = await unpack(LU.$('#mnB').value); await pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }); say('Connecting…'); } catch (e) { LU.toast('That reply code is not right.'); } };
    } else {
      view.innerHTML = `<div class="syncbox"><div class="lt">Manual codes · this device second</div><div class="small muted" style="margin:6px 0">1. Paste the code from the other device:</div><textarea class="inp" id="mnB" rows="4" placeholder="Code from the other device"></textarea><div style="margin:6px 0"><button class="btn sm" id="mnGo">Make reply code</button></div><div class="small muted">2. Copy this reply code and paste it on the other device:</div><textarea class="inp" id="mnA" rows="4" readonly></textarea><div style="margin:6px 0">${copyBtn('mnAc')}</div><div id="synStatus"></div><div id="synBar"></div><div class="synclog" id="synLog"></div><div style="margin-top:10px"><button class="btn ghost block" id="synCancel">Cancel</button></div></div>`;
      LU.$('#synCancel').onclick = cancel;
      LU.$('#mnAc').onclick = async () => LU.toast((await LU.copyText(LU.$('#mnA').value)) ? 'Copied.' : 'Could not copy. Select the text and copy it.', { sys: false });
      LU.$('#mnGo').onclick = async () => {
        try {
          const m = await unpack(LU.$('#mnB').value); pc = newPc(); let started = false;
          pc.ondatachannel = (e) => { const ch = Chan(e.channel); const go = () => { if (started) return; started = true; runJoin(ch, { files: S.files }).catch(fail); }; if (e.channel.readyState === 'open') go(); else e.channel.addEventListener('open', go); };
          pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') fail(new Error('Could not connect. Both devices must be on the same Wi-Fi.')); };
          await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp }); const a = await pc.createAnswer(); await pc.setLocalDescription(a); await gather(pc);
          LU.$('#mnA').value = await pack({ t: 'answer', sdp: fixSdp(pc.localDescription.sdp) }); say('Now copy the reply code to the other device.');
        } catch (e) { LU.toast('That code is not right.'); }
      };
    }
  }

  /* ---------- the Sync screen ---------- */
  LU.views.sync = {
    render() {
      const ok = !!window.RTCPeerConnection;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Sync<span class="sub">Phone and iPad, same Wi-Fi</span></h1></div>
        <div class="card small" style="line-height:1.55">Put both devices on the same Wi-Fi. On one device tap <b>Show a code</b>. On the other tap <b>Enter a code</b> and type it. Progress, marks and PDFs are merged on both. A copy of your data is kept so you can undo.</div>
        ${ok ? '' : '<div class="card small" style="color:var(--red)">This browser cannot make a direct connection. Use “Sync with a file” below.</div>'}
        <div id="synPanel"><div style="display:flex;gap:8px;margin-top:12px"><button class="btn block" data-act="syHost" ${ok ? '' : 'disabled'}>${I('send')}Show a code</button><button class="btn ghost block" data-act="syJoinUi" ${ok ? '' : 'disabled'}>${I('edit')}Enter a code</button></div>
          <div class="list" style="margin-top:12px"><div class="li" data-act="syFiles"><span class="lic">${I('notes')}</span><div class="grow"><div class="lt">Also copy missing PDFs</div><div class="ls">Big PDFs take a few minutes</div></div><span class="switch ${S.files ? 'on' : ''}" id="syFilesSw"></span></div></div></div>
        <div class="sec-title">If the direct connection does not work</div>
        <div class="list"><div class="li" data-act="syManual"><span class="lic">${I('copy')}</span><div class="grow"><div class="lt">Manual codes</div><div class="ls">Copy a long code across. Works with no internet.</div></div><span class="chev">${I('chev')}</span></div>
          <div class="li" data-act="syFileOut"><span class="lic">${I('save')}</span><div class="grow"><div class="lt">Sync with a file: save</div><div class="ls">Makes a .levelup file you move to the other device</div></div></div>
          <div class="li" data-act="syFileIn"><span class="lic">${I('upload')}</span><div class="grow"><div class="lt">Sync with a file: merge</div><div class="ls">Adds a .levelup file from the other device to this one</div></div></div></div>
        <div class="sec-title">Safety</div>
        <div class="list"><div class="li" data-act="syUndo"><span class="lic">${I('undo')}</span><div class="grow"><div class="lt">Undo last sync</div><div class="ls">Goes back to how this device was before it</div></div></div></div>
        <input type="file" id="syFile" hidden>
        <p class="tiny dim" style="margin:14px 2px">Only a short connection note goes through the code service. Your data travels directly between your two devices. If you change the same thing on both, the newer change wins; deleted items other than PDFs can come back.</p><div style="height:20px"></div>`;
    },
  };
  LU.actions.openSync = () => { LU.push('sync'); };
  LU.actions.syFiles = () => { S.files = !S.files; const e = LU.$('#syFilesSw'); if (e) e.classList.toggle('on', S.files); };
  LU.actions.syHost = () => startHost();
  LU.actions.syManual = () => LU.sheet({ title: 'Manual codes', body: '<div class="list"><div class="li" data-act="syManH"><div class="grow"><div class="lt">This device makes the first code</div></div></div><div class="li" data-act="syManJ"><div class="grow"><div class="lt">The other device made it, I paste it here</div></div></div></div>' });
  LU.actions.syManH = () => { LU.closeSheet(true); manual('host'); };
  LU.actions.syManJ = () => { LU.closeSheet(true); manual('join'); };
  LU.actions.syJoinUi = () => {
    LU.$('#synPanel').innerHTML = `<div class="syncbox"><div class="small muted">Type the code shown on the other device:</div><input class="inp" id="syCode" maxlength="9" autocomplete="off" autocapitalize="characters" placeholder="ABCD-EFGH" style="text-align:center;font:800 28px var(--fd);letter-spacing:.12em;margin-top:10px"><div style="display:flex;gap:8px;margin-top:12px"><button class="btn ghost block" data-act="back">Cancel</button><button class="btn block" id="syGo">Connect</button></div></div>`;
    const inp = LU.$('#syCode'); setTimeout(() => LU.focusField && LU.focusField(inp), 200);
    LU.$('#syGo').onclick = () => startJoin(inp.value);
    inp.onkeydown = (e) => { if (e.key === 'Enter') startJoin(inp.value); };
  };
  LU.actions.syFileOut = async () => { LU.toast('Making the sync file…', { sys: false, ms: 1500 }); try { const b = await LU.packBackup({ files: S.files }); const w = await LU.saveBlob(`LevelUp-sync-${LU.todayKey()}.levelup`, b); if (w !== 'cancelled') LU.toast('Saved to ' + w + '. Open Sync on the other device and choose “merge”.', { ms: 5000 }); } catch (e) { LU.toast('Could not make the file: ' + (e.message || e), { ms: 4500 }); } };
  LU.actions.syFileIn = () => { const f = LU.$('#syFile'); f.onchange = async () => { const file = f.files[0]; f.value = ''; if (!file) return; try { if (!(await LU.isPack(file))) throw new Error('Choose a .levelup file made by “Sync with a file: save”.'); LU.toast('Merging…', { sys: false, ms: 2000 }); const r = await LU.mergePack(file); LU.toast(`Merged. ${r.docs} PDFs, ${r.files} copied. Reloading…`); setTimeout(() => location.reload(), 1500); } catch (e) { LU.toast(e.message || 'Could not merge that file.', { ms: 5000 }); } }; f.click(); };
  LU.actions.syUndo = () => LU.confirm('Undo the last sync?', 'This device goes back to how it was before the last sync. PDFs that were copied stay.', 'Undo', async () => { try { await LU.undoSync(); LU.toast('Undone. Reloading…'); setTimeout(() => location.reload(), 900); } catch (e) { LU.toast(e.message); } });
})();
