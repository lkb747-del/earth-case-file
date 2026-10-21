// 교사 대시보드 (화면 공유용)
import { getBackend, defaultState, emptyRoom } from './store.js';
import { CONFIG } from './config.js';
import { loadData, helpers, $, esc, icon, toast, connBanner, watchConnection, modeBadge, asset, CAUSE_EMOJI, fmtTime, timerRemain, teamSentences, download } from './common.js';
import { createMap, fitMap } from './map.js';
import { playIntro } from './intro.js';
import { caseAnimHtml } from './caseAnim.js';

const ROOM_KEY = 'gcf:teacherRoom';
const PHASE_LABEL = { intro: '도입', guide: '활동 안내', investigate: '① 사건 수사', tour: '② 지도 투어', colors: '🎨 색깔 발견', links: '③ 연결의 실', wrap: '정리' };
const STEP_SHORT = ['읽기', '원인', '문장', '핀'];
// 학생 입장 주소 (assets/student_qr.png 가 이 주소를 담고 있습니다)
const STUDENT_URL = 'https://lkb747-del.github.io/earth-case-file/';

let C, P, H, backend, map;
let code = '', room = null, unsub = null;
const ui = { pinCard: null, showRiddle: false, ox: {}, lastPhase: '' };

// ───────────── 비밀번호 ─────────────
if (sessionStorage.getItem('gcf:teacher') === 'ok') start();
else {
  $('#gate').hidden = false;
  $('#pw').focus();
  $('#gateForm').onsubmit = (e) => {
    e.preventDefault();
    if ($('#pw').value === CONFIG.teacherPassword) {
      sessionStorage.setItem('gcf:teacher', 'ok');
      $('#gate').hidden = true;
      start();
    } else { toast('비밀번호가 달라요'); $('#pw').value = ''; }
  };
}

async function start() {
  $('#top').hidden = false;
  $('#main').hidden = false;
  ({ content: C, pins: P } = await loadData());
  H = helpers(C);
  backend = await getBackend();
  if (!backend) { connBanner(true, { failed: true }); return; }
  watchConnection(backend);
  $('#modeBadge').innerHTML = modeBadge(backend);
  $('#phases').innerHTML = C.timeline.map((t) => `<button class="phase" data-phase="${t.phase}" title="${esc(t.label)} (${t.from}~${t.to}분)">${PHASE_LABEL[t.phase]}</button>`).join('');

  map = createMap($('#map'), { content: C, pins: P, onPinClick: (no) => { ui.pinCard = no; renderOverlay(); } });
  fitMap($('#map'), $('#mapArea'));

  let saved = localStorage.getItem(ROOM_KEY);
  try { if (!saved || !(await backend.roomExists(saved))) saved = await newRoom(); } catch { connBanner(true); }
  openRoom(saved);
  setInterval(tick, 250);
}

async function newRoom() {
  let c;
  for (let i = 0; i < 20; i++) {
    c = String(Math.floor(1000 + Math.random() * 9000));
    if (!(await backend.roomExists(c))) break;
  }
  await backend.createRoom(c);
  localStorage.setItem(ROOM_KEY, c);
  return c;
}

function openRoom(c) {
  code = c;
  $('#codeText').textContent = code;
  unsub?.();
  unsub = backend.subscribe(code, (r) => {
    if (!r) return; // 지워진 경우 newRoom()이 곧 다시 만듭니다
    room = r;
    render();
  });
}

const st = () => room?.state || defaultState();
const setState = (patch) => backend.updateState(code, patch).catch(() => connBanner(true));

// ───────────── 그리기 ─────────────
function render() {
  const s = st();
  if (s.phase !== ui.lastPhase) {
    ui.showRiddle = s.phase === 'wrap';
    ui.lastPhase = s.phase;
  }
  document.querySelectorAll('.phase').forEach((b) => b.classList.toggle('on', b.dataset.phase === s.phase));
  // 주의: body에 data-phase를 쓰면 빈 곳 클릭이 단계 버튼으로 잡혀 타이머가 초기화됩니다
  document.body.dataset.currentPhase = s.phase;

  const tourTeam = s.phase === 'tour' && s.tourTeamId ? H.teamById(s.tourTeamId) : null;
  map.update(room, {
    focusColor: s.phase === 'colors' ? s.colorFocus : '',
    showLinks: s.phase === 'links' || s.phase === 'wrap',
    highlight: tourTeam ? [tourTeam.caseNo] : s.phase === 'guide' ? [0] : [],
  });
  renderSide();
  renderOverlay();
  tick();
}

function teamStage(t) {
  if (!t) return 0;
  return t.pinnedAt > 0 ? 5 : t.stage || 1;
}

function statusRows() {
  const teams = room?.teams || {};
  return C.presentationOrder.map((id) => {
    const tm = H.teamById(id);
    const t = teams[id];
    const stage = teamStage(t);
    const online = backend.isOnline(t);
    const color = t?.pinnedAt > 0 ? C.causes[t.mainCause]?.color : '';
    return `
      <div class="trow ${online ? 'online' : ''} ${stage === 5 ? 'pinned' : ''}">
        <span class="dot" title="${online ? '접속 중' : '접속 안 됨'}"></span>
        <span class="tname"><b>${esc(tm.name)}</b><small>No.${tm.caseNo} ${esc(H.caseByNo(tm.caseNo).short)}</small></span>
        <span class="lights">${STEP_SHORT.map((n, i) => {
          const s = i + 1;
          const cls = stage > s || stage === 5 ? 'done' : stage === s ? 'now' : '';
          return `<span class="light ${cls}" title="${n}">${'①②③④'[i]}</span>`;
        }).join('')}</span>
        <span class="pinmark" style="${color ? `background:${color}` : ''}">${stage === 5 ? '📍' : ''}</span>
      </div>`;
  }).join('');
}

function renderSide() {
  const s = st();
  const teams = room?.teams || {};
  const pinnedCount = Object.values(teams).filter((t) => t.pinnedAt > 0).length;
  const onlineCount = C.teams.filter((t) => backend.isOnline(teams[t.id])).length;
  const links = Object.entries(room?.links || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  let html = '';

  if (s.phase === 'intro' || s.phase === 'guide' || s.phase === 'investigate') {
    html = `
      ${s.phase === 'intro' ? '<button class="btn gold wide big" data-act="opening">🎬 오프닝 애니메이션 보기</button>' : ''}
      <h2>${s.phase === 'investigate' ? '🔎 팀별 수사 진행' : '📡 접속 현황'}</h2>
      <div class="summary"><span>접속 <b>${onlineCount}</b>/7</span><span>핀 <b>${pinnedCount}</b>/7</span></div>
      <div class="trows">${statusRows()}</div>
      ${s.phase === 'intro' ? `<button class="btn ghost wide" data-act="riddle">❓ 수수께끼 질문 ${ui.showRiddle ? '닫기' : '보기'}</button>` : ''}
      ${s.phase === 'guide' ? '<button class="btn gold wide" data-pin="0">★ 예시 핀 크게 보기 (시범)</button>' : ''}
      ${s.phase !== 'investigate' ? `
        <button class="join-qr" data-act="qrBig" title="크게 보기">
          <img src="${asset('assets/student_qr.png')}" alt="학생 입장 QR">
          <span>📱 학생 입장<br>QR 찍고 → 코드 <b>${code}</b><small>눌러서 크게 보기</small></span>
        </button>` : ''}`;
  } else if (s.phase === 'tour') {
    html = `
      <h2>🗺️ 지도 투어 <small>발표 순서</small></h2>
      <div class="tour-list">
        ${C.presentationOrder.map((id, i) => {
          const tm = H.teamById(id);
          const t = teams[id];
          return `<button class="tour-btn ${s.tourTeamId === id ? 'on' : ''} ${t?.pinnedAt > 0 ? '' : 'nopin'}" data-tour="${id}" style="--c:${C.causes[t?.mainCause]?.color || '#999'}">
            <span class="order">${i + 1}</span><b>${esc(tm.name)}</b><small>${esc(H.caseByNo(tm.caseNo).short)}</small></button>`;
        }).join('')}
      </div>
      <p class="muted">누르면 그 팀 카드가 크게 뜨고 ${CONFIG.tourSeconds}초 타이머가 돌아요.</p>`;
  } else if (s.phase === 'colors') {
    const count = { red: 0, orange: 0, purple: 0 };
    Object.values(teams).forEach((t) => { if (t.pinnedAt > 0 && count[t.mainCause] != null) count[t.mainCause]++; });
    html = `
      <h2>🎨 색깔 발견</h2>
      <div class="color-list">
        ${Object.entries(C.causes).map(([k, c]) => `
          <button class="color-btn ${s.colorFocus === k ? 'on' : ''}" data-color="${k}" style="--c:${c.color};--cl:${c.light}">
            <span class="cnum">${count[k]}</span><span><b>${CAUSE_EMOJI[k]} ${esc(c.name)}</b><small>${esc(c.sub)}</small></span>
          </button>`).join('')}
      </div>
      <button class="btn ghost wide" data-color="">모두 보기</button>
      <p class="muted">★ 예시(가뭄)는 🔴 기후변화예요.</p>`;
  } else if (s.phase === 'links') {
    html = `
      <h2>🧵 연결의 실</h2>
      ${goalHtml(links.length)}
      <button class="btn ${s.linksOpen ? 'red' : 'teal'} wide" data-act="toggleLinks">${s.linksOpen ? '🔒 학생 연결 닫기' : '🔓 학생 연결 열기'}</button>
      <div class="link-list">${links.map(([id, l]) => linkItem(id, l)).join('') || '<p class="muted">아직 이어진 실이 없어요</p>'}</div>`;
  } else if (s.phase === 'wrap') {
    const steps = ['질문', '단서 1', '단서 2', '결론'];
    html = `
      <h2>🧩 수수께끼</h2>
      <div class="reveal-btns">${steps.map((n, i) => `<button class="btn ${s.revealStep >= i ? 'teal' : 'ghost'}" data-reveal="${i}">${n}</button>`).join('')}</div>
      <button class="btn ghost wide" data-act="riddle">${ui.showRiddle ? '🗺️ 지도 보기 (연결의 실)' : '🧩 수수께끼 보기'}</button>
      <h2>⭕ O/X 퀴즈</h2>
      ${C.oxQuiz.map((q, i) => `
        <div class="ox paper">
          <p>${esc(q.q)}</p>
          ${ui.ox[i] ? `<p class="ox-a">정답: <b>${esc(q.a)}</b> — ${esc(q.explain)}</p>` : `<button class="btn small gold" data-ox="${i}">정답 공개</button>`}
        </div>`).join('')}
      ${goalHtml(links.length)}`;
  }
  $('#side').innerHTML = html;
}

function goalHtml(n) {
  const goal = CONFIG.linkGoal;
  return `<div class="goal"><div class="goal-text">우리 모두의 연결 <b>${n}</b>개 / 목표 ${goal}개 ${n >= goal ? '🎉' : ''}</div><div class="bar"><span style="width:${Math.min(100, (n / goal) * 100)}%"></span></div></div>`;
}

function linkItem(id, l) {
  const from = H.teamById(l.fromTeamId);
  const a = H.caseByNo(l.fromCaseNo), b = H.caseByNo(l.toCaseNo);
  return `
    <div class="link-item ${l.crossSchool ? 'cross' : ''}">
      <div><b>${l.crossSchool ? '⭐ ' : ''}${esc(a?.short)} ↔ ${esc(b?.short)}</b> <span class="word">${esc(l.word)}</span></div>
      <small>${esc(from?.name || '')} · ${esc(l.reason)}</small>
      <button class="del" data-dellink="${id}" title="지우기">✕</button>
    </div>`;
}

// 지도 위에 크게 띄우는 카드들
function caseCardHtml(no, { big = false, anim = false } = {}) {
  if (no === 0) {
    const ex = C.example;
    return `
      <div class="case-card ${big ? 'big' : ''}" style="--c:${C.causes[ex.cause].color}">
        <div class="cc-head"><span class="cc-no">★ 예시</span><h2>${esc(ex.title)}</h2></div>
        <p class="cc-place">📍 ${esc(ex.place)}</p>
        <ol class="cc-sent">${ex.sentences.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <p class="cc-cause">${CAUSE_EMOJI[ex.cause]} ${esc(C.causes[ex.cause].name)}</p>
      </div>`;
  }
  const tm = H.teamByCase(no);
  const t = room?.teams?.[tm.id] || {};
  const c = H.caseByNo(no);
  const cause = C.causes[t.mainCause];
  return `
    <div class="case-card ${big ? 'big' : ''}" style="--c:${cause?.color || '#1F3B4D'}">
      <div class="cc-head"><span class="cc-no">No.${no}</span><h2>${c.icons.map(icon).join('')} ${esc(c.title)}</h2></div>
      <p class="cc-team"><b>${esc(tm.name)}</b> 탐정단 · ${esc(tm.school)}</p>
      ${anim ? `<div class="cc-anim">${caseAnimHtml(no)}</div>` : ''}
      ${t.pinnedAt > 0
        ? `<ol class="cc-sent">${teamSentences(C, t).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
           <p class="cc-cause">${CAUSE_EMOJI[t.mainCause] || ''} ${esc(cause?.name || '')}</p>`
        : '<p class="muted">아직 핀을 꽂지 않았어요</p>'}
    </div>`;
}

function renderOverlay() {
  const s = st();
  const ov = $('#overlay');
  let html = '';
  if (s.phase === 'tour' && s.tourTeamId) {
    const tm = H.teamById(s.tourTeamId);
    const idx = C.presentationOrder.indexOf(s.tourTeamId);
    const next = C.presentationOrder[idx + 1];
    html = `
      <div class="ov tour">
        ${caseCardHtml(tm.caseNo, { big: true, anim: true })}
        <div class="tour-ctrl">
          <div class="ring" id="tourRing"><span id="tourText">${CONFIG.tourSeconds}</span></div>
          <button class="btn ghost" data-tour="${s.tourTeamId}">↺ 다시</button>
          ${next ? `<button class="btn teal" data-tour="${next}">다음 팀 ▶</button>` : ''}
          <button class="btn ghost" data-act="closeTour">닫기</button>
        </div>
      </div>`;
  } else if (ui.showRiddle && (s.phase === 'wrap' || s.phase === 'intro')) {
    const r = C.riddle;
    const step = s.phase === 'intro' ? 0 : s.revealStep || 0;
    html = `
      <div class="ov riddle">
        <div class="riddle-box paper">
          <img src="${asset('assets/earth_mascot.png')}" alt="" class="riddle-mascot">
          <p class="rq">❓ ${esc(r.question)}</p>
          <div class="clues">
            ${r.clues.map((c, i) => `<div class="clue ${step >= i + 1 ? 'show' : ''}" style="--c:${C.causes[c.cause].color}"><b>${esc(c.title)}</b><p>${step >= i + 1 ? esc(c.text) : '🔒'}</p></div>`).join('')}
          </div>
          ${step >= 3 ? `<p class="conclusion">💡 ${esc(r.conclusion)}</p>` : ''}
        </div>
      </div>`;
  }
  if (ui.qrBig) {
    html += `
      <div class="ov qrbig" data-act="qrClose">
        <div class="qr-box paper">
          <img src="${asset('assets/student_qr.png')}" alt="학생 입장 QR">
          <div>
            <h2>📱 학생 입장</h2>
            <p>① QR을 찍거나 주소를 열어요</p>
            <p class="qr-url">${esc(STUDENT_URL.replace('https://', ''))}</p>
            <p>② 수업 코드를 눌러요</p>
            <p class="qr-code">${code}</p>
          </div>
        </div>
      </div>`;
  }
  if (ui.pinCard != null) {
    const no = ui.pinCard;
    const tm = no ? H.teamByCase(no) : null;
    html += `
      <div class="ov pincard" data-act="closePin">
        <div class="pin-modal">
          <button class="close" data-act="closePin">✕</button>
          ${caseCardHtml(no, { big: true })}
          ${tm && room?.teams?.[tm.id]?.pinnedAt > 0 ? `<button class="btn ghost small" data-unpin="${tm.id}">↩ 이 팀 핀 다시 꽂게 하기</button>` : ''}
        </div>
      </div>`;
  }
  // 내용이 같으면 다시 그리지 않음 (애니메이션이 처음부터 다시 시작되지 않게)
  if (ov.dataset.html === html) return;
  ov.dataset.html = html;
  ov.innerHTML = html;
}

// ───────────── 타이머 ─────────────
function tick() {
  if (!room) return;
  const s = st();
  const left = timerRemain(s, backend.now());
  const el = $('#timerText');
  el.textContent = fmtTime(left);
  el.classList.toggle('over', !s.timerPaused && left <= 0);
  el.classList.toggle('paused', !!s.timerPaused);
  $('#timerToggle').textContent = s.timerPaused ? '▶' : '⏸';

  const tt = $('#tourText');
  if (tt) {
    const l = Math.max(0, (s.tourEndsAt || 0) - backend.now());
    tt.textContent = Math.ceil(l / 1000);
    const ring = $('#tourRing');
    ring.style.setProperty('--p', (l / (CONFIG.tourSeconds * 1000)) * 100);
    ring.classList.toggle('over', l <= 0);
  }
  // 데모 모드에서 접속 표시 갱신 (5초마다)
  if (Date.now() % 5000 < 250 && backend.kind === 'demo') renderSide();
}

function phaseMinutes(p) {
  const t = C.timeline.find((x) => x.phase === p);
  return t ? t.to - t.from : 5;
}

// ───────────── 관리 메뉴 ─────────────
function openAdmin() {
  const studentUrl = new URL('../', location.href).href;
  const viewUrl = new URL('../view/?code=' + code, location.href).href;
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal admin">
      <button class="close" data-x>✕</button>
      <h2>⚙️ 관리</h2>
      <p>수업 코드 <b class="big-code">${code}</b> ${modeBadge(backend)}</p>
      <p class="url">학생 주소: <code>${esc(studentUrl)}</code></p>
      <p class="url">참관용 주소: <code>${esc(viewUrl)}</code></p>
      ${backend.kind === 'demo' ? '<p class="warn">데모 모드: 이 기기의 다른 탭에서만 함께 보입니다. 학생 화면은 새 탭에서 열어 시험해 보세요.</p>' : ''}
      <div class="admin-btns">
        <button class="btn gold" data-a="fake">🎭 리허설용 가짜 데이터 채우기</button>
        <button class="btn" data-a="export">💾 결과 내보내기 (JSON)</button>
        <button class="btn ghost" data-a="reset">🧹 데이터 초기화 (코드 유지)</button>
        <button class="btn ghost" data-a="newcode">🔢 새 수업 코드 만들기</button>
        <button class="btn red" data-a="end">🗑️ 수업 끝 · 방 데이터 지우기</button>
        <button class="btn ghost" data-a="openStudent">👩‍🎓 학생 화면 새 탭으로 열기</button>
        <button class="btn ghost" data-a="logout">🔒 교사 화면 잠그기</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  back.onclick = async (e) => {
    if (e.target === back || e.target.dataset.x !== undefined) return back.remove();
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'fake') { back.remove(); fillFake(); }
    if (a === 'export') exportJson();
    if (a === 'reset' && confirm('모든 팀 진행과 연결을 지울까요? (수업 코드는 그대로)')) { await backend.setRoom(code, emptyRoom()); back.remove(); toast('초기화했어요'); }
    if (a === 'newcode' && confirm('새 수업 코드를 만들까요? 학생들은 새 코드로 다시 들어와야 해요.')) { openRoom(await newRoom()); back.remove(); }
    if (a === 'end' && confirm('수업 데이터를 모두 지울까요? 먼저 결과 내보내기를 해 두면 좋아요.')) {
      await backend.deleteRoom(code);
      openRoom(await newRoom());
      back.remove();
      toast('방 데이터를 지우고 새 코드를 만들었어요');
    }
    if (a === 'openStudent') window.open(studentUrl, '_blank');
    if (a === 'logout') { sessionStorage.removeItem('gcf:teacher'); location.reload(); }
  };
}

function fillFake() {
  toast('🎭 7팀이 차례로 핀을 꽂아요…');
  C.presentationOrder.forEach((id, i) => {
    const tm = H.teamById(id);
    const c = H.caseByNo(tm.caseNo);
    setTimeout(() => backend.updateTeam(code, id, {
      online: true, lastSeen: Date.now(), stage: 5, readDone: true,
      cardIds: c.expectedCardIds, mainCause: c.mainCause,
      sentences: {
        where: c.sentenceChoices.where[0], problem: c.sentenceChoices.problem[0], link: c.sentenceChoices.link[0],
        customFlags: { where: false, problem: false, link: false },
      },
      pinnedAt: Date.now(),
    }), i * 600);
  });
  C.expectedLinks.slice(0, 5).forEach((l, i) => {
    setTimeout(() => {
      const from = H.teamByCase(l.from);
      backend.pushLink(code, {
        fromTeamId: from.id, fromCaseNo: l.from, toCaseNo: l.to, word: l.word, reason: l.reason,
        crossSchool: from.school !== H.schoolOfCase(l.to), at: Date.now(),
      });
    }, 4500 + i * 700);
  });
}

function exportJson() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const out = {
    exportedAt: d.toISOString(), roomCode: code,
    teams: C.presentationOrder.map((id) => {
      const tm = H.teamById(id);
      const t = room?.teams?.[id] || {};
      return { id, name: tm.name, school: tm.school, caseNo: tm.caseNo, pinned: t.pinnedAt > 0, mainCause: t.mainCause || '', cardIds: t.cardIds || [], sentences: teamSentences(C, t), raw: t };
    }),
    links: Object.values(room?.links || {}),
    state: room?.state,
  };
  download(`지구촌사건파일_${code}_${stamp}.json`, JSON.stringify(out, null, 2));
}

// ───────────── 클릭 처리 ─────────────
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-phase],[data-act],[data-tour],[data-color],[data-reveal],[data-ox],[data-pin],[data-dellink],[data-unpin]');
  if (!b || !room) return;
  const d = b.dataset;
  const s = st();
  if (d.phase) {
    setState({
      phase: d.phase, timerPaused: true, timerEndsAt: 0, timerRemain: phaseMinutes(d.phase) * 60000,
      linksOpen: d.phase === 'links', colorFocus: '', tourTeamId: '', tourEndsAt: 0,
      revealStep: d.phase === 'wrap' ? 0 : s.revealStep || 0,
    });
    return;
  }
  if (d.tour) return setState({ tourTeamId: d.tour, tourEndsAt: backend.now() + CONFIG.tourSeconds * 1000 });
  if (d.color !== undefined) return setState({ colorFocus: s.colorFocus === d.color ? '' : d.color });
  if (d.reveal) { ui.showRiddle = true; return setState({ revealStep: Number(d.reveal) }); }
  if (d.ox) { ui.ox[d.ox] = true; return renderSide(); }
  if (d.pin) { ui.pinCard = Number(d.pin); return renderOverlay(); }
  if (d.dellink) { if (confirm('이 연결을 지울까요?')) backend.removeLink(code, d.dellink); return; }
  if (d.unpin) {
    if (confirm('이 팀이 핀을 다시 꽂을 수 있게 ④단계로 되돌릴까요?')) backend.updateTeam(code, d.unpin, { pinnedAt: 0, stage: 4 });
    ui.pinCard = null;
    return renderOverlay();
  }
  switch (d.act) {
    case 'timerToggle':
      if (s.timerPaused) setState({ timerPaused: false, timerEndsAt: backend.now() + (s.timerRemain || 0) });
      else setState({ timerPaused: true, timerRemain: Math.max(0, s.timerEndsAt - backend.now()) });
      break;
    case 'plus1':
      if (s.timerPaused) setState({ timerRemain: (s.timerRemain || 0) + 60000 });
      else setState({ timerEndsAt: Math.max(backend.now(), s.timerEndsAt) + 60000 });
      break;
    case 'timerReset': setState({ timerPaused: true, timerEndsAt: 0, timerRemain: phaseMinutes(s.phase) * 60000 }); break;
    case 'admin': openAdmin(); break;
    case 'opening': playIntro({ content: C, pins: P }); break;
    case 'qrBig': ui.qrBig = true; renderOverlay(); break;
    case 'qrClose': ui.qrBig = false; renderOverlay(); break;
    case 'toggleLinks': setState({ linksOpen: !s.linksOpen }); break;
    case 'closeTour': setState({ tourTeamId: '', tourEndsAt: 0 }); break;
    case 'riddle': ui.showRiddle = !ui.showRiddle; renderSide(); renderOverlay(); break;
    case 'closePin': if (e.target === b) { ui.pinCard = null; renderOverlay(); } break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.pinCard != null) { ui.pinCard = null; renderOverlay(); }
});
