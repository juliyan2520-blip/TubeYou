/* TubeYou v3 engine: monthly video race against four rivals with their own lanes and rules.
   Pure logic, deterministic from (seed, your actions). */
(function (root) {
'use strict';

/* ---------- utils ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash() { let h = 2166136261; for (let i = 0; i < arguments.length; i++) { h ^= (arguments[i] | 0); h = Math.imul(h, 16777619); h ^= h >>> 13; } return h >>> 0; }
function rngFor() { return mulberry32(hash.apply(null, arguments)); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clone = o => JSON.parse(JSON.stringify(o));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function fmt(n) { n = Math.round(n); const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'; if (a >= 1e4) return Math.round(n / 1e3) + 'K'; if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(n); }

/* ---------- packaging ---------- */
// thumbnail styles and title angles: base pull, how much they promise (clickbait), unlock level
const STYLES = {
  face:   { name: 'Face + text',   base: 1.0,  promise: 0.45, lvl: 1 },
  closeup:{ name: 'Close-up',      base: 0.92, promise: 0.35, lvl: 1 },
  before: { name: 'Before / after',base: 1.12, promise: 0.6,  lvl: 2 },
  shock:  { name: 'Shock + arrow', base: 1.3,  promise: 0.85, lvl: 2 },
  number: { name: 'Big number',    base: 1.05, promise: 0.5,  lvl: 3 },
  minimal:{ name: 'Minimal',       base: 0.95, promise: 0.25, lvl: 4 },
};
const ANGLES = {
  howto:   { name: 'How to',     base: 0.95, promise: 0.3,  lvl: 1 },
  tried:   { name: 'I tried it', base: 1.1,  promise: 0.5,  lvl: 1 },
  question:{ name: 'Question',   base: 1.0,  promise: 0.4,  lvl: 2 },
  bold:    { name: 'Bold claim', base: 1.25, promise: 0.85, lvl: 2 },
  list:    { name: 'Ranking',    base: 1.05, promise: 0.45, lvl: 3 },
  story:   { name: 'My story',   base: 1.08, promise: 0.35, lvl: 4 },
};
// which packaging fits which kind of lane (shown to you from Research level 3)
const FIT = {
  transform: { before: 1.25, number: 1.1, tried: 1.2, story: 1.1, minimal: 0.85 },
  science:   { minimal: 1.2, closeup: 1.15, question: 1.2, howto: 1.1, shock: 0.8, bold: 0.85 },
  trend:     { shock: 1.2, face: 1.1, bold: 1.15, question: 1.1, howto: 0.85 },
  howto:     { closeup: 1.15, number: 1.15, howto: 1.25, list: 1.15, story: 0.85 },
  lifestyle: { face: 1.2, story: 1.25, tried: 1.1, number: 0.9 },
};
const TITLE = {
  howto: n => n + ': the complete beginner guide', tried: n => 'I tried ' + n + ' for 30 days', question: n => 'Does ' + n + ' actually work?',
  bold: n => 'Stop doing ' + n + ' (here\'s why)', list: n => 'Ranking every ' + n + ' tip', story: n => 'How ' + n + ' changed everything for me',
};
const THUMBTXT = { howto: 'GUIDE', tried: '30 DAYS', question: 'WORKS?', bold: 'STOP', list: 'TOP 5', story: 'MY STORY' };
const SKILLS = {
  script: { name: 'Scripting', icon: '✍️', desc: 'Retention per hour of scripting.' },
  camera: { name: 'On-camera', icon: '🎥', desc: 'Retention per hour of filming. Level 5+: series can\'t be copied.' },
  edit:   { name: 'Editing', icon: '✂️', desc: 'Retention per hour of editing.' },
  thumb:  { name: 'Thumbnails', icon: '🖼️', desc: 'Click-through rate. Unlocks thumbnail styles.' },
  title:  { name: 'Titles', icon: '🔤', desc: 'Click-through rate. Unlocks title angles.' },
  research:{ name: 'Research', icon: '🔍', desc: 'Information. 2: trend timing. 3: packaging fit. 4: overused styles. 5: beat search authority. 6: see rivals\' plans.' },
  biz:    { name: 'Business', icon: '💼', desc: 'Sponsor pay. 2: hire staff. 4: launch merch.' },
};
const LVL = xp => clamp(Math.floor(Math.sqrt(Math.max(0, xp) / 8)) + 1, 1, 10);
const XPFOR = l => 8 * (l - 1) * (l - 1);

/* ---------- niches: lanes, topics and four rival archetypes ---------- */
// lane: [name, kind, owner archetype or null, topics [name, demand 1-3, evergreen]]
const NICHES = {
  glow: { name: 'Glow-up', rpm: 4.5, lanes: [
    ['Skincare', 'science', 'authority', [['retinol', 3, 1], ['sunscreen', 2, 1], ['acne scars', 3, 1], ['dark circles', 2, 1], ['niacinamide', 2, 1], ['budget skincare', 3, 1]]],
    ['Looksmaxxing', 'trend', 'sniper', [['mewing', 3, 0], ['jawline gum', 2, 0], ['bone smashing', 2, 0], ['canthal tilt', 2, 0], ['looksmax tier lists', 3, 0], ['hunter eyes', 2, 0]]],
    ['Gym', 'transform', 'community', [['push pull legs', 3, 1], ['cutting', 2, 1], ['home workouts', 2, 1], ['creatine', 3, 1], ['posture', 2, 1], ['calisthenics', 2, 1]]],
    ['Hair & style', 'lifestyle', null, [['haircuts for your face', 3, 1], ['curly hair', 2, 1], ['basic wardrobe', 2, 1], ['fragrance', 2, 1], ['beard growth', 2, 1], ['eyebrows', 1, 1]]],
    ['Debloat & diet', 'howto', null, [['debloating', 3, 1], ['protein', 2, 1], ['sugar', 2, 1], ['water retention', 2, 1], ['sleep for your face', 2, 1], ['caffeine', 1, 1]]],
  ], rivals: { authority: ['DermTheo', 'Dermatology-backed skincare. Slow, precise, trusted.'], sniper: ['MaxxMarco', 'Every looksmax trend, first, loud, clickbait.'], community: ['JasperLifts', 'Gym transformations with a loyal army of fans.'], copycat: ['CalClones', 'Remakes whatever worked last month, with more budget.'] } },
  gaming: { name: 'Gaming', rpm: 2.2, lanes: [
    ['Guides', 'howto', 'authority', [['boss guides', 3, 1], ['best builds', 3, 1], ['hidden secrets', 2, 1], ['beginner tips', 2, 1], ['speedrun routes', 1, 1], ['100% guides', 2, 1]]],
    ['Patch news', 'trend', 'sniper', [['new season', 3, 0], ['patch notes', 3, 0], ['leaks', 2, 0], ['nerfs', 2, 0], ['new map', 2, 0], ['event rewards', 2, 0]]],
    ['Challenges', 'transform', 'community', [['100 days', 3, 1], ['hardcore runs', 2, 1], ['no-hit runs', 2, 1], ['nuzlocke', 2, 1], ['permadeath', 2, 1], ['one-life runs', 2, 1]]],
    ['Indie gems', 'lifestyle', null, [['hidden indie games', 2, 1], ['cozy games', 2, 1], ['roguelikes', 2, 1], ['horror demos', 2, 1], ['pixel art games', 1, 1], ['retro remakes', 2, 1]]],
    ['Setups', 'science', null, [['budget PC', 3, 1], ['controllers', 2, 1], ['monitors', 2, 1], ['headsets', 2, 1], ['streaming setup', 2, 1], ['handhelds', 2, 1]]],
  ], rivals: { authority: ['GuideGuru', 'Definitive guides that rank for years.'], sniper: ['PatchRush', 'First on every patch and leak.'], community: ['CozyKira', 'Community challenges with a loyal chat.'], copycat: ['Remakr', 'Copies whatever blew up last month.'] } },
  tech: { name: 'Tech', rpm: 7, lanes: [
    ['Deep reviews', 'science', 'authority', [['phone cameras', 3, 1], ['laptop battery', 2, 1], ['earbuds', 2, 1], ['monitors', 2, 1], ['chargers', 1, 1], ['smartwatches', 2, 1]]],
    ['Launch news', 'trend', 'sniper', [['new phone launch', 3, 0], ['AI tools', 3, 0], ['leaked specs', 2, 0], ['price drops', 2, 0], ['foldables', 2, 0], ['smart glasses', 2, 0]]],
    ['Setups & builds', 'transform', 'community', [['desk setup', 3, 1], ['PC build', 3, 1], ['home office', 2, 1], ['cable management', 2, 1], ['budget setup', 2, 1], ['minimal setup', 2, 1]]],
    ['Student tech', 'howto', null, [['student laptops', 3, 1], ['study apps', 2, 1], ['tablets for notes', 2, 1], ['budget phones', 2, 1], ['productivity', 2, 1], ['note-taking', 1, 1]]],
    ['Tech life', 'lifestyle', null, [['what\'s on my phone', 2, 1], ['tech I regret', 2, 1], ['digital minimalism', 2, 1], ['EDC', 1, 1], ['one month without a phone', 2, 1], ['smart home', 2, 1]]],
  ], rivals: { authority: ['LabBench', 'Lab-tested reviews. Everyone cites them.'], sniper: ['LeakLord', 'Covers every launch within hours.'], community: ['SetupSam', 'Setup tours voted on by his community.'], copycat: ['Unboxd', 'Copies the videos that work, with a bigger budget.'] } },
  finance: { name: 'Finance', rpm: 13, lanes: [
    ['Investing', 'science', 'authority', [['index funds', 3, 1], ['ETFs', 3, 1], ['dividends', 2, 1], ['compound interest', 2, 1], ['bonds', 1, 1], ['stock picking', 2, 1]]],
    ['Hype', 'trend', 'sniper', [['crypto pumps', 3, 0], ['meme stocks', 3, 0], ['market crash', 2, 0], ['AI stocks', 2, 0], ['IPOs', 2, 0], ['rate cuts', 2, 0]]],
    ['Money challenges', 'transform', 'community', [['no-spend month', 3, 1], ['saving €10K', 3, 1], ['budget challenge', 2, 1], ['side hustle for 30 days', 2, 1], ['debt payoff', 2, 1], ['frugal week', 2, 1]]],
    ['Student money', 'howto', null, [['student budget', 3, 1], ['first job', 2, 1], ['student loans', 2, 1], ['taxes for students', 2, 1], ['saving apps', 1, 1], ['first investment', 2, 1]]],
    ['Money stories', 'lifestyle', null, [['how much I earn', 3, 1], ['what I spend in a month', 2, 1], ['money mistakes', 2, 1], ['living abroad costs', 2, 1], ['minimalism', 1, 1], ['FIRE', 2, 1]]],
  ], rivals: { authority: ['IndexIvan', 'Calm, evidence-based investing. Trusted for years.'], sniper: ['MoonBram', 'Every pump and crash, live, loud.'], community: ['FrugalFreya', 'Monthly money challenges with her community.'], copycat: ['CopyCash', 'Copies whatever blew up last month.'] } },
  commentary: { name: 'Commentary', rpm: 3, lanes: [
    ['Deep dives', 'science', 'authority', [['the downfall of a creator', 3, 1], ['internet mysteries', 2, 1], ['scam investigations', 3, 1], ['lost media', 2, 1], ['platform history', 2, 1], ['cult brands', 2, 1]]],
    ['Drama', 'trend', 'sniper', [['creator feud', 3, 0], ['apology video', 3, 0], ['exposed thread', 2, 0], ['cancelled tour', 2, 0], ['leaked DMs', 2, 0], ['brand fail', 2, 0]]],
    ['Reactions', 'transform', 'community', [['reacting to cringe', 3, 1], ['ranking viewer submissions', 2, 1], ['rating subscribers\' setups', 2, 1], ['react to my old videos', 2, 1], ['tier lists', 2, 1], ['live reacts', 2, 1]]],
    ['Culture', 'lifestyle', null, [['why everyone is lonely', 2, 1], ['dating apps', 3, 1], ['Gen Z work culture', 2, 1], ['nostalgia', 2, 1], ['internet slang', 1, 1], ['social media detox', 2, 1]]],
    ['Explainers', 'howto', null, [['how the algorithm works', 3, 1], ['why ads are everywhere', 2, 1], ['how influencers earn', 2, 1], ['how memes spread', 1, 1], ['how fame works', 2, 1], ['how scams work', 2, 1]]],
  ], rivals: { authority: ['DeepDiveDan', 'Hour-long investigations people binge.'], sniper: ['TeaSam', 'First on every drama, every time.'], community: ['ReactRae', 'Reacts with her community live.'], copycat: ['Echo', 'Copies whatever blew up last month.'] } },
  education: { name: 'Education', rpm: 5, lanes: [
    ['Science', 'science', 'authority', [['black holes', 3, 1], ['quantum physics', 2, 1], ['evolution', 2, 1], ['the brain', 3, 1], ['climate', 2, 1], ['chemistry myths', 2, 1]]],
    ['Viral facts', 'trend', 'sniper', [['viral math puzzle', 3, 0], ['space news', 3, 0], ['new discovery', 2, 0], ['myth going viral', 2, 0], ['Nobel prize', 2, 0], ['eclipse', 2, 0]]],
    ['Study challenges', 'transform', 'community', [['studying 12 hours', 3, 1], ['learning a language in 30 days', 3, 1], ['memory training', 2, 1], ['exam week', 2, 1], ['reading 50 books', 2, 1], ['learning to code', 2, 1]]],
    ['Study tips', 'howto', null, [['active recall', 3, 1], ['note-taking', 2, 1], ['focus', 3, 1], ['exam prep', 2, 1], ['speed reading', 2, 1], ['spaced repetition', 2, 1]]],
    ['History', 'lifestyle', null, [['ancient empires', 3, 1], ['forgotten wars', 2, 1], ['history of money', 2, 1], ['lost cities', 2, 1], ['inventions', 2, 1], ['famous mistakes', 2, 1]]],
  ], rivals: { authority: ['ProfPixel', 'Animated explainers that rank forever.'], sniper: ['FactFlash', 'First on every viral fact.'], community: ['StudyWithMo', 'Study-with-me challenges, huge community.'], copycat: ['Recap', 'Copies whatever blew up last month.'] } },
};
const ARCH = {
  authority: { label: 'Authority', edge: 'Ranks in search for months. Topics in his lane get −30% reach for you until Research 5. Clickbait in his lane gets you debunked.', moves: ['reply', 'collab'] },
  sniper:    { label: 'Trend sniper', edge: 'Jumps on every trend with clickbait. Beat him to a trend in its first month for +50% views.', moves: ['race', 'callout'] },
  community: { label: 'Community', edge: 'Loyal fans and a new challenge every 3 months. Join it to borrow his audience.', moves: ['challenge', 'collab'] },
  copycat:   { label: 'Copycat', edge: 'Remakes the best video of last month, often yours, and steals part of its long tail. Series videos (On-camera 5+) can\'t be copied.', moves: ['expose'] },
};
const PALETTE = { you: ['#0571D3', '#FF7A1A', '#FFFEFB'], authority: ['#0F6E56', '#E1F5EE', '#FFFFFF'], sniper: ['#E0201B', '#FFD21F', '#111111'], community: ['#534AB7', '#EEEDFE', '#26215C'], copycat: ['#5F5E5A', '#D3D1C7', '#2C2C2A'] };
const DIFF = { easy: { think: 0, start: 0.35 }, normal: { think: 1, start: 0.7 }, hard: { think: 2, start: 1 }, brutal: { think: 3, start: 1.5 } };
const START_SUBS = { authority: 9000, sniper: 5000, community: 7000, copycat: 1500 };
const MILESTONES = [
  { subs: 1000,    title: 'Monetized',          a: { k: 'cash', v: 500, label: '+€500 now' },          b: { k: 'xp', v: 40, label: '+40 XP to every skill' } },
  { subs: 10000,   title: '10K subscribers',    a: { k: 'hours', v: 10, label: '+10 hours every month' }, b: { k: 'trust', v: 10, label: '+10 trust' } },
  { subs: 100000,  title: 'Silver Play Button', a: { k: 'hours', v: 15, label: '+15 hours every month' }, b: { k: 'cash', v: 8000, label: '+€8,000 now' } },
  { subs: 1000000, title: 'Gold Play Button',   a: { k: 'community', v: 20, label: '+20 community' },   b: { k: 'cash', v: 60000, label: '+€60,000 now' } },
];
const ROLES = { editor: { name: 'Editor', icon: '✂️', desc: 'Adds edit hours to every video.' }, designer: { name: 'Thumbnail designer', icon: '🖼️', desc: 'Your thumbnails use their level if higher.' }, writer: { name: 'Scriptwriter', icon: '✍️', desc: 'Adds script hours to every video.' }, manager: { name: 'Manager', icon: '📋', desc: '+1 sponsor offer, +25% sponsor pay.' } };
const SPONSORS = { good: ['Nordvault VPN', 'Skillforge', 'Brightleaf meals', 'Studybuddy', 'Corefit protein', 'Lumen skincare'], meh: ['MegaMobile game', 'Glowz gummies', 'QuickTrade app'], sketchy: ['CryptoMoon', 'JawMax pills', 'Get-rich course'] };
const FIRST = ['Lena', 'Milo', 'Ana', 'Ivo', 'Sara', 'Noah', 'Eva', 'Luka', 'Mia', 'Finn', 'Nina', 'Teo', 'Iris', 'Dani', 'Yara', 'Ben', 'Zoe', 'Arjun', 'Maja', 'Leo'];

/* ---------- calendar & life ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dateOf(turn) { const m = 10 + (turn - 1); const y = 2026 + Math.floor(m / 12); const mm = m % 12; return { y, m: mm, label: MONTHS[mm] + ' ' + y, short: MONTHS[mm].slice(0, 3) + ' ' + String(y).slice(2) }; }
function lifeStage(c, turn) {
  const d = dateOf(turn); const bonus = c.bonusHours || 0;
  if (c.path === 'student') {
    if (turn <= 7) return (d.m === 4 || d.m === 5) ? { label: 'Final exams', hours: 25 + bonus, living: 0 } : { label: '12th grade', hours: 45 + bonus, living: 0 };
    if (turn <= 10) return { label: 'Summer break', hours: 110 + bonus, living: 0 };
    if (c.droppedOut) return { label: 'Full-time creator', hours: 100 + bonus, living: 1000 };
    if (turn === 11) return { label: 'Moving to the Netherlands', hours: 30 + bonus, living: 400 };
    if (turn >= 57) return { label: 'Graduated', hours: 100 + bonus, living: 1000 };
    const exam = d.m === 0 || d.m === 5 || d.m === 10;
    return exam ? { label: 'Uni exams', hours: 35 + bonus, living: 400 } : { label: 'University (BUas)', hours: 65 + bonus, living: 400 };
  }
  return { label: 'Full-time creator', hours: 95 + bonus, living: 950 };
}

/* ---------- setup ---------- */
function newGame(opts) {
  const seed = (opts.seed >>> 0) || ((Math.random() * 4294967295) >>> 0);
  const niche = NICHES[opts.niche] ? opts.niche : 'glow'; const N = NICHES[niche]; const diff = DIFF[opts.difficulty] ? opts.difficulty : 'normal';
  const path = opts.path === 'fulltime' ? 'fulltime' : 'student';
  const mk = (id, name, arch, lane) => ({ id, name, human: id === 0, arch, lane, palette: PALETTE[id === 0 ? 'you' : arch], subs: 100, peak: 100, money: path === 'fulltime' ? 4000 : 300, trust: 55, community: 10, stress: 15, burnout: 0,
    xp: { script: 0, camera: 0, edit: 0, thumb: 0, title: 0, research: 0, biz: 0 }, laneCount: [0, 0, 0, 0, 0], staff: [], staffSeq: 1, relation: {}, path, droppedOut: false, bonusHours: 0, milestones: [], pending: null, trending: 0, copiedBy: 0, product: null, flags: {} });
  const you = mk(0, opts.channelName || 'My Channel', null, -1);
  const archs = ['authority', 'sniper', 'community', 'copycat'];
  const creators = [you].concat(archs.map((a, i) => { let lane = N.lanes.findIndex(l => l[2] === a); if (lane < 0) lane = N.lanes.findIndex(l => !l[2]); const c = mk(i + 1, N.rivals[a][0], a, lane); c.subs = c.peak = Math.round(START_SUBS[a] * DIFF[diff].start); c.trust = a === 'authority' ? 75 : a === 'sniper' ? 40 : 55; c.community = a === 'community' ? 45 : 20; const lv = { authority: { script: 3, research: 5, edit: 3 }, sniper: { thumb: 4, title: 4, research: 2, script: 3, edit: 3 }, community: { camera: 4, edit: 3 }, copycat: { edit: 4, thumb: 3 } }[a]; Object.keys(lv).forEach(k => c.xp[k] = XPFOR(lv[k])); if (lane >= 0) c.laneCount[lane] = 6; return c; }));
  const st = { v: 3, seed, niche, mode: opts.mode || 'career', maxTurns: opts.mode === 'sprint' ? 12 : 60, difficulty: diff, turn: 1, creators, videos: [], vseq: 1, trends: [], styleUse: {}, history: [], insights: [], over: false, practice: !!opts.practice, challenge: null, events: [] };
  creators.forEach(c => c.start = c.subs);
  // rivals' back catalogue so their channels aren't empty
  creators.slice(1).forEach(c => { for (let k = 0; k < 6; k++) { const r = rngFor(seed, 3, c.id, k); const lane = r() < 0.75 ? c.lane : Math.floor(r() * 5); const ti = Math.floor(r() * 6); const spec = rivalSpec(st, c, { lane, i: ti }, r); const v = makeVideo(st, c, spec, -k); v.views = v.monthViews = Math.round(c.subs * (0.3 + r() * 0.8)); v.month = 0; v.q = 0.55; v.ctr = 0.05; st.videos.push(v); } });
  startTurn(st);
  return st;
}

/* ---------- derived ---------- */
const G = turn => Math.pow(1.015, turn - 1);
const lvl = (c, k) => LVL(c.xp[k]);
function influence(c) { return c.subs * (1 + c.community / 200 + c.trust / 400); }
function topicOf(st, t) { const L = NICHES[st.niche].lanes[t.lane]; return { lane: t.lane, i: t.i, name: L[3][t.i][0], demand: L[3][t.i][1], eg: !!L[3][t.i][2], laneName: L[0], kind: L[1], owner: L[2] }; }
function trendOn(st, t) { return st.trends.find(x => x.lane === t.lane && x.i === t.i && x.until >= st.turn); }
function identity(c, lane) { const tot = c.laneCount.reduce((a, b) => a + b, 0); if (tot < 3) return 1; return 0.75 + 0.6 * (c.laneCount[lane] / tot); }
function fatigue(st, style) { const u = st.styleUse[style] || 0; return clamp(1.12 - u * 0.045, 0.7, 1.12); }
function staffLvl(c, role) { return c.staff.filter(s => s.role === role).reduce((a, s) => Math.max(a, s.level), 0); }
function hoursUsed(st, id) { return (st.plan[id].videos || []).reduce((a, v) => a + v.hours.script + v.hours.film + v.hours.edit, 0) + st.plan[id].gym * 4 + st.plan[id].study.hours + st.plan[id].job; }
function hoursLeft(st, id) { return st.plan[id].budget - hoursUsed(st, id); }

/* ---------- predictions for one video (what the maker screen shows) ---------- */
function quality(st, c, spec) {
  const h = spec.hours; const ed = staffLvl(c, 'editor'), wr = staffLvl(c, 'writer');
  const s = (h.script + (wr ? 4 + wr : 0)) * (0.5 + 0.1 * lvl(c, 'script')), f = h.film * (0.5 + 0.1 * lvl(c, 'camera')), e = (h.edit + (ed ? 4 + ed : 0)) * (0.5 + 0.1 * lvl(c, 'edit'));
  // a video needs all three; scripting matters most
  const pts = 0.55 * s + 0.25 * f + 0.4 * e - 0.15 * Math.max(0, Math.max(s, f, e) - 3 * Math.min(s + 1, f + 1, e + 1));
  return clamp(1 - Math.exp(-Math.max(0, pts) / 9), 0.05, 0.97) * (c.stress > 75 ? 0.88 : 1);
}
function ctrOf(st, c, spec, tp) {
  const S = STYLES[spec.style], A = ANGLES[spec.angle]; const fit = FIT[tp.kind] || {};
  const tl = Math.max(lvl(c, 'thumb'), staffLvl(c, 'designer')), tt = lvl(c, 'title');
  return 0.035 * S.base * A.base * (fit[spec.style] || 1) * (fit[spec.angle] || 1) * (0.75 + 0.07 * tl) * (0.8 + 0.05 * tt) * fatigue(st, spec.style) * (0.75 + 0.5 * c.trust / 100);
}
function promise(spec) { return (STYLES[spec.style].promise + ANGLES[spec.angle].promise) / 2; }
function predict(st, c, spec) {
  const tp = topicOf(st, spec.topic); const q = quality(st, c, spec); const ctr = ctrOf(st, c, spec, tp); const pr = promise(spec);
  const tr = trendOn(st, spec.topic);
  return { q, ctr, promise: pr, clickbait: pr > q + 0.15, trend: tr ? (tr.start === st.turn ? 'early' : 'late') : null, tp, fit: (FIT[tp.kind] || {})[spec.style] || 1, afit: (FIT[tp.kind] || {})[spec.angle] || 1 };
}
function makeVideo(st, c, spec, turn) {
  const tp = topicOf(st, spec.topic); const kind = spec.kind || 'normal';
  spec = Object.assign({}, spec, { targetName: spec.targetName || (spec.target != null && st.creators[spec.target] ? st.creators[spec.target].name : '') });
  let title = TITLE[spec.angle](tp.name); let ttext = THUMBTXT[spec.angle];
  if (kind === 'reply') { title = 'Responding to ' + spec.targetName + ' on ' + tp.name; ttext = 'REPLY'; }
  if (kind === 'callout') { title = spec.targetName + ' is lying to you about ' + tp.name; ttext = 'EXPOSED'; }
  if (kind === 'challenge') { title = 'I joined the ' + tp.name + ' challenge'; ttext = 'DAY 1'; }
  if (kind === 'expose') { title = spec.targetName + ' keeps copying me'; ttext = 'COPIED'; }
  if (kind === 'collab') { title = tp.name + ' ft. ' + spec.targetName; ttext = 'COLLAB'; }
  if (kind === 'debunk') { title = 'Debunking ' + spec.targetName + '\'s ' + tp.name + ' video'; ttext = 'FALSE'; }
  if (kind === 'copy') { title = TITLE[spec.angle](tp.name).replace('30 days', '60 days'); }
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { id: st.vseq++, by: c.id, month: turn, topic: { lane: spec.topic.lane, i: spec.topic.i }, style: spec.style, angle: spec.angle, kind, target: spec.target, title, ttext, word: tp.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 10), hours: spec.hours, q: 0, ctr: 0, views: 0, monthViews: 0, subs: 0, sponsor: spec.sponsor || null, series: !!spec.series, eg: tp.eg };
}

/* ---------- month start ---------- */
function startTurn(st) {
  const t = st.turn; const N = NICHES[st.niche]; const r = rngFor(st.seed, 11, t);
  // new trends: one or two topics heat up for two months (first month = early)
  const nT = 1 + (r() < 0.45 ? 1 : 0);
  for (let k = 0; k < nT; k++) { const lane = r() < 0.5 ? N.lanes.findIndex(l => l[1] === 'trend') : Math.floor(r() * 5); const i = Math.floor(r() * 6); if (!st.trends.some(x => x.lane === lane && x.i === i && x.until >= t)) st.trends.push({ lane, i, start: t, until: t + 1, size: 1 + Math.floor(r() * 2) }); }
  st.trends = st.trends.filter(x => x.until >= t - 1);
  // community rival starts a challenge every three months
  const com = st.creators.find(c => c.arch === 'community');
  if ((t - 1) % 3 === 0) st.challenge = { by: com.id, lane: com.lane, i: Math.floor(r() * 6), until: t + 1 };
  if (st.challenge && st.challenge.until < t) st.challenge = null;
  const d = dateOf(t); st.mods = { rpm: d.m === 10 || d.m === 11 ? 1.35 : d.m === 0 ? 0.75 : 1 };
  st.events = [];
  if (d.m === 10) st.events.push({ icon: '💰', title: 'Q4 ad season', text: 'Ad pay is 35% higher in November and December.' });
  if (d.m === 0) st.events.push({ icon: '📉', title: 'January dip', text: 'Ad pay is 25% lower this month.' });
  // per-creator plans, offers
  st.plan = {}; st.offers = {};
  st.creators.forEach(c => {
    const life = lifeStage(c, t); let budget = c.human || c.path === 'student' ? life.hours : life.hours;
    if (!c.human) budget = { easy: 50, normal: 58, hard: 68, brutal: 80 }[st.difficulty];
    if (c.burnout) budget = Math.round(budget * 0.25);
    st.plan[c.id] = { budget, life, videos: [], gym: 0, study: { skill: 'script', hours: 0 }, job: 0 };
    const cr = rngFor(st.seed, 13, t, c.id); const o = { sponsors: [], candidates: [] };
    if (c.subs >= 3000) { const n = 1 + (staffLvl(c, 'manager') ? 1 : 0); for (let i = 0; i < n; i++) { const x = cr(); const q = x < 0.5 ? 'good' : x < 0.8 ? 'meh' : 'sketchy'; const pay = (80 + c.subs * 0.02) * (1 + 0.06 * lvl(c, 'biz')) * (q === 'sketchy' ? 2.2 : q === 'meh' ? 1.3 : 1) * (staffLvl(c, 'manager') ? 1.25 : 1); o.sponsors.push({ id: i, brand: pick(cr, SPONSORS[q]), quality: q, pay: Math.round(pay / 10) * 10, taken: false }); } }
    if (lvl(c, 'biz') >= 2) { for (let i = 0; i < 3; i++) { const role = pick(cr, Object.keys(ROLES)); const level = clamp(2 + Math.floor(cr() * (2 + Math.log10(Math.max(10, c.subs) / 1000) * 1.5)), 2, 9); o.candidates.push({ id: i, name: pick(cr, FIRST), role, level, salary: Math.round((150 + level * level * 45) / 10) * 10, hired: false }); } }
    st.offers[c.id] = o;
    if (c.pending == null) { const m = MILESTONES.findIndex((x, i) => c.peak >= x.subs && !c.milestones.includes(i)); if (m >= 0) c.pending = m; }
  });
  // rivals decide now: they never see what you post this month
  st.creators.forEach(c => { if (!c.human) aiPlan(st, c); });
}

/* ---------- topic cards for you this month ---------- */
function topicCards(st) {
  const N = NICHES[st.niche]; const r = rngFor(st.seed, 19, st.turn); const out = []; const seen = new Set();
  const add = (o) => { const k = o.lane + ':' + o.i + ':' + (o.kind || ''); if (seen.has(k)) return; seen.add(k); out.push(o); };
  st.trends.filter(x => x.until >= st.turn).forEach(x => add({ lane: x.lane, i: x.i }));
  N.lanes.forEach((L, lane) => { add({ lane, i: Math.floor(r() * 6) }); add({ lane, i: Math.floor(r() * 6) }); });
  const me = st.creators[0];
  // rival-specific moves
  st.creators.slice(1).forEach(c => {
    const last = st.videos.filter(v => v.by === c.id && v.month === st.turn - 1).sort((a, b) => b.views - a.views)[0];
    if (c.arch === 'authority' && last) add({ lane: last.topic.lane, i: last.topic.i, kind: 'reply', target: c.id, ref: last.id });
    if (c.arch === 'sniper' && last && promise(last) > 0.6) add({ lane: last.topic.lane, i: last.topic.i, kind: 'callout', target: c.id, ref: last.id });
    if (c.arch === 'copycat' && me.copiedBy >= 2 && !me.flags.exposed) add({ lane: c.lane >= 0 ? c.lane : 0, i: 0, kind: 'expose', target: c.id });
  });
  if (st.challenge && st.challenge.until >= st.turn) add({ lane: st.challenge.lane, i: st.challenge.i, kind: 'challenge', target: st.challenge.by });
  const collab = st.creators.find(c => c.flags.collabOk === st.turn && c.id !== 0);
  if (collab) add({ lane: collab.lane, i: Math.floor(r() * 6), kind: 'collab', target: collab.id });
  return out;
}

/* ---------- your actions ---------- */
function act(st, id, a) {
  const c = st.creators[id]; const P = st.plan[id];
  switch (a.type) {
    case 'video': {
      const spec = a.spec; const h = spec.hours; const total = h.script + h.film + h.edit;
      if (total < 3) return { err: 'A video needs at least 3 hours.' };
      if (total > hoursLeft(st, id)) return { err: 'Not enough hours left this month.' };
      if (STYLES[spec.style].lvl > lvl(c, 'thumb') && staffLvl(c, 'designer') < STYLES[spec.style].lvl) return { err: 'Thumbnails level ' + STYLES[spec.style].lvl + ' needed.' };
      if (ANGLES[spec.angle].lvl > lvl(c, 'title')) return { err: 'Titles level ' + ANGLES[spec.angle].lvl + ' needed.' };
      if (spec.kind === 'collab' && P.videos.some(v => v.kind === 'collab')) return { err: 'One collab per month.' };
      if (spec.sponsor != null) { const sp = st.offers[id].sponsors.find(x => x.id === spec.sponsor); if (!sp || sp.taken) return { err: 'Sponsor gone.' }; sp.taken = true; }
      P.videos.push(clone(spec)); return { ok: true };
    }
    case 'unvideo': { const v = P.videos[a.index]; if (!v) return { err: 'Gone.' }; if (v.sponsor != null) { const sp = st.offers[id].sponsors.find(x => x.id === v.sponsor); if (sp) sp.taken = false; } P.videos.splice(a.index, 1); return { ok: true }; }
    case 'gym': { const n = clamp(a.n, 0, 12); const prev = P.gym; P.gym = n; if (hoursLeft(st, id) < 0) { P.gym = prev; return { err: 'Not enough hours.' }; } return { ok: true }; }
    case 'study': { const prev = clone(P.study); P.study = { skill: SKILLS[a.skill] ? a.skill : P.study.skill, hours: clamp(a.hours, 0, 200) }; if (hoursLeft(st, id) < 0) { P.study = prev; return { err: 'Not enough hours.' }; } return { ok: true }; }
    case 'job': { const prev = P.job; P.job = clamp(a.hours, 0, 160); if (hoursLeft(st, id) < 0) { P.job = prev; return { err: 'Not enough hours.' }; } return { ok: true }; }
    case 'milestone': { if (c.pending == null) return { err: 'No milestone.' }; const m = MILESTONES[c.pending]; const ch = a.choice === 'b' ? m.b : m.a; if (ch.k === 'cash') c.money += ch.v; if (ch.k === 'xp') Object.keys(c.xp).forEach(k => c.xp[k] += ch.v); if (ch.k === 'hours') { c.bonusHours += ch.v; P.budget += ch.v; } if (ch.k === 'trust') c.trust = clamp(c.trust + ch.v, 0, 100); if (ch.k === 'community') c.community = clamp(c.community + ch.v, 0, 100); c.milestones.push(c.pending); c.pending = null; const m2 = MILESTONES.findIndex((x, i) => c.peak >= x.subs && !c.milestones.includes(i)); if (m2 >= 0) c.pending = m2; return { ok: true, label: ch.label }; }
    case 'hire': { if (lvl(c, 'biz') < 2) return { err: 'Business level 2 needed.' }; const cd = st.offers[id].candidates.find(x => x.id === a.cand && !x.hired); if (!cd) return { err: 'Gone.' }; if (c.money < cd.salary) return { err: 'You need at least one month of salary (€' + cd.salary + ').' }; cd.hired = true; c.staff.push({ id: c.staffSeq++, name: cd.name, role: cd.role, level: cd.level, salary: cd.salary }); return { ok: true }; }
    case 'fire': { c.staff = c.staff.filter(s => s.id !== a.staff); return { ok: true }; }
    case 'merch': { if (lvl(c, 'biz') < 4 || c.product) return { err: 'Business level 4 needed.' }; if (c.money < 2500) return { err: 'Merch costs €2,500.' }; c.money -= 2500; c.product = { start: st.turn, decay: 1, total: 0 }; return { ok: true }; }
    case 'dropout': { if (c.path !== 'student' || st.turn < 11 || c.droppedOut) return { err: 'Not possible now.' }; c.droppedOut = true; return { ok: true }; }
    case 'askCollab': {
      const r = st.creators[a.to]; const relv = r.relation[0] || 0;
      if (r.flags.collabAsked === st.turn) return { err: 'You already asked this month.' };
      r.flags.collabAsked = st.turn;
      const need = r.arch === 'authority' ? (c.trust >= 60 && c.subs >= r.subs * 0.25) : (c.subs >= r.subs * 0.3 || relv >= 30);
      if (r.arch === 'copycat' || r.arch === 'sniper') return { err: r.name + ' doesn\'t do collabs.' };
      if (!need) return { err: r.arch === 'authority' ? r.name + ' only collabs with trusted channels (trust 60+, 25% of his size).' : 'You\'re too small for ' + r.name + ' right now (30% of their size).' };
      if (st.creators[0].subs > r.subs * 1.3) return { err: 'You\'re bigger now. ' + r.name + ' won\'t help a rival grow.' };
      r.flags.collabOk = st.turn; return { ok: true, collab: true };
    }
  }
  return { err: 'Unknown action.' };
}

/* ---------- rivals ---------- */
function rivalSpec(st, c, topic, r) {
  const a = c.arch; const think = DIFF[st.difficulty].think;
  const styles = { authority: ['minimal', 'closeup', 'face'], sniper: ['shock', 'face', 'before'], community: ['before', 'face', 'number'], copycat: ['face', 'number', 'before'] }[a];
  const angles = { authority: ['howto', 'question', 'list'], sniper: ['bold', 'question', 'tried'], community: ['tried', 'story', 'list'], copycat: ['list', 'tried', 'howto'] }[a];
  let style = styles[Math.floor(r() * styles.length)], angle = angles[Math.floor(r() * angles.length)];
  if (think >= 2) { const sorted = styles.slice().sort((x, y) => fatigue(st, y) - fatigue(st, x)); style = sorted[0]; }
  const per = { authority: [8, 3, 6], sniper: [5, 3, 5], community: [5, 7, 6], copycat: [6, 4, 8] }[a];
  const k = 1 + think * 0.12;
  return { topic, style, angle, hours: { script: Math.round(per[0] * k), film: Math.round(per[1] * k), edit: Math.round(per[2] * k) } };
}
function aiPlan(st, c) {
  const r = rngFor(st.seed, 23, st.turn, c.id); const P = st.plan[c.id]; const think = DIFF[st.difficulty].think; const N = NICHES[st.niche];
  if (c.stress > 45) P.gym = c.stress > 70 ? 4 : 2;
  const cap = c.arch === 'sniper' ? 4 : 3; const nv0 = () => P.videos.length;
  const add = (topic, extra) => { if (nv0() >= cap) return; const spec = Object.assign(rivalSpec(st, c, topic, r), extra || {}); const h = spec.hours.script + spec.hours.film + spec.hours.edit; if (h <= hoursLeft(st, c.id)) P.videos.push(spec); };
  const trends = st.trends.filter(x => x.until >= st.turn);
  const me = st.creators[0];
  const lastMine = st.videos.filter(v => v.month === st.turn - 1);
  if (c.arch === 'authority') {
    // debunk clickbait in his lane
    const bait = lastMine.filter(v => v.by === 0 && v.topic.lane === c.lane && promise(v) > v.q + 0.15).sort((a, b) => b.views - a.views)[0];
    if (bait) add(bait.topic, { kind: 'debunk', target: 0, targetName: me.name });
    for (let k = 0; k < 3; k++) add({ lane: c.lane, i: Math.floor(r() * 6) });
  }
  if (c.arch === 'sniper') {
    trends.sort((a, b) => (b.start === st.turn) - (a.start === st.turn)).forEach(x => add({ lane: x.lane, i: x.i }));
    // brutal sniper guesses which trend you'll take: the one in your strongest lane
    if (think >= 3 && trends.length) { const myLane = me.laneCount.indexOf(Math.max(...me.laneCount)); const x = trends.find(y => y.lane === myLane); if (x) add({ lane: x.lane, i: x.i }); }
    if (c.flags.calledOut === st.turn - 1) add({ lane: c.lane, i: Math.floor(r() * 6) }, { kind: 'callout', target: 0, targetName: me.name, angle: 'bold', style: 'shock' });
    for (let k = 0; k < 5; k++) add({ lane: c.lane, i: Math.floor(r() * 6) });
  }
  if (c.arch === 'community') {
    if (st.challenge && st.challenge.by === c.id) add({ lane: st.challenge.lane, i: st.challenge.i }, { kind: 'normal', angle: 'tried', style: 'before' });
    for (let k = 0; k < 3; k++) add({ lane: c.lane, i: Math.floor(r() * 6) });
  }
  if (c.arch === 'copycat') {
    // copy the best non-series video from last month (prefers yours from Hard up)
    const pool = lastMine.filter(v => v.by !== c.id && !v.series && v.kind === 'normal').sort((a, b) => (b.views * (b.by === 0 && think >= 2 ? 1.6 : 1)) - (a.views * (a.by === 0 && think >= 2 ? 1.6 : 1)));
    if (pool[0]) { const o = pool[0]; add(o.topic, { kind: 'copy', target: o.by, ref: o.id, style: o.style, angle: o.angle }); if (think >= 1 && pool[1]) add(pool[1].topic, { kind: 'copy', target: pool[1].by, ref: pool[1].id, style: pool[1].style, angle: pool[1].angle }); }
    for (let k = 0; k < 3; k++) { const x = trends[k] || { lane: Math.floor(r() * 5), i: Math.floor(r() * 6) }; add({ lane: x.lane, i: x.i }); }
  }
  P.study = { skill: ['script', 'thumb', 'edit', 'research', 'camera', 'title'][st.turn % 6], hours: Math.max(0, Math.min(10, hoursLeft(st, c.id))) };
  // hire when rich
  if (c.money > 6000 && c.staff.length < 2 && lvl(c, 'biz') >= 2) { const cd = st.offers[c.id].candidates[0]; if (cd) act(st, c.id, { type: 'hire', cand: cd.id }); }
}

/* ---------- month end ---------- */
function endTurn(stIn) {
  const st = clone(stIn); const N = NICHES[st.niche]; const g = G(st.turn); const turn = st.turn;
  const fresh = [];
  st.creators.forEach(c => st.plan[c.id].videos.forEach(spec => { const v = makeVideo(st, c, spec, turn); v._spec = spec; fresh.push(v); }));
  // packaging fatigue counts what everyone posted this month
  const useNow = {}; fresh.forEach(v => useNow[v.style] = (useNow[v.style] || 0) + 1);
  const sameTopic = {}; fresh.forEach(v => { const k = v.topic.lane + ':' + v.topic.i; sameTopic[k] = (sameTopic[k] || 0) + 1; });
  const sameLane = {}; fresh.forEach(v => sameLane[v.topic.lane] = (sameLane[v.topic.lane] || 0) + 1);
  const notes = { 0: [] }; st.creators.forEach(c => notes[c.id] = notes[c.id] || []);
  // first-mover: who posted each early trend
  fresh.forEach(v => {
    const c = st.creators[v.by]; const tp = topicOf(st, v.topic); const spec = v._spec;
    const q = quality(st, c, spec); const ctr = ctrOf(st, c, spec, tp); v.q = q; v.ctr = ctr;
    const tr = trendOn(st, v.topic);
    let demand = tp.demand * (tr ? (tr.start === turn ? 3.2 : 2) * (1 + 0.3 * (tr.size - 1)) : 1);
    let reach = (4000 * demand + 2.2 * Math.pow(c.subs, 0.85) * identity(c, v.topic.lane)) * g;
    if (tp.owner === 'authority' && c.arch !== 'authority' && lvl(c, 'research') < 5 && v.kind !== 'collab') reach *= 0.7;
    if (c.trending > 0) reach *= 1.25;
    const others = sameTopic[v.topic.lane + ':' + v.topic.i] - 1; reach /= (1 + 0.45 * others);
    reach /= (1 + 0.06 * (sameLane[v.topic.lane] - 1));
    // early trend: whoever is there first month gets the wave, more if the sniper isn't there
    if (tr && tr.start === turn) { const sniperIn = fresh.some(o => o !== v && st.creators[o.by].arch === 'sniper' && o.topic.lane === v.topic.lane && o.topic.i === v.topic.i); if (!sniperIn && c.arch !== 'sniper') reach *= 1.5; }
    // special kinds
    if (v.kind === 'reply' || v.kind === 'callout' || v.kind === 'debunk' || v.kind === 'expose') { const tgt = st.creators[v.target]; reach += Math.pow(tgt.subs, 0.85) * 0.8 * g; }
    if (v.kind === 'challenge' && v.target !== c.id) { const tgt = st.creators[v.target]; reach += Math.pow(tgt.subs, 0.85) * 0.6 * (0.5 + tgt.community / 100); }
    if (v.kind === 'collab') { const tgt = st.creators[v.target]; reach += Math.pow(tgt.subs, 0.85) * 1.5; }
    const clickbait = promise(v) > q + 0.15;
    let views = reach * ctr * 10 * (0.45 + q) * (clickbait ? 0.85 : 1);
    if (v.sponsor != null) views *= 0.95;
    v.views = views; v.monthViews = views;
    let conv = 0.045 / Math.sqrt(1 + c.subs / 250000) * q * (0.6 + 0.8 * c.trust / 100) * identity(c, v.topic.lane) * N.lanes.length / 5;
    if (v.series) conv *= 1.25;
    v.subs = views * conv;
    // trust consequences
    if (clickbait) c.trust -= (promise(v) - q) * 5;
    else c.trust += (q - 0.5) * 2;
    if (v.kind === 'callout') { c.trust -= 3; st.creators[v.target].trust -= 6; st.creators[v.target].flags.calledOut = turn; rel(st, v.target, c.id, -30); notes[v.target].push(c.name + ' called you out.'); }
    if (v.kind === 'debunk') { st.creators[v.target].trust -= 7; notes[v.target].push(c.name + ' debunked your video. Trust −7.'); }
    if (v.kind === 'reply') { const tgt = st.creators[v.target]; const ref = st.videos.find(x => x.id === v.ref); if (ref && q > ref.q) { c.trust += 2; tgt.trust -= 1; } else c.trust -= 1; rel(st, v.target, c.id, q > (ref ? ref.q : 0.5) ? -5 : 5); }
    if (v.kind === 'expose') { const tgt = st.creators[v.target]; tgt.trust -= 10; c.trust += 4; c.flags.exposed = true; rel(st, v.target, c.id, -40); }
    if (v.kind === 'challenge' && v.target !== c.id) { rel(st, v.target, c.id, 12); st.creators[v.target].subs += v.subs * 0.25; }
    if (v.kind === 'collab') { const tgt = st.creators[v.target]; c.trust += 3; tgt.subs += v.subs * 0.3; rel(st, v.target, c.id, 15); }
    if (v.kind === 'copy') { const orig = st.videos.find(x => x.id === v.ref); if (orig) { orig.copied = true; if (orig.by === 0) { st.creators[0].copiedBy++; notes[0].push(c.name + ' copied your video "' + orig.title + '".'); } } }
    if (v.sponsor != null) { const sp = st.offers[c.id].sponsors.find(x => x.id === v.sponsor); if (sp) { c.money += sp.pay; c.trust += sp.quality === 'good' ? 0.5 : sp.quality === 'meh' ? -2 : -6; } }
    c.laneCount[v.topic.lane]++;
    // skill XP from doing
    const h = spec.hours; c.xp.script += h.script; c.xp.camera += h.film; c.xp.edit += h.edit; c.xp.thumb += 3; c.xp.title += 3; c.xp.research += 2;
  });
  // long tail: older videos keep earning (evergreen much more), copies steal some
  const tail = {}; st.creators.forEach(c => tail[c.id] = { views: 0, subs: 0 });
  st.videos.forEach(v => {
    const age = turn - v.month; if (age < 1) return; const c = st.creators[v.by];
    const base = (v.monthViews || 0) * (v.eg ? 0.22 : 0.04) * Math.pow(v.eg ? 0.9 : 0.5, age - 1) * (v.copied ? 0.7 : 1);
    v.views += base; tail[v.by].views += base; tail[v.by].subs += base * 0.006 * v.q;
  });
  st.videos = st.videos.concat(fresh.map(v => { delete v._spec; return v; }));
  st.videos = st.videos.filter(v => turn - v.month < 30 || v.by === 0); // keep memory small
  // rank this month's feed; #1 gets trending boost next month
  const ranked = fresh.slice().sort((a, b) => b.views - a.views);
  st.creators.forEach(c => c.trending = Math.max(0, c.trending - 1));
  if (ranked[0]) { st.creators[ranked[0].by].trending = 1; }
  // totals per creator
  const rep = {};
  st.creators.forEach(c => {
    const mine = fresh.filter(v => v.by === c.id); const P = st.plan[c.id]; const life = P.life;
    const views = mine.reduce((a, v) => a + v.views, 0) + tail[c.id].views;
    const gained = mine.reduce((a, v) => a + v.subs, 0) + tail[c.id].subs;
    const churn = c.subs * (mine.length === 0 ? 0.04 : 0.008) * (1 - c.community / 150);
    const prev = c.subs; c.subs = Math.max(0, c.subs + gained - churn); c.peak = Math.max(c.peak, c.subs);
    const ads = c.peak >= 1000 ? views * N.rpm / 1000 * st.mods.rpm : 0;
    let merch = 0; if (c.product) { merch = c.community / 100 * c.subs * 0.003 * 18 * (0.6 + 0.8 * c.trust / 100) * c.product.decay; c.product.decay *= 0.9; c.product.total += merch; }
    const wages = P.job * 12; const salaries = c.staff.reduce((a, s) => a + s.salary, 0);
    c.money += ads + merch + wages - life.living - (c.human ? salaries : salaries * 0.5);
    // community grows with regular uploads and replies
    c.community = clamp(c.community + mine.length * 0.8 + (mine.length >= 2 ? 1 : -2) - c.community * 0.03 + (c.arch === 'community' ? 1.5 : 0), 0, 100);
    c.trust = clamp(c.trust + (55 - c.trust) * 0.06, 0, 100);
    // study XP, stress
    c.xp[P.study.skill] += P.study.hours * 1.6;
    c.xp.biz += c.staff.length * 2 + (c.subs >= 3000 ? 1 : 0);
    const used = hoursUsed(st, c.id); const load = P.budget > 0 ? used / P.budget : 0;
    if (c.burnout) { c.burnout = 0; c.stress = 40; }
    else { c.stress = clamp(c.stress + load * 26 - 14 - P.gym * 5 + (c.money < 0 ? 8 : 0) + c.staff.length, 0, 100); if (c.stress >= 100) { c.burnout = 1; notes[c.id].push('Burnout. Next month you only have a quarter of your hours.'); } }
    rep[c.id] = { views: Math.round(views), subs: Math.round(c.subs - prev), ads: Math.round(ads), merch: Math.round(merch), wages, tail: Math.round(tail[c.id].views), videos: mine.map(v => v.id) };
  });
  // fatigue memory
  Object.keys(STYLES).forEach(s => { st.styleUse[s] = (st.styleUse[s] || 0) * 0.6 + (useNow[s] || 0); });
  if (st.creators[0].pending == null) { const c = st.creators[0]; const m = MILESTONES.findIndex((x, i) => c.peak >= x.subs && !c.milestones.includes(i)); if (m >= 0) c.pending = m; }
  st.insights.push(insights(stIn, st, fresh, rep));
  st.log = { turn, date: dateOf(turn).label, feed: ranked.map(v => v.id), rep, notes: notes[0], crown: ranked[0] ? ranked[0].by : -1 };
  st.history.push({ turn, c: st.creators.map(c => ({ s: Math.round(c.subs), i: Math.round(influence(c)), m: Math.round(c.money) })) });
  st.turn++;
  checkEnd(st);
  if (!st.over) startTurn(st);
  return st;
}
function rel(st, from, to, d) { const c = st.creators[from]; c.relation[to] = clamp((c.relation[to] || 0) + d, -100, 100); }
function insights(prev, st, fresh, rep) {
  const out = []; const mine = fresh.filter(v => v.by === 0); const me0 = prev.creators[0]; const P = prev.plan[0];
  mine.forEach(v => { if (promise(v) > v.q + 0.15) out.push({ k: 'clickbait', w: 3, text: '"' + v.title + '" promised more than it delivered (retention ' + Math.round(v.q * 100) + '%). Trust dropped.' }); });
  mine.forEach(v => { if (fatigue(prev, v.style) < 0.9) out.push({ k: 'fatigue', w: 2, text: STYLES[v.style].name + ' thumbnails were overused that month, so your click-through suffered.' }); });
  mine.forEach(v => { const n = fresh.filter(o => o !== v && o.topic.lane === v.topic.lane && o.topic.i === v.topic.i).length; if (n >= 2) out.push({ k: 'crowded', w: 2.5, text: n + ' other videos covered "' + topicOf(prev, v.topic).name + '" the same month. Views were split.' }); });
  mine.forEach(v => { if (identity(me0, v.topic.lane) < 0.85) out.push({ k: 'identity', w: 1.5, text: '"' + v.title + '" was outside what your audience follows you for. Fewer viewers subscribed.' }); });
  prev.trends.filter(x => x.start === prev.turn).forEach(x => { if (!mine.some(v => v.topic.lane === x.lane && v.topic.i === x.i)) out.push({ k: 'trend', w: 2, text: 'Missed the early wave on "' + topicOf(prev, x).name + '".' }); });
  const left = P.budget - hoursUsed(prev, 0); if (left > 15 && me0.stress < 45) out.push({ k: 'idle', w: 1.5, text: left + ' hours unused while your stress was low.' });
  if (st.creators[0].burnout) out.push({ k: 'burnout', w: 6, text: 'Burnout: you planned too much without rest.' });
  if (!mine.length) out.push({ k: 'none', w: 4, text: 'No videos this month. Subscribers drifted away.' });
  return { turn: prev.turn, date: dateOf(prev.turn).label, items: out, gain: rep[0].subs };
}
function standings(st) { return st.creators.map(c => ({ id: c.id, name: c.name, score: st.mode === 'sprint' ? c.subs - (c.start || 0) : c.subs, subs: c.subs, money: c.money })).sort((a, b) => b.score - a.score); }
function checkEnd(st) {
  if (st.mode === 'race') { const w = st.creators.filter(c => c.subs >= 1e6).sort((a, b) => b.subs - a.subs)[0]; if (w) { st.over = true; st.winner = w.id; st.endReason = w.name + ' hit 1M subscribers first.'; return; } }
  if (st.turn > st.maxTurns) { st.over = true; st.winner = standings(st)[0].id; st.endReason = st.mode === 'sprint' ? 'One year is up.' : 'Five years are up.'; }
}

/* ---------- replay ---------- */
function replay(save, upTo) {
  let st = newGame(save.opts); const lim = upTo == null ? save.turns.length : Math.min(upTo - 1, save.turns.length);
  for (let i = 0; i < lim; i++) { (save.turns[i] || []).forEach(a => act(st, 0, a)); st = endTurn(st); }
  return st;
}

const api = { NICHES, STYLES, ANGLES, FIT, SKILLS, ARCH, ROLES, MILESTONES, DIFF, LVL, XPFOR, newGame, act, endTurn, replay, predict, topicCards, topicOf, trendOn, lifeStage, dateOf, hoursLeft, hoursUsed, lvl, fatigue, identity, influence, standings, promise, fmt, clone, staffLvl };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TubeYou = api;
})(typeof window !== 'undefined' ? window : this);
