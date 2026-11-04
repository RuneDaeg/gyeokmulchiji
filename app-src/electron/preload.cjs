// 화면(격물치지 앱)에 window.jakdoApp 만 건넨다 — 새 판 확인·다시 켜기 (src/ui/update.js가 쓴다)
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('app:info');
contextBridge.exposeInMainWorld('jakdoApp', {
  isApp: true,
  shellVersion: info.shell,
  update: {
    check: () => ipcRenderer.invoke('upd:check'),
    restart: () => ipcRenderer.send('upd:restart'),
    booted: () => ipcRenderer.send('upd:booted'), // 앱이 섰다고 바로 알림 (켜자마자 닫아도 좋은 판으로)
  },
});
