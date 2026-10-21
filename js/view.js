// 참관용 (읽기 전용 지도 + 진행 현황)
import { getBackend } from './store.js';
import { CONFIG } from './config.js';
import { loadData, helpers, $, esc, connBanner, watchConnection, modeBadge, CAUSE_EMOJI, teamSentences } from './common.js';
import { createMap, fitMap } from './map.js';

const PHASE_LABEL = { intro: '도입', guide: '활동 안내', investigate: '① 사건 수사', tour: '② 지도 투어', colors: '🎨 색깔 발견', links: '③ 연결의 실', wrap: '정리' };

const { content: C, pins: P } = await loadData();
const H = helpers(C);
const backend = await getBackend();
let room = null;

if (!backend) connBanner(true, { failed: true });
else {
  watchConnection(backend);
  $('#modeBadge').innerHTML = modeBadge(backend);
  const code = new URLSearchParams(location.search).get('code');
  if (code && /^\d{4}$/.test(code)) start(code);
  else askCode();
}

function askCode() {
  $('#main').innerHTML = `<form class="paper v-ask" id="f"><h2>수업 코드 4자리</h2><input id="c" inputmode="numeric" maxlength="4"><button class="btn">보기</button></form>`;
  $('#f').onsubmit = (e) => { e.preventDefault(); location.search = '?code=' + $('#c').value.trim(); };
}

function start(code) {
  $('#codeText').textContent = code;
  const map = createMap($('#map'), { content: C, pins: P, onPinClick: showCard });
  fitMap($('#map'), $('#mapArea'));
  backend.subscribe(code, (r) => {
    room = r;
    if (!r) { $('#side').innerHTML = '<p>수업 방이 없어요. 코드를 확인해 주세요.</p>'; return; }
    const s = r.state || {};
    $('#phaseText').textContent = PHASE_LABEL[s.phase] || '-';
    map.update(r, { focusColor: s.phase === 'colors' ? s.colorFocus : '', showLinks: s.phase === 'links' || s.phase === 'wrap' });
    renderSide();
  });
}

function renderSide() {
  const teams = room?.teams || {};
  const links = Object.values(room?.links || {});
  $('#side').innerHTML = `
    <h2>팀별 진행</h2>
    <div class="trows">${C.presentationOrder.map((id) => {
      const tm = H.teamById(id);
      const t = teams[id];
      const stage = !t ? 0 : t.pinnedAt > 0 ? 5 : t.stage || 1;
      return `<div class="trow ${backend.isOnline(t) ? 'online' : ''} ${stage === 5 ? 'pinned' : ''}">
        <span class="dot"></span><span class="tname"><b>${esc(tm.name)}</b><small>No.${tm.caseNo} ${esc(H.caseByNo(tm.caseNo).short)}</small></span>
        <span class="lights">${[1, 2, 3, 4].map((s) => `<span class="light ${stage > s || stage === 5 ? 'done' : stage === s ? 'now' : ''}">${'①②③④'[s - 1]}</span>`).join('')}</span></div>`;
    }).join('')}</div>
    <div class="goal"><div class="goal-text">우리 모두의 연결 <b>${links.length}</b>개 / 목표 ${CONFIG.linkGoal}개</div><div class="bar"><span style="width:${Math.min(100, (links.length / CONFIG.linkGoal) * 100)}%"></span></div></div>
    <p class="muted">핀을 누르면 팀의 세 문장을 볼 수 있어요.</p>`;
}

function showCard(no) {
  let html;
  if (no === 0) {
    html = `<h2>★ ${esc(C.example.title)}</h2><ol class="cc-sent">${C.example.sentences.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  } else {
    const tm = H.teamByCase(no);
    const t = room?.teams?.[tm.id] || {};
    html = `<h2>No.${no} ${esc(H.caseByNo(no).title)}</h2><p>${esc(tm.name)} · ${CAUSE_EMOJI[t.mainCause] || ''} ${esc(C.causes[t.mainCause]?.name || '')}</p><ol class="cc-sent">${teamSentences(C, t).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  }
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal"><button class="close">✕</button>${html}</div>`;
  back.onclick = (e) => { if (e.target === back || e.target.classList.contains('close')) back.remove(); };
  document.body.appendChild(back);
}
