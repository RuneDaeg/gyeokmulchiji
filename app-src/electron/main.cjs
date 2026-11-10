// 격물치지 윈도우 앱 (마지막 고도화 3차 조각 1-③, 2026-11-03 사용자 "좋아" — Electron, 서명 없음, 합본만)
// · 앱 안에 합본 한 파일(app/index.html)을 담아 인터넷 없이도 켠다
// · 새 판(내용): 사이트의 version.json을 보고 새 판 파일을 받아 %APPDATA%/격물치지/content/<판>.html 에 두고, 다음에 켤 때 그 판으로 연다
//   늘 같은 주소(app://gyeokmul/)로 열어서 그림·보관함·학습지(브라우저 저장 칸)는 판이 바뀌어도 그대로다
//   새 판이 열리다 멈추면(90초 안에 앱이 서지 않으면) 그 판을 '나쁜 판'으로 적고 앞 판으로 다시 연다
// · 새 판(껍데기): 설치판은 electron-updater가 설치 파일을 뒤에서 받아 두었다가 앱을 닫을 때 조용히 설치. 바로실행판은 하지 않는다
const { app, BrowserWindow, Menu, shell, ipcMain, net, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SITE = process.env.JAKDO_SITE || 'https://draw.mathmckay.kr/'; // 검사할 때만 바꿔 씀
if (process.env.JAKDO_USERDATA) app.setPath('userData', process.env.JAKDO_USERDATA);
const BUNDLED = path.join(__dirname, '..', 'app');
const CONTENT = path.join(app.getPath('userData'), 'content');
const STATE = path.join(CONTENT, 'state.json');
const ORIGIN = 'app://gyeokmul/';
const LOG = path.join(app.getPath('userData'), 'start.log');
const log = (m) => { try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); if (fs.existsSync(LOG) && fs.statSync(LOG).size > 100000) fs.writeFileSync(LOG, ''); fs.appendFileSync(LOG, `${new Date().toISOString()} [${app.getVersion()}] ${m}\n`); } catch { /* 기록 못 해도 그만 */ } };

// 판 번호 비교 ('1.0.10' > '1.0.9')
const cmp = (a, b) => { const x = String(a).split('.').map((n) => parseInt(n, 10) || 0), y = String(b).split('.').map((n) => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; };
const VER_RE = /^\d+\.\d+\.\d+$/;
const readState = () => { try { const s = JSON.parse(fs.readFileSync(STATE, 'utf8')); return { bad: Array.isArray(s.bad) ? s.bad : [], trying: typeof s.trying === 'string' ? s.trying : '' }; } catch { return { bad: [], trying: '' }; } };
const writeState = (s) => { try { fs.mkdirSync(CONTENT, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s)); } catch { /* 다음에 */ } };

// 받아 둔 판 중 가장 새 판 (앱에 담긴 판보다 새것만, 나쁜 판은 빼고)
function pick() {
  const st = readState();
  // 지난번에 새 판을 열다가 확인 전에 꺼졌으면 그 판은 나쁜 판
  if (st.trying) { log('지난번 새 판이 서지 못함 → 나쁜 판 ' + st.trying); st.bad.push(st.trying); st.trying = ''; writeState(st); }
  let best = { ver: app.getVersion(), file: path.join(BUNDLED, 'index.html'), bundled: true };
  try {
    for (const f of fs.readdirSync(CONTENT)) {
      const v = f.replace(/\.html$/, '');
      if (!f.endsWith('.html') || !VER_RE.test(v) || st.bad.includes(v)) continue;
      if (cmp(v, best.ver) > 0) best = { ver: v, file: path.join(CONTENT, f), bundled: false };
    }
  } catch { /* 아직 받은 판 없음 */ }
  return best;
}
let current = null; // 지금 연 판 { ver, file, bundled }

// app://gyeokmul/ — 첫 화면은 고른 판, 그 밖의 파일(사용설명서 등)은 앱에 담긴 것
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function serve(req) {
  const u = new URL(req.url);
  let p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  if (!p || p === 'index.html') return net.fetch(pathToFileURL(current.file).href);
  const f = path.normalize(path.join(BUNDLED, p));
  if (!f.startsWith(BUNDLED + path.sep) || !fs.existsSync(f)) return new Response('없어요', { status: 404 });
  return net.fetch(pathToFileURL(f).href);
}

// ── 새 판(내용) 받기: 화면의 J.ui.update 가 jakdoApp.update.check() 로 부른다 ──
async function getJSON(url) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
  try { const r = await net.fetch(url, { cache: 'no-store', signal: ac.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
}
let checking = null;
async function checkContent() {
  const m = await getJSON(SITE + 'version.json');
  if (!m || !VER_RE.test(String(m.version || ''))) return null;
  if (cmp(m.version, current.ver) <= 0) return m; // 같은 판
  const dest = path.join(CONTENT, m.version + '.html');
  if (fs.existsSync(dest)) return m; // 이미 받아 둠
  const rel = m.files && typeof m.files.all === 'string' && /^[\w./-]+\.html$/.test(m.files.all) && !m.files.all.includes('..') ? m.files.all : 'download/gyeokmulchiji.html';
  let text = '';
  try { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 120000); const r = await net.fetch(SITE + rel, { cache: 'no-store', signal: ac.signal }); clearTimeout(t); if (r.ok) text = await r.text(); } catch { text = ''; }
  if (!/^\s*<!doctype html/i.test(text) || text.length < 200000 || !text.includes(m.version)) { log('새 판 받기 실패 ' + m.version); return null; }
  try {
    fs.mkdirSync(CONTENT, { recursive: true });
    fs.writeFileSync(dest + '.tmp', text, 'utf8'); fs.renameSync(dest + '.tmp', dest);
    // 받아 둔 판은 가장 새 두 개만 남긴다
    const olds = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.html') && VER_RE.test(f.slice(0, -5))).sort((a, b) => cmp(b.slice(0, -5), a.slice(0, -5))).slice(2);
    for (const f of olds) if (f !== path.basename(current.file)) fs.unlinkSync(path.join(CONTENT, f));
  } catch (e) { log('새 판 저장 실패 ' + e.message); return null; }
  log('새 판 받아 둠 ' + m.version);
  return m;
}
ipcMain.handle('upd:check', () => { if (!checking) checking = checkContent().finally(() => { checking = null; }); return checking; });
ipcMain.on('upd:booted', () => { const s = readState(); if (s.trying) { s.trying = ''; writeState(s); log('새 판 섬 ' + (current && current.ver)); } });
ipcMain.on('upd:restart', () => { log('새 판으로 다시 켜기'); app.relaunch(); app.exit(0); });
ipcMain.on('app:info', (e) => { e.returnValue = { shell: app.getVersion(), content: current ? current.ver : '', platform: process.platform, portable: !!process.env.PORTABLE_EXECUTABLE_FILE }; });

// 켤 때 껍데기가 스스로도 확인 (2026-11-10 사용자 "다시 시작할 때 업데이트 설치"): 그림 화면이 서지 못해도 새 판을 받아 두게
// 사용법 칸의 "새 판 저절로 확인"을 끈 사람은 건너뛴다 (화면의 저장 칸을 읽는다)
async function autoOn() {
  try { return (await win.webContents.executeJavaScript("localStorage.getItem('jakdo:updateAuto')")) !== 'false'; } catch { return true; }
}
function startupCheck() {
  setTimeout(async () => {
    if (!win || win.isDestroyed() || !(await autoOn())) return;
    if (!checking) checking = checkContent().finally(() => { checking = null; });
  }, 15000);
}

// ── 껍데기 새 판: 설치판만, 뒤에서 받아 두고 닫을 때 설치 ──
function shellUpdates() {
  if (!app.isPackaged || process.platform !== 'win32' || process.env.PORTABLE_EXECUTABLE_FILE) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.logger = null;
  autoUpdater.on('error', (e) => log('껍데기 새 판 확인 오류 ' + String((e && e.message) || e).split('\n')[0].slice(0, 150)));
  // 받아 두면 화면에 알린다 → [지금 설치하고 다시 켜기], 안 누르면 닫을 때 설치 (2026-11-10)
  let ready = '';
  const tell = () => { if (ready && win && !win.isDestroyed()) win.webContents.send('upd:shell', ready); };
  autoUpdater.on('update-downloaded', (i) => { log('껍데기 새 판 받아 둠 ' + i.version + ' (닫을 때 설치)'); ready = i.version; tell(); });
  win.webContents.on('did-finish-load', () => setTimeout(tell, 3000));
  ipcMain.on('upd:install', () => { if (!ready) return; log('껍데기 새 판 지금 설치'); autoUpdater.quitAndInstall(true, true); });
  const go = async () => { if (await autoOn()) autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(go, 30000);
  setInterval(go, 6 * 3600 * 1000);
}

// ── 창 ──
let win = null;
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function open() {
  current = pick();
  log('열 판 ' + current.ver + (current.bundled ? ' (앱에 담긴 판)' : ' (받아 둔 판)'));
  if (!current.bundled) writeState({ ...readState(), trying: current.ver });
  win.loadURL(ORIGIN + 'index.html');
}
// 앱이 섰는지 확인: 받아 둔 판이면 90초 안에 서야 좋은 판
function watchBoot() {
  if (current.bundled) return;
  const ver = current.ver, t0 = Date.now();
  const tick = async () => {
    if (!win || win.isDestroyed() || current.ver !== ver) return;
    let ok = false;
    try { ok = await win.webContents.executeJavaScript('!!(window.J && window.J.E && window.J.ui && window.J.ui.update)'); } catch { ok = false; }
    if (ok) { const s = readState(); s.trying = ''; writeState(s); log('새 판 섬 ' + ver); return; }
    if (Date.now() - t0 > (Number(process.env.JAKDO_BOOT_MS) || 90000)) { const s = readState(); s.trying = ''; s.bad.push(ver); writeState(s); log('새 판이 서지 못함 → 앞 판으로 ' + ver); open(); return; }
    setTimeout(tick, 2000);
  };
  setTimeout(tick, 2000);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: '격물치지', backgroundColor: '#0d1830', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  // 윈도우는 메뉴 없이. 맥은 메뉴가 없으면 ⌘C·⌘V가 안 되므로 기본 메뉴(앱·편집·창)만
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // 켜자마자 닫아도: 닫기 직전에 한 번 더 앱이 섰는지 보고 섰으면 좋은 판으로 (아니면 다음에 켤 때 나쁜 판)
  let closeChecked = false;
  win.on('close', (e) => {
    if (closeChecked || !readState().trying) return;
    e.preventDefault(); closeChecked = true;
    const done = () => { if (!win.isDestroyed()) win.close(); };
    win.webContents.executeJavaScript('!!(window.J && window.J.E)').then((ok) => { if (ok) { const s = readState(); s.trying = ''; writeState(s); log('닫기 전 확인: 새 판 섬 ' + current.ver); } }).catch(() => {}).finally(done);
    setTimeout(done, 1500);
  });
  win.webContents.on('did-finish-load', () => watchBoot());
  win.webContents.on('render-process-gone', (e, d) => log('화면 멈춤 ' + JSON.stringify(d)));
  // 바깥 주소는 평소 브라우저로, 앱 안의 새 창(사용설명서 등)은 앱 창으로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, '..', 'build', 'icon.png') } };
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // F11 전체 화면, Ctrl+Shift+I 개발 도구(문제 볼 때), Ctrl+R 다시 읽기
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (i.control && i.shift && i.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
  open();
}

app.whenReady().then(() => {
  protocol.handle('app', serve);
  createWindow();
  shellUpdates();
  startupCheck();
});
app.on('window-all-closed', () => app.quit());
log('켜짐');
