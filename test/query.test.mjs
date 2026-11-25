import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{parseQuery,defaultPeriod} from '../src/worker.mjs';
import {generateKeyPairSync,sign} from 'node:crypto';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const issuer='https://example.cloudflareaccess.com';
function token(){
  const now=Math.floor(Date.now()/1000);
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const body=enc({kid:'test',alg:'RS256'})+'.'+enc({iss:issuer,aud:['dashboard'],email:'boss@atom.team',type:'app',sub:'b',iat:now-5,exp:now+60});
  return body+'.'+sign('sha256',Buffer.from(body),privateKey).toString('base64url');
}
function kv(){const m=new Map();return {m,get:async(k)=>m.has(k)?JSON.parse(m.get(k)):null,put:async(k,v)=>{m.set(k,v)}};}
const q=s=>parseQuery(new URL('https://x/api/query?'+s));

test('parseQuery accepts only whitelisted combinations',()=>{
  const ok=q('metric=pv_views&dim=page&site=pro&page=/service/&from=2026-10-01&to=2026-10-31');
  assert.equal(ok.apiMetric,'ym:pv:pageviews');
  assert.equal(ok.dimension,'ym:pv:URLPath');
  assert.equal(ok.extra.filters,"ym:pv:URLDomain=='pro.atom.auto' AND ym:pv:URLPath=='/service/'");
  assert.equal(q('metric=goal_users&dim=day&goal=294885979&from=2026-10-01&to=2026-10-31').apiMetric,'ym:s:goal294885979users');
  assert.equal(q('metric=visits&dim=day&from=2026-10-01&to=2026-10-31').extra.sort,'ym:s:date');
  for(const bad of [
    'metric=ym:s:visits&dim=day&from=2026-10-01&to=2026-10-31',
    'metric=pv_views&dim=source&from=2026-10-01&to=2026-10-31',
    "metric=visits&dim=day&page=/a'%20OR%201&from=2026-10-01&to=2026-10-31",
    'metric=visits&dim=day&page=service&from=2026-10-01&to=2026-10-31',
    'metric=goal_users&dim=day&goal=1&from=2026-10-01&to=2026-10-31',
    'metric=visits&dim=day&from=2026-10-31&to=2026-10-01',
    'metric=visits&dim=day&site=evil.com&from=2026-10-01&to=2026-10-31',
    'metric=visits&dim=__proto__&from=2026-10-01&to=2026-10-31',
  ])assert.ok(q(bad).error,bad);
});

test('query, cache and schedule work behind Access, read-only',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,opt)=>{
    if(url===issuer+'/cdn-cgi/access/certs')return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]});
    const u=new URL(url);assert.equal(opt.method,'GET');assert.equal(u.searchParams.get('ids'),'93465127');
    calls.push(u);
    const metrics=u.searchParams.get('metrics').split(',');
    if(u.searchParams.get('dimensions')==='ym:s:date')return Response.json({data:[{dimensions:[{name:'2026-10-01'}],metrics:[5]},{dimensions:[{name:'2026-10-02'}],metrics:[7]}],totals:[12],sampled:false});
    return Response.json({data:[],totals:metrics.map(()=>3)});
  });
  const env={CF_ACCESS_TEAM:'example',CF_ACCESS_AUD:'dashboard',METRIKA_READ_TOKEN:'fixture',CACHE:kv(),ASSETS:{fetch:()=>new Response('a')}};
  const call=(p,jwt=token())=>worker.fetch(new Request('https://d.test'+p,{headers:jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}}),env);
  assert.equal((await call('/api/query?metric=visits&dim=day&from=2026-10-01&to=2026-10-02',null)).status,403);
  const r=await call('/api/query?metric=visits&dim=day&from=2026-10-01&to=2026-10-02');
  assert.equal(r.status,200);const body=await r.json();
  assert.equal(body.total,12);assert.deepEqual(body.rows.map(x=>x.value),[5,7]);
  assert.equal((await call('/api/query?metric=bad')).status,400);
  // Scheduled sync stores the default period in KV, and a non-forced sync serves it.
  await worker.scheduled({},env,{});
  const st=await (await call('/api/status')).json();assert.equal(st.status.ok,true);
  const before=calls.length;const {from,to}=defaultPeriod();
  const cached=await (await call(`/api/sync?from=${from}&to=${to}`)).json();
  assert.equal(cached.syncMeta.fromCache,true);assert.equal(calls.length,before);
  const forced=await (await call(`/api/sync?from=${from}&to=${to}&force=1`)).json();
  assert.ok(!forced.syncMeta.fromCache);assert.ok(calls.length>before);assert.ok(forced.syncMeta.syncedAt);
});

test('API errors are reported, not replaced by numbers',async t=>{
  t.mock.method(globalThis,'fetch',async url=>{
    if(url===issuer+'/cdn-cgi/access/certs')return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]});
    return new Response('{}',{status:429});
  });
  const env={CF_ACCESS_TEAM:'example',CF_ACCESS_AUD:'dashboard',METRIKA_READ_TOKEN:'fixture',ASSETS:{fetch:()=>new Response('a')}};
  const r=await worker.fetch(new Request('https://d.test/api/query?metric=users&dim=none&from=2026-09-01&to=2026-09-02',{headers:{'Cf-Access-Jwt-Assertion':token()}}),env);
  assert.equal(r.status,502);assert.match((await r.json()).error,/Лимит API/);
  await worker.scheduled({},{...env,CACHE:kv()},{});
});
