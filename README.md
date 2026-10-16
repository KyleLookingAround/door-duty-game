# Door Duty Contractors

A crowd-science tycoon/puzzle game. You run a small firm fitting entrances on the High Street: revolving doors, swing and sliding doors, and later the ticket gates at the station. Every client is a puzzle. Design the frontage, test it in a 40-second rush hour full of simulated people, and sign it off if the client is happy. Fitted clients pay maintenance every month; spend it on research, staff and bigger premises, and the town opens up around you.

**Play:** the GitHub Pages build of this repo (one self-contained page, works offline once loaded).

## Develop

No dependencies to install. You need Node 20+ (and Python 3 with Playwright for the browser bot).

```
npm run dev     # then open http://localhost:8080/src/shell.html
npm test
npm run build   # dist/index.html
```

See [CLAUDE.md](CLAUDE.md) for the architecture, house rules and how to add a building, and [docs/game-loop.html](docs/game-loop.html) for the design.
