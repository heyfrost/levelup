/* Part 26: weekly Excel report (quest by date grid) and the "finished PDF" topic review sheet */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;

  /* ======================================================
     1. Tiny .xlsx writer (zip with no compression, inline strings, no library)
     ====================================================== */
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const zip = (files) => {
    const parts = [], cen = []; let off = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach((f) => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
      parts.push(lh, name, data);
      cen.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), name);
      off += lh.length + name.length + data.length;
    });
    let cl = 0; cen.forEach((c) => (cl += c.length));
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), 0, 0]);
    const all = parts.concat(cen, [end]); let tot = 0; all.forEach((p) => (tot += p.length));
    const out = new Uint8Array(tot); let o = 0; all.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  };
  const col = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const x = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  /* cell: {v, s, f}  v string or number */
  const sheetXml = (rows, o) => {
    o = o || {};
    let maxC = 0; rows.forEach((r) => { maxC = Math.max(maxC, r.length); });
    const data = rows.map((r, ri) => {
      const cells = r.map((c, ci) => {
        if (c == null) return '';
        if (typeof c !== 'object') c = { v: c };
        const ref = col(ci) + (ri + 1), st = c.s ? ` s="${c.s}"` : '';
        if (c.f) return `<c r="${ref}"${st}><f>${x(c.f)}</f>${c.v != null ? `<v>${x(c.v)}</v>` : ''}</c>`;
        if (typeof c.v === 'number') return `<c r="${ref}"${st}><v>${c.v}</v></c>`;
        if (c.v === '' || c.v == null) return c.s ? `<c r="${ref}"${st}/>` : '';
        return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${x(c.v)}</t></is></c>`;
      }).join('');
      return `<row r="${ri + 1}"${o.rowH && o.rowH[ri] ? ` ht="${o.rowH[ri]}" customHeight="1"` : ''}>${cells}</row>`;
    }).join('');
    const cols = (o.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const pane = o.freeze ? `<pane xSplit="${o.freeze[0]}" ySplit="${o.freeze[1]}" topLeftCell="${col(o.freeze[0]) + (o.freeze[1] + 1)}" activePane="bottomRight" state="frozen"/>` : '';
    const cf = o.cf ? `<conditionalFormatting sqref="${o.cf}"><cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"✓"</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="2" operator="equal"><formula>"✗"</formula></cfRule></conditionalFormatting>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(Math.max(0, maxC - 1))}${rows.length}"/><sheetViews><sheetView workbookViewId="0"${o.first ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${data}</sheetData>${cf}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>`;
  };
  /* style ids */
  const S = { title: 1, head: 2, name: 3, tick: 4, cross: 5, blank: 6, num: 7, lab: 8, tot: 9, skip: 10, txt: 11, red: 12 };
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2A44"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="2"><dxf><font><b/><color rgb="FF006100"/></font><fill><patternFill><bgColor rgb="FFC6EFCE"/></patternFill></fill></dxf><dxf><font><b/><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs></styleSheet>`;
  const xlsx = (sheets) => {
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${x(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const wbr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    return zip([{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels }, { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: wbr }, { name: 'xl/styles.xml', data: STYLES }].concat(sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml }))));
  };

  /* ======================================================
     2. The weekly data
     ====================================================== */
  const penOf = (k) => (LU.state.penLog || []).filter((p) => p.k === k);
  LU.weekGrid = (w) => {
    const today = LU.todayKey(), keys = []; for (let i = 0; i < 7; i++) keys.push(LU.addDays(w, i));
    const rows = {}, seq = [];
    const day = keys.map((k, i) => {
      const d = LU.peekDay(k) || { done: {}, miss: {} }, out = { k, earned: 0, bonus: 0, lostX: 0, lostP: 0, cross: [], pen: penOf(k), cleared: !!d.cleared, studyMin: d.studyMin || 0, nDone: 0, nMiss: 0 };
      if (k > today) return out;
      Object.keys(d.done || {}).forEach((id) => { out.earned += (d.done[id] && d.done[id].xp) || 0; });
      out.bonus = (d.cleared ? 100 : 0) + (d.topics || 0) * 5;
      Object.keys(d.miss || {}).forEach((id) => { if (!(d.done || {})[id]) { const m = d.miss[id]; out.lostX += m.lost || 0; out.cross.push(m); } });
      out.lostP = out.pen.reduce((a, p) => a + (p.xp || 0), 0);
      LU.questsFor(k).filter((q) => !q.info).forEach((q) => {
        const key = (q.src === 'task' ? 'task|' : '') + q.title;
        let r = rows[key];
        if (!r) { r = rows[key] = { title: q.title, xp: q.xp || 0, order: q.src === 'block' ? LU.toMin(q.start) : q.src === 'check' ? 2000 + seq.length : 3000 + seq.length, cells: ['', '', '', '', '', '', ''] }; seq.push(key); }
        r.cells[i] = q.done ? '✓' : q.missed ? '✗' : q.skipped ? '–' : '';
        if (q.done) out.nDone++; if (q.missed) out.nMiss++;
      });
      return out;
    });
    const list = Object.keys(rows).map((k) => rows[k]).sort((a, b) => a.order - b.order);
    return { w, keys, day, list };
  };
  const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lab = (k) => { const d = LU.parseKey(k); return DN[(d.getDay() + 6) % 7] + ' ' + String(d.getDate()).padStart(2, '0') + ' ' + MN[d.getMonth()]; };

  LU.weekXlsx = (w) => {
    const G = LU.weekGrid(w), n = G.list.length, first = 4, last = first + n - 1;
    const R = [];
    R.push([{ v: 'LevelUp weekly report: ' + LU.niceDate(w, false) + ' to ' + LU.niceDate(LU.addDays(w, 6), false), s: S.title }]);
    R.push([{ v: '✓ done · ✗ missed · – skipped · blank = not planned or not yet. Edit a cell and the totals follow.', s: S.txt }]);
    R.push([{ v: 'Quest', s: S.head }].concat(G.keys.map((k) => ({ v: lab(k), s: S.head })), [{ v: 'XP each', s: S.head }, { v: 'Done', s: S.head }, { v: 'Missed', s: S.head }]));
    G.list.forEach((r, i) => {
      const rn = first + i;
      R.push([{ v: r.title, s: S.name }].concat(r.cells.map((c) => ({ v: c, s: c === '✓' ? S.tick : c === '✗' ? S.cross : c === '–' ? S.skip : S.blank })), [{ v: r.xp, s: S.num }, { v: r.cells.filter((c) => c === '✓').length, f: `COUNTIF(B${rn}:H${rn},"✓")`, s: S.num }, { v: r.cells.filter((c) => c === '✗').length, f: `COUNTIF(B${rn}:H${rn},"✗")`, s: S.num }]));
    });
    const rowE = last + 2, rowB = rowE + 1, rowX = rowE + 2, rowP = rowE + 3, rowN = rowE + 4;
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const line = (label, vals, style, rn, sign) => [{ v: label, s: S.lab }].concat(vals.map((v) => ({ v: v, s: style })), [{ v: sum(vals), f: `SUM(B${rn}:H${rn})`, s: S.tot }]);
    R.push([]);
    R.push(line('XP earned (quests)', G.day.map((d) => d.earned), S.tot, rowE));
    R.push(line('Bonus XP (day cleared, topics)', G.day.map((d) => d.bonus), S.tot, rowB));
    R.push(line('XP lost: crosses', G.day.map((d) => -d.lostX), S.red, rowX));
    R.push(line('XP lost: penalties', G.day.map((d) => -d.lostP), S.red, rowP));
    const net = G.day.map((d) => d.earned + d.bonus - d.lostX - d.lostP);
    R.push([{ v: 'Net XP', s: S.lab }].concat(net.map((v, i) => ({ v, f: `${col(i + 1)}${rowE}+${col(i + 1)}${rowB}+${col(i + 1)}${rowX}+${col(i + 1)}${rowP}`, s: S.tot })), [{ v: sum(net), f: `SUM(B${rowN}:H${rowN})`, s: S.tot }]));
    const grid = sheetXml(R, { widths: [38, 11, 11, 11, 11, 11, 11, 11, 9, 8, 8], freeze: [1, 3], cf: n ? `B${first}:H${last}` : null, first: true, rowH: { 2: 30 } });

    /* summary */
    const done = sum(G.day.map((d) => d.nDone)), miss = sum(G.day.map((d) => d.nMiss)), cleared = G.day.filter((d) => d.cleared).length, study = sum(G.day.map((d) => d.studyMin));
    const kv = (a, b, s) => [{ v: a, s: S.lab }, { v: b, s: s || S.num }];
    const SM = [[{ v: 'Summary', s: S.title }], [{ v: 'Week', s: S.lab }, { v: LU.niceDate(w, false) + ' to ' + LU.niceDate(LU.addDays(w, 6), false), s: S.name }], kv('XP earned (quests)', sum(G.day.map((d) => d.earned))), kv('Bonus XP', sum(G.day.map((d) => d.bonus))), kv('XP lost: crosses', -sum(G.day.map((d) => d.lostX)), S.red), kv('XP lost: penalties', -sum(G.day.map((d) => d.lostP)), S.red), kv('Net XP', sum(net), S.tot), kv('Hours studied', Math.round((study / 60) * 10) / 10), kv('Days cleared', cleared + ' of ' + G.day.filter((d) => d.k <= LU.todayKey()).length), kv('Quests done', done), kv('Quests missed', miss), kv('Done %', done + miss ? Math.round((done / (done + miss)) * 100) + '%' : '')];
    const summary = sheetXml(SM, { widths: [30, 38] });

    /* crosses and penalties */
    const P = [[{ v: 'Crossed quests and penalties', s: S.title }], [], [{ v: 'Date', s: S.head }, { v: 'Quest', s: S.head }, { v: 'XP lost', s: S.head }, { v: 'Marked by', s: S.head }]];
    let any = false;
    G.day.forEach((d) => d.cross.forEach((m) => { any = true; P.push([{ v: lab(d.k), s: S.name }, { v: m.t, s: S.name }, { v: -(m.lost || 0), s: S.num }, { v: m.auto ? 'App (auto)' : 'You', s: S.name }]); }));
    if (!any) P.push([{ v: 'Nothing crossed this week', s: S.txt }]);
    P.push([]); P.push([{ v: 'Date', s: S.head }, { v: 'Penalty', s: S.head }, { v: 'XP lost', s: S.head }]);
    let anyP = false;
    G.day.forEach((d) => d.pen.forEach((p) => { anyP = true; P.push([{ v: lab(d.k), s: S.name }, { v: p.text, s: S.name }, { v: -(p.xp || 0), s: S.num }]); }));
    if (!anyP) P.push([{ v: 'No penalties this week', s: S.txt }]);
    const pen = sheetXml(P, { widths: [14, 52, 10, 14] });
    return xlsx([{ name: 'Week grid', xml: grid }, { name: 'Summary', xml: summary }, { name: 'Penalties', xml: pen }]);
  };
  LU.exportWeekXlsx = async (w) => {
    try {
      const bytes = LU.weekXlsx(w), name = 'LevelUp-week-' + w + '.xlsx';
      const r = await LU.saveBinary(name, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      LU.toast(/^Error/.test(String(r)) ? String(r) : 'Excel saved: ' + (r || name), { ms: 4000 });
    } catch (e) { console.error(e); LU.toast('Could not make the Excel file: ' + (e.message || e)); }
  };

  /* ======================================================
     3. Finishing a PDF: review which syllabus topics to tick
     ====================================================== */
  const base = LU.markFinished;
  LU.markFinished = (id, on) => {
    const d0 = LU.doc(id), was = !!(d0 && d0.fin);
    base(id, on);
    const d = LU.doc(id); if (!d) return;
    if (d.fin && !was) setTimeout(() => LU.finTopicsSheet(id), 350);
    else if (!d.fin && was && d.finTopics && d.finTopics.length) {
      const ids = d.finTopics.filter((i) => LU.isDone(i));
      if (ids.length) setTimeout(() => LU.confirm('Untick the topics?', `This PDF ticked ${ids.length} topic${ids.length > 1 ? 's' : ''} in the syllabus tracker. Untick them again?`, 'Untick', () => { ids.forEach((i) => delete LU.state.syl.done[i]); delete d.finTopics; LU.save(); LU.render(true); LU.toast('Unticked ' + ids.length + ' topics.'); }), 350);
    }
  };
  LU.finTopicsSheet = (id) => {
    const d = LU.doc(id); if (!d) return;
    let subj = d.subj && d.subj !== 'qp' && LU.subject(d.subj) ? d.subj : null, query = '';
    const sel = new Set();
    const leavesOf = (nid) => { const n = LU.node(nid); return n ? LU.leaves(n) : []; };
    const preset = () => { sel.clear(); if (subj && d.node && LU.subjOf(d.node) && LU.subjOf(d.node).id === subj) leavesOf(d.node).forEach((l) => { if (!LU.isDone(l.i)) sel.add(l.i); }); };
    preset();
    const subjects = () => LU.syllabus.filter((s) => s.id !== 'qp');
    const nodeState = (n) => { const ls = LU.leaves(n), open = ls.filter((l) => !LU.isDone(l.i)); if (!open.length) return 'done'; const c = open.filter((l) => sel.has(l.i)).length; return c === open.length ? 'all' : c ? 'some' : 'none'; };
    const row = (n, extra) => {
      const st = nodeState(n), ls = LU.leaves(n), open = ls.filter((l) => !LU.isDone(l.i)).length;
      const box = `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;border:2px solid ${st === 'none' ? 'var(--line,#889)' : 'var(--gold,#e6b422)'};background:${st === 'all' || st === 'done' ? 'var(--gold,#e6b422)' : 'transparent'};color:#000;font-weight:700;flex:none">${st === 'all' || st === 'done' ? '✓' : st === 'some' ? '–' : ''}</span>`;
      return `<div class="li" data-t="${n.i}" style="min-height:48px;padding:10px 14px;${st === 'done' ? 'opacity:.55' : ''}">${box}<div class="grow" style="margin-left:10px"><div class="lt" style="font-weight:500">${esc(n.t)}</div><div class="ls">${esc(extra || '')}${ls.length > 1 ? (extra ? ' · ' : '') + ls.length + ' topics' : ''}${st === 'done' ? (extra || ls.length > 1 ? ' · ' : '') + 'already done' : ''}${st !== 'done' && open !== ls.length ? ' · ' + (ls.length - open) + ' already done' : ''}</div></div></div>`;
    };
    const body = () => {
      const s = subj && LU.subject(subj);
      const chips = `<div class="chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${subjects().map((x) => `<button class="chip ${x.id === subj ? 'on' : ''}" data-s="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
      if (!s) return `<p class="small muted" style="margin:0 0 8px">Which subject is “${esc(d.name)}” about? Pick one, then choose the topics it covered.</p>${chips}`;
      const q = query.trim().toLowerCase(); let rows = [];
      if (q) {
        const walk = (n) => { if (rows.length >= 40) return; if (n.t.toLowerCase().includes(q)) rows.push(n); (n.c || []).forEach(walk); };
        (s.c || []).forEach(walk);
        rows = rows.map((n) => row(n, LU.pathOf(n.i).slice(1, -1).map((p) => p.t).slice(-2).join(' › ')));
      } else {
        const picked = []; sel.forEach((i) => { const n = LU.node(i); if (n) picked.push(n); });
        if (picked.length) rows = picked.slice(0, 120).map((n) => row(n, LU.pathOf(n.i).slice(1, -1).map((p) => p.t).slice(-2).join(' › ')));
        else { (s.c || []).forEach((sec) => (sec.c || []).forEach((c) => { if (rows.length < 40) rows.push(row(c, sec.t)); })); }
      }
      const total = [...sel].length;
      return `<p class="small muted" style="margin:0 0 8px">${total ? 'These topics will be ticked. Untick any that are extra, or search to add more.' : 'Search for the topics this PDF covered, or tap a chapter to tick all of it.'}</p>
        <div class="chips" style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;margin-bottom:8px;padding-bottom:4px">${subjects().map((x) => `<button class="chip ${x.id === subj ? 'on' : ''}" data-s="${x.id}">${esc(x.name)}</button>`).join('')}</div>
        <div style="display:flex;gap:8px;margin:0 0 10px"><button class="btn ghost grow" id="ftSkip">Skip</button><button class="btn gold grow" id="ftOk">Apply (${total})</button></div>
        <div class="search" style="margin:0 0 8px">${I('search')}<input id="ftq" placeholder="Search topics in ${esc(s.name)}" value="${esc(query)}"></div>
        <div class="list" style="margin-top:0">${rows.join('') || '<div class="li"><div class="grow small muted">Nothing found.</div></div>'}</div>`;
    };
    let sh;
    const paint = () => {
      const box = LU.$('#ftBody', sh); if (!box) return;
      const keep = LU.$('#ftq', sh), had = keep && document.activeElement === keep, pos = keep ? keep.selectionStart : 0;
      box.innerHTML = body(); wire();
      if (had) { const n = LU.$('#ftq', sh); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
    };
    const wire = () => {
      sh.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { subj = b.dataset.s; if (d.subj !== subj) { d.node = null; } query = ''; if (d.node && LU.subjOf(d.node) && LU.subjOf(d.node).id === subj) preset(); else sel.clear(); paint(); }));
      sh.querySelectorAll('[data-t]').forEach((r) => (r.onclick = () => { const n = LU.node(r.dataset.t); if (!n) return; const ls = LU.leaves(n).filter((l) => !LU.isDone(l.i)), all = ls.length && ls.every((l) => sel.has(l.i)); ls.forEach((l) => (all ? sel.delete(l.i) : sel.add(l.i))); paint(); }));
      const q = LU.$('#ftq', sh); if (q) q.oninput = () => { query = q.value; paint(); };
      const sk = LU.$('#ftSkip', sh); if (sk) sk.onclick = () => LU.closeSheet();
      const ok = LU.$('#ftOk', sh); if (ok) ok.onclick = () => {
        const ids = [...sel].filter((i) => !LU.isDone(i));
        if (!ids.length) { LU.closeSheet(); LU.toast('No topics ticked.'); return; }
        const t = Date.now(); ids.forEach((i) => (LU.state.syl.done[i] = t));
        d.finTopics = (d.finTopics || []).concat(ids).filter((v, i, a) => a.indexOf(v) === i);
        if (subj && !d.subj) d.subj = subj;
        LU.save(); LU.closeSheet(); LU.render(true);
        LU.toast(`Ticked ${ids.length} topic${ids.length > 1 ? 's' : ''} in the syllabus.`, { ms: 5000, undo: () => { ids.forEach((i) => delete LU.state.syl.done[i]); d.finTopics = (d.finTopics || []).filter((i) => ids.indexOf(i) < 0); LU.save(); LU.render(true); } });
      };
    };
    sh = LU.sheet({ title: 'Mark these topics done?', body: '<div id="ftBody"></div>' });
    paint();
  };
  /* ======================================================
     4. Widget: which subjects the points and MCQ counts come from
     ====================================================== */
  const wsText = () => { const p = (LU.state.settings.wSubs || []).filter(Boolean), all = LU.widgetSubjects ? LU.widgetSubjects() : []; if (!p.length) return 'All subjects'; const names = all.filter((x) => p.indexOf(x.id) >= 0).map((x) => x.name); return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '') : 'All subjects'; };
  LU.wsText = wsText;
  LU.actions.widgetSubs = () => {
    const all = LU.widgetSubjects ? LU.widgetSubjects() : [];
    if (!all.length) { LU.toast('Collect some important points or MCQs from a PDF first.'); return; }
    const st = LU.state.settings; let pick = new Set((st.wSubs || []).filter((id) => all.some((x) => x.id === id)));
    const body = () => `<p class="small muted" style="margin:0 0 8px">The widget shows one important point at a time from these subjects. Tap the subject name on the widget to switch, and tap the point to see the next one. Nothing ticked means all subjects.</p>
      <div class="list">${all.map((x) => `<div class="li" data-w="${x.id}" style="min-height:48px;padding:10px 14px"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;border:2px solid var(--gold,#e6b422);background:${pick.has(x.id) ? 'var(--gold,#e6b422)' : 'transparent'};color:#000;font-weight:700;flex:none">${pick.has(x.id) ? '✓' : ''}</span><div class="grow lt" style="margin-left:10px;font-weight:500">${esc(x.name)}</div></div>`).join('')}</div>
      <button class="btn gold block" id="wsOk" style="margin-top:12px">Save</button>`;
    const sh = LU.sheet({ title: 'Widget subjects', body: '<div id="wsBody"></div>' });
    const paint = () => { LU.$('#wsBody', sh).innerHTML = body(); sh.querySelectorAll('[data-w]').forEach((r) => (r.onclick = () => { const id = r.dataset.w; if (pick.has(id)) pick.delete(id); else pick.add(id); paint(); })); LU.$('#wsOk', sh).onclick = () => { st.wSubs = pick.size === all.length ? [] : [...pick]; LU.save(); LU.closeSheet(); LU.render(true); LU.toast('Widget subjects: ' + wsText()); }; };
    paint();
  };
  /* ======================================================
     5. More > Marker colours: say what each colour is for
     ====================================================== */
  const hlSummary = () => ['yellow', 'pink', 'blue', 'green'].map((k) => LU.hlName(k)).join(' · ');
  LU.hlSummary = hlSummary;
  LU.actions.hlNames = () => {
    const st = LU.state.settings, KEYS = ['yellow', 'pink', 'blue', 'green'];
    const sh = LU.sheet({
      title: 'Marker colours',
      body: `<p class="small muted" style="margin:0 0 10px">Write what each marker colour is for. You will see it above the colours when you pick the marker.</p>
        ${KEYS.map((k) => `<div class="field" style="display:flex;align-items:center;gap:10px"><span style="width:26px;height:26px;border-radius:50%;background:${LU.HL[k]};flex:none;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span><input class="inp" data-hn="${k}" maxlength="40" placeholder="${esc(LU.HL_DEF[k])}" value="${esc(LU.hlName(k))}" style="flex:1"></div>`).join('')}`,
      foot: `<button class="btn ghost" id="hnReset">Reset</button><button class="btn gold" id="hnSave">Save</button>`,
      mount: (s) => {
        LU.$('#hnReset', s).onclick = () => { delete st.hlNames; LU.save(); LU.closeSheet(); LU.render(true); LU.toast('Marker colours reset.'); };
        LU.$('#hnSave', s).onclick = () => {
          const o = {}; s.querySelectorAll('[data-hn]').forEach((i) => { const v = i.value.trim(); if (v && v !== LU.HL_DEF[i.dataset.hn]) o[i.dataset.hn] = v; });
          if (Object.keys(o).length) st.hlNames = o; else delete st.hlNames;
          LU.save(); LU.closeSheet(); LU.render(true); LU.toast('Saved.');
        };
      },
    });
  };
})();
