// Enquiries: a fitted client asks for work that needs research you haven't done yet, and gives you a date.
// Have it ready in time and they call with the job, plus a bonus for being ready; let the date pass and they
// stop waiting (to the rival, once there is one). And advice(S): the one thing that would bring in work,
// for the months when nothing is on the table.
import { TECH } from '../content/tech.js';
import { PREMISES } from '../content/company.js';
import { PARADOX_CALLS, callFits } from '../content/paradoxes.js';
import { prem, rep, rivalActive, missingNeeds } from './economy.js';
import { random, randomInt } from './state.js';
import { canResearch, freeBenches, researchingOrQueued } from './research.js';
import { kmoney } from '../util/format.js';

export const MAX_ENQUIRIES = 2;
export const ENQUIRY_SLACK = 3;   // months to spare beyond the research itself
export const enquiryBonus = key => { const t = TECH.find(x => x.key === key); return t ? Math.round(t.price * 0.3 / 500) * 500 : 0; };
export const hasWork = S => S.plots.some(p => p.status === 'open' || p.status === 'callback' || p.status === 'checking');

// Settle this month's enquiries and maybe take a new one (always, when the firm has nothing on).
// Runs in endMonth after research has finished. Returns { won, lapsed, fresh }.
export function settleEnquiries(S, quiet) {
  const won = [], lapsed = [];
  for (const p of S.plots) {
    const e = p.enquiry;
    if (!e) continue;
    const def = (PARADOX_CALLS[e.tech] || [])[e.j];
    if (!def || p.status === 'rival' || p.status === 'locked') { p.enquiry = null; continue; }
    if (S.unlocks[e.tech] && (e.ready || S.month <= e.by)) {
      e.ready = true;
      if (p.status !== 'fitted' || p.broken) continue;   // busy with something else: they call once it's sorted
      p.status = 'callback'; p.reason = 'paradox'; p.contract = null; p.tier++;
      p.callText = e.text; p.callTech = e.tech; p.callTwist = def.twist || null; p.callStage = def.stage || null; p.callChain = def.chain || null;
      won.push(p);
    } else if (S.month > e.by) {
      p.enquiry = null; p.askAfter = S.month + 6;   // they won't ask again for a while
      const rival = p.status === 'fitted' && rivalActive(S);
      if (rival) { p.status = 'rival'; p.rivalUntil = S.month + 3 + randomInt(S, 3); p.contract = null; }
      else p.coped = Math.max(0, (p.coped || 0) - 1);   // a little less loyal
      lapsed.push({ p, tech: e.tech, rival });
    }
  }
  let fresh = null;
  const open = S.plots.filter(p => p.enquiry && !p.enquiry.ready).length;
  if (open < MAX_ENQUIRIES && (quiet || random(S) < 0.3)) {
    const opts = [];
    for (const t of TECH) {
      if (S.moving || !canResearch(S, t) || S.plots.some(p => p.enquiry && p.enquiry.tech === t.key) || t.price > S.cash + 40000) continue;
      (PARADOX_CALLS[t.key] || []).forEach((def, j) => {
        for (const p of S.plots) if (p.status === 'fitted' && !p.broken && !p.enquiry && (p.askAfter || 0) <= S.month && callFits(def, p)) opts.push({ t, j, p, def });
      });
    }
    if (opts.length) {
      const o = opts[randomInt(S, opts.length)];
      o.p.enquiry = { tech: o.t.key, j: o.j, by: S.month + o.t.months + ENQUIRY_SLACK + (S.unlocks.network ? 1 : 0), text: o.def.text, bonus: enquiryBonus(o.t.key) };
      fresh = o.p;
    }
  }
  return { won, lapsed, fresh };
}

// What would bring in work? One suggestion: { text, tab } (tab: the Company tab to open, if any), or null.
export function advice(S) {
  const P = prem(S), free = freeBenches(S), r = rep(S);
  const short = t => S.cash < t.price ? `, and you need ${kmoney(t.price - S.cash)} more for it` : '';
  // an enquiry waiting on research you haven't started
  const asked = S.plots.find(p => p.enquiry && !p.enquiry.ready && !researchingOrQueued(S, p.enquiry.tech));
  if (asked && free > 0) {
    const t = TECH.find(x => x.key === asked.enquiry.tech);
    return { tab: 'research', text: `Start ${t.name}: ${asked.name} wants it within ${asked.enquiry.by - S.month} months (${t.months} to research)${short(t)}.` };
  }
  if (free > 0) {
    // research that gets a client who'd talk to you now through the door
    for (const p of S.plots) {
      if (p.status !== 'locked' || r < p.rep) continue;
      const miss = missingNeeds(S, p), t = TECH.find(x => miss.includes(x.key) && canResearch(S, x));
      if (t) return { tab: 'research', text: `Research ${t.name}: ${miss.length > 1 ? `${p.name} needs it (and ${miss.length - 1} more) before they'll talk` : `${p.name} will talk to you once you have it`}${short(t)}.` };
    }
    // research a client you've fitted would call about
    const calls = TECH.filter(t => canResearch(S, t)).map(t => ({ t, who: (PARADOX_CALLS[t.key] || []).flatMap(d => S.plots.filter(p => p.status === 'fitted' && callFits(d, p)))[0] })).filter(x => x.who).sort((a, b) => a.t.price - b.t.price);
    if (calls.length) { const { t, who } = calls[0]; return { tab: 'research', text: `Research ${t.name} (${kmoney(t.price)}): clients like ${who.name} would call with work for it${short(t)}.` }; }
  }
  const next = PREMISES[(S.premises || 0) + 1];
  const bigger = next && !S.moving && (free <= 0 || TECH.some(t => !S.unlocks[t.key] && t.tier > P.tier));
  if (bigger && r >= (next.rep || 0)) return { tab: 'premises', text: `${S.cash >= next.price ? 'Move' : `Save ${kmoney(next.price - S.cash)} more and move`} to the ${next.name.toLowerCase()}: ${free <= 0 ? 'more research benches' : `tier ${next.tier} research`} brings in new kinds of work.` };
  if (free <= 0 && S.research.length) { const x = S.research[0], t = TECH.find(y => y.key === x.key); return { tab: 'research', text: `${t.name} finishes in ${x.left} month${x.left > 1 ? 's' : ''}. New research brings clients calling.` }; }
  const nextPlot = S.plots.filter(p => p.status === 'locked' && p.rep > r).sort((a, b) => a.rep - b.rep)[0];
  if (nextPlot) return { tab: null, text: `${nextPlot.name} will talk at ${nextPlot.rep}★ (you have ${r}★). Callbacks done well earn stars too.` };
  return null;
}
