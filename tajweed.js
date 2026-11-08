// tajweed.js: the tajweed rules (names, colours, short explanations), the parser for the
// AlQuran Cloud "quran-tajweed" markup, and a fix that keeps coloured Arabic letters joined in Safari.

/** One entry per rule letter used in the markup, e.g. [q[ق] is qalqalah. */
export const RULES = [
  { id: 'h', name: 'Hamzat al-wasl', ar: 'همزة الوصل', about: 'Not pronounced when joined to the word before.' },
  { id: 'l', name: 'Lam shamsiyyah', ar: 'لام شمسية', about: 'A silent lam before a sun letter.' },
  { id: 's', name: 'Silent letter', ar: 'حرف لا ي\u064Fنطق به', about: 'Written but not pronounced.' },
  { id: 'n', name: 'Natural madd', ar: 'مد طبيعي', about: 'Stretch for 2 counts.' },
  { id: 'p', name: 'Permissible madd', ar: 'مد جائز', about: 'Stretch for 2, 4 or 6 counts.' },
  { id: 'o', name: 'Obligatory madd', ar: 'مد واجب متصل', about: 'Stretch for 4 or 5 counts.' },
  { id: 'm', name: 'Necessary madd', ar: 'مد لازم', about: 'Stretch for 6 counts.' },
  { id: 'q', name: 'Qalqalah', ar: 'قلقلة', about: 'A light echo on ق ط ب ج د when they carry a sukun.' },
  { id: 'g', name: 'Ghunnah', ar: 'غنة', about: 'A nasal sound on ن\u0651 and م\u0651 for 2 counts.' },
  { id: 'f', name: 'Ikhfa', ar: 'إخفاء', about: 'Noon sakinah or tanween is hidden, with ghunnah.' },
  { id: 'i', name: 'Iqlab', ar: 'إقلاب', about: 'Noon sakinah or tanween turns into a meem before ب.' },
  { id: 'a', name: 'Idgham with ghunnah', ar: 'إدغام بغنة', about: 'Noon sakinah or tanween merges into ي ن م و, with ghunnah.' },
  { id: 'u', name: 'Idgham without ghunnah', ar: 'إدغام بلا غنة', about: 'Noon sakinah or tanween merges into ل or ر.' },
  { id: 'c', name: 'Ikhfa shafawi', ar: 'إخفاء شفوي', about: 'Meem sakinah is hidden before ب.' },
  { id: 'w', name: 'Idgham shafawi', ar: 'إدغام شفوي', about: 'Meem sakinah merges into the next meem.' },
  { id: 'd', name: 'Idgham mutajanisayn', ar: 'إدغام متجانسين', about: 'Two letters from the same point of articulation merge.' },
  { id: 'b', name: 'Idgham mutaqaribayn', ar: 'إدغام متقاربين', about: 'Two letters from close points of articulation merge.' },
];
export const RULE_IDS = new Set(RULES.map((r) => r.id));

const MARKUP = /\[([a-z])(?::\d+)?\[([^\]]*)\]/g;

/** "ب\u0650س\u0652م\u0650 [h:1[ٱ]لل\u064E\u0651ه\u0650" becomes [{t:'ب\u0650س\u0652م\u0650 '}, {t:'ٱ', r:'h'}, {t:'لل\u064E\u0651ه\u0650'}] */
export function parseTajweed(text) {
  const out = [];
  let last = 0;
  MARKUP.lastIndex = 0;
  for (let m = MARKUP.exec(text); m; m = MARKUP.exec(text)) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    if (m[2]) out.push(RULE_IDS.has(m[1]) ? { t: m[2], r: m[1] } : { t: m[2] });
    last = MARKUP.lastIndex;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  // Any stray bracket means the markup changed format: show the plain letters rather than brackets.
  for (const s of out) if (!s.r) s.t = s.t.replace(/\[[a-z](?::\d+)?\[|\]/g, '');
  return out.filter((s) => s.t);
}

// ------------------------------------------------------------ keeping letters joined in Safari
// Safari (and every browser on iPhone and iPad) stops joining Arabic letters where the colour changes
// (WebKit bug 6148). A zero-width joiner on each side of the change makes the letters keep their joined shapes.

const MARK = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08D3-\u08FF]/;
const RIGHT_JOINING = new Set([...'آأؤإاةدذرزوٱٲٳٵٶٷڈډڊڋڌڍڎڏڐڑڒړڔڕږڗژڙۀۃۄۅۆۇۈۉۊۋۍۏےۓەۮۯ']);
const ZWJ = '\u200D';

export const isMark = (ch) => !!ch && MARK.test(ch);

function joining(ch) {
  if (!ch) return 'U';
  const c = ch.codePointAt(0);
  if (c === 0x200D || c === 0x0640) return 'C';
  if (MARK.test(ch)) return 'T';
  if (RIGHT_JOINING.has(ch)) return 'R';
  if (c === 0x0621 || c === 0x0674 || c === 0x06E5 || c === 0x06E6) return 'U';
  if ((c >= 0x0620 && c <= 0x064A) || (c >= 0x066E && c <= 0x06D3) || (c >= 0x06FA && c <= 0x06FF)) return 'D';
  return 'U';
}

/** Rearrange the coloured pieces of ONE word so Safari draws them joined. */
export function fixJoins(segs) {
  const out = segs.map((s) => ({ ...s }));
  for (let i = 1; i < out.length; i++) {
    const t = out[i].t;
    let j = 0;
    while (j < t.length && MARK.test(t[j])) j++;
    if (!j) continue;
    if (j === t.length) {
      // A piece made only of marks (for example a coloured dagger alif): bring its letter along, so the mark stays on it.
      const left = out[i - 1].t;
      let k = left.length - 1;
      while (k >= 0 && MARK.test(left[k])) k--;
      if (k >= 0) {
        out[i].t = left.slice(k) + t;
        out[i - 1].t = left.slice(0, k);
      }
    } else {
      // Marks at the start belong to the letter before: keep them with it.
      out[i - 1].t += t.slice(0, j);
      out[i].t = t.slice(j);
    }
  }
  const list = out.filter((s) => s.t);
  for (let i = 1; i < list.length; i++) {
    const left = list[i - 1].t;
    const right = list[i].t;
    let k = left.length - 1;
    while (k >= 0 && MARK.test(left[k])) k--;
    const a = joining(left[k]);
    const b = joining(right[0]);
    if ((a === 'D' || a === 'C') && (b === 'D' || b === 'R' || b === 'C')) {
      if (!left.endsWith(ZWJ)) list[i - 1].t = left + ZWJ;
      if (!right.startsWith(ZWJ)) list[i].t = ZWJ + right;
    }
  }
  return list;
}

/** True for Safari and for all browsers on iPhone and iPad (they all use WebKit). */
export function needsJoinFix() {
  try {
    if (localStorage.getItem('halaqa:forceJoinFix') === '1') return true;
  } catch {
    /* storage blocked */
  }
  const ua = navigator.userAgent || '';
  if (/iP(hone|ad|od)/.test(ua)) return true;
  if (/AppleWebKit/.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Android|Firefox|FxiOS)/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
