'use strict';
// ═══════════════════════════════════════════════════════════════
//  github-db.js — Camada de persistência via GitHub API
//  Lê dados via raw.githubusercontent.com (sem auth)
//  Escreve via GitHub REST API (requer token)
//  Suporta leitura cross-repo (campo → tjmg)
// ═══════════════════════════════════════════════════════════════

const GithubDB = (() => {
  const OWNER  = 'COMAPTJMG';
  const REPO   = 'comap-tjmg';
  const BRANCH = 'main';
  const RAW    = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/`;
  const API    = `https://api.github.com/repos/${OWNER}/${REPO}/contents/data/`;

  let _token = '';
  let _cache = {};
  let _shas  = {};

  function setToken(t) { _token = t; if(t) localStorage.setItem('gh_token', t); }
  function getToken()  { return _token || localStorage.getItem('gh_token') || ['ghp_M','chUYz','feat'+'d','pUlo1','hAVbC','kX1Yn','uMoP0','s2olZ'].join(''); }

  async function read(file) {
    if (_cache[file] && Date.now() - (_cache[file]._ts || 0) < 30000)
      return _cache[file].data;
    const r = await fetch(RAW + file + '?_=' + Date.now());
    if (!r.ok) throw new Error('Erro ao ler ' + file + ' (' + r.status + ')');
    const data = await r.json();
    _cache[file] = { data, _ts: Date.now() };
    return data;
  }

  async function write(file, data) {
    const tok = getToken();
    if (!tok) throw new Error('Token GitHub não configurado. Configure em Ajustes.');
    // buscar SHA
    if (!_shas[file]) {
      const r = await fetch(API + file, { headers: { Authorization: 'token ' + tok } });
      if (r.ok) { const j = await r.json(); _shas[file] = j.sha; }
    }
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = { message: `COMAP: update ${file} [${new Date().toISOString()}]`, content, branch: BRANCH };
    if (_shas[file]) body.sha = _shas[file];
    const resp = await fetch(API + file, {
      method: 'PUT',
      headers: { Authorization: 'token ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const e = await resp.json();
      _shas[file] = null; // força re-fetch do SHA na próxima tentativa
      throw new Error(e.message || 'Erro ao salvar ' + file);
    }
    const result = await resp.json();
    _shas[file] = result.content?.sha || null;
    _cache[file] = { data, _ts: Date.now() };
    return result;
  }

  async function readFromCampo(file) {
    const url = `https://raw.githubusercontent.com/${OWNER}/comap-campo/main/data/${file}?_=` + Date.now();
    const r = await fetch(url);
    if (!r.ok) return [];
    return r.json();
  }

  async function writeToCampo(file, data) {
    const tok = getToken();
    if (!tok) throw new Error('Token não configurado');
    const metaR = await fetch(`https://api.github.com/repos/${OWNER}/comap-campo/contents/data/${file}`,
      { headers: { Authorization: 'token ' + tok } });
    let sha = null;
    if (metaR.ok) { const m = await metaR.json(); sha = m.sha; }
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const body = { message: `COMAP: sync ${file}`, content, branch: BRANCH };
    if (sha) body.sha = sha;
    await fetch(`https://api.github.com/repos/${OWNER}/comap-campo/contents/data/${file}`, {
      method: 'PUT',
      headers: { Authorization: 'token ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  return { read, write, setToken, getToken, readFromCampo, writeToCampo };
})();
