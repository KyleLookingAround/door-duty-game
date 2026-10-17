// Boot: load the save, wire up every screen, start the surveyor and the frame loop.
import { SIM_DT, runSeconds, testOver } from '../game/contracts.js';
import { draw, initCanvas } from './canvas.js';
import { coachEl, initCoach, placeCoach } from './coach.js';
import { $, closeSheet, initDom, onSheetClosed, sheet, toast } from './dom.js';
import { initSheets } from './sheets.js';
import { S, loadSave, save } from './store.js';
import { renderStreet } from './street.js';
import { startWorker, survey, surveyHooks } from './survey.js';
import { W, evaluateTest, initWorkshop, updateHud } from './workshop.js';
let prev = performance.now(), acc = 0, hudT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
  if (W) {
    const h = SIM_DT;
    if (W.mode === 'test') {
      // inside jobs run for minutes of simulated time; play them back so a whole test takes about a minute at 1x
      acc += dt * (S.speed || 3) * (W.contract.stage ? Math.max(1, W.contract.run / 60) : 1);
      let n = 0;
      // step count must match the surveyor's exactly, so the same design gives the same result
      const total = Math.round(runSeconds(W.contract) / h);
      W.steps = W.steps || 0;
      while (acc >= h && n < 240 && W.steps < total && !testOver(W.contract, W.world)) { W.world.step(h); W.steps++; acc -= h; n++; }
      if (n >= 240) acc = 0;
      for (const e of W.world.events) if (e.t > W.lastEvT) W.fx.push({ ...e, t0: now / 1000 });
      if (W.world.events.length) W.lastEvT = W.world.events[W.world.events.length - 1].t;
      if (W.steps >= total || testOver(W.contract, W.world)) {
        // let the "lobby clear" moment show for a beat before the results
        W.endHold = (W.endHold || 0) + dt;
        if (W.steps >= total || W.endHold > 1.2) { W.endHold = 0; evaluateTest(); updateHud(); }
      }
    } else if (W.mode === 'design') {
      acc += dt; while (acc >= h) { W.world.step(h); acc -= h; }
    }
    draw(now / 1000);
    if (coachEl.id) placeCoach();
    hudT += dt; if (hudT > 0.15) { hudT = 0; updateHud(); }
  }
  if (!W && coachEl.id) placeCoach();
  requestAnimationFrame(frame);
}

// full screen: the whole page, where the browser allows it (some embeds and iPhones don't)
function initFullscreen() {
  const el = document.documentElement, btn = $('fsBtn');
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!req || !enabled) return;   // leave the button hidden
  btn.hidden = false;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const sync = () => {
    $('fsIcon').setAttribute('d', isFull() ? 'M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5' : 'M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5');
    btn.setAttribute('aria-label', isFull() ? 'Exit full screen' : 'Full screen'); btn.title = btn.getAttribute('aria-label');
  };
  btn.onclick = () => {
    try {
      const p = isFull() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : req.call(el);
      if (p && p.catch) p.catch(() => toast('Full screen isn\'t available here', true));
    } catch (e) { toast('Full screen isn\'t available here', true); }
  };
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
}
function showIntro() {
  if (!S.seenIntro) {
    sheet(`<div class="eyebrow">Prototype</div><h3>Door Duty Contractors</h3>
      <p>You run a small firm that fits entrances on the High Street. Every shop that hires you is a puzzle: design its frontage, test it in a 40-second rush hour, and sign it off if the client is happy.</p>
      <p>Revolving doors seal out the cold, but their wing tips move at v = ω·r and bump people if you spin them too fast. Swing and sliding doors are cheap and quick but leak heat. Fitted clients pay maintenance every month, and sometimes call you back when things change.</p>
      <div style="display:flex;gap:8px"><button class="ghost" type="button" id="iSkip">I know the trade</button><button class="go" type="button" id="iGo">Show me around</button></div>`);
    $('iGo').onclick = () => { S.seenIntro = true; S.tut = { done: {} }; save(); closeSheet(); renderStreet(); };
    $('iSkip').onclick = () => { S.seenIntro = true; S.tut = { done: {}, off: true }; save(); closeSheet(); };
    // however the intro is dismissed, it only shows once
    onSheetClosed.push(() => { if (!S.seenIntro) { S.seenIntro = true; S.tut = S.tut || { done: {} }; save(); setTimeout(renderStreet, 50); } });
  }
}

// ---------- boot ----------
loadSave();
initDom(); initCanvas(); initCoach(); initWorkshop(); initSheets(); initFullscreen();
startWorker();
// a survey that lands while the player is on the street shows up straight away
surveyHooks.changed = () => { if (!W && $('sheetWrap').hidden) renderStreet(); };
onSheetClosed.push(() => { if (!W) renderStreet(); });
renderStreet();
showIntro();
requestAnimationFrame(frame);
