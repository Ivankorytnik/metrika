'use strict';
// Конструктор графиков: запросы только через /api/query (белый список на сервере).
const B_METRICS=[
 {id:'visits',label:'Визиты',t:'s'},
 {id:'users',label:'Уникальные посетители',t:'s'},
 {id:'pageviews',label:'Просмотры (все)',t:'s'},
 {id:'pv_views',label:'Просмотры страницы',t:'pv'},
 {id:'pv_users',label:'Посетители страницы',t:'pv'},
 {id:'goal_users',label:'Цель: уникальные посетители',t:'s',goal:true},
 {id:'goal_reaches',label:'Цель: достижения',t:'s',goal:true}
];
const B_DIMS={s:[['day','По дням'],['week','По неделям'],['month','По месяцам'],['source','Источники'],['device','Устройства'],['entry','Страницы входа'],['none','Только итог']],pv:[['day','По дням'],['week','По неделям'],['month','По месяцам'],['page','Страницы'],['none','Только итог']]};
const B_GOALS=[['294885979','Автоцель: отправка формы'],['295295757','Автоцель: заполнил контактные данные'],['613126044','Заявка на тест-драйв'],['350810808','B2B: открытие формы'],['350671857','B2B: клик отправить'],['350671830','B2B: отправка'],['310514840','Хочу АТОМ: отправка'],['466953801','АЭРО: открытие формы'],['466953820','АЭРО: отправка формы'],['490799597','Предзаказ: переход к форме'],['490801218','Предзаказ: клик «Забронировать»']];
const B_TIME=new Set(['day','week','month']);
const bState={cfg:{metric:'visits',dim:'day',site:'pro',page:'',match:'exact',goal:'294885979',view:'line'},result:null,error:'',busy:false,saved:[],savedResults:{}};
try{bState.saved=JSON.parse(localStorage.getItem('atomCharts')||'[]').slice(0,30)}catch(_){bState.saved=[]}
function bPersist(){try{localStorage.setItem('atomCharts',JSON.stringify(bState.saved))}catch(_){}}
const bEsc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bNum=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ru-RU').format(Number(v));
const bPct=(a,b)=>a==null||!b?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1,minimumFractionDigits:1}).format(100*a/b)+'%';
function bMetric(id){return B_METRICS.find(m=>m.id===id)||B_METRICS[0];}
function bFixDim(cfg){const list=B_DIMS[bMetric(cfg.metric).t].map(x=>x[0]);if(!list.includes(cfg.dim))cfg.dim=list[0];if(!B_TIME.has(cfg.dim)&&cfg.view==='line')cfg.view='bar';return cfg;}
function bTitle(cfg){const m=bMetric(cfg.metric);const g=m.goal?' · '+(B_GOALS.find(x=>x[0]===cfg.goal)||['',''])[1]:'';const d=(B_DIMS[m.t].find(x=>x[0]===cfg.dim)||['',''])[1];return m.label+g+' · '+d.toLowerCase()+(cfg.page?' · '+cfg.page:'')+(cfg.site==='pro'?' · pro.atom.auto':'');}
async function bFetch(cfg){
 const q=new URLSearchParams({metric:cfg.metric,dim:cfg.dim,site:cfg.site,match:cfg.match,from:state.from,to:state.to});
 if(cfg.page)q.set('page',cfg.page);if(bMetric(cfg.metric).goal)q.set('goal',cfg.goal);
 const r=await fetch('/api/query?'+q,{credentials:'same-origin',cache:'no-store'});
 let p;try{p=await r.json()}catch(_){throw new Error('Неверный ответ сервера (HTTP '+r.status+')')}
 if(!r.ok)throw new Error(p.error||'HTTP '+r.status);
 if(!Array.isArray(p.rows))throw new Error('Ошибка формата ответа');
 return p;
}
function bLine(rows){
 const pts=rows.filter(r=>r.value!==null);if(pts.length<2)return bBars(rows);
 const W=760,H=240,L=46,R=12,T=14,Bm=30,max=Math.max(1,...pts.map(r=>r.value));
 const x=i=>L+(W-L-R)*(rows.length<2?0:i/(rows.length-1)),y=v=>T+(H-T-Bm)*(1-v/max);
 let d='';rows.forEach((r,i)=>{if(r.value===null)return;d+=(d?'L':'M')+x(i).toFixed(1)+' '+y(r.value).toFixed(1);});
 const ticks=[0,.5,1].map(f=>Math.round(max*f));
 const step=Math.max(1,Math.ceil(rows.length/8));
 return `<svg class="b-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Динамика">${ticks.map(t=>`<line x1="${L}" x2="${W-R}" y1="${y(t)}" y2="${y(t)}" stroke="#e7e9e6"/><text x="${L-6}" y="${y(t)+4}" text-anchor="end" font-size="10" fill="#8b9290">${bNum(t)}</text>`).join('')}
 <path d="${d}" fill="none" stroke="#665bf0" stroke-width="2.5" stroke-linejoin="round"/>
 ${rows.map((r,i)=>r.value===null?'':`<circle cx="${x(i)}" cy="${y(r.value)}" r="3" fill="#665bf0"><title>${bEsc(r.label)}: ${bNum(r.value)}</title></circle>`).join('')}
 ${rows.map((r,i)=>i%step?'':`<text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="10" fill="#8b9290">${bEsc(String(r.label).slice(5))}</text>`).join('')}</svg>`;
}
function bBars(rows){
 const max=Math.max(1,...rows.map(r=>r.value||0));
 return `<div class="b-bars">${rows.slice(0,25).map(r=>`<div class="b-bar"><span class="b-lab" title="${bEsc(r.label)}">${bEsc(r.label)}</span><span class="b-track"><i style="width:${r.value?Math.max(1,100*r.value/max):0}%"></i></span><b>${bNum(r.value)}</b></div>`).join('')}</div>`;
}
function bTable(res){
 const base=res.total;
 return `<div class="audit-table-scroll"><table class="quality-table b-table"><thead><tr><th>${B_TIME.has(res.dim)?'Дата':'Значение'}</th><th>${bEsc(res.metric.unit)}</th><th>Доля от итога</th></tr></thead><tbody>${res.rows.map(r=>`<tr><td>${bEsc(r.label)}</td><td>${bNum(r.value)}</td><td>${bPct(r.value,base)}</td></tr>`).join('')}</tbody></table></div>`;
}
function bResult(res,cfg){
 if(!res.rows.length&&res.total===null)return `<div class="b-empty">Метрика не вернула данных за ${bEsc(res.period.from)} — ${bEsc(res.period.to)}.</div>`;
 const warn=[...(res.sampled?['Отчёт построен по выборке Метрики: значения приблизительные.']:[]),...(res.notes||[]),...(['users','pv_users','goal_users'].includes(cfg.metric)&&res.dim!=='none'?['Уникальные посетители по строкам не суммируются: один человек может попасть в несколько строк.']:[])];
 const body=res.dim==='none'?'':cfg.view==='table'?bTable(res):cfg.view==='line'&&B_TIME.has(res.dim)?bLine(res.rows):bBars(res.rows);
 return `<div class="b-total"><span>Итого за период</span><strong>${bNum(res.total)}</strong><small>${bEsc(res.metric.unit)} · ${bEsc(res.period.from)} — ${bEsc(res.period.to)}</small></div>${warn.map(w=>`<div class="b-warn">ⓘ ${bEsc(w)}</div>`).join('')}${body}${cfg.view!=='table'&&res.dim!=='none'?`<details class="b-details"><summary>Таблица значений</summary>${bTable(res)}</details>`:''}`;
}
function bSelect(id,list,val){return `<select id="${id}">${list.map(([v,l])=>`<option value="${bEsc(v)}"${v===val?' selected':''}>${bEsc(l)}</option>`).join('')}</select>`;}
function renderBuilder(){
 const c=bFixDim(bState.cfg),m=bMetric(c.metric);
 const views=B_TIME.has(c.dim)?[['line','Линия'],['bar','Столбцы'],['table','Таблица']]:[['bar','Столбцы'],['table','Таблица']];
 const result=bState.busy?'<div class="b-empty">Запрашиваем Метрику…</div>':bState.error?`<div class="b-error">${bEsc(bState.error)}</div>`:bState.result?bResult(bState.result,c):'<div class="b-empty">Выберите параметры и нажмите «Построить». Период берётся из верхнего фильтра.</div>';
 const saved=bState.saved.map((s,i)=>{const r=bState.savedResults[i];return `<div class="card b-saved"><div class="card-heading"><div><h3 class="card-title">${bEsc(s.name)}</h3><div class="card-subtitle">${bEsc(bTitle(s))}</div></div><div class="b-actions"><button type="button" class="mini-btn" data-b-open="${i}">Открыть</button><button type="button" class="mini-btn" data-b-del="${i}" aria-label="Удалить график">✕</button></div></div>${r?.error?`<div class="b-error">${bEsc(r.error)}</div>`:r?.res?bResult(r.res,s):'<div class="b-empty">Нажмите «Обновить мои графики».</div>'}</div>`;}).join('');
 return `<section>${section('Конструктор графиков','Собирайте свой отчёт из показателей Метрики. Данные запрашиваются на сервере только на чтение.')}
 <div class="card"><div class="b-grid">
  <label class="filter">Показатель${bSelect('bMetric',B_METRICS.map(x=>[x.id,x.label]),c.metric)}</label>
  ${m.goal?`<label class="filter">Цель${bSelect('bGoal',B_GOALS,c.goal)}</label>`:''}
  <label class="filter">Разрез${bSelect('bDim',B_DIMS[m.t],c.dim)}</label>
  <label class="filter">Сайт${bSelect('bSite',[['pro','pro.atom.auto'],['all','Все сайты счётчика']],c.site)}</label>
  <label class="filter">${m.t==='pv'?'Страница (путь)':'Страница входа (путь)'}<input id="bPage" type="text" inputmode="url" placeholder="/service/" value="${bEsc(c.page)}" maxlength="200"></label>
  <label class="filter">Сравнение${bSelect('bMatch',[['exact','Точно'],['contains','Содержит']],c.match)}</label>
  <label class="filter">Вид${bSelect('bView',views,c.view)}</label>
 </div><div class="b-buttons"><button type="button" class="round-btn sync-button" id="bRun"${bState.busy?' disabled':''}>Построить</button><button type="button" class="mini-btn" id="bSave">Сохранить график</button><span class="muted b-period">Период: ${bEsc(state.from)} — ${bEsc(state.to)} (из верхнего фильтра; источник и устройство здесь задаются разрезом)</span></div>
 <div class="b-out">${result}</div></div></section>
 <section>${section('Мои графики','Сохраняются в этом браузере. При обновлении пересчитываются за текущий период.',bState.saved.length?'<button type="button" class="mini-btn" id="bRefreshAll">Обновить мои графики</button>':'')}${saved||'<div class="b-empty">Сохранённых графиков пока нет.</div>'}</section>`;
}
function bReadForm(){const g=id=>document.getElementById(id);const c=bState.cfg;
 if(g('bMetric'))c.metric=g('bMetric').value;if(g('bGoal'))c.goal=g('bGoal').value;if(g('bDim'))c.dim=g('bDim').value;if(g('bSite'))c.site=g('bSite').value;
 if(g('bPage'))c.page=g('bPage').value.trim();if(g('bMatch'))c.match=g('bMatch').value;if(g('bView'))c.view=g('bView').value;bFixDim(c);}
async function bRun(){bReadForm();bState.busy=true;bState.error='';render();
 try{bState.result=await bFetch(bState.cfg)}catch(e){bState.result=null;bState.error='Не удалось построить: '+(e.message||'ошибка')}
 finally{bState.busy=false;render();}}
async function bRefreshAll(){bState.savedResults={};await Promise.all(bState.saved.map(async(s,i)=>{try{bState.savedResults[i]={res:await bFetch(s)}}catch(e){bState.savedResults[i]={error:e.message||'ошибка'}}}));render();}
document.getElementById('content').addEventListener('change',e=>{if(state.tab!=='builder'||!e.target.id?.startsWith('b'))return;if(e.target.id==='bPage')return bReadForm();bReadForm();render();});
document.getElementById('content').addEventListener('click',e=>{if(state.tab!=='builder')return;const t=e.target.closest('button');if(!t)return;
 if(t.id==='bRun')bRun();
 else if(t.id==='bSave'){bReadForm();const name=(prompt('Название графика',bTitle(bState.cfg))||'').trim().slice(0,80);if(!name)return;bState.saved.push({...bState.cfg,name});bState.savedResults={};bPersist();render();}
 else if(t.id==='bRefreshAll')bRefreshAll();
 else if(t.dataset.bOpen!==undefined){const s=bState.saved[Number(t.dataset.bOpen)];if(s){const {name,...cfg}=s;bState.cfg={...cfg};bRun();window.scrollTo({top:0,behavior:'smooth'});}}
 else if(t.dataset.bDel!==undefined){bState.saved.splice(Number(t.dataset.bDel),1);bState.savedResults={};bPersist();render();}
});
document.getElementById('content').addEventListener('keydown',e=>{if(state.tab==='builder'&&e.key==='Enter'&&e.target.id==='bPage'){e.preventDefault();bRun();}});
window.renderBuilder=renderBuilder;
