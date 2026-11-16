/* ---------------- Saved AI output (offline fallback; same schema as live) ---------------- */
const SAVED_RUN=[
{pro:"4471001",services:[],inspection:null,pickup_dates:[{date:"2026-11-04",quote:"Pickup date: 11/04/2026",doc:"bol"},{date:"2026-11-04",quote:"Picked up 11/04 at 14:10.",doc:"driver"}],notes:"Dock delivery, no exceptions.",confidence:"high"},
{pro:"4471002",services:[{code:"LIFTGATE",performed:"yes",quote:"Liftgate used to unload both pallets.",doc:"driver"},{code:"LIFTGATE",performed:"yes",quote:"Liftgate delivery.",doc:"pod"}],inspection:null,pickup_dates:[{date:"2026-11-05",quote:"Pickup date: 11/05/2026",doc:"bol"}],notes:"No dock at consignee.",confidence:"high"},
{pro:"4471003",services:[],inspection:{weight_lb:610,pieces:2,dims_in:[48,40,60],weight_quote:"Scale weight: 610 lb",dims_quote:"Dimensioner: 2 pallets, each 48 x 40 x 60 in",doc:"inspection"},pickup_dates:[{date:"2026-11-06",quote:"Pickup date: 11/06/2026",doc:"bol"}],notes:"Inspected weight above BOL weight.",confidence:"high"},
{pro:"4471004",services:[],inspection:{weight_lb:900,pieces:2,dims_in:[48,40,40],weight_quote:"Scale weight: 900 lb",dims_quote:"Dimensioner: 2 pallets, each 48 x 40 x 40 in",doc:"inspection"},pickup_dates:[{date:"2026-11-04",quote:"Pickup date: 11/04/2026",doc:"bol"}],notes:"",confidence:"high"},
{pro:"4471005",services:[],inspection:null,pickup_dates:[{date:"2026-10-31",quote:"Pickup date: 10/31/2026",doc:"bol"},{date:"2026-11-01",quote:"Picked up 11/01 at 08:20.",doc:"driver"}],notes:"BOL and driver disagree on pickup date; email says new discount starts with pickups on or after Nov 1.",confidence:"medium"},
{pro:"4471006",services:[{code:"INSIDE",performed:"requested",quote:"Special services: Inside delivery requested",doc:"bol"},{code:"INSIDE",performed:"unclear",quote:"Consignee asked about bringing it inside; see POD.",doc:"driver"}],inspection:null,pickup_dates:[{date:"2026-11-06",quote:"Pickup date: 11/06/2026",doc:"bol"}],notes:"POD referenced but not provided.",confidence:"medium"},
{pro:"4471007",services:[{code:"LIFTGATE",performed:"requested",quote:"Special services: Liftgate requested at delivery",doc:"bol"},{code:"LIFTGATE",performed:"no",quote:"Consignee had a dock; liftgate not needed.",doc:"driver"}],inspection:null,pickup_dates:[{date:"2026-11-06",quote:"Pickup date: 11/06/2026",doc:"bol"}],notes:"",confidence:"high"},
{pro:"4471008",services:[],inspection:null,pickup_dates:[{date:"2026-11-10",quote:"Pickup date: 11/10/2026",doc:"bol"},{date:"2026-11-10",quote:"Picked up 11/10 at 10:40.",doc:"driver"}],notes:"",confidence:"high"}
];

const AGENT_VERSION="v2";
const DATASETS={
 dev:{label:"Dev set (8)",bills:DEV_BILLS,key:DEV_KEY,sha:DEV_KEY_SHA,saved:SAVED_RUN,
  traps:"A missed liftgate; a reweigh and reclass from an inspection certificate; a reclass that FAK makes price-neutral; pickup dates that straddle a contract change; a requested service with no proof of delivery; a liftgate billed but not used (a credit); a fuel surcharge from the wrong week."},
 blind:{label:"Blind set (15)",bills:BLIND_BILLS,key:BLIND_KEY,sha:BLIND_KEY_SHA,saved:null,
  traps:"Written after V1 and frozen before any AI run: synonyms (tail-lift, brought inside), negation words next to a performed service, a reweigh that lowers the bill, a reclass outside FAK, pallets of different sizes, a wrong contract version, a harmless date conflict, residential delivery with and without a contract price, an appointment in prose, conflicting delivery documents, a prompt injection inside a driver note, an unsupported service (detention), a requested service with no POD."}
};
const BILLS=[], ANSWER_KEY={};
let DATASET="dev";
function loadDataset(name){DATASET=name;const ds=DATASETS[name];BILLS.length=0;BILLS.push(...ds.bills);for(const k of Object.keys(ANSWER_KEY))delete ANSWER_KEY[k];Object.assign(ANSWER_KEY,ds.key)}
loadDataset("dev");

