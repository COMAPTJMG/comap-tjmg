/**
 * ============================================================
 *  Code.gs — COMAP Sistema Integrado v5.2 (Shell SPA + Boot + Usuários)
 * ============================================================
 *
 *  MUDANÇAS DO CICLO 2:
 *    - Shell unificado com TABS no topo (não mais cards de navegação)
 *    - Iframes pré-carregados por módulo (1 por módulo) — UX SPA
 *    - Boot Validator: doGet verifica a integridade da planilha ANTES
 *      de servir qualquer HTML. Se faltar aba, retorna tela amigável.
 *    - Os módulos individuais (Per_view, Emr_view, Pci_view, Lau_view)
 *      permanecem INTACTOS. Continuam sendo servidos via ?modulo=X.
 *
 *  DEPENDÊNCIAS (todas já existentes ou nesta entrega):
 *    - Config.gs        (do Ciclo 1)
 *    - Auth.gs          (do projeto atual)
 *    - 01_Utils.gs / log_ / ss_
 *    - index.html       (shell — nesta entrega)
 *    - css.html         (shell — nesta entrega)
 *    - js.html          (shell — nesta entrega)
 *    - boot_error.html  (tela de erro — nesta entrega)
 *    - Per_view.html, Emr_view.html, Pci_view.html, Lau_view.html (atuais)
 */

const URL_HOME = 'https://script.google.com/a/macros/tjmg.jus.br/s/AKfycbz90q9cWoa78RTp52u55uANFeAyZ1FsWe89xtTIriv9chCUU655oO7SmWPUvApgoxkITA/exec';

/* ===== ENTRYPOINT ====================================================== */

function doGet(e) {
  const modulo = (e && e.parameter && e.parameter.modulo) || '';

  // 1. BOOT VALIDATOR (apenas para o shell — módulos individuais já validam abas próprias)
  if (!modulo) {
    const bootCheck = validarBoot_();
    if (!bootCheck.ok) {
      return renderizarErroBoot_(bootCheck);
    }
  }

  // 2. ROTEAMENTO
  let arquivo, titulo;
  switch (modulo) {
    case 'emergencial': arquivo = 'Emr_view'; titulo = 'COMAP — Emergencial'; break;
    case 'periodica':   arquivo = 'Per_view'; titulo = 'COMAP — Periódica';   break;
    case 'pci':         arquivo = 'Pci_view'; titulo = 'COMAP — PCI';         break;
    case 'laudos':      arquivo = 'Lau_view'; titulo = 'COMAP — Laudos';      break;
    case 'usuarios':    arquivo = 'Usr_view'; titulo = 'COMAP — Usuários';    break;
    default:            arquivo = 'index';    titulo = CONFIG.TITULO;
  }

  // 3. SHELL (login + dashboard SPA)
  if (arquivo === 'index') {
    const t = HtmlService.createTemplateFromFile('index');
    t.config    = { titulo: CONFIG.TITULO, versao: CONFIG.VERSAO, modulos: CONFIG.MODULOS };
    t.webAppUrl = URL_HOME;
    return t.evaluate()
      .setTitle(titulo)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
  }

  // 4. MÓDULOS (mesma lógica anterior — injetam sessão e respondem por iframe)
  const sessao = {
    nome:   (e.parameter.n     || '').toString(),
    email:  (e.parameter.email || '').toString(),
    regiao: (e.parameter.r     || '').toString().toUpperCase(),
    global: e.parameter.g === '1'
  };

  let html;
  if (arquivo === 'Per_view') {
    html = HtmlService.createTemplateFromFile(arquivo).evaluate().getContent();
  } else {
    html = HtmlService.createHtmlOutputFromFile(arquivo).getContent();
  }

  // Injeção de sessão (mesma do Code.gs v3 — preserva os scripts dos módulos atuais)
  html = injetarSessaoEModuloHelpers_(html, sessao);

  return HtmlService.createHtmlOutput(html)
    .setTitle(titulo)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===== INCLUDES ======================================================== */

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function incluir(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ===== BOOT VALIDATOR ================================================== */

/**
 * Valida que a planilha está acessível e contém TODAS as abas obrigatórias.
 * Retorna { ok, planilha?, faltantes?, erro? }.
 *
 * Use cache de 5 min para evitar releitura a cada doGet.
 */
function validarBoot_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('boot_valido');
  if (cached === '1') return { ok: true, cache: true };

  try {
    const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) {
      return {
        ok: false,
        titulo: 'Sistema não configurado',
        erro: 'SHEET_ID não foi definido nas Script Properties.',
        instrucao: 'No editor do Apps Script, abra Config.gs e execute setup() uma vez.',
        codigo: 'NO_SHEET_ID'
      };
    }

    const ss = SpreadsheetApp.openById(id);
    const nomesEncontrados = ss.getSheets().map(s => s.getName());

    // Lista de abas obrigatórias (vem do CONFIG)
    const obrigatorias = [
      CONFIG.ABAS.USUARIOS,
      CONFIG.ABAS.EMERGENCIAIS,
      CONFIG.ABAS.PERIODICAS,
      CONFIG.ABAS.PROGRAMADAS,
      CONFIG.ABAS.PCI,
      CONFIG.ABAS.LAUDOS
    ];

    const faltantes = obrigatorias.filter(nome => nomesEncontrados.indexOf(nome) < 0);

    if (faltantes.length > 0) {
      return {
        ok: false,
        titulo: 'Abas faltantes na planilha',
        erro: 'A planilha não contém todas as abas necessárias.',
        faltantes: faltantes,
        encontradas: nomesEncontrados,
        planilha: ss.getName(),
        codigo: 'ABAS_FALTANTES'
      };
    }

    cache.put('boot_valido', '1', 300);  // 5 min
    return { ok: true, planilha: ss.getName() };

  } catch (err) {
    return {
      ok: false,
      titulo: 'Erro ao abrir planilha',
      erro: err.message,
      codigo: 'EXCECAO_ABERTURA'
    };
  }
}

/**
 * Invalida o cache do boot — útil quando o admin alterou a planilha
 * e quer forçar revalidação na próxima carga.
 */
function invalidarCacheBoot() {
  CacheService.getScriptCache().remove('boot_valido');
  return { ok: true, msg: 'Cache de boot invalidado.' };
}

/**
 * Renderiza a tela de erro amigável usando o template boot_error.html.
 */
function renderizarErroBoot_(check) {
  const t = HtmlService.createTemplateFromFile('boot_error');
  t.titulo      = check.titulo || 'Erro na inicialização';
  t.erro        = check.erro || 'Erro desconhecido';
  t.instrucao   = check.instrucao || '';
  t.faltantes   = check.faltantes || [];
  t.encontradas = check.encontradas || [];
  t.planilha    = check.planilha || '';
  t.codigo      = check.codigo || '';
  t.versao      = CONFIG.VERSAO;
  return t.evaluate()
    .setTitle('COMAP — Erro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===== INJEÇÃO DE SESSÃO NOS MÓDULOS (compat. com Code.gs v3) ========= */

function injetarSessaoEModuloHelpers_(html, sessao) {
  const sessJson = JSON.stringify(sessao);
  const sessJsonCompat = JSON.stringify({
    nome: sessao.nome, login: sessao.email, email: sessao.email,
    regiao: sessao.regiao, global: sessao.global, timestamp: Date.now()
  });
  const sessJsonPer = JSON.stringify({ nome: sessao.nome, timestamp: Date.now() });

  const LT = String.fromCharCode(60);
  const GT = String.fromCharCode(62);
  const TS_OPEN  = LT + 'script' + GT;
  const TS_CLOSE = LT + '/script' + GT;
  const RX_HEAD  = new RegExp(LT + 'head([^' + GT + ']*)' + GT, 'i');

  const injecao =
    TS_OPEN + '\n' +
    '(function(){\n' +
    '  window.__COMAP_SESSAO__ = ' + sessJson + ';\n' +
    '  window.__COMAP_URL__ = ' + JSON.stringify(URL_HOME) + ';\n' +
    '  window.__COMAP_EMBEDDED__ = true;\n' +     // ← NOVO: módulos sabem que estão no shell SPA
    '  try {\n' +
    '    localStorage.setItem("comap_unificado", ' + JSON.stringify(sessJson) + ');\n' +
    '    localStorage.setItem("comap_session", ' + JSON.stringify(sessJsonCompat) + ');\n' +
    '    localStorage.setItem("tjmg_periodicas_session", ' + JSON.stringify(sessJsonPer) + ');\n' +
    '  } catch(e) {}\n' +
    '\n' +
    '  // Logout do iframe: avisa o shell parente via postMessage\n' +
    '  window.__COMAP_LOGOUT__ = function() {\n' +
    '    try {\n' +
    '      localStorage.removeItem("comap_session");\n' +
    '      localStorage.removeItem("comap_unificado");\n' +
    '      localStorage.removeItem("tjmg_periodicas_session");\n' +
    '    } catch(e) {}\n' +
    '    try { parent.postMessage({ tipo: "COMAP_LOGOUT" }, "*"); } catch(e) {}\n' +
    '  };\n' +
    '\n' +
    '  // Home: avisa o shell parente para voltar à tela inicial\n' +
    '  window.__COMAP_HOME__ = function() {\n' +
    '    try { parent.postMessage({ tipo: "COMAP_HOME" }, "*"); } catch(e) {}\n' +
    '  };\n' +
    '\n' +
    '  // Esconde a barra de navegação interna dos módulos quando dentro do shell SPA\n' +
    '  // ATENÇÃO: o CSS original tem display:flex !important, então precisamos:\n' +
    '  //   (a) injetar uma tag <style> com !important no head\n' +
    '  //   (b) usar setProperty com a flag "important" no elemento\n' +
    '  function esconderNavInterna() {\n' +
    '    if (!window.__COMAP_EMBEDDED__) return;\n' +
    '    // (a) Style tag global — vence o !important original\n' +
    '    if (!document.getElementById("comap-spa-hide-css")) {\n' +
    '      var st = document.createElement("style");\n' +
    '      st.id = "comap-spa-hide-css";\n' +
    '      st.textContent =\n' +
    '        "#comap-unif-nav, #comap-loading, .top-bar, .navbar-tjmg, .header-pci { display: none !important; visibility: hidden !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: 0 !important; overflow: hidden !important; }" +\n' +
    '        "body { padding-top: 0 !important; }";\n' +
    '      (document.head || document.documentElement).appendChild(st);\n' +
    '    }\n' +
    '    // (b) Inline com !important — redundância defensiva\n' +
    '    var selectoresEsconder = ["#comap-unif-nav", "#comap-loading", ".top-bar", ".navbar-tjmg", ".header-pci"];\n' +
    '    selectoresEsconder.forEach(function(sel) {\n' +
    '      try {\n' +
    '        document.querySelectorAll(sel).forEach(function(el) {\n' +
    '          el.style.setProperty("display", "none", "important");\n' +
    '        });\n' +
    '      } catch(e) {}\n' +
    '    });\n' +
    '    if (document.body) document.body.style.setProperty("padding-top", "0", "important");\n' +
    '  }\n' +
    '  esconderNavInterna();\n' +     // executa imediatamente (head já existe)
    '  if (document.readyState === "loading") {\n' +
    '    document.addEventListener("DOMContentLoaded", esconderNavInterna);\n' +
    '  } else {\n' +
    '    setTimeout(esconderNavInterna, 0);\n' +
    '  }\n' +
    '  setTimeout(esconderNavInterna, 500);\n' +
    '  setTimeout(esconderNavInterna, 1500);\n' +
    '})();\n' +
    TS_CLOSE + '\n';

  html = html.replace(RX_HEAD, function(match, attrs) {
    return LT + 'head' + attrs + GT + injecao;
  });
  return html;
}

/* ===== DIAGNÓSTICO (mantido para uso manual) =========================== */

function diagnosticar() {
  const ss = ss_();
  const out = { planilha: ss.getName(), abas: {} };
  ss.getSheets().forEach(sh => {
    const lastCol = sh.getLastColumn();
    out.abas[sh.getName()] = {
      linhas: sh.getLastRow(),
      colunas: lastCol,
      cabecalho: lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : []
    };
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/**
 * ════════════════════════════════════════════════════════════════
 *   SHELL_logout.gs  —  Ciclo 7A
 *
 *   ADICIONE este código ao FINAL do seu Code.gs (ou Auth.gs).
 *   É só uma função nova — não conflita com nada existente.
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Invalida a sessão atual no CacheService.
 * Chamada pelo botão SAIR no shell (js.html → fazerLogout).
 *
 * @returns {{ok: boolean, erro?: string}}
 */
function SHELL_logout() {
  try {
    // 1) Cache do usuário — chaves típicas do COMAP
    var userCache = CacheService.getUserCache();
    if (userCache) {
      userCache.removeAll([
        'comap_sessao',
        'comap_sessao_token',
        'comap_session',
        'comap_user',
        'comap_unificado',
        'sessao_atual',
        'sessao_token'
      ]);
    }

    // 2) Cache de script (compartilhado) — limpa por e-mail efetivo
    var scriptCache = CacheService.getScriptCache();
    if (scriptCache) {
      var userEmail = '';
      try { userEmail = Session.getEffectiveUser().getEmail() || ''; } catch(e) {}
      if (userEmail) {
        var key = userEmail.toLowerCase();
        scriptCache.remove('sessao_' + key);
        scriptCache.remove('comap_' + key);
        scriptCache.remove('login_' + key);
        scriptCache.remove('user_' + key);
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e.toString() };
  }
}