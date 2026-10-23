/* Deleting a PDF also deletes everything that came from it: its important points, its questions and the map pins linked to it.
   The deleted PDF's id stays in state.tomb, so a synced copy cannot bring any of it back (see the merge in part17.js). */
(function () {
  const LU = window.LU;
  const items = (k) => { const o = LU.state[k]; return o && Array.isArray(o.items) ? o.items : []; };
  const pins = () => (Array.isArray(LU.state.mapPins) ? LU.state.mapPins : []);
  LU.docLinked = (id) => ({ pts: items('imp').filter((x) => x.doc === id).length, qs: items('mcqbank').filter((x) => x.doc === id).length, pins: pins().filter((p) => p.doc === id).length });
  LU.docLinkedText = (ids) => {
    const t = { pts: 0, qs: 0, pins: 0 }; ids.forEach((id) => { const c = LU.docLinked(id); t.pts += c.pts; t.qs += c.qs; t.pins += c.pins; });
    const a = []; if (t.pts) a.push(t.pts + ' important point' + (t.pts === 1 ? '' : 's')); if (t.qs) a.push(t.qs + ' question' + (t.qs === 1 ? '' : 's')); if (t.pins) a.push(t.pins + ' map pin' + (t.pins === 1 ? '' : 's'));
    return a.length ? ' Its ' + a.join(', ') + ' will be deleted too.' : '';
  };
  const purge = (gone) => {
    const S = LU.state, has = (id) => id && gone(id);
    ['imp', 'mcqbank'].forEach((k) => { if (S[k] && Array.isArray(S[k].items)) S[k].items = S[k].items.filter((x) => !has(x.doc)); });
    if (Array.isArray(S.mapPins)) S.mapPins = S.mapPins.filter((p) => !has(p.doc));
  };
  const base = LU.deleteDoc;
  LU.deleteDoc = async (id) => { purge((x) => x === id); return base(id); };

  /* once: clear what earlier deletes left behind (items of PDFs that no longer exist) */
  const sweep = () => {
    try {
      const S = LU.state; if (!S || (S.settings || {}).orphanSwept2) return;
      const ids = new Set(LU.docs().map((d) => d.id)), tomb = S.tomb || {};
      const before = items('imp').length + items('mcqbank').length + pins().length;
      purge((x) => !ids.has(x) || tomb[x]);
      const n = before - (items('imp').length + items('mcqbank').length + pins().length);
      S.settings = S.settings || {}; S.settings.orphanSwept2 = 1; LU.save(true);
      if (n > 0) LU.toast(n + ' leftover item' + (n === 1 ? '' : 's') + ' from deleted PDFs cleared.', { sys: false, ms: 3500 });
    } catch (e) {}
  };
  const go = () => setTimeout(sweep, 4000);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
