// 여러 화면이 함께 쓰는 도우미
import { useDemoAndReload } from './store.js';

export const BASE = new URL('../', import.meta.url).href;
export const asset = (p) => BASE + p;

export async function loadData() {
  const [content, pins] = await Promise.all([
    fetch(asset('data/content.json')).then((r) => r.json()),
    fetch(asset('data/map_pins.json')).then((r) => r.json()),
  ]);
  return { content, pins };
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// content.json의 아이콘 이름 → 이모지 (아이콘 라이브러리를 쓰지 않기 위해)
const ICONS = {
  GiCoral: '🐠', GiDoubleFish: '🐟', GiThermometerHot: '🌡️', GiBee: '🐝', GiStrawberry: '🍓',
  FaThermometerFull: '🌡️', GiForest: '🌳', GiFlame: '🔥', GiCow: '🐄', GiBackpack: '🎒',
  GiBrokenWall: '🧱', GiCampingTent: '⛺', GiSeaTurtle: '🐢', GiWaterBottle: '🧴', GiFishingNet: '🎣',
  GiDesert: '🏜️', GiSheep: '🐑', FaWind: '💨', GiWheat: '🌾', GiBread: '🍞', FaSun: '☀️',
  GiSunrise: '🥵', GiSpray: '🧪', FaIndustry: '🏭', FaFlag: '🚩', FaUsers: '👥',
};
export const icon = (name) => ICONS[name] || '';

export const CAUSE_EMOJI = { red: '🔴', orange: '🟠', purple: '🟣' };

export function helpers(content) {
  const teamById = (id) => content.teams.find((t) => t.id === id);
  const caseByNo = (no) => (no === 0 ? { ...content.example, no: 0, short: '편지 속 가뭄', isExample: true } : content.cases.find((c) => c.no === no));
  const teamByCase = (no) => content.teams.find((t) => t.caseNo === no);
  const cardById = (id) => content.causeCards.find((c) => c.id === id);
  // ★ 예시(편지 속 가뭄)는 의령초 선생님 것이므로 의령초로 봅니다.
  const schoolOfCase = (no) => (no === 0 ? '의령초' : teamByCase(no)?.school);
  return { teamById, caseByNo, teamByCase, cardById, schoolOfCase };
}

// 같은 팀이면 새로고침해도 같은 순서가 나오도록 하는 섞기
export function seededShuffle(arr, seedStr) {
  let h = 2166136261;
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 팀이 완성한 세 문장 (content.sentenceFrame 틀에 채워 넣기)
export function teamSentences(content, t) {
  const s = t?.sentences || {};
  const cause = (t?.cardIds || []).map((id) => content.causeCards.find((c) => c.id === id)?.text).filter(Boolean).join(' / ');
  const val = { '(어디)': s.where, '(어떤 문제)': s.problem, '(원인 카드)': cause, '(누구·무엇)': s.link };
  return content.sentenceFrame.map((line) => line.replace(/\((어디|어떤 문제|원인 카드|누구·무엇)\)/g, (m) => val[m] || m));
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function timerRemain(state, now = Date.now()) {
  if (!state) return 0;
  if (state.timerPaused) return state.timerRemain || 0;
  return Math.max(0, (state.timerEndsAt || 0) - now);
}

let toastTimer;
export function toast(msg, ms = 2400) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// 연결 끊김 / Firebase 실패 안내 (패들렛 백업 QR 포함)
export function connBanner(show, { failed = false } = {}) {
  let el = $('#connBanner');
  if (!show) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'connBanner';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="cb-box">
      <div class="cb-text">
        <b>${failed ? '⚠️ 실시간 연결에 실패했어요' : '📡 연결 중…'}</b>
        <p>${failed ? '인터넷이나 학교망을 확인해 주세요. 계속 안 되면 패들렛으로 함께해요!' : '잠깐만 기다려 주세요. 고른 내용은 연결되면 자동으로 보내져요.'}</p>
        <div class="cb-btns">
          ${failed ? '<button class="btn" data-act="retry">다시 시도</button><button class="btn ghost" data-act="demo">데모 모드로 시험하기</button>' : ''}
          <button class="btn ghost" data-act="hide">닫기</button>
        </div>
      </div>
      <figure><img src="${asset('assets/padlet_backup_qr.png')}" alt="패들렛 백업 QR"><figcaption>백업: 패들렛</figcaption></figure>
    </div>`;
  el.onclick = (e) => {
    const act = e.target.dataset.act;
    if (act === 'retry') location.reload();
    if (act === 'demo') useDemoAndReload();
    if (act === 'hide') el.remove();
  };
}

// Firebase 연결 상태를 지켜보다가 5초 넘게 끊기면 안내를 띄웁니다
export function watchConnection(backend) {
  let t;
  backend.onConnection((ok) => {
    clearTimeout(t);
    if (ok) connBanner(false);
    else t = setTimeout(() => connBanner(true), 5000);
  });
}

export function modeBadge(backend) {
  return backend.kind === 'demo'
    ? '<span class="badge demo" title="Firebase 없이 이 기기 안에서만 동작합니다">데모 모드</span>'
    : '<span class="badge live">실시간</span>';
}

export function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
