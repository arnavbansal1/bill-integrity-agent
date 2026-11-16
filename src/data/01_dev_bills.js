/* ---------------- Test bills (fictional) ---------------- */
const DEV_BILLS=[
{pro:"4471001",cust:"BRT",draft:{weight:1240,cls:70,contract:"BRT-v4",fsc:0.325,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471001\nShipper: Brightline Home Goods, Dayton OH\nConsignee: Riverside Home Store, Columbus OH\nPickup date: 11/04/2026\nPieces: 3 pallets\nWeight: 1,240 lb\nClass: 70\nSpecial services: None",
 driver:"Picked up 11/04 at 14:10. Delivered 11/05 at 09:40 at the consignee dock. No exceptions.",
 pod:"Received 3 pallets in good condition. Dock delivery. Signed: M. Ortiz, 11/05/2026"}},
{pro:"4471002",cust:"BRT",draft:{weight:860,cls:70,contract:"BRT-v4",fsc:0.325,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471002\nShipper: Brightline Home Goods, Dayton OH\nConsignee: Lakeside Furniture, Springfield OH\nPickup date: 11/05/2026\nPieces: 2 pallets\nWeight: 860 lb\nClass: 70\nSpecial services: None",
 driver:"Picked up 11/05 at 15:30. Delivered 11/06 at 11:15. No dock at consignee. Liftgate used to unload both pallets.",
 pod:"Received 2 pallets. Liftgate delivery. Signed: J. Park, 11/06/2026"}},
{pro:"4471003",cust:"NOR",draft:{weight:520,cls:70,contract:"NOR-v1",fsc:0.325,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471003\nShipper: Norfield Electronics, Columbus OH\nConsignee: Metro Office Supply, Cleveland OH\nPickup date: 11/06/2026\nPieces: 2 pallets\nWeight: 520 lb\nClass: 70\nSpecial services: None",
 driver:"Picked up 11/06 at 16:05. Delivered 11/09 at 10:20 at the consignee dock.",
 pod:"Received 2 pallets. Dock delivery. Signed: T. Wu, 11/09/2026",
 inspection:"WEIGHT & INSPECTION CERTIFICATE WI-88213\nPRO: 4471003\nTerminal: Columbus\nScale weight: 610 lb\nDimensioner: 2 pallets, each 48 x 40 x 60 in\nInspector: R. Hale, 11/07/2026"}},
{pro:"4471004",cust:"CAS",draft:{weight:900,cls:70,contract:"CAS-v2",fsc:0.325,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471004\nShipper: Cascade Outdoor Supply, Toledo OH\nConsignee: Summit Sports, Akron OH\nPickup date: 11/04/2026\nPieces: 2 pallets\nWeight: 900 lb\nClass: 70\nSpecial services: None",
 driver:"Picked up 11/04 at 13:00. Delivered 11/05 at 15:45 at the consignee dock.",
 pod:"Received 2 pallets in good condition. Signed: D. Ruiz, 11/05/2026",
 inspection:"WEIGHT & INSPECTION CERTIFICATE WI-88240\nPRO: 4471004\nTerminal: Toledo\nScale weight: 900 lb\nDimensioner: 2 pallets, each 48 x 40 x 40 in\nInspector: L. Grant, 11/05/2026"}},
{pro:"4471005",cust:"HRB",draft:{weight:1100,cls:85,contract:"HRB-v2",fsc:0.318,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471005\nShipper: Harbor Medical Distribution, Cincinnati OH\nConsignee: Valley Clinic Supply, Lexington KY\nPickup date: 10/31/2026\nPieces: 3 pallets\nWeight: 1,100 lb\nClass: 85\nSpecial services: None",
 driver:"Arrived at shipper 10/31 at 17:55; freight not ready. Picked up 11/01 at 08:20. Delivered 11/02 at 12:10 at the consignee dock.",
 pod:"Received 3 pallets. Signed: K. Mills, 11/02/2026",
 email:"From: Account manager, Harbor Medical\nSubject: Contract amendment\nPer the amendment, the new 74% discount applies to shipments picked up on or after November 1, 2026."}},
{pro:"4471006",cust:"BRT",draft:{weight:640,cls:70,contract:"BRT-v4",fsc:0.325,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471006\nShipper: Brightline Home Goods, Dayton OH\nConsignee: Oak Lane Interiors, Kettering OH\nPickup date: 11/06/2026\nPieces: 1 pallet\nWeight: 640 lb\nClass: 70\nSpecial services: Inside delivery requested",
 driver:"Picked up 11/06 at 09:50. Delivered 11/07 at 13:30. Consignee asked about bringing it inside; see POD."}},
{pro:"4471007",cust:"BRT",draft:{weight:450,cls:70,contract:"BRT-v4",fsc:0.325,acc:["LIFTGATE"]},docs:{
 bol:"BILL OF LADING\nPRO: 4471007\nShipper: Brightline Home Goods, Dayton OH\nConsignee: Maple Street Cafe, Dayton OH\nPickup date: 11/06/2026\nPieces: 1 pallet\nWeight: 450 lb\nClass: 70\nSpecial services: Liftgate requested at delivery",
 driver:"Picked up 11/06 at 11:20. Delivered 11/07 at 10:05. Consignee had a dock; liftgate not needed.",
 pod:"Received 1 pallet at the dock. Signed: A. Chen, 11/07/2026"}},
{pro:"4471008",cust:"CAS",draft:{weight:1500,cls:70,contract:"CAS-v2",fsc:0.325,acc:[]},docs:{
 bol:"BILL OF LADING\nPRO: 4471008\nShipper: Cascade Outdoor Supply, Toledo OH\nConsignee: Trailhead Outfitters, Findlay OH\nPickup date: 11/10/2026\nPieces: 3 pallets\nWeight: 1,500 lb\nClass: 70\nSpecial services: None",
 driver:"Picked up 11/10 at 10:40. Delivered 11/11 at 09:15 at the consignee dock.",
 pod:"Received 3 pallets. Signed: P. Lee, 11/11/2026"}}
];

