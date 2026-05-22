/**
 * ============================================================
 *  Config.gs — COMAP Sistema Integrado (1 planilha única)
 * ============================================================
 *
 *  CORREÇÃO CRÍTICA v5:
 *    Todos os nomes de aba agora batem EXATAMENTE com a planilha
 *    "MANUTENÇÕES COMAP — Planilha de Controle".
 *
 *    Antes: 'PERIODICAS' (config) ≠ 'PERIÓDICAS' (código)
 *    Agora: TUDO sem acento, igual à planilha real.
 *
 *  Abas reais auditadas na planilha unificada:
 *    EMERGENCIAIS | PERIODICAS | PROGRAMADAS | LAUDOS | PCI
 *    USUARIOS | COMARCA | LOG | DIARIO | _AUX_LISTAS
 */

const CONFIG = Object.freeze({

  /* ─── ABAS DA PLANILHA ÚNICA (nomes EXATOS) ─── */
  ABAS: {
    USUARIOS:     'USUARIOS',
    EMERGENCIAIS: 'EMERGENCIAIS',
    PERIODICAS:   'PERIODICAS',     // ★ SEM acento — confirmado em auditoria
    PROGRAMADAS:  'PROGRAMADAS',
    PCI:          'PCI',
    LAUDOS:       'LAUDOS',
    COMARCA:      'COMARCA',
    DIARIO:       'DIARIO',
    LOG:          'LOG'
  },

  /* ─── ALIASES DE COMPATIBILIDADE (mantém Auth.gs e Utils.gs antigos funcionando) ─── *
   * NÃO REMOVER. Esses nomes são usados em código legado:                              *
   *   - CONFIG.USUARIOS_SHEET → Auth.gs (validarLoginCentral)                          *
   *   - CONFIG.LOG_SHEET      → Utils.gs (log_) e Code.gs antigo                       *
   * Eles apontam para o MESMO valor que CONFIG.ABAS.*                                  */
  USUARIOS_SHEET: 'USUARIOS',
  LOG_SHEET:      'LOG',

  /* ─── MÓDULOS do dashboard inicial ─── */
  MODULOS: {
    emergencial: { sheet: 'EMERGENCIAIS', label: 'Emergencial',     icone: '🚨', cor: '#dc2626', ordem: 1 },
    periodica:   { sheet: 'PERIODICAS',   label: 'Periódica',        icone: '🔄', cor: '#0ea5e9', ordem: 2 },
   // programada:  { sheet: 'PROGRAMADAS',  label: 'Programada (OSP)', icone: '📋', cor: '#7c3aed', ordem: 3 },
    pci:         { sheet: 'PCI',          label: 'PCI',              icone: '🔥', cor: '#f59e0b', ordem: 4 },
    laudos:      { sheet: 'LAUDOS',       label: 'Laudos',           icone: '📑', cor: '#16a34a', ordem: 5 }
  },

  /* ─── COLUNAS QUE GUARDAM "REGIÃO" EM CADA ABA (1-indexed) ─── */
  COL_REGIAO: {
    EMERGENCIAIS: 4,   // col D
    PERIODICAS:   2,   // col B
    PROGRAMADAS:  3,   // col C
    PCI:          4,   // col D
    LAUDOS:       4    // col D
  },

  /* ─── PERFIS / REGIÕES ─── */
  REGIOES_GLOBAIS: ['MASTER', 'ADMIN', 'COORD', 'COORDENADOR'],
  REGIOES: ['NORTE','CENTRAL','LESTE','SUL','SUDOESTE','TRIANGULO','ZONA_DA_MATA'],

  /* ─── SESSÃO ─── */
  SESSAO_TTL_HORAS: 12,

  /* ─── METADADOS ─── */
  VERSAO: '5.0.0',
  TITULO: 'COMAP — Sistema Integrado TJMG',
  CONTRATO_PADRAO: '017/2026'
});

/** Retorna o SHEET_ID configurado nas propriedades do script. */
function getSheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) {
    throw new Error(
      'SHEET_ID nao configurado.\n\n' +
      'No editor do Apps Script, abra Config.gs e rode setup() uma vez.\n' +
      'Antes, edite a constante SHEET_ID_AQUI dentro de setup() para o ID da sua planilha.\n' +
      'O ID e a parte da URL entre /d/ e /edit no Google Sheets.'
    );
  }
  return id;
}

/** Abre a planilha unificada. */
function ss_() {
  return SpreadsheetApp.openById(getSheetId_());
}

/**
 * SETUP — execute UMA VEZ no editor.
 * Edite a constante SHEET_ID_AQUI antes de rodar.
 */
function setup() {
  const SHEET_ID_AQUI = 'SUBSTITUA_AQUI_PELO_ID_DA_PLANILHA';

  if (SHEET_ID_AQUI === 'SUBSTITUA_AQUI_PELO_ID_DA_PLANILHA') {
    throw new Error('Edite setup() em Config.gs e cole o ID real da planilha.');
  }

  PropertiesService.getScriptProperties().setProperty('SHEET_ID', SHEET_ID_AQUI);
  const ss = SpreadsheetApp.openById(SHEET_ID_AQUI);
  Logger.log('Planilha vinculada: ' + ss.getName());
  return diagnosticarPlanilha();
}

/**
 * DIAGNÓSTICO — confere se TODAS as abas obrigatórias existem,
 * e se a aba PERIODICAS tem registros AGENDADO acessíveis.
 *
 * Como executar:
 *   1. No editor, escolha a função "diagnosticarPlanilha" e clique em Executar.
 *   2. Veja em Logs > Stackdriver (ou Ctrl+Enter) o relatório completo.
 *
 * Retorno:
 *   { ok, planilha, abas: {nome: {ok, linhas, ...}}, periodicas: {agendado, concluido, ...} }
 */
function diagnosticarPlanilha() {
  const ss = ss_();
  const resultado = {
    ok: true,
    planilha: ss.getName(),
    id: ss.getId(),
    abas: {},
    periodicas: null,
    erros: []
  };

  // 1. Verifica cada aba obrigatória
  Object.keys(CONFIG.ABAS).forEach(chave => {
    const nome = CONFIG.ABAS[chave];
    const sh = ss.getSheetByName(nome);
    if (!sh) {
      resultado.abas[nome] = { ok: false, erro: 'NAO ENCONTRADA' };
      resultado.erros.push('Aba "' + nome + '" nao existe na planilha.');
      resultado.ok = false;
      return;
    }
    resultado.abas[nome] = {
      ok: true,
      linhas: sh.getLastRow(),
      colunas: sh.getLastColumn()
    };
  });

  // 2. Diagnóstico específico PERIODICAS
  const shPer = ss.getSheetByName(CONFIG.ABAS.PERIODICAS);
  if (shPer && shPer.getLastRow() > 1) {
    const dados = shPer.getDataRange().getValues();
    let agendado = 0, concluido = 0, andamento = 0, vazio = 0;
    for (let i = 1; i < dados.length; i++) {
      if (!dados[i][0]) continue;  // sem ITEM = ignora
      const s = String(dados[i][8] || '').toUpperCase();
      if (s.includes('AGENDADO')) agendado++;
      else if (s.includes('CONCLU')) concluido++;
      else if (s.includes('ANDAMENTO')) andamento++;
      else vazio++;
    }
    resultado.periodicas = { agendado, concluido, andamento, vazio, total: agendado+concluido+andamento+vazio };
  }

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}