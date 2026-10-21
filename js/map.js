// 세계지도 + 핀 + 연결의 실 (교사·참관·학생 화면 공용)
import { asset, esc, helpers } from './common.js';

const W = 3000, H = 1560;

export function createMap(el, { content, pins, onPinClick, mini = false, showLabels = true }) {
  const H_ = helpers(content);
  el.classList.add('map');
  if (mini) el.classList.add('mini');
  el.innerHTML = `
    <img class="map-img" src="${asset('assets/world_map.png')}" alt="세계지도" draggable="false">
    <svg class="map-links" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>
    <div class="map-pins"></div>`;
  const svg = el.querySelector('svg');
  const layer = el.querySelector('.map-pins');
  const pos = (no) => pins.pins.find((p) => p.id === no);

  const pinEls = new Map();
  const linkEls = new Map();
  let first = true;

  function placePin(node, no) {
    const p = pos(no);
    node.style.left = p.x * 100 + '%';
    node.style.top = p.y * 100 + '%';
  }

  // ★ 예시 핀은 처음부터 표시
  const star = document.createElement('button');
  star.className = 'pin star';
  star.innerHTML = `<span class="pin-head">★</span>${showLabels ? '<span class="pin-label">예시 · 가뭄</span>' : ''}`;
  placePin(star, 0);
  star.onclick = () => onPinClick?.(0);
  layer.appendChild(star);
  pinEls.set(0, star);

  function update(room, opts = {}) {
    const teams = room?.teams || {};
    const { focusColor = '', showLinks = false, highlight = [], visibleCases = null } = opts;

    for (const team of content.teams) {
      const t = teams[team.id];
      const no = team.caseNo;
      const pinned = t && t.pinnedAt > 0 && (!visibleCases || visibleCases.includes(no));
      let node = pinEls.get(no);
      if (pinned && !node) {
        node = document.createElement('button');
        node.className = 'pin';
        const c = H_.caseByNo(no);
        node.innerHTML = `<span class="pin-head"></span>${showLabels ? `<span class="pin-label">${esc(c.short)}<small>${esc(team.name)}</small></span>` : ''}`;
        placePin(node, no);
        node.onclick = () => onPinClick?.(no);
        const fresh = Date.now() - t.pinnedAt < 10000;
        if (!first || fresh) node.classList.add('drop');
        layer.appendChild(node);
        pinEls.set(no, node);
      } else if (!pinned && node) {
        node.remove();
        pinEls.delete(no);
        node = null;
      }
      if (node) {
        const color = content.causes[t.mainCause]?.color || '#1F3B4D';
        node.style.setProperty('--pin', color);
        node.classList.toggle('dim', !!focusColor && t.mainCause !== focusColor);
      }
    }
    star.classList.toggle('dim', !!focusColor && content.example.cause !== focusColor);
    for (const [no, node] of pinEls) node.classList.toggle('hl', highlight.includes(no));

    // 연결의 실
    const links = showLinks ? Object.entries(room?.links || {}) : [];
    const keep = new Set(links.map(([id]) => id));
    for (const [id, g] of linkEls) if (!keep.has(id)) { g.remove(); linkEls.delete(id); }
    const pairCount = {};
    links.sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
    for (const [id, l] of links) {
      const key = [l.fromCaseNo, l.toCaseNo].sort().join('-');
      const k = (pairCount[key] = (pairCount[key] || 0) + 1) - 1;
      if (linkEls.has(id)) continue;
      const a = pos(l.fromCaseNo), b = pos(l.toCaseNo);
      if (!a || !b) continue;
      const g = drawLink(a, b, k, l, !first);
      svg.appendChild(g);
      linkEls.set(id, g);
    }
    first = false;
  }

  function drawLink(a, b, k, l, animate) {
    const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; } // 위로 휘게
    const bend = len * (0.22 + 0.12 * k) * (k % 2 ? -1 : 1);
    const cx = mx + nx * bend, cy = my + ny * bend;
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'link' + (l.crossSchool ? ' cross' : ''));
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${ax},${ay} Q${cx},${cy} ${bx},${by}`);
    g.appendChild(path);
    const tx = 0.25 * ax + 0.5 * cx + 0.25 * bx, ty = 0.25 * ay + 0.5 * cy + 0.25 * by;
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', tx);
    label.setAttribute('y', ty);
    label.textContent = (l.crossSchool ? '⭐ ' : '') + (l.word || '');
    g.appendChild(label);
    if (animate) {
      requestAnimationFrame(() => {
        const L = path.getTotalLength();
        path.style.strokeDasharray = L;
        path.style.strokeDashoffset = L;
        label.style.opacity = 0;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 1.2s ease-out';
        path.style.strokeDashoffset = 0;
        setTimeout(() => { label.style.transition = 'opacity .4s'; label.style.opacity = 1; }, 1000);
        setTimeout(() => { path.style.strokeDasharray = ''; }, 1400);
      });
    }
    return g;
  }

  return { update, el };
}

// 지도를 주어진 상자 안에 비율을 지켜 꽉 맞춥니다
export function fitMap(mapEl, boxEl) {
  const fit = () => {
    const bw = boxEl.clientWidth, bh = boxEl.clientHeight;
    const w = Math.min(bw, bh * (W / H));
    mapEl.style.width = w + 'px';
    mapEl.style.height = w * (H / W) + 'px';
  };
  new ResizeObserver(fit).observe(boxEl);
  fit();
}
