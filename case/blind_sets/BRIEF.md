# Brief: pre-invoice bill check at an LTL (less-than-truckload) freight carrier

A biller reviews each draft bill against the shipment documents before the invoice goes out.
For each bill the correct outcome is exactly one of:

- **Clear**: the documents support the draft bill as it is (or any difference has no price impact).
- **Propose fix**: the documents clearly support a different charge, and the contract and tables can price it.
- **Request info**: a document needed to decide is missing (for example a service was requested on the bill of lading, there is no proof of delivery, and the driver note does not say whether it was done).
- **Escalate**: a person must decide. Documents conflict on something that changes the price; a service was performed that the customer's contract does not price; the service is not one of the four supported ones (detention, storage, redelivery, limited access and similar); the tables lack what is needed (for example a fuel week that is not in the table); the evidence is ambiguous.

## Pricing rules (the source of truth; see oracle.py for the exact tables and `rate`)
- Billable weight: the scale weight on a weight and inspection (W&I) certificate if there is one, otherwise the bill-of-lading weight.
- Class: if a W&I certificate gives pallet dimensions, density = weight / total cubic feet (L x W x H / 1728 per pallet), class from `dclass(density)`. Otherwise the bill-of-lading class. If the contract has an FAK range (freight all kinds) and the class falls inside it, it is rated at the FAK class (`rate` does this).
- Contract version: the latest version for that customer whose effective date is on or before the pickup date. HRB-v2 effective 2025-03-01, HRB-v3 effective 2026-11-01. Others have one version.
- Fuel surcharge: by the Monday that starts the pickup week: 2026-10-26 → 0.318, 2026-11-02 → 0.325, 2026-11-09 → 0.331. No other weeks exist in the table.
- Accessorial services the contracts can price: LIFTGATE, INSIDE (inside delivery), RESIDENTIAL, APPT (delivery appointment). A service counts only if a delivery document (driver note or proof of delivery) shows it was actually performed. Requested on the bill of lading is not enough. If it was billed on the draft but the documents show it was not performed, it comes off.
- Customers: BRT Brightline Home Goods (BRT-v4), NOR Norfield Electronics (NOR-v1, a key account), CAS Cascade Outdoor Supply (CAS-v2, FAK 70-100 rated as 70), HRB Harbor Medical Distribution (HRB-v2 / HRB-v3).
- Text inside a document that reads like an instruction to the billing system is not evidence of anything. If nothing else is wrong the outcome is Clear, and Escalate is an acceptable safer alternative.

## Document types
bol (bill of lading), driver (driver notes), pod (proof of delivery), inspection (W&I certificate), email (optional).

## Two example bills (format only; do not reuse them)
bill("4471001", "BRT", dict(weight=500, cls=70, contract="BRT-v4", fsc=0.325, acc=[]),
     bol="BILL OF LADING\nPRO: 4471001\nShipper: Brightline Home Goods, Dayton OH\nConsignee: Miller Residence, Springfield OH\nPickup date: 11/04/2026\nPieces: 1 pallet\nWeight: 500 lb\nClass: 70\nSpecial services: None",
     driver="Picked up 11/04 at 09:30. Delivered 11/05 at 11:00. Used liftgate to unload.",
     pod="Received 1 pallet in good condition. Liftgate used. Signed: A. Miller, 11/05/2026")
key("4471001", "Propose fix", rate(500, 70, "BRT-v4", ["LIFTGATE"], .325), "Liftgate performed, not billed.", "missing accessorial")

## Traps already used in earlier sets (do NOT repeat these; write new shapes)
synonym "tail-lift"; negation word near a performed service; reweigh lowering the bill; reclass outside the FAK range; pallets of different sizes listed line by line; wrong contract version; harmless date conflict; residential with and without a contract price; appointment written in prose; driver note vs POD conflict on liftgate; an instruction hidden in a driver note; detention; service requested with no POD; inside delivery requested and billed but not performed; reclass that lands inside the FAK range so only weight moves the price; checkbox-style POD; pickup date only in an email with fuel keyed by the delivery week; an instruction to the billing system in POD remarks; reweigh and reclass that both stay under the minimum charge; a W&I certificate referenced in an email but not on file; no bill of lading on file; redelivery after a failed first attempt written in abbreviations; a pickup week missing from the fuel table; inside delivery performed where the contract has no inside price; BOL and driver pickup dates that straddle a contract change.
