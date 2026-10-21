// 학생 화면 (팀 기기 1대)
import { getBackend } from './store.js';
import { CONFIG } from './config.js';
import { loadData, helpers, $, esc, icon, seededShuffle, toast, connBanner, watchConnection, modeBadge, asset, CAUSE_EMOJI, fmtTime, timerRemain } from './common.js';
import { createMap } from './map.js';
import { caseAnimHtml } from './caseAnim.js';

const app = $('#app');
const SAVE_KEY = 'gcf:me';
const COLORS = ['red', 'orange', 'purple'];
const STEP_NAMES = ['사건 읽기', '원인 카드', '문장 틀', '핀 꽂기', '연결의 실'];
const BLANKS = ['where', 'problem', 'link'];
const QUESTIONS = {
  where: { q: '📍 사건은 어디에서 일어났나요?', tip: '사건 현장을 보세요' },
  problem: { q: '🔵 어떤 문제가 일어나고 있나요?', tip: '기사의 파란 문장을 보세요' },
  link: { q: '🔗 이 문제는 누구·무엇에게까지 이어지나요?', tip: '연결 고리 상자를 보세요' },
};
const REASON_CHIPS = [
  '한 곳의 문제가 다른 곳까지 번져요',
  '원인이 서로 비슷해요',
  '결국 우리 생활까지 이어져요',
  '같은 지구의 바다·하늘을 함께 써요',
];

let C, P, H, backend;
let code = '', teamId = '', room = null;
let lastKey = '';
const ui = {
  join: 'code', joinCode: '',
  envOpen: false, anim: false, blank: 'where', custom: null, article: false, pinning: false,
  link: { to: null, word: null, reason: null, custom: false },
};

// ───────────── 시작 ─────────────
init();
async function init() {
  ({ content: C, pins: P } = await loadData());
  H = helpers(C);
  backend = await getBackend();
  if (!backend) { app.innerHTML = ''; connBanner(true, { failed: true }); return; }
  watchConnection(backend);
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (saved?.code && saved?.teamId && (await safeExists(saved.code))) enterRoom(saved.code, saved.teamId);
  else renderJoin();
  setInterval(tickTimer, 500);
}

async function safeExists(c) {
  try { return await backend.roomExists(c); } catch { connBanner(true); return false; }
}

// ───────────── 입장 ─────────────
function renderJoin() {
  renderHeader(0);
  if (ui.join === 'code') {
    const boxes = [0, 1, 2, 3].map((i) => `<span class="digit ${ui.joinCode[i] ? 'on' : ''}">${ui.joinCode[i] || ''}</span>`).join('');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '확인'];
    app.innerHTML = `
      <section class="join">
        <div class="join-left">
          <img class="mascot" src="${asset('assets/earth_mascot.png')}" alt="지구 친구 어스">
          <h1>지구촌 사건 파일</h1>
          <p>선생님이 알려 준 <b>수업 코드 4자리</b>를 눌러요.</p>
        </div>
        <div class="paper join-box">
          <div class="digits">${boxes}</div>
          <div class="keypad">${keys.map((k) => `<button class="key ${k === '확인' ? 'ok' : ''}" data-key="${k}">${k}</button>`).join('')}</div>
        </div>
      </section>`;
  } else {
    const order = C.presentationOrder.map((id) => H.teamById(id));
    app.innerHTML = `
      <section class="join teams">
        <h2>우리 팀을 골라요 <small>(수업 코드 ${esc(ui.joinCode)})</small></h2>
        <div class="team-grid">
          ${order.map((t) => `<button class="team-btn ${t.school === '의령초' ? '' : 'remote'}" data-team="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.school)} · ${t.members}명</span><small>사건 파일 No.${t.caseNo}</small></button>`).join('')}
        </div>
        <button class="btn ghost" data-act="backCode">◀ 코드 다시 넣기</button>
      </section>`;
  }
}

async function pressKey(k) {
  if (k === '⌫') ui.joinCode = ui.joinCode.slice(0, -1);
  else if (k === '확인') {
    if (ui.joinCode.length !== 4) return toast('숫자 4개를 눌러 주세요');
    if (!(await safeExists(ui.joinCode))) { toast('수업 코드를 다시 확인해 주세요 🔍'); ui.joinCode = ''; }
    else ui.join = 'team';
  } else if (ui.joinCode.length < 4) ui.joinCode += k;
  renderJoin();
}

let unsub = null;
function enterRoom(c, tid) {
  code = c; teamId = tid;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ code, teamId }));
  backend.presence(code, teamId);
  unsub?.();
  unsub = backend.subscribe(code, (r) => { room = r; render(); });
}

function leaveRoom() {
  if (!confirm('팀 선택 화면으로 돌아갈까요? (고른 내용은 지워지지 않아요)')) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

// ───────────── 화면 그리기 ─────────────
const team = () => room?.teams?.[teamId] || {};
const myCase = () => H.caseByNo(H.teamById(teamId).caseNo);
const stageOf = (t) => (t.pinnedAt > 0 ? 5 : t.stage || 1);
const update = (patch) => backend.updateTeam(code, teamId, patch).catch(() => connBanner(true));

function render() {
  if (!room) {
    renderHeader(0);
    app.innerHTML = `<section class="center-msg"><img class="mascot" src="${asset('assets/earth_mascot.png')}" alt=""><h2>수업이 끝났어요. 함께해 줘서 고마워요! 🌏</h2><button class="btn" data-act="reset">처음 화면으로</button></section>`;
    localStorage.removeItem(SAVE_KEY);
    lastKey = '';
    return;
  }
  const st = room.state || {};
  const t = team();
  const stage = stageOf(t);
  const links = Object.values(room.links || {});
  const key = JSON.stringify([st.phase, st.linksOpen, t.stage, t.readDone, t.cardIds, t.mainCause, t.sentences, t.pinnedAt, links.length, ui]);
  renderHeader(stage);
  if (key === lastKey) return;
  lastKey = key;

  // 입력 중이던 칸 보존
  const active = document.activeElement;
  const keep = active?.id ? { id: active.id, value: active.value, pos: active.selectionStart } : null;

  if (st.phase === 'intro' || st.phase === 'guide') app.innerHTML = viewWaiting();
  else if (stage === 5) app.innerHTML = st.linksOpen ? viewLinks(links) : viewDone();
  else if (stage === 1) app.innerHTML = !ui.envOpen && !t.readDone ? viewEnvelope() : ui.anim ? viewAnim() : viewRead();
  else if (stage === 2) app.innerHTML = viewCards();
  else if (stage === 3) app.innerHTML = viewSentences();
  else if (stage === 4) app.innerHTML = viewPin();

  if (ui.article) app.insertAdjacentHTML('beforeend', `<div class="modal-back" data-act="closeArticle"><div class="modal article-modal"><button class="close" data-act="closeArticle">✕</button>${articleHtml(myCase())}</div></div>`);

  // 작은 지도
  const mm = $('#miniMap');
  if (mm) {
    const m = createMap(mm, { content: C, pins: P, mini: true, showLabels: stage === 5 });
    m.update(room, { showLinks: stage === 5 && st.linksOpen, highlight: ui.link.to != null ? [ui.link.to] : [] });
    if (stage < 5) addTarget(mm, myCase().no, ui.pinning ? t.mainCause : null);
  }
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.value; el.focus(); el.setSelectionRange?.(keep.pos, keep.pos); }
  }
}

function addTarget(mapEl, no, dropColor) {
  const p = P.pins.find((x) => x.id === no);
  const el = document.createElement('div');
  el.className = 'pin ' + (dropColor ? 'drop' : 'target');
  el.style.left = p.x * 100 + '%';
  el.style.top = p.y * 100 + '%';
  if (dropColor) el.style.setProperty('--pin', C.causes[dropColor]?.color);
  el.innerHTML = '<span class="pin-head"></span>';
  mapEl.querySelector('.map-pins').appendChild(el);
}

function renderHeader(stage) {
  const st = room?.state || {};
  $('#steps').innerHTML = stage
    ? STEP_NAMES.map((n, i) => {
      const s = i + 1;
      const locked = s === 5 && !st.linksOpen;
      const cls = s < stage ? 'done' : s === stage ? 'now' : '';
      return `<li class="${cls} ${locked ? 'locked' : ''}"><b>${'①②③④⑤'[i]}</b>${n}${locked ? ' 🔒' : ''}</li>`;
    }).join('')
    : '';
  const tm = H && teamId ? H.teamById(teamId) : null;
  $('#who').innerHTML = `
    ${backend ? modeBadge(backend) : ''}
    ${tm ? `<span class="timer" id="sTimer"></span><span class="team-name">${esc(tm.name)}</span><button class="change" data-act="leave" title="팀 바꾸기">⇄</button>` : ''}`;
  tickTimer();
}

function tickTimer() {
  const el = $('#sTimer');
  if (!el || !room?.state) return;
  const st = room.state;
  const show = st.phase === 'investigate' && !st.timerPaused;
  el.textContent = show ? '⏱ ' + fmtTime(timerRemain(st, backend.now())) : '';
  el.style.display = show ? '' : 'none';
}

// ── 대기 ──
function viewWaiting() {
  const tm = H.teamById(teamId);
  const roles = C.roles.filter((r) => r.minTeam <= tm.members);
  return `
    <section class="waiting">
      <img class="mascot bob" src="${asset('assets/earth_mascot.png')}" alt="지구 친구 어스">
      <div>
        <h1>🕵️ ${esc(tm.name)} 탐정단, 반가워요!</h1>
        <p class="lead">선생님이 <b>‘사건 수사’</b>를 시작하면 <b>사건 파일 No.${tm.caseNo}</b>이 도착해요.</p>
        <div class="roles">
          ${roles.map((r) => `<div class="role paper"><b>${esc(r.name)}</b><span>${esc(r.job)}</span></div>`).join('')}
        </div>
      </div>
    </section>`;
}

// ── ① 사건 파일 ──
function viewEnvelope() {
  const c = myCase();
  return `
    <section class="envelope-wrap">
      <button class="envelope" data-act="openEnv" aria-label="사건 파일 열기">
        <span class="flap"></span>
        <span class="env-label">TOP SECRET · 사건 파일 No.${c.no}</span>
        <span class="stamp">수사 중</span>
        <span class="env-tap">👆 눌러서 열기</span>
      </button>
    </section>`;
}

function viewAnim() {
  const c = myCase();
  return `
    <section class="s0">
      <div class="case-head">
        <span class="case-no">사건 파일 No.${c.no}</span>
        <h1>${c.icons.map(icon).join('')} ${esc(c.title)}</h1>
        <span class="place-tag">📍 ${esc(c.place)}</span>
      </div>
      <div class="anim-box">${caseAnimHtml(c.no)}</div>
      <footer class="s-foot">
        <span class="tip">🎬 무슨 일이 일어나고 있을까? 잘 살펴봐요!</span>
        <span>
          <button class="btn ghost" data-act="replay">↺ 다시 보기</button>
          <button class="btn big teal next-glow" data-act="toArticle">사건 파일 읽기 ▶</button>
        </span>
      </footer>
    </section>`;
}

function articleHtml(c) {
  return `
    <div class="legend"><span class="hl-problem">🔵 문제 단서</span><span class="hl-cause">🟡 원인 단서</span></div>
    <p class="article-text">${c.article.map((s) => (s.tag === 'plain' ? esc(s.text) : `<span class="hl-${s.tag}">${esc(s.text)}</span>`)).join(' ')}</p>
    <p class="source">출처: ${esc(c.source)}</p>`;
}

function viewRead() {
  const c = myCase();
  return `
    <section class="s1 opened">
      <div class="case-head">
        <span class="case-no">사건 파일 No.${c.no}</span>
        <h1>${c.icons.map(icon).join('')} ${esc(c.title)}</h1>
        <button class="btn ghost small" data-act="replay">🎬 장면 다시 보기</button>
        <span class="stamp">수사 중</span>
      </div>
      <div class="s1-grid">
        <div class="side">
          <article class="paper article">${articleHtml(c)}</article>
          <div class="paper linkbox"><b>🔗 연결 고리</b><p>${esc(c.link)}</p></div>
        </div>
        <div class="side">
          <div class="paper place"><b>📍 사건 현장</b> <span>${esc(c.place)}</span><div id="miniMap"></div></div>
          <div class="paper numclue"><b>🔢 숫자 단서</b><div class="big">${esc(c.numberClue.big)}</div><p>${esc(c.numberClue.text)}</p></div>
        </div>
      </div>
      <footer class="s-foot"><span class="tip">🟡 노란 문장에 원인이 숨어 있어요!</span><button class="btn big teal" data-act="readDone">다 읽었어요 ▶</button></footer>
    </section>`;
}

// ── ② 원인 카드 ──
function viewCards() {
  const c = myCase();
  const t = team();
  const picked = t.cardIds || [];
  const cols = COLORS.map((col) => {
    const cause = C.causes[col];
    const cards = C.causeCards.filter((k) => k.cause === col);
    return `
      <div class="card-col" style="--c:${cause.color};--cl:${cause.light}">
        <h3>${CAUSE_EMOJI[col]} ${esc(cause.name)} <small>${esc(cause.sub)}</small></h3>
        ${cards.map((k) => `<button class="cause-card ${picked.includes(k.id) ? 'on' : ''}" data-card="${k.id}"><span class="ic">${icon(k.icon)}</span>${esc(k.text)}${picked.includes(k.id) ? '<span class="check">✔</span>' : ''}</button>`).join('')}
      </div>`;
  }).join('');
  const good = picked.some((id) => c.expectedCardIds.includes(id));
  const pickedCards = picked.map(H.cardById);
  const colorsPicked = [...new Set(pickedCards.map((k) => k.cause))];
  const needMain = colorsPicked.length === 2;
  return `
    <section class="s2">
      <div class="s2-cards">${cols}</div>
      <aside class="paper s2-side">
        <h3>🕵️ 원인 카드를 <b>1~2장</b> 골라요</h3>
        <div class="picked">
          ${pickedCards.length ? pickedCards.map((k) => `<div class="mini-card" style="--c:${C.causes[k.cause].color}">${CAUSE_EMOJI[k.cause]} ${esc(k.text)}</div>`).join('') : '<p class="muted">아직 고른 카드가 없어요</p>'}
        </div>
        ${picked.length ? `<div class="hint ${good ? 'good' : 'try'}">${good ? '🔍 단서와 잘 맞아요!' : '🟡 노란 문장을 한 번 더 읽어 볼까?'}</div>` : ''}
        ${needMain ? `
          <div class="main-pick">
            <b>📌 핀 색으로 쓸 대표 원인 하나는?</b>
            ${colorsPicked.map((col) => `<button class="main-btn ${t.mainCause === col ? 'on' : ''}" data-main="${col}" style="--c:${C.causes[col].color}">${CAUSE_EMOJI[col]} ${esc(C.causes[col].name)}</button>`).join('')}
          </div>` : ''}
        <button class="btn ghost" data-act="article">📄 기사 다시 보기</button>
      </aside>
      <footer class="s-foot">
        <button class="btn ghost" data-act="prev">◀ 이전 단계로</button>
        <button class="btn big teal" data-act="next" ${picked.length && t.mainCause ? '' : 'disabled'}>문장 만들러 가기 ▶</button>
      </footer>
    </section>`;
}

function toggleCard(id) {
  const t = team();
  let ids = [...(t.cardIds || [])];
  if (ids.includes(id)) ids = ids.filter((x) => x !== id);
  else if (ids.length >= 2) return toast('카드는 2장까지! 하나를 먼저 빼 주세요 ✋');
  else ids.push(id);
  const colors = [...new Set(ids.map((x) => H.cardById(x).cause))];
  let main = t.mainCause || '';
  if (colors.length === 1) main = colors[0];
  else if (colors.length === 0 || !colors.includes(main)) main = '';
  update({ cardIds: ids, mainCause: main });
}

// ── ③ 문장 틀 ──
function sentencesOf(t) {
  const s = t.sentences || {};
  const cause = (t.cardIds || []).map((id) => H.cardById(id)?.text).filter(Boolean).join(' / ');
  return { where: s.where || '', problem: s.problem || '', link: s.link || '', cause, flags: s.customFlags || {} };
}

function frameHtml(t, { interactive = false } = {}) {
  const s = sentencesOf(t);
  const TOK = { '(어디)': 'where', '(어떤 문제)': 'problem', '(원인 카드)': 'cause', '(누구·무엇)': 'link' };
  const PH = { where: '어디', problem: '어떤 문제', cause: '원인 카드', link: '누구·무엇' };
  return C.sentenceFrame.map((line, i) => {
    const html = esc(line).replace(/\((어디|어떤 문제|원인 카드|누구·무엇)\)/g, (m) => {
      const f = TOK[m];
      const val = s[f];
      const active = interactive && ui.blank === f;
      const attr = interactive && f !== 'cause' ? `data-blank="${f}"` : '';
      return `<span class="blank ${val ? 'filled' : ''} ${active ? 'active' : ''} ${f}" ${attr}>${esc(val || PH[f])}</span>`;
    });
    return `<p class="sent"><span class="num">${i + 1}</span><span>${html}</span></p>`;
  }).join('');
}

function viewSentences() {
  const c = myCase();
  const t = team();
  const s = sentencesOf(t);
  const f = ui.blank;
  const choices = seededShuffle(c.sentenceChoices[f], teamId + f);
  const done = s.where && s.problem && s.link;
  const isCustom = ui.custom === f;
  return `
    <section class="s3">
      <div class="paper frame">
        <h3>📝 문장 틀 <small>빈칸을 눌러서 고칠 수 있어요</small></h3>
        ${frameHtml(t, { interactive: true })}
      </div>
      <div class="paper chips-box">
        <div class="blank-tabs">${BLANKS.map((b, i) => `<button class="tab ${b === f ? 'on' : ''} ${s[b] ? 'filled' : ''}" data-blank="${b}">빈칸 ${i + 1}${s[b] ? ' ✔' : ''}</button>`).join('')}</div>
        <h2>${QUESTIONS[f].q} <small>💡 ${QUESTIONS[f].tip}</small></h2>
        <div class="chips">
          ${choices.map((ch) => `<button class="chip ${s[f] === ch && !s.flags[f] ? 'on' : ''}" data-chip="${esc(ch)}">${esc(ch)}</button>`).join('')}
          <button class="chip write ${s.flags[f] || isCustom ? 'on' : ''}" data-act="custom">✏️ 직접 쓰기</button>
        </div>
        ${isCustom ? `
          <div class="custom-row">
            <input id="customInput" maxlength="40" placeholder="40자까지 써요" value="${s.flags[f] ? esc(s[f]) : ''}" autocomplete="off">
            <button class="btn teal" data-act="customOk">확인</button>
          </div>` : ''}
        <button class="btn ghost small" data-act="article">📄 기사 다시 보기</button>
      </div>
      <footer class="s-foot">
        <button class="btn ghost" data-act="prev">◀ 이전 단계로</button>
        <button class="btn big teal" data-act="next" ${done ? '' : 'disabled'}>핀 꽂으러 가기 ▶</button>
      </footer>
    </section>`;
}

function chooseBlank(field, value, custom) {
  const t = team();
  const cur = t.sentences || {};
  const flags = { where: false, problem: false, link: false, ...(cur.customFlags || {}), [field]: custom };
  const next = { where: cur.where || '', problem: cur.problem || '', link: cur.link || '', [field]: value, customFlags: flags };
  ui.custom = null;
  const empty = BLANKS.find((b) => !next[b]);
  if (empty) ui.blank = empty;
  update({ sentences: next });
}

// ── ④ 핀 꽂기 ──
function viewPin() {
  const t = team();
  const cause = C.causes[t.mainCause];
  return `
    <section class="s4">
      <div class="paper report">
        <h2>📝 우리 팀 사건 보고서 <small>사건 파일 No.${myCase().no}</small></h2>
        ${frameHtml(t)}
        <p class="pin-color">핀 색: <span class="cause-tag" style="--c:${cause?.color}">${CAUSE_EMOJI[t.mainCause] || ''} ${esc(cause?.name || '')}</span></p>
      </div>
      <div class="pin-area">
        <div id="miniMap"></div>
        <button class="btn big gold pin-btn" data-act="pin" ${ui.pinning ? 'disabled' : ''}>📍 우리 사건 현장에 핀 꽂기!</button>
      </div>
      <footer class="s-foot">
        <button class="btn ghost" data-act="prev" ${ui.pinning ? 'disabled' : ''}>◀ 이전 단계로</button>
        <span class="tip">핀을 꽂으면 선생님 지도에 바로 나타나요!</span>
      </footer>
    </section>`;
}

// ── 완료 ──
function viewDone() {
  return `
    <section class="done">
      <div class="done-left">
        <img class="mascot bob" src="${asset('assets/earth_mascot.png')}" alt="지구 친구 어스">
        <h1>🎉 핀이 세계지도에 꽂혔어요!</h1>
        <p class="lead">🎤 <b>발표자</b>는 이 세 문장으로 <b>40초 발표</b>를 준비해요.</p>
        <p class="locked-note">🔒 ⑤ 연결의 실은 선생님이 열면 시작돼요</p>
      </div>
      <div class="paper report">
        <h2>📝 우리 팀 사건 보고서 <small>사건 파일 No.${myCase().no}</small></h2>
        ${frameHtml(team())}
      </div>
    </section>`;
}

// ── ⑤ 연결의 실 ──
function viewLinks(links) {
  const mine = H.teamById(teamId);
  const L = ui.link;
  const options = [0, ...C.cases.map((c) => c.no)].filter((no) => no !== mine.caseNo);
  const toCase = L.to != null ? H.caseByNo(L.to) : null;
  const myLinks = links.filter((l) => l.fromTeamId === teamId);
  const goal = CONFIG.linkGoal;
  const reasonOk = L.custom ? true : !!L.reason;
  return `
    <section class="s5">
      <div class="paper col">
        <h3>1. 우리 사건과 이어진 사건은?</h3>
        <div class="case-list">
          ${options.map((no) => {
            const c = H.caseByNo(no);
            const owner = no === 0 ? '★ 선생님 예시' : H.teamByCase(no).name;
            return `<button class="case-opt ${L.to === no ? 'on' : ''}" data-to="${no}"><b>No.${no} ${esc(c.short)}</b><small>${esc(owner)}</small></button>`;
          }).join('')}
        </div>
      </div>
      <div class="paper col">
        <h3>2. 이어 주는 낱말</h3>
        <div class="chips words">${C.linkWords.map((w) => `<button class="chip ${L.word === w ? 'on' : ''}" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>
        <h3>3. 왜 이어질까?</h3>
        <div class="chips reasons">
          ${REASON_CHIPS.map((r) => `<button class="chip ${L.reason === r && !L.custom ? 'on' : ''}" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}
          <button class="chip write ${L.custom ? 'on' : ''}" data-act="reasonCustom">✏️ 직접 쓰기</button>
        </div>
        ${L.custom ? '<input id="reasonInput" maxlength="40" placeholder="한 줄 이유 (40자까지)" autocomplete="off">' : ''}
      </div>
      <div class="paper col send">
        <div id="miniMap"></div>
        <p class="link-preview">🧵 <b>No.${mine.caseNo} ${esc(myCase().short)}</b> ↔ <b>${toCase ? `No.${toCase.no} ${esc(toCase.short)}` : '(사건 고르기)'}</b><br>낱말: <b>${esc(L.word || '(고르기)')}</b></p>
        <button class="btn big gold" data-act="sendLink" ${L.to != null && L.word && reasonOk ? '' : 'disabled'}>🧵 실 잇기!</button>
        <div class="goal">
          <div class="goal-text">우리 모두의 연결 <b>${links.length}</b>개 / 목표 ${goal}개</div>
          <div class="bar"><span style="width:${Math.min(100, (links.length / goal) * 100)}%"></span></div>
          <small>우리 팀이 이은 실: ${myLinks.length}개 · 여러 번 이을 수 있어요!</small>
        </div>
      </div>
    </section>`;
}

async function sendLink() {
  const mine = H.teamById(teamId);
  const L = ui.link;
  let reason = L.reason;
  if (L.custom) {
    reason = ($('#reasonInput')?.value || '').trim().slice(0, 40);
    if (!reason) return toast('이유를 한 줄 써 주세요 ✏️');
  }
  const links = Object.values(room.links || {});
  if (links.some((l) => l.fromTeamId === teamId && l.toCaseNo === L.to && l.word === L.word)) return toast('이미 이은 실이에요! 다른 낱말이나 사건을 골라 볼까?');
  const crossSchool = mine.school !== H.schoolOfCase(L.to);
  await backend.pushLink(code, {
    fromTeamId: teamId, fromCaseNo: mine.caseNo, toCaseNo: L.to, word: L.word, reason, crossSchool, at: Date.now(),
  }).catch(() => connBanner(true));
  ui.link = { to: null, word: null, reason: null, custom: false };
  toast(crossSchool ? '⭐ 다른 학교 사건과 이었어요! 멋져요!' : '🧵 실을 이었어요! 또 이어 볼까?');
  lastKey = '';
  render();
}

// ───────────── 클릭 처리 ─────────────
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act],[data-key],[data-team],[data-card],[data-main],[data-blank],[data-chip],[data-to],[data-word],[data-reason]');
  if (!b || b.disabled) return;
  const d = b.dataset;
  const rerender = () => { lastKey = ''; render(); };

  if (d.key) return pressKey(d.key);
  if (d.team) { enterRoom(ui.joinCode, d.team); return; }
  if (d.card) return toggleCard(d.card);
  if (d.main) return update({ mainCause: d.main });
  if (d.blank) { ui.blank = d.blank; ui.custom = null; return rerender(); }
  if (d.chip) return chooseBlank(ui.blank, d.chip, false);
  if (d.to) { ui.link.to = Number(d.to); return rerender(); }
  if (d.word) { ui.link.word = d.word; return rerender(); }
  if (d.reason) { ui.link.reason = d.reason; ui.link.custom = false; return rerender(); }

  const t = team();
  switch (d.act) {
    case 'backCode': ui.join = 'code'; ui.joinCode = ''; renderJoin(); break;
    case 'leave': leaveRoom(); break;
    case 'reset': location.reload(); break;
    case 'openEnv':
      b.classList.add('opening');
      setTimeout(() => { ui.envOpen = true; ui.anim = true; rerender(); }, 450);
      break;
    case 'replay':
      ui.anim = true;
      if (lastKey.includes('"anim":true')) { const box = $('.anim-box'); if (box) box.innerHTML = caseAnimHtml(myCase().no); break; }
      rerender();
      break;
    case 'toArticle': ui.anim = false; rerender(); break;
    case 'readDone': update({ readDone: true, stage: 2 }); break;
    case 'article': ui.article = true; rerender(); break;
    case 'closeArticle': if (e.target === b) { ui.article = false; rerender(); } break;
    case 'prev': ui.envOpen = true; update({ stage: Math.max(1, stageOf(t) - 1) }); break;
    case 'next': {
      const s = stageOf(t);
      if (s === 3) ui.blank = 'where';
      if (s === 2) ui.blank = BLANKS.find((x) => !(t.sentences || {})[x]) || 'where';
      update({ stage: s + 1 });
      break;
    }
    case 'custom': ui.custom = ui.blank; rerender(); setTimeout(() => $('#customInput')?.focus(), 30); break;
    case 'customOk': {
      const v = ($('#customInput')?.value || '').trim().slice(0, 40);
      if (!v) return toast('빈칸에 들어갈 말을 써 주세요 ✏️');
      chooseBlank(ui.blank, v, true);
      break;
    }
    case 'pin':
      ui.pinning = true;
      rerender();
      setTimeout(async () => {
        await update({ pinnedAt: Date.now(), stage: 5 });
        ui.pinning = false;
        toast('📍 핀이 선생님 지도에 꽂혔어요!');
        rerender();
      }, 900);
      break;
    case 'reasonCustom': ui.link.custom = true; ui.link.reason = null; rerender(); setTimeout(() => $('#reasonInput')?.focus(), 30); break;
    case 'sendLink': sendLink(); break;
  }
});

document.addEventListener('keydown', (e) => {
  if (teamId || ui.join !== 'code') return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('⌫');
  else if (e.key === 'Enter') pressKey('확인');
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'customInput') $('[data-act="customOk"]')?.click();
});
