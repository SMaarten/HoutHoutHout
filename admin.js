(function () {
  const $ = id => document.getElementById(id);
  const MAX_SIDE = 1600;
  const QUALITY = 0.82;
  const STORE = 'hout3-admin';

  let cfg = {};
  let projects = [];          // [{slug, title, description, photos: [path]}]
  const pending = new Map();  // path -> { blob, url } for photos not yet committed
  const deleted = new Set();  // committed photo paths to remove
  const localPreview = new Map(); // path -> object URL for just-published photos (site may still be rebuilding)
  let dirty = false;

  // ---------- settings ----------
  try { cfg = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { cfg = {}; }
  $('owner').value = cfg.owner || '';
  $('repo').value = cfg.repo || '';
  $('branch').value = cfg.branch || 'main';
  $('token').value = cfg.token || '';

  $('connect').addEventListener('click', async () => {
    cfg = {
      owner: $('owner').value.trim(),
      repo: $('repo').value.trim(),
      branch: $('branch').value.trim() || 'main',
      token: $('token').value.trim(),
    };
    if (!cfg.owner || !cfg.repo || !cfg.token) return status('Vul gebruiker, repository en token in.', true);
    try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
    await load();
  });

  $('logout').addEventListener('click', () => {
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    location.reload();
  });

  // ---------- GitHub API ----------
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      let msg = res.status + ' ' + res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) { /* ignore */ }
      if (res.status === 401) msg = 'Token ongeldig of verlopen.';
      if (res.status === 404) msg = 'Repository, branch of bestand niet gevonden (of het token heeft geen toegang).';
      throw new Error(msg);
    }
    return res.json();
  }

  function decodeBase64Utf8(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  async function load() {
    status('Laden…');
    try {
      const file = await gh(`/contents/projects.json?ref=${encodeURIComponent(cfg.branch)}`);
      projects = JSON.parse(decodeBase64Utf8(file.content));
    } catch (e) {
      return status(e.message, true);
    }
    pending.clear();
    deleted.clear();
    setDirty(false);
    $('editor').hidden = false;
    $('logout').hidden = false;
    $('login').querySelector('h2').textContent = `Verbonden met ${cfg.owner}/${cfg.repo}`;
    render();
    status('');
  }

  // ---------- image handling ----------
  async function resize(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close && bmp.close();
    return new Promise(r => canvas.toBlob(r, 'image/jpeg', QUALITY));
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result.split(',')[1]);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function slugify(s) {
    const base = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
    let slug = base, i = 2;
    while (projects.some(p => p.slug === slug)) slug = `${base}-${i++}`;
    return slug;
  }

  // ---------- add form ----------
  function fillTarget() {
    const sel = $('target');
    const keep = sel.value;
    sel.innerHTML = '<option value="">+ Nieuw project</option>' +
      projects.map(p => `<option value="${p.slug}">${escapeHtml(p.title)}</option>`).join('');
    sel.value = projects.some(p => p.slug === keep) ? keep : '';
    $('new-fields').hidden = sel.value !== '';
  }
  $('target').addEventListener('change', () => { $('new-fields').hidden = $('target').value !== ''; });

  $('files').addEventListener('change', () => {
    const box = $('previews');
    box.innerHTML = '';
    for (const f of $('files').files) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      box.appendChild(img);
    }
  });

  $('add').addEventListener('click', async () => {
    const files = [...$('files').files];
    if (!files.length) return status('Kies eerst één of meer foto\'s.', true);

    let project = projects.find(p => p.slug === $('target').value);
    if (!project) {
      const title = $('new-title').value.trim();
      if (!title) return status('Geef het nieuwe project een titel.', true);
      project = { slug: slugify(title), title, description: $('new-desc').value.trim(), photos: [] };
      projects.unshift(project);
    }

    $('add').disabled = true;
    try {
      const stamp = Date.now().toString(36);
      for (const [i, f] of files.entries()) {
        status(`Foto ${i + 1} van ${files.length} verkleinen…`);
        const blob = await resize(f);
        const path = `photos/${project.slug}/${stamp}-${i + 1}.jpg`;
        pending.set(path, { blob, url: URL.createObjectURL(blob) });
        project.photos.push(path);
      }
    } catch (e) {
      $('add').disabled = false;
      return status('Deze foto kon niet gelezen worden: ' + e.message, true);
    }
    $('add').disabled = false;
    $('files').value = '';
    $('previews').innerHTML = '';
    $('new-title').value = '';
    $('new-desc').value = '';
    $('target').value = project.slug;
    setDirty(true);
    render();
    status('Toegevoegd. Klik op "Publiceren" om het online te zetten.');
  });

  // ---------- project list ----------
  function render() {
    fillTarget();
    const list = $('list');
    list.innerHTML = '';
    if (!projects.length) list.innerHTML = '<p class="muted">Nog geen projecten.</p>';

    projects.forEach((p, idx) => {
      const el = document.createElement('div');
      el.className = 'project';
      el.innerHTML = `
        <label>Titel</label><input type="text" class="t">
        <label>Beschrijving</label><textarea class="d"></textarea>
        <div class="thumbs"></div>
        <div class="project-actions">
          <button class="btn btn-ghost btn-small up" ${idx === 0 ? 'disabled' : ''}>↑ Hoger</button>
          <button class="btn btn-ghost btn-small down" ${idx === projects.length - 1 ? 'disabled' : ''}>↓ Lager</button>
          <button class="btn btn-small btn-danger del">Project verwijderen</button>
        </div>`;
      el.querySelector('.t').value = p.title;
      el.querySelector('.d').value = p.description || '';
      el.querySelector('.t').addEventListener('input', e => { p.title = e.target.value; setDirty(true); });
      el.querySelector('.d').addEventListener('input', e => { p.description = e.target.value; setDirty(true); });

      const thumbs = el.querySelector('.thumbs');
      p.photos.forEach((path, fi) => {
        const t = document.createElement('div');
        t.className = 'thumb';
        const img = document.createElement('img');
        img.src = pending.has(path) ? pending.get(path).url : (localPreview.get(path) || path);
        img.alt = '';
        const x = document.createElement('button');
        x.type = 'button';
        x.title = 'Foto verwijderen';
        x.textContent = '×';
        x.addEventListener('click', () => {
          removePhoto(path);
          p.photos.splice(fi, 1);
          setDirty(true);
          render();
        });
        t.append(img, x);
        thumbs.appendChild(t);
      });

      el.querySelector('.up').addEventListener('click', () => move(idx, -1));
      el.querySelector('.down').addEventListener('click', () => move(idx, 1));
      el.querySelector('.del').addEventListener('click', () => {
        p.photos.forEach(removePhoto);
        projects.splice(idx, 1);
        setDirty(true);
        render();
      });
      list.appendChild(el);
    });
  }

  function removePhoto(path) {
    if (pending.has(path)) { URL.revokeObjectURL(pending.get(path).url); pending.delete(path); }
    else deleted.add(path);
  }

  function move(idx, d) {
    const [p] = projects.splice(idx, 1);
    projects.splice(idx + d, 0, p);
    setDirty(true);
    render();
  }

  // ---------- publish ----------
  $('save').addEventListener('click', async () => {
    $('save').disabled = true;
    try {
      status('Publiceren…');
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      const head = await gh(`/git/commits/${ref.object.sha}`);

      const tree = [];
      let n = 0;
      for (const [path, { blob }] of pending) {
        status(`Foto ${++n} van ${pending.size} uploaden…`);
        const b = await gh('/git/blobs', { method: 'POST', body: { content: await blobToBase64(blob), encoding: 'base64' } });
        tree.push({ path, mode: '100644', type: 'blob', sha: b.sha });
      }
      for (const path of deleted) tree.push({ path, mode: '100644', type: 'blob', sha: null });

      const clean = projects
        .filter(p => p.photos.length)
        .map(p => ({ slug: p.slug, title: p.title.trim(), description: (p.description || '').trim(), photos: p.photos }));
      tree.push({ path: 'projects.json', mode: '100644', type: 'blob', content: JSON.stringify(clean, null, 2) + '\n' });

      status('Opslaan…');
      const newTree = await gh('/git/trees', { method: 'POST', body: { base_tree: head.tree.sha, tree } });
      const commit = await gh('/git/commits', {
        method: 'POST',
        body: { message: `Projecten bijgewerkt via beheerpagina`, tree: newTree.sha, parents: [head.sha] },
      });
      await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: { sha: commit.sha } });

      projects = clean;
      deleted.clear();
      // Keep local previews for new photos until the site has rebuilt.
      for (const [path, { url }] of pending) localPreview.set(path, url);
      pending.clear();
      setDirty(false);
      render();
      status('Gepubliceerd! De website is binnen 1 à 2 minuten bijgewerkt.');
    } catch (e) {
      $('save').disabled = false;
      status('Publiceren mislukt: ' + e.message, true);
    }
  });

  // ---------- helpers ----------
  function setDirty(v) {
    dirty = v;
    $('save').disabled = !v;
    $('dirty').textContent = v ? 'Niet-gepubliceerde wijzigingen' : '';
  }

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function status(msg, isError) {
    const s = $('status');
    s.textContent = msg;
    s.classList.toggle('show', !!msg);
    s.classList.toggle('error', !!isError);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  if (cfg.owner && cfg.repo && cfg.token) load();
})();
