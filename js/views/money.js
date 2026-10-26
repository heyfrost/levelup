/* Part 9: Money. Daily spending in two lists: Daily necessities and Extra. Stored in state.money, so it is in the JSON backup. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const CATS = { n: 'Daily necessities', x: 'Extra' };
  const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const rs = (n) => '₹' + LU.fmt(Math.round((+n || 0) * 100) / 100);
  const M = () => { const s = LU.state; if (!s.money || !Array.isArray(s.money.entries)) s.money = { entries: [] }; return s.money; };
  LU.moneyOn = (k) => M().entries.filter((e) => e.d === k);
  const sum = (list, c) => list.filter((e) => !c || e.c === c).reduce((t, e) => t + e.a, 0);
  const budget = () => +M().budget || 0;
  const monthSpent = (m) => sum(M().entries.filter((e) => e.d.slice(0, 7) === m));
  const budgetBar = (m) => {
    const b = budget(); if (!b) return '';
    const sp = monthSpent(m), p = sp / b, left = b - sp;
    return `<div class="card" style="margin-top:12px"><div style="display:flex;justify-content:space-between"><span class="lt">Monthly budget ${rs(b)}</span><b class="num">${Math.round(p * 100)}%</b></div>${LU.bar(p, p >= 1 ? 'red' : p >= 0.8 ? 'gold' : '')}<div class="small ${left < 0 ? '' : 'muted'}" style="margin-top:6px;${left < 0 ? 'color:var(--red)' : ''}">${left >= 0 ? rs(left) + ' left this month' : 'Over budget by ' + rs(-left)}</div></div>`;
  };
  const ui = { mode: 'day', day: null, month: null };
  const today = () => LU.todayKey();
  const dayLabel = (k) => { const d = LU.parseKey(k); return (k === today() ? 'Today · ' : '') + LU.dayName(k).slice(0, 3) + ' ' + d.getDate() + ' ' + MN[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); };
  const addMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  const row = (e) => `<div class="li" data-act="monEdit" data-id="${e.id}"><div class="grow"><div class="lt">${e.n ? esc(e.n) : '<span class="muted">No note</span>'}</div></div><b class="num">${rs(e.a)}</b><span class="chev">${I('chev')}</span></div>`;
  const block = (c, list, k) => `<div class="sec-title">${CATS[c]} <a class="link" data-act="monAdd" data-c="${c}" data-d="${k}">Add</a></div>
    <div class="list">${list.filter((e) => e.c === c).map(row).join('') || `<div class="li"><div class="grow small muted">Nothing added yet.</div></div>`}
    <div class="li"><div class="grow lt">Total</div><b class="num">${rs(sum(list, c))}</b></div></div>`;

  LU.views.money = {
    render() {
      if (!ui.day) ui.day = today();
      if (!ui.month) ui.month = ui.day.slice(0, 7);
      const head = `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Money<span class="sub">Daily necessities and extra</span></h1></div>
        <div class="seg" id="monSeg" style="margin:0 0 12px"><button type="button" data-act="monMode" data-m="day" class="${ui.mode === 'day' ? 'on' : ''}">Day</button><button type="button" data-act="monMode" data-m="month" class="${ui.mode === 'month' ? 'on' : ''}">Month</button></div>`;
      if (ui.mode === 'day') {
        const k = ui.day, list = LU.moneyOn(k);
        return head + `<div class="card" style="display:flex;align-items:center;gap:8px;justify-content:space-between">
            <button class="iconbtn" data-act="monDay" data-n="-1">${I('left')}</button>
            <div style="text-align:center"><div class="lt">${dayLabel(k)}</div><div style="font:700 22px var(--fd);margin-top:2px">${rs(sum(list))}</div><div class="small muted">spent this day</div></div>
            <button class="iconbtn" data-act="monDay" data-n="1">${I('right')}</button></div>
          ${!list.length && LU.moneyOn(LU.addDays(k, -1)).length ? `<button class="btn ghost block" style="margin-top:12px" data-act="monCopy" data-d="${k}">${I('loop')}Copy yesterday’s entries</button>` : ''}
          ${budget() ? budgetBar(k.slice(0, 7)) : ''}
          ${block('n', list, k)}${block('x', list, k)}<div style="height:20px"></div>`;
      }
      const m = ui.month, all = M().entries.filter((e) => e.d.slice(0, 7) === m), [y, mo] = m.split('-').map(Number);
      const days = {}; all.forEach((e) => { (days[e.d] = days[e.d] || []).push(e); });
      const ks = Object.keys(days).sort().reverse();
      return head + `<div class="card" style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <button class="iconbtn" data-act="monMonth" data-n="-1">${I('left')}</button>
          <div style="text-align:center"><div class="lt">${MN[mo - 1]} ${y}</div><div style="font:700 22px var(--fd);margin-top:2px">${rs(sum(all))}</div><div class="small muted">spent this month</div></div>
          <button class="iconbtn" data-act="monMonth" data-n="1">${I('right')}</button></div>
        <div class="list" style="margin-top:12px">
          <div class="li"><div class="grow lt">${CATS.n}</div><b class="num">${rs(sum(all, 'n'))}</b></div>
          <div class="li"><div class="grow lt">${CATS.x}</div><b class="num">${rs(sum(all, 'x'))}</b></div>
          <div class="li"><div class="grow lt">Total</div><b class="num">${rs(sum(all))}</b></div></div>
        ${budgetBar(m)}
        ${LU.moneyExtras ? LU.moneyExtras(m) : ''}
        <button class="btn ghost block" style="margin-top:12px" data-act="monBudget">${I('flag')}${budget() ? 'Change monthly budget' : 'Set a monthly budget'}</button>
        <div class="sec-title">Day by day</div>
        <div class="list">${ks.map((k) => { const l = days[k]; return `<div class="li" data-act="monGo" data-d="${k}"><div class="grow"><div class="lt">${dayLabel(k)}</div><div class="ls">Necessities ${rs(sum(l, 'n'))} · Extra ${rs(sum(l, 'x'))}</div></div><b class="num">${rs(sum(l))}</b><span class="chev">${I('chev')}</span></div>`; }).join('') || `<div class="li"><div class="grow small muted">No entries this month.</div></div>`}</div>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openMoney = () => { ui.mode = 'day'; ui.day = today(); ui.month = null; LU.push('money'); };
  LU.actions.monMode = (el) => { ui.mode = el.dataset.m; if (ui.mode === 'month') ui.month = ui.day.slice(0, 7); else if (ui.month && ui.month !== ui.day.slice(0, 7)) ui.day = ui.month === today().slice(0, 7) ? today() : ui.month + '-01'; LU.render(); };
  LU.actions.monDay = (el) => { ui.day = LU.addDays(ui.day, +el.dataset.n); LU.render(); };
  LU.actions.monMonth = (el) => { ui.month = addMonth(ui.month, +el.dataset.n); LU.render(); };
  LU.actions.monCopy = (el) => {
    const k = el.dataset.d, from = LU.moneyOn(LU.addDays(k, -1));
    from.forEach((e) => M().entries.push({ id: LU.uid(), d: k, c: e.c, a: e.a, n: e.n }));
    LU.save(); LU.toast(from.length + ' entries copied. Edit any that changed.'); LU.render();
  };
  LU.actions.monBudget = () => LU.sheet({
    title: 'Monthly budget', body: `<div class="field"><label>Amount for the whole month (₹). Leave empty to remove.</label><input class="inp" id="mbA" type="number" inputmode="decimal" min="0" step="any" value="${budget() || ''}"></div><p class="small muted">The bar turns gold at 80% and red when you pass it.</p>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="mbOk">Save</button>`,
    mount: (sh) => { LU.$('#mbOk', sh).onclick = () => { const v = parseFloat(LU.$('#mbA', sh).value); M().budget = v > 0 ? v : 0; LU.save(); LU.closeSheet(); LU.render(); }; },
  });
  LU.actions.monGo = (el) => { ui.day = el.dataset.d; ui.mode = 'day'; LU.render(); };

  const editor = (e) => {
    const isNew = !e.id; let cat = e.c;
    LU.sheet({
      title: isNew ? 'Add spending' : 'Edit spending',
      body: `<div class="field"><label>Category</label><div class="seg" id="mnC"><button type="button" data-c="n" class="${cat === 'n' ? 'on' : ''}">${CATS.n}</button><button type="button" data-c="x" class="${cat === 'x' ? 'on' : ''}">${CATS.x}</button></div></div>
        <div class="field"><label>Amount (₹)</label><input class="inp" id="mnA" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${e.a || ''}"></div>
        <div class="field"><label>Note (optional)</label><input class="inp" id="mnN" maxlength="60" placeholder="e.g. Vegetables" value="${esc(e.n || '')}"></div>
        <div class="field"><label>Date</label><input class="inp" id="mnD" type="date" value="${e.d}"></div>`,
      foot: `${isNew ? `<button class="btn ghost" data-act="closeSheet">Cancel</button>` : `<button class="btn danger" id="mnDel">Delete</button>${e.d !== today() ? `<button class="btn ghost" id="mnRep">Repeat today</button>` : ''}`}<button class="btn" id="mnOk">Save</button>`,
      mount: (s) => {
        LU.$$('#mnC button', s).forEach((b) => (b.onclick = () => { cat = b.dataset.c; LU.$$('#mnC button', s).forEach((x) => x.classList.toggle('on', x === b)); }));
        LU.$('#mnOk', s).onclick = () => {
          const a = Math.round(parseFloat(LU.$('#mnA', s).value) * 100) / 100, d = LU.$('#mnD', s).value;
          if (!(a > 0)) { LU.toast('Type an amount first.'); return; }
          if (!d) { LU.toast('Pick a date.'); return; }
          const n = LU.$('#mnN', s).value.trim(), m = M();
          if (isNew) m.entries.push({ id: LU.uid(), d, c: cat, a, n }); else Object.assign(m.entries.find((x) => x.id === e.id) || {}, { d, c: cat, a, n });
          ui.day = d; ui.month = d.slice(0, 7);
          const b = budget(), before = b ? monthSpent(ui.month) : 0;
          LU.save(); LU.closeSheet();
          if (b && isNew) { const after = monthSpent(ui.month); if (before < b && after >= b) LU.toast('You are over your monthly budget.', { sys: false }); else if (before < b * 0.8 && after >= b * 0.8) LU.toast('You have used 80% of your monthly budget.', { sys: false }); } LU.syncReminders && LU.syncReminders(true); LU.render();
        };
        const rp = LU.$('#mnRep', s);
        if (rp) rp.onclick = () => { M().entries.push({ id: LU.uid(), d: today(), c: e.c, a: e.a, n: e.n }); ui.day = today(); ui.month = today().slice(0, 7); LU.save(); LU.closeSheet(); LU.toast('Added to today.', { sys: false }); LU.render(); };
        const dl = LU.$('#mnDel', s);
        if (dl) dl.onclick = () => { const m = M(); m.entries = m.entries.filter((x) => x.id !== e.id); LU.save(); LU.closeSheet(); LU.syncReminders && LU.syncReminders(true); LU.render(); };
        if (isNew) setTimeout(() => LU.focusField && LU.focusField(LU.$('#mnA', s)), 350);
      },
    });
  };
  LU.actions.monAdd = (el) => editor({ c: el.dataset.c, d: el.dataset.d || ui.day, a: '', n: '' });
  LU.actions.monEdit = (el) => { const e = M().entries.find((x) => x.id === el.dataset.id); if (e) editor(Object.assign({}, e)); };
})();
