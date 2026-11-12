const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const scope={};vm.runInNewContext(fs.readFileSync('dist/data.js','utf8')+';this.lessons=LESSONS;this.sources=SOURCES;this.groups=GROUPS;',scope);
vm.runInNewContext(fs.readFileSync('dist/mechanisms.js','utf8')+';this.details=MECHANISM_DETAILS;this.readings=CSAPP_READINGS;',scope);
const lessons=scope.lessons,ids=new Set(lessons.map(l=>l.id));
// 单主题版本：只保留 TCP 一课，其余内容全部移除。
assert.equal(lessons.length,1,'this build must contain exactly one lesson');
assert.deepEqual([...ids],['tcp'],'the only lesson is tcp');
assert.equal(scope.groups.length,1,'single group');
assert.equal(lessons[0].group,0,'tcp belongs to the only group');
assert.deepEqual(Object.keys(scope.details),['tcp'],'mechanism details exist for the only topic');
for(const l of lessons){
  const d=scope.details[l.id];
  assert(d.sections.length>0&&d.sections.every(s=>s.title&&s.body),l.id+' mechanism sections');
  assert(d.foundation&&d.readings.length>0,l.id+' CSAPP foundation and reading');
  for(const id of d.readings){const r=scope.readings[id];assert(r&&r.section&&r.title&&r.path&&r.note,l.id+' CSAPP reference '+id);}
  for(const id of d.sources||[])assert(scope.sources[id],l.id+' additional source '+id);
}
const kinds=new Set(['request','data','control','check','reject','lost','local','compare']);
let count=0;
for(const l of lessons){
  assert(l.fault&&Array.isArray(l.fault.steps),l.id+' needs a complete independent alternate scenario');
  assert.notEqual(l.steps,l.fault.steps,l.id+' scenarios must not share a mutable steps array');
  const scenarios=[['main',l],['alternate',l.fault]];
  if(l.special){assert.notEqual(l.steps,l.special.steps,l.id+' special must not share a mutable steps array');scenarios.push(['special',l.special]);}
  for(const [caseName,c] of scenarios){
    assert.equal(c.nodes.length,4,l.id+' '+caseName+' node count');assert(c.steps.length>=2&&c.steps.length<=16,l.id+' '+caseName+' stage count');assert(Array.isArray(c.code)&&c.code.length>0,l.id+' '+caseName+' pseudocode');
    for(const s of c.steps){count++;assert.equal(s.length,7,l.id+' '+caseName+' frame schema');assert(s[1]>=0&&s[1]<4&&s[2]>=0&&s[2]<4,l.id+' node index');assert(kinds.has(s[6]),l.id+' relation type');assert.equal(s[1]===s[2],s[6]==='local',l.id+' internal operations must not invent a transfer');for(const i of [0,3,4,5])assert(typeof s[i]==='string'&&s[i].trim().length>0,l.id+' nonempty frame text');}
  }
  for(const r of l.related)assert(ids.has(r),l.id+' related '+r);
  for(const id of l.sources){const source=scope.sources[id];assert(source,l.id+' source '+id);assert(/^https:\/\//.test(source.url),l.id+' source HTTPS');}
}
// TCP-specific contracts carried over from the full explorer.
const tcp=lessons.find(l=>l.id==='tcp');assert(tcp.scene==='network'&&Array.isArray(tcp.addresses)&&tcp.addresses.length===4,'tcp network scene metadata');
const TCP_CATS=new Set(['hand','cdata','sdata','fin','lost']);
for(const [key,c] of [['main',tcp],['alternate',tcp.fault]]){assert(Array.isArray(tcp.net&&tcp.net[key])&&tcp.net[key].length===c.steps.length,'tcp packet rows must match stages');for(const r of tcp.net[key])for(const k of ['t','src','dst','proto','info','size','cat'])assert(typeof r[k]==='string'&&r[k].trim().length>0,'tcp net row field '+k);for(const r of tcp.net[key])assert(TCP_CATS.has(r.cat),'tcp packet category '+r.cat);}
// PE 对齐回归：主流程是一条含握手/数据/丢失/SACK/重传/挥手的连续时间线
assert.equal(tcp.steps.length,14,'tcp main must be the continuous 14-stage lifecycle');
assert.equal(tcp.steps[5][6],'lost','row 6 is the lost segment');
assert(tcp.net.main[5].info.includes('Len=1460')&&tcp.net.main[5].cat==='sdata','lost row keeps its server-data category');
assert(tcp.net.main.map(r=>r.cat).join(',').includes('cdata')&&tcp.net.main.some(r=>r.cat==='fin'),'client data and FIN categories present');
assert(Array.isArray(tcp.stepNotes)&&tcp.stepNotes.length===14&&tcp.stepNotes.every(n=>n.trim().length>40),'every stage carries a deep note');
console.log(`Content contracts passed: 1 lesson (TCP), 2 scenarios, ${count} typed stages, valid references. These checks do not prove protocol correctness.`);
