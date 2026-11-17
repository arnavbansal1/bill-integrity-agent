import datetime as dt, json

TARIFF = {50: 72, 55: 80, 60: 88, 65: 96, 70: 104, 77.5: 112, 85: 124, 92.5: 136, 100: 148,
          110: 160, 125: 180, 150: 208, 175: 240, 200: 272, 250: 328, 300: 384, 400: 480, 500: 600}
FSC = {"2026-10-26": 0.318, "2026-11-02": 0.325, "2026-11-09": 0.331}
C = {
    "BRT-v4": dict(d=0.72, m=125, fak=None, acc={"LIFTGATE": 65, "RESIDENTIAL": 85, "INSIDE": 95, "APPT": 25}),
    "NOR-v1": dict(d=0.68, m=125, fak=None, acc={"LIFTGATE": 65, "INSIDE": 95, "APPT": 25}),
    "CAS-v2": dict(d=0.70, m=125, fak=(70, 100, 70), acc={"LIFTGATE": 65, "APPT": 25}),
    "HRB-v2": dict(d=0.70, m=125, fak=None, acc={"LIFTGATE": 70, "APPT": 30}),
    "HRB-v3": dict(d=0.74, m=125, fak=None, acc={"LIFTGATE": 70, "APPT": 30}),
}
r2 = lambda x: round(x + 1e-9, 2)
def dclass(p):
    for lo, c in [(50, 50), (35, 55), (30, 60), (22.5, 65), (15, 70), (13.5, 77.5), (12, 85), (10.5, 92.5), (9, 100), (8, 110), (7, 125), (6, 150), (5, 175), (4, 200), (3, 250), (2, 300), (1, 400)]:
        if p >= lo: return c
    return 500
def rate(w, cls, k, acc, fsc):
    c = C[k]; eff = c["fak"][2] if c["fak"] and c["fak"][0] <= cls <= c["fak"][1] else cls
    line = max(c["m"], r2(w / 100 * TARIFF[eff] * (1 - c["d"])))
    return r2(line + r2(line * fsc) + sum(c["acc"][a] for a in acc))

B = {}  # pro -> (cust, draft, docs)
def bill(pro, cust, draft, **docs): B[pro] = dict(cust=cust, draft=draft, docs=docs)
D = lambda p: rate(**{"w": B[p]["draft"]["weight"], "cls": B[p]["draft"]["cls"], "k": B[p]["draft"]["contract"], "acc": B[p]["draft"]["acc"], "fsc": B[p]["draft"]["fsc"]})
K = {}
def key(pro, outcome, total, why, trap, safe_alt=None):
    d = D(pro)
    K[pro] = dict(outcome=outcome, draft_total=d, expected_total=total, delta=None if total is None else r2(total - d), why=why, trap=trap, safe_alt=safe_alt or [])

def write(path_bills, path_key, version, note):
    json.dump(B, open(path_bills, "w"), indent=2)
    json.dump({"meta": {"version": version, "note": note}, "bills": K}, open(path_key, "w"), indent=2)
    for p, k in K.items():
        print(p, k["outcome"].ljust(12), k["delta"], "|", k["trap"], "| alt", k["safe_alt"])
