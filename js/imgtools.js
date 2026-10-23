/* Image tools: pick photos, fix perspective, rotate, filters, JPEG, and PDF pages made from images */
(function () {
  const LU = window.LU;
  const T = (LU.img = {});
  const MAXPX = 2200;

  /* ---------- picking. camera:true opens the phone's camera app ---------- */
  T.pick = (o = {}) => new Promise((resolve) => {
    const f = document.createElement('input');
    f.type = 'file'; f.accept = 'image/*'; f.hidden = true;
    if (o.multiple) f.multiple = true;
    if (o.camera) f.setAttribute('capture', 'environment');
    let done = false;
    const fin = (list) => { if (done) return; done = true; setTimeout(() => f.remove(), 500); resolve(list); };
    f.onchange = () => fin(Array.from(f.files || []));
    f.addEventListener('cancel', () => fin([]));
    document.body.appendChild(f);
    f.click();
  });

  /* ---------- load / downscale ---------- */
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  T.canvas = canvasOf;
  const blank = (c) => { // true when the picture came out all white (a failed decode)
    try {
      const x = c.getContext('2d'), n = 20; let white = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const d = x.getImageData(Math.floor(((i + 0.5) / n) * c.width), Math.floor(((j + 0.5) / n) * c.height), 1, 1).data; if (d[0] > 250 && d[1] > 250 && d[2] > 250) white++; }
      return white >= n * n;
    } catch (e) { return false; }
  };
  const drawFrom = async (file, max, how) => {
    let src, w, h;
    if (how === 'bitmap') {
      src = await createImageBitmap(file); w = src.width; h = src.height; // the browser applies the photo's rotation itself
    } else {
      const url = URL.createObjectURL(file);
      try {
        src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('That image could not be opened.')); im.src = url; });
        if (src.decode) { try { await src.decode(); } catch (e) {} }
        w = src.naturalWidth; h = src.naturalHeight;
      } finally { setTimeout(() => URL.revokeObjectURL(url), 3000); }
    }
    if (!w || !h) throw new Error('That image could not be opened.');
    const f = Math.min(1, max / Math.max(w, h));
    const c = canvasOf(w * f, h * f), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0, c.width, c.height);
    if (src.close) try { src.close(); } catch (e) {}
    return c;
  };
  T.load = async (file, max = MAXPX) => {
    const order = window.createImageBitmap ? ['img', 'bitmap'] : ['img'];
    let last = null, err = null;
    for (const how of order) {
      try { const c = await drawFrom(file, max, how); if (!blank(c)) return c; last = c; } catch (e) { err = e; }
    }
    if (last) return last;
    throw err || new Error('That image could not be opened.');
  };

  T.rotate = (cv, deg) => {
    deg = ((deg % 360) + 360) % 360; if (!deg) return cv;
    const swap = deg === 90 || deg === 270;
    const c = canvasOf(swap ? cv.height : cv.width, swap ? cv.width : cv.height), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate((deg * Math.PI) / 180); x.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return c;
  };

  /* ---------- perspective crop. quad = [[x,y] TL, TR, BR, BL] in canvas pixels ---------- */
  const solve = (A, b) => { // gaussian elimination, 8x8
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      const d = A[i][i] || 1e-12;
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / d; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / (A[i][i] || 1e-12); }
    return x;
  };
  /* homography H mapping (u,v) in the output rectangle to (x,y) in the source */
  const homog = (q, W, H) => {
    const dst = [[0, 0], [W, 0], [W, H], [0, H]], A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [u, v] = dst[i], [x, y] = q[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
    }
    return solve(A, b);
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  T.isFull = (q, w, h) => q[0][0] < 2 && q[0][1] < 2 && q[1][0] > w - 2 && q[1][1] < 2 && q[2][0] > w - 2 && q[2][1] > h - 2 && q[3][0] < 2 && q[3][1] > h - 2;
  T.warp = (cv, q, max = 2000) => {
    if (T.isFull(q, cv.width, cv.height)) return cv;
    let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    const f = Math.min(1, max / Math.max(W, H)); W = Math.max(8, Math.round(W * f)); H = Math.max(8, Math.round(H * f));
    const h = homog(q, W, H);
    const sw = cv.width, sh = cv.height, src = cv.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = canvasOf(W, H), ox = out.getContext('2d'), img = ox.createImageData(W, H), d = img.data;
    for (let v = 0; v < H; v++) {
      for (let u = 0; u < W; u++) {
        const z = h[6] * u + h[7] * v + 1;
        let x = (h[0] * u + h[1] * v + h[2]) / z, y = (h[3] * u + h[4] * v + h[5]) / z;
        x = x < 0 ? 0 : x > sw - 1.001 ? sw - 1.001 : x; y = y < 0 ? 0 : y > sh - 1.001 ? sh - 1.001 : y;
        const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = (y0 * sw + x0) * 4, j = i + sw * 4;
        const o = (v * W + u) * 4;
        for (let c = 0; c < 3; c++) {
          const a = src[i + c] + (src[i + 4 + c] - src[i + c]) * fx, bb = src[j + c] + (src[j + 4 + c] - src[j + c]) * fx;
          d[o + c] = a + (bb - a) * fy;
        }
        d[o + 3] = 255;
      }
    }
    ox.putImageData(img, 0, 0);
    return out;
  };

  /* ---------- filters ---------- */
  T.FILTERS = [['orig', 'Original'], ['enh', 'Enhanced'], ['gray', 'Grayscale'], ['bw', 'Black and white']];
  const levels = (d, n) => {
    const hist = new Uint32Array(256);
    for (let i = 0; i < n; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
    const tot = n / 4; let a = 0, lo = 0, hi = 255;
    for (let k = 0; k < 256; k++) { a += hist[k]; if (a >= tot * 0.01) { lo = k; break; } }
    a = 0; for (let k = 0; k < 256; k++) { a += hist[k]; if (a >= tot * 0.80) { hi = k; break; } }
    if (hi - lo < 40) { lo = Math.max(0, hi - 40); }
    return [lo, Math.min(255, Math.max(hi, lo + 40))];
  };
  T.filter = (cv, mode) => {
    if (!mode || mode === 'orig') return cv;
    const w = cv.width, h = cv.height, c = canvasOf(w, h), x = c.getContext('2d');
    const im = cv.getContext('2d').getImageData(0, 0, w, h), d = im.data, n = d.length;
    if (mode === 'enh' || mode === 'gray') {
      const [lo, hi] = levels(d, n), s = 255 / (hi - lo);
      for (let i = 0; i < n; i += 4) {
        if (mode === 'gray') {
          const g = ((d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8);
          const v = Math.max(0, Math.min(255, (g - lo) * s)); d[i] = d[i + 1] = d[i + 2] = v;
        } else {
          for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - lo) * s));
        }
      }
    } else if (mode === 'bw') {
      const g = new Uint8Array(w * h);
      for (let i = 0, p = 0; i < n; i += 4, p++) g[p] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
      const S = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) { let row = 0; for (let xx = 0; xx < w; xx++) { row += g[y * w + xx]; S[(y + 1) * (w + 1) + xx + 1] = S[y * (w + 1) + xx + 1] + row; } }
      const r = Math.max(8, Math.round(Math.max(w, h) / 32));
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
        for (let xx = 0; xx < w; xx++) {
          const x0 = Math.max(0, xx - r), x1 = Math.min(w, xx + r + 1);
          const sum = S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0];
          const mean = sum / ((x1 - x0) * (y1 - y0));
          const v = g[y * w + xx] < mean * 0.86 ? 0 : 255, o = (y * w + xx) * 4;
          d[o] = d[o + 1] = d[o + 2] = v;
        }
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  };

  /* ---------- encode ---------- */
  T.toBlob = (cv, q = 0.85) => new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not save the image'))), 'image/jpeg', q));
  T.toBytes = async (cv, q = 0.85) => new Uint8Array(await (await T.toBlob(cv, q)).arrayBuffer());

  /* ---------- small thumbnail data url ---------- */
  T.thumb = (cv, max = 220) => { const f = Math.min(1, max / Math.max(cv.width, cv.height)); const c = canvasOf(cv.width * f, cv.height * f); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7); };

  /* ---------- a new PDF made from page images [{bytes, w, h}] ---------- */
  T.buildPdf = async (pages) => {
    const L = await LU.pdfEdit();
    const doc = await L.PDFDocument.create();
    for (const p of pages) {
      const im = await doc.embedJpg(p.bytes), W = 595, H = Math.round((W * p.h) / p.w);
      const pg = doc.addPage([W, H]); pg.drawImage(im, { x: 0, y: 0, width: W, height: H });
    }
    return doc.save();
  };
})();
