/* Which PDFs the AI has read. d.aiR = pages the AI has read, as ranges [[from, to], ...]; d.aiMcq = when the MCQs were re-read by AI. */
(function () {
  const LU = window.LU;

  const mark = (d, a, b) => {
    const R = (Array.isArray(d.aiR) ? d.aiR : []).concat([[a, b]]).filter((r) => r && r[0] >= 1 && r[1] >= r[0]).sort((x, y) => x[0] - y[0]), out = [];
    R.forEach((r) => { const l = out[out.length - 1]; if (l && r[0] <= l[1] + 1) l[1] = Math.max(l[1], r[1]); else out.push([r[0], r[1]]); });
    d.aiR = out; d.aiAt = Date.now();
  };
  /* called at the end of every AI collect run (see runCollect in part18.js) */
  LU.aiNote = (d, from, to, ai, err, stopped, whole) => {
    try {
      if (ai === true) { const hi = ((!err && !stopped) || whole) ? to : (d.cnext ? d.cnext - 1 : 0); if (hi >= from) mark(d, from, hi); }
      else if (ai === 'mcq' && !err && !stopped) d.aiMcq = Date.now();
      LU.save();
    } catch (e) {}
  };

  /* { k: 'full' | 'part' | 'mcq' | 'none', text } */
  LU.aiStatus = (d) => {
    const R = Array.isArray(d.aiR) ? d.aiR : [], pages = d.pages || 0;
    const got = R.reduce((n, r) => n + (r[1] - r[0] + 1), 0);
    if (got > 0) {
      if (pages && got >= pages) return { k: 'full', text: 'Analyzed by AI' };
      return { k: 'part', text: R.length === 1 ? `AI read pages ${R[0][0]}–${R[0][1]} of ${pages}` : `AI read ${got} of ${pages} pages` };
    }
    /* before this was recorded: a PDF the AI stopped part-way still remembers where to resume */
    if (d.cnext && d.cnext > 1) return { k: 'part', text: `AI read pages 1–${d.cnext - 1} of ${pages}` };
    const imp = (LU.state.imp && LU.state.imp.items) || [];
    if (imp.some((x) => x.doc === d.id && x.ai)) return { k: 'full', text: 'Analyzed by AI' };
    if (d.aiMcq) return { k: 'mcq', text: 'MCQs read by AI' };
    return { k: 'none', text: 'Not analyzed by AI' };
  };
  LU.aiStatusHtml = (d) => {
    const s = LU.aiStatus(d), c = s.k === 'full' ? 'var(--cyan)' : s.k === 'part' ? 'var(--gold)' : s.k === 'mcq' ? 'var(--cyan)' : 'var(--dim)';
    return `<div class="tiny aist" style="color:${c};font-weight:${s.k === 'none' ? 500 : 700}">${s.k === 'full' ? '✓ ' : ''}${LU.esc(s.text)}</div>`;
  };
})();
