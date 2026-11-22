// Money and the persistent world: the owner's cut, your stash, debt, reputation, regulars and the night log.
// Nothing ends the game. Bad nights turn into debt, chores and a reputation you have to live with.
const KEY = 'cornerstore.save.v1';
export const NIGHT_START = 23 * 60, NIGHT_LEN = 7 * 60;   // 11 PM to 6 AM, in game minutes
export const REAL_SECONDS = 30 * 60;                       // one night = 30 real minutes

export class World {
  constructor() {
    const d = this.load();
    this.night = d.night ?? 1;
    this.stash = d.stash ?? 0;            // your money, kept across nights
    this.debt = d.debt ?? 0;              // what you owe the owner
    this.respect = d.respect ?? 0;        // -100..100: how the block sees you
    this.marked = d.marked ?? 0;          // nights left where people think you fold
    this.weed = d.weed ?? 6;              // grams-ish units of product in the stash drawer
    this.fenced = d.fenced ?? [];         // stolen goods you bought to resell
    this.memory = d.memory ?? {};         // regulars: id -> { met, mood, flags }
    this.flags = d.flags ?? {};           // story flags across nights
    this.bets = d.bets ?? [];             // numbers slips due tonight
    this.stats = d.stats ?? { nights: 0, earned: 0, robbed: 0, shot: 0, arrests: 0, deaths: 0 };
    this.startNight();
  }
  load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ night: this.night, stash: this.stash, debt: this.debt, respect: this.respect, marked: this.marked, weed: this.weed, fenced: this.fenced, memory: this.memory, flags: this.flags, bets: this.bets, stats: this.stats }));
    } catch (e) { /* private mode */ }
  }
  reset() { try { localStorage.removeItem(KEY); } catch (e) { } }

  get cut() { return 180 + Math.min(10, this.night - 1) * 15; }   // what the owner expects from the register
  startNight() {
    this.float = 100;                     // the owner's change money in the drawer
    this.drawer = this.float;
    this.sales = 0; this.skimmed = 0; this.hustle = 0; this.tips = 0; this.takenByRobbers = 0;
    this.minutes = NIGHT_START; this.log = [];
    this.chores = this.debt > 0 ? this.makeChores() : [];
    this.audit = Math.random() < (this.debt > 0 ? 0.45 : 0.15);
    this.heat = 0;                        // how wild tonight has been (police respond slower when high)
  }
  makeChores() {
    const all = [
      { id: 'mop', text: 'Mop the spill by the fridges', done: false },
      { id: 'fridge', text: 'Restock the fridge (walk up to it and press E)', done: false },
      { id: 'face', text: 'Face the front shelves (press E at the chip aisle)', done: false },
      { id: 'count', text: 'Count the cigarettes (press E at the back shelf in the booth)', done: false },
    ];
    return all.sort(() => Math.random() - 0.5).slice(0, 2 + (this.debt > 400 ? 1 : 0));
  }
  get clock() {
    const m = Math.floor(this.minutes) % (24 * 60), h = Math.floor(m / 60), mm = m % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  get progress() { return (this.minutes - NIGHT_START) / NIGHT_LEN; }
  tick(dt) { this.minutes += dt * NIGHT_LEN / REAL_SECONDS; return this.minutes >= NIGHT_START + NIGHT_LEN; }

  note(text, kind = 'event') { this.log.push({ t: this.clock, text, kind }); }

  // a sale through the register: honest, skimmed, or overcharged
  sell(amount, { skim = 0, gouge = 0 } = {}) {
    const rung = Math.max(0, amount - skim);
    this.drawer += rung; this.sales += rung;
    if (skim > 0) { this.stash += skim; this.skimmed += skim; }
    if (gouge > 0) { this.stash += gouge; this.hustle += gouge; }
  }
  pocket(amount, why = 'hustle') { this.stash += amount; if (why === 'tip') this.tips += amount; else this.hustle += amount; }
  spend(amount) { if (this.stash < amount) return false; this.stash -= amount; return true; }
  robbedDrawer(fraction = 1) { const t = Math.round(this.drawer * fraction); this.drawer -= t; this.takenByRobbers += t; this.stats.robbed++; this.marked = 3; return t; }
  robbedPockets() { const t = Math.round(this.stash * 0.5); this.stash -= t; this.takenByRobbers += t; return t; }
  addRespect(n) { this.respect = Math.max(-100, Math.min(100, this.respect + n)); }
  remember(id, patch) { this.memory[id] = { met: 0, mood: 0, flags: {}, ...(this.memory[id] || {}), ...patch }; }

  // end of night: the owner takes the cut, the rest is yours
  clockOut() {
    const r = { night: this.night, drawer: Math.round(this.drawer), cut: this.cut, float: this.float, log: this.log.slice(), skimmed: this.skimmed, hustle: Math.round(this.hustle), tips: Math.round(this.tips), robbed: this.takenByRobbers };
    const owed = this.float + this.cut;
    let extra = this.drawer - owed;
    r.shortfall = Math.max(0, -extra);
    if (extra < 0) { this.debt += -extra; extra = 0; }
    // audit: the owner checks the tapes and the receipts
    r.audit = this.audit; r.caught = 0;
    if (this.audit && this.skimmed > 0 && Math.random() < Math.min(0.9, 0.25 + this.skimmed / 200)) { r.caught = this.skimmed * 2; this.debt += r.caught; }
    // unfinished chores cost you
    r.choresMissed = this.chores.filter(c => !c.done).length; this.debt += r.choresMissed * 25;
    // what's left over in the drawer pays debt first, then it's yours
    const toDebt = Math.min(this.debt, extra); this.debt -= toDebt; extra -= toDebt;
    r.paidDebt = toDebt; r.kept = Math.round(extra);
    this.stash += extra;
    this.stats.nights++; this.stats.earned += extra + this.skimmed + this.hustle + this.tips;
    if (this.marked > 0) this.marked--;
    r.debt = Math.round(this.debt); r.stash = Math.round(this.stash);
    this.night++;
    this.save();
    return r;
  }
  payDebtFromStash() { const p = Math.min(this.stash, this.debt); this.stash -= p; this.debt -= p; this.save(); return p; }
  died() {
    this.stats.deaths++;
    const bill = 600; this.debt += bill; const lost = Math.round(this.stash * 0.3); this.stash -= lost;
    return { bill, lost };
  }
}
