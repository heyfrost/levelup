/* Map data: downloaded once from Natural Earth (public domain), thinned, and kept inside the app (IndexedDB) so maps work offline. */
(function () {
  const LU = window.LU;
  const GH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
  const u = (n) => GH + n + '.geojson';
  /* tol = how much detail is thrown away (degrees). type: poly | line | pt */
  LU.MAPLAYERS = [
    { id: 'countries', name: 'Countries', mb: 12, type: 'poly', tol: 0.02, urls: [u('ne_50m_admin_0_countries_ind'), u('ne_10m_admin_0_countries_ind'), u('ne_50m_admin_0_countries')] },
    { id: 'states', name: 'States and provinces (whole world)', mb: 40, type: 'poly', tol: 0.012, urls: [u('ne_10m_admin_1_states_provinces'), u('ne_50m_admin_1_states_provinces')] },
    { id: 'lakes', name: 'Lakes', mb: 3, type: 'poly', tol: 0.02, urls: [u('ne_10m_lakes'), u('ne_50m_lakes')] },
    { id: 'rivers', name: 'Rivers', mb: 5, type: 'line', tol: 0.015, urls: [u('ne_10m_rivers_lake_centerlines'), u('ne_50m_rivers_lake_centerlines')] },
    { id: 'regions', name: 'Mountains, plateaus, plains, deserts', mb: 3, type: 'poly', tol: 0.03, urls: [u('ne_10m_geography_regions_polys'), u('ne_50m_geography_regions_polys')] },
    { id: 'peaks', name: 'Peaks', mb: 1, type: 'pt', tol: 0, urls: [u('ne_10m_geography_regions_elevation_points')] },
  ];
  LU.mapData = {}; // loaded layers, by id
  LU.mapHas = (id) => !!LU.mapData[id];
  LU.mapReady = () => !!(LU.mapData.countries);

  const KEY = (id) => 'mapdata:' + id;
  const MAXLAT = 85.0511;
  const nx = (lon) => (lon + 180) / 360;
  const ny = (lat) => { lat = Math.max(-MAXLAT, Math.min(MAXLAT, lat)); const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  LU.mapNX = nx; LU.mapNY = ny;
  LU.mapLon = (x) => x * 360 - 180;
  LU.mapLat = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

  const lc = (p) => { const o = {}; for (const k in p) o[k.toLowerCase()] = p[k]; return o; };

  /* one ring of [lon,lat] pairs -> Float32Array of normalised mercator x,y, thinned */
  const ring = (pts, tol, closed) => {
    const out = [];
    let lx = 1e9, ly = 1e9;
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1];
      if (i === 0 || i === pts.length - 1 || Math.abs(x - lx) + Math.abs(y - ly) >= tol) { out.push(nx(x), ny(y)); lx = x; ly = y; }
    }
    if (out.length < (closed ? 6 : 4)) return null;
    return Float32Array.from(out);
  };

  const compact = (feat, L) => {
    const g = feat.geometry; if (!g) return null;
    const p = lc(feat.properties || {});
    const rings = [];
    const addPoly = (poly) => poly.forEach((r) => { const q = ring(r, L.tol, true); if (q) rings.push(q); });
    if (L.type === 'pt') {
      if (g.type !== 'Point') return null;
      return { n: p.name || '', el: +p.elevation || +p.elev_m || 0, c: String(p.featurecla || ''), x: nx(g.coordinates[0]), y: ny(g.coordinates[1]) };
    }
    if (g.type === 'Polygon') addPoly(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(addPoly);
    else if (g.type === 'LineString') { const q = ring(g.coordinates, L.tol, false); if (q) rings.push(q); }
    else if (g.type === 'MultiLineString') g.coordinates.forEach((r) => { const q = ring(r, L.tol, false); if (q) rings.push(q); });
    else return null;
    if (!rings.length) return null;
    let x0 = 2, y0 = 2, x1 = -1, y1 = -1, big = 0, bi = 0;
    rings.forEach((r, k) => {
      let a0 = 2, b0 = 2, a1 = -1, b1 = -1;
      for (let i = 0; i < r.length; i += 2) { const x = r[i], y = r[i + 1]; if (x < a0) a0 = x; if (x > a1) a1 = x; if (y < b0) b0 = y; if (y > b1) b1 = y; }
      if (a0 < x0) x0 = a0; if (a1 > x1) x1 = a1; if (b0 < y0) y0 = b0; if (b1 > y1) y1 = b1;
      const ar = (a1 - a0) * (b1 - b0); if (ar > big) { big = ar; bi = k; }
    });
    /* label spot = centre of the biggest piece */
    const R = rings[bi]; let lx = 0, ly = 0, m = 0;
    for (let i = 0; i < R.length; i += 2) { lx += R[i]; ly += R[i + 1]; m++; }
    const o = {
      n: p.name_en || p.name || '', a: p.admin || p.sovereignt || '', a3: p.adm0_a3 || p.sov_a3 || '',
      c: String(p.featurecla || p.type || ''), sr: +p.scalerank || +p.scalerank_ || 0,
      b: [x0, y0, x1, y1], l: [lx / m, ly / m], r: rings,
    };
    return o;
  };

  /* read a big GeoJSON file one feature at a time, whatever its layout (one feature per line, or all on one line),
     so memory stays small. It cuts out each {...} feature by counting braces. */
  const streamFeatures = async (url, onFeature, onBytes) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let count = 0, seen = 0, first = '';
    const emit = (txt) => {
      let f; try { f = JSON.parse(txt); } catch (e) { return; }
      if (!f || f.type !== 'Feature') return;
      seen++; if (!first) first = (f.geometry && f.geometry.type) || 'no geometry';
      onFeature(f); count++;
    };
    let depth = 0, inStr = false, esc = false, seg = -1, cur = '';
    const feed = (s) => {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false; continue; }
        if (c === 34) { inStr = true; continue; }
        if (c === 123) { depth++; if (depth === 2) { seg = i; cur = ''; } }
        else if (c === 125) { if (depth === 2 && seg >= 0) { emit(cur + s.slice(seg, i + 1)); seg = -1; cur = ''; } depth--; }
      }
      if (seg >= 0) { cur += s.slice(seg); seg = 0; }
    };
    if (res.body && res.body.getReader) {
      const rd = res.body.getReader(), dec = new TextDecoder();
      let got = 0;
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        got += value.length; if (onBytes) onBytes(got);
        feed(dec.decode(value, { stream: true }));
      }
    } else {
      const t = await res.text(); if (onBytes) onBytes(t.length); feed(t);
    }
    if (!count) throw new Error(seen ? 'unsupported shapes (' + first + ')' : 'file had no map features');
  };

  LU.mapLoad = async () => {
    for (const L of LU.MAPLAYERS) {
      if (LU.mapData[L.id]) continue;
      try { const v = await LU.idb.get('files', KEY(L.id)); if (v && v.f) LU.mapData[L.id] = v.f; } catch (e) {}
    }
    return LU.mapReady();
  };
  LU.mapStatus = () => LU.MAPLAYERS.map((L) => ({ id: L.id, name: L.name, mb: L.mb, ok: !!LU.mapData[L.id] }));
  LU.mapDelete = async () => { LU.mapData = {}; for (const L of LU.MAPLAYERS) { try { await LU.idb.del('files', KEY(L.id)); } catch (e) {} } };

  /* download every missing layer. progress(text, fraction 0..1) */
  LU.mapDownload = async (progress) => {
    const todo = LU.MAPLAYERS.filter((L) => !LU.mapData[L.id]);
    let failed = [];
    for (let k = 0; k < todo.length; k++) {
      const L = todo[k]; let ok = false, lastErr = '';
      for (const url of L.urls) {
        const feats = [];
        try {
          progress(`${L.name} (${k + 1} of ${todo.length})`, k / todo.length);
          await streamFeatures(url, (f) => { const c = compact(f, L); if (c) feats.push(c); }, (b) => progress(`${L.name} (${k + 1} of ${todo.length}): ${(b / 1048576).toFixed(1)} MB`, k / todo.length));
          if (!feats.length) throw new Error('no features');
          await LU.idb.put('files', KEY(L.id), { f: feats, at: Date.now() });
          LU.mapData[L.id] = feats; ok = true; break;
        } catch (e) { lastErr = e.message || String(e); }
      }
      if (!ok) failed.push(L.name + ' (' + lastErr + ')');
      await new Promise((r) => setTimeout(r, 30));
    }
    progress('Done', 1);
    return failed;
  };
})();
