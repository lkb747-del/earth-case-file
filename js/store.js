// 실시간 저장소: Firebase Realtime Database 또는 localStorage 데모 모드
import { CONFIG } from './config.js';

const PREFIX = 'gcf:room:';
const FIREBASE_VERSION = '10.14.1';

export function defaultState() {
  return {
    phase: 'intro',
    timerEndsAt: 0,
    timerPaused: true,
    timerRemain: 8 * 60 * 1000,
    tourTeamId: '',
    tourEndsAt: 0,
    revealStep: 0,
    linksOpen: false,
    colorFocus: '',
    createdAt: Date.now(),
  };
}

export function emptyRoom() {
  return { state: defaultState(), teams: {}, links: {} };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

// ───────────── 데모 모드 (localStorage, 같은 기기의 탭끼리만 공유) ─────────────
class DemoBackend {
  constructor() {
    this.kind = 'demo';
    this.listeners = new Map();
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(PREFIX)) this._emit(e.key.slice(PREFIX.length));
    });
  }
  _read(code) {
    try { return JSON.parse(localStorage.getItem(PREFIX + code)); } catch { return null; }
  }
  _write(code, room) {
    if (room === null) localStorage.removeItem(PREFIX + code);
    else localStorage.setItem(PREFIX + code, JSON.stringify(room));
    this._emit(code);
  }
  _emit(code) {
    const room = this._read(code);
    (this.listeners.get(code) || new Set()).forEach((cb) => cb(room));
  }
  _mutate(code, fn) {
    const room = this._read(code);
    if (!room) return;
    room.teams = room.teams || {};
    room.links = room.links || {};
    fn(room);
    this._write(code, room);
  }
  async roomExists(code) { return !!this._read(code)?.state; }
  async createRoom(code) { this._write(code, emptyRoom()); }
  async setRoom(code, room) { this._write(code, room); }
  async deleteRoom(code) { this._write(code, null); }
  subscribe(code, cb) {
    const set = this.listeners.get(code) || new Set();
    set.add(cb);
    this.listeners.set(code, set);
    cb(this._read(code));
    return () => set.delete(cb);
  }
  async updateState(code, patch) { this._mutate(code, (r) => Object.assign(r.state, patch)); }
  async updateTeam(code, id, patch) {
    this._mutate(code, (r) => { r.teams[id] = { ...(r.teams[id] || {}), ...patch }; });
  }
  async pushLink(code, link) {
    const id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this._mutate(code, (r) => { r.links[id] = link; });
  }
  async removeLink(code, id) { this._mutate(code, (r) => { delete r.links[id]; }); }
  presence(code, id) {
    const beat = () => this.updateTeam(code, id, { online: true, lastSeen: Date.now() });
    beat();
    const t = setInterval(beat, 10000);
    window.addEventListener('pagehide', () => {
      clearInterval(t);
      this.updateTeam(code, id, { online: false, lastSeen: Date.now() });
    });
  }
  isOnline(team) { return !!team?.online && Date.now() - (team.lastSeen || 0) < 30000; }
  now() { return Date.now(); }
  onConnection(cb) { cb(true); }
}

// ───────────── Firebase Realtime Database ─────────────
class FirebaseBackend {
  constructor() { this.kind = 'firebase'; this.offset = 0; }
  async init(cfg) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [appMod, authMod, dbMod] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-database.js`),
    ]);
    this.f = dbMod;
    this.app = appMod.initializeApp(cfg);
    // 익명 로그인: 학생에게는 아무 화면도 뜨지 않습니다. 보안 규칙에서 '앱을 거쳐 온 사용자'만 허용하기 위한 것입니다.
    const auth = authMod.getAuth(this.app);
    await authMod.signInAnonymously(auth);
    this.db = this.f.getDatabase(this.app);
    // 기기마다 시계가 조금씩 달라도 타이머가 같게 보이도록 서버 시간 차이를 맞춥니다
    this.f.onValue(this.r('.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; });
  }
  now() { return Date.now() + this.offset; }
  r(path) { return this.f.ref(this.db, path); }
  async roomExists(code) {
    const snap = await withTimeout(this.f.get(this.r(`rooms/${code}/state`)), 8000);
    return snap.exists();
  }
  async createRoom(code) { await this.f.set(this.r(`rooms/${code}`), emptyRoom()); }
  async setRoom(code, room) { await this.f.set(this.r(`rooms/${code}`), room); }
  async deleteRoom(code) { await this.f.remove(this.r(`rooms/${code}`)); }
  subscribe(code, cb) { return this.f.onValue(this.r(`rooms/${code}`), (s) => cb(s.val())); }
  async updateState(code, patch) { await this.f.update(this.r(`rooms/${code}/state`), patch); }
  async updateTeam(code, id, patch) { await this.f.update(this.r(`rooms/${code}/teams/${id}`), patch); }
  async pushLink(code, link) { await this.f.push(this.r(`rooms/${code}/links`), link); }
  async removeLink(code, id) { await this.f.remove(this.r(`rooms/${code}/links/${id}`)); }
  presence(code, id) {
    const teamRef = this.r(`rooms/${code}/teams/${id}`);
    this.f.onValue(this.r('.info/connected'), (s) => {
      if (!s.val()) return;
      this.f.onDisconnect(this.r(`rooms/${code}/teams/${id}/online`)).set(false);
      this.f.update(teamRef, { online: true, lastSeen: this.now() });
    });
  }
  isOnline(team) { return !!team?.online; }
  onConnection(cb) {
    this.f.onValue(this.r('.info/connected'), (s) => cb(!!s.val()));
  }
}

// 설정에 따라 저장소를 고릅니다. Firebase 설정이 있는데 실패하면 null을 돌려줍니다.
export async function getBackend() {
  const params = new URLSearchParams(location.search);
  const forceDemo = params.has('demo') || sessionStorage.getItem('gcf:forceDemo') === '1';
  if (!CONFIG.firebaseConfig || forceDemo) return new DemoBackend();
  try {
    const fb = new FirebaseBackend();
    await withTimeout(fb.init(CONFIG.firebaseConfig), 10000);
    return fb;
  } catch (e) {
    console.warn('Firebase 연결 실패', e);
    // 익명 로그인을 켜지 않았을 때 가장 흔한 오류 → 선생님이 알아보기 쉽게 안내
    if (String(e?.code || e).includes('admin-restricted-operation') || String(e?.code || e).includes('operation-not-allowed')) {
      console.warn('👉 Firebase 콘솔 → Authentication → 로그인 방법 → "익명"을 사용 설정해 주세요.');
    }
    return null;
  }
}

export function useDemoAndReload() {
  sessionStorage.setItem('gcf:forceDemo', '1');
  location.reload();
}
