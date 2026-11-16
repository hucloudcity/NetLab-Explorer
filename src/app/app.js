'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="./icons.svg#${name}"/></svg>`;
// 视图数据由构建期适配层生成（scripts/build-data.mts → dist/netlab-data.js）。
// 缺产物时给可见报错，不静默白屏；浏览器侧不做任何状态/字段映射。
const NETLAB_DATA=window.NETLAB_DATA;
if(!NETLAB_DATA){const host=document.querySelector('#main');if(host)host.innerHTML='<p class="empty">缺少 dist/netlab-data.js，请先运行 npm run build</p>';throw new Error('NETLAB_DATA missing: run npm run build');}
const {groups:GROUPS,lessons:LESSONS,sources:SOURCES}=NETLAB_DATA;
const byId=Object.fromEntries(LESSONS.map(l=>[l.id,l]));
const sourceById={...SOURCES,...Object.fromEntries(Object.entries(CSAPP_READINGS).map(([id,r])=>['csapp_'+id,{name:`CSAPP ${r.section} · ${r.title}`,url:'https://csapp.cs.cmu.edu/',note:r.note,kind:'CSAPP 官方站点 · 系统基础'}]))};
const safeRead=(k,otherwise)=>{try{return JSON.parse(localStorage.getItem(k))??otherwise}catch{return otherwise}};
let completed=new Set(safeRead('systems-completed',[]).filter(id=>byId[id]));
let current=byId[location.hash.slice(1)]||LESSONS[0],step=0,alt=false,special=false,started=false,filter='all',query='',detail='concept',view='mechanism',timer=null,speed=1,toastTimer;
let dark=safeRead('systems-dark',false);
let motionMode='preview',motionVersion=0,playbackEnded=false;
let renderedDetail='';
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
function cueMotion(){motionMode='preview';motionVersion++;playbackEnded=false;}
function saveProgress(){try{localStorage.setItem('systems-completed',JSON.stringify([...completed]))}catch{}}
function saveTheme(){try{localStorage.setItem('systems-dark',JSON.stringify(dark))}catch{}}
function scenario(){return alt&&current.alternate?current.alternate:special&&current.special?current.special:current}
function frames(){return scenario().steps}
function nodes(){return scenario().nodes}
const RELATIONS={request:'请求传递',data:'数据传递',control:'控制关系',check:'条件校验',reject:'请求被拒绝',lost:'传递中断 · 未到达',local:'内部操作',compare:'方案对照'};
// 机制详解是可选内容：没有条目的课程仍要能进导航、能被选中、能看步骤详解。
// 缺省只影响「机制/扩展阅读」区块，不影响课程本身与步骤时间线（data.js 时代的单课数据不受影响）。
const EMPTY_DETAILS={sections:[],readings:[],sources:[],foundation:''};
const detailsOf=id=>MECHANISM_DETAILS[id]||EMPTY_DETAILS;
const CATS={hand:'握手和 ACK',cdata:'来自笔记本电脑的数据',sdata:'来自服务器的数据',fin:'关闭（FIN）',lost:'传递丢失',broadcast:'广播帧',response:'应答',generic:'其他报文'};
function relationText(s){const ns=nodes();if(s[6]==='local')return ns[s[1]]+' · 内部操作';if(s[6]==='compare')return ns[s[1]]+' ｜ '+ns[s[2]]+' · 对照';if(s[6]==='lost')return ns[s[1]]+' ⇢ × · 未到达 '+ns[s[2]];return ns[s[1]]+(s[6]==='request'||s[6]==='data'?' → ':' ⇢ ')+ns[s[2]]}
function currentFrame(){return frames()[step]}
function accent(){const g=GROUPS[current.group];return dark?(g.dark||['#82adff','#63cec4','#b79aeb'][current.group]):g.color}
function theme(){document.body.classList.toggle('dark',dark);document.body.style.setProperty('--accent',accent());$('#theme').setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');$('#theme').innerHTML=icon(dark?'sun':'moon');saveTheme()}
function notify(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600)}
function updateProgress(){const n=completed.size,total=LESSONS.length;$('#progress-number').textContent=`${n} / ${total}`;$('#progress-bar').style.width=`${n/total*100}%`;$('#complete').innerHTML=completed.has(current.id)?`${icon('check')}<span>已学 · 取消标记</span>`:`<span>标记已学</span>${icon('check')}`;$('#complete').setAttribute('aria-pressed',String(completed.has(current.id)))}
function stop(){if(timer)clearInterval(timer);timer=null;motionMode='paused';$('#play').innerHTML=`${icon('play')}<span>播放</span>`;$('#play').setAttribute('aria-label','播放演示');if($('#diagram svg'))draw();}
function play(){
 if(timer){stop();return}
 if(playbackEnded||(step>=frames().length-1&&motionMode==='preview')){step=0;motionVersion++;playbackEnded=false;}
 motionMode='playing';started=true;
 $('#play').innerHTML=`${icon('pause')}<span>暂停</span>`;$('#play').setAttribute('aria-label','暂停演示');
 timer=setInterval(()=>{
  if(step<frames().length-1){step++;renderStep();}
  else{playbackEnded=true;stop();finish();}
 },2600/speed);
 renderStep();
}
function finish(){if(!completed.has(current.id)){completed.add(current.id);saveProgress();renderNav();updateProgress();renderMap();notify(`已完成「${current.title}」的探索`)}}
function goStep(n){stop();started=true;step=Math.max(0,Math.min(frames().length-1,n));cueMotion();renderStep();if(step===frames().length-1)finish()}
function closeMenu(){$('#sidebar').classList.remove('open');$('#shade').hidden=true;$('#menu').setAttribute('aria-expanded','false')}
function select(id,updateHash=true){if(!byId[id])return;stop();current=byId[id];step=0;alt=false;special=false;started=false;cueMotion();detail='concept';view='mechanism';if(filter!=='all'&&Number(filter)!==current.group)filter='all';query='';if($('#search'))$('#search').value='';if(updateHash&&location.hash!==`#${id}`)history.pushState(null,'',`#${id}`);closeMenu();render();}
function renderNav(){const eligible=LESSONS.filter(l=>(filter==='all'||l.group===Number(filter))&&`${l.title} ${l.en} ${l.summary} ${l.principle} ${l.pitfall} ${l.steps.flat().join(' ')} ${detailsOf(l.id).sections.map(s=>s.title+' '+s.body).join(' ')} ${detailsOf(l.id).foundation}`.toLowerCase().includes(query.toLowerCase()));let html='';GROUPS.forEach((g,i)=>{const list=eligible.filter(l=>l.group===i);if(!list.length)return;html+=`<div class="topic-group"><b>0${i+1} / ${g.name}</b><span>${list.length}</span></div>`;for(const l of list){const active=l.id===current.id;html+=`<button class="topic ${active?'active':''} ${completed.has(l.id)?'done':''}" data-lesson="${l.id}" ${active?'aria-current="true"':''} aria-label="${l.title}"><span class="topic-dot"></span><span><strong>${l.title}</strong><small>${l.en}</small></span><span class="chev">${icon(active?'chevron-down':'chevron-right')}</span></button>`;if(active&&!query)html+=`<div class="topic-steps">${frames().map((s,j)=>`<button class="topic-step ${step===j?'active':''}" data-step="${j}" aria-label="步骤 ${j+1}：${s[0]}"><span>${j+1}</span>${s[0]}</button>`).join('')}</div>`;}});$('#topic-list').innerHTML=html||'<div class="empty">没有找到匹配的主题。<br>试试「版本」「重试」或「日志」。</div>';$$('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter))}
function relationButtons(){return current.related.filter(id=>byId[id]).map(id=>`<button data-related="${id}">${byId[id].title} ${icon('arrow-up-right')}</button>`).join('')}
function renderDetail(){
 const s=currentFrame(),notes=detailsOf(current.id),key=current.id+':'+detail+':'+(alt?'a':special?'s':'m')+step;
 $$('[data-detail]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.detail===detail)));
 // Keep the reading position and focused links intact while the animation advances.
 if(renderedDetail===key)return;
 let html='';
 if(detail==='concept'){
  const deep=(current.stepNotes&&current.stepNotes[step])||null;
  const stepBlock=`<div class="detail-section step-detail"><h4>步骤 ${String(step+1).padStart(2,'0')} · ${esc(s[0])}</h4><p class="step-signal-line"><code>${esc(s[3])}</code></p>${deep?`<p>${esc(deep)}</p>`:`<p>${esc(s[4])}</p>`}<p class="state-line">状态观察：${esc(s[5])}</p></div>`;
  const sections=notes.sections.map(section=>`<div class="detail-section"><h4>${esc(section.title)}</h4><p>${esc(section.body)}</p></div>`).join('');
  const readings=notes.readings.map(id=>{const src=sourceById['csapp_'+id];return `<p class="source-note"><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.name)} ${icon('arrow-up-right')}</a></p>`}).join('');
  const csapp=notes.foundation||readings?`<div class="detail-section"><h4>CSAPP 关联与阅读</h4><p>${esc(notes.foundation)}</p>${readings}</div>`:'';
  html=`<h3>${esc(current.en)}</h3>${stepBlock}<p>${esc(current.summary)}</p><div class="principle">${esc(current.principle)}</div>${sections}<div class="detail-section"><h4>关键取舍</h4><p>${esc(current.tradeoff)}</p></div><div class="detail-section"><h4>容易误解</h4><p class="warning">${esc(current.pitfall)}</p></div>${csapp}${relationButtons()?`<div class="detail-section"><h4>关联技术</h4><div class="related">${relationButtons()}</div></div>`:''}`;
 }else{
  const sources=[...new Set([...current.sources,...(notes.sources||[]),...notes.readings.map(id=>'csapp_'+id)])];
  html=`<h3>从哪里继续阅读</h3><p class="source-note">文字与教学步骤为综合整理，不是资料原文的逐句引用。CSAPP 条目解释系统基础；数据库与分布式协议的具体保证以对应专业资料为准。</p>${sources.map(id=>{const src=sourceById[id];return `<a class="source-card" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><small class="source-kind">${esc(src.kind)}</small><strong>${esc(src.name)} ${icon('arrow-up-right')}</strong><span>${esc(src.note)}</span></a>`}).join('')}<div class="detail-section"><h4>整理范围</h4><p>${esc(GROUPS[current.group].question)}</p><button class="outline-button" data-about>查看完整来源说明 ${icon('arrow-up-right')}</button></div>`;
 }
 $('#detail-content').innerHTML=html;
 if(renderedDetail!==key)$('#detail-content').scrollTop=0;
 renderedDetail=key;
}
function labelLines(text){const max=16,lines=[];let line='',units=0;const tokens=text.match(/[A-Za-z0-9_=./+\-]+|[^\x00-\x7F]|\s+|./gu)||[];for(const token of tokens){const w=[...token].reduce((n,ch)=>n+(/[^\x00-\x7F]/.test(ch)?2:1),0);if(units+w>max&&line.trim()){lines.push(line.trim());line='';units=0}if(!line&&/^\s+$/.test(token))continue;line+=token;units+=w}if(line.trim())lines.push(line.trim());return lines;}
function draw(){
 const s=currentFrame(),kind=s[6],rows=special?(current.net&&current.net.special):alt?(current.net&&current.net.alternate):(current.net&&current.net.main);
 window.SystemsDiagram.render({
  label:current.title+'：'+s[0]+'；'+RELATIONS[kind]+'；'+relationText(s),
  nodes:nodes(),frame:s,playing:!!timer,motionMode,motionVersion,speed,dark,
  stageKey:current.id+':'+(alt?'alternate':special?'special':'main')+':'+step,
  scene:current.scene==='network'?'network':'abstract',
  preview:!started,
  packetCat:rows?rows[step]&&rows[step].cat:undefined,
  addresses:current.addresses||[],
  kinds:current.kinds||[],
  reducedMotion:motionPreference.matches
 });
 $('#relation-kind').className='relation-chip kind-'+kind;$('#relation-kind').textContent=RELATIONS[kind];$('#diagram-state').textContent=s[5];
 $('#diagram-note').textContent=current.scene==='network'?'逻辑设备 · 非真实网络拓扑':'抽象节点 · 非物理拓扑';
}
function renderTrace(){
 const list=frames(),rows=special?(current.net&&current.net.special):alt?(current.net&&current.net.alternate):(current.net&&current.net.main);
 $('#trace-head').innerHTML=rows?'<tr><th>序号</th><th>时间</th><th>源地址</th><th>目的地址</th><th>协议</th><th>信息</th><th>大小</th></tr>':'<tr><th>步骤</th><th>事件</th><th>本步关系</th><th>状态观察</th></tr>';
 $('#trace-body').innerHTML=list.map((s,i)=>{const row=rows?rows[i]:null;const head=`class="${i===step?'current':i<step?'done':''}${s[6]==='lost'?' lost-row':''}${rows&&!row?' placeholder-row':''}" data-trace="${i}" tabindex="0" aria-label="查看步骤 ${i+1}：${s[0]}" ${i===step?'aria-current="step"':''}`,no=`<td><span class="row-no ${rows?(row&&row.cat?`cat-${row.cat}`:''):`kind-${s[6]}`}">${i+1}</span></td>`,cells=!rows?`${no}<td><span class="signal">${esc(s[3])}</span></td><td class="route">${esc(relationText(s))}</td><td>${esc(s[5])}</td>`:!row?`<td><span class="row-no">${i+1}</span></td><td colspan="6">本步为本机操作，无网络报文</td>`:`${no}<td class="t-time">${esc(row.t)}s</td><td class="t-addr">${esc(row.src)}</td><td class="t-addr">${esc(row.dst)}</td><td class="t-proto">${esc(row.proto)}</td><td class="t-info">${esc(row.info)}${s[6]==='lost'?' <span class="lost-badge">丢失</span>':''}</td><td class="t-size">${esc(row.size)}</td>`;return `<tr ${head}>${cells}</tr>`;}).join('');
 const now=rows?(rows[step]&&rows[step].cat):list[step][6];$('#flow-legend').innerHTML=rows?Object.keys(CATS).filter(c=>rows.some(r=>r&&r.cat===c)).map(c=>`<span class="legend-item cat-${c}${c===now?' active':''}"><i class="legend-dot"></i>${CATS[c]}</span>`).join(''):(()=>{const order=Object.keys(RELATIONS),kinds=[...new Set(list.map(f=>f[6]))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));return kinds.map(k=>`<span class="legend-item kind-${k}${k===now?' active':''}"><i class="legend-dot"></i>${RELATIONS[k]}</span>`).join('')})();$('#flow-count').textContent=`${String(step+1).padStart(2,'0')} / ${list.length}`;$('#previous').disabled=step===0;$('#next').disabled=step===list.length-1;}
function renderStep(){step=Math.min(step,frames().length-1);const s=currentFrame();$('#step-chip').textContent=String(step+1).padStart(2,'0');$('#step-title').textContent=s[0];$('#step-signal').textContent=s[3];$('#step-description').textContent=s[4];draw();renderTrace();renderDetail();$$('[data-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===step));$('#normal').classList.toggle('selected',!alt&&!special);$('#normal').setAttribute('aria-pressed',String(!alt&&!special));$('#fault').classList.toggle('selected',alt);$('#fault').setAttribute('aria-pressed',String(alt));$('#special').classList.toggle('selected',special);$('#special').setAttribute('aria-pressed',String(special));}
function renderView(){const isMap=view==='map',lv=$('#lesson-view'),mv=$('#map-view'),mt=$('#mechanism-tab'),pt=$('#map-tab');if(lv)lv.hidden=isMap;if(mv)mv.hidden=!isMap;if(mt)mt.setAttribute('aria-selected',String(!isMap));if(pt)pt.setAttribute('aria-selected',String(isMap));if(isMap)renderMap()}
function renderMap(){
 const host=$('#knowledge-map');if(!host)return; // 单主题版本没有知识图谱视图
 const width=680,col=218,pad=14,row=68,start=85,positions={};
 GROUPS.forEach((g,gi)=>LESSONS.filter(l=>l.group===gi).forEach((l,j)=>positions[l.id]={x:pad+gi*col,y:start+j*row}));
 const related=new Set(current.related),origin=positions[current.id];let links='',cards='',heads='';
 for(const id of related){const dest=positions[id];if(!dest)continue;const a=origin,b=dest;let d;
 if(a.x===b.x){const lane=a.x+200;d=`M${a.x+192} ${a.y+23}H${lane}V${b.y+23}H${b.x+192}`;}
 else{const right=b.x>a.x,ax=a.x+(right?192:0),bx=b.x+(right?0:192),mid=(ax+bx)/2;
 if(Math.abs(a.x-b.x)>col){const laneA=ax+(right?12:-12),laneB=bx+(right?-12:12);d=`M${ax} ${a.y+23}H${laneA}V70H${laneB}V${b.y+23}H${bx}`;}
 else d=`M${ax} ${a.y+23} C${mid} ${a.y+23} ${mid} ${b.y+23} ${bx} ${b.y+23}`;}
 links+=`<path class="map-relation" data-related-from="${current.id}" data-related-to="${id}" d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.5"><title>${esc(current.title+' 与 '+byId[id].title+' 相关')}</title></path>`;}
 GROUPS.forEach((g,gi)=>{const x=pad+gi*col,ls=LESSONS.filter(l=>l.group===gi),color=dark?(g.dark||['#82adff','#63cec4','#b79aeb'][gi]):g.color;heads+=`<text x="${x+96}" y="30" text-anchor="middle" style="fill:${color};font-size:16px;font-weight:600">0${gi+1} ${g.name}</text><text x="${x+96}" y="53" text-anchor="middle" style="fill:var(--muted);font:12px monospace">${ls.length} TOPICS</text>`;
 ls.forEach(l=>{const {x,y}=positions[l.id],labels=labelLines(l.title);cards+=`<a class="map-node ${current.id===l.id?'selected':''} ${related.has(l.id)?'related-node':''} ${completed.has(l.id)?'completed':''}" href="#${l.id}" data-map="${l.id}" aria-label="打开${l.title}"><rect x="${x}" y="${y}" width="192" height="46" rx="3"/>${completed.has(l.id)?`<g class="map-check" aria-hidden="true" transform="translate(${x+8} ${y+15})"><use href="./icons.svg#check" width="16" height="16"/></g>`:`<text class="map-num" x="${x+10}" y="${y+28}">${String(LESSONS.indexOf(l)+1).padStart(2,'0')}</text>`}<text x="${x+34}" style="font-size:14px">${labels.map((line,j)=>`<tspan x="${x+34}" y="${y+(labels.length===1?28:18+j*18)}">${esc(line)}</tspan>`).join('')}</text></a>`;});});
 $('#knowledge-map').innerHTML=`<svg viewBox="0 0 ${width} 835" role="img" aria-label="${LESSONS.length} 个技术主题；仅显示当前主题的直接关联，无方向，不代表执行顺序">${heads}${links}${cards}</svg>`;
}
function renderCourseNav(){
 // 课程目录、搜索、分类与当前序号：单课时全部隐藏（保持单主题布局），多课时出现。
 const multi=LESSONS.length>1;
 if($('#current-no'))$('#current-no').hidden=!multi;
 // 多课时顶栏左侧标签改为「正在探索」；单课时保持原文案（像素基线）
 const scope=$('.now small');
 if(multi&&scope&&scope.firstChild&&scope.firstChild.nodeType===3)scope.firstChild.nodeValue='正在探索 ';
 if($('#search-wrap'))$('#search-wrap').hidden=!multi;
 if($('#all-topics'))$('#all-topics').hidden=!multi;
 const parts=$('.parts'),filters=$('#filter-row');
 if(parts)parts.hidden=!multi;if(filters)filters.hidden=!multi;
 if(!multi)return;
 if(parts&&!parts.childElementCount)parts.innerHTML=GROUPS.map((g,i)=>`<button data-group="${i}"><span>0${i+1}</span>${esc(g.name)}</button>`).join('');
 if(filters&&!filters.childElementCount)filters.innerHTML=`<button data-filter="all" class="selected">全部</button>`+GROUPS.map((g,i)=>`<button data-filter="${i}">0${i+1} ${esc(g.name)}</button>`).join('');
}
function render(){theme();const n=LESSONS.indexOf(current)+1;if($('#current-no'))$('#current-no').textContent=`${String(n).padStart(2,'0')} / ${LESSONS.length}`;if($('#step-count'))$('#step-count').textContent=`${current.steps.length} 步`;$('#current-title').textContent=current.title;$('#scene-title').textContent=current.title;$('#scene-en').textContent=current.en;$('#scene-index').textContent=String(n).padStart(2,'0');$('#group-badge').textContent=GROUPS[current.group].name;$('#fault').hidden=!current.alternate;$('#fault').innerHTML=`${icon('bolt')}<span>${esc(current.alternate?current.alternate.name:'')}</span>`;$('#special').hidden=!current.special;if(current.special)$('#special').innerHTML=esc(current.special.name);renderCourseNav();$$('[data-group]').forEach(b=>b.classList.toggle('active',Number(b.dataset.group)===current.group));renderNav();renderStep();renderView();updateProgress();document.title=`${current.title} · 交互式演示`;}
document.addEventListener('click',e=>{const l=e.target.closest('[data-lesson],[data-related],[data-map]');if(l){e.preventDefault();select(l.dataset.lesson||l.dataset.related||l.dataset.map);return}const s=e.target.closest('[data-step],[data-trace]');if(s){goStep(Number(s.dataset.step??s.dataset.trace));return}const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;renderNav();return}const g=e.target.closest('[data-group]');if(g){select(LESSONS.find(l=>l.group===Number(g.dataset.group)).id);filter=g.dataset.group;renderNav();return}const d=e.target.closest('[data-detail]');if(d){detail=d.dataset.detail;renderDetail();return}if(e.target.closest('[data-about]'))$('#about-dialog').showModal();});
if($('#search'))$('#search').addEventListener('input',e=>{query=e.target.value;renderNav()});if($('#all-topics'))$('#all-topics').onclick=()=>{filter='all';query='';if($('#search'))$('#search').value='';renderNav()};
$('#normal').onclick=()=>{stop();alt=false;special=false;step=0;started=false;cueMotion();renderNav();renderStep()};$('#fault').onclick=()=>{stop();alt=true;special=false;step=0;started=false;cueMotion();renderNav();renderStep();};$('#special').onclick=()=>{stop();alt=false;special=true;step=0;started=false;cueMotion();renderNav();renderStep();};
$('#previous').onclick=()=>goStep(step-1);$('#next').onclick=()=>goStep(step+1);$('#play').onclick=play;$('#reset').onclick=()=>{stop();step=0;started=false;cueMotion();renderStep()};
$('#speed').onclick=()=>{const running=!!timer,previousMotion=motionMode;stop();speed=speed===.5?1:speed===1?1.5:speed===1.5?2:.5;$('#speed').textContent=`${speed}×`;if(running)play();else{motionMode=previousMotion;draw();}};
$('#theme').onclick=()=>{dark=!dark;theme();draw();if(view==='map')renderMap()};
if($('#mechanism-tab'))$('#mechanism-tab').onclick=()=>{view='mechanism';renderView()};if($('#map-tab'))$('#map-tab').onclick=()=>{stop();view='map';renderView()};
$('#complete').onclick=()=>{if(completed.has(current.id))completed.delete(current.id);else completed.add(current.id);saveProgress();renderNav();renderMap();updateProgress()};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();$('#clear-progress').onclick=()=>{completed.clear();saveProgress();renderNav();renderMap();updateProgress();$('#about-dialog').close();notify('本机学习进度已清除')};
$('#menu').onclick=()=>{const open=!$('#sidebar').classList.contains('open');$('#sidebar').classList.toggle('open',open);$('#shade').hidden=!open;$('#menu').setAttribute('aria-expanded',String(open))};$('#shade').onclick=closeMenu;
window.addEventListener('popstate',()=>select(location.hash.slice(1),false));window.addEventListener('hashchange',()=>{if(location.hash.slice(1)!==current.id)select(location.hash.slice(1),false)});
document.addEventListener('keydown',e=>{if($('#about-dialog').open)return;if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='/'){e.preventDefault();if($('#search')){if(innerWidth<=700){$('#sidebar').classList.add('open');$('#shade').hidden=false}$('#search').focus()}}else if(e.key===' '&&!e.target.closest('button,a')){e.preventDefault();if(view==='mechanism')play()}else if(e.key==='ArrowRight'&&view==='mechanism'){e.preventDefault();goStep(step+1)}else if(e.key==='ArrowLeft'&&view==='mechanism'){e.preventDefault();goStep(step-1)}else if(e.key==='Escape'){stop();step=0;started=false;closeMenu();renderStep()}else if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-trace]')){e.preventDefault();goStep(Number(e.target.dataset.trace))}});
window.addEventListener('storage',e=>{if(e.key==='systems-completed'){completed=new Set(safeRead('systems-completed',[]).filter(id=>byId[id]));updateProgress();renderNav();renderMap()}});
window.addEventListener('resize',()=>{draw()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
document.body.classList.toggle('no-motion',motionPreference.matches);
motionPreference.addEventListener('change',()=>{document.body.classList.toggle('no-motion',motionPreference.matches);draw();});
render();
