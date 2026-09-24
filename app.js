(async function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  const grid = document.getElementById('grid');
  let projects = [];
  try {
    const res = await fetch('projects.json', { cache: 'no-cache' });
    projects = await res.json();
  } catch (e) {
    grid.innerHTML = '<p class="grid-empty">De projecten konden niet geladen worden.</p>';
    return;
  }

  projects = projects.filter(p => p.photos && p.photos.length);
  for (const [i, p] of projects.entries()) {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.innerHTML = `
      <div class="card-img">
        <img loading="lazy" alt="">
        ${p.photos.length > 1 ? `<span class="card-count">${p.photos.length} foto's</span>` : ''}
      </div>
      <h3></h3>
      <p></p>`;
    card.querySelector('img').src = p.photos[0];
    card.querySelector('img').alt = p.title;
    card.querySelector('h3').textContent = p.title;
    card.querySelector('p').textContent = p.description || '';
    card.addEventListener('click', () => openViewer(i, 0));
    grid.appendChild(card);
  }

  // Lightbox
  const dlg = document.getElementById('viewer');
  const img = document.getElementById('viewer-img');
  const title = document.getElementById('viewer-title');
  const desc = document.getElementById('viewer-desc');
  const count = document.getElementById('viewer-count');
  let cur = { p: 0, f: 0 };

  function show() {
    const p = projects[cur.p];
    img.src = p.photos[cur.f];
    img.alt = `${p.title}, foto ${cur.f + 1}`;
    title.textContent = p.title;
    desc.textContent = p.description || '';
    count.textContent = p.photos.length > 1 ? `${cur.f + 1} / ${p.photos.length}` : '';
    dlg.querySelectorAll('.viewer-nav').forEach(b => (b.hidden = p.photos.length < 2));
  }
  function openViewer(p, f) { cur = { p, f }; show(); dlg.showModal(); }
  function step(d) {
    const n = projects[cur.p].photos.length;
    cur.f = (cur.f + d + n) % n;
    show();
  }

  dlg.querySelector('.prev').addEventListener('click', () => step(-1));
  dlg.querySelector('.next').addEventListener('click', () => step(1));
  dlg.querySelector('.viewer-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', e => {
    if (!dlg.open) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  let touchX = null;
  img.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  img.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    touchX = null;
  });
})();
