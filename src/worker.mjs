// ATOM Metrika: private read-only Cloudflare Worker.
// Fail closed. Never deploy without CF_ACCESS_TEAM, CF_ACCESS_AUD and METRIKA_READ_TOKEN.
const COUNTER='93465127';
const YANDEX='https://api-metrika.yandex.net/stat/v1/data';
const SOURCE={ad:['ads','Реклама','#665bf0'],direct:['direct','Прямые заходы','#b0aaff'],organic:['search','Поиск','#7ad5d2'],internal:['internal','Внутренние','#cedd75'],referral:['referral','Переходы с сайтов','#ffac81'],social:['social','Соцсети','#bcaafa'],recommend:['recommend','Рекомендации','#a2cbc7'],email:['email','Email','#e8bf83'],saved:['saved','Сохранённые','#adb6b1'],messenger:['messenger','Мессенджеры','#95b6c5'],qrcode:['qr','QR','#8d9399']};
const DEVICE={mobile:['mobile','Смартфоны','#665bf0'],desktop:['desktop','Компьютеры','#d8fd5d'],tablet:['tablet','Планшеты','#8fdcdd'],tv:['tv','Smart TV','#697780']};
const GOAL_NAMES={'295295757':'Автоцель: заполнил контактные данные','294885979':'Автоцель: отправка формы','613126044':'Заявка на тест-драйв','350810808':'B2B: открытие формы','350671857':'B2B: клик отправить','350671830':'B2B: отправка','310514840':'Хочу АТОМ: отправка','466953801':'АЭРО: открытие формы','466953820':'АЭРО: отправка формы','490799597':'Предзаказ: переход к форме','490801218':'Предзаказ: клик «Забронировать»'};
const FORM_GOALS={all:{start:295295757,submit:294885979},testdrive:{submit:613126044},b2b:{open:350810808,click:350671857,submit:350671830},want:{submit:310514840},aero:{open:466953801,submit:466953820},preorder:{open:490799597,click:490801218}};
const FORM_LABELS={all:'Все формы · автоцель',testdrive:'Тест-драйв',b2b:'B2B · заявка',want:'Хочу АТОМ',aero:'АЭРО · корпоративная форма',preorder:'Предзаказ / бронь'};
const NO_CACHE={'Cache-Control':'no-store, private','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin'};
function json(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:NO_CACHE});}
function error(message,status=400){return json({error:message},status);}
let keyCache={expires:0,keys:[]};
function parseJwtPart(str){let x=str.replace(/-/g,'+').replace(/_/g,'/');x+='='.repeat((4-x.length%4)%4);return JSON.parse(atob(x));}
function fromBase64url(str){let x=str.replace(/-/g,'+').replace(/_/g,'/');x+='='.repeat((4-x.length%4)%4);return Uint8Array.from(atob(x),c=>c.charCodeAt(0));}
async function isAuthorized(request,env){
  const h=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!h||h.length>16000)return false;
  const parts=h.split('.');if(parts.length!==3)return false;
  const team=env.CF_ACCESS_TEAM;
  if(!/^[a-z0-9-]{2,64}$/.test(team||''))return false;
  const header=parseJwtPart(parts[0]),claims=parseJwtPart(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string')return false;
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==`https://${team}.cloudflareaccess.com`||!Array.isArray(claims.aud)||!claims.aud.includes(env.CF_ACCESS_AUD))return false;
  if(claims.type!=='app'||!claims.sub||(claims.nbf!==undefined&&!(Number(claims.nbf)<=now)))return false;
  if(!(Number(claims.exp)>now&&Number(claims.iat)<now+60))return false;
  const email=String(claims.email||'').toLowerCase();
  if(!/^[^\s@]+@atom\.team$/.test(email))return false;
  if(Date.now()>keyCache.expires){
    const resp=await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`,{redirect:'error'});
    if(!resp.ok)throw new Error('Access keys unavailable');
    const docs=await resp.json();
    if(!Array.isArray(docs.keys))throw new Error('Invalid Access keys');
    keyCache={keys:docs.keys,expires:Date.now()+10*60*1000};
  }
  const jwk=keyCache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const bytes=new TextEncoder().encode(parts[0]+'.'+parts[1]);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,fromBase64url(parts[2]),bytes);
}
const num=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Math.max(0,Math.round(Number(v)));
const flt=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);
async function report(env,start,end,metrics,dimensions=null,extra={}){
  const params=new URLSearchParams({ids:COUNTER,date1:start,date2:end,metrics:metrics.join(','),accuracy:'full',lang:'ru',limit:'100',include_undefined:'true',...extra});
  if(dimensions)params.set('dimensions',dimensions);
  const res=await fetch(YANDEX+'?'+params.toString(),{method:'GET',headers:{Authorization:'OAuth '+env.METRIKA_READ_TOKEN,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(25000)});
  if(res.status===401)throw new Error('OAuth-токен Метрики истёк или неверен');
  if(res.status===403)throw new Error('Нет доступа metrika:read к счётчику');
  if(res.status===429)throw new Error('Лимит API Яндекс Метрики исчерпан');
  if(!res.ok)throw new Error('Яндекс Метрика вернула HTTP '+res.status);
  if(Number(res.headers.get('content-length')||0)>2_000_000)throw new Error('Слишком большой ответ Метрики');
  const text=await res.text();if(text.length>2_000_000)throw new Error('Слишком большой ответ Метрики');
  const output=JSON.parse(text);if(!output||typeof output!=='object'||output.errors?.length)throw new Error('Ошибка структуры отчёта Метрики');
  return output;
}
function rows(report,lookup){return (report.data||[]).slice(0,100).map(row=>{
  const d=(row.dimensions||[{}])[0]||{};
  const apiId=String(d.id||'undefined');
  const mapped=lookup[apiId]||[apiId,String(d.name||apiId),'#adb6b1'];
  const v=row.metrics||[];
  return {id:String(mapped[0]).slice(0,50),label:String(mapped[1]).slice(0,90),color:mapped[2],visits:num(v[0]),visitors:num(v[1]),bounce:flt(v[2])};
});}
async function build(env,start,end){
  const overview=await report(env,start,end,['ym:s:visits','ym:s:users','ym:s:pageviews']);
  if(!Array.isArray(overview.totals)||overview.totals.length<3)throw new Error('Нет основных показателей');
  const [visits,visitors,pageviews]=overview.totals.slice(0,3).map(num);
  if([visits,visitors,pageviews].some(v=>v===null))throw new Error('Не получены KPI');
  const [srcRep,devRep]=await Promise.all([
    report(env,start,end,['ym:s:visits','ym:s:users','ym:s:bounceRate'],'ym:s:<attribution>TrafficSource',{attribution:'cross_device_last_significant'}),
    report(env,start,end,['ym:s:visits','ym:s:users','ym:s:bounceRate'],'ym:s:deviceCategory'),
  ]);
  const sources=rows(srcRep,SOURCE),devices=rows(devRep,DEVICE);
  const goals=Object.keys(GOAL_NAMES), goalValues={};
  for(let i=0;i<goals.length;i+=3){
    const part=goals.slice(i,i+3), metrics=part.flatMap(g=>['users','visits','reaches'].map(k=>`ym:s:goal${g}${k}`));
    const res=await report(env,start,end,metrics);
    if(!Array.isArray(res.totals)||res.totals.length!==metrics.length)throw new Error('Не получены цели');
    part.forEach((g,j)=>goalValues[g]={users:num(res.totals[j*3]),visits:num(res.totals[j*3+1]),reaches:num(res.totals[j*3+2])});
  }
  const forms=Object.entries(FORM_GOALS).map(([id,stages])=>{
    const obj={id,label:FORM_LABELS[id],open:null,start:null,click:null,submit:null,submitReaches:null,note:id==='all'?'Общая автоцель контактов — не первое действие с любой формой':'Цели независимы: не образуют подтверждённую последовательную воронку.'};
    for(const [stage,goal] of Object.entries(stages)){
      obj[stage]=goalValues[goal]?.users??null;
      obj[stage+'Goal']=String(goal);
      obj[stage+'Visits']=goalValues[goal]?.visits??null;
      if(stage==='submit')obj.submitReaches=goalValues[goal]?.reaches??null;
    }return obj;
  });
  const goalEvidence=goals.map(g=>({label:GOAL_NAMES[g],goal:g,visits:goalValues[g]?.visits??null,reaches:goalValues[g]?.reaches??null,users:goalValues[g]?.users??null}));
  const sourceTotal=sources.reduce((a,x)=>a+(x.visits||0),0),deviceTotal=devices.reduce((a,x)=>a+(x.visits||0),0);
  const warnings=[];
  if(Math.abs(sourceTotal-visits)>Math.max(10,visits*.005))warnings.push('Сумма источников отличается от общего итога; необходима проверка атрибуции.');
  if(Math.abs(deviceTotal-visits)>Math.max(10,visits*.005))warnings.push('Сумма устройств отличается от общего итога.');
  warnings.push('Конверсия по этапам не подтверждена на уровне последовательных действий одних пользователей.');
  return {period:{from:start,to:end},summary:{visits,visitors,pageviews,pageviewsOther:null,approxPageviews:false,comparison:{}},sourceTotal,sources,devices,forms,goalEvidence,syncMeta:{origin:'yandex_api',readOnly:true,attribution:'cross_device_last_significant',goalUnit:'unique_users',warnings,sampled:Boolean(overview.sampled||srcRep.sampled||devRep.sampled)}};
}

// ---- Chart builder: strict whitelist, nothing user-supplied reaches the API unchecked.
const QMETRICS={
  visits:{t:'s',m:'ym:s:visits',label:'Визиты',unit:'визитов'},
  users:{t:'s',m:'ym:s:users',label:'Уникальные посетители',unit:'людей'},
  pageviews:{t:'s',m:'ym:s:pageviews',label:'Просмотры (все)',unit:'просмотров'},
  pv_views:{t:'pv',m:'ym:pv:pageviews',label:'Просмотры страницы',unit:'просмотров'},
  pv_users:{t:'pv',m:'ym:pv:users',label:'Посетители страницы',unit:'людей'},
  goal_users:{t:'s',goal:'users',label:'Цель: уникальные посетители',unit:'людей'},
  goal_reaches:{t:'s',goal:'reaches',label:'Цель: достижения',unit:'достижений'},
};
const QDIMS={
  s:{none:null,day:'ym:s:date',week:'ym:s:startOfWeek',month:'ym:s:startOfMonth',source:'ym:s:<attribution>TrafficSource',device:'ym:s:deviceCategory',entry:'ym:s:startURLPath'},
  pv:{none:null,day:'ym:pv:date',week:'ym:pv:startOfWeek',month:'ym:pv:startOfMonth',page:'ym:pv:URLPath'},
};
const TIME_DIMS=new Set(['day','week','month']);
const SITES={all:null,pro:'pro.atom.auto'};
const qCache=new Map();
function validPeriod(start,end){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(end||''))return 'Неверный формат дат';
  const ds=Date.parse(start),de=Date.parse(end);
  if(!Number.isFinite(ds)||!Number.isFinite(de)||ds>de||(de-ds)>730*86400000||de>Date.now()+86400000)return 'Период не поддерживается';
  return null;
}
export function parseQuery(u){
  const metric=u.searchParams.get('metric')||'',dim=u.searchParams.get('dim')||'none',site=u.searchParams.get('site')||'all';
  const page=u.searchParams.get('page')||'',match=u.searchParams.get('match')||'exact',goal=u.searchParams.get('goal')||'';
  const from=u.searchParams.get('from'),to=u.searchParams.get('to');
  const M=QMETRICS[metric];if(!M)return {error:'Неизвестный показатель'};
  if(!Object.hasOwn(QDIMS[M.t],dim))return {error:'Этот разрез недоступен для выбранного показателя'};
  if(!Object.hasOwn(SITES,site))return {error:'Неизвестный сайт'};
  if(page&&!/^\/[A-Za-z0-9\-._~\/%]{0,200}$/.test(page))return {error:'Путь страницы должен начинаться с / и содержать только латиницу, цифры и -._~/%'};
  if(!['exact','contains'].includes(match))return {error:'Неверный режим сравнения'};
  if(M.goal&&!Object.hasOwn(GOAL_NAMES,goal))return {error:'Выберите цель из списка'};
  const pe=validPeriod(from,to);if(pe)return {error:pe};
  const p=M.t==='pv'?'ym:pv:':'ym:s:';
  const filters=[];
  if(SITES[site])filters.push(`${M.t==='pv'?'ym:pv:URLDomain':'ym:s:startURLDomain'}=='${SITES[site]}'`);
  if(page)filters.push(`${M.t==='pv'?'ym:pv:URLPath':'ym:s:startURLPath'}${match==='exact'?'==':'=@'}'${page}'`);
  const apiMetric=M.goal?`ym:s:goal${goal}${M.goal}`:M.m;
  const extra={};
  if(filters.length)extra.filters=filters.join(' AND ');
  if(dim==='source')extra.attribution='cross_device_last_significant';
  const dimension=QDIMS[M.t][dim];
  if(dimension)extra.sort=TIME_DIMS.has(dim)?dimension:'-'+apiMetric;
  if(dimension)extra.limit=TIME_DIMS.has(dim)?'1000':'50';
  return {metric,dim,site,page,match,goal,from,to,M,apiMetric,dimension,extra,prefix:p};
}
async function runQuery(env,q){
  const key=JSON.stringify([q.apiMetric,q.dimension,q.extra,q.from,q.to]);
  const hit=qCache.get(key);if(hit&&hit.expires>Date.now())return hit.value;
  const rep=await report(env,q.from,q.to,[q.apiMetric],q.dimension,q.extra);
  const lookup=q.dim==='source'?SOURCE:q.dim==='device'?DEVICE:{};
  const rowsOut=(rep.data||[]).slice(0,1000).map(row=>{
    const d=(row.dimensions||[{}])[0]||{};
    const id=String(d.id??d.name??'');
    const label=lookup[id]?lookup[id][1]:String(d.name??(id||'Не определено'));
    return {key:id.slice(0,200),label:label.slice(0,200),value:num((row.metrics||[])[0])};
  });
  const total=Array.isArray(rep.totals)?num(rep.totals[0]):null;
  const value={period:{from:q.from,to:q.to},metric:{id:q.metric,label:q.M.label,unit:q.M.unit},goal:q.goal?{id:q.goal,label:GOAL_NAMES[q.goal]}:null,dim:q.dim,site:q.site,page:q.page||null,match:q.match,rows:rowsOut,total,sampled:Boolean(rep.sampled),notes:q.M.t==='s'&&q.page?['Для показателей визитов фильтр страницы работает по странице входа.']:[],fetchedAt:new Date().toISOString()};
  if(qCache.size>200)qCache.clear();
  qCache.set(key,{value,expires:Date.now()+10*60*1000});
  return value;
}
// ---- Cache of the default report (KV is optional: without it every sync is live).
function isoDay(d){return d.toISOString().slice(0,10);}
export function defaultPeriod(now=new Date()){const end=new Date(now);const start=new Date(now);start.setUTCDate(start.getUTCDate()-29);return {from:isoDay(start),to:isoDay(end)};}
async function kvGet(env,key){if(!env.CACHE)return null;try{return await env.CACHE.get(key,'json')}catch(_){return null}}
async function kvPut(env,key,val){if(!env.CACHE)return;try{await env.CACHE.put(key,JSON.stringify(val))}catch(_){}}
async function syncAndStore(env,from,to){
  const result=await build(env,from,to);
  result.syncMeta.syncedAt=new Date().toISOString();
  const d=defaultPeriod();
  if(from===d.from&&to===d.to)await kvPut(env,'latest',result);
  await kvPut(env,'status',{ok:true,at:result.syncMeta.syncedAt,from,to});
  return result;
}
export default {
 async scheduled(event,env,ctx){
  if(!env.METRIKA_READ_TOKEN)return;
  const {from,to}=defaultPeriod();
  try{await syncAndStore(env,from,to)}
  catch(e){const prev=await kvGet(env,'status')||{};await kvPut(env,'status',{...prev,ok:false,errorAt:new Date().toISOString(),error:String(e.message||'ошибка').slice(0,150)});}
 },
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  // Fail closed before serving any HTML or API data.
  if(!env.CF_ACCESS_TEAM||!env.CF_ACCESS_AUD)return error('Сервис не настроен: обратитесь к администратору',503);
  let ok=false;try{ok=await isAuthorized(request,env)}catch(_){return error('Проверка корпоративной авторизации недоступна',503)}
  if(!ok)return error('Доступ только для сотрудников @atom.team',403);
  if(request.method!=='GET')return error('Только чтение (GET)',405);
  if(path==='/api/health')return json({ready:Boolean(env.METRIKA_READ_TOKEN),counterId:COUNTER,readOnly:true,cache:Boolean(env.CACHE)});
  if(path==='/api/status')return json({ready:Boolean(env.METRIKA_READ_TOKEN),cache:Boolean(env.CACHE),status:await kvGet(env,'status'),defaultPeriod:defaultPeriod()});
  if(path==='/api/meta')return json({goals:Object.entries(GOAL_NAMES).map(([id,label])=>({id,label})),metrics:Object.entries(QMETRICS).map(([id,m])=>({id,label:m.label,unit:m.unit,table:m.t,goal:Boolean(m.goal),dims:Object.keys(QDIMS[m.t])})),sites:[{id:'all',label:'Все сайты счётчика'},{id:'pro',label:'pro.atom.auto'}]});
  if(path==='/api/sync'){
    if(!env.METRIKA_READ_TOKEN)return error('Синхронизация ещё не подключена',503);
    const start=url.searchParams.get('from'),end=url.searchParams.get('to');
    const pe=validPeriod(start,end);if(pe)return error(pe,400);
    if(url.searchParams.get('force')!=='1'){
      const cached=await kvGet(env,'latest');
      if(cached&&cached.period?.from===start&&cached.period?.to===end&&Date.now()-Date.parse(cached.syncMeta?.syncedAt||0)<70*60*1000)return json({...cached,syncMeta:{...cached.syncMeta,fromCache:true}});
    }
    try{return json(await syncAndStore(env,start,end))}catch(e){return error('Не удалось получить отчёт: '+String(e.message||'ошибка').slice(0,150),502)}
  }
  if(path==='/api/query'){
    if(!env.METRIKA_READ_TOKEN)return error('Синхронизация ещё не подключена',503);
    const q=parseQuery(url);if(q.error)return error(q.error,400);
    try{return json(await runQuery(env,q))}catch(e){return error('Метрика не вернула отчёт: '+String(e.message||'ошибка').slice(0,150),502)}
  }
  if(path.startsWith('/api/'))return error('Нет такого API',404);
  const asset=await env.ASSETS.fetch(request);
  const hdrs=new Headers(asset.headers);
  hdrs.set('Cache-Control','no-store, private');hdrs.set('Referrer-Policy','no-referrer');hdrs.set('X-Content-Type-Options','nosniff');hdrs.set('X-Frame-Options','DENY');hdrs.set('Cross-Origin-Resource-Policy','same-origin');
  hdrs.set('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return new Response(asset.body,{status:asset.status,headers:hdrs});
 }
};
