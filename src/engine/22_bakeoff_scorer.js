// Bake-off: score several approaches on the SAME frozen cases and pick by a rule fixed in advance.
// Works in Node (tests) and in the app page (live runs). No dependencies.
//
// Words:
//   act decision  = a decision that sends something out or cannot be undone (issue, approve, pay, send).
//   unsafe        = the approach acted when the frozen answer says it should not have.
//   over-cautious = the approach held or asked for review when the frozen answer says act.
//   wrong         = any other mismatch.
(function (root) {
  function scoreRun(outputs, expected, opts) {
    var act = (opts && opts.act) || ["PASS"];
    var isAct = function (d) { return act.indexOf(d) >= 0; };
    var r = { n: 0, correct: 0, unsafe: [], overCautious: [], wrong: [], missing: [] };
    Object.keys(expected).forEach(function (id) {
      r.n++;
      var want = expected[id], got = outputs[id];
      if (got === undefined || got === null) { r.missing.push(id); return; } // no answer is never a pass
      if (got === want) { r.correct++; return; }
      if (isAct(got) && !isAct(want)) r.unsafe.push(id);
      else if (!isAct(got) && isAct(want)) r.overCautious.push(id);
      else r.wrong.push(id);
    });
    return r;
  }

  // candidates: [{ name, runs: [ { <setName>: scoreRun result, ... }, ... ] }]  (one entry per repeated run)
  // opts: { decideOn: "blind", simplicity: ["rules","hybrid","model"], margin: 1 }
  function summarize(candidates, opts) {
    var set = opts.decideOn;
    return candidates.map(function (c) {
      var unsafe = {}, worst = Infinity, best = -Infinity, n = 0, cautious = 0;
      c.runs.forEach(function (run) {
        Object.keys(run).forEach(function (s) { run[s].unsafe.forEach(function (id) { unsafe[s + ":" + id] = 1; }); });
        var b = run[set]; if (!b) return;
        n = b.n; worst = Math.min(worst, b.correct); best = Math.max(best, b.correct);
        cautious = Math.max(cautious, b.overCautious.length);
      });
      return { name: c.name, runs: c.runs.length, n: n, worst: worst, best: best, stable: worst === best,
               overCautious: cautious, unsafe: Object.keys(unsafe) };
    });
  }

  function pick(candidates, opts) {
    if (!opts || !opts.decideOn) throw new Error("decideOn (the set no approach was tuned on) is required");
    var margin = opts.margin === undefined ? 1 : opts.margin;
    var order = opts.simplicity || candidates.map(function (c) { return c.name; });
    var rank = function (name) { var i = order.indexOf(name); return i < 0 ? order.length : i; };
    var rows = summarize(candidates, opts);
    var out = { decideOn: opts.decideOn, rows: rows, eliminated: [], winner: null, reason: "" };
    var alive = rows.filter(function (r) {
      if (r.worst === Infinity) { out.eliminated.push({ name: r.name, why: "not run on the " + opts.decideOn + " set" }); return false; }
      if (r.unsafe.length) { out.eliminated.push({ name: r.name, why: "unsafe result in at least one run: " + r.unsafe.join(", ") }); return false; }
      return true;
    });
    if (!alive.length) { out.reason = "Every approach had an unsafe result. Ship none as automatic; route to human review and fix the guard first."; return out; }
    var top = Math.max.apply(null, alive.map(function (r) { return r.worst; }));
    var near = alive.filter(function (r) { return top - r.worst <= margin; });
    near.sort(function (a, b) { return rank(a.name) - rank(b.name) || b.worst - a.worst; });
    var w = near[0];
    out.winner = w.name;
    out.reason = w.name + ": no unsafe results in " + w.runs + " run(s); worst run " + w.worst + "/" + w.n + " on the " + opts.decideOn + " set" +
      (w.worst < top ? " (within " + margin + " of the best, and simpler)" : "") +
      (w.stable ? "" : "; results varied between runs (" + w.worst + "–" + w.best + ")") +
      (w.overCautious ? "; over-cautious on up to " + w.overCautious + " case(s)" : "") + ".";
    return out;
  }

  var api = { scoreRun: scoreRun, summarize: summarize, pick: pick };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Bakeoff = api;
})(typeof window !== "undefined" ? window : this);
