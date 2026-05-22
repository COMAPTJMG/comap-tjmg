/* TJMG Fiscal — Service Worker v71
   Estratégia:
   - App shell (index.html, sw.js, manifest.json, js/*.js) → network-first, fallback cache
   - Demais assets → cache-first, atualiza cache em background
   - Domínios externos (Supabase, CDN, Google) → nunca interceptados

   v71: Fase 4 da modularização — utils.js, router.js, auth.js ativados.
        index.html: 4791 → 4470 linhas (−321 / −7%).
        v68: Fase 3 — report-html.js extraído do index.html.
        Funções removidas do index: exportHTML, _gerarHTMLStr, _doExportHTML,
        exportHTMLSub, _gerarHTMLSubStr, _doExportHTMLSub, normProt,
        gerarProtocolo, gerarTipoLbl, enviarParaDrive, uploadHtmlToSupabase,
        enviarEmailRelatorio.
        Melhorias: page-break corrigido para grades de fotos; relatório de
        subestação redesenhado com identidade visual TJMG unificada.
        index.html: 5663 → 4791 linhas (−872 / −15%).
*/

const V = 'tjmg-v77';
const CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  /* ── Fase 1: módulos extraídos ── */
  './config.js',
  './data.js',
  './state.js',
  /* ── Fase 2: Sync, PhotoStore, DB ── */
  './photo-store.js',
  './sync.js',
  './db.js',
  /* ── Fase 3: geração de relatórios HTML ── */
  './report-html.js',
  './report-pdf.js',
  /* ── Fase 4: utils, router, auth ── */
  './utils.js',
  './router.js',
  './auth.js',
];

const BYPASS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com',
  'firebase',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'script.google.com',
  'dns.google'
];

/* ── Install ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(V).then(function(c) {
      return c.addAll(CACHE);
    }).catch(function(err) {
      console.warn('[SW] install cache falhou:', err);
    })
  );
  /* v74: NÃO chama skipWaiting() automaticamente.
     O SW novo aguarda ativação manual pelo fiscal via botão "Atualizar agora".
     Isso evita que uma atualização automática interrompa uma inspeção em andamento
     e cause perda de dados ao recarregar a página sem aviso. */
});

/* ── Activate: limpa caches antigos ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== V; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

/* ── Mensagens (skipWaiting) ── */
self.addEventListener('message', function(e) {
  if (e.data === 'skipWaiting' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

/* ── Fetch ── */
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch(err) { return; }

  /* Ignora domínios externos */
  if (BYPASS.some(function(d) { return url.hostname.includes(d); })) return;

  /* Ignora outras origens */
  if (url.origin !== self.location.origin) return;

  var path = url.pathname;
  var isShell = (
    path.endsWith('/index.html') ||
    path.endsWith('/sw.js')      ||
    path.endsWith('/manifest.json') ||
    path === '/' ||
    path.endsWith('/')
  );

  if (isShell) {
    /* Network-first para o app shell */
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(function(r) {
          if (r && r.ok) {
            /* Clona ANTES de retornar — body ainda não foi lido */
            var copy = r.clone();
            caches.open(V).then(function(c) { c.put(e.request, copy); });
          }
          return r;
        })
        .catch(function() {
          return caches.match(e.request)
            .then(function(hit) { return hit || caches.match('./index.html'); });
        })
    );
    return;
  }

  /* Cache-first para outros assets
     Background update: faz fetch separado para não reutilizar body */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        /* Atualiza o cache em background com um fetch independente */
        caches.open(V).then(function(c) {
          fetch(e.request).then(function(fresh) {
            if (fresh && fresh.ok) c.put(e.request, fresh);
          }).catch(function() {});
        });
        return cached;
      }
      /* Não tem cache — busca na rede e armazena */
      return fetch(e.request).then(function(r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open(V).then(function(c) { c.put(e.request, copy); });
        }
        return r;
      });
    })
  );
});

/* ── Background Sync — v76 ───────────────────────────────────────────────
   Disparado pelo SO quando o sinal retorna, mesmo com o app em background.
   Avisa todos os clientes abertos para fazer o push. */
self.addEventListener('sync', function(e) {
  if(e.tag === 'tjmg-push') {
    e.waitUntil(
      self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(clients) {
        if(clients.length) {
          clients.forEach(function(c) { c.postMessage({type:'BACKGROUND_SYNC_PUSH'}); });
        }
        /* Se não há cliente aberto: agenda retry quando abrir */
        return Promise.resolve();
      })
    );
  }
});

/* ── Periodic Background Sync (onde suportado) ── */
self.addEventListener('periodicsync', function(e) {
  if(e.tag === 'tjmg-periodic') {
    e.waitUntil(
      self.clients.matchAll({type:'window'}).then(function(clients) {
        clients.forEach(function(c) { c.postMessage({type:'BACKGROUND_SYNC_PUSH'}); });
      })
    );
  }
});
