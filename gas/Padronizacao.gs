/**
 * ============================================================
 *  Padronizacao.gs — Correção de cabeçalhos com typos
 *  Ciclo 4 do COMAP Sistema Integrado
 * ============================================================
 *
 *  CONTEXTO:
 *    A auditoria detectou 2 typos ortográficos nos cabeçalhos
 *    da planilha (linha 1). NENHUM deles é referenciado pelo
 *    código backend (backend lê por posição/índice), então a
 *    correção é puramente cosmética e sem risco de quebrar nada.
 *
 *    Inconsistências corrigidas:
 *      1. EMERGENCIAIS col 8: 'DESCRIÇÃO SUCINTA DO PORBLEMA'
 *                           → 'DESCRIÇÃO SUCINTA DO PROBLEMA'
 *      2. PERIODICAS   col 5: 'GRUPO DA EDIFICAÇÂO' (Â circunflexo)
 *                           → 'GRUPO DA EDIFICAÇÃO' (Ã til)
 *
 *  COMO USAR:
 *    1. (opcional) Execute pad_diagnosticar() — dry-run, só lê e mostra.
 *    2. Execute pad_corrigirCabecalhos() — aplica a correção.
 *    3. Confira na planilha (linha 1) que os cabeçalhos foram trocados.
 *
 *  PROPRIEDADES:
 *    - IDEMPOTENTE: pode rodar várias vezes sem efeito colateral
 *    - LOG ESTRUTURADO: cada alteração registrada no LOG sheet
 *    - SEGURO: só altera se o valor atual bater EXATAMENTE com o esperado
 */

/* ─── Lista de correções a aplicar ─── */
const PAD_CORRECOES = [
  {
    aba:   'EMERGENCIAIS',
    coluna: 8,
    de:    'DESCRIÇÃO SUCINTA DO PORBLEMA',
    para:  'DESCRIÇÃO SUCINTA DO PROBLEMA',
    motivo: 'typo: PORBLEMA → PROBLEMA'
  },
  {
    aba:   'PERIODICAS',
    coluna: 5,
    de:    'GRUPO DA EDIFICAÇÂO',                 // Â com circunflexo
    para:  'GRUPO DA EDIFICAÇÃO',                 // Ã com til
    motivo: 'ortografia: EDIFICAÇÂO (Â) → EDIFICAÇÃO (Ã)'
  }
];

/**
 * DIAGNÓSTICO (dry-run): mostra o que SERIA alterado, sem mexer.
 */
function pad_diagnosticar() {
  const ss = ss_();
  const relatorio = {
    planilha: ss.getName(),
    timestamp: new Date().toISOString(),
    correcoes: []
  };

  PAD_CORRECOES.forEach(function(c) {
    const sh = ss.getSheetByName(c.aba);
    if (!sh) {
      relatorio.correcoes.push({
        aba: c.aba, coluna: c.coluna, status: 'ABA_INEXISTENTE'
      });
      return;
    }
    const valorAtual = sh.getRange(1, c.coluna).getValue();
    const sv = String(valorAtual || '');
    let status;
    if (sv === c.para) status = 'JA_CORRIGIDO';
    else if (sv === c.de) status = 'PRECISA_CORRIGIR';
    else status = 'INESPERADO';

    relatorio.correcoes.push({
      aba:    c.aba,
      coluna: c.coluna,
      valorAtual: sv,
      valorEsperado: c.para,
      status: status,
      motivo: c.motivo
    });
  });

  Logger.log(JSON.stringify(relatorio, null, 2));
  return relatorio;
}

/**
 * APLICA AS CORREÇÕES (escreve na planilha).
 *
 * Comportamento:
 *  - Se o valor atual já é o esperado → ignora (JA_CORRIGIDO)
 *  - Se o valor atual bate com "de" → substitui por "para" (CORRIGIDO)
 *  - Se o valor é diferente de ambos → não toca, registra como INESPERADO
 */
function pad_corrigirCabecalhos() {
  const ss = ss_();
  const relatorio = {
    planilha: ss.getName(),
    timestamp: new Date().toISOString(),
    alteracoes: 0,
    ignorados: 0,
    inesperados: 0,
    detalhe: []
  };

  PAD_CORRECOES.forEach(function(c) {
    const sh = ss.getSheetByName(c.aba);
    if (!sh) {
      relatorio.detalhe.push({
        aba: c.aba, coluna: c.coluna, status: 'ABA_INEXISTENTE', motivo: c.motivo
      });
      return;
    }

    const cel = sh.getRange(1, c.coluna);
    const sv = String(cel.getValue() || '');

    if (sv === c.para) {
      relatorio.ignorados++;
      relatorio.detalhe.push({
        aba: c.aba, coluna: c.coluna, status: 'JA_CORRIGIDO',
        valor: sv, motivo: c.motivo
      });
      return;
    }

    if (sv === c.de) {
      cel.setValue(c.para);
      relatorio.alteracoes++;
      relatorio.detalhe.push({
        aba: c.aba, coluna: c.coluna, status: 'CORRIGIDO',
        de: c.de, para: c.para, motivo: c.motivo
      });
      try { log_('INFO', 'PAD', 'PAD_CORRIGIR_CABEC', { aba: c.aba, col: c.coluna, de: c.de, para: c.para }); } catch(e){}
      return;
    }

    relatorio.inesperados++;
    relatorio.detalhe.push({
      aba: c.aba, coluna: c.coluna, status: 'INESPERADO',
      valorAtual: sv, valorEsperado: c.para, motivo: c.motivo,
      observacao: 'Valor não bate com "de" nem com "para" — provavelmente já foi alterado manualmente. Não toquei.'
    });
  });

  Logger.log(JSON.stringify(relatorio, null, 2));
  return relatorio;
}