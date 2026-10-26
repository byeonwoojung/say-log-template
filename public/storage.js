// 기록 저장 담당
//
// 지금은 이 브라우저 안(localStorage)에만 저장해요.
// 그래서 다른 브라우저나 폰에서는 보이지 않아요.
//
// 나중에 이 파일만 "서버에 저장"하도록 바꾸면, 화면 코드(app.js)는 그대로 쓸 수 있어요.
// 서버와 주고받을 때를 대비해서 모든 함수를 async로 만들어 두었어요.
//
// 기록 하나의 모양:
// { id, date: '2026-10-26', time: '07:30' 또는 '', category: '운동', memo: '...', createdAt, updatedAt }
// 주제별 항목을 더할 때는 data 객체에 넣어요. 예: data: { weight: 60, reps: 10 }
//
// 이 파일을 바꿀 때 꼭 지킬 약속 (화면 코드가 이걸 믿고 있어요)
// - listRecords()는 최신 기록이 먼저 오게 정렬해서 돌려줘요 (날짜 → 시각 → 만든 순서).
//   홈의 "최근"과 CSV 내보내기가 이 순서를 그대로 써요.
// - date는 0을 채운 'YYYY-MM-DD'(예: 2026-10-05), time은 'HH:MM' 또는 ''예요.
//   달력이 글자 그대로 비교해서 기록을 찾아서, 2026-10-5처럼 들어오면 달력에 안 보여요.
// - 함수 이름, 받는 값, 돌려주는 모양은 그대로 둬요.

const STORAGE_KEY = 'say-log:records';

function load() {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function save(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    throw new Error('브라우저에 저장하지 못했어요. 저장 공간이 부족하거나 개인 정보 보호 모드일 수 있어요.');
  }
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clean(input) {
  return {
    date: String(input.date),
    time: String(input.time ?? ''),
    category: String(input.category ?? '').trim(),
    memo: String(input.memo ?? '').trim(),
  };
}

// 최신 기록이 위로: 날짜 → 시각 → 만든 순서
function newestFirst(a, b) {
  return b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.createdAt.localeCompare(a.createdAt);
}

export async function listRecords() {
  return load().sort(newestFirst);
}

export async function addRecord(input) {
  const now = new Date().toISOString();
  const record = { id: newId(), ...clean(input), createdAt: now, updatedAt: now };
  save([...load(), record]);
  return record;
}

export async function updateRecord(id, input) {
  const records = load();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) throw new Error('기록을 찾지 못했어요.');
  records[index] = { ...records[index], ...clean(input), updatedAt: new Date().toISOString() };
  save(records);
  return records[index];
}

export async function deleteRecord(id) {
  save(load().filter((record) => record.id !== id));
}

// 이 앱이 이 브라우저에 저장한 임시 기록만 지워요.
// 다른 사이트나 앱의 데이터는 건드리지 않아요.
export async function clearTemporaryRecords() {
  localStorage.removeItem(STORAGE_KEY);
}
