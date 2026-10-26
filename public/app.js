// 앱 동작: 화면 그리기, 기록 추가·수정·삭제, 달력, 내보내기
// 기록을 어디에 저장할지는 storage.js가 맡아요.
import * as storage from './storage.js';

const APP_NAME = '나의 기록';
const CLAUDE_URL = 'https://claude.ai/new'; // 폰에 Claude 앱이 있으면 앱으로 열려요
const RECENT_LIMIT = 20; // 홈의 "최근"에 보여줄 기록 수

const TITLES = { home: APP_NAME, calendar: '달력', settings: '설정' };

const $ = (selector) => document.querySelector(selector);

let records = [];
let currentView = 'home';
let calendarMonth = firstDayOfMonth(new Date());
let selectedDate = todayString();
let editingId = null; // 고치는 중인 기록의 id (새 기록이면 null)

// ── 날짜 도우미 ──

function pad(number) {
  return String(number).padStart(2, '0');
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayString() {
  return toDateString(new Date());
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(text) {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// '2026-10-26' → '오늘 · 10월 26일 (일)'
function dateLabel(text) {
  const date = parseDate(text);
  const now = new Date();
  const week = '일월화수목금토'[date.getDay()];
  const year = date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}년 `;
  const label = `${year}${date.getMonth() + 1}월 ${date.getDate()}일 (${week})`;
  const yesterday = toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (text === todayString()) return `오늘 · ${label}`;
  if (text === yesterday) return `어제 · ${label}`;
  return label;
}

// ── 화면 조각 만들기 도우미 ──
// h('p', { class: 'empty' }, '내용') → <p class="empty">내용</p>
// 글자는 textContent로 넣어서, 기록 내용에 HTML이 섞여 있어도 안전해요.
function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, value === true ? '' : value);
  }
  element.append(...children.flat().filter((child) => child != null && child !== false));
  return element;
}

function recordCard(record) {
  return h('button', { class: 'card', type: 'button', onclick: () => openEditor(record) },
    h('span', { class: 'card-top' },
      h('span', { class: 'card-category' }, record.category || '기록'),
      record.time ? h('span', { class: 'card-time' }, record.time) : null),
    record.memo ? h('span', { class: 'card-memo' }, record.memo) : null);
}

function emptyText(text) {
  return h('p', { class: 'empty' }, text);
}

// 날짜별로 묶어서 보여주기
function groupByDate(list) {
  const parts = [];
  let lastDate = '';
  for (const record of list) {
    if (record.date !== lastDate) {
      parts.push(h('h3', { class: 'date-title' }, dateLabel(record.date)));
      lastDate = record.date;
    }
    parts.push(recordCard(record));
  }
  return parts;
}

// ── 화면: 홈 (오늘 + 최근) ──

function renderHome() {
  const today = todayString();
  const todays = records.filter((record) => record.date === today);
  const recent = records.filter((record) => record.date !== today).slice(0, RECENT_LIMIT);
  return [
    h('a', { class: 'claude-button', href: CLAUDE_URL, target: '_blank', rel: 'noopener' }, 'Claude로 기록하기 ↗'),
    h('h2', { class: 'section-title' }, dateLabel(today)),
    todays.length ? todays.map(recordCard) : emptyText('오늘 기록이 아직 없어요. Claude로 기록하거나 ＋를 눌러 직접 적어 보세요.'),
    h('h2', { class: 'section-title' }, '최근'),
    recent.length ? groupByDate(recent) : emptyText('최근 기록이 없어요.'),
    isInstalledApp() ? null : h('button', { class: 'install-button', type: 'button', onclick: installApp }, '나만의 앱 설치하기'),
  ];
}

// ── 화면: 달력 ──

function moveMonth(step) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + step, 1);
  render();
}

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayString();

  const counts = {};
  for (const record of records) counts[record.date] = (counts[record.date] || 0) + 1;

  const cells = [];
  for (let i = 0; i < calendarMonth.getDay(); i++) cells.push(h('span', { class: 'day blank' }));
  for (let day = 1; day <= daysInMonth; day++) {
    const text = `${year}-${pad(month + 1)}-${pad(day)}`;
    const classes = ['day', text === today && 'today', text === selectedDate && 'selected'].filter(Boolean).join(' ');
    cells.push(h('button', {
      class: classes,
      type: 'button',
      'aria-label': `${month + 1}월 ${day}일${counts[text] ? `, 기록 ${counts[text]}개` : ''}`,
      onclick: () => { selectedDate = text; render(); },
    }, h('span', { class: 'day-number' }, String(day)), counts[text] ? h('span', { class: 'dot' }) : null));
  }

  const dayRecords = records.filter((record) => record.date === selectedDate);
  return [
    h('div', { class: 'calendar-header' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': '이전 달', onclick: () => moveMonth(-1) }, '‹'),
      h('h2', { class: 'calendar-title' }, `${year}년 ${month + 1}월`),
      h('button', { class: 'icon-button', type: 'button', 'aria-label': '다음 달', onclick: () => moveMonth(1) }, '›')),
    h('div', { class: 'weekdays' }, [...'일월화수목금토'].map((week) => h('span', {}, week))),
    h('div', { class: 'calendar-grid' }, cells),
    h('h2', { class: 'section-title' }, dateLabel(selectedDate)),
    dayRecords.length ? dayRecords.map(recordCard) : emptyText('이날은 기록이 없어요.'),
  ];
}

// ── 화면: 설정 ──

async function clearTemporary() {
  if (!confirm('이 브라우저에 저장된 임시 기록을 모두 지울까요?\n다른 사이트나 앱의 데이터는 지워지지 않아요.')) return;
  await storage.clearTemporaryRecords();
  toast('임시 기록을 지웠어요');
  await refresh();
}

function renderSettings() {
  return [
    h('h2', { class: 'section-title' }, '데이터 관리'),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '기록 내보내기'),
      h('p', {}, '모든 기록을 CSV 파일로 받아요. 엑셀이나 구글 시트에서 열 수 있어요.'),
      h('button', { class: 'button outline', type: 'button', disabled: records.length === 0, onclick: exportCsv }, 'CSV로 내보내기')),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '임시 기록 지우기'),
      h('p', {}, `이 브라우저에 저장된 "${APP_NAME}"의 기록만 지워요. 다른 사이트나 앱의 데이터는 지워지지 않아요.`),
      h('p', { class: 'panel-note' }, `지금 저장된 기록: ${records.length}개`),
      h('button', { class: 'button danger', type: 'button', disabled: records.length === 0, onclick: clearTemporary }, '임시 기록 모두 지우기')),
  ];
}

// ── 내보내기 (CSV: 엑셀이나 구글 시트에서 열려요) ──

function csvCell(value) {
  let text = String(value ?? '');
  // =, +, -, @로 시작하면 엑셀이 수식으로 읽을 수 있어서 앞에 '를 붙여요
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  if (!records.length) {
    toast('내보낼 기록이 없어요');
    return;
  }
  const rows = [['날짜', '시각', '종류', '메모'], ...[...records].reverse().map((r) => [r.date, r.time, r.category, r.memo])];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  // 맨 앞의 ﻿는 엑셀이 한글을 깨뜨리지 않게 해줘요
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = h('a', { href: url, download: `${APP_NAME}-${todayString()}.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV 파일로 내보냈어요');
}

// ── 나만의 앱 설치하기 ──
// 안드로이드(크롬 등): 브라우저가 설치 창을 띄울 수 있게 해줘요.
// 아이폰: 웹페이지가 설치 창을 띄울 수 없어서 "공유 → 홈 화면에 추가" 방법을 보여줘요.

let installPrompt = null; // 안드로이드에서 브라우저가 넘겨주는 설치 창

function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isIPhone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function showInstallGuide(steps) {
  $('#install-steps').replaceChildren(...steps.map((step) => h('li', {}, step)));
  $('#install-guide').showModal();
}

async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    if (outcome === 'accepted') toast('설치했어요');
    return;
  }
  if (isIPhone()) {
    showInstallGuide([
      'Safari 화면 아래(또는 위)의 공유 버튼을 눌러요.',
      '"홈 화면에 추가"를 눌러요.',
      '오른쪽 위의 "추가"를 누르면 끝!',
      '카카오톡 같은 앱 안에서 열었다면, Safari로 다시 열어 주세요.',
    ]);
    return;
  }
  showInstallGuide([
    '브라우저 메뉴(⋮ 또는 ⋯)를 열어요.',
    '"앱 설치" 또는 "홈 화면에 추가"를 눌러요.',
    '메뉴에 없다면, 앱을 배포한 주소(https)로 열었는지 확인해 주세요.',
  ]);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  toast('설치했어요');
  render();
});

// ── 입력창 (새 기록 / 고치기) ──

function openEditor(record) {
  editingId = record ? record.id : null;
  const form = $('#editor-form');
  form.reset();
  $('#editor-title').textContent = record ? '기록 고치기' : '새 기록';
  form.elements.date.value = record ? record.date : (currentView === 'calendar' ? selectedDate : todayString());
  form.elements.time.value = record?.time ?? '';
  form.elements.category.value = record?.category ?? '';
  form.elements.memo.value = record?.memo ?? '';
  $('#delete-button').hidden = !record;
  $('#editor-error').textContent = '';
  // 종류 자동완성: 지금까지 쓴 종류들
  const categories = [...new Set(records.map((r) => r.category).filter(Boolean))];
  $('#category-list').replaceChildren(...categories.map((category) => h('option', { value: category })));
  $('#editor').showModal();
}

function showEditorError(message) {
  $('#editor-error').textContent = message;
}

async function saveEditor(event) {
  event.preventDefault();
  const form = event.target.elements;
  const input = {
    date: form.date.value,
    time: form.time.value,
    category: form.category.value.trim(),
    memo: form.memo.value.trim(),
  };
  if (!input.date) return showEditorError('날짜를 골라 주세요.');
  if (!input.category && !input.memo) return showEditorError('종류나 메모 중 하나는 적어 주세요.');
  try {
    if (editingId) await storage.updateRecord(editingId, input);
    else await storage.addRecord(input);
  } catch (error) {
    return showEditorError(error.message || '저장하지 못했어요.');
  }
  $('#editor').close();
  toast(editingId ? '고쳤어요' : '기록했어요');
  await refresh();
}

async function deleteEditing() {
  if (!editingId || !confirm('이 기록을 지울까요?')) return;
  try {
    await storage.deleteRecord(editingId);
  } catch (error) {
    return showEditorError(error.message || '지우지 못했어요.');
  }
  $('#editor').close();
  toast('지웠어요');
  await refresh();
}

// ── 메뉴 ──

function openMenu() {
  $('#menu').inert = false;
  document.body.classList.add('menu-open');
  $('#menu-button').setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  $('#menu').inert = true; // 닫힌 메뉴는 Tab 키로도 들어가지 않게
  document.body.classList.remove('menu-open');
  $('#menu-button').setAttribute('aria-expanded', 'false');
}

function showView(view) {
  currentView = view;
  if (view === 'calendar') {
    selectedDate = todayString();
    calendarMonth = firstDayOfMonth(new Date());
  }
  closeMenu();
  render();
  window.scrollTo(0, 0);
}

// ── 알림 ──

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2000);
}

// ── 그리기 ──

const VIEWS = { home: renderHome, calendar: renderCalendar, settings: renderSettings };

function render() {
  $('#view-title').textContent = TITLES[currentView];
  $('#content').replaceChildren(...VIEWS[currentView]().flat().filter(Boolean));
  $('#add-button').hidden = currentView === 'settings';
  for (const item of document.querySelectorAll('.menu-item[data-view]')) {
    item.classList.toggle('active', item.dataset.view === currentView);
  }
}

async function refresh() {
  try {
    records = await storage.listRecords();
  } catch (error) {
    toast(error.message || '기록을 불러오지 못했어요');
  }
  render();
}

// ── 시작 ──

$('#menu-button').addEventListener('click', openMenu);
$('#menu-backdrop').addEventListener('click', closeMenu);
for (const item of document.querySelectorAll('.menu-item[data-view]')) {
  item.addEventListener('click', () => showView(item.dataset.view));
}
$('#add-button').addEventListener('click', () => openEditor(null));
$('#install-guide-close').addEventListener('click', () => $('#install-guide').close());
$('#editor-form').addEventListener('submit', saveEditor);
$('#cancel-button').addEventListener('click', () => $('#editor').close());
$('#delete-button').addEventListener('click', deleteEditing);
// 창 바깥(어두운 부분)을 누르면 닫혀요
// 창 안쪽 여백을 눌러도 target이 dialog가 되므로, 누른 위치가 창 밖인지 직접 확인해요
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== event.currentTarget) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right
      && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
// 다른 앱(예: Claude)에 갔다가 돌아오면 새로 불러와요
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refresh();
});

refresh();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
