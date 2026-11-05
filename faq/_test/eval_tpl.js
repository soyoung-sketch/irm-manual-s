(function(){const Q=__Q__;
return Q.map(x=>{let r;try{r=aiAnswer(x.q);}catch(e){r={kind:"ERR",top:String(e)};}
return {q:x.q,expect:x.expect,intent:x.intent,kind:r.kind,top:r.top||"",faq:r.faq||"",sc:r.sc,list:(r.list||[]).map(s=>s.replace(/:[0-9.]+$/,""))};});})()
