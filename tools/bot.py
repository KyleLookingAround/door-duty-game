# Browser smoke test: plays the built game like a careful player for N months and reports par failures and JS errors.
# usage: python3 tools/bot.py [ROUNDS] [--dev]   (default 48 rounds against dist/index.html; --dev serves src/ over http)
from playwright.sync_api import sync_playwright
import pathlib, json, time, sys
LOG=[]
def log(*a):
    s=' '.join(str(x) for x in a); LOG.append(s); print(s, flush=True)
def state(pg): return json.loads(pg.evaluate("localStorage.getItem('doorduty-tycoon-v2')") or 'null')
def set_range(pg, sel, v):
    pg.evaluate("([s,v])=>{const el=document.querySelector(s);if(!el)return;el.value=v;el.dispatchEvent(new Event('input'));el.dispatchEvent(new Event('change'))}", [sel, v])
def setc(pg, sel, want):
    el=pg.query_selector(sel)
    if not el or el.is_disabled(): return
    if el.is_checked()!=want: el.click(); pg.wait_for_timeout(30)
def apply_design(pg, slots):
    for i,s in enumerate(slots):
        pg.click(f'.slotbtn[data-i="{i}"]')
        btn=pg.query_selector(f'[data-t="{s["type"]}"]')
        if btn.is_disabled():
            if btn.get_attribute('aria-pressed')!='true': log('  !! type button disabled', i, s['type'])
        else: btn.click()
        if s['type']=='revolve':
            cur=int(pg.inner_text('#editor .row output'))
            while cur<s['wings']: pg.click('#wp'); cur+=1
            while cur>s['wings']: pg.click('#wm'); cur-=1
            if not pg.query_selector('#eRpm').is_disabled():
                set_range(pg,'#eRpm',s['rpm']); set_range(pg,'#eMouth',s['mouth']); set_range(pg,'#eCore',s['core'])
            for k,i in [('padded','#ePad'),('sensor','#eSen'),('wide','#eWide'),('doorman','#eDm'),('pillar','#ePil')]:
                setc(pg, i, bool(s.get(k)))
        if s['type']=='slider': setc(pg, '#eBtn', bool(s.get('button')))
        if s['type'] in ('swing','slider'):
            setc(pg, '#eCur', bool(s.get('curtain'))); setc(pg, '#eVes', bool(s.get('vestibule')))
        if s['type']=='swing': setc(pg, '#eDm', bool(s.get('doorman')))
        if s['type']=='gates': setc(pg, '#eGW', bool(s.get('wide'))); setc(pg, '#eDm', bool(s.get('doorman')))
        if s['type'] in ('swing','slider'): setc(pg, '#eLane', bool(s.get('lanes'))); setc(pg, '#ePil', bool(s.get('pillar')))
        f=s.get('flow','both')
        b=pg.query_selector(f'[data-flow="{f}"]')
        if b and not b.is_disabled(): b.click()

def company(pg):
    if not pg.evaluate("document.getElementById('sheetWrap').hidden"):
        for sel in ['#bClose','#mClose','#coClose','#rEdit']:
            if pg.query_selector(sel): pg.click(sel); pg.wait_for_timeout(500); break
    st=state(pg)
    pg.click('#rdBtn'); pg.wait_for_selector('#coClose')
    pg.click('[data-tab="research"]'); pg.wait_for_timeout(150)
    acted=[]
    # research: cheapest affordable available node
    btns=pg.query_selector_all('#sheet button[data-k]:not([disabled])')
    if btns: k=btns[0].get_attribute('data-k'); btns[0].click(); pg.wait_for_timeout(250); acted.append('research '+k)
    pg.click('[data-tab="premises"]'); pg.wait_for_timeout(150)
    mv=pg.query_selector('#sheet button[data-move]:not([disabled])')
    if mv and st['cash']>90000: mv.click(); pg.wait_for_timeout(250); acted.append('move')
    pg.click('[data-tab="staff"]'); pg.wait_for_timeout(150)
    for key in ['fitter','doorman','sales','engineer']:
        b=pg.query_selector(f'#sheet button[data-hire="{key}"]:not([disabled])')
        if b and state(pg)['cash']>40000: b.click(); pg.wait_for_timeout(250); acted.append('hire '+key)
    pg.click('#coClose'); pg.wait_for_timeout(500)
    if acted: log('  company:', ', '.join(acted))
def end_month(pg):
    company(pg)
    pg.click('#monthBtn'); pg.wait_for_selector('#mClose')
    st=state(pg); log(f"  [{st['year']}-{st['month']%12+1:02d}] cash {st['cash']} prem {st['premises']} staff {[k for k,v in st['staff'].items() if v]} tech {len(st['unlocks'])} research {[r['key'] for r in st['research']]}")
    log('  month:', pg.inner_text('#sheet h3'), '|', ' / '.join(l for l in pg.inner_text('#sheet').split('\n') if 'Research complete' in l or 'walked' in l or 'overdrawn' in l))
    pg.click('#mClose'); pg.wait_for_timeout(450)
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':390,'height':800},device_scale_factor=1)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and 'TUNNEL' not in m.text and errs.append(m.text))
    ROOT = pathlib.Path(__file__).resolve().parent.parent
    if '--dev' in sys.argv:
        import http.server, threading, functools
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/src/shell.html')
    else:
        pg.goto('file://'+str(ROOT / 'dist' / 'index.html'))
    pg.wait_for_timeout(300); pg.click('#iSkip' if pg.query_selector('#iSkip') else '#iGo'); pg.wait_for_timeout(300)
    pg.click('[data-view="list"]'); pg.wait_for_timeout(300)
    ROUNDS = next((int(a) for a in sys.argv[1:] if a.isdigit()), 48)
    for rnd in range(ROUNDS):
        st=state(pg)
        avail=[q for q in st['plots'] if q['status'] in ('open','callback')]
        if errs: log("  !! JS ERRORS", errs); errs.clear()
        log(f"--- round {rnd} {st['month']} cash {st['cash']} rep {sum(q['stars'] for q in st['plots'])} open {[q['name'][:8]+':'+q['status'] for q in avail]}")
        if not avail:
            end_month(pg); continue
        q=avail[0]
        for _ in range(4):   # the list can be redrawn under the click when a survey lands; retry
            pg.click(f'.plot[data-i="{q["i"]}"]')
            try: pg.wait_for_function("!document.getElementById('sheetWrap').hidden", timeout=2500); break
            except Exception: pass
        t0=time.time(); pg.wait_for_timeout(300)
        pg.wait_for_function("document.querySelector('#bTake') || document.getElementById('sheetWrap').hidden", timeout=180000)
        if not pg.query_selector('#bTake'):
            log(f"  {q['name']} false alarm after {time.time()-t0:.1f}s: {pg.inner_text('#toast')}"); pg.wait_for_timeout(700); continue
        st=state(pg); c=st['plots'][q['i']]['contract']
        log(f"  {'SPECIALIST ' if c.get('specialist') else ''}{q['name']} {q['status']} twists={c['twists']} temp={c['outsideTemp']} goals={c['goals']} par={c['par']['sig']} £{c['par']['cost']} budget {c['budget']} fee {c['fee']} survey {time.time()-t0:.1f}s novelty={c.get('novelty')}")
        pg.click('#bTake'); pg.wait_for_timeout(250)
        if q['status']=='callback' and not globals().get('shot_cb'):
            pg.screenshot(path='p_callback_ws.png', full_page=True); globals()['shot_cb']=1
        apply_design(pg, c['par']['slots'])
        cost=pg.inner_text('#kCost')
        pg.click('#testBtn')
        # skip straight to the result: the test runs the same steps, just without drawing them
        pg.wait_for_selector('#skipBtn:not([hidden])', timeout=5000); pg.click('#skipBtn')
        pg.wait_for_selector('#rEdit', timeout=60000)
        title=pg.inner_text('#sheet h3'); rows=pg.inner_text('#sheet .list').replace('\n',' | ')
        log(f"  result: {title} cost {cost} :: {rows}")
        if pg.query_selector('#rSign'): pg.click('#rSign'); pg.wait_for_timeout(450)
        else:
            log('  !! PAR DESIGN FAILED IN GAME'); pg.click('#rEdit'); pg.wait_for_timeout(500); pg.click('#wsBack'); pg.wait_for_timeout(500)
        if rnd % 3 == 2:
            pg.wait_for_timeout(300)
            end_month(pg)
    pg.screenshot(path='p_end.png', full_page=True)
    log('ERRORS', errs)
    b.close()
