import { levels } from './levels.js';
import { initialState, move, solve } from './engine.js';
import { Renderer } from './renderer.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#board');
const renderer = new Renderer(canvas);
const storageKey = 'blockshift-progress-v1';
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { saved = {}; }
const progress = { best: {}, current: 0, sound: false, ...saved };
if (!progress.best || typeof progress.best !== 'object') progress.best = {};
let levelIndex = Number.isInteger(progress.current) ? Math.max(0, Math.min(levels.length - 1, progress.current)) : 0;
let state, history = [], animation = null, pending = null, won = false, toastTimer, audio;
let queue = [], lastDraw = 0;
let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const directionKeys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' };
const directionArrows = { up: '↑', right: '→', down: '↓', left: '←' };
const pad = n => String(n).padStart(2, '0');

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* Private browsing can disable storage. */ }
}

function sound(type) {
  if (!progress.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = type === 'win' ? [392, 494, 587, 784] : type === 'fall' ? [180, 120] : type === 'switch' ? [440, 660] : [220];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + i * .11;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .01); gain.gain.exponentialRampToValueAtTime(.001, start + .17);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .18);
    });
  } catch { /* Audio is optional. */ }
}

function toast(message, duration = 3100) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), duration);
}

function updateUI() {
  $('#moves').textContent = pad(history.length);
  $('#best').textContent = Number.isInteger(progress.best[levelIndex]) ? pad(progress.best[levelIndex]) : '—';
  $('#undo').disabled = history.length === 0 || Boolean(animation);
  $('#hint').disabled = won || Boolean(animation);
  const completed = levels.filter((_, i) => Number.isInteger(progress.best[i])).length;
  $('#progress-count').textContent = `${completed} / ${levels.length}`;
  $('#progress-bar').style.width = `${completed / levels.length * 100}%`;
  document.querySelectorAll('.level-choice').forEach((button, i) => {
    const done = Number.isInteger(progress.best[i]);
    button.classList.toggle('active', i === levelIndex);
    button.classList.toggle('completed', done);
    button.setAttribute('aria-current', i === levelIndex ? 'step' : 'false');
    button.setAttribute('aria-label', `Level ${i+1}: ${levels[i].name}${done ? ', completed' : ''}`);
    button.innerHTML = `${pad(i+1)}${done ? '<svg class="icon"><use href="#i-check"/></svg>' : ''}`;
  });
  const position = state.o === 'u' ? 'upright' : 'lying flat';
  canvas.setAttribute('aria-label', `${levels[levelIndex].name}. Block ${position}, column ${state.x+1}, row ${state.z+1}. ${history.length} moves. Arrow keys or WASD to roll. Z to undo.`);
}

function loadLevel(index) {
  levelIndex = index;
  state = initialState(levels[index]); history = []; animation = null; pending = null; queue = []; won = false;
  progress.current = index; save();
  renderer.configure(levels[index]);
  $('#level-number').textContent = pad(index + 1);
  $('#level-title').textContent = levels[index].name;
  $('#difficulty').textContent = levels[index].difficulty;
  $('#win-overlay').hidden = true;
  $('#next-level').disabled = false;
  $('#toast').classList.remove('visible');
  updateUI();
  renderer.draw(state);
}

function win() {
  won = true; queue = [];
  const oldBest = progress.best[levelIndex];
  const best = !Number.isInteger(oldBest) || history.length < oldBest;
  if (best) progress.best[levelIndex] = history.length;
  save(); updateUI(); sound('win');
  const completed = levels.every((_, i) => Number.isInteger(progress.best[i]));
  $('#win-title').textContent = completed ? 'Beautifully done.' : 'Nicely shifted.';
  $('#win-message').textContent = completed ? 'Nine little puzzles. A whole new perspective.' : levels[levelIndex].note;
  $('#win-stats').textContent = `${history.length} moves${best ? ' · A new personal best ✳' : ` · Your best: ${oldBest}`}`;
  $('#next-level').innerHTML = `${levelIndex === levels.length - 1 ? 'Back to the beginning' : 'On to the next'} <svg class="icon"><use href="#i-arrow"/></svg>`;
  $('#win-overlay').hidden = false;
  $('#next-level').focus({ preventScroll: true });
}

function roll(direction) {
  if (won || $('#help-dialog').open) return;
  if (animation) { if (queue.length < 2) queue.push(direction); return; }
  const result = move(levels[levelIndex], state, direction);
  history.push({ ...state });
  pending = result;
  animation = { type: 'roll', start: performance.now(), duration: reducedMotion ? 45 : 175, direction };
  const button = document.querySelector(`[data-direction="${direction}"]`);
  button.classList.add('pressed'); setTimeout(() => button.classList.remove('pressed'), 160);
  $('#toast').classList.remove('visible');
  sound('roll'); updateUI();
}

function undo() {
  if (animation || !history.length || $('#help-dialog').open) return;
  state = history.pop(); won = false; queue = [];
  $('#win-overlay').hidden = true;
  updateUI(); renderer.draw(state);
  canvas.focus({ preventScroll: true });
}

function frame(now) {
  if (animation && now - animation.start >= animation.duration) {
    if (animation.type === 'roll') {
      const previousMask = state.mask;
      state = pending.state;
      if (pending.status === 'fall' || pending.status === 'fragile') {
        queue = []; sound('fall');
        animation = { type: 'fall', start: now, duration: reducedMotion ? 45 : 340 };
      } else {
        const didWin = pending.status === 'win';
        animation = null; pending = null;
        if (previousMask !== state.mask) { sound('switch'); toast(state.mask ? 'A new path, just for you. Bridge opened.' : 'Bridge closed. Another way around?'); }
        if (didWin) win();
        updateUI();
      }
    } else {
      const fragile = pending.status === 'fragile';
      state = history.pop(); animation = null; pending = null;
      toast(fragile ? 'A lighter touch. Keep flat on copper tiles.' : 'A little too far. Try a different turn.');
      updateUI();
    }
    if (!animation && !won && queue.length) roll(queue.shift());
  }
  if (!document.hidden && (animation || now - lastDraw > 42)) {
    renderer.draw(state, animation, now);
    lastDraw = now;
  }
  requestAnimationFrame(frame);
}

levels.forEach((level, i) => {
  const button = document.createElement('button');
  button.className = 'level-choice'; button.textContent = pad(i+1);
  button.addEventListener('click', () => { loadLevel(i); canvas.focus({ preventScroll: true }); });
  $('#level-grid').append(button);
});

document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => roll(button.dataset.direction)));
document.addEventListener('keydown', event => {
  if ($('#help-dialog').open || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (directionKeys[key]) { event.preventDefault(); if (!event.repeat) roll(directionKeys[key]); }
  else if (key === 'z' || key === 'Backspace') { event.preventDefault(); undo(); }
  else if (key === 'r') { event.preventDefault(); loadLevel(levelIndex); }
});

let touchStart;
canvas.addEventListener('pointerdown', event => {
  touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointerup', event => {
  if (!touchStart || event.pointerId !== touchStart.id) return;
  const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  roll(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
});
canvas.addEventListener('pointercancel', () => { touchStart = null; });
$('#undo').addEventListener('click', undo);
$('#restart').addEventListener('click', () => { loadLevel(levelIndex); canvas.focus({ preventScroll: true }); });
$('#replay-level').addEventListener('click', () => { loadLevel(levelIndex); canvas.focus({ preventScroll: true }); });
$('#next-level').addEventListener('click', () => { loadLevel((levelIndex + 1) % levels.length); canvas.focus({ preventScroll: true }); });
$('#hint').addEventListener('click', () => {
  const solution = solve(levels[levelIndex], state);
  if (solution?.length) toast(`Try a little roll ${solution[0]} ${directionArrows[solution[0]]}`, 3800);
  else toast('A fresh start might help. Undo a few moves or restart.');
});

function updateSound() {
  $('#sound-toggle').setAttribute('aria-pressed', String(Boolean(progress.sound)));
  $('#sound-toggle').setAttribute('aria-label', progress.sound ? 'Turn sound off' : 'Turn sound on');
  $('#sound-toggle').innerHTML = `<svg class="icon"><use href="#i-${progress.sound ? 'sound' : 'muted'}"/></svg>`;
}
$('#sound-toggle').addEventListener('click', () => { progress.sound = !progress.sound; save(); updateSound(); sound('switch'); });
document.querySelectorAll('[data-help]').forEach(button => button.addEventListener('click', () => { queue = []; $('#help-dialog').showModal(); }));
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#start-playing').addEventListener('click', () => { $('#help-dialog').close(); canvas.focus({ preventScroll: true }); });
$('#help-dialog').addEventListener('click', event => { if (event.target === $('#help-dialog')) { const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close(); } });
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { reducedMotion = event.matches; });
renderer.onResize = () => renderer.draw(state, animation);
renderer.resize(); loadLevel(levelIndex); updateSound();
requestAnimationFrame(frame);
