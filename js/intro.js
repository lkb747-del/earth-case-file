// 도입용 오프닝 애니메이션 (교사 화면 → 화상회의 화면 공유)
// 장면: ① 어스 인사 → ② 지구 곳곳 사건 경보 → ③ 편지 도착 → ④ 수수께끼 → ⑤ 탐정단 출동
// 사실·수치는 content.json 문구만 그대로 씁니다. 말풍선 대사는 동기유발용 연출입니다.
import { asset, esc } from './common.js';

export function playIntro({ content: C, pins: P }) {
  const pos = (no) => P.pins.find((p) => p.id === no);
  const mascot = asset('assets/earth_mascot.png');
  const mapImg = asset('assets/world_map.png');

  const scenes = [
    {
      dur: 5000,
      html: () => `
        <img class="io-mascot io-enter" src="${mascot}" alt="지구 친구 어스">
        <div class="io-bubble io-pop" style="animation-delay:.9s">안녕, 탐정단! 나는 지구 친구 <b>어스</b>야 🌏</div>`,
    },
    {
      dur: 8000,
      html: () => `
        <div class="io-map-wrap">
          <div class="io-map">
            <img src="${mapImg}" alt="세계지도">
            ${C.cases.map((c, i) => {
              const p = pos(c.no);
              return `<div class="io-alarm" style="left:${p.x * 100}%;top:${p.y * 100}%;animation-delay:${1.2 + i * 0.55}s">
                <span class="io-ripple"></span><span class="mark">?</span><span class="tag">📁 No.${c.no}</span></div>`;
            }).join('')}
          </div>
        </div>
        <img class="io-mascot small io-worry" src="${mascot}" alt="">
        <div class="io-bubble small io-pop" style="animation-delay:.3s">그런데 요즘… 내 몸 여기저기에서<br><b>이상한 사건</b>이 일어나고 있어! 😰</div>`,
    },
    {
      dur: 7000,
      html: () => {
        const p = pos(0);
        const ex = C.example;
        return `
          <div class="io-map-wrap dim">
            <div class="io-map">
              <img src="${mapImg}" alt="세계지도">
              <div class="io-letter-at" style="left:${p.x * 100}%;top:${p.y * 100}%">
                <div class="io-envelope">✉️</div>
                <div class="io-star">★</div>
              </div>
            </div>
          </div>
          <div class="io-letter io-pop" style="animation-delay:2.1s">
            <p class="io-letter-head">📮 편지가 도착했어요!</p>
            <p class="io-letter-place">📍 ${esc(ex.place)}</p>
            <h2>${esc(ex.title)}</h2>
          </div>`;
      },
    },
    {
      dur: 9000,
      html: () => {
        const words = C.riddle.question.split(' ');
        return `
          <div class="io-riddle">
            <div class="io-q io-pop">?</div>
            <p class="io-riddle-text">${words.map((w, i) => `<span style="animation-delay:${0.8 + i * 0.28}s">${esc(w)}</span>`).join(' ')}</p>
            <p class="io-riddle-sub io-pop" style="animation-delay:${1.2 + words.length * 0.28}s">🔍 오늘 수사가 끝나면 풀 수 있어요!</p>
          </div>`;
      },
    },
    {
      dur: 0,
      html: () => `
        <div class="io-final">
          <h1 class="io-title io-pop">🕵️ ${esc(C.lesson.title)}</h1>
          <div class="io-stamp">수사 시작</div>
          <p class="io-goal io-pop" style="animation-delay:1.1s"><b>학습 문제</b> ${esc(C.lesson.goal)}</p>
          <div class="io-teams">
            ${C.presentationOrder.map((id, i) => {
              const t = C.teams.find((x) => x.id === id);
              return `<span class="io-team ${t.school === '의령초' ? '' : 'remote'}" style="animation-delay:${1.8 + i * 0.25}s">${esc(t.name)}</span>`;
            }).join('')}
          </div>
          <p class="io-go io-pop" style="animation-delay:${2.2 + C.teams.length * 0.25}s">7개 탐정단, 출동! 🚀</p>
        </div>`,
    },
  ];

  const root = document.createElement('div');
  root.className = 'intro';
  root.innerHTML = `
    <div class="io-stars"></div>
    <div class="io-stage"></div>
    <div class="io-ctrl">
      <button data-i="prev" title="이전 장면">◀</button>
      <button data-i="pause" title="멈춤/재생">⏸</button>
      <button data-i="next" title="다음 장면">▶</button>
      <span class="io-dots"></span>
      <button data-i="close" class="io-close">✕ 닫기</button>
    </div>`;
  document.body.appendChild(root);
  const stage = root.querySelector('.io-stage');
  const dots = root.querySelector('.io-dots');
  const pauseBtn = root.querySelector('[data-i="pause"]');

  let i = 0, timer = null, paused = false;
  function show(n) {
    i = Math.max(0, Math.min(scenes.length - 1, n));
    stage.innerHTML = `<div class="io-scene">${scenes[i].html()}</div>`;
    dots.innerHTML = scenes.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('');
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!paused && scenes[i].dur) timer = setTimeout(() => show(i + 1), scenes[i].dur);
  }
  function close() {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    root.classList.add('out');
    setTimeout(() => root.remove(), 400);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(i + 1); }
    else if (e.key === 'ArrowLeft') show(i - 1);
  }
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-i]')?.dataset.i;
    if (act === 'close') close();
    else if (act === 'prev') show(i - 1);
    else if (act === 'next') show(i + 1);
    else if (act === 'pause') { paused = !paused; pauseBtn.textContent = paused ? '▶︎ 재생' : '⏸'; root.classList.toggle('paused', paused); schedule(); }
    else if (e.target.closest('.io-stage')) { if (i === scenes.length - 1) close(); else show(i + 1); }
  });
  document.addEventListener('keydown', onKey);
  show(0);
}
