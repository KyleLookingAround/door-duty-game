# Buildings

One file per client. Each exports a default object:

| field | used by | what |
|---|---|---|
| `key` | everything | id, also the save's `kind` |
| `plot` | street | `{ name, rep, needs?, street?, why? }`: who they are and when they'll talk to you |
| `kind` | contracts | crowd (`in`, `out`, `mix`), `slots`, `comfort`, the first-visit `hook`, flags (`station`, `towers`, `cinema`) |
| `site(ctx)` | engine + drawing | street furniture for `n` bays: push to `S.obstacles` / `S.decos` / `S.labels`; may set `S.rampBays`, `S.spawnIn`, `S.surge`, `S.trains` |
| `floor` | job screen | lobby floor material |
| `look` | street scene | `w`, `h`, `base`, `trim`, `sign`, `labelTop` (how far above the roof the status pill floats), `hoarding` (text on the boards while it waits for research) |
| `upper(a)` / `front(a)` / `after(a)` | street scene | draw the building's architecture (SVG strings pushed to `a.o`): above the shopfront, over the fascia, after the doors |
| `brief(c)`, `chips(c)`, `phases` | brief, workshop | extra text for this client's jobs: a paragraph in the brief, tags above the plan, and the banner for each phase of the day |
| `doorTypes` | workshop | which fittings the bays offer (default wall, revolving, swing, sliding; the station offers wall and gates) |
| `concourse` | workshop | call the lobby a concourse and show the queue instead of the temperature |
| `candidates(c, tech)` | surveyor | the designs the surveyor tries, when the generic set doesn't fit (the station's gate lines) |
| `twistPool` | contracts | the twists this client can draw, instead of the general pool |

The order of buildings in `index.js` is the order of plots in a save. Only ever append.
