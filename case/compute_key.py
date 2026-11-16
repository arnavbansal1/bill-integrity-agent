"""Independent answer-key calculator for the Bill Integrity Agent test set.
Written before any AI run. All data fictional and illustrative."""
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parents[1]

import datetime as dt
import json

TARIFF = {50: 72, 55: 80, 60: 88, 65: 96, 70: 104, 77.5: 112, 85: 124, 92.5: 136, 100: 148,
          110: 160, 125: 180, 150: 208, 175: 240, 200: 272, 250: 328, 300: 384, 400: 480, 500: 600}
FSC = {"2026-10-26": 0.318, "2026-11-02": 0.325, "2026-11-09": 0.331}
CONTRACTS = {
    "BRT-v4": dict(effective="2026-01-01", discount=0.72, minimum=125, fak=None, acc={"LIFTGATE": 65, "RESIDENTIAL": 85, "INSIDE": 95, "APPT": 25}),
    "NOR-v1": dict(effective="2025-09-01", discount=0.68, minimum=125, fak=None, acc={"LIFTGATE": 65, "INSIDE": 95, "APPT": 25}),
    "CAS-v2": dict(effective="2025-06-01", discount=0.70, minimum=125, fak=(70, 100, 70), acc={"LIFTGATE": 65, "APPT": 25}),
    "HRB-v2": dict(effective="2025-03-01", discount=0.70, minimum=125, fak=None, acc={"LIFTGATE": 70, "APPT": 30}),
    "HRB-v3": dict(effective="2026-11-01", discount=0.74, minimum=125, fak=None, acc={"LIFTGATE": 70, "APPT": 30}),
}

def r2(x):
    return round(x + 1e-9, 2)

def week_start(d):
    d = dt.date.fromisoformat(d)
    return (d - dt.timedelta(days=d.weekday())).isoformat()

def density_class(pcf):
    for lo, c in [(50, 50), (35, 55), (30, 60), (22.5, 65), (15, 70), (13.5, 77.5), (12, 85), (10.5, 92.5),
                  (9, 100), (8, 110), (7, 125), (6, 150), (5, 175), (4, 200), (3, 250), (2, 300), (1, 400)]:
        if pcf >= lo:
            return c
    return 500

def rate(weight, cls, cid, accs, fsc):
    c = CONTRACTS[cid]
    eff = cls
    if c["fak"] and c["fak"][0] <= cls <= c["fak"][1]:
        eff = c["fak"][2]
    line = max(c["minimum"], r2(weight / 100 * TARIFF[eff] * (1 - c["discount"])))
    f = r2(line * fsc)
    a = sum(c["acc"][x] for x in accs)
    return r2(line + f + a)

drafts = {
    "4471001": dict(w=1240, c=70, k="BRT-v4", a=[], d="2026-11-04"),
    "4471002": dict(w=860, c=70, k="BRT-v4", a=[], d="2026-11-05"),
    "4471003": dict(w=520, c=70, k="NOR-v1", a=[], d="2026-11-06"),
    "4471004": dict(w=900, c=70, k="CAS-v2", a=[], d="2026-11-04"),
    "4471005": dict(w=1100, c=85, k="HRB-v2", a=[], d="2026-10-31"),
    "4471006": dict(w=640, c=70, k="BRT-v4", a=[], d="2026-11-06"),
    "4471007": dict(w=450, c=70, k="BRT-v4", a=["LIFTGATE"], d="2026-11-06"),
    "4471008": dict(w=1500, c=70, k="CAS-v2", a=[], d="2026-11-10", fsc_override=0.325),
}

key = {}
for pro, x in drafts.items():
    fsc = x.get("fsc_override", FSC[week_start(x["d"])])
    x["draft_total"] = rate(x["w"], x["c"], x["k"], x["a"], fsc)

# Expected corrected totals (independent reasoning per bill)
def exp(pro, outcome, total, why, must):
    d = drafts[pro]["draft_total"]
    key[pro] = {"outcome": outcome, "draft_total": d,
                "expected_total": total, "delta": None if total is None else r2(total - d),
                "why": why, "must_catch": must}

exp("4471001", "Clear", drafts["4471001"]["draft_total"], "Clean bill; nothing to change.", False)
exp("4471002", "Propose fix", rate(860, 70, "BRT-v4", ["LIFTGATE"], FSC["2026-11-02"]),
    "Liftgate used per driver note and POD; missing from draft; contract price $65.", True)
pcf3 = 610 / (2 * 48 * 40 * 60 / 1728)
exp("4471003", "Propose fix", rate(610, density_class(pcf3), "NOR-v1", [], FSC["2026-11-02"]),
    f"W&I cert: 610 lb, density {pcf3:.2f} pcf -> class {density_class(pcf3)}; reweigh and reclass.", True)
pcf4 = 900 / (2 * 48 * 40 * 40 / 1728)
exp("4471004", "Clear", drafts["4471004"]["draft_total"],
    f"Density {pcf4:.2f} pcf -> class {density_class(pcf4)}, but FAK 70-100 rates as 70; no change.", True)
exp("4471005", "Escalate", None,
    "BOL says pickup 10/31 but driver says picked up 11/01; dates straddle the HRB-v3 effective date.", True)
exp("4471006", "Request info", None,
    "Inside delivery requested on BOL; POD not provided; cannot confirm service was performed.", True)
exp("4471007", "Propose fix", rate(450, 70, "BRT-v4", [], FSC["2026-11-02"]),
    "Liftgate requested but driver says not needed (dock); draft charged it; credit $65.", True)
exp("4471008", "Propose fix", rate(1500, 70, "CAS-v2", [], FSC["2026-11-09"]),
    "Pickup 11/10 falls in week of 11/09 (33.1%); draft used 32.5%.", False)

meta = {"version": "v1", "created": "2026-11-15", "note": "Written before any AI run. Fictional data.",
        "pickup_dates": {p: drafts[p]["d"] for p in drafts}}
print(json.dumps(key, indent=2))
print("pcf3", round(pcf3, 3), "pcf4", round(pcf4, 3))
for p in drafts:
    print(p, week_start(drafts[p]["d"]), drafts[p]["draft_total"])
with open(str(ROOT/"case/answer_key_v1.json"), "w") as f:
    json.dump({"meta": meta, "bills": key}, f, indent=2)
