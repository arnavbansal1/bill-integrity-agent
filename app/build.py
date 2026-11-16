"""Build app.html = agent v2 review app (app_v2.html, untouched logic) + rollout control view (src/rollout.*)."""
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parents[1]

s=open(str(ROOT/"app/review_app.html")).read()
css=open(str(ROOT/"app/rollout.css")).read(); js=open(str(ROOT/"app/rollout.js")).read()
def rep(old,new):
    global s
    assert s.count(old)==1,old[:60]; s=s.replace(old,new)
rep('</style>\n</head>',css+'</style>\n</head>')
rep('<div class="controls">\n<div class="seg" role="group" aria-label="Test set">','''<div class="controls">
<div class="seg" role="group" aria-label="View"><button id="viewReview" class="on">Agent review</button><button id="viewRollout">Rollout plan</button></div>
<div class="seg review-only" role="group" aria-label="Test set">''')
for old in ['<div class="seg" role="group" aria-label="Extraction source">','<button id="runBtn" class="btn primary">','<button id="run3Btn" class="btn"']:
    rep(old,old.replace('class="seg"','class="seg review-only"').replace('class="btn primary"','class="btn primary review-only"').replace('id="run3Btn" class="btn"','id="run3Btn" class="btn review-only"'))
rep('<footer>','''<div id="rollout"></div>
<div id="rJson" hidden><b>Plan as JSON</b><div class="muted">Copy this to keep or share a scenario, or paste an edited plan and click Apply (for example, new case facts).</div><textarea id="rJsonText" spellcheck="false"></textarea><div><button class="btn primary" id="rJsonApply">Apply</button> <button class="btn" id="rJsonClose">Close</button></div></div>
<footer>''')
import sys; sys.path.insert(0,str(ROOT/"app")); import arch
rep('<details class="panel"><summary>Raw AI output</summary>',arch.panel_html()+'\n<details class="panel"><summary>Raw AI output</summary>')
rep('</style>\n</head>',arch.CSS+'</style>\n</head>')
import evals, json
rec=open(str(ROOT/"app/recorded_blind.json")).read()
demo=open(str(ROOT/"app/demo.js")).read().replace('__RECORDED_BLIND__',rec.strip())
s=s.replace('<details class="panel" id="archPanel">',evals.panel_html()+'\n<details class="panel" id="archPanel">',1)
rep('</style>\n</head>',evals.CSS+'</style>\n</head>')
rep('</script>\n</body>',js+'\n'+demo+'\n</script>\n</body>')
open(str(ROOT/"app/index.html"),'w').write(s); print("built", len(s))
