/**
 * Util_Comarcas.gs — Fonte única de dropdowns Região / Comarca / Edificação
 * ────────────────────────────────────────────────────────────────────────
 *
 * Lê da aba "COMARCA" da planilha (14 colunas em pares por região):
 *   Col A, B = NORTE         (Comarca, Edificação)
 *   Col C, D = LESTE
 *   Col E, F = ZONA_DA_MATA
 *   Col G, H = CENTRAL
 *   Col I, J = SUL
 *   Col K, L = SUDOESTE
 *   Col M, N = TRIANGULO
 *
 * Linhas 1-2 são cabeçalhos; dados começam na linha 3.
 *
 * Uso no frontend:
 *   google.script.run.withSuccessHandler(fn).util_carregarTodasComarcas();
 *   → retorna { NORTE: [{comarca, edificacao}, ...], LESTE: [...], ... }
 *
 * Cache: 5 minutos via CacheService (acelera múltiplos acessos).
 */

const COMARCA_SHEET_NAME = 'COMARCA';

// Mapa região → índice da PRIMEIRA coluna (Comarca) do par
const COMARCA_REGIOES_MAP = {
  'NORTE':        0,   // A=0 (Comarca), B=1 (Edificação)
  'LESTE':        2,   // C=2, D=3
  'ZONA_DA_MATA': 4,   // E=4, F=5
  'CENTRAL':      6,   // G=6, H=7
  'SUL':          8,   // I=8, J=9
  'SUDOESTE':    10,   // K=10, L=11
  'TRIANGULO':   12    // M=12, N=13
};

const COMARCA_CACHE_KEY = 'util_comarcas_v1';
const COMARCA_CACHE_TTL = 300; // 5 minutos

/* ──────────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────────── */

function util__normRegiao_(r) {
  if (!r) return '';
  return r.toString()
    .toUpperCase()
    .replace(/\s+/g, '_')      // "ZONA DA MATA" → "ZONA_DA_MATA"
    .replace(/[ÁÀÃÂÄ]/g, 'A')
    .replace(/[ÉÊË]/g, 'E')
    .replace(/[ÍÎÏ]/g, 'I')
    .replace(/[ÓÔÕÖ]/g, 'O')
    .replace(/[ÚÛÜ]/g, 'U')
    .replace(/[Ç]/g, 'C')
    .trim();
}

function util__cacheGet_() {
  try {
    const c = CacheService.getScriptCache().get(COMARCA_CACHE_KEY);
    if (c) return JSON.parse(c);
  } catch (e) {}
  return null;
}

function util__cacheSet_(data) {
  try {
    const s = JSON.stringify(data);
    // Cache tem limite de 100KB por chave; 424 registros cabem confortavelmente
    if (s.length < 95000) {
      CacheService.getScriptCache().put(COMARCA_CACHE_KEY, s, COMARCA_CACHE_TTL);
    }
  } catch (e) {}
}

/* ──────────────────────────────────────────────────────────────
   1) CARREGAR TODAS — função principal
   Retorna estrutura completa indexada por região.
   ────────────────────────────────────────────────────────────── */
function util_carregarTodasComarcas() {
  // Tenta cache primeiro
  const cached = util__cacheGet_();
  if (cached) return cached;

  const ss = ss_();
  const sheet = ss.getSheetByName(COMARCA_SHEET_NAME);
  if (!sheet) {
    return { ok: false, erro: 'Aba "' + COMARCA_SHEET_NAME + '" não encontrada.', data: {} };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    return { ok: true, data: {}, totalRegistros: 0, atualizado: new Date().toISOString() };
  }

  // Dados começam na linha 3 (linhas 1 e 2 são cabeçalhos)
  const valores = sheet.getRange(3, 1, lastRow - 2, 14).getValues();

  const result = {};
  Object.keys(COMARCA_REGIOES_MAP).forEach(reg => {
    result[reg] = [];
  });

  let totalRegistros = 0;

  Object.keys(COMARCA_REGIOES_MAP).forEach(reg => {
    const baseCol = COMARCA_REGIOES_MAP[reg];
    const vistos = {};  // dedup por comarca+edificacao
    for (let i = 0; i < valores.length; i++) {
      const row = valores[i];
      const comarca = (row[baseCol] || '').toString().trim();
      const edif = (row[baseCol + 1] || '').toString().trim();
      if (!comarca && !edif) continue;
      const chave = comarca.toUpperCase() + '|' + edif.toUpperCase();
      if (vistos[chave]) continue;
      vistos[chave] = true;
      result[reg].push({ comarca: comarca, edificacao: edif });
      totalRegistros++;
    }
  });

  const payload = {
    ok: true,
    data: result,
    totalRegistros: totalRegistros,
    atualizado: new Date().toISOString()
  };

  util__cacheSet_(payload);
  return payload;
}

/* ──────────────────────────────────────────────────────────────
   2) LISTAR REGIÕES DISPONÍVEIS
   ────────────────────────────────────────────────────────────── */
function util_listarRegioes() {
  return Object.keys(COMARCA_REGIOES_MAP);
}

/* ──────────────────────────────────────────────────────────────
   3) LISTAR COMARCAS ÚNICAS DE UMA REGIÃO
   ────────────────────────────────────────────────────────────── */
function util_listarComarcasUnicas(regiao) {
  const reg = util__normRegiao_(regiao);
  const todos = util_carregarTodasComarcas();
  if (!todos || !todos.data || !todos.data[reg]) return [];
  const set = {};
  todos.data[reg].forEach(d => {
    if (d.comarca) set[d.comarca.toUpperCase()] = d.comarca;
  });
  return Object.values(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/* ──────────────────────────────────────────────────────────────
   4) LISTAR EDIFICAÇÕES DE UMA COMARCA
   ────────────────────────────────────────────────────────────── */
function util_listarEdificacoesPorComarca(regiao, comarca) {
  const reg = util__normRegiao_(regiao);
  const com = (comarca || '').toString().trim().toUpperCase();
  if (!com) return [];
  const todos = util_carregarTodasComarcas();
  if (!todos || !todos.data || !todos.data[reg]) return [];
  const set = {};
  todos.data[reg].forEach(d => {
    if (d.comarca.toUpperCase() === com && d.edificacao) {
      set[d.edificacao.toUpperCase()] = d.edificacao;
    }
  });
  return Object.values(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/* ──────────────────────────────────────────────────────────────
   5) INVALIDAR CACHE — chamar quando a planilha COMARCA for alterada
   ────────────────────────────────────────────────────────────── */
function util_invalidarCacheComarcas() {
  try {
    CacheService.getScriptCache().remove(COMARCA_CACHE_KEY);
    return { ok: true, msg: 'Cache invalidado.' };
  } catch (e) {
    return { ok: false, erro: e.toString() };
  }
}

/* ──────────────────────────────────────────────────────────────
   6) DIAGNÓSTICO — rodar pelo editor para verificar leitura
   ────────────────────────────────────────────────────────────── */
function util_diagnosticarComarcas() {
  util_invalidarCacheComarcas(); // força releitura
  const res = util_carregarTodasComarcas();
  if (!res.ok) {
    Logger.log('ERRO: ' + res.erro);
    return;
  }
  Logger.log('═══════════════════════════════════════════');
  Logger.log('DIAGNÓSTICO — ABA COMARCA');
  Logger.log('═══════════════════════════════════════════');
  Logger.log('Total de registros: ' + res.totalRegistros);
  Logger.log('Atualizado: ' + res.atualizado);
  Logger.log('');
  Object.keys(res.data).forEach(reg => {
    const arr = res.data[reg];
    Logger.log(reg + ': ' + arr.length + ' registros');
    arr.slice(0, 3).forEach(d => {
      Logger.log('  → ' + d.comarca + ' / ' + d.edificacao);
    });
    if (arr.length > 3) Logger.log('  ... (' + (arr.length - 3) + ' a mais)');
    Logger.log('');
  });

  // Teste: comarcas únicas NORTE
  Logger.log('--- Comarcas únicas em NORTE ---');
  const norteComarcas = util_listarComarcasUnicas('NORTE');
  Logger.log(norteComarcas.join(' | '));

  // Teste: edificações de Montes Claros
  Logger.log('');
  Logger.log('--- Edificações em "Montes Claros" (NORTE) ---');
  const mcEdifs = util_listarEdificacoesPorComarca('NORTE', 'Montes Claros');
  Logger.log(mcEdifs.join(' | '));
}