// 화면(격물치지 앱)에 window.jakdoApp 만 건넨다 — 새 판 확인·다시 켜기 (src/ui/update.js가 쓴다)
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('app:info');
contextBridge.exposeInMainWorld('jakdoApp', {
  isApp: true,
  shellVersion: info.shell,
  platform: info.platform, // 'win32' | 'darwin' (2026-11-10)
  portable: info.portable, // 윈도우 바로실행판이면 true — 껍데기를 스스로 바꾸지 못한다
  update: {
    check: () => ipcRenderer.invoke('upd:check'),
    restart: () => ipcRenderer.send('upd:restart'),
    onShell: (fn) => ipcRenderer.on('upd:shell', (e, v) => fn(String(v))), // 껍데기 새 판을 받아 둠 (윈도우 설치판)
    installNow: () => ipcRenderer.send('upd:install'),
    booted: () => ipcRenderer.send('upd:booted'), // 앱이 섰다고 바로 알림 (켜자마자 닫아도 좋은 판으로)
  },
});
