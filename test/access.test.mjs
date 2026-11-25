import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {generateKeyPairSync,sign} from 'node:crypto';

test('Access gates every route before asset delivery and reporting',async t=>{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const issuer='https://example.cloudflareaccess.com';
  const now=Math.floor(Date.now()/1000);
  const claims={iss:issuer,aud:['dashboard'],email:'employee@atom.team',type:'app',sub:'employee',iat:now-5,exp:now+60};
  function token(overrides={}){
    const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const body=encode({kid:'test',alg:'RS256'})+'.'+encode({...claims,...overrides});
    return body+'.'+sign('sha256',Buffer.from(body),privateKey).toString('base64url');
  }
  let requests=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(url===issuer+'/cdn-cgi/access/certs')return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]});
    const report=new URL(url);
    assert.equal(report.origin+report.pathname,'https://api-metrika.yandex.net/stat/v1/data');
    assert.equal(report.searchParams.get('ids'),'93465127');
    assert.equal(options.method,'GET');
    requests++;
    const count=report.searchParams.get('metrics').split(',').length;
    return Response.json({data:[],totals:Array(count).fill(0)});
  });
  const env={FREE_ONLY:'true',CF_ACCESS_TEAM:'example',CF_ACCESS_AUD:'dashboard',ASSETS:{fetch:()=>new Response('asset')}};
  const query='/api/sync?from=2026-01-01&to=2026-01-02';
  assert.equal((await worker.fetch(new Request('https://dashboard.test/'),{...env,FREE_ONLY:'false'})).status,503);
  function request(path,jwt,method='GET'){
    return worker.fetch(new Request('https://dashboard.test'+path,{method,headers:jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}}),env);
  }
  for(const path of ['/','/index.html','/dashboard.js','/api/health',query,'/api/unknown']){
    for(const jwt of [null,token({email:'outside@example.org'}),token({aud:['other']}),token({exp:now-1}),token({nbf:now+300}),token({email:'a@atom.team.example'}),token()+'.']){
      assert.ok([403,503].includes((await request(path,jwt)).status));
    }
  }
  assert.equal((await request('/',token())).status,200);
  assert.equal((await request(query,token())).status,503);
  assert.equal(requests,0);
  env.METRIKA_READ_TOKEN='local-fixture';
  assert.equal((await request(query,token(),'POST')).status,405);
  const response=await request(query,token());
  assert.equal(response.status,200);
  assert.equal((await response.json()).forms.length,6);
  assert.ok(requests>0);
});
