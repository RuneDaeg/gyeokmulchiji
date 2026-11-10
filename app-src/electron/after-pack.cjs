// 맥 앱 임시 서명 (2026-11-10): electron-builder 의 identity "-" 서명은 앱 속 파일 목록이 빠져
// codesign --verify 가 "code has no resources but signature indicates they must be present" 로 실패하고, 애플 칩 맥은 "손상됨"으로 막는다
// → 짐을 꾸린 뒤(zip 전에) 앱 전체를 다시 임시 서명한다. package.json mac.identity 는 null (electron-builder 서명 끔)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async (ctx) => {
  if (ctx.electronPlatformName !== 'darwin') return;
  for (const f of fs.readdirSync(ctx.appOutDir)) {
    if (!f.endsWith('.app')) continue;
    const app = path.join(ctx.appOutDir, f);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
    console.log('임시 서명 바름: ' + app);
  }
};
