const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
let mode = 'clock', view = 'flip', status = 'idle', remaining = 1500;
let deadline = 0, last = '', wake = null, audio = null, selectedMinutes = 25;
let lastStartedMinutes = 0;
let superMode = false, countupZero = 0, originalDurationMs = 1500000, pausedMs = 1500000;
const presetMinutes = [15, 30, 45, 60];
const defaults = {seconds:false, date:false, twelve:false, awake:true, sound:true, vibrate:true};
let prefs = {...defaults};
try {
  prefs = {...prefs, ...JSON.parse(localStorage.getItem('prefs') || '{}')};
  selectedMinutes = Math.max(1, Math.min(1439, Number(localStorage.getItem('minutes')) || 25));
  const previous = Number(localStorage.getItem('lastStartedMinutes'));
  if (Number.isInteger(previous) && previous >= 1 && previous <= 1439) lastStartedMinutes = previous;
  const saved = JSON.parse(localStorage.getItem('timer') || 'null');
  if (saved) {
    ({status, remaining, deadline} = saved);
    superMode = saved.superMode === true;
    countupZero = Number(saved.countupZero) || Date.now() - remaining * 1000;
    originalDurationMs = Number(saved.originalDurationMs) || remaining * 1000 || 1500000;
    pausedMs = Number.isFinite(saved.pausedMs) ? saved.pausedMs : remaining * 1000;
    if (status === 'running' || status === 'paused') mode = 'focus';
  }
} catch {}
function save() {
  localStorage.setItem('timer', JSON.stringify({status, remaining, deadline, superMode, countupZero, originalDurationMs, pausedMs}));
  localStorage.setItem('prefs', JSON.stringify(prefs));
  localStorage.setItem('minutes', selectedMinutes);
  localStorage.setItem('lastStartedMinutes', lastStartedMinutes);
}
function toast(s) {
  $('toast').textContent = s;
  $('toast').style.opacity = 1;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $('toast').style.opacity = 0, 2200);
}
function setMode(m) { mode = m; last = ''; render(); if (m === 'focus') alignWheel(); }
function draw(parts) {
  const str = parts.join(':');
  if (str === last) return;
  if (last.split(':').length !== parts.length || last.length !== str.length) {
    $('clock').innerHTML = parts.map((p,i) => `${i ? '<span class="colon">:</span>' : ''}<div class="group">${p.split('').map(n => `<div class="digit">${n}</div>`).join('')}</div>`).join('');
  } else {
    $('clock').querySelectorAll('.digit').forEach((el,i) => {
      const value = parts.join('')[i];
      if (el.textContent !== value) {
        el.textContent = value; el.classList.remove('flip');
        void el.offsetWidth; el.classList.add('flip');
      }
    });
  }
  last = str;
  $('clock').classList.toggle('small', parts.length === 3);
}
function finish() {
  status = 'finished'; remaining = 0; save();
  if (window.AndroidClock) AndroidClock.finished(prefs.sound, prefs.vibrate);
  else if (prefs.sound) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
      [0,.35,.7].forEach(delay => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.connect(g); g.connect(audio.destination); o.frequency.value = 660;
        g.gain.setValueAtTime(.12, audio.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + .25);
        o.start(audio.currentTime + delay); o.stop(audio.currentTime + delay + .3);
      });
    } catch {}
  }
  if (!window.AndroidClock && prefs.vibrate) navigator.vibrate?.([200,100,200]);
  toast('本次专注已完成');
}
function currentMilliseconds(now = Date.now()) {
  if (status === 'running') return Math.max(0, deadline - now);
  if (superMode && status === 'paused') return Math.max(0, now - countupZero);
  return pausedMs;
}
function renderRing(active) {
  const ring = $('focusRing');
  ring.hidden = !active || !superMode;
  if (ring.hidden) return;
  const ratio = currentMilliseconds() / originalDurationMs;
  const countingUp = status === 'paused';
  ring.classList.toggle('counting-up', countingUp);
  ring.classList.toggle('over-limit', countingUp && ratio > 1);
  ring.classList.toggle('has-overflow', ratio > 1);
  $('ringProgress').setAttribute('stroke-dasharray', `${Math.min(1, Math.max(0, ratio))} 1`);
  $('ringOverflow').setAttribute('stroke-dasharray', `${ratio > 1 ? ratio % 1 : 0} 1`);
}
function resizeRing() {
  const ring = $('ringSvg');
  const w = document.documentElement.clientWidth, h = window.innerHeight;
  const inset = 6, r = Math.min(24, w / 8, h / 8);
  const x = w - inset, y = h - inset;
  const d = `M ${w/2} ${inset} H ${x-r} Q ${x} ${inset} ${x} ${inset+r} V ${y-r} Q ${x} ${y} ${x-r} ${y} H ${inset+r} Q ${inset} ${y} ${inset} ${y-r} V ${inset+r} Q ${inset} ${inset} ${inset+r} ${inset} Z`;
  ring.setAttribute('viewBox', `0 0 ${w} ${h}`);
  for (const id of ['ringTrack', 'ringProgress', 'ringOverflow']) $(id).setAttribute('d', d);
}
function render() {
  if (status === 'running') {
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) finish();
  }
  if (superMode && status === 'paused') remaining = Math.ceil(currentMilliseconds() / 1000);
  const focus = mode === 'focus';
  const choosing = focus && (status === 'idle' || status === 'finished');
  const active = focus && (status === 'running' || status === 'paused');
  document.body.classList.toggle('choosing', choosing);
  document.body.classList.toggle('focus-active', active);
  document.body.classList.toggle('paused', active && status === 'paused' && !superMode);
  document.body.classList.toggle('super-active', active && superMode);
  document.body.classList.toggle('super-counting-up', active && superMode && status === 'paused');
  renderRing(active);
  $('clockTab').classList.toggle('selected', !focus);
  $('focusTab').classList.toggle('selected', focus);
  document.querySelector('nav').hidden = active;
  $('timerStage').hidden = choosing;
  $('setup').hidden = !choosing;
  $('displaySwitch').hidden = !active;
  $('add5').hidden = $('add10').hidden = !active;
  $('end').hidden = !active || status !== 'paused';
  $('gestureHint').hidden = !focus || status !== 'paused';
  $('gestureHint').textContent = superMode ? '正在补时 · 轻点屏幕恢复倒计时' : '已暂停 · 轻点屏幕继续';
  $('screen').setAttribute('aria-label', superMode && active ? '超级专注，点击屏幕切换正计时与倒计时' : '计时后点击屏幕暂停或继续专注');
  $('clock').classList.toggle('digital', focus && view === 'digital');
  $('subline').textContent = '';
  if (focus && !choosing) {
    const n = remaining;
    draw(n >= 3600 ? [pad(Math.floor(n/3600)), pad(Math.floor(n/60)%60), pad(n%60)] : [pad(Math.floor(n/60)), pad(n%60)]);
  } else if (!focus) {
    const now = new Date(), h = now.getHours();
    draw([pad(prefs.twelve ? (h%12||12) : h), pad(now.getMinutes()), ...(prefs.seconds ? [pad(now.getSeconds())] : [])]);
    $('subline').textContent = [prefs.date ? now.toLocaleDateString('zh-CN', {month:'long',day:'numeric',weekday:'long'}) : '', prefs.twelve ? (h<12?'AM':'PM') : ''].filter(Boolean).join(' · ');
  }
  $('subline').hidden = !$('subline').textContent;
}
// The wheel has one column: 1–1439 minutes. Snapping keeps the selected row centered.
const wheel = $('minuteWheel');
wheel.innerHTML = Array.from({length:1439}, (_,i) => `<div class="minute-option" role="option" id="minute-${i+1}" aria-selected="false" data-minute="${i+1}">${i+1}</div>`).join('');
function updateMinute(n) {
  selectedMinutes = Math.max(1, Math.min(1439, Math.round(n)));
  wheel.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected','false');
  $('minute-' + selectedMinutes).setAttribute('aria-selected','true');
  wheel.setAttribute('aria-activedescendant','minute-' + selectedMinutes);
  updatePresets();
  save();
}
function updatePresets() {
  const recent = $('recentPreset');
  recent.hidden = !lastStartedMinutes || presetMinutes.includes(lastStartedMinutes);
  recent.dataset.min = String(lastStartedMinutes);
  recent.textContent = lastStartedMinutes ? `${lastStartedMinutes} 分钟` : '';
  document.querySelectorAll('[data-min]').forEach(b => {
    const selected = Number(b.dataset.min) === selectedMinutes;
    b.classList.toggle('active',selected); b.setAttribute('aria-pressed',selected);
  });
}
function alignWheel(behavior='instant') {
  requestAnimationFrame(() => {
    if (!$('setup').hidden) wheel.scrollTo({top:(selectedMinutes-1)*44, behavior});
  });
}
updateMinute(selectedMinutes);
let wheelSettle;
wheel.addEventListener('scroll', () => {
  clearTimeout(wheelSettle);
  wheelSettle = setTimeout(() => updateMinute(wheel.scrollTop/44 + 1), 100);
}, {passive:true});
wheel.addEventListener('click', e => {
  const row = e.target.closest('[data-minute]');
  if (row) { updateMinute(Number(row.dataset.minute)); alignWheel('smooth'); }
});
wheel.addEventListener('keydown', e => {
  const changes = {ArrowUp:-1, ArrowDown:1, PageUp:-10, PageDown:10};
  if (e.key in changes || e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    updateMinute(e.key === 'Home' ? 1 : e.key === 'End' ? 1439 : selectedMinutes + changes[e.key]);
    alignWheel();
  }
});
window.addEventListener('resize', () => { alignWheel(); resizeRing(); });
$('clockTab').onclick = () => setMode('clock');
$('focusTab').onclick = () => setMode('focus');
document.querySelectorAll('[data-min]').forEach(b => b.onclick = () => {
  updateMinute(Number(b.dataset.min)); alignWheel();
});
function startTimer(isSuper = false) {
  if (mode !== 'focus' || (status !== 'idle' && status !== 'finished')) return;
  clearTimeout(wheelSettle);
  updateMinute(wheel.scrollTop / 44 + 1);
  superMode = isSuper;
  remaining = selectedMinutes * 60;
  originalDurationMs = pausedMs = remaining * 1000;
  countupZero = 0;
  deadline = Date.now() + originalDurationMs;
  status = 'running';
  lastStartedMinutes = selectedMinutes;
  updatePresets();
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
  resizeRing(); keepAwake(); save(); render();
}
function toggleTimer() {
  if (mode !== 'focus' || (status !== 'running' && status !== 'paused')) return;
  const now = Date.now(), milliseconds = currentMilliseconds(now);
  if (status === 'running') {
    if (!milliseconds) { finish(); render(); alignWheel(); return; }
    pausedMs = milliseconds;
    remaining = Math.ceil(milliseconds / 1000);
    if (superMode) countupZero = now - milliseconds;
    status = 'paused';
  } else {
    deadline = now + milliseconds;
    status = 'running';
  }
  save(); render();
}
$('start').onclick = () => startTimer(false);
$('superStart').onclick = () => startTimer(true);
// Keep the entire display switch, including its divider and gaps, out of tap-to-pause.
$('displaySwitch').addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', e => {
  if (e.target.closest('button, #displaySwitch, #setup, dialog, input, a') || document.querySelector('dialog[open]')) return;
  if (status === 'running' || status === 'paused') toggleTimer();
});
$('screen').addEventListener('keydown', e => {
  if ((status === 'running' || status === 'paused') && e.target === $('screen') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggleTimer(); }
});
$('end').onclick = () => $('confirm').showModal();
$('cancelEnd').onclick = () => $('confirm').close();
$('confirmEnd').onclick = () => { status = 'idle'; superMode = false; save(); $('confirm').close(); render(); alignWheel(); };
function add(n) {
  if (status !== 'running' && status !== 'paused') return;
  if (status === 'running') deadline += n*60000;
  else if (superMode) countupZero -= n*60000;
  else { pausedMs += n*60000; remaining = Math.ceil(pausedMs / 1000); }
  save(); render();
}
$('add5').onclick = () => add(5);
$('add10').onclick = () => add(10);
for (const [id,v] of [['flipView','flip'],['digitalView','digital']]) $(id).onclick = () => {
  view = v;
  $('flipView').classList.toggle('active', v==='flip');
  $('digitalView').classList.toggle('active', v==='digital'); render();
};
$('settingsButton').onclick = () => $('settings').showModal();
for (const key of Object.keys(defaults)) {
  $(key).checked = prefs[key];
  $(key).onchange = () => { prefs[key] = $(key).checked; save(); render(); if (key==='awake') keepAwake(); };
}
async function keepAwake() {
  if (window.AndroidClock) { AndroidClock.keepAwake(prefs.awake); return; }
  try {
    if (prefs.awake && document.visibilityState==='visible') {
      if (!wake || wake.released) wake = await navigator.wakeLock?.request('screen');
    } else if (wake) { await wake.release(); wake = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => { render(); keepAwake(); });
$('fullscreen').onclick = async () => {
  if (window.AndroidClock) { AndroidClock.toggleFullscreen(); return; }
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { toast('当前预览窗口不支持全屏，可使用浏览器全屏'); }
};
let idle;
function activity() {
  document.body.classList.remove('immersed'); clearTimeout(idle);
  if (document.fullscreenElement) idle = setTimeout(() => document.body.classList.add('immersed'), 6000);
}
document.addEventListener('pointerdown', activity);
document.addEventListener('mousemove', activity);
document.addEventListener('fullscreenchange', activity);
resizeRing(); render(); alignWheel(); keepAwake(); setInterval(render,100);

// The installed Android app checks the public GitHub release; preview keeps settings local.
try {
  const info = window.AndroidClock?.appInfo ? JSON.parse(AndroidClock.appInfo()) : {version:'1.2.0', automatic:localStorage.getItem('autoUpdates') !== 'false'};
  $('appVersion').textContent = info.version;
  $('autoUpdates').checked = info.automatic;
} catch {}
$('autoUpdates').onchange = () => {
  if (window.AndroidClock?.autoUpdates) AndroidClock.autoUpdates($('autoUpdates').checked);
  else localStorage.setItem('autoUpdates', String($('autoUpdates').checked));
};
$('checkUpdates').onclick = () => {
  if (window.AndroidClock?.checkUpdates) AndroidClock.checkUpdates();
  else toast('请在安卓应用中检查更新');
};
