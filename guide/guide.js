// 격물치지 사용 설명서 (전자책): 한 장씩 넘겨 보기·전체 이어 보기, 지금 읽는 장 표시, 설명서에서 찾기 (찾은 낱말 표시)
// 주소 끝 #장이름 으로 그 장을 바로 연다. ← → 키로 쪽 넘기기 (글을 쓰는 중에는 아님). 고른 보기 방식은 이 브라우저에 기억
(function () {
  const body = document.body;
  const links = [...document.querySelectorAll('.toc a')];
  const chs = [...document.querySelectorAll('.ch')];
  const bar = document.querySelector('.progress');
  const side = document.querySelector('.side');
  const modeBtn = document.querySelector('.mode');
  let cur = 0;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };
  const isBook = () => body.classList.contains('book');
  const mark = (i) => {
    links.forEach((a, j) => a.classList.toggle('on', j === i));
    if (bar) bar.style.width = `${((i + 1) / chs.length) * 100}%`;
  };
  // 한 장 열기 (top: 그 장 맨 위로)
  function show(i, top = true) {
    cur = Math.max(0, Math.min(chs.length - 1, i));
    chs.forEach((c, j) => c.classList.toggle('cur', j === cur));
    body.classList.toggle('first', cur === 0);
    mark(cur);
    // 주소 끝 #장이름: 처음 열 때 첫 장이면 붙이지 않는다 (붙이면 브라우저가 다 열린 뒤 그 장으로 내려가 표지가 가려진다)
    if (history.replaceState && (location.hash || cur > 0)) history.replaceState(null, '', '#' + chs[cur].id);
    if (top) { if (isBook()) window.scrollTo(0, 0); else chs[cur].scrollIntoView(); }
    if (side) side.classList.remove('open');
  }
  const fromHash = () => { const id = decodeURIComponent(location.hash.slice(1)); const i = chs.findIndex((c) => c.id === id); return i < 0 ? 0 : i; };
  function setMode(book) {
    body.classList.toggle('book', book);
    if (modeBtn) modeBtn.textContent = book ? '전체 이어 보기' : '한 장씩 넘겨 보기';
    store('gc-guide-mode', book ? 'book' : 'all');
    show(cur);
  }
  // 차례 누르기: 한 장씩 보기에서는 그 장만
  links.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); show(i); }));
  document.querySelectorAll('.pager a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const i = chs.findIndex((c) => '#' + c.id === a.getAttribute('href')); if (i >= 0) show(i); }));
  if (modeBtn) modeBtn.addEventListener('click', () => setMode(!isBook()));
  const tt = document.querySelector('.toc-toggle');
  if (tt && side) tt.addEventListener('click', () => side.classList.toggle('open'));
  document.addEventListener('keydown', (e) => {
    if (!isBook() || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowRight') { show(cur + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { show(cur - 1); e.preventDefault(); }
  });
  window.addEventListener('hashchange', () => show(fromHash()));
  // 전체 이어 보기: 지금 읽는 장
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (isBook()) return;
      for (const e of es) if (e.isIntersecting) { cur = chs.indexOf(e.target); mark(cur); }
    }, { rootMargin: '-20% 0px -70% 0px' });
    chs.forEach((c) => io.observe(c));
  }
  // 찾기: 낱말이 든 장만 보이고, 낱말에 형광 표시 (한 장씩 보기에서도 찾는 동안은 찾은 장을 모두)
  const box = document.querySelector('.search'), none = document.querySelector('.nomatch');
  const unmark = (root) => root.querySelectorAll('mark').forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
  const markIn = (root, q) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = [];
    while (w.nextNode()) { const n = w.currentNode; if (n.nodeValue.toLowerCase().includes(q)) hits.push(n); }
    for (const n of hits) {
      const s = n.nodeValue, i = s.toLowerCase().indexOf(q); if (i < 0) continue;
      const m = document.createElement('mark'); m.textContent = s.slice(i, i + q.length);
      const after = document.createTextNode(s.slice(i + q.length)); n.nodeValue = s.slice(0, i);
      n.after(m, after);
    }
  };
  let t = 0;
  if (box) box.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const q = box.value.trim().toLowerCase(); let shown = 0;
      body.classList.toggle('searching', !!q);
      chs.forEach((c, i) => {
        unmark(c);
        const ok = !q || c.textContent.toLowerCase().includes(q);
        c.classList.toggle('hide', !ok); if (links[i]) links[i].parentElement.classList.toggle('hide', !ok);
        if (ok) { shown++; if (q) markIn(c, q); }
      });
      if (none) none.hidden = shown > 0;
    }, 150);
  });
  cur = fromHash();
  setMode(store('gc-guide-mode') !== 'all');
})();
