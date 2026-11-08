// mushaf.js: a printed mushaf, imported from a PDF on this device and shown page by page as pictures.
//
// The PDF never leaves the device. Each page's scanned picture is stored in the browser (IndexedDB),
// in the PDF's own compression, and turned back into pixels when the page is opened.
// For the 13-line colour-coded tajweed mushaf, a bundled index (mushaf13.json) says where every
// ayah, surah header and juz starts on each page, so ayahs can be tapped, highlighted and recited.

import { pages as pageStore } from './db.js';

// ---------------------------------------------------------------- tiny PDF reader
// Enough of PDF to find the picture on each page of a scanned book: objects, the page tree and image streams.

class Name {
  constructor(n) { this.n = n; }
}
class Ref {
  constructor(num, gen) { this.num = num; this.gen = gen; }
}

const isWs = (c) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
const isDelim = (c) => c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d
  || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
const isDigit = (c) => c >= 0x30 && c <= 0x39;

export class PdfError extends Error {}

class PdfReader {
  constructor(bytes) {
    this.b = bytes;
    this.offsets = new Map();
    this.cache = new Map();
    this.trailer = null;
  }

  // ---- lexer
  ws(i) {
    const b = this.b;
    for (;;) {
      while (i < b.length && isWs(b[i])) i++;
      if (b[i] === 0x25) { // % comment
        while (i < b.length && b[i] !== 0x0a && b[i] !== 0x0d) i++;
      } else return i;
    }
  }

  word(i) {
    const b = this.b;
    let j = i;
    while (j < b.length && !isWs(b[j]) && !isDelim(b[j])) j++;
    let s = '';
    for (let k = i; k < j; k++) s += String.fromCharCode(b[k]);
    return [s, j];
  }

  /** Parse one value starting at i. Returns [value, next index]. */
  value(i) {
    const b = this.b;
    i = this.ws(i);
    const c = b[i];
    if (c === 0x3c && b[i + 1] === 0x3c) { // << dict >>
      i += 2;
      const d = {};
      for (;;) {
        i = this.ws(i);
        if (b[i] === 0x3e && b[i + 1] === 0x3e) return [d, i + 2];
        if (b[i] !== 0x2f) throw new PdfError('Bad dictionary');
        const [key, k2] = this.word(i + 1);
        const [v, k3] = this.value(k2);
        d[decodeName(key)] = v;
        i = k3;
      }
    }
    if (c === 0x3c) { // <hex>
      let j = i + 1;
      const hex = [];
      while (j < b.length && b[j] !== 0x3e) {
        if (!isWs(b[j])) hex.push(b[j]);
        j++;
      }
      if (hex.length % 2) hex.push(0x30);
      const out = new Uint8Array(hex.length / 2);
      for (let k = 0; k < out.length; k++) out[k] = parseInt(String.fromCharCode(hex[2 * k], hex[2 * k + 1]), 16);
      return [out, j + 1];
    }
    if (c === 0x5b) { // [ array ]
      i++;
      const arr = [];
      for (;;) {
        i = this.ws(i);
        if (b[i] === 0x5d) return [arr, i + 1];
        const [v, j] = this.value(i);
        arr.push(v);
        i = j;
      }
    }
    if (c === 0x28) return this.literal(i);
    if (c === 0x2f) { // /Name
      const [w, j] = this.word(i + 1);
      return [new Name(decodeName(w)), j];
    }
    const [w, j] = this.word(i);
    if (w === 'true') return [true, j];
    if (w === 'false') return [false, j];
    if (w === 'null') return [null, j];
    const num = Number(w);
    if (w === '' || Number.isNaN(num)) throw new PdfError(`Unexpected token at ${i}`);
    // "12 0 R" is a reference
    if (/^\d+$/.test(w)) {
      const k = this.ws(j);
      if (isDigit(b[k])) {
        const [w2, k2] = this.word(k);
        const k3 = this.ws(k2);
        if (/^\d+$/.test(w2) && b[k3] === 0x52 && (k3 + 1 >= b.length || isWs(b[k3 + 1]) || isDelim(b[k3 + 1]))) {
          return [new Ref(num, Number(w2)), k3 + 1];
        }
      }
    }
    return [num, j];
  }

  literal(i) {
    const b = this.b;
    const out = [];
    let depth = 0;
    i++;
    for (; i < b.length; i++) {
      const c = b[i];
      if (c === 0x5c) { // backslash
        const n = b[++i];
        const map = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12, 0x28: 0x28, 0x29: 0x29, 0x5c: 0x5c };
        if (n in map) out.push(map[n]);
        else if (n >= 0x30 && n <= 0x37) {
          let v = n - 0x30;
          for (let k = 0; k < 2 && b[i + 1] >= 0x30 && b[i + 1] <= 0x37; k++) v = v * 8 + (b[++i] - 0x30);
          out.push(v & 255);
        } else if (n === 0x0d) {
          if (b[i + 1] === 0x0a) i++;
        } else if (n !== 0x0a) out.push(n);
      } else if (c === 0x28) {
        depth++;
        out.push(c);
      } else if (c === 0x29) {
        if (depth === 0) return [Uint8Array.from(out), i + 1];
        depth--;
        out.push(c);
      } else out.push(c);
    }
    throw new PdfError('Unterminated string');
  }

  // ---- cross-reference table
  init() {
    const b = this.b;
    if (!(b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)) {
      // some files have junk before %PDF; accept it if %PDF appears early
      const head = latin1(b.subarray(0, 1024));
      if (!head.includes('%PDF')) throw new PdfError('Not a PDF file');
    }
    try {
      this.readXrefChain();
    } catch {
      this.offsets.clear();
      this.trailer = null;
    }
    if (!this.trailer?.Root || !this.offsets.size) this.bruteForce();
    if (!this.trailer?.Root) throw new PdfError('The PDF has no catalog');
  }

  readXrefChain() {
    const b = this.b;
    const tail = latin1(b.subarray(Math.max(0, b.length - 2048)));
    const m = /startxref\s+(\d+)/g;
    let last = null;
    let r;
    while ((r = m.exec(tail))) last = r;
    if (!last) throw new PdfError('No startxref');
    let off = Number(last[1]);
    const seen = new Set();
    while (off && !seen.has(off) && off < b.length) {
      seen.add(off);
      let i = this.ws(off);
      const [kw, j] = this.word(i);
      if (kw !== 'xref') throw new PdfError('Not a classic xref table');
      i = j;
      for (;;) {
        i = this.ws(i);
        const [w1, j1] = this.word(i);
        if (w1 === 'trailer') {
          const [t, j2] = this.value(j1);
          if (!this.trailer) this.trailer = t;
          off = typeof t.Prev === 'number' ? t.Prev : 0;
          i = j2;
          break;
        }
        const start = Number(w1);
        const [w2, j3] = this.word(this.ws(j1));
        const count = Number(w2);
        if (!Number.isFinite(start) || !Number.isFinite(count)) throw new PdfError('Bad xref');
        i = j3;
        for (let k = 0; k < count; k++) {
          i = this.ws(i);
          const [o, a1] = this.word(i);
          const [, a2] = this.word(this.ws(a1));
          const [t, a3] = this.word(this.ws(a2));
          i = a3;
          const num = start + k;
          if (t === 'n' && !this.offsets.has(num)) this.offsets.set(num, Number(o));
        }
      }
    }
  }

  /** Damaged or unusual files: find every "N G obj" by scanning the whole file. */
  bruteForce() {
    const b = this.b;
    this.offsets.clear();
    for (let i = 3; i < b.length - 3; i++) {
      if (b[i] !== 0x6f || b[i + 1] !== 0x62 || b[i + 2] !== 0x6a) continue; // "obj"
      let j = i - 1;
      if (!isWs(b[j])) continue;
      while (j > 0 && isWs(b[j])) j--;
      let g = j;
      while (g > 0 && isDigit(b[g])) g--;
      if (g === j || !isWs(b[g])) continue;
      let k = g;
      while (k > 0 && isWs(b[k])) k--;
      let n = k;
      while (n >= 0 && isDigit(b[n])) n--;
      if (n === k || (n >= 0 && b[n] !== 0x0a && b[n] !== 0x0d && b[n] !== 0x20)) continue;
      const num = Number(latin1(b.subarray(n + 1, k + 1)));
      this.offsets.set(num, n + 1);
    }
    // the last trailer, or the catalog object
    const text = latin1(b.subarray(Math.max(0, b.length - 65536)));
    const t = text.lastIndexOf('trailer');
    if (t >= 0) {
      try {
        const base = Math.max(0, b.length - 65536);
        const [tr] = this.value(base + t + 7);
        if (tr?.Root) this.trailer = tr;
      } catch { /* fall through */ }
    }
    if (!this.trailer?.Root) {
      for (const num of this.offsets.keys()) {
        const o = this.get(new Ref(num, 0));
        if (o && typeof o === 'object' && nameOf(o.Type) === 'Catalog') {
          this.trailer = { Root: new Ref(num, 0) };
          break;
        }
      }
    }
  }

  /** Resolve a reference (other values pass through). Streams come back as { dict, start, length }. */
  get(v) {
    if (!(v instanceof Ref)) return v;
    if (this.cache.has(v.num)) return this.cache.get(v.num);
    const off = this.offsets.get(v.num);
    if (off == null) return null;
    let out = null;
    try {
      let i = this.ws(off);
      [, i] = this.word(i); // number
      [, i] = this.word(this.ws(i)); // generation
      const [kw, j] = this.word(this.ws(i));
      if (kw !== 'obj') return null;
      const [val, k] = this.value(j);
      out = val;
      const s = this.ws(k);
      const [kw2, k2] = this.word(s);
      if (kw2 === 'stream' && val && typeof val === 'object' && !Array.isArray(val)) {
        let st = k2;
        if (this.b[st] === 0x0d) st++;
        if (this.b[st] === 0x0a) st++;
        let len = this.get(val.Length);
        if (typeof len !== 'number' || st + len > this.b.length) len = this.findEndstream(st) - st;
        out = { dict: val, start: st, length: len };
      }
    } catch {
      out = null;
    }
    this.cache.set(v.num, out);
    return out;
  }

  findEndstream(from) {
    const b = this.b;
    for (let i = from; i < b.length - 9; i++) {
      if (b[i] === 0x65 && b[i + 1] === 0x6e && b[i + 2] === 0x64 && latin1(b.subarray(i, i + 9)) === 'endstream') {
        let e = i;
        if (b[e - 1] === 0x0a) e--;
        if (b[e - 1] === 0x0d) e--;
        return e;
      }
    }
    return b.length;
  }

  /** Every page, in reading order, with its (possibly inherited) resources. */
  pages() {
    const root = this.get(this.trailer.Root);
    const out = [];
    const seen = new Set();
    const walk = (ref, inherited, depth) => {
      if (depth > 40) return;
      const key = ref instanceof Ref ? ref.num : null;
      if (key != null) {
        if (seen.has(key)) return;
        seen.add(key);
      }
      const node = this.get(ref);
      if (!node || typeof node !== 'object') return;
      const res = node.Resources !== undefined ? node.Resources : inherited;
      const kids = this.get(node.Kids);
      if (Array.isArray(kids) && nameOf(node.Type) !== 'Page') {
        for (const k of kids) walk(k, res, depth + 1);
      } else {
        out.push({ node, res: this.get(res) });
      }
    };
    walk(root?.Pages, null, 0);
    return out;
  }
}

function latin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return s;
}

function decodeName(s) {
  return s.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

const nameOf = (v) => (v instanceof Name ? v.n : null);

// ---------------------------------------------------------------- inflating
async function inflate(data, expected = 0) {
  const stream = (data instanceof Blob ? data : new Blob([data])).stream().pipeThrough(new DecompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
  } catch (err) {
    // Some PDFs end their streams early or with a bad checksum; keep what came out if it is enough.
    if (!size || (expected && size < expected)) throw err;
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// ---------------------------------------------------------------- reading the page pictures out of a PDF
function filtersOf(dict, pdf) {
  const f = pdf.get(dict.Filter);
  const list = Array.isArray(f) ? f.map((x) => nameOf(pdf.get(x))) : f ? [nameOf(f)] : [];
  const p = pdf.get(dict.DecodeParms ?? dict.DP);
  const parms = Array.isArray(p) ? p.map((x) => pdf.get(x)) : [p];
  return { list, parms };
}

/** Colour space of an image: { kind: 'gray' | 'rgb' | 'cmyk' | 'idx', comps, base?, hival?, lookup? } */
function colourSpace(cs, pdf, res, depth = 0) {
  cs = pdf.get(cs);
  if (depth > 5) return null;
  const nm = nameOf(cs);
  if (nm) {
    if (nm === 'DeviceGray' || nm === 'G' || nm === 'CalGray') return { kind: 'gray', comps: 1 };
    if (nm === 'DeviceRGB' || nm === 'RGB' || nm === 'CalRGB') return { kind: 'rgb', comps: 3 };
    if (nm === 'DeviceCMYK' || nm === 'CMYK') return { kind: 'cmyk', comps: 4 };
    const named = pdf.get(pdf.get(res?.ColorSpace)?.[nm]);
    return named ? colourSpace(named, pdf, res, depth + 1) : null;
  }
  if (Array.isArray(cs)) {
    const fam = nameOf(pdf.get(cs[0]));
    if (fam === 'ICCBased') {
      const st = pdf.get(cs[1]);
      const n = pdf.get(st?.dict?.N);
      if (n === 1) return { kind: 'gray', comps: 1 };
      if (n === 4) return { kind: 'cmyk', comps: 4 };
      return { kind: 'rgb', comps: 3 };
    }
    if (fam === 'CalRGB') return { kind: 'rgb', comps: 3 };
    if (fam === 'CalGray') return { kind: 'gray', comps: 1 };
    if (fam === 'Indexed' || fam === 'I') {
      const base = colourSpace(cs[1], pdf, res, depth + 1);
      if (!base || base.kind === 'idx') return null;
      return { kind: 'idx', comps: 1, base, hival: pdf.get(cs[2]), lookup: pdf.get(cs[3]) };
    }
  }
  return null;
}

/** The biggest picture on a page (scanned books have one per page). */
function pageImage(pdf, page) {
  let best = null;
  const visit = (res, depth) => {
    const xo = pdf.get(pdf.get(res)?.XObject);
    if (!xo || typeof xo !== 'object') return;
    for (const k of Object.keys(xo)) {
      const st = pdf.get(xo[k]);
      if (!st?.dict) continue;
      const sub = nameOf(pdf.get(st.dict.Subtype));
      if (sub === 'Image' && !pdf.get(st.dict.ImageMask)) {
        const w = pdf.get(st.dict.Width);
        const h = pdf.get(st.dict.Height);
        if (w > 0 && h > 0 && (!best || w * h > best.w * best.h)) best = { st, w, h, res: pdf.get(res) };
      } else if (sub === 'Form' && depth < 2) {
        visit(st.dict.Resources, depth + 1);
      }
    }
  };
  visit(page.res, 0);
  return best;
}

/**
 * Read a PDF file and store the picture of every page on this device.
 * onProgress(done, total) is called as pages are saved. Returns { count, fingerprint }.
 */
export async function importPdf(file, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = new PdfReader(bytes);
  pdf.init();
  const list = pdf.pages();
  if (!list.length) throw new PdfError('No pages found in this PDF');
  const records = [];
  let unsupported = 0;
  for (let i = 0; i < list.length; i++) {
    const img = pageImage(pdf, list[i]);
    if (!img) {
      records.push(null);
      unsupported++;
      continue;
    }
    const { st, w, h } = img;
    const d = st.dict;
    const { list: filters, parms } = filtersOf(d, pdf);
    const raw = file.slice(st.start, st.start + st.length);
    let rec = null;
    const last = filters[filters.length - 1];
    if (last === 'DCTDecode' || last === 'DCT') {
      if (filters.length === 1) rec = { kind: 'jpeg', data: raw.slice(0, raw.size, 'image/jpeg') };
      else if (filters.length === 2 && (filters[0] === 'FlateDecode' || filters[0] === 'Fl')) {
        rec = { kind: 'jpeg', data: new Blob([await inflate(raw)], { type: 'image/jpeg' }) };
      }
    } else if (filters.length <= 1 && (!filters.length || filters[0] === 'FlateDecode' || filters[0] === 'Fl')) {
      const cs = colourSpace(d.ColorSpace ?? d.CS, pdf, img.res);
      const bpc = pdf.get(d.BitsPerComponent ?? d.BPC) || 8;
      if (cs && [1, 2, 4, 8].includes(bpc) && !(cs.kind !== 'idx' && cs.kind !== 'gray' && bpc !== 8)) {
        let pal = null;
        if (cs.kind === 'idx') {
          const lk = cs.lookup;
          if (lk instanceof Uint8Array) pal = lk;
          else if (lk?.dict) {
            const lraw = bytes.subarray(lk.start, lk.start + lk.length);
            const lf = filtersOf(lk.dict, pdf).list;
            pal = lf.length ? await inflate(lraw) : lraw.slice();
          }
          if (!pal) pal = null;
        }
        const p = parms[0] && typeof parms[0] === 'object' ? parms[0] : null;
        const pred = p && pdf.get(p.Predictor) > 1 ? {
          predictor: pdf.get(p.Predictor),
          colors: pdf.get(p.Colors) || 1,
          bpc: pdf.get(p.BitsPerComponent) || 8,
          columns: pdf.get(p.Columns) || 1,
        } : null;
        const decode = pdf.get(d.Decode ?? d.D);
        if (cs.kind !== 'idx' || pal) {
          rec = {
            kind: 'pix',
            flate: filters.length === 1,
            w,
            h,
            bpc,
            cs: cs.kind,
            base: cs.base?.kind || null,
            hival: cs.hival ?? null,
            pal,
            pred,
            decode: Array.isArray(decode) ? decode.map(Number) : null,
            data: raw,
          };
        }
      }
    }
    if (!rec) unsupported++;
    else {
      rec.w = w;
      rec.h = h;
    }
    records.push(rec);
  }
  if (unsupported === list.length) {
    throw new PdfError("The pages of this PDF are stored in a way Halaqa can't read. A scanned mushaf saved as a PDF of pictures works best.");
  }
  await pageStore.clear();
  for (let i = 0; i < records.length; i++) {
    if (records[i]) await pageStore.set(i + 1, records[i]);
    if (i % 10 === 9 || i === records.length - 1) onProgress(i + 1, records.length);
  }
  const dims = records.map((r) => (r ? `${r.w}x${r.h}` : '-'));
  const info = {
    name: file.name || 'mushaf.pdf',
    size: file.size,
    count: records.length,
    dims: [...new Set(dims)].slice(0, 6),
    fingerprint: `${records.length}:${dims.slice(3, 6).join(',')}`,
    missing: unsupported,
    at: Date.now(),
  };
  await pageStore.set('info', info);
  bitmaps.clear();
  return info;
}

export const mushafInfo = () => pageStore.get('info').catch(() => null);

export async function removeMushaf() {
  bitmaps.clear();
  await pageStore.clear();
}

// ---------------------------------------------------------------- turning a stored page back into a picture
function unpredict(data, pred, w, comps, bpc) {
  if (pred.predictor === 2) { // TIFF: each sample adds the one to its left (8 bits only)
    if (bpc !== 8) return data;
    const row = w * comps;
    for (let y = 0; y < data.length / row; y++) {
      for (let x = comps; x < row; x++) data[y * row + x] = (data[y * row + x] + data[y * row + x - comps]) & 255;
    }
    return data;
  }
  // PNG predictors: every row starts with a filter byte
  const bpp = Math.max(1, Math.ceil((comps * bpc) / 8));
  const row = Math.ceil((w * comps * bpc) / 8);
  const rows = Math.floor(data.length / (row + 1));
  const out = new Uint8Array(rows * row);
  let prev = new Uint8Array(row);
  for (let y = 0; y < rows; y++) {
    const ft = data[y * (row + 1)];
    const src = data.subarray(y * (row + 1) + 1, (y + 1) * (row + 1));
    const cur = out.subarray(y * row, (y + 1) * row);
    for (let x = 0; x < row; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return out;
}

function toImageData(rec, data) {
  const { w, h, bpc } = rec;
  const out = new ImageData(w, h);
  const px = out.data;
  const comps = rec.cs === 'rgb' ? 3 : rec.cs === 'cmyk' ? 4 : 1;
  const rowBytes = Math.ceil((w * comps * bpc) / 8);
  const max = (1 << bpc) - 1;
  const inverted = rec.decode && rec.decode.length >= 2 && rec.decode[0] > rec.decode[1];
  const pal = rec.pal;
  const baseComps = rec.base === 'gray' ? 1 : rec.base === 'cmyk' ? 4 : 3;
  for (let y = 0; y < h; y++) {
    const ro = y * rowBytes;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (rec.cs === 'rgb') {
        const i = ro + x * 3;
        px[o] = data[i];
        px[o + 1] = data[i + 1];
        px[o + 2] = data[i + 2];
      } else if (rec.cs === 'cmyk') {
        const i = ro + x * 4;
        const k = 255 - data[i + 3];
        px[o] = ((255 - data[i]) * k) / 255;
        px[o + 1] = ((255 - data[i + 1]) * k) / 255;
        px[o + 2] = ((255 - data[i + 2]) * k) / 255;
      } else {
        let v;
        if (bpc === 8) v = data[ro + x];
        else {
          const bit = x * bpc;
          v = (data[ro + (bit >> 3)] >> (8 - bpc - (bit & 7))) & max;
        }
        if (inverted) v = max - v;
        if (rec.cs === 'gray') {
          const g = bpc === 8 ? v : Math.round((v * 255) / max);
          px[o] = g;
          px[o + 1] = g;
          px[o + 2] = g;
        } else {
          const i = Math.min(v, rec.hival ?? 255) * baseComps;
          if (baseComps === 1) {
            px[o] = pal[i];
            px[o + 1] = pal[i];
            px[o + 2] = pal[i];
          } else if (baseComps === 4) {
            const k = 255 - pal[i + 3];
            px[o] = ((255 - pal[i]) * k) / 255;
            px[o + 1] = ((255 - pal[i + 1]) * k) / 255;
            px[o + 2] = ((255 - pal[i + 2]) * k) / 255;
          } else {
            px[o] = pal[i];
            px[o + 1] = pal[i + 1];
            px[o + 2] = pal[i + 2];
          }
        }
      }
      px[o + 3] = 255;
    }
  }
  return out;
}

const bitmaps = new Map(); // page -> Promise<ImageBitmap | ImageData | null>

async function decodePage(n) {
  const rec = await pageStore.get(n);
  if (!rec) return null;
  if (rec.kind === 'jpeg') return createImageBitmap(rec.data);
  const comps = rec.cs === 'rgb' ? 3 : rec.cs === 'cmyk' ? 4 : 1;
  const need = Math.ceil((rec.w * comps * rec.bpc) / 8) * rec.h;
  let data = rec.flate ? await inflate(rec.data, need) : new Uint8Array(await rec.data.arrayBuffer());
  if (rec.pred) data = unpredict(data, rec.pred, rec.w, comps, rec.bpc);
  if (data.length < need) {
    const full = new Uint8Array(need);
    full.fill(rec.cs === 'idx' ? 0 : 255);
    full.set(data);
    data = full;
  }
  const img = toImageData(rec, data);
  try {
    return await createImageBitmap(img);
  } catch {
    return img; // drawn with putImageData instead
  }
}

/** The picture of page n (cached for the pages around the one being read). */
export function pagePicture(n) {
  if (!bitmaps.has(n)) {
    bitmaps.set(n, decodePage(n).catch((err) => {
      console.warn(`Page ${n} of the mushaf couldn't be read`, err);
      bitmaps.delete(n);
      return null;
    }));
    while (bitmaps.size > 7) {
      const oldest = bitmaps.keys().next().value;
      const p = bitmaps.get(oldest);
      bitmaps.delete(oldest);
      p.then((b) => b?.close?.()).catch(() => {});
    }
  } else {
    // keep it fresh in the cache order
    const p = bitmaps.get(n);
    bitmaps.delete(n);
    bitmaps.set(n, p);
  }
  return bitmaps.get(n);
}

export function drawPicture(canvas, pic) {
  const w = pic.width;
  const h = pic.height;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (pic instanceof ImageData) ctx.putImageData(pic, 0, 0);
  else {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(pic, 0, 0);
  }
}

// ---------------------------------------------------------------- the page index
// Built from Quran_13_lines_with_tajweed_color.pdf (851 pages; the Quran runs from page 4 to page 850).
let index = null;
let indexPromise = null;
const keyPage = new Map();

export async function loadIndex() {
  if (index) return index;
  indexPromise ||= fetch('./mushaf13.json').then((r) => {
    if (!r.ok) throw new Error(`Index not found (${r.status})`);
    return r.json();
  }).then((d) => {
    index = d;
    // the page where each ayah starts
    const mark = (k, p) => { if (!keyPage.has(k)) keyPage.set(k, p); };
    for (let p = d.first; p <= d.last; p++) {
      const pg = d.p[p];
      if (!pg) continue;
      if (pg.c) mark(`${pg.c[0]}:${pg.c[1]}`, p);
      const lastMark = pg.e.filter((e) => e[0] === 'm').pop();
      for (const e of pg.e) {
        if (e[0] === 'end') break;
        if (e[0] === 'm') {
          mark(`${e[4]}:${e[5]}`, p);
          // the next ayah starts here, unless this marker ends the page ("x")
          if (!(pg.x && e === lastMark)) mark(`${e[4]}:${e[5] + 1}`, p);
        } else if (e[0] === 'b') {
          mark(`${e[2]}:1`, p);
          if (e[2] === 1) mark('1:2', p);
        } else if (e[0] === 'h' && e[2] === 9) mark('9:1', p);
      }
    }
    return d;
  }).catch((err) => {
    indexPromise = null;
    throw err;
  });
  return indexPromise;
}

/** Does the imported PDF match the bundled index (same pages, same picture sizes)? */
export function indexMatches(info) {
  if (!index || !info) return false;
  return info.count === index.pages && Array.isArray(info.dims) && info.dims.includes(`${index.img[0]}x${index.img[1]}`)
    && info.fingerprint === `${index.pages}:${index.img[0]}x${index.img[1]},${index.img[0]}x${index.img[1]},${index.img[0]}x${index.img[1]}`;
}

export const pageCount = (info) => info?.count || 0;
export const quranPages = () => (index ? [index.first, index.last] : null);

/** The first page an ayah appears on. */
export const pageOfKey = (key) => keyPage.get(key) || null;

export const juzStarts = () => index?.juz || [];

/** The juz a page belongs to (by the juz-start lines of this mushaf). */
export function juzOfPage(p) {
  let j = 0;
  for (const r of index?.juz || []) if (r.p <= p) j = r.j;
  return j;
}

/**
 * The ayahs on page p and where they sit, in picture pixels:
 * [{ key, s, a, segs: [{ x, y, w, h }] }], plus surah header and basmala boxes.
 */
export function layoutPage(p) {
  const pg = index?.p?.[p];
  if (!pg) return { ayahs: [], headers: [], basmalas: [] };
  const sp = index.special?.[p];
  const bands = sp?.bands || index.bands;
  const [fl, fr] = sp?.frame || index.frame;
  const nb = bands.length - 1;
  const band = (b) => ({ y: bands[b], h: bands[b + 1] - bands[b] });
  const ayahs = [];
  const headers = [];
  const basmalas = [];
  const segsBetween = (b0, xStart, b1, xEnd) => {
    const out = [];
    const add = (b, x0, x1) => {
      if (x1 - x0 < 4) return;
      const { y, h } = band(b);
      out.push({ x: x0, y, w: x1 - x0, h });
    };
    if (b0 === b1) add(b0, xEnd, xStart);
    else {
      add(b0, fl, xStart);
      for (let b = b0 + 1; b < b1; b++) add(b, fl, fr);
      add(b1, xEnd, fr);
    }
    return out;
  };
  let cur = pg.c ? { s: pg.c[0], a: pg.c[1], b: 0, x: fr } : null;
  let ended = false;
  for (const e of pg.e) {
    if (e[0] === 'end') {
      ended = true;
      break;
    }
    if (e[0] === 'h') {
      cur = null;
      const { y, h } = band(e[1]);
      headers.push({ s: e[2], x: fl, y, w: fr - fl, h });
      if (e[2] === 9) cur = { s: 9, a: 1, b: e[1] + 1, x: fr };
      continue;
    }
    if (e[0] === 'b') {
      const { y, h } = band(e[1]);
      if (e[2] === 1) {
        ayahs.push({ key: '1:1', s: 1, a: 1, segs: [{ x: fl, y, w: fr - fl, h }] });
        cur = { s: 1, a: 2, b: e[1] + 1, x: fr };
      } else {
        basmalas.push({ s: e[2], x: fl, y, w: fr - fl, h });
        cur = { s: e[2], a: 1, b: e[1] + 1, x: fr };
      }
      continue;
    }
    if (e[0] === 'm') {
      const [, b, x0, , s, a, lineEnd] = e;
      const from = cur && cur.s === s && cur.a === a ? cur : { s, a, b: 0, x: fr };
      ayahs.push({ key: `${s}:${a}`, s, a, segs: segsBetween(from.b, from.x, b, x0) });
      // a marker that ends its line: the next ayah starts at the beginning of the next line
      cur = lineEnd ? { s, a: a + 1, b: b + 1, x: fr } : { s, a: a + 1, b, x: x0 };
    }
  }
  // an ayah that carries on to the next page (unless the last line ends with a marker: "x")
  if (!ended && !pg.x && cur && cur.b < nb && index.p[p + 1]?.c && index.p[p + 1].c[0] === cur.s && index.p[p + 1].c[1] === cur.a) {
    const segs = segsBetween(cur.b, cur.x, nb - 1, fl);
    if (segs.length) ayahs.push({ key: `${cur.s}:${cur.a}`, s: cur.s, a: cur.a, segs });
  }
  return { ayahs, headers, basmalas };
}

export const indexInfo = () => index;
