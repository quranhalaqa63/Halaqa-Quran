// app.js: Halaqa, a Quran classroom.
// Connects the Mushaf page, the teaching tools, the students and their notebooks.

import {
  $, $$, h, iconEl, hydrateIcons, toast, openDialog, closeDialog, wireDialogs, confirmBox,
  toArabicDigits, clamp, debounce, uid, todayISO, fmtDate, downloadText, pickFile, copyText, isTyping,
} from './ui.js';
import { kv, requestPersistence, eraseEverything, canStorePictures } from './db.js';
import * as mushaf from './mushaf.js';
import * as api from './api.js';
import { InkBoard, LaserFx } from './ink.js';
import { FancyCursor } from './cursor.js';
import { Player } from './player.js';
import { RULES as TJ_RULES, fixJoins, needsJoinFix } from './tajweed.js';

// ---------------------------------------------------------------- constants
const APP = { id: 'halaqa', name: 'Halaqa', version: '1.2.0' };
const PAGE_W = 680; // must match .page width in styles.css
const TOTAL = api.TOTAL_PAGES;

const HL = [
  { id: 'y', color: '#F5C842', name: "Today's lesson" },
  { id: 'g', color: '#62BF84', name: 'Memorized' },
  { id: 'b', color: '#73A2F2', name: 'Revision' },
  { id: 'r', color: '#F27D92', name: 'Needs practice' },
  { id: 'p', color: '#B990F2', name: 'Note' },
];
const PEN_COLORS = [
  { c: '#C2362B', n: 'Red' }, { c: '#1F3FA8', n: 'Blue' }, { c: '#000000', n: 'Black' },
  { c: '#1E7A52', n: 'Green' }, { c: '#D9822B', n: 'Orange' }, { c: '#7A3FC0', n: 'Purple' }, { c: '#FFFFFF', n: 'White' },
];
const PEN_SIZES = [2, 3.5, 6, 10];
const HL_SIZES = [14, 22, 32, 46];
const ERASER_SIZES = [14, 26, 44, 72];
const SIZE_NAMES = ['Fine', 'Medium', 'Thick', 'Extra thick'];
const MISTAKES = [
  { id: 'hifz', name: 'Memory slip', color: '#C2362B' },
  { id: 'tajweed', name: 'Tajweed', color: '#D98A1C' },
  { id: 'makhraj', name: 'Pronunciation', color: '#7A4FC4' },
];
const AVATARS = ['📖', '🌙', '⭐', '🌿', '🕌', '🌸', '🦋', '🐪', '🌟', '🍀', '☀\uFE0F', '🕊\uFE0F'];
const COLORS = ['#3A5BB8', '#2E7D5B', '#C2362B', '#D98A1C', '#7A4FC4', '#0E8A9A', '#B5487A', '#6B5B33'];
const BOOKMARK_COLORS = [
  { id: 'gold', c: '#C9A13B', n: 'Gold' }, { id: 'red', c: '#C2362B', n: 'Red' }, { id: 'green', c: '#2E7D5B', n: 'Green' },
  { id: 'blue', c: '#3A5BB8', n: 'Blue' }, { id: 'purple', c: '#7A4FC4', n: 'Purple' },
];
// Where each juz starts in the 604-page Madani mushaf (used if the page table can't be downloaded).
const JUZ_FALLBACK = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
const GRADES = ['', 'Needs to repeat', 'Needs work', 'Good', 'Very good', 'Excellent'];
// The colour key printed in the 13-line colour-coded tajweed mushaf (colours measured from its key page).
const MUSHAF_KEY = [
  { name: 'Ikhfa', ar: 'اخفاء', c: '#0099CC', about: 'Noon saakin or tanween before ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك: a light nasal sound.' },
  { name: 'Ghunna', ar: 'غنہ', c: '#F78322', about: 'The nasal sound on ن\u0651 and م\u0651.' },
  { name: 'Ikhfa meem saakin', ar: 'اخفاء میم ساکن', c: '#FF0099', about: 'Meem saakin before ب: a light sound in the nose.' },
  { name: 'Idghaam', ar: 'ادغام', c: '#007E39', about: 'Noon saakin or tanween before ي ن م و: merged, with ghunna.' },
  { name: 'Qalqala', ar: 'قلقلہ', c: '#EF171F', about: 'ق ط ب ج د with a sukoon, or when stopping on them: an echoing sound.' },
  { name: 'Qalb', ar: 'اقلاب', c: '#333399', about: 'Noon saakin or tanween before ب: read as meem, with ghunna.' },
  { name: 'Idghaam meem saakin', ar: 'ادغام میم ساکن', c: '#99CC33', about: 'Meem saakin before another meem: merged, with ghunna.' },
];
const LESSON_TYPES = { new: 'New lesson', revision: 'Revision', test: 'Test' };
const TOOLS = ['pointer', 'laser', 'pen', 'highlighter', 'eraser', 'mistake'];
const TOOLS_WITH_OPTIONS = new Set(['pen', 'highlighter', 'eraser', 'mistake']);
const FALLBACK_RECITERS = [
  { id: 'ar.alafasy', name: 'Alafasy' }, { id: 'ar.husary', name: 'Husary' }, { id: 'ar.minshawi', name: 'Minshawi' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit (Murattal)' }, { id: 'ar.abdurrahmaansudais', name: 'Abdurrahmaan As-Sudais' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly' },
];
const NO_TRANSLATION = { id: '', name: 'None' };
const FALLBACK_TRANSLATIONS = [
  { id: 'en.sahih', name: 'English: Saheeh International' }, { id: 'en.pickthall', name: 'English: Pickthall' },
  { id: 'en.yusufali', name: 'English: Yusuf Ali' }, { id: 'ur.jalandhry', name: 'Urdu: Jalandhry' },
];

const DEFAULTS = {
  theme: 'lapis',
  cursor: 'noor',
  reciter: 'ar.alafasy',
  reciterName: 'Alafasy',
  translation: 'en.sahih',
  translationName: 'Saheeh International',
  translation2: 'ur.jalandhry', // shown under the first one; '' for none
  translation2Name: 'Jalandhry',
  fingerDraw: true,
  penSeen: false,
  follow: true,
  repeatEach: 1,
  loop: false,
  keepGoing: true,
  rate: 1,
  pen: { color: '#C2362B', size: 3.5 },
  highlighter: { color: '#F5C842', size: 22 },
  eraser: { size: 26, mode: 'precise' },
  mistake: 'hifz',
  showOptions: true,
  zoom: 1,
  fit: 'width',
  page: 1,
  activeStudent: null,
  hlNames: {},
  seenWelcome: false,
  script: 'uthmani', // 'uthmani' or 'indopak'
  tajweed: false, // tajweed colours (Uthmani script)
  tjHidden: [], // tajweed rules whose colour is switched off
  ruled: true, // lines between the lines of text
  railLabels: true, // tool panel shows names next to the icons
  mushafPage: 4, // last page read in the imported mushaf
  seenVariantTip: false,
};

// ---------------------------------------------------------------- state
let settings = null;
let students = [];
let student = null;
let sMeta = null; // the open student's notebook
let meta = null; // surah list and page tables
let board;
let cursor;
let laser;
let player;
let panelTab = 'student';
let searchToken = 0;
let zoomTimer = 0;
let fontsOk = false;
let navToken = 0;

const S = {
  page: 0,
  ayahs: [],
  ink: { strokes: [] },
  scale: 1,
  tool: 'pointer',
  selection: [],
  anchor: null,
  extend: false,
  hide: 'off',
  revealed: new Set(),
  playingKey: null,
  juzPages: JUZ_FALLBACK.slice(),
  swallowClick: false,
  variant: 'uthmani', // what the page shows now: 'uthmani', 'tajweed', 'indopak' or 'mushaf' (imported pages)
};

// The mushaf imported from a PDF: info about the stored pages, and whether the bundled ayah index fits them.
const M = { info: null, ready: false, indexed: false };

const els = {};
const surahFallback = new Map();
const metaCache = new Map();
const inkCache = new Map();
const histories = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const joinFix = needsJoinFix();
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

// ---------------------------------------------------------------- small helpers
const parseKey = (k) => {
  const [s, a] = String(k).split(':').map(Number);
  return { s, a };
};
const cmpKey = (x, y) => {
  const a = parseKey(x);
  const b = parseKey(y);
  return a.s - b.s || a.a - b.a;
};
const sortKeys = (keys) => [...new Set(keys)].sort(cmpKey);
const surahInfo = (s) => meta?.surahs?.[s - 1] || surahFallback.get(s) || null;
const surahName = (s) => surahInfo(s)?.englishName || `Surah ${s}`;
const refLabel = (key) => {
  const { s, a } = parseKey(key);
  return `${surahName(s)} ${s}:${a}`;
};
const hlName = (id) => settings.hlNames?.[id] || HL.find((x) => x.id === id)?.name || '';
const isMushafView = () => S.variant === 'mushaf';
/** Number of pages in a view: 604 for the text views, the PDF's pages for the imported mushaf. */
const pagesIn = (variant = S.variant) => (variant === 'mushaf' ? M.info?.count || 1 : TOTAL);
/** Notes and memorized pages are kept per page; imported-mushaf pages get their own keys. */
const pageTag = (p = S.page, variant = S.variant) => (variant === 'mushaf' ? `m${p}` : String(p));
const tagInView = (k) => (isMushafView() ? String(k).startsWith('m') : !String(k).startsWith('m'));
/** The Quran pages of the current view, for "pages memorized" and the juz grid. */
function quranPagesIn() {
  if (!isMushafView()) return { first: 1, last: TOTAL, juz: S.juzPages };
  const qp = M.indexed ? mushaf.quranPages() : null;
  const first = qp ? qp[0] : 1;
  const last = qp ? qp[1] : pagesIn();
  const juz = M.indexed ? mushaf.juzStarts().map((r) => r.p) : null;
  return { first, last, juz };
}
/** The ayah that stands for the page in view: the selection, else the first ayah that starts on the page. */
function anchorKey() {
  if (S.selection.length) return S.selection[0];
  const first = S.ayahs[0];
  if (first && isMushafView() && M.indexed && S.ayahs.length > 1 && (mushaf.pageOfKey(first.key) || S.page) < S.page) return S.ayahs[1].key;
  return first?.key || null;
}

/** The page an ayah is on, in the given view (async for the text views, which may need the page table). */
async function pageForKey(key, variant = wantedVariant()) {
  const { s, a } = parseKey(key);
  if (variant === 'mushaf') {
    if (!M.indexed) return null;
    await mushaf.loadIndex();
    return mushaf.pageOfKey(`${s}:${a}`);
  }
  return api.pageOf(meta, s, a);
}
const mistakeInfo = (id = settings.mistake) => MISTAKES.find((m) => m.id === id) || MISTAKES[0];
const sameColor = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
const sec = (title, action, ...content) => h('section', { class: 'sec' },
  h('div', { class: 'sec__head' }, h('h3', { class: 'sec__title' }, title), action), ...content);

function arabicSurahName(s) {
  const name = surahInfo(s)?.name || '';
  const words = name.trim().split(/\s+/);
  return words.length > 1 && api.plainArabic(words[0]) === 'سورة' ? words.slice(1).join(' ') : name;
}

let langNames = null;
function langName(code) {
  try {
    langNames ||= new Intl.DisplayNames(['en'], { type: 'language' });
    return langNames.of(code) || code;
  } catch {
    return code;
  }
}

function avatarEl(st, size = '') {
  return h('span', { class: `avatar${size ? ` avatar--${size}` : ''}`, style: { '--av': st.color || COLORS[0] }, 'aria-hidden': 'true' }, st.emoji || '📖');
}

function rangeLabel(from, to) {
  const a = parseKey(from);
  const b = parseKey(to);
  if (a.s === b.s) return a.a === b.a ? `${surahName(a.s)} ${a.s}:${a.a}` : `${surahName(a.s)} ${a.s}:${a.a}–${b.a}`;
  return `${surahName(a.s)} ${a.s}:${a.a} to ${surahName(b.s)} ${b.s}:${b.a}`;
}

// ---------------------------------------------------------------- saving
const pending = new Map();
let saveTimer = 0;
let saveErrorShown = false;

function queueSave(key, value) {
  pending.set(key, value);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSaves, 450);
}

async function flushSaves() {
  clearTimeout(saveTimer);
  if (!pending.size) return;
  const items = [...pending];
  pending.clear();
  for (const [k, v] of items) {
    try {
      if (v === undefined) await kv.del(k);
      else await kv.set(k, v);
    } catch (err) {
      console.error('Could not save', k, err);
      if (!saveErrorShown) {
        saveErrorShown = true;
        toast("Changes couldn't be saved on this device. Free up some storage, then try again.");
      }
    }
  }
}

const saveSettings = () => queueSave('settings', settings);
const saveStudents = () => queueSave('students', students);
const saveMeta = () => queueSave(`s:${student.id}`, sMeta);
// Each script view keeps its own drawings, because the words sit in different places.
const inkKey = (id, page, variant) => (variant === 'uthmani' ? `ink:${id}:${page}` : `ink:${id}:${page}:${variant === 'tajweed' ? 'tj' : 'ip'}`);
const saveInk = () => queueSave(inkKey(student.id, S.page, S.variant), S.ink.strokes.length ? { strokes: S.ink.strokes } : undefined);
const wantedVariant = () => (settings.script === 'mushaf' && M.ready ? 'mushaf'
  : settings.script === 'indopak' ? 'indopak' : settings.tajweed ? 'tajweed' : 'uthmani');

function mergeSettings(saved) {
  const s = JSON.parse(JSON.stringify(DEFAULTS));
  if (!saved || typeof saved !== 'object') return s;
  for (const [k, v] of Object.entries(saved)) {
    if (!(k in s)) continue;
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
      if (v && typeof v === 'object') Object.assign(s[k], v);
    } else if (s[k] === null || typeof v === typeof s[k]) s[k] = v;
  }
  return s;
}

const blankMeta = () => ({ lastPage: 1, bookmarks: [], lessons: [], memorized: {}, hl: {}, marks: {}, notes: {} });

async function loadMeta(id) {
  if (metaCache.has(id)) return metaCache.get(id);
  const saved = await kv.get(`s:${id}`).catch(() => null);
  const m = Object.assign(blankMeta(), saved && typeof saved === 'object' ? saved : {});
  metaCache.set(id, m);
  return m;
}

async function loadInk(id, page, variant = 'uthmani') {
  const key = inkKey(id, page, variant);
  if (inkCache.has(key)) return inkCache.get(key);
  const v = await kv.get(key).catch(() => null);
  const ink = { strokes: Array.isArray(v?.strokes) ? v.strokes : [] };
  inkCache.set(key, ink);
  return ink;
}

function newStudent(name, emoji, color) {
  return { id: uid(), name, emoji, color, created: Date.now(), lastPage: 1 };
}

async function loadStudents() {
  students = (await kv.get('students').catch(() => null)) || [];
  if (!Array.isArray(students)) students = [];
  students = students.filter((st) => st && st.id && st.name);
  if (!students.length) {
    students = [newStudent('My Mushaf', '📖', COLORS[0])];
    await kv.set('students', students).catch(() => {});
  }
  student = students.find((st) => st.id === settings.activeStudent) || students[0];
  settings.activeStudent = student.id;
  sMeta = await loadMeta(student.id);
}

// ---------------------------------------------------------------- undo / redo (per student, per page)
function hist() {
  const key = `${student.id}:${S.page}:${S.variant}`;
  if (!histories.has(key)) histories.set(key, { undo: [], redo: [] });
  return histories.get(key);
}

function commit(entry) {
  const hh = hist();
  hh.undo.push(entry);
  if (hh.undo.length > 200) hh.undo.shift();
  hh.redo.length = 0;
  updateUndoUI();
  return entry;
}

function undo() {
  const hh = hist();
  const e = hh.undo.pop();
  if (!e) return;
  e.undo();
  hh.redo.push(e);
  updateUndoUI();
}

function redo() {
  const hh = hist();
  const e = hh.redo.pop();
  if (!e) return;
  e.redo();
  hh.undo.push(e);
  updateUndoUI();
}

function updateUndoUI() {
  const hh = hist();
  els.btnUndo.disabled = !hh.undo.length;
  els.btnRedo.disabled = !hh.redo.length;
}

// ---------------------------------------------------------------- boot
async function boot() {
  for (const el of document.querySelectorAll('[id]')) els[el.id] = el;
  hydrateIcons();
  wireDialogs();

  settings = mergeSettings(await kv.get('settings').catch(() => null));
  applyTheme();

  cursor = new FancyCursor();
  cursor.setStyle(settings.cursor);
  laser = new LaserFx(els.fx);
  board = new InkBoard({ page: els.page, hlCanvas: els.cvHl, penCanvas: els.cvPen, input: els.inkInput, width: PAGE_W });
  board.laser = laser;
  board.fingerDraws = settings.fingerDraw;
  wireBoard();

  player = new Player({
    urlSync: (it) => api.audioUrlSync(settings.reciter, it.n),
    urlAsync: (it) => api.audioUrl(settings.reciter, it.n),
    nextItem: itemAfter,
    prevItem: itemBefore,
    describe: (it) => ({ title: refLabel(it.key), artist: settings.reciterName || settings.reciter, album: APP.name }),
    onChange: onPlayerChange,
    onError: () => toast("The recitation couldn't be played. Check your internet connection, or choose another reciter in Settings."),
  });
  applyPlayerSettings();

  await loadStudents();
  await refreshMushafState().catch(() => {});
  wireUI();
  setTool('pointer');
  renderStudentChip();
  updatePips();
  updateHideButton();
  applyRail();
  updateScriptUI();
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    for (const k of $$('.tbtn__key', els.toolbar)) k.textContent = k.textContent.replace('Ctrl ', '⌘');
  }
  els.aboutVersion.textContent = `Version ${APP.version}`;

  showPageState('loading', 'Opening the mushaf…');
  await loadMetaData();
  const start = await startPage();
  const ok = await goToPage(start.page, { select: start.select, flash: start.select, noAnim: true });
  // Someone opening a shared ayah link (often a student) goes straight to the ayah.
  if (ok && !settings.seenWelcome && !start.select) setTimeout(openWelcome, 350);

  requestPersistence();
  registerServiceWorker();
  api.audioTemplate(settings.reciter).catch(() => {});
  addEventListener('hashchange', onHashChange);
}

async function loadMetaData() {
  try {
    meta = await api.getMeta();
  } catch (err) {
    console.warn('The surah list is not available yet.', err);
    meta = null;
  }
  if (meta?.juzStarts && meta.pageStarts) S.juzPages = meta.juzStarts.map((r) => api.pageOfSync(meta, r.s, r.a) || 1);
}

async function startPage() {
  const route = parseRoute(location.hash);
  if (route?.mushaf && wantedVariant() === 'mushaf') return { page: clamp(route.mushaf, 1, pagesIn('mushaf')) };
  if (route?.page && wantedVariant() !== 'mushaf') return { page: route.page };
  if (wantedVariant() === 'mushaf') {
    if (route?.keys) {
      const p = await pageForKey(route.keys[0], 'mushaf').catch(() => null);
      if (p) return { page: p, select: route.keys };
    }
    return { page: clamp(sMeta.lastMushaf || settings.mushafPage || 4, 1, pagesIn('mushaf')) };
  }
  if (route?.page) return { page: route.page };
  if (route?.keys) {
    const { s, a } = parseKey(route.keys[0]);
    try {
      return { page: await api.pageOf(meta, s, a), select: route.keys };
    } catch {
      /* fall back to the last page */
    }
  }
  return { page: sMeta.lastPage || settings.page || 1 };
}

// Links: #/page/23, #/ayah/2:255, #/ayah/2:255-257
function parseRoute(hash) {
  const p = /^#\/page\/(\d{1,3})$/.exec(hash || '');
  if (p) return { page: clamp(+p[1], 1, TOTAL) };
  const mp = /^#\/mushaf\/(\d{1,4})$/.exec(hash || '');
  if (mp) return { mushaf: +mp[1] };
  const m = /^#\/ayah\/(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(hash || '');
  if (!m) return null;
  const s = +m[1];
  const a = +m[2];
  const b = m[3] ? Math.max(a, +m[3]) : a;
  if (s < 1 || s > 114 || a < 1) return null;
  const keys = [];
  for (let i = a; i <= b && keys.length < 300; i++) keys.push(`${s}:${i}`);
  return { keys };
}

function onHashChange() {
  const r = parseRoute(location.hash);
  if (!r) return;
  if (r.mushaf && isMushafView() && r.mushaf !== S.page) goToPage(r.mushaf);
  else if (r.page && !isMushafView() && r.page !== S.page) goToPage(r.page);
  else if (r.keys) openAyah(r.keys[0], r.keys);
}

function writeRoute(hash) {
  try {
    if (location.hash !== hash) history.replaceState(null, '', hash);
  } catch {
    /* some embedded previews don't allow this */
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.info('Offline mode is not available here:', err?.message));
}

// ---------------------------------------------------------------- theme
function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  const color = { lapis: '#111C42', day: '#FFFFFF', night: '#0C1330' }[settings.theme] || '#111C42';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

// ---------------------------------------------------------------- pages
const fontsLoaded = new Set();
async function fontsReady(variant) {
  const key = variant === 'indopak' ? 'indopak' : 'uthmani';
  if (fontsLoaded.has(key) || !document.fonts?.load) return;
  const loads = key === 'indopak'
    ? [document.fonts.load('30px "Lateef"', 'بسم الله'), document.fonts.load('30px "Scheherazade New"', 'بسم الله')]
    : [document.fonts.load('27px "Amiri Quran"', 'بسم الله'), document.fonts.load('700 20px "Amiri"', 'سورة')];
  try {
    await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* use fallback fonts */
  }
  fontsLoaded.add(key);
}

const VARIANT_NAMES = { uthmani: 'Uthmani', tajweed: 'Uthmani with tajweed colours', indopak: 'IndoPak', mushaf: 'your mushaf' };

/** A page of the imported mushaf: its picture, and (with the index) where each ayah sits. */
async function loadMushafView(n) {
  if (M.indexed) await mushaf.loadIndex();
  const pic = await mushaf.pagePicture(n);
  const lay = M.indexed ? mushaf.layoutPage(n) : { ayahs: [], headers: [], basmalas: [] };
  const juz = M.indexed ? mushaf.juzOfPage(n) : null;
  const ayahs = lay.ayahs.map((x) => ({
    key: x.key, s: x.s, a: x.a, n: api.globalAyah(meta, x.s, x.a), juz, page: n, surah: surahInfo(x.s), text: '', words: [], segs: x.segs,
  }));
  return { variant: 'mushaf', ayahs, pic, lay };
}

/** Load a page in the wanted script view. If an extra view can't be reached, fall back to the Uthmani page. */
async function loadView(n) {
  const want = wantedVariant();
  try {
    return { variant: want, ayahs: await api.getPageView(n, want) };
  } catch (err) {
    if (want === 'uthmani') throw err;
    console.warn(`The ${want} text is not available right now`, err);
    const ayahs = await api.getPage(n);
    toast(`The ${VARIANT_NAMES[want]} text couldn't be loaded, so this page is showing the Uthmani script. Check your internet connection.`, { duration: 6000 });
    return { variant: 'uthmani', ayahs };
  }
}

async function goToPage(n, { select = null, flash = null, noAnim = false, keepScroll = null } = {}) {
  const want = wantedVariant();
  n = clamp(Math.round(Number(n)) || 1, 1, pagesIn(want));
  const token = ++navToken;
  const dir = !noAnim && S.page && n !== S.page ? (n > S.page ? 'next' : 'prev') : null;
  flushSaves();
  const slow = setTimeout(() => { if (token === navToken) showPageState('loading', `Opening page ${n}…`); }, 200);

  let view;
  let ink;
  try {
    view = want === 'mushaf' ? await loadMushafView(n) : await loadView(n);
    ink = await loadInk(student.id, n, view.variant);
  } catch (err) {
    clearTimeout(slow);
    if (token !== navToken) return false;
    console.warn(err);
    const msg = want === 'mushaf'
      ? `Page ${n} of your mushaf couldn't be opened. If this keeps happening, add the PDF again in Settings, Your mushaf.`
      : navigator.onLine === false
        ? `You're offline, and page ${n} hasn't been opened on this device before. Connect to the internet and try again.`
        : `Page ${n} couldn't be loaded. Check your internet connection and try again.`;
    showPageState('error', msg, () => goToPage(n, { select, flash }));
    return false;
  }
  clearTimeout(slow);
  if (token !== navToken) return false;

  const { ayahs, variant } = view;
  for (const a of ayahs) if (a.surah && !surahFallback.has(a.s)) surahFallback.set(a.s, a.surah);
  S.page = n;
  S.ayahs = ayahs;
  S.ink = ink;
  S.variant = variant;
  S.selection = [];
  S.anchor = null;
  S.extend = false;
  S.revealed.clear();

  applyPageClasses();
  if (variant === 'mushaf') renderMushafPage(view, n);
  else renderPage(ayahs, n);
  board.setStrokes(ink.strokes);
  hidePageState();
  if (variant !== 'mushaf') await fontsReady(variant);
  if (token !== navToken) return false;

  layout({ force: true });
  applyAyahStates();
  applyWordStates();
  renderSelbar();
  updateNavUI();
  updateUndoUI();
  updateScriptUI();
  if (dir) animateTurn(dir);
  if (keepScroll != null) els.stage.scrollTop = keepScroll;
  else if (!select?.length) els.stage.scrollTo({ top: 0, left: 0 });

  if (variant === 'mushaf') {
    sMeta.lastMushaf = n;
    saveMeta();
    if (student.lastMushaf !== n) {
      student.lastMushaf = n;
      saveStudents();
    }
    settings.mushafPage = n;
    saveSettings();
    writeRoute(`#/mushaf/${n}`);
  } else {
    sMeta.lastPage = n;
    saveMeta();
    if (student.lastPage !== n) {
      student.lastPage = n;
      saveStudents();
    }
    settings.page = n;
    saveSettings();
    writeRoute(`#/page/${n}`);
  }

  if (select?.length) {
    setSelection(select, { anchor: select[0] });
    scrollToKey(select[0]);
  }
  if (flash?.length) flashKeys(flash);
  if (panelOpen()) renderPanel({ force: true });
  if (variant === 'mushaf') {
    if (n < pagesIn()) mushaf.pagePicture(n + 1);
    if (n > 1) mushaf.pagePicture(n - 1);
  } else {
    api.prefetchPage(n + 1, variant);
    api.prefetchPage(n - 1, variant);
  }
  return true;
}

/** Show the same page again in another script view (keeps the scroll position). */
function reloadView() {
  if (!S.page) return Promise.resolve(false);
  // keep the selected ayahs selected in the new view
  const keep = S.selection.length ? S.selection.slice() : null;
  return goToPage(S.page, { noAnim: true, keepScroll: els.stage.scrollTop, select: keep });
}

const nextPage = () => { if (S.page < pagesIn()) goToPage(S.page + 1); };
const prevPage = () => { if (S.page > 1) goToPage(S.page - 1); };

function animateTurn(dir) {
  if (reduceMotion.matches) return;
  const p = els.page;
  p.classList.remove('turn-next', 'turn-prev');
  void p.offsetWidth;
  p.classList.add(dir === 'next' ? 'turn-next' : 'turn-prev');
}

function showPageState(kind, msg, retry) {
  els.pageState.hidden = false;
  els.pageState.classList.toggle('is-error', kind === 'error');
  els.pageStateMsg.textContent = msg;
  els.pageStateRetry.hidden = !retry;
  els.pageStateRetry.onclick = retry
    ? async () => {
      showPageState('loading', 'Trying again…');
      if (!meta) await loadMetaData();
      retry();
    }
    : null;
}

function hidePageState() {
  els.pageState.hidden = true;
}

function applyPageClasses() {
  const p = els.page;
  const wasRuled = p.classList.contains('ruled');
  p.classList.toggle('script-indopak', S.variant === 'indopak');
  p.classList.toggle('tajweed-on', S.variant === 'tajweed');
  p.classList.toggle('is-mushaf', S.variant === 'mushaf');
  if (S.variant !== 'mushaf') p.style.removeProperty('height');
  p.classList.toggle('ruled', !!settings.ruled);
  for (const r of TJ_RULES) p.classList.toggle(`tjx-${r.id}`, settings.tjHidden.includes(r.id));
  if (settings.ruled && !wasRuled) drawRules();
}

/**
 * Draw a line under every line of text. The lines are measured from the words themselves,
 * so they stay between the lines whatever the font or script.
 */
function drawRules() {
  const host = els.rules;
  if (!host) return;
  if (!settings.ruled || !S.ayahs.length || isMushafView()) {
    host.replaceChildren();
    return;
  }
  const out = [];
  for (const block of els.pageBody.querySelectorAll('.ayat, .basmala')) {
    const boxes = [];
    for (const w of block.querySelectorAll('.w, .bw, .wm')) {
      if (w.offsetHeight) boxes.push({ top: w.offsetTop, bottom: w.offsetTop + w.offsetHeight });
    }
    if (!boxes.length) continue;
    const lh = parseFloat(getComputedStyle(block).lineHeight) || 58;
    boxes.sort((x, y) => (x.top + x.bottom) - (y.top + y.bottom));
    const lines = [];
    for (const b of boxes) {
      const mid = (b.top + b.bottom) / 2;
      const cur = lines[lines.length - 1];
      if (cur && Math.abs(mid - cur.mid) < lh * 0.45) {
        cur.top = Math.min(cur.top, b.top);
        cur.bottom = Math.max(cur.bottom, b.bottom);
      } else lines.push({ top: b.top, bottom: b.bottom, mid });
    }
    const left = block.offsetLeft;
    const width = block.offsetWidth;
    lines.forEach((ln, i) => {
      const next = lines[i + 1];
      const y = next ? (ln.bottom + next.top) / 2 : ln.bottom + Math.max(2, (lh - (ln.bottom - ln.top)) / 2);
      out.push(h('i', { class: 'rule', style: { top: `${y.toFixed(1)}px`, left: `${left}px`, width: `${width}px` } }));
    });
  }
  host.replaceChildren(...out);
}

const URDU_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toUrduDigits = (n) => String(n).replace(/\d/g, (d) => URDU_DIGITS[d]);

function renderPage(ayahs, n) {
  const frag = document.createDocumentFragment();
  const first = ayahs[0];
  frag.append(h('div', { class: 'run-head' },
    h('span', { class: 'run-head__surah' }, surahInfo(first.s)?.name || ''),
    h('span', { class: 'run-head__juz' }, first.juz ? `الجزء ${toArabicDigits(first.juz)}` : '')));

  let block = null;
  for (const a of ayahs) {
    if (a.a === 1) {
      frag.append(surahBanner(a.s));
      if (a.s !== 1 && a.s !== 9) frag.append(basmalaEl(a.basmala || api.tokenize(api.FALLBACK_BASMALA)));
      block = null;
    }
    if (!block) {
      block = h('div', { class: 'ayat' });
      frag.append(block);
    }
    block.append(ayahEl(a), ' ');
  }
  frag.append(h('div', { class: 'run-foot' }, h('span', { class: 'page-medal' }, toArabicDigits(n))));
  els.pageBody.replaceChildren(frag);
}

/** An imported mushaf page: the scanned picture, with see-through boxes over each ayah for tapping and highlighting. */
function renderMushafPage(view, n) {
  const pic = view.pic;
  const iw = pic?.width || 720;
  const ih = pic?.height || 1057;
  const k = PAGE_W / iw;
  els.page.style.height = `${Math.round(ih * k)}px`;
  const cv = els.mushafImg;
  if (pic) mushaf.drawPicture(cv, pic);
  else {
    cv.width = 1;
    cv.height = 1;
  }
  const frag = document.createDocumentFragment();
  const box = (r, cls) => h('i', { class: cls, style: { left: `${r.x * k}px`, top: `${r.y * k}px`, width: `${r.w * k}px`, height: `${r.h * k}px` } });
  for (const hd of view.lay.headers) {
    const el = box(hd, 'surah-banner m-head');
    el.dataset.s = String(hd.s);
    el.setAttribute('aria-hidden', 'true');
    frag.append(el);
  }
  for (const a of view.ayahs) {
    const el = h('div', { class: 'ayah m-ayah', dataset: { key: a.key } });
    el.setAttribute('aria-label', refLabel(a.key));
    for (const sg of a.segs) el.append(box(sg, 'm-seg'));
    frag.append(el);
  }
  if (!pic) {
    frag.append(h('div', { class: 'm-missing' }, h('p', null, `Page ${n} of your mushaf couldn't be shown. Add the PDF again in Settings, Your mushaf.`)));
  }
  els.pageBody.replaceChildren(frag);
}

function surahBanner(s) {
  const info = surahInfo(s);
  const kind = info?.revelationType === 'Medinan' ? 'مدنية' : info?.revelationType === 'Meccan' ? 'مكية' : '';
  return h('div', { class: 'surah-banner', dataset: { s: String(s) } },
    h('span', { class: 'surah-banner__side' }, kind),
    h('span', { class: 'surah-banner__name' }, info?.name || `سورة ${toArabicDigits(s)}`),
    h('span', { class: 'surah-banner__side' }, info?.numberOfAyahs ? `آياتها ${toArabicDigits(info.numberOfAyahs)}` : ''));
}

/** Put a word's letters into an element; tajweed pieces become coloured spans. */
function fillWord(el, segs) {
  const list = joinFix && segs.length > 1 && segs.some((x) => x.r) ? fixJoins(segs) : segs;
  for (const sg of list) {
    if (sg.r) el.append(h('span', { class: `tj tj-${sg.r}` }, sg.t));
    else el.append(sg.t);
  }
}

function basmalaEl(words) {
  const el = h('div', { class: 'basmala' });
  words.forEach((w, i) => {
    if (i) el.append(' ');
    const span = h('span', { class: 'bw' });
    fillWord(span, w.segs);
    el.append(span);
  });
  return el;
}

/** One ayah: every word is its own span so it can be pointed at, marked or hidden. */
function ayahEl(a) {
  const el = document.createElement('span');
  el.className = 'ayah';
  el.dataset.key = a.key;
  let wi = 0;
  let last = null;
  for (const word of a.words) {
    if (word.mark) {
      // pause marks belong to the word before them
      if (last) {
        last.append(' ');
        fillWord(last, word.segs);
      } else {
        const m = h('span', { class: 'wm' });
        fillWord(m, word.segs);
        el.append(m, ' ');
      }
      continue;
    }
    if (last) el.append(' ');
    last = document.createElement('span');
    last.className = 'w';
    last.dataset.w = String(wi++);
    fillWord(last, word.segs);
    el.append(last);
  }
  const end = document.createElement('span');
  end.className = 'ae';
  if (S.variant === 'indopak') {
    end.textContent = toUrduDigits(a.a);
    end.lang = 'ur';
  } else end.textContent = toArabicDigits(a.a);
  end.setAttribute('aria-label', `Ayah ${a.a}`);
  el.append(' ', end);
  return el;
}

// Mistakes are kept per word. IndoPak words are counted separately because the scripts can split words differently.
const wordKeyOf = (w) => `${w.parentElement.dataset.key}:${w.dataset.w}${S.variant === 'indopak' ? '@ip' : ''}`;
const wordText = (w) => w.textContent.replace(/\u200D/g, '').replace(/\s+[\u06D6-\u06ED\u0615-\u061A]+/g, '').trim();
const parseWordKey = (wk) => {
  const m = /^(\d+):(\d+):(\d+)(@ip)?$/.exec(wk);
  return m ? { s: +m[1], a: +m[2], w: +m[3], ip: !!m[4] } : null;
};

function applyAyahStates() {
  for (const el of els.pageBody.querySelectorAll('.ayah')) {
    const k = el.dataset.key;
    const hl = sMeta.hl[k];
    if (hl) el.dataset.hl = hl;
    else delete el.dataset.hl;
    el.classList.toggle('sel', S.selection.includes(k));
    el.classList.toggle('playing', S.playingKey === k);
  }
}

function applyWordStates() {
  if (isMushafView()) {
    // memory test on the mushaf pages works ayah by ayah
    for (const el of els.pageBody.querySelectorAll('.ayah')) {
      el.classList.toggle('veiled', S.hide !== 'off' && !S.revealed.has(el.dataset.key));
    }
    return;
  }
  for (const w of els.pageBody.querySelectorAll('.w')) {
    const wk = wordKeyOf(w);
    const m = sMeta.marks[wk];
    if (m) w.dataset.m = m.t;
    else delete w.dataset.m;
    const veiled = S.hide !== 'off' && !S.revealed.has(wk) && !(S.hide === 'first' && w.dataset.w === '0');
    w.classList.toggle('veiled', veiled);
  }
}

function updateNavUI() {
  const first = S.ayahs[0];
  const total = pagesIn();
  if (first) {
    els.surahEn.textContent = surahName(first.s);
    els.surahAr.textContent = arabicSurahName(first.s);
    els.juzLabel.textContent = first.juz ? `Juz ${first.juz}` : '';
  } else {
    // pages of an imported mushaf with no ayahs: the cover, colour key or closing dua
    const qp = quranPagesIn();
    els.surahEn.textContent = S.page < qp.first ? 'Opening pages' : 'Closing pages';
    els.surahAr.textContent = '';
    els.juzLabel.textContent = isMushafView() ? 'Your mushaf' : '';
  }
  els.pageNo.textContent = String(S.page);
  els.pagerOf.textContent = ` of ${total}`;
  els.btnNext.disabled = S.page >= total;
  els.turnNext.disabled = S.page >= total;
  els.btnPrev.disabled = S.page <= 1;
  els.turnPrev.disabled = S.page <= 1;
  const onPage = new Set(S.ayahs.map((a) => a.key));
  const marked = sMeta.bookmarks.some((b) => onPage.has(b.key) || (!b.key && !isMushafView() && b.page === S.page));
  els.btnBookmark.setAttribute('aria-pressed', String(marked));
  els.btnBookmark.setAttribute('aria-label', marked ? 'Bookmarks. This page is bookmarked' : 'Bookmarks');
  document.title = `${first ? surahName(first.s) : 'Mushaf'}, page ${S.page}: ${APP.name}`;
}

function scrollToKey(key, { soft = false } = {}) {
  const el = els.pageBody.querySelector(`.ayah[data-key="${key}"]`);
  // a mushaf ayah is a group of boxes: scroll to its first one
  if (el) scrollToEl(el.querySelector('.m-seg') || el, { soft });
}

function scrollToEl(el, { soft = false } = {}) {
  const r = el.getBoundingClientRect();
  const sr = els.stage.getBoundingClientRect();
  if (soft && r.top >= sr.top + 40 && r.bottom <= sr.bottom - 110) return;
  els.stage.scrollBy({ top: r.top - sr.top - sr.height * 0.28, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

function flashKeys(keys) {
  for (const k of keys) {
    const el = els.pageBody.querySelector(`.ayah[data-key="${k}"]`);
    if (!el) continue;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 3400);
  }
}

async function openAyah(key, keys = [key]) {
  let p;
  try {
    p = await pageForKey(key);
  } catch {
    p = null;
  }
  if (!p) {
    toast("That ayah couldn't be found. Check your internet connection.");
    return;
  }
  if (p !== S.page) {
    await goToPage(p, { select: keys, flash: keys });
  } else {
    if (S.tool !== 'pointer') setTool('pointer');
    setSelection(keys, { anchor: key });
    scrollToKey(key);
    flashKeys(keys);
  }
}

async function goToSurah(s) {
  closeDialog(els.dlgNav);
  let p;
  try {
    p = await pageForKey(`${s}:1`);
  } catch {
    p = null;
  }
  if (!p) {
    toast(isMushafView() && !M.indexed ? "Surahs can't be found in this mushaf. Go to a page number instead." : "That surah couldn't be opened. Check your internet connection.");
    return;
  }
  const ok = await goToPage(p);
  if (!ok) return;
  const el = els.pageBody.querySelector(`.surah-banner[data-s="${s}"]`);
  if (el) scrollToEl(el);
  flashKeys([`${s}:1`]);
}

async function goToJuz(j) {
  closeDialog(els.dlgNav);
  if (isMushafView()) {
    const r = M.indexed ? mushaf.juzStarts()[j - 1] : null;
    if (!r) {
      toast("Juz can't be found in this mushaf. Go to a page number instead.");
      return;
    }
    if (await goToPage(r.p)) {
      scrollToKey(r.k);
      flashKeys([r.k]);
    }
    return;
  }
  let p = S.juzPages[j - 1];
  if (!meta?.juzStarts) {
    try { p = await api.juzStartPage(meta, j); } catch { /* use the built-in table */ }
  }
  const ok = await goToPage(p);
  if (!ok || !meta?.juzStarts) return;
  const r = meta.juzStarts[j - 1];
  const key = `${r.s}:${r.a}`;
  if (S.ayahs.some((x) => x.key === key)) {
    scrollToKey(key);
    flashKeys([key]);
  }
}

// ---------------------------------------------------------------- layout and zoom
function layout({ final = true, force = false } = {}) {
  if (!S.page) return;
  const st = els.stage;
  const w = st.clientWidth;
  const pad = w < 600 ? 8 : 28;
  const H = els.page.offsetHeight;
  let fit = Math.min(Math.max(240, w - pad * 2) / PAGE_W, 1.32);
  if (settings.fit === 'page') fit = Math.min(fit, Math.max(240, st.clientHeight - 64) / H);
  const s = fit * settings.zoom;
  S.scale = s;
  els.page.style.transform = `scale(${s})`;
  els.page.style.setProperty('--inv', (1 / s).toFixed(3));
  els.sizer.style.width = `${Math.round(PAGE_W * s)}px`;
  els.sizer.style.height = `${Math.round(H * s)}px`;
  st.classList.toggle('is-wide', PAGE_W * s > w + 1);
  if (final || force) {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(0.5, Math.min(s * dpr, Math.sqrt(6e6 / (PAGE_W * H))));
    if (force || H !== board.H || Math.abs(k - board.k) > 0.02) board.resize(PAGE_W, H, k);
  }
  if (force) drawRules();
  const atFit = Math.abs(settings.zoom - 1) < 0.001;
  els.zoomLabel.textContent = atFit ? (settings.fit === 'page' ? 'Whole page' : 'Fit width') : `Zoom ${Math.round(settings.zoom * 100)}%`;
  els.zoomLabel.dataset.short = atFit ? (settings.fit === 'page' ? 'Page' : 'Fit') : `${Math.round(settings.zoom * 100)}%`;
  els.btnZoomFit.dataset.tip = atFit ? (settings.fit === 'page' ? 'Showing the whole page (0)' : 'Fitting the width (0)') : `Zoom ${Math.round(settings.zoom * 100)}%, back to fit (0)`;
  applyToolStyle();
}

function setZoom(z, anchor, { live = false } = {}) {
  z = clamp(z, 0.5, 3);
  const st = els.stage;
  const sr = st.getBoundingClientRect();
  const ax = anchor?.x ?? sr.left + st.clientWidth / 2;
  const ay = anchor?.y ?? sr.top + st.clientHeight / 2;
  const r0 = els.sizer.getBoundingClientRect();
  const vx = (ax - r0.left) / S.scale;
  const vy = (ay - r0.top) / S.scale;
  settings.zoom = Math.round(z * 1000) / 1000;
  layout({ final: !live });
  const r1 = els.sizer.getBoundingClientRect();
  st.scrollLeft += r1.left + vx * S.scale - ax;
  st.scrollTop += r1.top + vy * S.scale - ay;
  saveSettings();
  if (live) {
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => layout({ final: true }), 160);
  }
}

const zoomBy = (f) => setZoom(settings.zoom * f);

function zoomFit() {
  if (Math.abs(settings.zoom - 1) > 0.001) {
    setZoom(1);
    return;
  }
  settings.fit = settings.fit === 'page' ? 'width' : 'page';
  layout();
  saveSettings();
  toast(settings.fit === 'page' ? 'Showing the whole page.' : 'Fitting the page to the width of the screen.');
}

// ---------------------------------------------------------------- tools
function setTool(t) {
  if (!TOOLS.includes(t)) return;
  S.tool = t;
  els.app.dataset.tool = t;
  for (const b of $$('[data-tool]', els.toolbar)) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
  board.tool = t;
  if (t !== 'pointer' && S.selection.length) setSelection([]);
  applyToolStyle();
  renderToolOptions();
  renderSelbar();
}

function applyToolStyle() {
  board.style.pen = settings.pen;
  board.style.highlighter = settings.highlighter;
  board.style.eraser = settings.eraser;
  const t = S.tool;
  const conf = t === 'pen' ? settings.pen : t === 'highlighter' ? settings.highlighter : t === 'eraser' ? settings.eraser : null;
  cursor.setTool(t, {
    color: conf?.color || (t === 'mistake' ? mistakeInfo().color : '#C2362B'),
    size: conf ? conf.size * S.scale : 10,
  });
}

function updatePips() {
  els.pipPen.style.setProperty('--pip', settings.pen.color);
  els.pipHl.style.setProperty('--pip', settings.highlighter.color);
  els.pipMistake.style.setProperty('--pip', mistakeInfo().color);
}

function afterToolChange() {
  applyToolStyle();
  updatePips();
  renderToolOptions();
  saveSettings();
}

function sizeGroup(conf, sizes, dot) {
  const g = h('div', { class: 'opt-group', role: 'radiogroup', 'aria-label': 'Size' });
  sizes.forEach((sz, i) => g.append(h('button', {
    class: 'size-dot',
    type: 'button',
    role: 'radio',
    'aria-checked': String(conf.size === sz),
    'aria-label': SIZE_NAMES[i],
    title: SIZE_NAMES[i],
    style: { '--d': `${Math.round(dot(sz))}px` },
    onclick: () => { conf.size = sz; afterToolChange(); },
  })));
  return g;
}

function optChip(label, checked, onclick, extra = {}) {
  return h('button', { class: 'opt-chip', type: 'button', role: 'radio', 'aria-checked': String(checked), onclick, ...extra }, label);
}

function renderToolOptions() {
  const t = S.tool;
  const bar = els.toolOptions;
  if (!TOOLS_WITH_OPTIONS.has(t) || !settings.showOptions) {
    bar.hidden = true;
    return;
  }
  bar.replaceChildren();
  if (t === 'pen' || t === 'highlighter') {
    const conf = settings[t];
    const colors = t === 'pen' ? PEN_COLORS : HL.map((x) => ({ c: x.color, n: hlName(x.id) }));
    const g = h('div', { class: 'opt-group', role: 'radiogroup', 'aria-label': 'Colour' });
    for (const { c, n } of colors) {
      g.append(h('button', {
        class: 'swatch',
        type: 'button',
        role: 'radio',
        'aria-checked': String(sameColor(conf.color, c)),
        'aria-label': n,
        title: n,
        style: { '--sw': c },
        onclick: () => { conf.color = c; afterToolChange(); },
      }));
    }
    if (t === 'pen') {
      const input = h('input', { type: 'color', value: String(conf.color).toLowerCase(), 'aria-label': 'Choose any colour' });
      input.addEventListener('input', () => { conf.color = input.value; applyToolStyle(); updatePips(); saveSettings(); });
      input.addEventListener('change', afterToolChange);
      g.append(h('label', { class: 'swatch swatch--custom', title: 'Choose any colour' }, input));
    }
    const dot = t === 'pen' ? (sz) => 4 + sz * 1.3 : (sz) => 6 + sz * 0.38;
    bar.append(g, h('span', { class: 'opt-sep' }), sizeGroup(conf, t === 'pen' ? PEN_SIZES : HL_SIZES, dot));
  } else if (t === 'eraser') {
    const conf = settings.eraser;
    const modes = h('div', { class: 'opt-group', role: 'radiogroup', 'aria-label': 'How the eraser works' },
      optChip('Rub out', conf.mode === 'precise', () => { conf.mode = 'precise'; afterToolChange(); }, { title: 'Erase only where you rub' }),
      optChip('Whole stroke', conf.mode === 'stroke', () => { conf.mode = 'stroke'; afterToolChange(); }, { title: 'Touch a line to remove all of it' }));
    bar.append(modes, h('span', { class: 'opt-sep' }), sizeGroup(conf, ERASER_SIZES, (sz) => 6 + sz * 0.29),
      h('span', { class: 'opt-sep' }),
      h('button', { class: 'opt-chip', type: 'button', onclick: clearPage }, iconEl('trash'), 'Clear page'));
  } else if (t === 'mistake') {
    const g = h('div', { class: 'opt-group', role: 'radiogroup', 'aria-label': 'Kind of mistake' });
    for (const m of MISTAKES) {
      g.append(optChip([h('i'), m.name], settings.mistake === m.id, () => { settings.mistake = m.id; afterToolChange(); }, { style: { '--mc': m.color } }));
    }
    bar.append(g, h('span', { class: 'opt-hint' }, 'Tap a word to mark it. Tap it again to remove the mark.'));
  }
  bar.hidden = false;
}

function wireBoard() {
  board.onStroke = (s) => {
    const strokes = board.strokes;
    saveInk();
    commit({
      undo: () => {
        const i = strokes.indexOf(s);
        if (i >= 0) strokes.splice(i, 1);
        board.render();
        saveInk();
      },
      redo: () => {
        strokes.push(s);
        board.render();
        saveInk();
      },
    });
  };
  board.onErase = (removed) => {
    const strokes = board.strokes;
    saveInk();
    commit({
      undo: () => {
        for (let i = removed.length - 1; i >= 0; i--) strokes.splice(removed[i].index, 0, removed[i].stroke);
        board.render();
        saveInk();
      },
      redo: () => {
        for (const r of removed) {
          const i = strokes.indexOf(r.stroke);
          if (i >= 0) strokes.splice(i, 1);
        }
        board.render();
        saveInk();
      },
    });
  };
  board.onPan = (dx, dy) => els.stage.scrollBy(dx, dy);
  board.onPinch = (ratio, c) => setZoom(settings.zoom * ratio, c, { live: true });
  board.onGestureEnd = () => layout({ final: true });
  board.onPen = () => {
    if (settings.penSeen) return;
    settings.penSeen = true;
    if (settings.fingerDraw) {
      settings.fingerDraw = false;
      board.fingerDraws = false;
      toast('Stylus found. Your finger now scrolls the page and the pen draws. You can change this in Settings.', { duration: 6000 });
    }
    saveSettings();
  };
}

function clearPage() {
  const strokes = S.ink.strokes;
  if (!strokes.length) {
    toast('There are no drawings on this page.');
    return;
  }
  const removed = strokes.slice();
  const apply = (list) => {
    strokes.length = 0;
    strokes.push(...list);
    board.render();
    saveInk();
  };
  apply([]);
  const entry = commit({ undo: () => apply(removed), redo: () => apply([]) });
  toast('Drawings cleared from this page.', {
    actionLabel: 'Undo',
    onAction: () => { if (hist().undo.at(-1) === entry) undo(); },
  });
}

// ---------------------------------------------------------------- selection
function setSelection(keys, { anchor } = {}) {
  const onPage = new Set(S.ayahs.map((a) => a.key));
  S.selection = sortKeys(keys.filter((k) => onPage.has(k)));
  if (anchor !== undefined) S.anchor = onPage.has(anchor) ? anchor : S.selection[0] || null;
  if (!S.selection.length) {
    S.anchor = null;
    S.extend = false;
  }
  applyAyahStates();
  renderSelbar();
  markTranslationSelection();
}

function rangeKeys(a, b) {
  const keys = S.ayahs.map((x) => x.key);
  const i = keys.indexOf(a);
  const j = keys.indexOf(b);
  if (i < 0 || j < 0) return [b];
  return keys.slice(Math.min(i, j), Math.max(i, j) + 1);
}

function selectionLabel(keys) {
  if (!keys.length) return '';
  const a = parseKey(keys[0]);
  const b = parseKey(keys[keys.length - 1]);
  if (keys.length === 1) return `${surahName(a.s)} ${a.s}:${a.a}`;
  if (a.s === b.s) return `${surahName(a.s)} ${a.s}:${a.a}–${b.a}`;
  return `${keys.length} ayahs`;
}

function renderSelbar() {
  const keys = S.selection;
  if (!keys.length || S.tool !== 'pointer') {
    els.selbar.hidden = true;
    return;
  }
  els.selbar.hidden = false;
  els.selLabel.textContent = selectionLabel(keys);
  const first = sMeta.hl[keys[0]] || null;
  const common = keys.every((k) => (sMeta.hl[k] || null) === first) ? first : null;
  for (const b of $$('[data-hl]', els.selbar)) {
    const id = b.dataset.hl;
    b.setAttribute('aria-pressed', String(!!id && id === common));
    if (id) {
      b.setAttribute('aria-label', `Highlight: ${hlName(id)}`);
      b.dataset.tip = hlName(id);
    }
  }
  const ext = $('[data-act="extend"]', els.selbar);
  if (ext) ext.setAttribute('aria-pressed', String(S.extend));
}

function onPageClick(e) {
  if (S.swallowClick) {
    S.swallowClick = false;
    return;
  }
  if (S.tool === 'mistake') {
    onMistakeClick(e);
    return;
  }
  if (S.tool !== 'pointer') return;
  const w = e.target.closest('.w');
  const ay = e.target.closest('.ayah');
  if (ay && ay.classList.contains('veiled') && isMushafView()) {
    S.revealed.add(ay.dataset.key);
    applyWordStates();
    return;
  }
  if (w && w.classList.contains('veiled')) {
    revealWord(w);
    return;
  }
  if (!w && ay && S.hide !== 'off' && e.target.closest('.ae') && ay.querySelector('.w.veiled')) {
    revealAyah(ay);
    return;
  }
  if (!ay) {
    if (S.selection.length) setSelection([]);
    return;
  }
  const key = ay.dataset.key;
  if ((e.shiftKey || S.extend) && S.anchor) {
    S.extend = false;
    setSelection(rangeKeys(S.anchor, key));
  } else if (e.metaKey || e.ctrlKey) {
    setSelection(S.selection.includes(key) ? S.selection.filter((k) => k !== key) : [...S.selection, key], { anchor: key });
  } else if (S.selection.length === 1 && S.selection[0] === key) {
    setSelection([]);
  } else {
    setSelection([key], { anchor: key });
  }
}

function setHighlight(keys, id) {
  keys = keys.slice();
  if (!keys.length) return;
  const all = keys.every((k) => sMeta.hl[k] === id);
  const next = id && all ? null : id || null;
  const before = keys.map((k) => sMeta.hl[k] || null);
  const after = keys.map(() => next);
  const apply = (vals) => {
    keys.forEach((k, i) => {
      if (vals[i]) sMeta.hl[k] = vals[i];
      else delete sMeta.hl[k];
    });
    saveMeta();
    applyAyahStates();
    renderSelbar();
    refreshPanelSoon();
  };
  apply(after);
  commit({ undo: () => apply(before), redo: () => apply(after) });
}

/** Arabic text of ayahs (for copying): from the page in view, or from the Uthmani pages they are on. */
async function ayahTexts(keys) {
  const out = new Map();
  for (const k of keys) {
    const a = S.ayahs.find((x) => x.key === k);
    if (a?.text) out.set(k, a.text);
  }
  const missing = keys.filter((k) => !out.has(k));
  const pagesNeeded = new Set(missing.map((k) => { const { s, a } = parseKey(k); return api.pageOfSync(meta, s, a); }).filter(Boolean));
  for (const p of pagesNeeded) {
    try {
      for (const a of await api.getPage(p)) if (missing.includes(a.key)) out.set(a.key, a.text);
    } catch { /* offline */ }
  }
  return out;
}

async function copySelection() {
  const parts = [];
  const texts = await ayahTexts(S.selection);
  for (const k of S.selection) {
    const t = texts.get(k);
    if (t) parts.push(`${t} ﴿${toArabicDigits(parseKey(k).a)}﴾`);
  }
  if (!parts.length) return;
  const ok = await copyText(`${parts.join(' ')}\n${selectionLabel(S.selection)}`);
  toast(ok ? 'Ayah text copied.' : "Couldn't copy. Your browser blocked it.");
}

async function shareSelection() {
  const keys = S.selection;
  if (!keys.length) return;
  const a = parseKey(keys[0]);
  const b = parseKey(keys[keys.length - 1]);
  const hash = a.s === b.s && b.a !== a.a ? `#/ayah/${a.s}:${a.a}-${b.a}` : `#/ayah/${a.s}:${a.a}`;
  const url = `${location.origin}${location.pathname}${hash}`;
  const title = selectionLabel(keys);
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  toast((await copyText(url)) ? 'Link copied. Send it to your student.' : url, { duration: 6000 });
}

// ---------------------------------------------------------------- mistakes
function applyMark(wk, value) {
  if (value) sMeta.marks[wk] = value;
  else delete sMeta.marks[wk];
  saveMeta();
  applyWordStates();
  refreshPanelSoon();
}

function onMistakeClick(e) {
  if (isMushafView()) {
    toast('On your mushaf pages, circle mistakes with the pen. Word-by-word mistakes work in the Uthmani and IndoPak views.', { duration: 6000 });
    return;
  }
  const w = e.target.closest('.w');
  if (!w) return;
  const wk = wordKeyOf(w);
  if (w.classList.contains('veiled')) {
    S.revealed.add(wk);
    w.classList.remove('veiled');
  }
  const type = settings.mistake;
  const prev = sMeta.marks[wk] || null;
  const next = prev && prev.t === type ? null : { t: type, w: wordText(w), p: S.page, at: Date.now() };
  applyMark(wk, next);
  commit({ undo: () => applyMark(wk, prev), redo: () => applyMark(wk, next) });
}

function removeMark(wk) {
  const prev = sMeta.marks[wk];
  if (!prev) return;
  const m = sMeta;
  applyMark(wk, null);
  toast('Mark removed.', { actionLabel: 'Undo', onAction: () => { if (sMeta === m) applyMark(wk, prev); } });
}

async function openWord(wk, page) {
  const k = parseWordKey(wk);
  if (!k) return;
  const { s, a, w } = k;
  // A word marked on the IndoPak page opens in IndoPak, and the other way round.
  if (k.ip !== (S.variant === 'indopak')) {
    settings.script = k.ip ? 'indopak' : 'uthmani';
    saveSettings();
    updateScriptUI();
    if (!page || page === S.page) await reloadView();
  }
  if (page && page !== S.page) {
    const ok = await goToPage(page);
    if (!ok) return;
  } else if (!page) {
    await openAyah(`${s}:${a}`);
  }
  const el = els.pageBody.querySelector(`.ayah[data-key="${s}:${a}"] .w[data-w="${w}"]`);
  if (!el) return;
  scrollToEl(el, { soft: true });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 3000);
}

// ---------------------------------------------------------------- hide text (memory test)
function cycleHide() {
  // mushaf pages hide whole ayahs, so there is no "first word" step
  S.hide = isMushafView() ? (S.hide === 'off' ? 'all' : 'off') : { off: 'all', all: 'first', first: 'off' }[S.hide];
  S.revealed.clear();
  applyWordStates();
  updateHideButton();
  toast(isMushafView()
    ? { all: 'Ayahs hidden. Tap an ayah to show it, or press N for the next one.', off: 'All the ayahs are showing again.' }[S.hide]
    : {
      all: 'Text hidden. Tap a word to reveal it, or press N for the next word.',
      first: 'Showing only the first word of each ayah.',
      off: 'All the text is showing again.',
    }[S.hide]);
}

function updateHideButton() {
  const b = els.btnHide;
  b.setAttribute('aria-pressed', String(S.hide !== 'off'));
  b.dataset.tip = isMushafView()
    ? { off: 'Hide ayahs (T)', all: 'Show all ayahs (T)', first: 'Show all ayahs (T)' }[S.hide]
    : { off: 'Hide text (T)', all: 'Show first words only (T)', first: 'Show all text (T)' }[S.hide];
  els.btnHideLabel.textContent = b.dataset.tip.replace(/ \(T\)$/, '');
  els.btnHideLabel.dataset.short = S.hide === 'off' ? 'Hide' : 'Show';
  b.setAttribute('aria-label', b.dataset.tip.replace(/ \(T\)$/, ''));
  b.dataset.icon = S.hide === 'off' ? 'eyeOff' : 'eye';
  hydrateIcons(els.toolbar);
}

function revealWord(w) {
  S.revealed.add(wordKeyOf(w));
  w.classList.remove('veiled');
}

function revealAyah(ay) {
  for (const w of ay.querySelectorAll('.w')) S.revealed.add(wordKeyOf(w));
  applyWordStates();
}

function revealNext() {
  if (isMushafView()) {
    const ay = els.pageBody.querySelector('.ayah.veiled');
    if (!ay) {
      toast('Every ayah on this page is showing.');
      return;
    }
    S.revealed.add(ay.dataset.key);
    applyWordStates();
    scrollToKey(ay.dataset.key, { soft: true });
    return;
  }
  const w = els.pageBody.querySelector('.w.veiled');
  if (!w) {
    toast('Every word on this page is showing.');
    return;
  }
  revealWord(w);
  scrollToEl(w, { soft: true });
}

// ---------------------------------------------------------------- recitation
function itemFor(s, a) {
  const n = api.globalAyah(meta, s, a) ?? S.ayahs.find((x) => x.s === s && x.a === a)?.n;
  return n ? { key: `${s}:${a}`, s, a, n } : null;
}

function itemAfter(it) {
  const count = surahInfo(it.s)?.numberOfAyahs;
  if (!count) return null;
  if (it.a < count) return itemFor(it.s, it.a + 1);
  return it.s < 114 ? itemFor(it.s + 1, 1) : null;
}

function itemBefore(it) {
  if (it.a > 1) return itemFor(it.s, it.a - 1);
  if (it.s <= 1) return null;
  const count = surahInfo(it.s - 1)?.numberOfAyahs;
  return count ? itemFor(it.s - 1, count) : null;
}

function applyPlayerSettings() {
  player.repeatEach = settings.repeatEach;
  player.loop = settings.loop;
  player.keepGoing = settings.keepGoing;
  player.setRate(settings.rate);
  els.plRepeat.value = String(settings.repeatEach);
  els.plRate.value = String(settings.rate);
  els.plLoop.setAttribute('aria-pressed', String(settings.loop));
  els.plKeep.setAttribute('aria-pressed', String(settings.keepGoing));
}

function playKeys(keys) {
  const items = sortKeys(keys).map((k) => {
    const { s, a } = parseKey(k);
    return itemFor(s, a);
  }).filter(Boolean);
  if (!items.length) {
    toast("The recitation isn't available right now. Check your internet connection.");
    return;
  }
  applyPlayerSettings();
  player.play(items);
}

function playDefault() {
  if (player.busy) {
    player.toggle();
    return;
  }
  playKeys(S.selection.length ? S.selection : S.ayahs.map((a) => a.key));
}

async function onPlayerChange({ state, item, rep, of }) {
  const busy = state !== 'idle';
  els.player.hidden = !busy;
  const playing = state === 'playing' || state === 'loading';
  els.plToggle.dataset.icon = playing ? 'pause' : 'play';
  els.plToggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  hydrateIcons(els.player);
  els.btnPlay.dataset.icon = playing ? 'pause' : 'play';
  hydrateIcons(els.btnPlay.parentElement);
  if (item) {
    els.plLabel.textContent = refLabel(item.key);
    const reps = of > 1 ? `, ${rep} of ${of}` : '';
    els.plSub.textContent = state === 'loading' ? 'Loading…' : `${settings.reciterName || settings.reciter}${reps}`;
  }
  const key = busy ? item?.key || null : null;
  if (key !== S.playingKey) {
    S.playingKey = key;
    applyAyahStates();
  }
  if (!key || !settings.follow) return;
  if (!S.ayahs.some((x) => x.key === key)) {
    const p = await pageForKey(key).catch(() => null);
    if (p && p !== S.page && S.playingKey === key) await goToPage(p);
  }
  if (S.playingKey === key) scrollToKey(key, { soft: true });
}

// ---------------------------------------------------------------- students
function renderStudentChip() {
  els.studentAvatar.textContent = student.emoji || '📖';
  els.studentAvatar.style.setProperty('--av', student.color || COLORS[0]);
  els.studentName.textContent = student.name;
  els.btnStudent.setAttribute('aria-label', `Student: ${student.name}. Choose a student`);
}

function openStudents() {
  renderStudentList();
  openDialog(els.dlgStudents);
}

function renderStudentList() {
  els.studentList.replaceChildren(...students.map((st) => h('li', { class: `student-row${st.id === student.id ? ' is-current' : ''}` },
    h('button', {
      class: 'student-row__main',
      type: 'button',
      onclick: () => {
        closeDialog(els.dlgStudents);
        if (st.id !== student.id) switchStudent(st.id);
      },
    },
    avatarEl(st),
    h('span', { class: 'item__text' },
      h('span', { class: 'item__title' }, st.name),
      h('span', { class: 'item__sub' }, st.id === student.id ? `Open now, page ${S.page}` : `Last on page ${(isMushafView() ? st.lastMushaf : st.lastPage) || (isMushafView() ? 4 : 1)}`))),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Download ${st.name}'s data`, title: 'Download this student', onclick: () => exportData(st) }, iconEl('download')),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Edit ${st.name}`, title: 'Edit', onclick: () => openStudentForm(st) }, iconEl('edit')),
    h('button', { class: 'icon-btn', type: 'button', dataset: { act: 'delete' }, 'aria-label': `Delete ${st.name}`, title: 'Delete', onclick: () => deleteStudent(st) }, iconEl('trash')))));
}

let sfEditing = null;
let sfAvatar = AVATARS[0];
let sfColor = COLORS[0];

function openStudentForm(st = null) {
  sfEditing = st;
  els.sfTitle.textContent = st ? `Edit ${st.name}` : 'Add student';
  els.sfSave.textContent = st ? 'Save changes' : 'Add student';
  els.sfName.value = st?.name || '';
  sfAvatar = st?.emoji || AVATARS[(students.length + 1) % AVATARS.length];
  sfColor = st?.color || COLORS[students.length % COLORS.length];
  els.sfAvatars.replaceChildren(...AVATARS.map((em) => h('button', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(em === sfAvatar),
    'aria-label': `Picture ${em}`,
    onclick: (e) => {
      sfAvatar = em;
      for (const b of els.sfAvatars.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
    },
  }, em)));
  els.sfColors.replaceChildren(...COLORS.map((c) => h('button', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(c === sfColor),
    'aria-label': `Colour ${c}`,
    style: { '--sw': c },
    onclick: (e) => {
      sfColor = c;
      for (const b of els.sfColors.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
    },
  })));
  openDialog(els.dlgStudentForm);
  setTimeout(() => els.sfName.focus(), 40);
}

async function onStudentFormSubmit(e) {
  const name = els.sfName.value.trim().replace(/\s+/g, ' ');
  if (!name) {
    e.preventDefault();
    els.sfName.focus();
    return;
  }
  if (sfEditing) {
    Object.assign(sfEditing, { name, emoji: sfAvatar, color: sfColor });
    saveStudents();
    renderStudentChip();
    if (els.dlgStudents.open) renderStudentList();
    refreshPanelSoon();
    toast('Student updated.');
    return;
  }
  const st = newStudent(name, sfAvatar, sfColor);
  st.lastPage = isMushafView() ? student.lastPage || 1 : S.page || 1;
  if (isMushafView()) st.lastMushaf = S.page;
  students.push(st);
  const m = blankMeta();
  m.lastPage = st.lastPage;
  if (isMushafView()) m.lastMushaf = S.page;
  metaCache.set(st.id, m);
  await kv.set('students', students).catch(() => {});
  await kv.set(`s:${st.id}`, m).catch(() => {});
  closeDialog(els.dlgStudents);
  await switchStudent(st.id, { quiet: true });
  toast(`${name} added. This is ${name}'s own mushaf: drawings, highlights and bookmarks are kept separately.`, { duration: 5500 });
}

async function switchStudent(id, { quiet = false } = {}) {
  await flushSaves();
  const st = students.find((x) => x.id === id);
  if (!st) return;
  if (player.busy) player.stop();
  student = st;
  settings.activeStudent = id;
  saveSettings();
  sMeta = await loadMeta(id);
  renderStudentChip();
  const p = wantedVariant() === 'mushaf' ? sMeta.lastMushaf || settings.mushafPage || 4 : sMeta.lastPage || 1;
  await goToPage(p, { noAnim: true });
  if (!quiet) toast(`Opened ${st.name}'s mushaf at page ${p}.`);
}

async function deleteStudent(st) {
  const ok = await confirmBox({
    title: `Delete ${st.name}?`,
    message: `This removes ${st.name}'s bookmarks, highlights, drawings, mistakes, notes and lesson log from this device. It can't be undone, so download their data first if you might need it.`,
    okLabel: 'Delete student',
    danger: true,
  });
  if (!ok) return;
  await flushSaves();
  const keys = await kv.keys().catch(() => []);
  for (const k of keys) {
    if (k === `s:${st.id}` || String(k).startsWith(`ink:${st.id}:`)) await kv.del(k).catch(() => {});
  }
  metaCache.delete(st.id);
  for (const k of [...inkCache.keys()]) if (k.startsWith(`ink:${st.id}:`)) inkCache.delete(k);
  for (const k of [...histories.keys()]) if (k.startsWith(`${st.id}:`)) histories.delete(k);
  students = students.filter((x) => x.id !== st.id);
  if (!students.length) students.push(newStudent('My Mushaf', '📖', COLORS[0]));
  await kv.set('students', students).catch(() => {});
  if (st.id === student.id) await switchStudent(students[0].id, { quiet: true });
  renderStudentList();
  renderStudentChip();
  toast(`${st.name} was deleted.`);
}

// ---------------------------------------------------------------- bookmarks
let bmColor = 'gold';

/** The Bookmarks dialog: save this page, and every saved bookmark one tap away. */
function openBookmarkDialog() {
  const key = anchorKey();
  if (!key) return;
  els.dlgBookmark.dataset.key = key;
  els.bmWhere.textContent = S.selection.length
    ? `Save ${refLabel(key)} (page ${S.page})`
    : `Save page ${S.page}, from ${refLabel(key)}`;
  els.bmLabel.value = S.selection.length ? selectionLabel(S.selection) : `${surahName(parseKey(key).s)}, page ${S.page}`;
  bmColor = 'gold';
  els.bmColors.replaceChildren(...BOOKMARK_COLORS.map((c) => h('button', {
    type: 'button',
    role: 'radio',
    'aria-checked': String(c.id === bmColor),
    'aria-label': c.n,
    title: c.n,
    style: { '--sw': c.c },
    onclick: (e) => {
      bmColor = c.id;
      for (const b of els.bmColors.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
    },
  })));
  renderBookmarkList();
  openDialog(els.dlgBookmark);
  // On touch screens the keyboard would cover the list, so only focus the name on computers.
  if (finePointer.matches) setTimeout(() => { els.bmLabel.focus(); els.bmLabel.select(); }, 40);
}

function renderBookmarkList(newId = null) {
  const list = sMeta.bookmarks;
  els.bmListTitle.textContent = list.length ? `${student.name}'s bookmarks (${list.length})` : `${student.name}'s bookmarks`;
  els.bmList.previousElementSibling.hidden = !list.length;
  if (!list.length) {
    els.bmList.replaceChildren(h('li', { class: 'empty' }, `No bookmarks yet. Save this page above, and it will appear here for ${student.name}.`));
    return;
  }
  els.bmList.replaceChildren(...list.map((b) => {
    const color = (BOOKMARK_COLORS.find((c) => c.id === b.color) || BOOKMARK_COLORS[0]).c;
    const where = b.key ? refLabel(b.key) : `Page ${b.page}`;
    const pg = bookmarkPage(b);
    const here = b.key ? S.ayahs.some((a) => a.key === b.key) : !isMushafView() && b.page === S.page;
    return h('li', { class: `item${b.id === newId ? ' is-new' : ''}` },
      h('button', {
        class: 'item__main',
        type: 'button',
        'aria-label': `${b.label}. Go to page ${pg}`,
        onclick: () => {
          closeDialog(els.dlgBookmark);
          openBookmark(b);
        },
      },
        h('span', { class: 'ribbon', style: { '--rb': color } }),
        h('span', { class: 'item__text' },
          h('span', { class: 'item__title' }, b.label),
          h('span', { class: 'item__sub' }, here ? h('span', { class: 'bm-here' }, 'This page') : null, `${where}, saved ${fmtDate(b.at)}`)),
        h('span', { class: 'bm-page', 'aria-hidden': 'true' }, h('small', null, 'Page'), h('b', null, String(pg)))),
      h('button', {
        class: 'icon-btn icon-btn--small',
        type: 'button',
        'aria-label': `Delete bookmark ${b.label}`,
        title: 'Delete',
        onclick: () => removeBookmarks([b]),
      }, iconEl('trash')));
  }));
}

function onBookmarkSubmit(e) {
  e.preventDefault();
  const label = els.bmLabel.value.trim();
  if (!label) {
    els.bmLabel.focus();
    return;
  }
  const key = els.dlgBookmark.dataset.key;
  const { s: bs, a: ba } = parseKey(key);
  // bookmarks remember the ayah, so they open in whichever view is in use; page is the Madani page
  const page = isMushafView() ? api.pageOfSync(meta, bs, ba) || 1 : S.page;
  const b = { id: uid(), page, key, label, color: bmColor, at: Date.now() };
  // the page in the imported mushaf too, so a page bookmark opens exactly that page there
  const mpage = isMushafView() ? S.page : M.indexed ? mushaf.pageOfKey(key) : null;
  if (mpage) b.mpage = mpage;
  sMeta.bookmarks.unshift(b);
  saveMeta();
  updateNavUI();
  refreshPanelSoon();
  renderBookmarkList(b.id);
  els.bmLabel.blur();
  els.bmList.scrollIntoView?.({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  toast(`Bookmark saved for ${student.name}.`);
}

function removeBookmarks(list) {
  const m = sMeta;
  const before = m.bookmarks.slice();
  const ids = new Set(list.map((b) => b.id));
  m.bookmarks = m.bookmarks.filter((b) => !ids.has(b.id));
  saveMeta();
  updateNavUI();
  refreshPanelSoon();
  if (els.dlgBookmark.open) renderBookmarkList();
  toast(list.length > 1 ? 'Bookmarks removed.' : 'Bookmark removed.', {
    actionLabel: 'Undo',
    onAction: () => {
      if (sMeta !== m) return;
      m.bookmarks = before;
      saveMeta();
      updateNavUI();
      refreshPanelSoon();
      if (els.dlgBookmark.open) renderBookmarkList();
    },
  });
}

/** The page a bookmark is on in the view in use. */
function bookmarkPage(b) {
  if (isMushafView()) return b.mpage || (b.key && M.indexed && mushaf.pageOfKey(b.key)) || '–';
  return b.page;
}

async function openBookmark(b) {
  if (window.innerWidth <= 900) closePanel();
  let p = b.page;
  if (isMushafView()) {
    p = b.mpage || (b.key && M.indexed ? await pageForKey(b.key).catch(() => null) : null);
    if (!p) {
      toast("This bookmark can't be found in your mushaf's pages. Switch to the Uthmani view to open it.");
      return;
    }
  }
  if (p !== S.page) await goToPage(p, { select: b.key ? [b.key] : null, flash: b.key ? [b.key] : null });
  else if (b.key) {
    setSelection([b.key], { anchor: b.key });
    scrollToKey(b.key);
    flashKeys([b.key]);
  }
}

// ---------------------------------------------------------------- lesson log
let lsGrade = 4;

function renderStars() {
  els.lsStars.replaceChildren(...[1, 2, 3, 4, 5].map((n) => h('button', {
    type: 'button',
    role: 'radio',
    class: n <= lsGrade ? 'is-on' : '',
    'aria-checked': String(n === lsGrade),
    'aria-label': `${n} of 5: ${GRADES[n]}`,
    onclick: () => { lsGrade = n; renderStars(); },
  }, iconEl('star'))), h('span', { class: 'stars__label' }, GRADES[lsGrade]));
}

function openLessonDialog() {
  const keys = S.selection.length ? S.selection : S.ayahs.map((a) => a.key);
  if (!keys.length) return;
  els.lsDate.value = todayISO();
  els.lsFrom.value = keys[0];
  els.lsTo.value = keys[keys.length - 1];
  els.lsNote.value = '';
  lsGrade = 4;
  renderStars();
  const radio = els.lessonForm.querySelector('input[name="lsType"][value="new"]');
  if (radio) radio.checked = true;
  openDialog(els.dlgLesson);
}

function parseRef(v) {
  const m = /^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$/.exec(v || '');
  if (!m) return null;
  const s = +m[1];
  const a = +m[2];
  const count = surahInfo(s)?.numberOfAyahs || 286;
  return s >= 1 && s <= 114 && a >= 1 && a <= count ? `${s}:${a}` : null;
}

function onLessonSubmit(e) {
  const from = parseRef(els.lsFrom.value);
  const to = parseRef(els.lsTo.value);
  if (!from || !to) {
    e.preventDefault();
    toast('Write the ayahs as surah:ayah, for example 2:1 and 2:5.');
    return;
  }
  const [a, b] = cmpKey(from, to) <= 0 ? [from, to] : [to, from];
  const type = els.lessonForm.querySelector('input[name="lsType"]:checked')?.value || 'new';
  sMeta.lessons.unshift({
    id: uid(), date: els.lsDate.value || todayISO(), type, from: a, to: b, grade: lsGrade, note: els.lsNote.value.trim(), at: Date.now(),
  });
  saveMeta();
  refreshPanelSoon();
  toast(`Lesson saved in ${student.name}'s log.`);
}

function deleteLesson(l) {
  const m = sMeta;
  const before = m.lessons.slice();
  m.lessons = m.lessons.filter((x) => x.id !== l.id);
  saveMeta();
  refreshPanelSoon();
  toast('Lesson deleted.', {
    actionLabel: 'Undo',
    onAction: () => {
      if (sMeta !== m) return;
      m.lessons = before;
      saveMeta();
      refreshPanelSoon();
    },
  });
}

// ---------------------------------------------------------------- scripts and tajweed
const mushafName = () => (M.indexed ? '13-line mushaf' : 'Your mushaf');
const currentScript = () => (wantedVariant() === 'mushaf' ? 'mushaf' : settings.script === 'indopak' ? 'indopak' : 'uthmani');

function nextScript() {
  const order = M.ready ? ['uthmani', 'indopak', 'mushaf'] : ['uthmani', 'indopak'];
  return order[(order.indexOf(currentScript()) + 1) % order.length];
}

function updateScriptUI() {
  const cur = currentScript();
  const view = wantedVariant();
  const names = { uthmani: 'Uthmani script', indopak: 'IndoPak script', mushaf: mushafName() };
  const tips = { uthmani: 'the Uthmani script', indopak: 'the IndoPak script', mushaf: `your ${mushafName().replace(/^Your /, '')}` };
  els.btnTajweed.setAttribute('aria-pressed', String(view === 'tajweed' || view === 'mushaf'));
  els.btnScript.setAttribute('aria-pressed', String(cur !== 'uthmani'));
  els.btnScriptLabel.textContent = names[cur];
  els.btnScriptLabel.dataset.short = { uthmani: 'Uthmani', indopak: 'IndoPak', mushaf: 'Mushaf' }[cur];
  els.btnScript.dataset.icon = cur === 'mushaf' ? 'book' : 'script';
  els.btnScript.dataset.tip = `Switch to ${tips[nextScript()]} (I)`;
  els.btnScript.setAttribute('aria-label', els.btnScript.dataset.tip.replace(/ \(I\)$/, ''));
  hydrateIcons(els.btnScript.parentElement);
}

function variantTip() {
  if (settings.seenVariantTip) return;
  settings.seenVariantTip = true;
  saveSettings();
  toast('Each script view keeps its own drawings, because the words sit in different places. Highlights and bookmarks stay the same.', { duration: 7000 });
}

async function toggleTajweed() {
  if (wantedVariant() === 'mushaf') {
    toast('Your mushaf pages already show tajweed colours. Their key is on the Tajweed tab.', { actionLabel: 'Show key', onAction: () => openPanel('tajweed') });
    return;
  }
  if (settings.script === 'indopak') {
    toast('Tajweed colours are available with the Uthmani script.', {
      actionLabel: 'Switch to Uthmani',
      onAction: () => setScript('uthmani', true),
    });
    return;
  }
  settings.tajweed = !settings.tajweed;
  saveSettings();
  updateScriptUI();
  const ok = await reloadView();
  if (ok && S.variant === 'tajweed') {
    toast('Tajweed colours on. The colour key is in the notebook, on the Tajweed tab.', { actionLabel: 'Show key', onAction: () => openPanel('tajweed') });
  } else if (ok && !settings.tajweed) toast('Tajweed colours off.');
  variantTip();
  if (panelOpen() && panelTab === 'tajweed') renderTajweedTab();
}

function cycleScript() {
  setScript(nextScript());
}

async function setScript(script, tajweed = settings.tajweed, { quiet = false } = {}) {
  if (script === 'mushaf' && !M.ready) {
    for (const r of $$('input[name="script"]', els.dlgSettings)) r.checked = r.value === settings.script;
    openMushafDialog();
    return;
  }
  const before = wantedVariant();
  const keep = S.selection.length ? S.selection.slice() : null;
  const key = anchorKey();
  settings.script = ['indopak', 'mushaf'].includes(script) ? script : 'uthmani';
  settings.tajweed = !!tajweed;
  saveSettings();
  updateScriptUI();
  const after = wantedVariant();
  let ok;
  if ((before === 'mushaf') !== (after === 'mushaf')) {
    // the mushaf has its own page numbers: open the page with the same ayah
    surahListBuilt = false;
    if (S.hide !== 'off') {
      S.hide = 'off';
      updateHideButton();
    }
    let p = key ? await pageForKey(key, after).catch(() => null) : null;
    if (!p) p = after === 'mushaf' ? settings.mushafPage || 4 : settings.page || 1;
    ok = await goToPage(p, { noAnim: true, select: keep });
  } else ok = await reloadView();
  if (ok && !quiet && S.variant === wantedVariant()) {
    toast(after === 'mushaf' ? `Showing ${mushafName() === 'Your mushaf' ? 'your mushaf' : `your ${mushafName()}`}.`
      : settings.script === 'indopak' ? 'Showing the IndoPak script.' : settings.tajweed ? 'Showing the Uthmani script with tajweed colours.' : 'Showing the Uthmani script.');
  }
  variantTip();
  for (const r of $$('input[name="script"]', els.dlgSettings)) r.checked = r.value === currentScript();
  els.setTajweed.checked = settings.tajweed;
  els.setTajweed.disabled = settings.script !== 'uthmani';
  if (panelOpen() && panelTab === 'tajweed') renderTajweedTab();
}

// ---------------------------------------------------------------- your mushaf (a PDF kept on this device)
function mushafSummary() {
  if (!M.ready) return 'No mushaf added yet.';
  const mb = M.info.size ? `, ${Math.round(M.info.size / 1048576)} MB` : '';
  return M.indexed
    ? `13-line mushaf with colour-coded tajweed: ${M.info.count} pages${mb}. Ayahs can be tapped, recited and translated on its pages.`
    : `${M.info.name}: ${M.info.count} pages${mb}. Its pages can be read, drawn on and bookmarked.`;
}

function renderMushafRow() {
  els.setMushafInfo.textContent = mushafSummary();
  els.btnMushafSettings.textContent = M.ready ? 'Change' : 'Add your mushaf';
}

function renderMushafDialog() {
  els.mushafStatus.textContent = mushafSummary();
  els.mushafStatus.classList.toggle('is-on', M.ready);
  els.btnMushafOpen.hidden = !M.ready || wantedVariant() === 'mushaf';
  els.btnMushafRemove.hidden = !M.ready;
  els.btnMushafAdd.lastChild.textContent = M.ready ? 'Choose another PDF' : 'Choose the PDF';
}

function openMushafDialog() {
  renderMushafDialog();
  els.mushafProgress.hidden = true;
  openDialog(els.dlgMushaf);
}

async function refreshMushafState() {
  M.info = await mushaf.mushafInfo();
  M.ready = !!M.info?.count;
  M.indexed = false;
  if (M.ready) {
    try {
      await mushaf.loadIndex();
      M.indexed = mushaf.indexMatches(M.info);
    } catch (err) {
      console.warn('The mushaf page index could not be loaded.', err);
    }
  }
}

async function importMushaf() {
  if (!(await canStorePictures())) {
    toast("This browser can't keep a mushaf for Halaqa. Try Chrome, Edge, Firefox or Safari, outside private browsing.", { duration: 6000 });
    return;
  }
  const file = await pickFile('application/pdf,.pdf');
  if (!file) return;
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    toast('Choose a PDF file.');
    return;
  }
  const bar = els.mushafBar;
  els.mushafProgress.hidden = false;
  els.btnMushafAdd.disabled = true;
  els.mushafProgressText.textContent = 'Reading the PDF…';
  bar.style.setProperty('--p', '4%');
  try {
    const info = await mushaf.importPdf(file, (done, total) => {
      bar.style.setProperty('--p', `${Math.round((done / total) * 100)}%`);
      els.mushafProgressText.textContent = `Saving page ${done} of ${total}…`;
    });
    await refreshMushafState();
    requestPersistence();
    renderMushafDialog();
    renderMushafRow();
    updateScriptUI();
    els.mushafProgressText.textContent = info.missing ? `Saved. ${info.missing} pages had no picture Halaqa could read.` : 'Saved on this device.';
    closeDialog(els.dlgMushaf);
    closeDialog(els.dlgSettings);
    await setScript('mushaf', settings.tajweed, { quiet: true });
    toast(M.indexed
      ? 'Your 13-line mushaf is ready. Tap an ayah to select it, just like the other views.'
      : "Your mushaf is ready. Halaqa doesn't know where the ayahs are on these pages, so use the pen and highlighter on them.", { duration: 7000 });
  } catch (err) {
    console.warn(err);
    const full = err?.name === 'QuotaExceededError' || /quota/i.test(String(err?.message));
    els.mushafProgressText.textContent = full
      ? "There isn't enough free space on this device for this PDF."
      : err instanceof mushaf.PdfError ? err.message : "This PDF couldn't be read. Try another copy of it.";
  } finally {
    els.btnMushafAdd.disabled = false;
  }
}

async function removeMushafFromDevice() {
  const ok = await confirmBox({
    title: 'Remove your mushaf?',
    message: 'The pages are removed from this device. Drawings, highlights and notes made on them stay, and come back if you add the same PDF again.',
    okLabel: 'Remove',
    danger: true,
  });
  if (!ok) return;
  const wasOpen = wantedVariant() === 'mushaf';
  await mushaf.removeMushaf();
  await refreshMushafState();
  renderMushafDialog();
  renderMushafRow();
  if (wasOpen) await setScript('uthmani');
  else updateScriptUI();
  toast('Your mushaf was removed from this device.');
}

function applyRail() {
  const open = !!settings.railLabels;
  els.app.classList.toggle('rail-open', open);
  els.btnLabels.setAttribute('aria-expanded', String(open));
  els.btnLabelsText.textContent = open ? 'Hide labels' : 'Show labels';
  els.btnLabels.dataset.tip = open ? 'Hide labels' : 'Show the name of every button';
  els.btnLabels.dataset.icon = open ? 'chevLeft' : 'chevRight';
  hydrateIcons(els.toolbar);
}

function renderTajweedTab() {
  const body = els.panelBody;
  if (wantedVariant() === 'mushaf') {
    body.replaceChildren(
      sec('Your mushaf’s colours', null,
        h('p', { class: 'hint' }, 'These colours are printed on the pages of your mushaf. Each one marks a rule of noon saakin, meem saakin, ghunna or qalqala.')),
      h('ul', { class: 'tj-list' }, MUSHAF_KEY.map((r) => h('li', null, h('div', { class: 'tj-row tj-row--key' },
        h('span', { class: 'tj-swatch', style: { '--c': r.c }, 'aria-hidden': 'true' }),
        h('span', { class: 'tj-row__text' },
          h('span', { class: 'tj-row__name' }, r.name, ' ', h('span', { class: 'tj-row__ar', lang: 'ur', dir: 'rtl' }, r.ar)),
          h('span', { class: 'tj-row__about' }, r.about)))))),
      h('p', { class: 'hint' }, 'The full key, in English and Urdu, is on pages 2 and 3 of the mushaf.',
        ' ', h('button', { class: 'btn btn--small', type: 'button', onclick: () => goToPage(2) }, 'Open the key')));
    return;
  }
  const usable = settings.script !== 'indopak';
  const on = usable && settings.tajweed;
  const hidden = new Set(settings.tjHidden);
  const setHidden = (id, off) => {
    const next = new Set(settings.tjHidden);
    if (off) next.add(id);
    else next.delete(id);
    settings.tjHidden = [...next];
    saveSettings();
    applyPageClasses();
  };
  const rows = TJ_RULES.map((r) => {
    const box = h('input', { type: 'checkbox', 'aria-label': `Show the colour for ${r.name}` });
    box.checked = !hidden.has(r.id);
    box.addEventListener('change', () => setHidden(r.id, !box.checked));
    return h('li', null, h('label', { class: 'tj-row' },
      box,
      h('span', { class: `tj-swatch tj-sw-${r.id}`, 'aria-hidden': 'true' }),
      h('span', { class: 'tj-row__text' },
        h('span', { class: 'tj-row__name' }, r.name, ' ', h('span', { class: 'tj-row__ar', lang: 'ar', dir: 'rtl' }, r.ar)),
        h('span', { class: 'tj-row__about' }, r.about))));
  });
  body.replaceChildren(
    sec('Tajweed colours', null,
      usable
        ? h('button', { class: `toggle-row${on ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: toggleTajweed },
          iconEl('check'), on ? 'Colours are on' : 'Turn on tajweed colours')
        : h('div', { class: 'empty' },
          'Tajweed colours are available with the Uthmani script. No free source has colour-coded IndoPak text yet. ',
          h('button', { class: 'btn btn--small', type: 'button', style: { marginTop: '10px' }, onclick: () => setScript('uthmani', true) }, 'Switch to Uthmani with colours')),
      h('p', { class: 'hint' }, 'Untick a rule to hide its colour, for example to practise one rule at a time.')),
    h('div', { class: 'btn-row tj-actions' },
      h('button', { class: 'btn btn--small', type: 'button', onclick: () => { settings.tjHidden = []; saveSettings(); applyPageClasses(); renderTajweedTab(); } }, 'Show all'),
      h('button', { class: 'btn btn--small', type: 'button', onclick: () => { settings.tjHidden = TJ_RULES.map((r) => r.id); saveSettings(); applyPageClasses(); renderTajweedTab(); } }, 'Hide all')),
    h('ul', { class: 'tj-list' }, rows),
    h('p', { class: 'hint' }, 'Tajweed marking from AlQuran Cloud. Letters that are not coloured follow the normal rules of recitation.'));
}

// ---------------------------------------------------------------- notebook panel
const panelOpen = () => !els.panel.hidden;

function openPanel(tab) {
  if (tab) panelTab = tab;
  els.panel.hidden = false;
  els.btnPanel.setAttribute('aria-pressed', 'true');
  updatePanelTabs();
  renderPanel({ force: true });
}

function closePanel() {
  els.panel.hidden = true;
  els.btnPanel.setAttribute('aria-pressed', 'false');
  updatePanelTabs();
}

function togglePanel(tab) {
  if (panelOpen() && (!tab || tab === panelTab)) closePanel();
  else openPanel(tab);
}

function updatePanelTabs() {
  for (const t of $$('[data-tab]', els.panel)) t.setAttribute('aria-selected', String(t.dataset.tab === panelTab));
  const open = panelOpen();
  els.btnTranslation.setAttribute('aria-pressed', String(open && panelTab === 'translation'));
  els.btnNotebook.setAttribute('aria-pressed', String(open && panelTab === 'student'));
}

function renderPanel({ force = false } = {}) {
  if (!panelOpen()) return;
  if (panelTab === 'translation') renderTranslationTab();
  else if (panelTab === 'tajweed') renderTajweedTab();
  else renderStudentTab({ force });
}

const refreshPanelSoon = debounce(() => {
  if (panelOpen() && panelTab === 'student') renderStudentTab();
}, 150);

function renderStudentTab({ force = false } = {}) {
  const active = document.activeElement;
  if (!force && active && els.panelBody.contains(active) && active.tagName === 'TEXTAREA') return;
  const m = sMeta;
  const sid = student.id;
  const page = S.page;
  const tag = pageTag();
  const qp = quranPagesIn();
  const memCount = Object.keys(m.memorized).filter(tagInView).length;
  const pageMem = !!m.memorized[tag];

  const note = h('textarea', { class: 'note', placeholder: `Notes about page ${page} for ${student.name}`, 'aria-label': `Notes for page ${page}`, maxlength: '2000' });
  note.value = m.notes[tag] || '';
  const saveNote = debounce(() => {
    if (note.value.trim()) m.notes[tag] = note.value;
    else delete m.notes[tag];
    queueSave(`s:${sid}`, m);
  }, 400);
  note.addEventListener('input', saveNote);
  note.addEventListener('blur', () => saveNote.flush());

  const marks = Object.entries(m.marks);
  const hlCounts = {};
  for (const id of Object.values(m.hl)) hlCounts[id] = (hlCounts[id] || 0) + 1;

  const scroll = els.panelBody.scrollTop;
  els.panelBody.replaceChildren(
    h('div', { class: 'stu-head' },
      avatarEl(student, 'lg'),
      h('div', { class: 'stu-head__text' },
        h('h2', { class: 'stu-name' }, student.name),
        h('p', { class: 'muted' }, `${memCount} of ${qp.last - qp.first + 1} pages memorized${isMushafView() ? ' in your mushaf' : ''}`)),
      h('button', { class: 'btn btn--small', type: 'button', onclick: openStudents }, 'Switch')),
    progressBlock(),
    sec(`Page ${page}`, null,
      h('button', { class: `toggle-row${pageMem ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(pageMem), onclick: toggleMemorized },
        iconEl('check'), pageMem ? 'Memorized' : 'Mark this page as memorized'),
      note),
    sec('Bookmarks', h('button', { class: 'btn btn--small', type: 'button', onclick: openBookmarkDialog }, iconEl('plus'), 'Add'), bookmarksList()),
    sec('Practice words', h('span', { class: 'sec__meta' }, marks.length ? String(marks.length) : ''),
      h('div', { class: 'legend' }, MISTAKES.map((x) => h('span', null, h('i', { style: { '--c': x.color } }), x.name))),
      marksList(marks)),
    sec('Highlights', null,
      h('div', { class: 'legend' }, HL.map((x) => h('span', null, h('i', { style: { '--c': x.color } }), `${hlName(x.id)} (${hlCounts[x.id] || 0})`))),
      h('p', { class: 'hint' }, 'Tap an ayah, then a colour in the bar below the page. Rename colours in Settings.')),
    sec('Lesson log', h('button', { class: 'btn btn--small', type: 'button', onclick: openLessonDialog }, iconEl('plus'), 'Add'), lessonsList()),
  );
  if (!force) els.panelBody.scrollTop = scroll;
}

function progressBlock() {
  const memo = sMeta.memorized;
  const qp = quranPagesIn();
  const count = Object.keys(memo).filter(tagInView).length;
  const curJuz = S.ayahs[0]?.juz;
  if (!qp.juz) {
    return h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: { '--p': `${(count / Math.max(1, qp.last - qp.first + 1)) * 100}%` } }));
  }
  const grid = h('div', { class: 'juz-grid', role: 'list', 'aria-label': 'Memorized pages in each juz' });
  for (let j = 1; j <= 30; j++) {
    const start = qp.juz[j - 1];
    const end = j < 30 ? qp.juz[j] - 1 : qp.last;
    const total = Math.max(1, end - start + 1);
    let done = 0;
    for (let p = start; p <= end; p++) if (memo[pageTag(p)]) done++;
    grid.append(h('button', {
      class: `juz-cell${j === curJuz ? ' is-current' : ''}`,
      type: 'button',
      role: 'listitem',
      title: `Juz ${j}: ${done} of ${total} pages memorized`,
      'aria-label': `Juz ${j}: ${done} of ${total} pages memorized`,
      style: { '--fill': `${Math.round((done / total) * 100)}%` },
      onclick: () => goToJuz(j),
    }, h('span', null, String(j))));
  }
  return h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: { '--p': `${(count / (qp.last - qp.first + 1)) * 100}%` } }), grid);
}

function toggleMemorized() {
  const p = S.page;
  const tag = pageTag();
  if (sMeta.memorized[tag]) delete sMeta.memorized[tag];
  else {
    sMeta.memorized[tag] = Date.now();
    toast(`Page ${p} marked as memorized for ${student.name}.`);
  }
  saveMeta();
  renderStudentTab({ force: true });
}

function bookmarksList() {
  const list = sMeta.bookmarks;
  if (!list.length) return h('p', { class: 'empty' }, `No bookmarks yet. Tap Add to save this page for ${student.name}, or tap an ayah and choose the bookmark button. Tap a saved bookmark to go straight to its page.`);
  return h('ul', { class: 'items' }, list.map((b) => h('li', { class: 'item' },
    h('button', { class: 'item__main', type: 'button', onclick: () => openBookmark(b) },
      h('span', { class: 'ribbon', style: { '--rb': (BOOKMARK_COLORS.find((c) => c.id === b.color) || BOOKMARK_COLORS[0]).c } }),
      h('span', { class: 'item__text' },
        h('span', { class: 'item__title' }, b.label),
        h('span', { class: 'item__sub' }, `Page ${bookmarkPage(b)}, saved ${fmtDate(b.at)}`))),
    h('button', { class: 'icon-btn icon-btn--small', type: 'button', 'aria-label': `Delete bookmark ${b.label}`, title: 'Delete', onclick: () => removeBookmarks([b]) }, iconEl('trash')))));
}

function marksList(entries) {
  if (!entries.length) {
    return h('p', { class: 'empty' }, 'No mistakes marked yet. Choose Mark mistakes on the toolbar, then tap a word while your student recites.');
  }
  const sorted = entries.filter(([wk]) => parseWordKey(wk)).sort((x, y) => {
    const a = parseWordKey(x[0]);
    const b = parseWordKey(y[0]);
    return a.s - b.s || a.a - b.a || a.w - b.w || Number(a.ip) - Number(b.ip);
  });
  const shown = sorted.slice(0, 80);
  return h('ul', { class: 'items' }, shown.map(([wk, mk]) => {
    const { s, a, ip } = parseWordKey(wk);
    const type = mistakeInfo(mk.t);
    return h('li', { class: 'item' },
      h('button', { class: 'item__main', type: 'button', onclick: () => openWord(wk, mk.p) },
        h('span', { class: `word-ar${ip ? ' word-ar--ip' : ''}`, lang: 'ar' }, mk.w || '…'),
        h('span', { class: 'item__text' },
          h('span', { class: 'item__title' }, `${surahName(s)} ${s}:${a}${ip ? ' (IndoPak)' : ''}`),
          h('span', { class: 'type-tag', style: { '--mc': type.color } }, h('i'), type.name))),
      h('button', { class: 'icon-btn icon-btn--small', type: 'button', 'aria-label': 'Remove this mark', title: 'Remove', onclick: () => removeMark(wk) }, iconEl('close')));
  }), sorted.length > shown.length ? h('li', { class: 'hint' }, `And ${sorted.length - shown.length} more.`) : null);
}

function lessonsList() {
  const list = sMeta.lessons;
  if (!list.length) return h('p', { class: 'empty' }, `No lessons logged yet. After a lesson, tap Add to record what ${student.name} recited and how it went.`);
  return h('ul', { class: 'items' }, list.slice(0, 60).map((l) => h('li', { class: 'item' },
    h('button', { class: 'item__main', type: 'button', onclick: () => openAyah(l.from) },
      h('span', { class: 'item__text' },
        h('span', { class: 'item__title' }, `${LESSON_TYPES[l.type] || 'Lesson'}: ${rangeLabel(l.from, l.to)}`),
        h('span', { class: 'item__sub' }, `${fmtDate(l.date)}  `,
          h('span', { class: 'stars-text', 'aria-label': `${l.grade} of 5, ${GRADES[l.grade] || ''}` }, '★'.repeat(l.grade) + '☆'.repeat(5 - l.grade))),
        l.note ? h('span', { class: 'lesson-note' }, l.note) : null)),
    h('button', { class: 'icon-btn icon-btn--small', type: 'button', 'aria-label': 'Delete this lesson', title: 'Delete', onclick: () => deleteLesson(l) }, iconEl('trash')))));
}

const langOf = (edition) => String(edition || '').split('.')[0] || 'en';

/** The translations to show: the first one, and the second unless it is switched off or the same. */
function wantedTranslations() {
  const list = [{ id: settings.translation, name: settings.translationName }];
  if (settings.translation2 && settings.translation2 !== settings.translation) list.push({ id: settings.translation2, name: settings.translation2Name });
  return list;
}

/** A translation for the ayahs on the page in view. Mushaf pages borrow from the Madani pages their ayahs are on. */
async function translationFor(page, edition) {
  if (!isMushafView()) return api.getPageTranslation(page, edition);
  const madani = [...new Set(S.ayahs.map((a) => api.pageOfSync(meta, a.s, a.a)).filter(Boolean))];
  if (!madani.length) return { map: new Map(), dir: 'ltr', name: edition };
  const parts = await Promise.all(madani.map((p) => api.getPageTranslation(p, edition)));
  const map = new Map();
  for (const t of parts) for (const [k, v] of t.map) map.set(k, v);
  return { map, dir: parts[0].dir, name: parts[0].name };
}

async function renderTranslationTab() {
  const body = els.panelBody;
  const page = S.page;
  const wanted = wantedTranslations();
  const sig = wanted.map((t) => t.id).join('|');
  if (!body.querySelector('.tr-list')) body.replaceChildren(h('p', { class: 'muted' }, 'Loading the translation…'));
  const results = await Promise.allSettled(wanted.map((t) => translationFor(page, t.id)));
  if (page !== S.page || panelTab !== 'translation' || !panelOpen() || sig !== wantedTranslations().map((t) => t.id).join('|')) return;
  const loaded = results.map((r, i) => (r.status === 'fulfilled' ? { ...wanted[i], ...r.value, name: wanted[i].name || r.value.name } : null));
  if (!loaded.some(Boolean)) {
    body.replaceChildren(
      h('p', { class: 'empty' }, "The translation couldn't be loaded. Check your internet connection."),
      h('button', { class: 'btn btn--small', type: 'button', style: { marginTop: '12px' }, onclick: renderTranslationTab }, 'Try again'));
    return;
  }
  const list = h('ol', { class: 'tr-list', dir: 'ltr' });
  let lastS = null;
  for (const a of S.ayahs) {
    if (a.s !== lastS) {
      list.append(h('li', { class: 'tr-surah', dir: 'ltr' }, surahName(a.s)));
      lastS = a.s;
    }
    const texts = loaded.map((tr, i) => {
      if (!tr) return h('p', { class: 'tr-text is-missing' }, `${wanted[i].name || wanted[i].id} couldn't be loaded.`);
      return h('p', { class: 'tr-text', dir: tr.dir, lang: langOf(tr.id) }, tr.map.get(a.key) || '');
    });
    list.append(h('li', {
      class: 'tr-item',
      dataset: { key: a.key },
      tabindex: '0',
      onclick: () => {
        if (S.tool !== 'pointer') setTool('pointer');
        setSelection([a.key], { anchor: a.key });
        scrollToKey(a.key, { soft: true });
      },
      onkeydown: (e) => { if (e.key === 'Enter') e.currentTarget.click(); },
    }, h('div', { class: 'tr-ref', dir: 'ltr' }, `${a.s}:${a.a}`), ...texts));
  }
  body.replaceChildren(
    h('div', { class: 'tr-head' },
      h('div', { class: 'tr-names' },
        ...wanted.map((t, i) => h('span', { class: `tr-name${i ? ' tr-name--2' : ''}` }, `${langName(langOf(t.id))}: ${t.name || t.id}`))),
      h('button', { class: 'btn btn--small', type: 'button', onclick: openSettings }, 'Change')),
    list);
  markTranslationSelection();
}

function markTranslationSelection() {
  if (!els.panel || !panelOpen() || panelTab !== 'translation') return;
  let first = null;
  for (const li of $$('.tr-item', els.panelBody)) {
    const on = S.selection.includes(li.dataset.key);
    li.classList.toggle('is-sel', on);
    if (on && !first) first = li;
  }
  first?.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

// ---------------------------------------------------------------- navigation dialog
function openNav(tab = 'surah') {
  setNavTab(tab);
  renderSurahList();
  renderJuzGrid();
  const total = pagesIn();
  els.pageInput.max = String(total);
  els.pageRange.max = String(total);
  els.pageInputLabel.textContent = `Page number (1 to ${total})`;
  els.pageInput.value = String(S.page || 1);
  els.pageRange.value = String(S.page || 1);
  els.surahFilter.value = '';
  filterSurahs('');
  openDialog(els.dlgNav);
  setTimeout(() => {
    if (tab === 'surah') {
      els.surahList.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
      if (finePointer.matches) els.surahFilter.focus();
    } else if (tab === 'page') els.pageInput.select();
  }, 40);
}

function setNavTab(tab) {
  for (const b of $$('[data-nav]', els.dlgNav)) b.setAttribute('aria-selected', String(b.dataset.nav === tab));
  for (const p of $$('[data-navpane]', els.dlgNav)) p.hidden = p.dataset.navpane !== tab;
}

let surahListBuilt = false;
function renderSurahList() {
  const cur = new Set(S.ayahs.map((a) => a.s));
  if (!meta) {
    els.surahList.replaceChildren(h('li', { class: 'empty' }, 'Loading the list of surahs… If this stays, check your internet connection.'));
    surahListBuilt = false;
    loadMetaData().then(() => {
      if (meta && els.dlgNav.open) {
        renderSurahList();
        renderJuzGrid();
      }
    });
    return;
  }
  if (!surahListBuilt) {
    els.surahList.replaceChildren(...meta.surahs.map((s) => {
      const start = isMushafView() ? (M.indexed ? mushaf.pageOfKey(`${s.number}:1`) : null) : api.pageOfSync(meta, s.number, 1);
      const search = [s.number, s.englishName, s.englishNameTranslation].join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return h('li', { dataset: { search, ar: api.plainArabic(s.name) } },
        h('button', { class: 'surah-row', type: 'button', dataset: { s: String(s.number) } },
          h('span', { class: 'surah-row__no' }, String(s.number)),
          h('span', { class: 'surah-row__en' },
            h('b', null, s.englishName),
            h('small', null, `${s.englishNameTranslation}${s.englishNameTranslation ? ', ' : ''}${s.numberOfAyahs} ayahs`)),
          h('span', { class: 'surah-row__ar' },
            h('span', { lang: 'ar', dir: 'rtl' }, arabicSurahName(s.number)),
            h('small', null, start ? `Page ${start}` : (s.revelationType || '')))));
    }));
    surahListBuilt = true;
  }
  for (const b of $$('.surah-row', els.surahList)) b.classList.toggle('is-current', cur.has(+b.dataset.s));
}

function filterSurahs(q) {
  const raw = String(q || '').trim();
  const latin = raw.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const arabic = api.plainArabic(raw);
  const isAr = api.hasArabic(raw);
  for (const li of els.surahList.children) {
    if (!li.dataset.search) continue;
    let show = true;
    if (raw) {
      if (isAr) show = li.dataset.ar.includes(arabic);
      else if (/^\d+$/.test(latin)) show = li.dataset.search.split(' ')[0] === latin || li.dataset.search.startsWith(`${latin}`);
      else show = li.dataset.search.replace(/ /g, '').includes(latin.replace(/ /g, ''));
    }
    li.hidden = !show;
  }
}

function renderJuzGrid() {
  const curJuz = S.ayahs[0]?.juz;
  const inMushaf = isMushafView() && M.indexed;
  els.juzGrid.replaceChildren(...Array.from({ length: 30 }, (_, i) => {
    const j = i + 1;
    // the IndoPak juz start at slightly different ayahs, so the mushaf uses its own list
    const mr = inMushaf ? mushaf.juzStarts()[i] : null;
    const r = mr ? parseKey(mr.k) : meta?.juzStarts?.[i];
    const page = mr ? mr.p : S.juzPages[i];
    return h('button', { type: 'button', class: j === curJuz ? 'is-current' : '', dataset: { j: String(j) } },
      h('b', null, `Juz ${j}`),
      h('small', null, r ? `${surahName(r.s)} ${r.s}:${r.a}` : `Page ${page}`),
      r ? h('small', null, `Page ${page}`) : null);
  }));
}

// ---------------------------------------------------------------- search
function openSearch() {
  openDialog(els.dlgSearch);
  setTimeout(() => { els.searchInput.focus(); els.searchInput.select(); }, 40);
}

function highlightText(text, q) {
  const frag = document.createDocumentFragment();
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let i = 0;
  if (ql) {
    for (let j = lower.indexOf(ql); j >= 0; j = lower.indexOf(ql, i)) {
      frag.append(text.slice(i, j), h('mark', null, text.slice(j, j + ql.length)));
      i = j + ql.length;
    }
  }
  frag.append(text.slice(i));
  return frag;
}

function searchEdition(q) {
  if (api.hasArabic(q)) return 'quran-simple-clean';
  const lang = settings.translation.split('.')[0];
  return ['ar', 'ur', 'fa', 'ps', 'ug', 'ku', 'sd'].includes(lang) ? 'en.sahih' : settings.translation;
}

const runSearch = debounce(doSearch, 380);

async function doSearch(raw) {
  const q = String(raw || '').trim();
  const items = [];
  const ref = /^(\d{1,3})\s*[:.]\s*(\d{1,3})$/.exec(q);
  if (ref) {
    const s = +ref[1];
    const a = +ref[2];
    const count = surahInfo(s)?.numberOfAyahs;
    if (s >= 1 && s <= 114 && a >= 1 && (!count || a <= count)) items.push({ kind: 'ayah', key: `${s}:${a}`, title: `Open ${refLabel(`${s}:${a}`)}` });
  } else if (/^\d{1,3}$/.test(q)) {
    const n = +q;
    if (n >= 1 && n <= pagesIn()) items.push({ kind: 'page', page: n, title: `Open page ${n}` });
    if (n >= 1 && n <= 114) items.push({ kind: 'surah', s: n, title: `Open surah ${n}, ${surahName(n)}` });
  }
  if (q.length < 2 || ref || /^\d+$/.test(q)) {
    renderResults(items, '', null);
    els.searchHint.textContent = q.length < 2 && !items.length ? 'Type at least two letters. Arabic works with or without vowel marks.' : '';
    return;
  }
  const token = ++searchToken;
  els.searchHint.textContent = 'Searching…';
  const arabic = api.hasArabic(q);
  const query = arabic ? api.searchableArabic(q) : q;
  try {
    const matches = await api.searchQuran(query, searchEdition(q));
    if (token !== searchToken) return;
    const shown = matches.slice(0, 80);
    renderResults([...items, ...shown.map((m) => ({ kind: 'match', key: `${m.s}:${m.a}`, text: m.text, rtl: arabic }))], query);
    els.searchHint.textContent = matches.length
      ? (matches.length > shown.length ? `Showing the first ${shown.length} of ${matches.length} ayahs.` : `${matches.length} ayah${matches.length === 1 ? '' : 's'} found.`)
      : `Nothing found for “${q}”. Try a shorter word.`;
  } catch {
    if (token !== searchToken) return;
    els.searchHint.textContent = "Search isn't available right now. Check your internet connection.";
  }
}

function renderResults(items, q) {
  els.searchResults.replaceChildren(...items.map((it) => h('li', null, h('button', {
    class: 'result',
    type: 'button',
    onclick: () => {
      closeDialog(els.dlgSearch);
      if (it.kind === 'page') goToPage(it.page);
      else if (it.kind === 'surah') goToSurah(it.s);
      else openAyah(it.key);
    },
  },
  h('div', { class: 'result__ref' }, it.kind === 'match' ? refLabel(it.key) : 'Go to'),
  h('p', { class: 'result__text', dir: it.rtl ? 'rtl' : null, lang: it.rtl ? 'ar' : null }, it.kind === 'match' ? highlightText(it.text, q) : it.title)))));
}

// ---------------------------------------------------------------- settings
function fillSelect(select, items, value) {
  const list = items.filter((x, i) => items.findIndex((y) => y.id === x.id) === i);
  if (value && !list.some((x) => x.id === value)) list.splice(list[0]?.id === '' ? 1 : 0, 0, { id: value, name: value });
  select.replaceChildren(...list.map((x) => h('option', { value: x.id }, x.name)));
  select.value = value;
}

function openSettings() {
  for (const r of $$('input[name="theme"]', els.dlgSettings)) r.checked = r.value === settings.theme;
  for (const r of $$('input[name="cursor"]', els.dlgSettings)) r.checked = r.value === settings.cursor;
  for (const r of $$('input[name="script"]', els.dlgSettings)) r.checked = r.value === currentScript();
  els.setTajweed.checked = settings.tajweed;
  els.setTajweed.disabled = settings.script !== 'uthmani';
  els.setRuled.checked = settings.ruled;
  renderMushafRow();
  els.setLabels.checked = settings.railLabels;
  els.setRepeat.value = String(settings.repeatEach);
  els.setRate.value = String(settings.rate);
  els.setFollow.checked = settings.follow;
  els.setFinger.checked = settings.fingerDraw;
  fillSelect(els.setReciter, [{ id: settings.reciter, name: settings.reciterName || settings.reciter }], settings.reciter);
  fillSelect(els.setTranslation, [{ id: settings.translation, name: settings.translationName || settings.translation }], settings.translation);
  fillSelect(els.setTranslation2, [NO_TRANSLATION, ...(settings.translation2 ? [{ id: settings.translation2, name: settings.translation2Name || settings.translation2 }] : [])], settings.translation2);
  els.hlNames.replaceChildren(...HL.map((x) => {
    const input = h('input', { class: 'field', type: 'text', maxlength: '30', value: hlName(x.id), 'aria-label': `Name for the ${x.name.toLowerCase()} colour`, placeholder: x.name });
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (v && v !== x.name) settings.hlNames[x.id] = v;
      else delete settings.hlNames[x.id];
      saveSettings();
      renderSelbar();
      refreshPanelSoon();
    });
    return h('label', { class: 'hl-name' }, h('i', { style: { '--c': x.color } }), input);
  }));
  openDialog(els.dlgSettings);

  api.getReciters().then((list) => {
    const ar = list.filter((e) => e.lang === 'ar').sort((a, b) => a.name.localeCompare(b.name));
    const other = list.filter((e) => e.lang !== 'ar').sort((a, b) => a.name.localeCompare(b.name));
    const items = [...ar.map((e) => ({ id: e.id, name: e.name })), ...other.map((e) => ({ id: e.id, name: `${e.name} (${langName(e.lang)} audio)` }))];
    if (items.length) fillSelect(els.setReciter, items, settings.reciter);
  }).catch(() => fillSelect(els.setReciter, FALLBACK_RECITERS, settings.reciter));

  api.getTextEditions().then((list) => {
    const items = list
      .map((e) => ({ id: e.id, name: `${langName(e.lang)}: ${e.name}${e.type === 'tafsir' ? ' (tafsir)' : ''}`, en: e.lang === 'en' }))
      .sort((a, b) => (b.en - a.en) || a.name.localeCompare(b.name));
    if (items.length) {
      fillSelect(els.setTranslation, items, settings.translation);
      fillSelect(els.setTranslation2, [NO_TRANSLATION, ...items], settings.translation2);
    }
  }).catch(() => {
    fillSelect(els.setTranslation, FALLBACK_TRANSLATIONS, settings.translation);
    fillSelect(els.setTranslation2, [NO_TRANSLATION, ...FALLBACK_TRANSLATIONS], settings.translation2);
  });
}

function wireSettings() {
  els.dlgSettings.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'theme') {
      settings.theme = t.value;
      applyTheme();
    } else if (t.name === 'cursor') {
      settings.cursor = t.value;
      cursor.setStyle(settings.cursor);
    } else if (t.name === 'script') {
      setScript(t.value);
      return;
    } else if (t === els.setTajweed) {
      if (t.checked !== settings.tajweed) toggleTajweed();
      return;
    } else if (t === els.setRuled) {
      settings.ruled = t.checked;
      applyPageClasses();
    } else if (t === els.setLabels) {
      settings.railLabels = t.checked;
      applyRail();
    } else if (t === els.setReciter) {
      settings.reciter = t.value;
      settings.reciterName = (t.selectedOptions[0]?.textContent || t.value).replace(/\s*\(.+ audio\)$/, '');
      api.audioTemplate(settings.reciter).catch(() => toast("This reciter's audio couldn't be reached right now."));
    } else if (t === els.setRepeat) {
      settings.repeatEach = Number(t.value) || 1;
      applyPlayerSettings();
    } else if (t === els.setRate) {
      settings.rate = Number(t.value) || 1;
      applyPlayerSettings();
    } else if (t === els.setFollow) {
      settings.follow = t.checked;
    } else if (t === els.setFinger) {
      settings.fingerDraw = t.checked;
      board.fingerDraws = t.checked;
    } else if (t === els.setTranslation) {
      settings.translation = t.value;
      settings.translationName = (t.selectedOptions[0]?.textContent || t.value).replace(/^[^:]+:\s*/, '');
      if (panelOpen() && panelTab === 'translation') renderTranslationTab();
    } else if (t === els.setTranslation2) {
      settings.translation2 = t.value;
      settings.translation2Name = t.value ? (t.selectedOptions[0]?.textContent || t.value).replace(/^[^:]+:\s*/, '') : '';
      if (panelOpen() && panelTab === 'translation') renderTranslationTab();
    } else return;
    saveSettings();
  });
  els.btnExport.addEventListener('click', () => exportData());
  els.btnImport.addEventListener('click', importData);
  els.btnErase.addEventListener('click', eraseAll);
}

// ---------------------------------------------------------------- backups
async function exportData(only = null) {
  await flushSaves();
  const entries = {};
  for (const [k, v] of await kv.entries()) {
    const key = String(k);
    if (only && !(key === `s:${only.id}` || key.startsWith(`ink:${only.id}:`))) continue;
    entries[key] = v;
  }
  if (only) entries.students = [only];
  const payload = { app: APP.id, version: 1, exportedAt: new Date().toISOString(), kind: only ? 'student' : 'all', entries };
  const name = only ? `halaqa-${slug(only.name)}-${todayISO()}.json` : `halaqa-backup-${todayISO()}.json`;
  downloadText(name, JSON.stringify(payload));
  toast(only ? `Downloaded ${only.name}'s data.` : 'Backup downloaded. Keep the file somewhere safe.');
}

async function importData() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast("That file isn't a Halaqa backup.");
    return;
  }
  if (data?.app !== APP.id || !data.entries || typeof data.entries !== 'object') {
    toast("That file isn't a Halaqa backup.");
    return;
  }
  const incoming = Array.isArray(data.entries.students) ? data.entries.students.filter((s) => s && s.id && s.name) : [];
  const ok = await confirmBox({
    title: 'Restore this backup?',
    message: `It has ${incoming.length} student${incoming.length === 1 ? '' : 's'}. A student who is already on this device will be replaced by the copy in the file. Everyone else stays as they are.`,
    okLabel: 'Restore backup',
  });
  if (!ok) return;
  await flushSaves();
  for (const [k, v] of Object.entries(data.entries)) {
    if (/^(s:|ink:)/.test(k)) await kv.set(k, v);
  }
  const merged = students.slice();
  for (const st of incoming) {
    const i = merged.findIndex((x) => x.id === st.id);
    if (i >= 0) merged[i] = st;
    else merged.push(st);
  }
  await kv.set('students', merged);
  if (data.entries.settings?.hlNames && typeof data.entries.settings.hlNames === 'object') {
    settings.hlNames = { ...data.entries.settings.hlNames };
    await kv.set('settings', settings);
  }
  toast('Backup restored. Reloading…');
  setTimeout(() => location.reload(), 900);
}

async function eraseAll() {
  const ok = await confirmBox({
    title: 'Erase everything?',
    message: 'All students, drawings, highlights, bookmarks, notes and settings will be removed from this device. Download a backup first if you might need any of it.',
    okLabel: 'Erase everything',
    danger: true,
  });
  if (!ok) return;
  pending.clear();
  clearTimeout(saveTimer);
  await eraseEverything();
  try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ }
  location.reload();
}

// ---------------------------------------------------------------- full screen
function toggleFocus(force) {
  const on = typeof force === 'boolean' ? force : !els.app.classList.contains('is-focus');
  els.app.classList.toggle('is-focus', on);
  els.btnFocus.setAttribute('aria-pressed', String(on));
  const de = document.documentElement;
  try {
    if (on && !document.fullscreenElement) {
      const req = de.requestFullscreen || de.webkitRequestFullscreen;
      const p = req?.call(de);
      if (p?.catch) p.catch(() => {});
    } else if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      const p = exit?.call(document);
      if (p?.catch) p.catch(() => {});
    }
  } catch {
    /* full screen not allowed here */
  }
  if (on) toast('Full screen. Press F, Esc or the same button to leave.');
}

// ---------------------------------------------------------------- welcome
function openWelcome() {
  openDialog(els.dlgWelcome);
  els.dlgWelcome.addEventListener('close', () => {
    settings.seenWelcome = true;
    saveSettings();
  }, { once: true });
}

// ---------------------------------------------------------------- menu (phones)
function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : els.moreMenu.hidden;
  els.moreMenu.hidden = !open;
  els.btnMore.setAttribute('aria-expanded', String(open));
}

// ---------------------------------------------------------------- events
function wireUI() {
  // top bar
  els.btnAbout.addEventListener('click', () => openDialog(els.dlgAbout));
  els.btnShowHelp.addEventListener('click', () => { closeDialog(els.dlgAbout); openDialog(els.dlgHelp); });
  els.btnSurah.addEventListener('click', () => openNav('surah'));
  els.btnPageNo.addEventListener('click', () => openNav('page'));
  els.btnNext.addEventListener('click', nextPage);
  els.btnPrev.addEventListener('click', prevPage);
  els.turnNext.addEventListener('click', nextPage);
  els.turnPrev.addEventListener('click', prevPage);
  els.btnPlay.addEventListener('click', playDefault);
  els.btnSearch.addEventListener('click', openSearch);
  els.btnBookmark.addEventListener('click', openBookmarkDialog);
  els.btnStudent.addEventListener('click', openStudents);
  els.btnPanel.addEventListener('click', () => togglePanel('student'));
  els.btnSettings.addEventListener('click', openSettings);
  els.btnMore.addEventListener('click', () => toggleMenu());
  els.moreMenu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-menu]');
    if (!b) return;
    toggleMenu(false);
    ({
      play: playDefault,
      search: openSearch,
      bookmark: openBookmarkDialog,
      panel: () => openPanel('student'),
      translation: () => openPanel('translation'),
      settings: openSettings,
      help: () => openDialog(els.dlgHelp),
    })[b.dataset.menu]?.();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!els.moreMenu.hidden && !e.target.closest('#moreMenu, #btnMore')) toggleMenu(false);
  });

  // tool rail
  els.toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tool) {
      if (S.tool === b.dataset.tool && TOOLS_WITH_OPTIONS.has(b.dataset.tool)) {
        settings.showOptions = !settings.showOptions;
        renderToolOptions();
        saveSettings();
      } else {
        setTool(b.dataset.tool);
      }
      return;
    }
    ({
      undo,
      redo,
      hide: cycleHide,
      clear: clearPage,
      'zoom-in': () => zoomBy(1.15),
      'zoom-out': () => zoomBy(1 / 1.15),
      'zoom-fit': zoomFit,
      focus: () => toggleFocus(),
      tajweed: toggleTajweed,
      script: cycleScript,
      bookmarks: openBookmarkDialog,
      translation: () => togglePanel('translation'),
      notebook: () => togglePanel('student'),
      labels: () => {
        settings.railLabels = !settings.railLabels;
        applyRail();
        saveSettings();
      },
    })[b.dataset.act]?.();
  });

  // the page
  els.pageBody.addEventListener('click', onPageClick);
  els.stage.addEventListener('click', (e) => {
    if ((e.target === els.stage || e.target === els.sizer) && S.selection.length) setSelection([]);
  });
  els.stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(settings.zoom * Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY }, { live: true });
  }, { passive: false });

  // swipe left or right to turn pages (pointer tool, touch screens)
  let swipe = null;
  const touchesDown = new Set();
  els.stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touchesDown.add(e.pointerId);
    if (touchesDown.size > 1 || S.tool !== 'pointer' || els.stage.classList.contains('is-wide')) {
      swipe = null;
      return;
    }
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });
  const touchEnd = (e) => { touchesDown.delete(e.pointerId); };
  addEventListener('pointerup', touchEnd, { passive: true });
  addEventListener('pointercancel', touchEnd, { passive: true });
  els.stage.addEventListener('pointerup', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const dt = performance.now() - swipe.t;
    swipe = null;
    const pinchedIn = (window.visualViewport?.scale || 1) > 1.05;
    if (!pinchedIn && dt < 650 && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.55) {
      S.swallowClick = true;
      setTimeout(() => { S.swallowClick = false; }, 450);
      // Like a mushaf: swipe towards the right to go forward.
      if (dx > 0) nextPage();
      else prevPage();
    }
  }, { passive: true });
  els.stage.addEventListener('pointercancel', () => { swipe = null; });

  new ResizeObserver(() => requestAnimationFrame(() => layout({ final: true }))).observe(els.stage);
  document.fonts?.addEventListener?.('loadingdone', () => layout({ final: true, force: true }));

  // selection bar
  els.selbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.hl !== undefined) {
      setHighlight(S.selection, b.dataset.hl || null);
      return;
    }
    ({
      play: () => playKeys(S.selection),
      extend: () => {
        S.extend = !S.extend;
        renderSelbar();
        if (S.extend) toast('Now tap the last ayah of the range.');
      },
      bookmark: openBookmarkDialog,
      translate: () => openPanel('translation'),
      lesson: openLessonDialog,
      copy: copySelection,
      share: shareSelection,
      deselect: () => setSelection([]),
    })[b.dataset.act]?.();
  });

  // player
  els.plToggle.addEventListener('click', () => player.toggle());
  els.plPrev.addEventListener('click', () => player.prev());
  els.plNext.addEventListener('click', () => player.next());
  els.plStop.addEventListener('click', () => player.stop());
  els.plRepeat.addEventListener('change', () => {
    settings.repeatEach = Number(els.plRepeat.value) || 1;
    applyPlayerSettings();
    saveSettings();
  });
  els.plRate.addEventListener('change', () => {
    settings.rate = Number(els.plRate.value) || 1;
    applyPlayerSettings();
    saveSettings();
  });
  els.plLoop.addEventListener('click', () => {
    settings.loop = !settings.loop;
    applyPlayerSettings();
    saveSettings();
  });
  els.plKeep.addEventListener('click', () => {
    settings.keepGoing = !settings.keepGoing;
    applyPlayerSettings();
    saveSettings();
  });

  // panel
  els.panelClose.addEventListener('click', closePanel);
  for (const t of $$('[data-tab]', els.panel)) {
    t.addEventListener('click', () => {
      panelTab = t.dataset.tab;
      updatePanelTabs();
      renderPanel({ force: true });
    });
  }

  // navigation dialog
  for (const b of $$('[data-nav]', els.dlgNav)) {
    b.addEventListener('click', () => {
      setNavTab(b.dataset.nav);
      if (b.dataset.nav === 'page') setTimeout(() => els.pageInput.select(), 30);
    });
  }
  els.surahFilter.addEventListener('input', () => filterSurahs(els.surahFilter.value));
  els.surahFilter.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    // Without this, the same Enter press would also "click" the button that gets focus back.
    e.preventDefault();
    const first = [...els.surahList.children].find((li) => !li.hidden && li.dataset.search);
    first?.querySelector('button')?.click();
  });
  els.surahList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (b) goToSurah(+b.dataset.s);
  });
  els.juzGrid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-j]');
    if (b) goToJuz(+b.dataset.j);
  });
  els.pageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = clamp(parseInt(els.pageInput.value, 10) || 1, 1, pagesIn());
    closeDialog(els.dlgNav);
    goToPage(p);
  });
  els.pageRange.addEventListener('input', () => { els.pageInput.value = els.pageRange.value; });
  els.pageInput.addEventListener('input', () => {
    const v = parseInt(els.pageInput.value, 10);
    if (v >= 1 && v <= pagesIn()) els.pageRange.value = String(v);
  });

  // search
  els.searchInput.addEventListener('input', () => runSearch(els.searchInput.value));
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      runSearch.flush(els.searchInput.value);
      setTimeout(() => els.searchResults.querySelector('button')?.focus(), 600);
    }
  });

  // forms
  els.studentForm.addEventListener('submit', onStudentFormSubmit);
  els.btnAddStudent.addEventListener('click', () => openStudentForm(null));
  els.bookmarkForm.addEventListener('submit', onBookmarkSubmit);
  els.lessonForm.addEventListener('submit', onLessonSubmit);
  els.welcomeStudents.addEventListener('click', () => {
    closeDialog(els.dlgWelcome);
    openStudentForm(null);
  });
  wireSettings();
  els.btnMushafAdd.addEventListener('click', importMushaf);
  els.btnMushafRemove.addEventListener('click', removeMushafFromDevice);
  els.btnMushafOpen.addEventListener('click', () => { closeDialog(els.dlgMushaf); closeDialog(els.dlgSettings); setScript('mushaf'); });
  els.btnMushafSettings.addEventListener('click', openMushafDialog);

  // keyboard
  addEventListener('keydown', onKey);
  // After a mouse click, give the keyboard back to the page so Space, arrows and letters work as shortcuts.
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button') : null;
    if (b && e.detail > 0 && !b.closest('dialog')) b.blur();
  });

  // save before the tab is hidden or closed
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves(); });
  addEventListener('pagehide', () => flushSaves());
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && els.app.classList.contains('is-focus')) toggleFocus(false);
  });
}

function onKey(e) {
  if (document.body.classList.contains('modal-open') || isTyping(e)) return;
  const k = e.key;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && (k === 'z' || k === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && (k === 'y' || k === 'Y')) {
    e.preventDefault();
    redo();
    return;
  }
  if (mod || e.altKey) return;
  if ((k === ' ' || k === 'Enter') && e.target instanceof Element && e.target.closest('button, a, [role="tab"], summary, [tabindex]')) return;

  const lower = k.length === 1 ? k.toLowerCase() : k;
  const actions = {
    ArrowLeft: nextPage,
    ArrowRight: prevPage,
    v: () => setTool('pointer'),
    l: () => setTool('laser'),
    p: () => setTool('pen'),
    h: () => setTool('highlighter'),
    e: () => setTool('eraser'),
    m: () => setTool('mistake'),
    t: cycleHide,
    c: toggleTajweed,
    i: cycleScript,
    n: () => (S.hide !== 'off' ? revealNext() : togglePanel('student')),
    b: openBookmarkDialog,
    f: () => toggleFocus(),
    g: () => openNav('surah'),
    '/': openSearch,
    '?': () => openDialog(els.dlgHelp),
    ' ': playDefault,
    '+': () => zoomBy(1.15),
    '=': () => zoomBy(1.15),
    '-': () => zoomBy(1 / 1.15),
    _: () => zoomBy(1 / 1.15),
    0: zoomFit,
    Escape: () => {
      if (S.selection.length) setSelection([]);
      else if (!els.moreMenu.hidden) toggleMenu(false);
      else if (panelOpen()) closePanel();
      else if (S.tool !== 'pointer') setTool('pointer');
      else if (els.app.classList.contains('is-focus')) toggleFocus(false);
    },
  };
  if (/^[1-5]$/.test(k)) {
    if (S.selection.length) setHighlight(S.selection, HL[+k - 1].id);
    return;
  }
  const fn = actions[lower];
  if (!fn) return;
  e.preventDefault();
  fn();
}

// ---------------------------------------------------------------- start
boot().catch((err) => {
  console.error(err);
  const msg = document.getElementById('pageStateMsg');
  if (msg) {
    document.getElementById('pageState').hidden = false;
    msg.textContent = 'Something went wrong while starting. Reload the page to try again.';
  }
});
