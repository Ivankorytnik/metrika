
'use strict';
const BASE={
  period:{from:'2026-10-27',to:'2026-11-25'},
  summary:{visits:null,visitors:null,pageviews:null,pageviewsOther:null,approxPageviews:false,comparison:{}},
  sourceTotal:null,sources:[],devices:[],goalEvidence:[],
  forms:[
   {id:'all',label:'Все формы · автоцель',open:null,start:null,click:null,submit:null,submitReaches:null,submitGoal:'294885979',note:'Данные появятся после защищённой синхронизации'},
   {id:'testdrive',label:'Тест-драйв',open:null,start:null,click:null,submit:null,submitReaches:null,submitGoal:'613126044'},
   {id:'b2b',label:'B2B · заявка',open:null,start:null,click:null,submit:null,submitReaches:null,openGoal:'350810808',clickGoal:'350671857',submitGoal:'350671830'},
   {id:'want',label:'Хочу АТОМ',open:null,start:null,click:null,submit:null,submitReaches:null,submitGoal:'310514840'},
   {id:'aero',label:'АЭРО · корпоративная форма',open:null,start:null,click:null,submit:null,submitReaches:null,openGoal:'466953801',submitGoal:'466953820'},
   {id:'preorder',label:'Предзаказ / бронь',open:null,start:null,click:null,submit:null,submitReaches:null,openGoal:'490799597',clickGoal:'490801218'}
  ],syncMeta:{origin:'not_loaded',readOnly:true,goalUnit:'unique_users',warnings:['Нужна синхронизация с Метрикой']}
};
let data=structuredClone(BASE);

let syncing=false;
let lastSyncTime=null;
const state={tab:'overview',period:'snapshot',from:BASE.period.from,to:BASE.period.to,source:'all',device:'all',form:'all',imported:false};
const $=id=>document.getElementById(id);
const safe=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v));
const pct=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:1}).format(Number(v))+'%';
const ratio=(a,b)=>b?100*a/b:0;
const measuredShare=(a,b)=>a===null||a===undefined||!Number.isFinite(Number(a))||!Number.isFinite(Number(b))||Number(b)<=0?null:100*Number(a)/Number(b);
const inlinePct=(v,kind='neutral',label='')=>v===null||v===undefined||!Number.isFinite(Number(v))?'':`<span class="inline-percent ${safe(kind)}" title="${safe(label)}">${kind==='positive'&&Number(v)>0?'+':''}${pct(v)}</span>`;
const isDateMatch=()=>state.from===data.period.from&&state.to===data.period.to;
function mode(){return !isDateMatch()?'date':state.source!=='all'&&state.device!=='all'?'cross':state.source!=='all'?'source':state.device!=='all'?'device':'all';}
function currentScope(){const m=mode();if(m==='date'||m==='cross')return null;if(m==='source'){let x=data.sources.find(z=>z.id===state.source);return x?{visits:x.visits,visitors:x.visitors,label:x.label}:null;}if(m==='device'){let x=data.devices.find(z=>z.id===state.device);return x?{visits:x.visits,visitors:x.visitors,label:x.label}:null;}return {...data.summary,label:'Весь сайт'};}
const currentForm=()=>data.forms.find(f=>f.id===state.form)||data.forms[0];
function putOptions(el,list,allLabel,selected){let opts=allLabel?[{id:'all',label:allLabel},...list]:list;el.innerHTML=opts.map(x=>`<option value="${safe(x.id)}">${safe(x.label)}</option>`).join('');el.value=selected;if(el.selectedIndex<0)el.selectedIndex=0;}
function initOptions(){putOptions($('sourceSelect'),data.sources,'Все источники',state.source);putOptions($('deviceSelect'),data.devices,'Все устройства',state.device);putOptions($('formSelect'),data.forms,null,state.form);}
function noData(label='Для этого среза данных нет',hint='В сохранённом отчёте нет сопоставимой детализации. Не подставляем числа из другого сегмента.') {return `<div class="no-data"><div class="symbol">◇</div><strong>${safe(label)}</strong><span>${safe(hint)}</span></div>`;}
function calloutContext(){let m=mode();const el=$('contextNote');el.className='context-note';let msg='';if(m==='date')msg='За выбранные даты нет загруженного отчёта. Показатели не пересчитываются из общей суммы: выберите исходный период или импортируйте JSON с нужной датой.';else if(m==='cross')msg='Пересечение фильтров «Источник × Устройство» не представлено в исходной выгрузке. Для такого среза нужен отдельный отчёт; значения скрыты.';else if(m==='source'||m==='device')msg=`Показатели посещений ниже относятся к сегменту «${safe(currentScope()?.label||'')}». Цели форм для этого сегмента не выгружены и не будут подставлены из общего отчёта.`;if(msg){el.classList.add('visible');if(m!=='date')el.classList.add('warning');$('contextNoteText').innerHTML=msg;}}
function section(h,sub,right=''){return `<div class="section-head"><div><div class="overline">Показатели / atom.auto</div><h2>${h}</h2>${sub?`<p>${sub}</p>`:''}</div>${right}</div>`;}
function makeKpi(title,value,unit,icon,kind='',percentage=null,percentageLabel='',percentageKind='neutral'){
 const showPercentage=value!=='—'&&percentage!==null&&percentage!==undefined;
 return `<div class="kpi ${kind}"><div class="top"><span>${title}</span><span class="badge-icon">${icon}</span></div><div class="kpi-value-line"><span class="value">${value}</span>${showPercentage?inlinePct(percentage,percentageKind,percentageLabel):''}</div><div class="unit">${unit}</div>${showPercentage&&percentageLabel?`<div class="pct-caption">${safe(percentageLabel)}</div>`:''}<div class="tick"></div></div>`;
}
function kpiBlock(){
 const s=currentScope(),primary=mode()==='all',scopeType=mode();
 const totalForTraffic=scopeType==='source'?data.sourceTotal:scopeType==='device'?data.devices.reduce((a,x)=>a+(x.visits||0),0):null;
 const trafficPct=primary?data.summary.comparison?.visits:measuredShare(s?.visits,totalForTraffic);
 const peoplePct=primary?data.summary.comparison?.visitors:measuredShare(s?.visitors,data.summary.visitors);
 const viewsPct=primary?data.summary.comparison?.pageviews:null;
 const formsAll=data.forms.find(f=>f.id==='all');
 const usersGoal=data.syncMeta?.goalUnit==='unique_users';
 const goalValue=usersGoal?formsAll?.submit:(formsAll?.submitVisits??formsAll?.submit);
 const goalPct=primary?measuredShare(goalValue,usersGoal?data.summary.visitors:data.summary.visits):null;
 const deltaLabel='изменение к предыдущему периоду';
 const segmentLabel='доля от всех визитов соответствующего отчёта';
 return `<div class="kpi-grid">
   ${makeKpi('Визиты',s?n(s.visits):'—','Количество посещений','↗','dark',trafficPct,primary?deltaLabel:segmentLabel,primary?(trafficPct<0?'negative':'positive'):'neutral')}
   ${makeKpi('Уникальные посетители',s?n(s.visitors):'—','Люди по данным Метрики','◉','',peoplePct,primary?deltaLabel:'доля от уникальных посетителей сайта',primary?(peoplePct<0?'negative':'positive'):'neutral')}
   ${makeKpi('Просмотры страниц',primary?(data.summary.approxPageviews?'≈ ':'')+n(data.summary.pageviews):'—',primary?'Виджет «Просмотры»':'Нет среза по просмотрам','▤','',viewsPct,deltaLabel,viewsPct<0?'negative':'positive')}
   ${makeKpi(usersGoal?'Посетители с целью · формы':'Целевые визиты · формы',primary?n(goalValue):'—',primary?(usersGoal?'Автоцель, уникальные посетители':'Автоцель, не уникальные заявки'):'Нет детализации по фильтру','↗','',goalPct,usersGoal?'доля от всех посетителей · не сквозная конверсия':'доля визитов с достижением автоцели')}
 </div>`;
}
function cardHeading(title,subtitle,pill){return `<div class="card-heading"><div><h3 class="card-title">${title}</h3><div class="card-subtitle">${subtitle}</div></div>${pill?`<div class="right-pill">${pill}</div>`:''}</div>`;}
function sourcesChart(limit=7){if(!isDateMatch())return noData();if(state.device!=='all')return noData('Источники внутри устройства неизвестны','Нужен перекрёстный отчёт «Источники × Устройства».');let rows=state.source==='all'?data.sources.slice(0,limit):data.sources.filter(x=>x.id===state.source);if(!rows.length)return noData();const max=Math.max(...rows.map(x=>x.visits||0),1);return `<div class="bar-list">${rows.map((x,i)=>`<div class="bar-row ${state.source!=='all'?'source-row-selected':''}"><div class="name" title="${safe(x.label)}">${safe(x.label)}</div><div class="track"><span style="width:${Math.max(x.visits?2:0,ratio(x.visits,max))}%;background:${safe(x.color||'#665bf0')}"></span></div><div class="value"><div class="amount-inline"><span>${n(x.visits)}</span>${inlinePct(measuredShare(x.visits,data.sourceTotal),'neutral','Доля от всех визитов отчёта источников')}</div><small>от визитов отчёта</small></div></div>`).join('')}</div>`;}
function devicesChart(){
 if(!isDateMatch())return noData();
 if(state.source!=='all')return noData('Устройства внутри источника неизвестны','Нужен перекрёстный отчёт «Устройства × Источники».');
 const list=state.device==='all'?data.devices:data.devices.filter(x=>x.id===state.device);
 const total=data.devices.reduce((s,x)=>s+(x.visits||0),0);
 if(!total||!list.length)return noData();
 let position=0;let stops=list.map(x=>{const a=position;position+=100*(x.visits/total);return `${x.color||'#665bf0'} ${a.toFixed(3)}% ${position.toFixed(3)}%`;});
 if(position<99.999)stops.push(`#e9ece8 ${position.toFixed(3)}% 100%`);
 const visibleTotal=state.device==='all'?total:list.reduce((s,x)=>s+(x.visits||0),0);
 return `<div class="donut-layout"><div class="donut" role="img" aria-label="Доля визитов по устройствам от всего трафика" style="background:conic-gradient(${stops.join(',')})"><div class="donut-center"><div class="main-num">${n(visibleTotal)}</div><small>${state.device==='all'?'всего визитов':'визитов в сегменте'}</small></div></div><div class="legend-list">${list.map(x=>`<div class="legend-row"><span class="dot" style="background:${safe(x.color||'#665bf0')}"></span><span class="label">${safe(x.label)}</span><span class="value-pair"><span class="number">${n(x.visits)}</span>${inlinePct(measuredShare(x.visits,total),'neutral','Доля от всех визитов по устройствам')}</span></div>`).join('')}</div></div>`;
}
function funnelCard(large=false){
 const f=currentForm(),isGlobal=mode()==='all',has=isDateMatch()&&isGlobal;
 const s=has?data.summary:null;
 const isUsers=data.syncMeta?.goalUnit==='unique_users';
 const goalUnit=isUsers?'людей':'цел. визитов';
 const denominator=isUsers?s?.visitors:s?.visits;
 const denominatorLabel=isUsers?'доля от всех посетителей':'доля от всех визитов';
 const rows=[
  {name:'Зашли на сайт',hint:'Всего визитов',v:s?.visits,unit:'визитов',share:has?100:null,shareLabel:'база визитов'},
  {name:'Уникальные посетители',hint:'Отдельная метрика: не следующий шаг конверсии',v:s?.visitors,unit:'людей',share:has?100:null,shareLabel:'база уникальных людей'},
  {name:'Открыли форму',hint:f.openGoal?`Цель № ${f.openGoal}`:'Нет подтверждённой цели с числом',v:has?f.open:null,unit:goalUnit,share:has?measuredShare(f.open,denominator):null,shareLabel:denominatorLabel},
  {name:'Начали заполнять',hint:'Отдельное событие начала заполнения не подтверждено',v:has?f.start:null,unit:goalUnit,share:has?measuredShare(f.start,denominator):null,shareLabel:denominatorLabel},
  {name:'Отправили данные',hint:f.submitGoal?`Цель № ${f.submitGoal}`:'Число отправок не получено',v:has?f.submit:null,unit:goalUnit,share:has?measuredShare(f.submit,denominator):null,shareLabel:denominatorLabel}
 ];
 return `<div class="flow-card ${large?'large':''}"><div class="flow-head"><div><h3>Путь до заявки <span style="color:var(--lime)">↗</span></h3><p>${safe(f.label)} · 5 контрольных точек</p></div><span class="flow-tag">ПО ЭТАПАМ</span></div><div class="flow-rows">${rows.map((x,i)=>`<div class="flow-row ${x.v===null||x.v===undefined?'empty':x.v===0?'zero':'known'}"><div class="flow-step">0${i+1}</div><div><div class="title">${x.name}</div><div class="hint">${safe(x.hint)}</div></div><div class="measure"><div class="amount-inline"><span>${n(x.v)}</span>${inlinePct(x.share,i<=1?'baseline':'neutral',x.shareLabel)}</div><small>${x.v===null||x.v===undefined?'не измерено':safe(x.unit)}</small>${x.share!==null&&x.share!==undefined?`<span class="pct-note">${safe(x.shareLabel)}</span>`:''}</div></div>`).join('')}</div><div class="flow-footer"><strong>Важно.</strong> Проценты этапов рассчитаны ${isUsers?'от всех уникальных посетителей сайта':'от всех визитов сайта'}, а <b>не между шагами воронки</b>: последовательность посещений и событий не подтверждена. Первые две строки — разные базовые метрики (100% каждая), не этапы конверсии. ${safe(f.note||'')}</div></div>`;
}
function insightCard(){if(data.syncMeta?.origin==='yandex_api'){const ad=data.sources.find(x=>x.id==='ads');const mobile=data.devices.find(x=>x.id==='mobile');const b2b=data.forms.find(x=>x.id==='b2b');return `<div class="card">${cardHeading('На что смотреть','Выводы по последнему API-отчёту','LIVE / READ ONLY')}<div class="insight-list"><div class="insight"><div class="icon">↗</div><div><h4>${ad&&data.summary.visits?pct(ratio(ad.visits,data.summary.visits)):'—'} визитов — реклама</h4><p>Оценивайте качество каналов по целям и отказам, не только по объёму.</p></div></div><div class="insight"><div class="icon">▣</div><div><h4>${mobile&&data.summary.visits?pct(ratio(mobile.visits,data.summary.visits)):'—'} визитов — смартфоны</h4><p>Мобильная форма — приоритет для проверки UX.</p></div></div><div class="insight"><div class="icon">◇</div><div><h4>B2B: ${n(b2b?.submit)} уникальных пользователей по цели</h4><p>0 может означать отсутствие достижений или проблемы отслеживания; нужна отдельная проверка события.</p></div></div></div></div>`;}return noData('Нет выводов из API','Синхронизируйте отчёт за выбранный период.');}
function renderOverview(){return `<section>${section('Ключевые показатели','Подтверждённые данные и доступные срезы за выбранный период.')}${kpiBlock()}</section>
<section>${section('Откуда приходят. На чём смотрят.','Две точки зрения на один поток посетителей.')}<div class="dashboard-grid"><div class="card">${cardHeading('Источники трафика','Визиты · отчет «Источники, сводка»','ПО КАНАЛАМ')}${sourcesChart(5)}<div class="card-footer">Общий итог этого отчёта — ${n(data.sourceTotal)} визитов.</div></div><div class="card">${cardHeading('Устройства','Доля визитов по типу устройства','ПО ВИЗИТАМ')}${devicesChart()}</div></div></section>
<section>${section('Самое важное — путь до формы','Выберите форму в верхнем селекторе, чтобы увидеть её собственные цели.')}<div class="dashboard-grid">${funnelCard()}${insightCard()}</div></section>`;}
function behaviorChart(){if(!isDateMatch())return noData();if(state.device!=='all')return noData('Нет отказов источников по устройству','Нужен отчёт с обоими измерениями.');const rows=state.source==='all'?data.sources.filter(x=>x.bounce!=null).slice(0,5):data.sources.filter(x=>x.id===state.source&&x.bounce!=null);if(!rows.length)return noData();return `<div class="bar-list">${rows.map(x=>`<div class="bar-row"><div class="name">${safe(x.label)}</div><div class="track"><span style="width:${Math.min(100,x.bounce)}%;background:#ffad79"></span></div><div class="value">${pct(x.bounce)}<small>отказы</small></div></div>`).join('')}</div>`;}
function goalsChart(){if(mode()!=='all')return noData('Нет целей по выбранному сегменту','Для целей необходим отчёт с такими же фильтрами.');if(!Array.isArray(data.goalEvidence)||!data.goalEvidence.length)return noData('Нет загруженных целей');const rows=data.goalEvidence.slice(0,6),max=Math.max(...rows.map(x=>x.visits||0),1);return `<div class="bar-list">${rows.map(x=>`<div class="bar-row"><div class="name" title="${safe(x.label)}">${safe(x.label)}</div><div class="track"><span style="width:${ratio(x.visits,max)}%;background:#665bf0"></span></div><div class="value"><div class="amount-inline"><span>${n(x.visits)}</span>${inlinePct(measuredShare(x.visits,data.summary.visits),'neutral','Доля всех визитов с этой целью')}</div><small>целевых визитов · доля визитов</small></div></div>`).join('')}</div>`;}
function renderCharts(){return `<section>${section('Графики, без шума.','Агрегированные отчёты Метрики. Фильтры работают только на доступной детализации.')}${kpiBlock()}</section>
<section>${section('Каналы и устройства','Основные срезы посещаемости.')}<div class="dashboard-grid"><div class="card">${cardHeading('По источникам','Распределение визитов','11 КАНАЛОВ')}${sourcesChart(11)}<div class="card-footer">Доли рассчитаны от ${n(data.sourceTotal)} визитов отчёта источников.</div></div><div class="card">${cardHeading('По устройствам','Устройства посетителей','4 ТИПА')}${devicesChart()}<div class="card-footer">Отчёт по устройствам: ${n(data.devices.reduce((s,x)=>s+x.visits,0))} визита.</div></div><div class="card">${cardHeading('Отказы по каналам','Доля отказов, не конверсия','ПОВЕДЕНИЕ')}${behaviorChart()}</div><div class="card">${cardHeading('Целевые действия','Число визитов с достижением каждой цели','ЦЕЛИ')}${goalsChart()}<div class="card-footer">Не складывайте значения: один визит мог достигнуть нескольких целей.</div></div></div></section>`;}
function goalCards(){
 const f=currentForm(),has=mode()==='all',isUsers=data.syncMeta?.goalUnit==='unique_users';
 const goalUnit=isUsers?'уникальных посетителей':'целевых визитов';
 const denom=isUsers?data.summary.visitors:data.summary.visits;
 const shareLabel=isUsers?'от всех уникальных посетителей':'от всех визитов';
 const boxes=[{label:'Открытие формы',v:has?f.open:null,goal:f.openGoal},{label:'Нажатие «Отправить»',v:has?f.click:null,goal:f.clickGoal},{label:'Срабатывание отправки',v:has?f.submit:null,goal:f.submitGoal}];
 return `<div class="goal-list">${boxes.map(x=>`<div class="goal"><div class="label">${x.label}</div><div class="big">${n(x.v)}${inlinePct(has?measuredShare(x.v,denom):null,'neutral','Доля '+shareLabel)}</div><div class="sub">${safe(x.goal?'Цель '+x.goal:'Нет сопоставимой цели')} · ${x.v===null||x.v===undefined?'нет данных':x.v===0?'0 по цели':goalUnit}${x.v!==null&&x.v!==undefined?' · доля '+shareLabel:''}</div></div>`).join('')}</div>`;
}
function renderFunnel(){const f=currentForm();return `<section>${section('Воронка форм.','Последовательность этапов; неизвестные показатели не рассчитываются.','<span class="right-pill">НЕ СМЕШИВАЕМ ЕДИНИЦЫ</span>')}<div class="dashboard-grid"><div>${funnelCard(true)}</div><div class="card">${cardHeading('Выбранная форма','Переключите форму — показатели изменятся','GOAL MAPPING')}<div style="margin-bottom:19px"><label for="formSelect2" style="font-size:10px;font-weight:850;letter-spacing:1px;text-transform:uppercase;color:#8b9390;display:block;margin-bottom:7px">Форма</label><select id="formSelect2" class="form-select-large">${data.forms.map(x=>`<option value="${safe(x.id)}" ${x.id===state.form?'selected':''}>${safe(x.label)}</option>`).join('')}</select></div>${goalCards()}<div class="card-footer">${safe(f.note||'')} ${f.submitReaches!=null?`По выбранной цели зафиксировано ${n(f.submitReaches)} достижений; это не количество уникальных людей.`:''}</div></div></div></section><section>${section('Что подтверждено. Что нет.','Доступные события и требования к корректной воронке.')}<div class="dashboard-grid"><div class="card">${cardHeading('Существующие цели','Для выбранной формы','ИНВЕНТАРИЗАЦИЯ')}<table class="quality-table"><thead><tr><th>Этап</th><th>ID цели</th><th>Статус</th></tr></thead><tbody><tr><td>Открыли форму</td><td>${safe(f.openGoal||'—')}</td><td><span class="state-tag ${f.open==null?'none':f.open===0?'warn':'ok'}">${f.open==null?'Нет числа':f.open===0?'0 срабатываний':'Есть число'}</span></td></tr><tr><td>Начали заполнять</td><td>—</td><td><span class="state-tag none">Нет замера</span></td></tr><tr><td>Нажали «Отправить»</td><td>${safe(f.clickGoal||'—')}</td><td><span class="state-tag ${f.click==null?'none':'warn'}">${f.click==null?'Нет числа':'0 срабатываний'}</span></td></tr><tr><td>Отправили форму</td><td>${safe(f.submitGoal||'—')}</td><td><span class="state-tag ${f.submit==null?'none':f.submit===0?'warn':'ok'}">${f.submit==null?'Нет числа':f.submit===0?'0 срабатываний':'Есть число'}</span></td></tr></tbody></table></div><div class="card">${cardHeading('Нельзя смешивать','Определения для управленческого отчёта','МЕТОДОЛОГИЯ')}<div class="insight-list"><div class="insight"><div class="icon">01</div><div><h4>Визит ≠ человек</h4><p>Один человек мог посетить сайт несколько раз. Доля уникальных от визитов не является конверсией.</p></div></div><div class="insight"><div class="icon">02</div><div><h4>Нажатие ≠ успешная отправка</h4><p>Нужно различать клик по кнопке, JS-событие и подтверждение принятой заявки.</p></div></div><div class="insight"><div class="icon">03</div><div><h4>Достижения ≠ заявки</h4><p>Цель может сработать повторно. Для воронки нужны сопоставимые уникальные люди и единая последовательность.</p></div></div></div></div></div></section>`;}
function renderQuality(){const base=isDateMatch();return `<section>${section('Доверяем цифрам.','Проверки качества данных до управленческих решений.')}<div class="dashboard-grid"><div class="card chart-wide">${cardHeading('Что известно из Метрики','Статус доступности исходных данных','READ ONLY')}<table class="quality-table"><thead><tr><th>Показатель</th><th>Статус</th><th>Примечание</th></tr></thead><tbody><tr><td>Визиты / уникальные посетители</td><td><span class="state-tag ok">Получено</span></td><td>${n(data.summary.visits)} визитов · ${n(data.summary.visitors)} посетителей</td></tr><tr><td>Источники трафика</td><td><span class="state-tag ok">Получено</span></td><td>Агрегированные визиты по каналам</td></tr><tr><td>Устройства</td><td><span class="state-tag ok">Получено</span></td><td>Смартфоны, ПК, планшеты, Smart TV</td></tr><tr><td>Открыли форму / начали ввод</td><td><span class="state-tag warn">Неполно</span></td><td>Часть целей существует, но нет полной числовой последовательности</td></tr><tr><td>Клик / отправка / успех</td><td><span class="state-tag warn">Неполно</span></td><td>Есть автоцели и тест-драйв; успех приёма не верифицирован</td></tr><tr><td>Срез источник × устройство × форма</td><td><span class="state-tag none">Нет данных</span></td><td>Перекрёстные отчёты не выгружены</td></tr><tr><td>Динамика по дням</td><td><span class="state-tag none">Нет данных</span></td><td>Есть итог периода, но нет проверенного временного ряда</td></tr></tbody></table></div><div class="card">${cardHeading('Расхождения','Не скрываем ошибки сопоставления','DATA QA')}<div class="insight-list">${data.summary.pageviewsOther!=null?`<div class="insight"><div class="icon">!</div><div><h4>Просмотры: ${n(data.summary.pageviews)} и ${n(data.summary.pageviewsOther)}</h4><p>Исторические виджеты расходятся. Причина не установлена.</p></div></div>`:`<div class="insight"><div class="icon">✓</div><div><h4>Просмотры по API: ${n(data.summary.pageviews)}</h4><p>Только один сопоставимый итог отчёта; вторую цифру не придумываем.</p></div></div>`}<div class="insight"><div class="icon">!</div><div><h4>Визиты: ${n(data.summary.visits)} и ${n(data.sourceTotal)}</h4><p>Сопоставляются общий итог и сумма визитов по источникам.</p></div></div><div class="insight"><div class="icon">!</div><div><h4>Состав целей</h4><p>${data.syncMeta?.origin==='yandex_api'?'Получено '+n(data.goalEvidence.length)+' контрольных целей через API.':'Состав целей можно оценить после синхронизации.'}</p></div></div></div></div><div class="card">${cardHeading('Как пользоваться','Автономная версия отчёта','ЛОКАЛЬНО')}<p class="tagline">Страница показывает сохранённый отчёт или последний ответ API. Если выбрать новые даты, нажмите «Синхронизировать». Выбор источника или устройства фильтрует доступный одномерный отчёт, а не выдумывает пересечения.</p><div class="callout"><b>Права доступа:</b> Интеграция использует только метрики Reporting API по HTTPS GET и право metrika:read. Цели, настройки и права счётчика не меняются.</div><div class="download-row"><button type="button" class="round-btn" id="downloadTemplate">↓ Шаблон JSON</button><button type="button" class="round-btn" id="importHere">↥ Загрузить JSON</button></div></div></div></section>`;}
function renderAudit(){
  const f=currentForm();const hasPeriod=isDateMatch(),hasGoals=mode()==='all',scope=currentScope();
  const isApi=data.syncMeta?.origin==='yandex_api';
  const checks=[
    {name:'Зашли на сайт',value:scope?.visits??null,kind:scope?'Есть':'Нет',note:'Счётчик визитов (не уникальные люди)'},
    {name:'Уникальные пользователи',value:scope?.visitors??null,kind:scope?'Есть':'Нет',note:'Величина определена Метрикой за период'},
    {name:'Открыли страницу с формой',value:null,kind:'Нет',note:'Нужна привязка URL или цели для конкретной формы'},
    {name:'Открыли форму',value:hasGoals?f.open:null,kind:!hasGoals||f.open===null?'Нет':'Есть',note:f.openGoal?'Цель '+f.openGoal:'Нет подтверждённого ID события'},
    {name:'Начали заполнять',value:hasGoals?f.start:null,kind:!hasGoals||f.start===null?'Нет':'Ограниченно',note:f.id==='all'?'Общая автоцель заполнения контактов — не первый ввод':'Нужно событие первого взаимодействия с полем'},
    {name:'Нажали «Отправить»',value:hasGoals?f.click:null,kind:!hasGoals||f.click===null?'Нет':'Есть',note:f.clickGoal?'Цель '+f.clickGoal:'Отсутствует отдельная цель кнопки'},
    {name:'Успешно отправили',value:null,kind:'Нет',note:'Нужен подтверждённый приём сервером, а не только клик'},
  ];
  const present=checks.filter(x=>x.value!==null&&x.value!==undefined).length;
  const discrepancies=[];
  if(hasPeriod&&data.summary.pageviewsOther!==null&&data.summary.pageviewsOther!==undefined&&data.summary.pageviewsOther!==data.summary.pageviews)discrepancies.push('Просмотры: '+n(data.summary.pageviews)+' против '+n(data.summary.pageviewsOther));
  if(hasPeriod&&data.sourceTotal!=null&&Math.abs(data.sourceTotal-data.summary.visits)>10)discrepancies.push('Визиты: обзор '+n(data.summary.visits)+' / источники '+n(data.sourceTotal));
  const actions=[
    ['P0','Посещение страницы формы','Сопоставить форму с URL/целью, разделить просмотр страницы и показ попапа','ID формы / URL / пользователи'],
    ['P0','Первое взаимодействие с полем','Добавить событие first_focus, без передачи введённых персональных данных','form_id, form_step; без текста полей'],
    ['P0','Нажатие «Отправить»','Проверить событие submit_click для каждой формы, устранить дубли','form_id, источник, устройство'],
    ['P0','Успешное принятие заявки','Подтвердить событие submit_success после ответа сервера','Уникальный факт приёма, без дублирования'],
    ['P0','Проверка последовательности','Считать воронку по одним и тем же пользователям/визитам, не делить независимые цели','Пользователи по реальной последовательности'],
    ['P1','Ошибка формы и отказ на этапе','Учитывать ошибки валидации, сервера и закрытие формы без отправки','error_type, form_id; без ПДн'],
    ['P1','Чистка целей и атрибуции','Сверить дублирующие цели и расхождения отчётов; согласовать единый набор','Согласованные определения KPI'],
    ['P2','Срезы по сегментам','Связать показатели форм с устройствами, источниками, UTM и регионами','Сопоставимые пользовательские сегменты'],
  ];
  return `<section>${section('Оценка измерений.','Не просто цифры — что добавить, чтобы доверять решениям.','<span class="right-pill">DATA COVERAGE</span>')}
    <div class="audit-grid">
      <div class="audit-stat"><span>Доступно контрольных точек</span><strong>${present} <small>/ ${checks.length}</small> <span class="inline-percent" title="Доля точек с доступным числом">${pct(measuredShare(present,checks.length))}</span></strong><p>Для выбранной формы «${safe(f.label)}»; наличие числа не подтверждает правильную последовательность.</p></div>
      <div class="audit-stat"><span>Тип данных по целям</span><strong style="font-size:23px">${isApi?'Уникальные люди':'Целевые визиты'}</strong><p>${isApi?'Данные целей получены API по уникальным пользователям.':'Исторический снимок содержит целевые визиты и достижения.'}</p></div>
      <div class="audit-stat"><span>Ключевой пробел</span><strong style="font-size:23px">Нет полной воронки</strong><p>Не подтверждены путь одного пользователя и факт успешного приёма заявки.</p></div>
    </div>
    <div class="dashboard-grid">
      <div class="card chart-wide">${cardHeading('Покрытие событий','Выбрана форма: '+safe(f.label),'ДОСТУПНОСТЬ')}
        <div class="audit-table-scroll"><table class="quality-table"><thead><tr><th>Контрольная точка</th><th>Результат</th><th>Оценка</th><th>Комментарий</th></tr></thead><tbody>
        ${checks.map(x=>`<tr><td><b>${safe(x.name)}</b></td><td>${n(x.value)}</td><td><span class="state-tag ${x.kind==='Есть'?'ok':x.kind==='Нет'?'none':'warn'}">${x.kind}</span></td><td>${safe(x.note)}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="card-footer">Значение «0» — отсутствие зарегистрированных достижений, а не доказательство отсутствия реальных обращений.</p></div>
      <div class="card">${cardHeading('Риски и расхождения','Что требует дополнительной проверки','QA')}
        <div class="insight-list">${(discrepancies.length?discrepancies:['Нет выявленных расхождений основных агрегатов в текущем наборе']).map((t,i)=>`<div class="insight"><div class="icon">${discrepancies.length?'!':'✓'}</div><div><h4>${safe(t)}</h4><p>${discrepancies.length?'Сверить фильтры, период, модель атрибуции и единицы измерения.':'Отсутствие расхождения не подтверждает корректность отдельных событий.'}</p></div></div>`).join('')}</div>
        <div class="callout"><b>Граница ответственности:</b> рекомендации не меняют целей. Любая новая настройка Метрики — только после отдельного решения.</div>
      </div>
    </div></section>
    <section>${section('Какие данные добавить','Приоритеты и критерии приёмки аналитики форм.')}
      <div class="card"><div class="audit-actions">${actions.map(x=>`<div class="audit-action"><span class="priority ${x[0]==='P0'?'high':x[0]==='P1'?'medium':''}">${x[0]}</span><div><strong>${safe(x[1])}</strong><p>${safe(x[2])}</p><small>Результат: ${safe(x[3])}</small></div></div>`).join('')}</div>
        <div class="callout"><b>Критерий готовности P0:</b> на каждой действующей форме в Метрике подтверждаются показ → первый ввод → клик → успешная отправка; доступны уникальные посетители и проверяется последовательность событий. Никаких персональных данных в параметрах событий.</div>
      </div>
    </section>`;
}
function render(){initOptions();calloutContext();$('customPeriod').classList.toggle('visible',state.period==='custom');$('periodSelect').value=state.period;$('dateFrom').value=state.from;$('dateTo').value=state.to;const names={overview:['Сайт в <em>цифрах.</em>','Понимать путь пользователя важнее, чем просто считать посещения.'],charts:['Факты в <em>графиках.</em>','Источники, устройства и поведение — главные закономерности без лишнего шума.'],funnel:['От визита <em>к заявке.</em>','Выберите форму и смотрите только подтверждённые этапы взаимодействия.'],quality:['Честные <em>данные.</em>','Что измерено, что требует проверки и где значения нельзя смешивать.'],builder:['Свои <em>графики.</em>','Выберите показатель, разрез и страницу: график строится по живым данным Метрики.'],audit:['Что <em>добавить.</em>','Оценка полноты данных, риски и список задач для аналитики.']};$('pageTitle').innerHTML=names[state.tab][0];$('pageSubtitle').textContent=names[state.tab][1];document.querySelectorAll('#nav button').forEach(el=>{let active=el.dataset.tab===state.tab;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('content').innerHTML=state.tab==='builder'?window.renderBuilder():data.syncMeta?.origin==='not_loaded'?noData('Нет загруженного отчёта','Выберите период и нажмите «Синхронизировать».'):({overview:renderOverview,charts:renderCharts,funnel:renderFunnel,quality:renderQuality,audit:renderAudit})[state.tab]();const secondary=$('formSelect2');if(secondary)secondary.addEventListener('change',e=>{state.form=e.target.value;render();});const template=$('downloadTemplate');if(template)template.addEventListener('click',downloadTemplate);const importHere=$('importHere');if(importHere)importHere.addEventListener('click',()=>$('jsonUpload').click());}
function reset(){data=structuredClone(BASE);lastSyncTime=null;updateSyncIndicator();Object.assign(state,{tab:'overview',period:'snapshot',from:BASE.period.from,to:BASE.period.to,source:'all',device:'all',form:'all',imported:false});render();}
function downloadTemplate(){const sample=structuredClone(BASE);const blob=new Blob([JSON.stringify(sample,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='atom_metrika_data_template.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
function cleanNumber(x){if(x===null||x===undefined||x==='')return null;const v=Number(x);return Number.isFinite(v)&&v>=0?v:null;}
function cleanSeries(items,kind){if(!Array.isArray(items))return [];return items.slice(0,150).map((x,i)=>{const id=String(x?.id||`${kind}_${i}`).slice(0,50),label=String(x?.label||id).slice(0,90);return {...x,id,label,visits:cleanNumber(x?.visits),visitors:cleanNumber(x?.visitors),bounce:cleanNumber(x?.bounce),color:/^#[\da-fA-F]{6}$/.test(x?.color||'')?x.color:'#665bf0'};}).filter(x=>x.visits!==null);}
function cleanForms(items){if(!Array.isArray(items)||!items.length)return structuredClone(BASE.forms);return items.slice(0,80).map((x,i)=>{const row={...x,id:String(x?.id||`form_${i}`).slice(0,60),label:String(x?.label||`Форма ${i+1}`).slice(0,100),note:String(x?.note||'').slice(0,300)};['open','start','click','submit','submitReaches'].forEach(k=>row[k]=cleanNumber(x?.[k]));['openGoal','clickGoal','submitGoal'].forEach(k=>row[k]=String(x?.[k]||'').slice(0,100));return row;});}
async function importJson(file){if(!file)return;try{if(file.size>3_000_000)throw new Error('Файл больше 3 МБ');let raw=JSON.parse(await file.text());if(!raw||typeof raw!=='object'||!raw.period||!/^\d{4}-\d{2}-\d{2}$/.test(raw.period.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(raw.period.to||''))throw new Error('Не задан корректный период');if(raw.period.from>raw.period.to)throw new Error('Начало периода позже конца');if(!raw.summary||cleanNumber(raw.summary.visits)===null||cleanNumber(raw.summary.visitors)===null)throw new Error('Нужны summary.visits и summary.visitors');const next={period:{from:raw.period.from,to:raw.period.to},summary:{visits:cleanNumber(raw.summary.visits),visitors:cleanNumber(raw.summary.visitors),pageviews:cleanNumber(raw.summary.pageviews),pageviewsOther:cleanNumber(raw.summary.pageviewsOther),approxPageviews:Boolean(raw.summary.approxPageviews),comparison:raw.summary.comparison||{}},sourceTotal:cleanNumber(raw.sourceTotal),sources:cleanSeries(raw.sources,'source'),devices:cleanSeries(raw.devices,'device'),forms:cleanForms(raw.forms),goalEvidence:cleanSeries(raw.goalEvidence,'goal')};if(next.sourceTotal===null)next.sourceTotal=next.sources.reduce((s,x)=>s+x.visits,0);if(next.sources.length===0)next.sourceTotal=null;data=next;lastSyncTime=null;Object.assign(state,{tab:'overview',period:'snapshot',from:next.period.from,to:next.period.to,source:'all',device:'all',form:next.forms[0].id,imported:true});$('periodSelect').querySelector('option[value="snapshot"]').textContent=`${next.period.from} — ${next.period.to}`;updateSyncIndicator();render();alert('JSON загружен локально. Яндекс Метрика не изменялась.');}catch(e){alert('Ошибка импорта: '+(e?.message||String(e)));}finally{$('jsonUpload').value='';}}
document.querySelectorAll('#nav button').forEach(el=>el.addEventListener('click',()=>{state.tab=el.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});}));
$('sourceSelect').addEventListener('change',e=>{state.source=e.target.value;render();});$('deviceSelect').addEventListener('change',e=>{state.device=e.target.value;render();});$('formSelect').addEventListener('change',e=>{state.form=e.target.value;render();});$('periodSelect').addEventListener('change',e=>{state.period=e.target.value;
  if(state.period==='snapshot'){state.from=data.period.from;state.to=data.period.to;}
  else if(state.period!=='custom'){
    const now=new Date();const end=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const start=new Date(end);
    if(state.period==='thismonth')start.setDate(1);
    else start.setDate(start.getDate()-({last7:6,last30:29,last90:89}[state.period]||0));
    const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    state.from=iso(start);state.to=iso(end);
  }
  render();});$('applyPeriod').addEventListener('click',()=>{const from=$('dateFrom').value,to=$('dateTo').value;if(!from||!to||from>to){alert('Проверьте даты: начало не должно быть позже окончания.');return;}state.from=from;state.to=to;render();});$('resetButton').addEventListener('click',reset);$('dataButton').addEventListener('click',()=>$('jsonUpload').click());$('jsonUpload').addEventListener('change',e=>importJson(e.target.files?.[0]));
updateSyncIndicator();
render();

function updateSyncIndicator(){const el=$('syncIndicator');if(!el)return;
  if(lastSyncTime){el.innerHTML='<i></i> Синхронизировано · '+safe(lastSyncTime.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}));}
  else if(state.imported){el.innerHTML='<i></i> JSON-импорт';}
  else{el.innerHTML='<i></i> Ожидаем синхронизацию';}
}
async function syncFromMetrika(force=true){
  if(syncing)return;
  const button=$('syncButton');syncing=true;button.disabled=true;button.textContent='↻ Обновляем…';
  const from=state.from,to=state.to;
  try {
    const response=await fetch('/api/sync?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to)+(force?'&force=1':''),{method:'GET',credentials:'same-origin',cache:'no-store'});
    let payload;try{payload=await response.json()}catch(_){throw new Error('Неверный ответ сервера')}
    if(!response.ok)throw new Error(payload.error||('HTTP '+response.status));
    if(!payload.summary||!Array.isArray(payload.forms)||!payload.period||payload.syncMeta?.origin!=='yandex_api')throw new Error('Ошибка формата отчёта');
    if(state.from!==from||state.to!==to){showSyncToast('Период изменился. Нажмите «Синхронизировать» для выбранных дат.');return;}
    data=payload;
    Object.assign(state,{period:'snapshot',from:payload.period.from,to:payload.period.to,source:'all',device:'all',imported:false});
    if(!data.forms.some(f=>f.id===state.form))state.form='all';
    $('periodSelect').querySelector('option[value="snapshot"]').textContent=`${data.period.from} — ${data.period.to}`;
    lastSyncTime=payload.syncMeta?.syncedAt?new Date(payload.syncMeta.syncedAt):new Date();updateSyncIndicator();render();
    showSyncToast((payload.syncMeta?.fromCache?'Данные из автосинхронизации · ':'Данные обновлены · ')+n(data.summary.visits)+' визитов · '+data.period.from+' — '+data.period.to);
  } catch(e){showSyncToast('Синхронизация не удалась: '+(e?.message||'неизвестная ошибка')+'; старые данные не изменены.');}
  finally{syncing=false;button.disabled=false;button.textContent='↻ Синхронизировать';}
}
function showSyncToast(text){const el=$('contextNote');el.className='context-note visible';$('contextNoteText').textContent=text;}
$('syncButton').addEventListener('click',()=>syncFromMetrika(true));
window.addEventListener('load',()=>{ const today=new Date(),start=new Date(today);start.setDate(today.getDate()-29);const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');state.period='last30';state.from=iso(start);state.to=iso(today);render();syncFromMetrika(false);});

