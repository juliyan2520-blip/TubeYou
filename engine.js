/* TubeYou engine: pure game logic, no DOM. Deterministic from (seed, decisions). */
(function (root) {
'use strict';

/* ---------- RNG ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash() { let h = 2166136261; for (let i = 0; i < arguments.length; i++) { h ^= (arguments[i] | 0); h = Math.imul(h, 16777619); h ^= h >>> 13; } return h >>> 0; }
function rngFor() { return mulberry32(hash.apply(null, arguments)); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const clone = o => JSON.parse(JSON.stringify(o));
const round = Math.round;

/* ---------- Constants ---------- */
const DAYS = 60;
const WAKING = 16;
const START = { year: 2026, month: 10 }; // Nov 2026 (0-based month)
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const NICHES = {
  glow: { name: 'Glow-up', desc: 'Skincare, physique, grooming. Evergreen search is strong and trust matters.', rpm: 4.5, eg: 0.32, trend: 1.0, conv: 1.05, disc: 1.0, cap: 8e6, sponsor: 1.0, trustSens: 1.2, comm: 1.1, preview: 1,
    rivals: ['Theo Glows', 'Marco Maxxing', 'Jasper Lifts', 'Clearskin Cal'],
    trends: ['Mewing debunk','Skincare under €20','90-day gym transformation','Looksmax tier lists','Debloat morning routine','Haircut for face shape','Posture fix','Fragrance for school','Celebrity glow-up breakdown','Jawline gum test','Sleep for skin','Teeth whitening myths','Style basics for guys','Body-fat % visual guide','Creatine myths'] },
  gaming: { name: 'Gaming', desc: 'Huge, fast trends. Low ad pay, weak evergreen.', rpm: 2.2, eg: 0.12, trend: 1.9, conv: 0.85, disc: 1.15, cap: 2e7, sponsor: 0.8, trustSens: 0.8, comm: 1.2, preview: 1,
    rivals: ['PixelPete', 'Rushwick', 'LagLord', 'Cozy Kira'],
    trends: ['Battle royale new season','Speedrun record','Indie hidden gem','Patch notes drama','Retro remake','Hardest boss ranking','Modded chaos','Esports upset','Open-world launch','Gacha banner','Hardcore 100 days','Console war','Big game leak','Cozy game wave','Horror demo'] },
  tech: { name: 'Tech', desc: 'Launch calendar is known ahead (you see all next-season trends). High sponsor pay.', rpm: 7, eg: 0.22, trend: 1.3, conv: 0.95, disc: 1.0, cap: 1.2e7, sponsor: 1.6, trustSens: 1.0, comm: 1.0, preview: 3,
    rivals: ['ByteBench', 'Unboxed Ola', 'Specsy', 'Dr. Teardown'],
    trends: ['New phone launch','AI tool wave','Budget laptop test','Foldables return','Smart glasses','GPU price crash','Desk setup tour','Battery life test','Earbuds shootout','Privacy scandal','Home lab','Keyboard craze','Console teardown','Camera phone shootout','EV tech'] },
  finance: { name: 'Finance', desc: 'Highest ad pay, slow discovery. Trust is everything.', rpm: 13, eg: 0.28, trend: 0.9, conv: 0.85, disc: 0.75, cap: 5e6, sponsor: 1.8, trustSens: 1.8, comm: 1.0, preview: 1,
    rivals: ['Compound Kai', 'Frugal Freya', 'Index Ivan', 'Bull Bram'],
    trends: ['Market crash panic','ETF beginner wave','Crypto pump','Rate cut news','Side hustle hype','Housing crisis','Budget challenge','Earnings season','Index vs stock picking','Gold rally','Student debt','FIRE stories','Inflation report','IPO frenzy','Tax season'] },
  commentary: { name: 'Commentary', desc: 'Trends are everything, evergreen is near zero. Trust swings fast.', rpm: 3, eg: 0.05, trend: 2.4, conv: 0.9, disc: 1.1, cap: 1.5e7, sponsor: 0.7, trustSens: 0.7, comm: 1.0, preview: 1,
    rivals: ['HotTake Hana', 'Rantman', 'Spilled Tea Sam', 'Calm Critic'],
    trends: ['Creator apology video','Reality show finale','Streamer ban','Brand fail','Influencer scam','Award show snub','Cancelled tour','Podcast feud','Viral court case','Trend backlash','Celebrity breakup','Movie flop','Leaked DMs','Charity stunt','Platform policy outrage'] },
  education: { name: 'Education', desc: 'Strongest evergreen and community, slow start, small trends.', rpm: 5, eg: 0.45, trend: 0.7, conv: 1.1, disc: 0.8, cap: 1e7, sponsor: 1.0, trustSens: 1.0, comm: 1.3, preview: 1,
    rivals: ['Explainer Eli', 'Curious Cleo', 'Prof Pixel', 'Map Mo'],
    trends: ['Space mission','History anniversary','Viral math puzzle','Exam season study tips','Science myth','Nobel prize','Language learning','Climate report','Archaeology find','Economics explained','Psychology study','Brain hack myth','Physics breakthrough','Ancient tech','Geography quiz'] },
};

const PERSONAS = {
  grinder:   { label: 'The Grinder',   blurb: 'Uploads constantly, never misses a week.', routine: { deep: 5, pack: 1, comm: 1, study: 0.5, gym: 1 }, videos: 10, focus: 'craft', honesty: 0.75, trendBias: 0.0, staffPref: ['editor','thumbnail','community','writer','manager'], obl: 1 },
  gambler:   { label: 'The Gambler',   blurb: 'Goes all-in on the biggest trend.', routine: { deep: 4.5, pack: 2, comm: 0.5, study: 0.5, gym: 0.5 }, videos: 7, focus: 'pack', honesty: 0.3, trendBias: 0.6, staffPref: ['thumbnail','editor','manager','writer','community'], obl: 2 },
  copycat:   { label: 'The Copycat',   blurb: 'Watches the leader and copies what worked.', routine: { deep: 4.5, pack: 1.5, comm: 1, study: 0.5, gym: 1 }, videos: 7, focus: 'pack', honesty: 0.5, trendBias: 0.2, staffPref: ['editor','thumbnail','writer','community','manager'], obl: 2 },
  craftsman: { label: 'The Craftsman', blurb: 'Few videos, very high quality, mostly evergreen.', routine: { deep: 4, pack: 1, comm: 1, study: 1.5, gym: 1.5 }, videos: 4, focus: 'craft', honesty: 0.9, trendBias: -0.3, staffPref: ['writer','editor','community','thumbnail','manager'], obl: 2 },
};

const SIZE_LABEL = { 1: 'Warm', 2: 'Hot', 4: 'Huge' };
const STAFF_ROLES = {
  editor:    { label: 'Editor',            unlock: 10000,  desc: 'Adds editing hours to every video.' },
  thumbnail: { label: 'Thumbnail artist',  unlock: 10000,  desc: 'Raises packaging (CTR).' },
  writer:    { label: 'Writer',            unlock: 10000,  desc: 'Raises video quality (retention).' },
  community: { label: 'Community manager', unlock: 10000,  desc: 'Grows community without your hours.' },
  manager:   { label: 'Manager',           unlock: 100000, desc: 'More and better sponsor deals, better products.' },
};
const SALARY = [0, 700, 1500, 2800, 4800, 7800]; // per season by stars
const TRAITS = {
  fast:         { label: 'Fast',         desc: '+25% output' },
  perfectionist:{ label: 'Perfectionist',desc: '+quality, -15% output' },
  ambitious:    { label: 'Ambitious',    desc: '+20% output, loses morale unless paid well' },
  loyal:        { label: 'Loyal',        desc: 'Morale never drops below 45' },
  hothead:      { label: 'Hothead',      desc: 'Lowers teammates\' morale; drama in a shared house' },
  cheap:        { label: 'Bargain',      desc: '-30% salary' },
  learner:      { label: 'Fast learner', desc: 'Gains a star every 4 seasons' },
  nightowl:     { label: 'Night owl',    desc: '+20% output in the content house' },
};
const GEAR = [
  { name: 'Phone', cost: 0, q: 1.0, pack: 0 },
  { name: 'Camera + mic', cost: 700, q: 1.06, pack: 0 },
  { name: 'Pro kit (lens, lights)', cost: 2500, q: 1.12, pack: 2 },
  { name: 'Studio', cost: 9000, q: 1.2, pack: 5 },
];
const UNLOCKS = [
  { subs: 1000, key: 'ads', label: 'Ad revenue' },
  { subs: 5000, key: 'sponsors', label: 'Sponsors' },
  { subs: 10000, key: 'staff', label: 'Hire staff' },
  { subs: 50000, key: 'product', label: 'Own product' },
  { subs: 100000, key: 'manager', label: 'Manager' },
  { subs: 250000, key: 'house', label: 'Content house' },
];
const PRODUCT_COST = 6000, PRODUCT_HOURS = 40, HOUSE_RENT = 9000;
const DIFFICULTY = { easy: { samples: 4, think: 0 }, normal: { samples: 12, think: 1 }, hard: { samples: 30, think: 2 }, brutal: { samples: 60, think: 3 } };

/* ---------- Calendar & life ---------- */
function dateOf(turn) { const m = START.month + 2 * (turn - 1); const y = START.year + Math.floor(m / 12); const mm = m % 12; return { y, m: mm, label: MONTHS[mm] + '–' + MONTHS[(mm + 1) % 12] + ' ' + y }; }

function lifeStage(c, turn) {
  if (c.path === 'student') {
    const d = dateOf(turn);
    if (turn <= 4) return { label: turn === 4 ? 'Final exams' : '12th grade', obl: turn === 4 ? 8.5 : 6, living: 0, support: 0 };
    if (turn === 5) return { label: 'Summer before uni', obl: 1.5, living: 0, support: 0 };
    if (c.droppedOut) return { label: 'Full-time (dropped out)', obl: 1, living: 2100, support: 0 };
    if (turn === 6) return { label: 'Moving to the Netherlands', obl: 7, living: 2100, support: 900 };
    if (turn >= 29) return { label: 'Graduated', obl: 1, living: 2100, support: 0 };
    const exam = d.m === 0 || d.m === 4; // Jan-Feb, May-Jun exam blocks
    return { label: exam ? 'Uni exams' : 'University (BUas)', obl: exam ? 6.5 : 5, living: 2100, support: 900 };
  }
  return { label: 'Full-time creator', obl: 1, living: 1900, support: 0 };
}

/* ---------- Setup ---------- */
function newGame(opts) {
  const seed = opts.seed >>> 0 || (Math.random() * 4294967295) >>> 0;
  const niche = NICHES[opts.niche] ? opts.niche : 'glow';
  const r = rngFor(seed, 1);
  const pk = Object.keys(PERSONAS); for (let i = pk.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pk[i], pk[j]] = [pk[j], pk[i]]; }
  const names = NICHES[niche].rivals.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const human = makeCreator(0, opts.channelName || 'My Channel', true, 'human');
  human.path = opts.path || 'student';
  if (human.path === 'fulltime') human.money = 6000;
  const creators = [human];
  for (let i = 0; i < 3; i++) { const ai = makeCreator(i + 1, names[i], false, pk[i]); ai.path = human.path; ai.money = human.money; creators.push(ai); }
  const st = {
    v: 1, seed, niche, mode: opts.mode || 'turns', target: opts.target || 0, maxTurns: opts.mode === 'turns' ? (opts.turns || 30) : 60,
    difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal', turn: 1, creators, over: false, winner: null,
    news: null, log: [], deals: [], dealSeq: 1, history: [], unlocked: {}, practice: !!opts.practice,
  };
  snapshotHistory(st);
  st.news = generateNews(st);
  return st;
}

function makeCreator(id, name, human, persona) {
  const p = PERSONAS[persona];
  const c = { id, name, human, persona, subs: 100, community: 10, trust: 50, money: human ? 300 : 1500, craft: 20, pack: 20, biz: 10, stress: 20, burnout: 0,
    library: 0, gear: 0, staff: [], product: null, house: false, droppedOut: false, relation: {}, deals: { kept: 0, broken: 0 }, lastAlloc: null, staffSeq: 1, debtTurns: 0,
    lastDecision: null, obl: p ? p.obl : 1, peakSubs: 100 };
  if (persona === 'craftsman') { c.craft = 30; c.pack = 14; }
  if (persona === 'gambler') { c.pack = 30; c.craft = 14; }
  if (persona === 'grinder') { c.craft = 22; c.pack = 18; }
  if (persona === 'copycat') { c.craft = 20; c.pack = 22; }
  return c;
}

/* ---------- News (input randomness, revealed before decisions) ---------- */
function trendsFor(st, turn) {
  const N = NICHES[st.niche]; const r = rngFor(st.seed, 7, turn);
  const used = new Set(); const out = [];
  const names = N.trends;
  for (let i = 0; i < 3; i++) {
    let idx; do { idx = Math.floor(r() * names.length); } while (used.has(idx)); used.add(idx);
    const x = r(); const size = x < 0.45 ? 1 : x < 0.85 ? 2 : 4;
    out.push({ id: i, name: names[idx], size });
  }
  return out;
}

function avgSubs(st) { return st.creators.reduce((a, c) => a + c.subs, 0) / st.creators.length; }

function generateNews(st) {
  const t = st.turn; const r = rngFor(st.seed, 11, t); const N = NICHES[st.niche];
  const trends = trendsFor(st, t);
  const pool = (35000 + 0.6 * avgSubs(st)) * N.trend;
  trends.forEach(tr => tr.pool = round(pool * tr.size));
  const nextTr = trendsFor(st, t + 1).slice(0, N.preview);
  const d = dateOf(t);
  const events = [];
  // seasonal ad market (real: Q4 high, January dip)
  let rpmMult = 1;
  if (d.m === 10) { rpmMult = 1.4; events.push({ key: 'q4', title: 'Q4 ad boom', text: 'Advertisers spend before the holidays. Ad pay is 40% higher this season.' }); }
  else if (d.m === 0) { rpmMult = 0.75; events.push({ key: 'jan', title: 'January ad dip', text: 'Ad budgets reset. Ad pay is 25% lower this season.' }); }
  else if (d.m === 6) { rpmMult = 0.9; events.push({ key: 'summer', title: 'Summer slump', text: 'Ad pay is 10% lower this season, but viewers have more free time (+10% discovery).' }); }
  const x = r();
  let mods = { rpm: rpmMult, disc: d.m === 6 ? 1.1 : 1, qWeight: 1, cWeight: 1, clickbait: 1, personalHours: 0 };
  if (x < 0.18) { mods.qWeight = 1.25; events.push({ key: 'watch', title: 'Algorithm favours watch time', text: 'Quality (retention) counts 25% more toward views this season.' }); }
  else if (x < 0.32) { mods.cWeight = 1.25; mods.clickbait = 0.6; events.push({ key: 'ctr', title: 'Packaging season', text: 'Thumbnails and titles (CTR) count 25% more this season, and clickbait is punished less.' }); }
  else if (x < 0.44) { mods.disc *= 1.3; events.push({ key: 'shout', title: 'Your niche goes mainstream', text: 'A huge creator talked about your niche. +30% discovery for everyone.' }); }
  else if (x < 0.54) { mods.clickbait = 2; events.push({ key: 'crack', title: 'Clickbait crackdown', text: 'If your packaging overpromises compared with your quality, you lose twice the trust.' }); }
  const y = r();
  if (y < 0.12) { mods.personalHours = 1; events.push({ key: 'family', title: 'Family stuff', text: 'Family events take about 1 hour a day of your time this season.' }); }
  else if (y < 0.2) { mods.personalHours = 0.5; events.push({ key: 'sick', title: 'You got sick', text: 'A flu takes about 0.5 hours a day of your time this season.' }); }
  if (r() < 0.25) { const tr = trends[Math.floor(r() * 3)]; tr.size = 4; tr.pool = round(pool * 4); events.push({ key: 'viral', title: 'Viral moment', text: '"' + tr.name + '" just exploded. It is a Huge trend this season.' }); }

  // per-creator offers: sponsors, candidates, deals (human gets the visible ones, AIs get their own)
  const offers = {};
  st.creators.forEach(c => {
    const o = { sponsors: [], candidates: [], dealOffers: [], staffEvents: [] };
    const cr = rngFor(st.seed, 13, t, c.id);
    if (c.subs >= 5000) {
      const n = 1 + (hasRole(c, 'manager') ? 1 : 0) + (cr() < 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const q = cr(); const quality = q < 0.5 ? 'good' : q < 0.8 ? 'meh' : 'sketchy';
        const avgViews = c.lastAvgViews || (1500 + 0.3 * c.subs);
        let pay = 0.035 * avgViews * N.sponsor * (1 + c.biz / 100) * (hasRole(c, 'manager') ? 1.25 : 1);
        if (quality === 'sketchy') pay *= 2.2; if (quality === 'meh') pay *= 1.3;
        const vids = 1 + (cr() < 0.4 ? 1 : 0);
        o.sponsors.push({ id: i, brand: pick(cr, SPONSORS[quality]), quality, pay: round(pay * vids / 10) * 10, videos: vids });
      }
    }
    if (c.subs >= 10000) {
      const maxStar = clamp(2 + Math.floor(Math.log10(c.subs / 10000) * 1.3), 2, 5);
      const roles = Object.keys(STAFF_ROLES).filter(k => c.subs >= STAFF_ROLES[k].unlock);
      for (let i = 0; i < 3; i++) {
        const role = pick(cr, roles); const stars = clamp(1 + Math.floor(cr() * maxStar), 1, 5);
        const tk = Object.keys(TRAITS); const traits = [pick(cr, tk)]; if (cr() < 0.4) { const t2 = pick(cr, tk); if (t2 !== traits[0]) traits.push(t2); }
        let salary = SALARY[stars] * (traits.includes('cheap') ? 0.7 : 1) * (0.9 + cr() * 0.25);
        o.candidates.push({ id: i, name: pick(cr, FIRST) + ' ' + pick(cr, LAST)[0] + '.', role, stars, traits, salary: round(salary / 10) * 10 });
      }
    }
    c.staff.forEach(s => {
      if (s.morale < 40) o.staffEvents.push({ staffId: s.id, kind: 'unhappy', text: s.name + ' (' + STAFF_ROLES[s.role].label + ') is unhappy (morale ' + round(s.morale) + '). Below 25 they quit at the end of the season.' });
      else if (cr() < 0.08) o.staffEvents.push({ staffId: s.id, kind: 'raise', text: s.name + ' asks for a 30% raise. Paying it: +10 morale. Refusing: -15 morale.' });
    });
    if (c.house && c.staff.some(s => s.traits.includes('hothead')) && c.staff.length >= 2 && cr() < 0.5) {
      o.staffEvents.push({ kind: 'drama', text: 'House drama: a hothead is clashing with the team. Mediate (costs you 1 h/day this season) or ignore (-12 morale for everyone).' });
    }
    offers[c.id] = o;
  });
  // AI -> human deal offers (collabs/pacts), deterministic from state
  const human = st.creators[0];
  st.creators.slice(1).forEach(ai => {
    const rel = ai.relation[0] || 0; const ratio = human.subs / Math.max(1, ai.subs);
    const cr = rngFor(st.seed, 17, t, ai.id);
    if (ratio > 0.4 && ratio < 2.5 && rel > -20 && !isLeaderBy(st, 0, 1.3) && cr() < 0.3) {
      offers[0].dealOffers.push({ id: 'o' + ai.id + '_' + t, from: ai.id, type: 'collab' });
    } else if (cr() < 0.22) {
      const a = Math.floor(cr() * 3); let b = Math.floor(cr() * 3); if (b === a) b = (a + 1) % 3;
      offers[0].dealOffers.push({ id: 'o' + ai.id + '_' + t, from: ai.id, type: 'pact', youAvoid: a, theyAvoid: b });
    }
  });
  return { turn: t, date: d.label, trends, nextTrends: nextTr, events, mods, offers };
}

const SPONSORS = { good: ['Nordvault VPN', 'Skillforge courses', 'Brightleaf meal kits', 'Studybuddy app', 'Corefit protein', 'Lumen skincare'], meh: ['MegaMobile game', 'FlashLoan app', 'Glowz gummies', 'QuickTrade app'], sketchy: ['CryptoMoon token', 'JawMax pills', 'Get-rich-quick course', 'Fake-review skincare'] };
const FIRST = ['Lena','Milo','Ana','Ivo','Sara','Noah','Eva','Luka','Mia','Finn','Nina','Teo','Iris','Dani','Yara','Ben','Zoe','Arjun','Maja','Leo'];
const LAST = ['Vos','Petrov','Jansen','Novak','Silva','Kovac','Berg','Ivanova','de Wit','Popescu','Kim','Moreau','Smit','Horvat','Nikolov'];

function hasRole(c, role) { return c.staff.some(s => s.role === role); }
function influence(c) { return c.subs * (1 + c.community / 200 + c.trust / 400); }
function isLeaderBy(st, id, factor) { const me = influence(st.creators[id]); return st.creators.every(c => c.id === id || me > influence(c) * factor); }
function unlockedFor(c) { const u = {}; UNLOCKS.forEach(x => u[x.key] = c.peakSubs >= x.subs); return u; }

/* ---------- Production model ---------- */
function staffOut(s, c) {
  let f = 1; const tr = s.traits;
  if (tr.includes('fast')) f *= 1.25; if (tr.includes('perfectionist')) f *= 0.85; if (tr.includes('ambitious')) f *= 1.2; if (tr.includes('nightowl') && c.house) f *= 1.2;
  if (c.house) f *= 1.1;
  return f * (0.4 + s.morale / 100 * 0.8);
}

/* Returns everything about a creator's season output before competition. */
function production(st, c, dec, mods) {
  const life = lifeStage(c, st.turn);
  const N = NICHES[st.niche];
  const R = Object.assign({ deep: 0, pack: 0, comm: 0, study: 0, gym: 0, job: 0 }, dec.routine);
  let obl = life.obl + (mods.personalHours || 0) + (c.debtTurns > 0 ? 2 : 0) + (dec._mediate ? 1 : 0);
  const avail = Math.max(0, WAKING - obl);
  // scale routine down if it exceeds available time
  let total = R.deep + R.pack + R.comm + R.study + R.gym + R.job;
  if (total > avail && total > 0) { const k = avail / total; Object.keys(R).forEach(key => R[key] *= k); total = avail; }
  const free = Math.max(0, avail - total);
  const burn = c.burnout > 0 ? 0.25 : 1;
  // focus capacity: about 4h of deep work, more if you recharge in between
  const cap = Math.min(7, 4 + 0.5 * (R.gym + Math.min(free, 3)) + 0.25 * R.study);
  const over = Math.max(0, R.deep - cap);
  const gymBoost = 1 + 0.04 * Math.min(R.gym, 2);
  const stressF = c.stress > 70 ? 0.85 : 1;
  const deepEff = (Math.min(R.deep, cap) + over * 0.35) * gymBoost * stressF * burn;
  const L = R.pack + R.comm; const lightEff = (Math.min(L, 3) + Math.max(0, L - 3) * 0.6) * stressF * burn;
  const packEffH = L > 0 ? lightEff * R.pack / L : 0, commEffH = L > 0 ? lightEff * R.comm / L : 0;
  // staff
  let staffDeep = 0, staffPack = 0, staffComm = 0, craftBonus = 0, packBonus = 0, perfBonus = 0;
  c.staff.forEach(s => {
    const o = staffOut(s, c);
    if (s.role === 'editor') staffDeep += 4 * (0.55 + 0.12 * s.stars) * o;
    if (s.role === 'writer') { staffDeep += 1.2 * o; craftBonus += 3.5 * s.stars * Math.min(1, o); }
    if (s.role === 'thumbnail') { staffPack += 1.5 * (0.5 + 0.2 * s.stars) * o; packBonus += 3.5 * s.stars * Math.min(1, o); }
    if (s.role === 'community') staffComm += 1.2 * (0.6 + 0.12 * s.stars) * o;
    if (s.traits.includes('perfectionist')) perfBonus += 0.02;
  });
  let deepHours = (deepEff + staffDeep) * DAYS;
  if (dec.product && !c.product) deepHours = Math.max(0, deepHours - PRODUCT_HOURS);
  if (dec._collabs) deepHours = Math.max(0, deepHours - 15 * dec._collabs);
  const packHours = (packEffH + staffPack) * DAYS;
  const commHours = (commEffH + staffComm) * DAYS;
  const nv = Math.max(0, Math.round(dec.videos ? dec.videos.total : 0));
  const craft = Math.min(100, c.craft + craftBonus); const pk = Math.min(100, c.pack + packBonus + GEAR[c.gear].pack);
  const p = nv > 0 ? deepHours / nv : 0; const ph = nv > 0 ? packHours / nv : 0;
  const Q = nv > 0 ? clamp((0.35 + 0.55 * craft / 100) * (p / (p + 25)) * GEAR[c.gear].q * (1 + perfBonus), 0, 1) : 0;
  const C = nv > 0 ? clamp((0.35 + 0.6 * pk / 100) * (ph / (ph + 3)), 0, 1) : 0;
  const power = 4 * Math.pow(Q, 1.3 * mods.qWeight) * Math.pow(C, 1.1 * mods.cWeight);
  return { life, obl, avail, R, free, cap, over, deepEff, deepHours, packHours, commHours, nv, p, ph, Q, C, power, craft, pk, burn };
}

/* ---------- Turn resolution ---------- */
function resolveTurn(stIn, humanDecision, opts) {
  const st = clone(stIn); opts = opts || {};
  const news = st.news; const mods = news.mods; const N = NICHES[st.niche];
  const decisions = {};
  decisions[0] = sanitize(st, st.creators[0], humanDecision);
  st.creators.forEach(c => { if (!c.human) decisions[c.id] = (opts.fixed && opts.fixed[c.id]) ? clone(opts.fixed[c.id]) : aiDecide(st, c); });
  const rep = { turn: st.turn, date: news.date, creators: {}, trends: [], deals: [], events: news.events, notes: {} };
  st.creators.forEach(c => rep.notes[c.id] = []);

  // 1. instant business actions
  st.creators.forEach(c => applyBusiness(st, c, decisions[c.id], news, rep));

  // 2. AI-to-AI collabs (rivals team up with each other, never with the runaway leader)
  if (DIFFICULTY[st.difficulty].think >= 1 && !opts.fixed) {
    const ais = st.creators.filter(c => !c.human && !st.deals.some(d => d.turn === st.turn && d.status === 'accepted' && (d.a === c.id || d.b === c.id)));
    let bestPair = null;
    for (let i = 0; i < ais.length; i++) for (let j = i + 1; j < ais.length; j++) {
      const a = ais[i], b = ais[j]; const ratio = a.subs / Math.max(1, b.subs);
      if (ratio < 0.5 || ratio > 2 || (a.relation[b.id] || 0) < -20 || (b.relation[a.id] || 0) < -20) continue;
      if (isLeaderBy(st, a.id, 1.25) || isLeaderBy(st, b.id, 1.25)) continue;
      const score = Math.abs(Math.log(ratio)); if (!bestPair || score < bestPair.score) bestPair = { a: a.id, b: b.id, score };
    }
    if (bestPair && (st.turn + bestPair.a + bestPair.b) % (st.difficulty === 'normal' ? 3 : 2) === 0) addDeal(st, { type: 'collab', a: bestPair.a, b: bestPair.b, ai: true });
  }
  const active = st.deals.filter(d => d.turn === st.turn && d.status === 'accepted');
  // collab videos: count toward video slots
  // 3. production
  const prod = {};
  st.creators.forEach(c => { decisions[c.id]._collabs = active.filter(x => x.type === 'collab' && (x.a === c.id || x.b === c.id)).length; prod[c.id] = production(st, c, decisions[c.id], mods); });

  // 4. trend competition (secret simultaneous allocations)
  const tw = news.trends.map(() => ({ total: 1.0, entries: [] })); // 1.0 = background creators
  st.creators.forEach(c => {
    const d = decisions[c.id]; const pr = prod[c.id];
    d.videos.trends.forEach((k, j) => { if (k > 0) { const w = k * pr.power * fatigue(k); tw[j].total += w; tw[j].entries.push({ id: c.id, k, w }); } });
  });
  const trendViews = {}; st.creators.forEach(c => trendViews[c.id] = 0);
  news.trends.forEach((tr, j) => {
    const row = { name: tr.name, size: tr.size, pool: tr.pool, shares: [] };
    tw[j].entries.forEach(e => { const v = tr.pool * e.w / tw[j].total * mods.disc; trendViews[e.id] += v; row.shares.push({ id: e.id, k: e.k, share: e.w / tw[j].total, views: round(v) }); });
    rep.trends.push(row);
  });

  // 5. views, subs, money
  st.creators.forEach(c => {
    const d = decisions[c.id]; const pr = prod[c.id]; const life = pr.life;
    const base = baseViews(c, N, mods);
    let views = 0, subsGain = 0, libAdd = 0;
    const trust = 0.7 + 0.6 * c.trust / 100;
    const conv = convRate(c, N, pr.Q);
    const nTrend = d.videos.trends.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pr.nv; i++) {
      const isTrend = i < nTrend;
      const v = base * pr.power * (isTrend ? 0.7 : 1) / (1 + 0.12 * i);
      views += v; subsGain += v * conv * (isTrend ? 0.8 : 1);
      if (!isTrend) libAdd += v * N.eg;
    }
    views += trendViews[c.id]; subsGain += trendViews[c.id] * conv * 0.8;
    // collabs
    let collabGain = 0;
    active.filter(x => x.type === 'collab' && (x.a === c.id || x.b === c.id)).forEach(x => {
      const other = st.creators[x.a === c.id ? x.b : x.a]; const op = prod[other.id];
      const g = 0.035 * other.subs * Math.max(0.15, op.Q) * 2 + 400; collabGain += g;
      rep.notes[c.id].push('Collab with ' + other.name + ': +' + fmt(g) + ' subs');
    });
    subsGain += collabGain;
    // library (evergreen back catalogue)
    const libViews = c.library * mods.disc;
    views += libViews; subsGain += libViews * conv * 0.6;
    c.library = c.library * 0.92 + libAdd;
    // churn
    const churnRate = 0.02 * (1 - c.community / 150) * (pr.nv < 2 ? 2.2 : 1) * (c.trust < 30 ? 1.5 : 1);
    const churn = c.subs * churnRate;
    const prevSubs = c.subs;
    c.subs = Math.max(0, c.subs + subsGain - churn);
    c.peakSubs = Math.max(c.peakSubs, c.subs);
    // money
    const monet = prevSubs >= 1000 || c.subs >= 1000;
    const ads = monet ? views * N.rpm / 1000 * mods.rpm : 0;
    let sponsorPay = 0, trustD = 0;
    (d.sponsors || []).forEach(sid => {
      const sp = news.offers[c.id].sponsors.find(s => s.id === sid); if (!sp) return;
      if (pr.nv >= sp.videos) { sponsorPay += sp.pay; trustD += sp.quality === 'good' ? 0.5 : sp.quality === 'meh' ? -1.5 * N.trustSens : -7 * N.trustSens; }
      else { trustD -= 3; rep.notes[c.id].push(sp.brand + ': not enough videos to deliver. No pay, -3 trust.'); }
    });
    let productRev = 0;
    if (c.product) { productRev = c.community / 100 * c.subs * 0.004 * 25 * c.product.quality * trust * c.product.decay * (hasRole(c, 'manager') ? 1.15 : 1); c.product.decay *= 0.85; c.product.total = (c.product.total || 0) + productRev; }
    const salaries = c.staff.reduce((a, s) => a + s.salary * PAYMULT[s.pay || 'fair'], 0);
    const rent = c.house ? HOUSE_RENT : 0;
    const living = life.living - life.support;
    const wages = pr.R.job * DAYS * 11 * pr.burn;
    const income = ads + sponsorPay + productRev + wages;
    const costs = salaries + rent + living;
    c.money += income - costs;
    if (c.money < 0) { c.debtTurns = 1; rep.notes[c.id].push('You are in debt. Paying it off takes 2 h/day of extra shifts next season (+stress).'); } else c.debtTurns = 0;
    // community
    const consist = pr.nv >= 4 ? 1.5 : pr.nv >= 2 ? 0.4 : -2;
    const commD = pr.commHours * 0.05 * N.comm * (1 - c.community / 130) + consist + (collabGain > 0 ? 2 : 0) + (pr.Q > 0.6 ? 1 : 0) - 2.5;
    c.community = clamp(c.community + commD, 0, 100);
    // trust
    const cb = pr.Q > 0 ? pr.C / Math.max(0.05, pr.Q) : 1;
    trustD += (pr.nv > 0 ? (pr.Q - 0.45) * 6 : -1) - (cb > 1.4 ? (cb - 1.4) * 6 * mods.clickbait : 0) + (50 - c.trust) * 0.03;
    c.trust = clamp(c.trust + trustD, 0, 100);
    // stress
    const R = pr.R; const work = R.deep + R.pack + R.comm + R.study * 0.5 + R.job * 0.8 + pr.obl * 0.6;
    let sD = (work - 9) * 3.5 + pr.over * 5 - R.gym * 4 - pr.free * 2.5 + (c.house ? 3 : 0) + (c.money < 0 ? 6 : 0) + c.staff.length * 0.5;
    if (c.burnout > 0) { c.burnout--; c.stress = 35; rep.notes[c.id].push('Recovering from burnout.'); }
    else {
      c.stress = clamp(c.stress + sD, 0, 100);
      if (c.stress >= 100) { c.burnout = 1; rep.notes[c.id].push('BURNOUT. Next season you can only work at 25%.'); }
    }
    // skills
    const focus = d.studyFocus || 'craft'; const studyH = R.study * DAYS * pr.burn;
    c.craft = clamp(c.craft + R.deep * DAYS * pr.burn * 0.012 * (1 - c.craft / 120) + (focus === 'craft' ? studyH * 0.06 * (1 - c.craft / 110) : 0), 0, 100);
    c.pack = clamp(c.pack + Math.min(pr.packHours, 240) * 0.02 * (1 - c.pack / 120) + (focus === 'pack' ? studyH * 0.06 * (1 - c.pack / 110) : 0), 0, 100);
    c.biz = clamp(c.biz + c.staff.length * 0.4 + (focus === 'biz' ? studyH * 0.07 * (1 - c.biz / 110) : 0) + (c.product ? 0.5 : 0), 0, 100);
    // staff morale
    const grew = c.subs > prevSubs * 1.2;
    const hot = c.staff.filter(s => s.traits.includes('hothead')).length;
    c.staff.forEach(s => {
      let m = (s.pay === 'low' ? -8 : s.pay === 'generous' ? 5 : 0) + (c.house ? 6 : 0) + (c.stress > 75 ? -5 : 0) + (grew ? 3 : 0) - (s.traits.includes('hothead') ? 0 : hot * 3) + (s.traits.includes('ambitious') && s.pay !== 'generous' ? -3 : 0) + (65 - s.morale) * 0.08;
      if (d.ignoreDrama) m -= 12;
      s.morale = clamp(s.morale + m, s.traits.includes('loyal') ? 45 : 0, 100);
      s.seasons = (s.seasons || 0) + 1;
      if (s.traits.includes('learner') && s.seasons % 4 === 0 && s.stars < 5) { s.stars++; rep.notes[c.id].push(s.name + ' levelled up to ' + s.stars + '★.'); }
    });
    const quit = c.staff.filter(s => s.morale < 25);
    quit.forEach(s => rep.notes[c.id].push(s.name + ' quit (morale too low).'));
    c.staff = c.staff.filter(s => s.morale >= 25);
    // stats
    c.lastAvgViews = pr.nv > 0 ? (views - libViews - trendViews[c.id]) / pr.nv : c.lastAvgViews;
    c.lastAlloc = d.videos.trends.map((k, j) => ({ k, size: news.trends[j].size }));
    c.lastDecision = clone(d);
    rep.creators[c.id] = { views: round(views), subsGain: round(subsGain - churn), churn: round(churn), libViews: round(libViews), trendViews: round(trendViews[c.id]), ads: round(ads), sponsor: round(sponsorPay), product: round(productRev), costs: round(costs), Q: pr.Q, C: pr.C, nv: pr.nv, deepEff: pr.deepEff, cap: pr.cap, over: pr.over, stress: c.stress, commD, trustD };
  });

  // 6. deal outcomes (pacts honoured or broken)
  active.filter(x => x.type === 'pact').forEach(x => {
    const da = decisions[x.a], db = decisions[x.b];
    const aBroke = da.videos.trends[x.aAvoid] > 0, bBroke = db.videos.trends[x.bAvoid] > 0;
    [[x.a, aBroke, x.b], [x.b, bBroke, x.a]].forEach(([who, broke, other]) => {
      const c = st.creators[who];
      if (broke) { c.deals.broken++; rel(st, other, who, -40); st.creators.forEach(o => { if (o.id !== who && o.id !== other) rel(st, o.id, who, -10); }); c.trust = clamp(c.trust - 2, 0, 100); }
      else { c.deals.kept++; rel(st, other, who, 8); }
    });
    rep.deals.push({ type: 'pact', a: x.a, b: x.b, aBroke, bBroke, aAvoid: news.trends[x.aAvoid].name, bAvoid: news.trends[x.bAvoid].name });
  });
  active.filter(x => x.type === 'collab').forEach(x => { rel(st, x.a, x.b, 10); rel(st, x.b, x.a, 10); rep.deals.push({ type: 'collab', a: x.a, b: x.b }); });
  // leader gets hunted: relations to the leader decay
  const lead = st.creators.reduce((a, c) => influence(c) > influence(a) ? c : a, st.creators[0]);
  st.creators.forEach(c => { if (c.id !== lead.id) rel(st, c.id, lead.id, -3); });

  // unlock notes for human
  const h = st.creators[0]; UNLOCKS.forEach(u => { if (h.peakSubs >= u.subs && !st.unlocked[u.key]) { st.unlocked[u.key] = st.turn; rep.notes[0].push('Unlocked: ' + u.label + '!'); } });

  rep.decisions = decisions;
  st.log.push(rep); if (st.log.length > 3) st.log.shift();
  st.lastReport = rep;
  st.turn++;
  snapshotHistory(st, decisions[0]);
  checkEnd(st);
  if (!st.over) st.news = generateNews(st);
  return st;
}
const PAYMULT = { low: 0.8, fair: 1, generous: 1.3 };
function baseViews(c, N, mods) { const sat = Math.pow(Math.max(0.02, 1 - c.subs / N.cap), 0.7); return (2500 + 3 * Math.pow(c.subs, 0.85)) * N.disc * mods.disc * sat; }
function convRate(c, N, Q) { return 0.09 * Q * (0.7 + 0.6 * c.trust / 100) * N.conv / Math.pow(1 + c.subs / 150000, 0.6); }
function fatigue(k) { let s = 0; for (let i = 0; i < k; i++) s += 1 / (1 + 0.35 * i); return s / k; }
function rel(st, from, to, d) { const c = st.creators[from]; c.relation[to] = clamp((c.relation[to] || 0) + d, -100, 100); }
function fmt(n) { n = Math.round(n); if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'; if (Math.abs(n) >= 1e4) return Math.round(n / 1e3) + 'K'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(n); }

function applyBusiness(st, c, d, news, rep) {
  const o = news.offers[c.id];
  const u = unlockedFor(c);
  // staff events
  (o.staffEvents || []).forEach(ev => {
    if (ev.kind === 'raise') { const s = c.staff.find(x => x.id === ev.staffId); if (!s) return; if ((d.raises || []).includes(ev.staffId)) { s.salary = round(s.salary * 1.3); s.morale = clamp(s.morale + 10, 0, 100); } else s.morale = clamp(s.morale - 15, 0, 100); }
  });
  (d.fire || []).forEach(id => { const s = c.staff.find(x => x.id === id); if (s) { c.staff = c.staff.filter(x => x.id !== id); c.staff.forEach(x => x.morale = clamp(x.morale - 5, 0, 100)); rep.notes[c.id].push('You let ' + s.name + ' go.'); } });
  Object.keys(d.pay || {}).forEach(id => { const s = c.staff.find(x => String(x.id) === String(id)); if (s) s.pay = d.pay[id]; });
  if (u.staff) (d.hire || []).forEach(cid => {
    const cand = o.candidates.find(x => x.id === cid); if (!cand) return;
    if (cand.role === 'manager' && !u.manager) return;
    c.staff.push({ id: c.staffSeq++, name: cand.name, role: cand.role, stars: cand.stars, traits: cand.traits, salary: cand.salary, morale: 70, pay: 'fair', seasons: 0 });
  });
  if (d.gear != null && d.gear > c.gear && d.gear < GEAR.length) { const cost = GEAR[d.gear].cost; if (c.money >= cost) { c.money -= cost; c.gear = d.gear; } }
  if (d.product && !c.product && u.product && c.money >= PRODUCT_COST) { c.money -= PRODUCT_COST; c.product = { quality: 0.6 + 0.6 * c.biz / 100 + (hasRole(c, 'manager') ? 0.1 : 0), decay: 1, launched: st.turn }; if (c.human) rep.notes[c.id].push('Product launched.'); }
  if (d.retireProduct && c.product) c.product = null;
  if (d.house === true && u.house && !c.house && c.staff.length >= 2) c.house = true;
  if (d.house === false && c.house) c.house = false;
  if (d.dropOut && c.path === 'student' && st.turn >= 6 && !c.droppedOut) { c.droppedOut = true; rep.notes[c.id].push(c.human ? 'You dropped out of uni. Parents stop the €900 support.' : c.name + ' dropped out of uni to go full-time.'); if (!c.human) rep.notes[0].push(c.name + ' dropped out of uni to go full-time.'); }
}

function sanitize(st, c, dec) {
  const d = clone(dec || {});
  d.routine = Object.assign({ deep: 4, pack: 1, comm: 1, study: 1, gym: 1, job: 0 }, d.routine || {});
  Object.keys(d.routine).forEach(k => d.routine[k] = clamp(+d.routine[k] || 0, 0, 14));
  d.videos = d.videos || { ever: 4, trends: [0, 0, 0] };
  d.videos.trends = (d.videos.trends || [0, 0, 0]).map(x => clamp(Math.round(+x || 0), 0, 12));
  d.videos.ever = clamp(Math.round(+d.videos.ever || 0), 0, 30);
  d.videos.total = d.videos.ever + d.videos.trends.reduce((a, b) => a + b, 0);
  d.studyFocus = ['craft', 'pack', 'biz'].includes(d.studyFocus) ? d.studyFocus : 'craft';
  d.sponsors = d.sponsors || []; d.hire = d.hire || []; d.fire = d.fire || []; d.raises = d.raises || [];
  return d;
}

/* ---------- Deals (structured diplomacy) ---------- */
// Human proposes during planning; AI answers immediately (deterministic).
function proposeDeal(st, deal) {
  const ai = st.creators[deal.to]; const human = st.creators[0];
  if (st.deals.some(d => d.turn === st.turn && (d.a === deal.to || d.b === deal.to) && d.status === 'accepted')) return { accepted: false, reason: ai.name + ' already has a deal this season.' };
  const relv = ai.relation[0] || 0; const p = PERSONAS[ai.persona];
  if (relv < -30) return { accepted: false, reason: ai.name + ' does not trust you (relationship ' + relv + ').' };
  if (deal.type === 'collab') {
    const ratio = human.subs / Math.max(1, ai.subs);
    if (isLeaderBy(st, 0, 1.25)) return { accepted: false, reason: 'You are leading. ' + ai.name + ' will not help the leader grow.' };
    const need = ai.persona === 'craftsman' ? 0.5 : ai.persona === 'grinder' ? 0.25 : 0.35;
    if (ratio < need && relv < 30) return { accepted: false, reason: 'Your channel is too small for ' + ai.name + ' (needs ~' + Math.round(need * 100) + '% of their size, or a stronger relationship).' };
    if (ai.persona === 'craftsman' && human.trust < 50) return { accepted: false, reason: ai.name + ' only collabs with trusted channels (trust 50+).' };
    return addDeal(st, { type: 'collab', a: 0, b: deal.to });
  }
  if (deal.type === 'pact') {
    // AI accepts if the trend it gives up is not better for it than the one you give up
    const tr = st.news.trends; const giveUp = tr[deal.theyAvoid], gain = tr[deal.youAvoid];
    if (deal.youAvoid === deal.theyAvoid) return { accepted: false, reason: 'Pick two different trends.' };
    if (giveUp.size > gain.size * (relv > 20 ? 1.5 : 1)) return { accepted: false, reason: ai.name + ' would give up more than they get.' };
    return addDeal(st, { type: 'pact', a: 0, b: deal.to, aAvoid: deal.youAvoid, bAvoid: deal.theyAvoid });
  }
  return { accepted: false, reason: 'Unknown deal.' };
}
function acceptOffer(st, offer) {
  if (offer.type === 'collab') return addDeal(st, { type: 'collab', a: 0, b: offer.from });
  return addDeal(st, { type: 'pact', a: 0, b: offer.from, aAvoid: offer.youAvoid, bAvoid: offer.theyAvoid });
}
function addDeal(st, d) { d.id = st.dealSeq++; d.turn = st.turn; d.status = 'accepted'; st.deals.push(d); st.deals = st.deals.filter(x => x.turn >= st.turn - 6); return { accepted: true, deal: d }; }
function cancelDeal(st, id) { st.deals = st.deals.filter(d => !(d.id === id && d.turn === st.turn)); }

/* ---------- AI ---------- */
function estimateValue(st, c, pr, kind, trendIdx, k, othersW) {
  // expected subs + money value of placing k videos (kind: 'ever' or trend j)
  const N = NICHES[st.niche]; const mods = st.news.mods;
  const remaining = Math.max(1, st.maxTurns - st.turn);
  const base = baseViews(c, N, mods);
  const conv = convRate(c, N, pr.Q);
  if (kind === 'ever') {
    const v = base * pr.power * k * (1 - 0.03 * k); const libFuture = v * N.eg * Math.min(remaining, 10) * 0.6;
    return v * conv + libFuture * 0.025 + (v + libFuture) * N.rpm / 1000 * 0.15;
  }
  const tr = st.news.trends[trendIdx];
  const w = k * pr.power * fatigue(k);
  const share = w / (1 + othersW + w);
  const v = tr.pool * share * mods.disc + base * pr.power * 0.7 * k;
  return v * conv * 0.8 + v * N.rpm / 1000 * 0.15;
}

function predictOthers(st, me, r, level) {
  // sample other creators' trend weights based on their history/persona
  const tr = st.news.trends; const out = [0, 0, 0];
  st.creators.forEach(o => {
    if (o.id === me.id) return;
    const pw = Math.max(0.3, 4 * Math.pow(0.45 + o.craft / 400, 1.5) * (0.5 + o.pack / 250));
    let probs;
    if (level === 0) probs = [0.33, 0.33, 0.33];
    else if (o.human || level < 2) {
      // learn from history of what this creator did
      const hist = (st.trendHistory && st.trendHistory[o.id]) || [];
      const big = hist.length ? hist.filter(h => h.wentBiggest).length / hist.length : 0.5;
      const any = hist.length ? hist.filter(h => h.any).length / hist.length : 0.6;
      const order = [0, 1, 2].sort((a, b) => tr[b].size - tr[a].size);
      probs = [0, 0, 0]; probs[order[0]] = any * (level >= 3 ? big : 0.5); probs[order[1]] = any * (1 - (level >= 3 ? big : 0.5)) * 0.6; probs[order[2]] = any * (1 - (level >= 3 ? big : 0.5)) * 0.4;
    } else {
      const p = PERSONAS[o.persona]; const order = [0, 1, 2].sort((a, b) => tr[b].size - tr[a].size);
      probs = [0, 0, 0]; const tb = p.trendBias;
      probs[order[0]] = clamp(0.45 + tb, 0.05, 0.95); probs[order[1]] = clamp(0.3 - tb / 3, 0.05, 0.9); probs[order[2]] = clamp(0.2 - tb / 3, 0.02, 0.9);
      if (o.persona === 'copycat') { const lead = st.creators.reduce((a, c) => influence(c) > influence(a) ? c : a, st.creators[0]); if (lead.lastAlloc) lead.lastAlloc.forEach((x, j) => { if (x.k > 0) probs[j] = Math.min(0.95, probs[j] + 0.3); }); }
    }
    for (let j = 0; j < 3; j++) if (r() < probs[j]) out[j] += pw * (1 + Math.floor(r() * 3)) * 0.8;
  });
  return out;
}

function aiDecide(st, c) {
  const p = PERSONAS[c.persona]; const diff = DIFFICULTY[st.difficulty]; const r = rngFor(st.seed, 23, st.turn, c.id);
  const life = lifeStage(c, st.turn); const mods = st.news.mods;
  // part-time job if money is short
  const salaries0 = c.staff.reduce((a, s) => a + s.salary * PAYMULT[s.pay || 'fair'], 0);
  const expIncome = c.subs >= 1000 ? (c.lastAvgViews || 1000) * p.videos * NICHES[st.niche].rpm / 1000 : 0;
  const deficit = life.living - life.support + salaries0 - expIncome - Math.max(0, c.money) / 3;
  const job = clamp(Math.ceil(deficit / 660 * 2) / 2, 0, 3);
  const avail = WAKING - life.obl - (mods.personalHours || 0) - (c.debtTurns > 0 ? 2 : 0) - job;
  // routine
  let routines = [Object.assign({}, p.routine)];
  if (diff.think >= 1) {
    routines.push({ deep: 4, pack: 1.5, comm: 1, study: 1, gym: 1.5 });
    routines.push({ deep: 5.5, pack: 1.5, comm: 1, study: 0.5, gym: 1.5 });
    routines.push({ deep: 4.5, pack: 2, comm: 1.5, study: 1, gym: 1 });
    if (c.stress > 55) routines.push({ deep: 3.5, pack: 1, comm: 1, study: 1, gym: 2 });
  }
  if (diff.think >= 3) {
    routines.push({ deep: 6, pack: 2, comm: 1, study: 0.5, gym: 2 });
    routines.push({ deep: 5, pack: 2.5, comm: 1.5, study: 1.5, gym: 1.5 });
    routines.push({ deep: 6.5, pack: 1.5, comm: 1, study: 0, gym: 2 });
  }
  if (c.stress > 60 && diff.think === 0) { routines[0].deep -= 1; routines[0].gym += 1; }
  const vidOpts = diff.think >= 1 ? [3, 4, 5, 6, 8, 10, 12] : [p.videos];
  if (diff.think >= 1 && !vidOpts.includes(p.videos)) vidOpts.push(p.videos);
  let best = null;
  const projDec = (R, n) => ({ routine: R, videos: { ever: n, trends: [0, 0, 0], total: n }, studyFocus: p.focus });
  routines.forEach(R => {
    const tot = R.deep + R.pack + R.comm + R.study + R.gym; if (tot > avail) { const k = avail / tot; Object.keys(R).forEach(x => R[x] *= k); }
    R.job = job;
    vidOpts.forEach(n => {
      const pr = production(st, c, projDec(R, n), mods);
      // stress projection
      const work = R.deep + R.pack + R.comm + R.study * 0.5 + pr.obl * 0.6;
      const sD = (work - 9) * 3.5 + pr.over * 5 - R.gym * 4 - pr.free * 2.5 + c.staff.length * 0.5;
      const ns = c.stress + sD;
      let val = estimateValue(st, c, pr, 'ever', 0, n, 0);
      val += (c.craft < 90 ? R.deep * DAYS * 0.012 + (p.focus === 'craft' ? R.study * DAYS * 0.06 : 0) : 0) * c.subs * 0.004 * diff.think;
      if (ns >= 95) val *= 0.4; else if (ns > 75) val *= 0.85;
      if (diff.think >= 1 && n === p.videos) val *= 1.04; // personality preference
      if (!best || val > best.val) best = { val, R, n, pr };
    });
  });
  const R = Object.assign({}, best.R, { job }); const n = best.n; const pr = best.pr;
  // trend allocation via Monte Carlo over predicted opponents
  const S = diff.samples; const samples = []; for (let s = 0; s < S; s++) samples.push(predictOthers(st, c, r, diff.think));
  const forbidden = st.deals.filter(d => d.turn === st.turn && d.status === 'accepted' && d.type === 'pact' && (d.a === c.id || d.b === c.id)).map(d => ({ trend: d.a === c.id ? d.aAvoid : d.bAvoid, deal: d }));
  const cands = [];
  const maxT = Math.min(n, 6);
  for (let a = 0; a <= maxT; a++) for (let b = 0; a + b <= maxT; b++) for (let cc = 0; a + b + cc <= maxT; cc++) cands.push([a, b, cc]);
  let bestA = null; let bestAll = null;
  cands.forEach(al => {
    let tot = 0;
    samples.forEach(ow => { let v = 0; al.forEach((k, j) => { if (k > 0) v += estimateValue(st, c, pr, 'trend', j, k, ow[j]); }); tot += v; });
    let val = tot / S + estimateValue(st, c, pr, 'ever', 0, n - al.reduce((x, y) => x + y, 0), 0);
    // personality bias
    const order = [0, 1, 2].sort((x, y) => st.news.trends[y].size - st.news.trends[x].size);
    if (p.trendBias > 0 && al[order[0]] > 0) val *= 1 + p.trendBias * 0.25;
    if (p.trendBias < 0 && al.some(k => k > 0)) val *= 1 + p.trendBias * 0.15;
    if (diff.think === 0) val *= 0.85 + r() * 0.3; // easy AI misjudges
    const breaks = forbidden.filter(f => al[f.trend] > 0);
    if (!bestAll || val > bestAll.val) bestAll = { val, al };
    if (breaks.length === 0 && (!bestA || val > bestA.val)) bestA = { val, al };
  });
  // betrayal decision: break a pact only if the gain is large relative to honesty
  let alloc = bestA ? bestA.al : bestAll.al;
  if (bestA && bestAll.val > bestA.val * (1 + p.honesty * 0.6 + Math.max(0, (c.relation[0] || 0)) / 200)) alloc = bestAll.al;
  const ever = Math.max(0, n - alloc.reduce((x, y) => x + y, 0));
  // business
  const o = st.news.offers[c.id]; const u = unlockedFor(c);
  const d = { routine: R, studyFocus: weakest(c, p.focus), videos: { ever, trends: alloc.slice(), total: n }, sponsors: [], hire: [], fire: [], raises: [], pay: {} };
  if (u.sponsors) o.sponsors.forEach(s => { if (s.quality === 'good' || (s.quality === 'meh' && c.money < 3000) || (s.quality === 'sketchy' && c.persona === 'gambler')) { if (n >= s.videos) d.sponsors.push(s.id); } });
  const salaries = c.staff.reduce((a, s) => a + s.salary, 0);
  const income = (c.lastAvgViews || 1000) * n * NICHES[st.niche].rpm / 1000 + 1;
  const maxStaff = c.subs > 500000 ? 6 : c.subs > 150000 ? 4 : c.subs > 40000 ? 3 : 2;
  if (u.staff && c.staff.length < maxStaff) {
    const have = c.staff.map(s => s.role);
    const want = p.staffPref.find(rl => !have.includes(rl) && (rl !== 'manager' || u.manager)) || p.staffPref[0];
    const cand = o.candidates.filter(x => x.role === want || diff.think >= 2).sort((a, b) => b.stars / b.salary - a.stars / a.salary)[0];
    if (cand && c.money > (salaries + cand.salary) * 2.5 && income * 0.7 > salaries + cand.salary - 800) d.hire.push(cand.id);
  }
  c.staff.forEach(s => { d.pay[s.id] = (c.persona === 'craftsman' || s.morale < 45) && c.money > 20000 ? 'generous' : 'fair'; });
  (o.staffEvents || []).forEach(ev => { if (ev.kind === 'raise' && c.money > 15000) d.raises.push(ev.staffId); if (ev.kind === 'drama') d.ignoreDrama = true; });
  if (c.gear < 3 && c.money > GEAR[c.gear + 1].cost * 3) d.gear = c.gear + 1;
  if (u.product && !c.product && c.money > PRODUCT_COST * 2.5) d.product = true;
  if (c.product && c.product.decay < 0.3 && c.money > PRODUCT_COST * 2.5) d.retireProduct = true;
  if (u.house && !c.house && c.staff.length >= 3 && c.money > HOUSE_RENT * 5) d.house = true;
  if (c.path === 'student' && !c.droppedOut && st.turn >= 7 && ((c.persona === 'grinder' && c.subs > 25000) || (c.persona === 'gambler' && c.subs > 15000) || (diff.think >= 3 && c.persona !== 'craftsman' && c.subs > 20000))) d.dropOut = true;
  return sanitize(st, c, d);
}
function weakest(c, pref) {
  if (pref === 'craft' && c.craft < 75) return 'craft';
  if (pref === 'pack' && c.pack < 60) return 'pack';
  const arr = [['craft', c.craft], ['pack', c.pack * 1.1]]; if (c.staff.length >= 2 || c.subs > 50000) arr.push(['biz', c.biz * 1.6]);
  arr.sort((a, b) => a[1] - b[1]); return arr[0][0];
}

/* ---------- History & end ---------- */
function snapshotHistory(st, humanDec) {
  st.history = st.history || [];
  st.history.push({ turn: st.turn, c: st.creators.map(c => ({ s: round(c.subs), i: round(influence(c)), m: round(c.money), cm: +c.community.toFixed(1), t: +c.trust.toFixed(1), st: round(c.stress) })) });
  // track trend behaviour (used by AIs to model players)
  if (st.lastReport) {
    st.trendHistory = st.trendHistory || {};
    const tr = st.news.trends; const big = [0, 1, 2].sort((a, b) => tr[b].size - tr[a].size)[0];
    st.creators.forEach(c => { const d = st.lastReport.decisions[c.id]; const any = d.videos.trends.some(k => k > 0); (st.trendHistory[c.id] = st.trendHistory[c.id] || []).push({ any, wentBiggest: d.videos.trends[big] > 0 }); if (st.trendHistory[c.id].length > 8) st.trendHistory[c.id].shift(); });
  }
}
function standings(st) { return st.creators.map(c => ({ id: c.id, name: c.name, influence: influence(c), subs: c.subs, money: c.money })).sort((a, b) => b.influence - a.influence); }
function checkEnd(st) {
  if (st.mode === 'turns' && st.turn > st.maxTurns) { st.over = true; st.winner = standings(st)[0].id; st.endReason = 'Five years are up.'; }
  if (st.mode === 'subs') { const w = st.creators.filter(c => c.subs >= st.target).sort((a, b) => b.subs - a.subs)[0]; if (w) { st.over = true; st.winner = w.id; st.endReason = w.name + ' reached ' + fmt(st.target) + ' subscribers.'; } }
  if (st.mode === 'money') { const w = st.creators.filter(c => c.money >= st.target).sort((a, b) => b.money - a.money)[0]; if (w) { st.over = true; st.winner = w.id; st.endReason = w.name + ' reached €' + fmt(st.target) + '.'; } }
  if (!st.over && st.turn > st.maxTurns) { st.over = true; st.winner = standings(st)[0].id; st.endReason = 'Time ran out (10 years).'; }
}

/* ---------- Replay & review ---------- */
// A save is { opts, decisions: [ {dec, deals:[...]} per turn ] }. Everything else is replayed.
function replay(save, upToTurn) {
  let st = newGame(save.opts);
  const lim = upToTurn == null ? save.turns.length : Math.min(upToTurn - 1, save.turns.length);
  for (let i = 0; i < lim; i++) {
    const t = save.turns[i];
    (t.deals || []).forEach(dl => { if (dl.kind === 'propose') proposeDeal(st, dl.deal); else if (dl.kind === 'accept') acceptOffer(st, dl.offer); });
    st = resolveTurn(st, t.dec);
  }
  return st;
}

// value of a creator's position: project a few seasons alone with a sensible autopilot
function positionValue(st0, cid, ahead) {
  const st = clone(st0); const c = st.creators[cid];
  const dec = c.lastDecision ? clone(c.lastDecision) : { routine: { deep: 4, pack: 1, comm: 1, study: 1, gym: 1 }, videos: { ever: 6, trends: [0, 0, 0] } };
  dec.videos = { ever: Math.max(3, dec.videos.total || 6), trends: [0, 0, 0] }; dec.sponsors = []; dec.hire = []; dec.fire = []; dec.gear = null; dec.product = false; dec.house = null; dec.dropOut = false;
  let cur = st;
  for (let i = 0; i < ahead && !cur.over && cur.news; i++) { cur.deals = []; cur = resolveTurnIsolated(cur, cid, dec); }
  const cc = cur.creators[cid];
  return influence(cc) * (cc.burnout > 0 ? 0.9 : 1) + Math.max(0, cc.money) * 0.5;
}
function resolveTurnIsolated(st, cid, dec) {
  // run the full model for one creator with everyone else idle
  const fixed = {}; st.creators.forEach(o => { if (o.id !== cid && o.id !== 0) fixed[o.id] = idleDecision(); });
  const humanDec = cid === 0 ? dec : idleDecision();
  if (cid !== 0) fixed[cid] = dec;
  const out = resolveTurn(st, humanDec, { fixed });
  return out;
}
function idleDecision() { return { routine: { deep: 0, pack: 0, comm: 0, study: 0, gym: 0 }, videos: { ever: 0, trends: [0, 0, 0], total: 0 }, sponsors: [], hire: [], fire: [], raises: [], pay: {} }; }

// Recommend a decision for the human using the strongest AI planner
function recommend(st) {
  const c = st.creators[0];
  const keep = st.difficulty; st.difficulty = 'brutal';
  const saved = c.persona; c.persona = 'grinder';
  const pers = PERSONAS.grinder; const bak = Object.assign({}, pers); pers.trendBias = 0; pers.honesty = 1; pers.videos = 6;
  const d = aiDecide(st, c);
  Object.assign(pers, bak); c.persona = saved; st.difficulty = keep;
  return d;
}

/* Review: for each turn, how much did each part of your decision cost vs the coach's alternative? */
function review(save, maxTurns) {
  const out = [];
  let st = newGame(save.opts);
  const lim = Math.min(save.turns.length, maxTurns || 999);
  for (let i = 0; i < lim; i++) {
    const t = save.turns[i];
    (t.deals || []).forEach(dl => { if (dl.kind === 'propose') proposeDeal(st, dl.deal); else if (dl.kind === 'accept') acceptOffer(st, dl.offer); });
    const actual = resolveTurn(st, t.dec);
    const aiFixed = actual.lastReport.decisions;
    const fixed = {}; st.creators.forEach(c => { if (!c.human) fixed[c.id] = aiFixed[c.id]; });
    const rec = recommend(st);
    const mine = sanitize(st, st.creators[0], t.dec);
    const variants = {
      routine: Object.assign(clone(mine), { routine: rec.routine, studyFocus: rec.studyFocus }),
      volume: Object.assign(clone(mine), { videos: scaleAlloc(mine.videos, rec.videos.total) }),
      trends: Object.assign(clone(mine), { videos: { ever: Math.max(0, mine.videos.total - rec.videos.trends.reduce((a, b) => a + b, 0)), trends: rec.videos.trends.slice(), total: mine.videos.total } }),
    };
    const ahead = Math.min(3, Math.max(1, (st.maxTurns || 30) - st.turn));
    const base = positionValue(actual, 0, ahead);
    const parts = {};
    Object.keys(variants).forEach(k => {
      const alt = resolveTurn(st, variants[k], { fixed });
      parts[k] = { gain: positionValue(alt, 0, ahead) - base, dec: variants[k] };
    });
    const rep = actual.lastReport;
    out.push({ turn: st.turn, date: st.news.date, base, parts, mine, rec, rep, subs: st.creators[0].subs, stress: st.creators[0].stress, trends: st.news.trends, cap: production(st, st.creators[0], mine, st.news.mods).cap });
    st = actual;
  }
  return out;
}
function scaleAlloc(v, total) { const t = v.trends.slice(); let tt = t.reduce((a, b) => a + b, 0); while (tt > total) { const j = t.indexOf(Math.max(...t)); t[j]--; tt--; } return { ever: Math.max(0, total - tt), trends: t, total }; }

/* Live forecast for the planning screen (no rivals, no trend shares) */
function preview(st, dec) {
  const c = st.creators[0]; const d = sanitize(st, c, dec); const N = NICHES[st.niche]; const mods = st.news.mods;
  d._collabs = st.deals.filter(x => x.turn === st.turn && x.status === 'accepted' && x.type === 'collab' && (x.a === 0 || x.b === 0)).length;
  const pr = production(st, c, d, mods);
  const R = pr.R; const work = R.deep + R.pack + R.comm + R.study * 0.5 + R.job * 0.8 + pr.obl * 0.6;
  const sD = (work - 9) * 3.5 + pr.over * 5 - R.gym * 4 - pr.free * 2.5 + (c.house ? 3 : 0) + c.staff.length * 0.5;
  const base = baseViews(c, N, mods); let views = 0;
  const nTrend = d.videos.trends.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pr.nv; i++) views += base * pr.power * (i < nTrend ? 0.7 : 1) / (1 + 0.12 * i);
  views += c.library * mods.disc;
  const monet = c.peakSubs >= 1000;
  const wages = R.job * DAYS * 11 * pr.burn;
  const salaries = c.staff.reduce((a, s) => a + s.salary * PAYMULT[(d.pay && d.pay[s.id]) || s.pay || 'fair'], 0);
  const life = pr.life;
  const ads = monet ? views * N.rpm / 1000 * mods.rpm : 0;
  const sponsorPay = (d.sponsors || []).reduce((a, sid) => { const s = st.news.offers[0].sponsors.find(x => x.id === sid); return a + (s && pr.nv >= s.videos ? s.pay : 0); }, 0);
  const cb = pr.Q > 0 ? pr.C / Math.max(0.05, pr.Q) : 1;
  return { pr, d, stressNow: c.stress, stressNext: c.burnout > 0 ? 35 : clamp(c.stress + sD, 0, 100), stressDelta: sD, views, ads, wages, salaries, living: life.living - life.support, rent: c.house ? HOUSE_RENT : 0, sponsorPay, clickbait: cb > 1.4, monet };
}

const api = { NICHES, PERSONAS, STAFF_ROLES, TRAITS, GEAR, UNLOCKS, SALARY, PRODUCT_COST, HOUSE_RENT, SIZE_LABEL, DIFFICULTY, DAYS, WAKING,
  newGame, resolveTurn, generateNews, production, preview, lifeStage, dateOf, influence, standings, proposeDeal, acceptOffer, cancelDeal, sanitize, aiDecide, recommend, review, replay, unlockedFor, fmt, clone, rngFor, PAYMULT, hasRole };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TubeYou = api;
})(typeof window !== 'undefined' ? window : this);
