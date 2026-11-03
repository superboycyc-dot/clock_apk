const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../web/app.js'), 'utf8');
function boot(storage = new Map(), initialTime = 1000000) {
  let now = initialTime;
  class Clock extends Date { static now() { return now; } }
  const elements = new Map();
  function el(id) {
    if (!elements.has(id)) {
      const classes = new Set(), attributes = new Map();
      elements.set(id, {hidden:true, dataset:{}, style:{}, textContent:'', scrollTop:0,
        classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k)},contains:k=>classes.has(k),remove:k=>classes.delete(k),add:k=>classes.add(k)},
        setAttribute:(k,v)=>attributes.set(k,String(v)),getAttribute:k=>attributes.get(k),
        addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
        scrollTo(o){this.scrollTop=o.top},close(){},showModal(){}});
    }
    return elements.get(id);
  }
  const buttons = [15,30,45,60].map(n=>{const b=el('preset'+n);b.dataset.min=String(n);return b});
  buttons.push(el('recentPreset'));
  const context = vm.createContext({Date:Clock,document:{getElementById:el,documentElement:{clientWidth:844},body:el('body'),querySelector:s=>s==='nav'?el('nav'):null,querySelectorAll:s=>s==='[data-min]'?buttons:[],addEventListener(){},visibilityState:'hidden'},window:{innerHeight:390,addEventListener(){}},navigator:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},requestAnimationFrame:fn=>fn(),setTimeout:()=>0,clearTimeout(){},setInterval(){}});
  vm.runInContext(source,context);
  return {run:s=>vm.runInContext(s,context),el,storage,advance:ms=>{now+=ms;vm.runInContext('render()',context)},now:()=>now};
}
const app = boot();
app.run("setMode('focus'); updateMinute(20); alignWheel(); startTimer(true)");
assert.equal(app.el('focusRing').hidden,false);
app.advance(10000);
assert.equal(app.run('remaining'),1190);
app.run('toggleTimer()');
app.advance(15000);
assert.equal(app.run('remaining'),1205);
assert.equal(app.el('focusRing').classList.contains('counting-up'),true);
assert.equal(app.el('focusRing').classList.contains('over-limit'),true);
app.run('toggleTimer()');
app.advance(10000);
assert.equal(app.run('remaining'),1195);
assert.equal(app.el('focusRing').classList.contains('counting-up'),false);
assert.equal(app.el('focusRing').classList.contains('over-limit'),false);
app.run('add(5); toggleTimer(); add(10)');
app.advance(2000);
assert.equal(app.run('remaining'),2097);
app.run("$('digitalView').onclick()");
assert.equal(app.run('status'),'paused');
assert.equal(app.el('clock').classList.contains('digital'),true);
const restored = boot(app.storage, app.now()+10000);
assert.equal(restored.run('remaining'),2107);
restored.run('toggleTimer()');
restored.advance(1000);
assert.equal(restored.run('remaining'),2106);
assert.equal(restored.el('focusRing').classList.contains('has-overflow'),true);
assert.equal(restored.el('focusRing').classList.contains('over-limit'),false);
restored.run("$('confirmEnd').onclick(); updateMinute(1); alignWheel(); startTimer(false)");
assert.equal(restored.el('focusRing').hidden,true);
restored.advance(10000);
restored.run('toggleTimer()');
restored.advance(20000);
assert.equal(restored.run('remaining'),50);
restored.run('add(5); toggleTimer()');
restored.advance(10000);
assert.equal(restored.run('remaining'),340);
// Fractional seconds survive rapid direction switches without introducing time debt.
const precision = boot();
precision.run("setMode('focus'); updateMinute(1); alignWheel(); startTimer(true)");
precision.advance(125);
precision.run('toggleTimer()');
precision.advance(125);
precision.run('toggleTimer()');
assert.equal(precision.run('currentMilliseconds()'),60000);
precision.advance(60000);
assert.equal(precision.run('status'),'finished');
assert.equal(precision.el('focusRing').hidden,true);
console.log('通过：补时累加、方向切换、超时警示、双向加时、显示切换不暂停、重开恢复、正常暂停、毫秒精度和结束归零。');
