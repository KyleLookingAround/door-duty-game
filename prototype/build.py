import re
e=open('engine.js').read(); g=open('gen.js').read(); u=open('ui.js').read()
# strip node exports to keep worker/browser clean
e=re.sub(r"\nif \(typeof module.*\n?$","\n",e); g=re.sub(r"\nif \(typeof module.*\n?$","\n",g)
h=open('shell.html').read().replace('/*ENGINE*/',e).replace('/*GEN*/',g).replace('/*UI*/',u)
open('index.html','w').write(h)
