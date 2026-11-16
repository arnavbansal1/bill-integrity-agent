/* ---------------- State ---------------- */
const state={viewing:null,db:undefined,mode:"saved",results:{},sel:null,selF:null,decisions:{},raw:null,runs:[],log:[],busy:false,ctl:null,sample:null};
function logLine(s){state.log.push(`[${new Date().toLocaleTimeString()}] ${s}`);renderLog()}

