/* Your own subjects: add one (Study tab, or while filing a PDF), rename it, move it to another group, delete it. */
(function () {
  const LU = window.LU, I = LU.icon, esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PAPERS = [['Other', 'My subjects'], ['GS1', 'GS Paper I'], ['GS2', 'GS Paper II'], ['GS3', 'GS Paper III'], ['GS4', 'GS Paper IV'], ['Optional', 'Optional'], ['Prelims II', 'Prelims Paper II'], ['Mains', 'Mains essay']];
  const COLORS = ['#5BC0EB', '#9BC53D', '#FA7921', '#E55934', '#C879FF', '#FDE74C', '#4ECDC4', '#FF6B9D', '#8DA9C4', '#F4A259'];
  const own = () => { if (LU.syllabus === window.SYLLABUS) LU.syllabus = LU.clone(window.SYLLABUS); };
  const commit = () => { LU.saveSyllabus(); try { LU.indexSyllabus(); } catch (e) {} LU.save(true); };

  LU.addSubject = (name, paper) => {
    own();
    const s = { id: 'u' + LU.uid(), name: String(name).trim().slice(0, 60), paper: paper || 'Other', color: COLORS[LU.syllabus.length % COLORS.length], c: [], custom: 1 };
    LU.syllabus.push(s); commit(); return s;
  };

  const form = (title, cur, onSave) => {
    let paper = cur ? cur.paper : 'Other';
    const sh = LU.sheet({
      title, body: `<div class="field"><label>Subject name</label><input class="inp" id="sjN" maxlength="60" value="${esc(cur ? cur.name : '')}" placeholder="e.g. Ethics case studies"></div>
        <div class="field"><label>Group</label><div class="seg" id="sjP">${PAPERS.map((p) => `<button type="button" data-p="${p[0]}" class="${p[0] === paper ? 'on' : ''}">${p[1]}</button>`).join('')}</div></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="sjOk">Save</button>`,
    });
    LU.$$('#sjP button', sh).forEach((b) => (b.onclick = () => { paper = b.dataset.p; LU.$$('#sjP button', sh).forEach((x) => x.classList.toggle('on', x === b)); }));
    setTimeout(() => LU.$('#sjN', sh) && LU.$('#sjN', sh).focus(), 250);
    const ok = () => { const v = LU.$('#sjN', sh).value.trim(); if (!v) return LU.$('#sjN', sh).focus(); LU.closeSheet(); onSave(v, paper); };
    LU.$('#sjOk', sh).onclick = ok; LU.$('#sjN', sh).onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  };

  LU.actions.subjNew = () => form('New subject', null, (v, p) => { const s = LU.addSubject(v, p); LU.render(); LU.toast(s.name + ' added. Open it to add sections and topics.', { sys: false, ms: 3000 }); });
  LU.actions.subjEdit = (el) => {
    const s = LU.subject(el.dataset.id); if (!s) return;
    form('Edit subject', s, (v, p) => { own(); const t = LU.subject(s.id); t.name = v; t.paper = p; commit(); LU.render(); LU.toast('Saved', { sys: false }); });
  };
  LU.actions.subjDel = (el) => {
    const id = el.dataset.id, s = LU.subject(id); if (!s) return;
    const n = LU.docs().filter((d) => d.subj === id).length;
    LU.confirm('Delete this subject?', `“${s.name}” and its sections and topics will be removed.${n ? ' Its ' + n + ' PDF' + (n === 1 ? '' : 's') + ' will move to Unsorted and stay in LevelUp.' : ''}`, 'Delete', () => {
      own(); LU.indexSyllabus();
      const gone = LU.subject(id); if (!gone) return;
      try { LU.leaves(gone).forEach((x) => { delete LU.state.syl.done[x.i]; }); } catch (e) {}
      LU.syllabus = LU.syllabus.filter((x) => x.id !== id);
      LU.docs().forEach((d) => { if (d.subj === id) { d.subj = null; d.node = null; } });
      const f = LU.state.syl.focus || {}; ['gs', 'opt'].forEach((k) => { if (f[k] === id) f[k] = null; });
      commit(); LU.toast('Subject deleted', { sys: false });
      try { LU.pop(); } catch (e) { LU.render(); }
    }, true);
  };

  /* Study tab: the button under the subject list */
  const sBase = LU.views.study.render;
  LU.views.study.render = function () {
    const h = sBase.apply(this, arguments), tag = '<div style="height:16px"></div>', i = h.lastIndexOf(tag);
    if (i < 0 || /Search results/.test(h)) return h;
    return h.slice(0, i) + `<button class="btn ghost sm" style="margin-top:14px" data-act="subjNew">${I('plus')}Add subject</button>` + h.slice(i);
  };
  /* subject screen: edit and delete for the ones you added */
  const vBase = LU.views.subject.render;
  LU.views.subject.render = function (a) {
    const h = vBase.apply(this, arguments), s = LU.subject(a && a.id);
    if (!s || !s.custom) return h;
    const tag = '<div style="height:20px"></div>', i = h.lastIndexOf(tag); if (i < 0) return h;
    return h.slice(0, i) + `<div class="row" style="gap:8px;margin-top:16px"><button class="btn ghost sm" data-act="subjEdit" data-id="${s.id}">${I('edit')}Rename or move</button><button class="btn ghost sm" style="color:var(--red)" data-act="subjDel" data-id="${s.id}">${I('trash')}Delete subject</button></div>` + h.slice(i);
  };
})();
