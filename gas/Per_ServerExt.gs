/**
 * Per_ServerExt.gs — Extensões da Periódica
 * --------------------------------------------------------------
 * Funções novas:
 *   - per_listarCalendarioMes(ano, mes, sessao) → dados do mês para o calendário
 *   - per_buscarPeriodicasDosDias(datas[], sessao) → modal de conclusão em massa
 *   - per_concluirEmMassa(ids[], dadosComuns, sessao) → conclusão em lote
 *   - per_lancarMassaCSV(csv, sessao) → lançamento em massa
 *
 * Estrutura da aba PERIODICAS (18 colunas):
 *   1=ID, 2=REGIÃO, 3=COMARCA, 4=EDIFICAÇÃO, 5=GRUPO, 6=TIPO_ATENDIMENTO,
 *   7=DATA_INICIO, 8=DATA_CONCLUSAO, 9=STATUS, 10=DIAS_TRAB, 11=CRONOGRAMA,
 *   12=CONTRATO, 13=PROG_INICIAL, 14=PROG_FINAL,
 *   15=HOJE (=TODAY() fórmula, NÃO sobrescrever),
 *   16=MEDIÇÃO, 17=ATIVIDADE (PENDENTE), 18=ATIVIDADE
 */

const PER_SHEET_NAME = "PERIODICAS";
const PER_REGIOES_GLOBAIS = ['MASTER', 'ADMIN', 'COORD', 'COORDENADOR'];

/* ──────────────────────────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────────────────────────── */

/**
 * Retorna true se a sessão tem acesso global (vê todas as regiões).
 * Default: assume acesso global se sessão for vazia (segurança - mas em
 * produção o frontend deve sempre passar a sessão correta).
 */
function per__sessaoGlobal_(sessao) {
  if (!sessao) return true;
  const r = (sessao.regiao || '').toString().toUpperCase();
  return sessao.global === true ||
         sessao.global === '1' ||
         PER_REGIOES_GLOBAIS.indexOf(r) >= 0;
}

function per__sessaoRegiao_(sessao) {
  return sessao && sessao.regiao ? sessao.regiao.toString().toUpperCase() : '';
}

/**
 * Converte qualquer formato de data para 'yyyy-MM-dd' (ou string vazia).
 * Aceita: Date, string ISO "yyyy-MM-dd" (com ou sem hora), string BR "dd/MM/yyyy",
 * timestamp, ou ISO completa. Usa GMT-3 como referência.
 */
function per__dataISO_(v) {
  if (v === null || v === undefined || v === '') return '';

  // Date object — formatar direto em GMT-3
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, 'GMT-3', 'yyyy-MM-dd');
  }

  const s = v.toString().trim();
  if (!s) return '';

  // ISO "yyyy-MM-dd" (com ou sem T...) — pegar apenas a parte da data
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
  }

  // BR "dd/MM/yyyy"
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    return brMatch[3] + '-' + ('0' + brMatch[2]).slice(-2) + '-' + ('0' + brMatch[1]).slice(-2);
  }

  // Number serial do Sheets
  if (typeof v === 'number' && v > 0) {
    // Excel/Sheets serial: dias desde 1899-12-30
    const ms = (v - 25569) * 86400 * 1000;
    return Utilities.formatDate(new Date(ms), 'GMT-3', 'yyyy-MM-dd');
  }

  // Fallback: tentar Date(s) — se for ISO sem timezone, JS interpreta como UTC.
  // Forçamos GMT-3 com formatDate pra evitar deslocamento.
  const d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'GMT-3', 'yyyy-MM-dd');
  return '';
}

/**
 * Lê a aba PERIODICAS aplicando filtro de região por sessão.
 * Retorna array de objetos com chaves nomeadas.
 */
function per__lerLinhasComSessao_(sessao) {
  const ss = ss_();
  const sheet = ss.getSheetByName(PER_SHEET_NAME);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(18, sheet.getLastColumn());
  if (lastRow < 2) return [];

  const valores = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const global = per__sessaoGlobal_(sessao);
  const minhaRegiao = per__sessaoRegiao_(sessao);

  const linhas = [];
  for (let i = 0; i < valores.length; i++) {
    const row = valores[i];
    if (!row[0] && !row[1]) continue; // linha vazia

    const regiao = (row[1] || '').toString().toUpperCase();
    if (!global && minhaRegiao && regiao !== minhaRegiao) continue;

    linhas.push({
      _row: i + 2, // 1-indexed na planilha
      id: row[0],
      regiao: regiao,
      comarca: row[2] || '',
      edificacao: row[3] || '',
      grupo: row[4] || '',
      tipo: row[5] || '',
      dataInicio: per__dataISO_(row[6]),
      dataConclusao: per__dataISO_(row[7]),
      status: (row[8] || '').toString(),
      diasTrab: row[9] || '',
      cronograma: row[10] || '',
      contrato: row[11] || '',
      progInicial: per__dataISO_(row[12]),
      progFinal: per__dataISO_(row[13]),
      medicao: (row[15] || '').toString(),
      atividadePendente: (row[16] || '').toString(),
      atividade: (row[17] || '').toString()
    });
  }
  return linhas;
}

/* ──────────────────────────────────────────────────────────────
   1) CALENDÁRIO MENSAL
   Retorna dados do mês para renderizar o calendário no frontend.
   Cada dia: lista de periódicas onde PROG_INICIAL ou PROG_FINAL
   cai dentro do dia, OU se o dia está entre INICIAL e FINAL.
   ────────────────────────────────────────────────────────────── */
function per_listarCalendarioMes(ano, mes, sessao) {
  ano = parseInt(ano, 10);
  mes = parseInt(mes, 10); // 1-12

  if (!ano || !mes || mes < 1 || mes > 12) {
    return { ok: false, erro: 'Ano/mês inválido', dias: {} };
  }

  // Limite do mês
  const ini = ano + '-' + ('0' + mes).slice(-2) + '-01';
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = ano + '-' + ('0' + mes).slice(-2) + '-' + ('0' + ultimoDia).slice(-2);

  const todas = per__lerLinhasComSessao_(sessao);
  const hoje = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd');

  // Contar por dia: {data: {concluidas, pendentes, atraso, total, ids:[]}}
  const dias = {};
  for (let d = 1; d <= ultimoDia; d++) {
    const k = ano + '-' + ('0' + mes).slice(-2) + '-' + ('0' + d).slice(-2);
    dias[k] = { data: k, concluidas: 0, pendentes: 0, atraso: 0, total: 0, ids: [] };
  }

  let totConcluidas = 0, totPendentes = 0, totAtraso = 0;
  // Conjuntos para deduplicar contagem total do mês
  const idsConcluidas = {}, idsPendentes = {}, idsAtraso = {};

  for (const p of todas) {
    if (!p.progInicial || !p.progFinal) continue;
    // Periódica é "ativa" do dia progInicial até progFinal (inclusive)
    // Intersecta o mês se progInicial <= fim AND progFinal >= ini
    if (p.progInicial > fim || p.progFinal < ini) continue;

    const isConcluida = (p.status || '').toUpperCase().indexOf('CONCLU') >= 0;
    const isAtraso = !isConcluida && p.progFinal < hoje;

    // Marcar o ID nos totais únicos do mês
    const idStr = (p.id || '').toString();
    if (isConcluida)     idsConcluidas[idStr] = true;
    else if (isAtraso)   idsAtraso[idStr] = true;
    else                 idsPendentes[idStr] = true;

    // Marcar a periódica em CADA dia do intervalo que cai no mês
    // start = max(progInicial, ini)
    // end   = min(progFinal, fim)
    const start = p.progInicial > ini ? p.progInicial : ini;
    const end   = p.progFinal   < fim ? p.progFinal   : fim;

    // Iterar dia a dia (max 31 iterações por periódica)
    let cursor = start;
    while (cursor <= end) {
      const dia = dias[cursor];
      if (dia) {
        dia.total++;
        dia.ids.push(p.id);
        if (isConcluida)     dia.concluidas++;
        else if (isAtraso)   dia.atraso++;
        else                 dia.pendentes++;
      }
      // Próximo dia
      const dObj = new Date(cursor + 'T12:00:00');
      dObj.setDate(dObj.getDate() + 1);
      cursor = Utilities.formatDate(dObj, 'GMT-3', 'yyyy-MM-dd');
    }
  }

  totConcluidas = Object.keys(idsConcluidas).length;
  totPendentes  = Object.keys(idsPendentes).length;
  totAtraso     = Object.keys(idsAtraso).length;

  return {
    ok: true,
    ano: ano,
    mes: mes,
    hoje: hoje,
    minhaRegiao: per__sessaoRegiao_(sessao),
    global: per__sessaoGlobal_(sessao),
    dias: dias,
    totais: {
      concluidas: totConcluidas,
      pendentes: totPendentes,
      atraso: totAtraso,
      total: totConcluidas + totPendentes + totAtraso
    }
  };
}

/* ──────────────────────────────────────────────────────────────
   2) BUSCAR PERIODICAS DE DIAS SELECIONADOS
   Recebe array de datas 'yyyy-MM-dd' (1+ dias) e retorna lista
   detalhada das periódicas com PROG_FINAL nesses dias.
   Usado pelo modal de conclusão em massa.
   ────────────────────────────────────────────────────────────── */
function per_buscarPeriodicasDosDias(datas, sessao) {
  if (!Array.isArray(datas) || !datas.length) {
    return { ok: false, erro: 'Nenhum dia informado.', linhas: [] };
  }

  const setDatas = {};
  datas.forEach(d => setDatas[d] = true);

  const todas = per__lerLinhasComSessao_(sessao);
  const hoje = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd');

  const resultado = [];
  for (const p of todas) {
    if (!p.progInicial || !p.progFinal) continue;
    // Verifica se QUALQUER dia selecionado está dentro do intervalo [progInicial, progFinal]
    let bate = false;
    for (const d in setDatas) {
      if (d >= p.progInicial && d <= p.progFinal) { bate = true; break; }
    }
    if (!bate) continue;

    const isConcluida = (p.status || '').toUpperCase().indexOf('CONCLU') >= 0;
    const isAtraso = !isConcluida && p.progFinal < hoje;

    resultado.push({
      id: p.id,
      regiao: p.regiao,
      comarca: p.comarca,
      edificacao: p.edificacao,
      grupo: p.grupo,
      tipo: p.tipo,
      progInicial: p.progInicial,
      progFinal: p.progFinal,
      dataInicio: p.dataInicio,
      dataConclusao: p.dataConclusao,
      contrato: p.contrato,
      status: p.status,
      medicao: p.medicao,
      atividadePendente: p.atividadePendente,
      atividade: p.atividade,
      _flag: isConcluida ? 'concluida' : (isAtraso ? 'atraso' : 'pendente')
    });
  }

  // Ordenar: pendentes/atraso primeiro, depois concluídas
  resultado.sort((a, b) => {
    if (a._flag === b._flag) {
      return (a.comarca + a.edificacao).localeCompare(b.comarca + b.edificacao);
    }
    if (a._flag === 'concluida') return 1;
    if (b._flag === 'concluida') return -1;
    if (a._flag === 'atraso') return -1;
    if (b._flag === 'atraso') return 1;
    return 0;
  });

  return { ok: true, linhas: resultado };
}

/* ──────────────────────────────────────────────────────────────
   3) CONCLUSÃO EM MASSA
   Recebe array de IDs e dados comuns para aplicar em todos.
   ────────────────────────────────────────────────────────────── */
function per_concluirEmMassa(ids, dadosComuns, sessao) {
  if (!Array.isArray(ids) || !ids.length) {
    return { ok: false, erro: 'Nenhuma periódica selecionada.' };
  }
  if (!dadosComuns || !dadosComuns.dataInicio || !dadosComuns.dataConclusao) {
    return { ok: false, erro: 'Data início e data conclusão são obrigatórias.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const ss = ss_();
    const sheet = ss.getSheetByName(PER_SHEET_NAME);
    if (!sheet) return { ok: false, erro: 'Aba PERIODICAS não encontrada.' };

    const data = sheet.getDataRange().getValues();
    const setIds = {};
    ids.forEach(i => setIds[i.toString()] = true);

    const global = per__sessaoGlobal_(sessao);
    const minhaRegiao = per__sessaoRegiao_(sessao);

    let atualizadas = 0;
    const erros = [];

    for (let i = 1; i < data.length; i++) {
      const idLinha = (data[i][0] || '').toString();
      if (!setIds[idLinha]) continue;

      // Bloqueio de região
      const regiao = (data[i][1] || '').toString().toUpperCase();
      if (!global && minhaRegiao && regiao !== minhaRegiao) {
        erros.push('ID ' + idLinha + ': sem permissão (região ' + regiao + ').');
        continue;
      }

      const dIni = dadosComuns.dataInicio;
      const dFim = dadosComuns.dataConclusao;
      const progFim = per__dataISO_(data[i][13]);

      // Calcular status
      let status = 'AGENDADO';
      let diasTrab = '';
      if (dIni && dFim) {
        status = (progFim && dFim > progFim) ? 'CONCLUÍDO (ATRASO)' : 'CONCLUÍDO (NO PRAZO)';
        const d1 = new Date(dIni + 'T12:00:00');
        const d2 = new Date(dFim + 'T12:00:00');
        diasTrab = Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
      } else if (dIni) {
        status = 'EM ANDAMENTO';
      }

      const linhaPlanilha = i + 1;

      // Atualizar colunas G(7)=DATA INÍCIO, H(8)=DATA CONCLUSÃO, I(9)=STATUS, J(10)=DIAS TRAB
      sheet.getRange(linhaPlanilha, 7, 1, 4).setValues([[dIni, dFim, status, diasTrab]]);

      // Atualizar colunas P(16)=MEDIÇÃO, Q(17)=ATIV.PEND, R(18)=ATIVIDADE
      // Mantém valores existentes se não vierem novos
      const medAtual = (data[i][15] || '').toString();
      const apAtual  = (data[i][16] || '').toString();
      const atAtual  = (data[i][17] || '').toString();
      sheet.getRange(linhaPlanilha, 16, 1, 3).setValues([[
        dadosComuns.medicao         != null && dadosComuns.medicao         !== '' ? dadosComuns.medicao         : medAtual,
        dadosComuns.atividadePendente != null && dadosComuns.atividadePendente !== '' ? dadosComuns.atividadePendente : apAtual,
        dadosComuns.atividade       != null && dadosComuns.atividade       !== '' ? dadosComuns.atividade       : atAtual
      ]]);

      atualizadas++;
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      atualizadas: atualizadas,
      erros: erros,
      msg: atualizadas + ' periódica(s) concluída(s) com sucesso.' +
           (erros.length ? ' Atenção: ' + erros.length + ' erro(s).' : '')
    };
  } catch (e) {
    return { ok: false, erro: e.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

/* ──────────────────────────────────────────────────────────────
   4) LANÇAMENTO EM MASSA VIA CSV
   Aceita CSV com cabeçalho (separador , ou ;), datas ISO ou BR.
   Colunas mínimas obrigatórias:
     REGIAO, COMARCA, EDIFICACAO, GRUPO, TIPO_ATENDIMENTO,
     PROG_INICIAL, PROG_FINAL, CONTRATO
   Colunas opcionais:
     MEDICAO, ATIVIDADE_PENDENTE
   ────────────────────────────────────────────────────────────── */
function per_lancarMassaCSV(csvText, sessao) {
  if (!csvText || !csvText.trim()) {
    return { ok: false, erro: 'CSV vazio.', linhasInseridas: 0 };
  }

  const parsed = per__parseCSV_(csvText);
  if (!parsed.linhas.length) {
    return { ok: false, erro: 'CSV não contém linhas válidas.', linhasInseridas: 0 };
  }

  // Mapear cabeçalhos para nomes canônicos
  const norm = s => s.toString().toUpperCase()
    .replace(/[ÁÀÃÂÄ]/g, 'A').replace(/[ÉÊË]/g, 'E')
    .replace(/[ÍÎÏ]/g, 'I').replace(/[ÓÔÕÖ]/g, 'O')
    .replace(/[ÚÛÜ]/g, 'U').replace(/[Ç]/g, 'C')
    .replace(/[^A-Z0-9]/g, '');

  const alias = {
    'REGIAO': 'regiao',
    'COMARCA': 'comarca',
    'EDIFICACAO': 'edificacao',
    'GRUPO': 'grupo',
    'GRUPODAEDIFICACAO': 'grupo',
    'TIPODEATENDIMENTO': 'tipo',
    'TIPOATENDIMENTO': 'tipo',
    'TIPO': 'tipo',
    'PROGRAMADOINICIAL': 'progInicial',
    'PROGINICIAL': 'progInicial',
    'DATAINICIALDOCRONOGRAMA': 'progInicial',
    'DATAINICIAL': 'progInicial',
    'PROGRAMADOFINAL': 'progFinal',
    'PROGFINAL': 'progFinal',
    'DATAFINALDOCRONOGRAMA': 'progFinal',
    'DATAFINAL': 'progFinal',
    'CONTRATO': 'contrato',
    'MEDICAO': 'medicao',
    'ATIVIDADEPENDENTE': 'atividadePendente',
    'ATIVIDADE': 'atividadePendente'
  };

  const headerMap = parsed.header.map(h => alias[norm(h)] || null);
  const obrigatorios = ['regiao', 'comarca', 'edificacao', 'grupo', 'tipo', 'progInicial', 'progFinal', 'contrato'];
  const presentes = headerMap.filter(h => h !== null);
  const faltando = obrigatorios.filter(o => presentes.indexOf(o) < 0);

  if (faltando.length) {
    return {
      ok: false,
      erro: 'Cabeçalho do CSV está faltando colunas obrigatórias: ' + faltando.join(', '),
      linhasInseridas: 0,
      headerLido: parsed.header
    };
  }

  // Construir registros
  const global = per__sessaoGlobal_(sessao);
  const minhaRegiao = per__sessaoRegiao_(sessao);
  const erros = [];
  const registros = [];

  for (let i = 0; i < parsed.linhas.length; i++) {
    const cols = parsed.linhas[i];
    const reg = {};
    for (let j = 0; j < headerMap.length; j++) {
      if (headerMap[j]) reg[headerMap[j]] = (cols[j] || '').toString().trim();
    }

    // Validações
    if (!reg.regiao) { erros.push('Linha ' + (i + 2) + ': REGIÃO vazia.'); continue; }
    reg.regiao = reg.regiao.toUpperCase();
    if (!global && minhaRegiao && reg.regiao !== minhaRegiao) {
      erros.push('Linha ' + (i + 2) + ': região ' + reg.regiao + ' fora do seu acesso (' + minhaRegiao + ').');
      continue;
    }

    reg.comarca = (reg.comarca || '').toUpperCase();
    reg.edificacao = (reg.edificacao || '').toUpperCase();
    reg.grupo = (reg.grupo || '').toUpperCase();
    reg.tipo = (reg.tipo || '').toUpperCase();

    reg.progInicial = per__dataISO_(reg.progInicial);
    reg.progFinal = per__dataISO_(reg.progFinal);

    if (!reg.progInicial || !reg.progFinal) {
      erros.push('Linha ' + (i + 2) + ': data inicial e/ou final inválida ou vazia.');
      continue;
    }

    if (!reg.comarca || !reg.edificacao || !reg.tipo) {
      erros.push('Linha ' + (i + 2) + ': comarca, edificação ou tipo vazio.');
      continue;
    }

    registros.push(reg);
  }

  if (!registros.length) {
    return {
      ok: false,
      erro: 'Nenhuma linha válida no CSV.',
      linhasInseridas: 0,
      erros: erros
    };
  }

  // Gravar tudo
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const ss = ss_();
    const sheet = ss.getSheetByName(PER_SHEET_NAME);
    if (!sheet) return { ok: false, erro: 'Aba PERIODICAS não encontrada.' };

    const lastRow = sheet.getLastRow();
    let ultimoId = 0;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (const r of ids) {
        const n = parseFloat(r[0]);
        if (!isNaN(n) && n > ultimoId) ultimoId = n;
      }
    }

    const novasLinhas = registros.map(reg => {
      ultimoId++;
      return [
        ultimoId, reg.regiao, reg.comarca, reg.edificacao, reg.grupo, reg.tipo,
        '', '', 'AGENDADO', '', '', reg.contrato, reg.progInicial, reg.progFinal
      ];
    });

    // Gravar colunas 1-14
    const inicio = sheet.getLastRow() + 1;
    sheet.getRange(inicio, 1, novasLinhas.length, 14).setValues(novasLinhas);

    // Gravar colunas 16-18 (MEDIÇÃO, ATIV.PEND, ATIVIDADE)
    const extras = registros.map(reg => [
      reg.medicao || '',
      reg.atividadePendente || '',
      ''  // ATIVIDADE (realizada) sempre vazia no lançamento
    ]);
    sheet.getRange(inicio, 16, extras.length, 3).setValues(extras);

    SpreadsheetApp.flush();
    return {
      ok: true,
      linhasInseridas: registros.length,
      erros: erros,
      msg: registros.length + ' periódica(s) lançada(s) com sucesso.' +
           (erros.length ? ' Atenção: ' + erros.length + ' linha(s) com erro foram ignoradas.' : '')
    };
  } catch (e) {
    return { ok: false, erro: e.toString(), linhasInseridas: 0 };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

/**
 * Parser CSV simples: detecta delimitador ; ou , automaticamente.
 * Suporta valores entre aspas.
 */
function per__parseCSV_(text) {
  // Detectar delimitador pela primeira linha
  const primeiraLinha = text.split(/\r?\n/)[0] || '';
  const delim = (primeiraLinha.match(/;/g) || []).length >
                (primeiraLinha.match(/,/g) || []).length ? ';' : ',';

  const linhas = [];
  let header = [];
  const allLines = text.split(/\r?\n/);

  for (let li = 0; li < allLines.length; li++) {
    const linha = allLines[li];
    if (!linha.trim()) continue;
    const cols = per__parseCSVLine_(linha, delim);
    if (!header.length) {
      header = cols.map(c => c.trim());
    } else {
      linhas.push(cols);
    }
  }
  return { header: header, linhas: linhas };
}

function per__parseCSVLine_(linha, delim) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (inQuotes && linha[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map(s => s.trim());
}


/* ──────────────────────────────────────────────────────────────
   5) BUSCAR PERIODICAS POR PERÍODO PLANEJADO
   Recebe progDe / progAte (período de medição) e retorna
   periódicas cujo intervalo [progInicial, progFinal] tem
   QUALQUER sobreposição com o período informado.
   Se apenasAbertas=true, filtra fora as já concluídas.
   ────────────────────────────────────────────────────────────── */
function per_buscarPeriodicasDoPeriodo(progDe, progAte, apenasAbertas, sessao) {
  progDe  = (progDe  || '').toString();
  progAte = (progAte || '').toString();
  if (!progDe || !progAte) {
    return { ok: false, erro: 'Informe o período DE e ATÉ.', linhas: [] };
  }
  if (progDe > progAte) {
    return { ok: false, erro: 'Período inválido: DE > ATÉ.', linhas: [] };
  }

  const todas = per__lerLinhasComSessao_(sessao);
  const hoje = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd');

  const resultado = [];
  for (const p of todas) {
    if (!p.progInicial || !p.progFinal) continue;
    // Intersecção: progFinal >= progDe AND progInicial <= progAte
    if (p.progFinal < progDe || p.progInicial > progAte) continue;

    const isConcluida = (p.status || '').toUpperCase().indexOf('CONCLU') >= 0;
    const isAtraso = !isConcluida && p.progFinal < hoje;

    if (apenasAbertas && isConcluida) continue;

    resultado.push({
      id: p.id,
      regiao: p.regiao,
      comarca: p.comarca,
      edificacao: p.edificacao,
      grupo: p.grupo,
      tipo: p.tipo,
      progInicial: p.progInicial,
      progFinal: p.progFinal,
      dataInicio: p.dataInicio,
      dataConclusao: p.dataConclusao,
      contrato: p.contrato,
      status: p.status,
      medicao: p.medicao,
      atividadePendente: p.atividadePendente,
      atividade: p.atividade,
      _flag: isConcluida ? 'concluida' : (isAtraso ? 'atraso' : 'pendente')
    });
  }

  // Ordenar: atraso > pendente > concluída, depois alfabético
  resultado.sort((a, b) => {
    const ord = { atraso: 0, pendente: 1, concluida: 2 };
    const da = ord[a._flag], db = ord[b._flag];
    if (da !== db) return da - db;
    return (a.comarca + a.edificacao).localeCompare(b.comarca + b.edificacao);
  });

  return {
    ok: true,
    progDe: progDe,
    progAte: progAte,
    total: resultado.length,
    linhas: resultado
  };
}


/* ──────────────────────────────────────────────────────────────
   DIAGNÓSTICO: retorna primeiros N registros da região
   sem nenhum filtro, com formato bruto e formatado.
   Útil pra debugar problema de dados.
   ────────────────────────────────────────────────────────────── */
function per_diagnosticar(sessao, limite) {
  limite = parseInt(limite, 10) || 10;
  try {
    const ss = ss_();
    const sheet = ss.getSheetByName(PER_SHEET_NAME);
    if (!sheet) return { ok: false, erro: 'Aba "' + PER_SHEET_NAME + '" não encontrada.' };

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(18, sheet.getLastColumn());
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    if (lastRow < 2) return { ok: true, totalLinhas: 0, header: header, exemplos: [] };

    const minhaRegiao = per__sessaoRegiao_(sessao);
    const global = per__sessaoGlobal_(sessao);

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const exemplos = [];
    let totalRegiao = 0;
    let totalAgendados = 0;
    let totalConcluidas = 0;

    for (let i = 0; i < data.length && exemplos.length < limite; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue;
      const regiao = (row[1] || '').toString().toUpperCase();
      if (!global && minhaRegiao && regiao !== minhaRegiao) continue;

      totalRegiao++;
      const status = (row[8] || '').toString().toUpperCase();
      if (status.indexOf('AGENDA') >= 0) totalAgendados++;
      else if (status.indexOf('CONCLU') >= 0) totalConcluidas++;

      exemplos.push({
        linha: i + 2,
        id: row[0],
        regiao: row[1],
        comarca: row[2],
        edificacao: row[3],
        status: row[8],
        progInicial_RAW: row[12],
        progInicial_TIPO: (typeof row[12]) + (row[12] instanceof Date ? ' (Date)' : ''),
        progInicial_ISO: per__dataISO_(row[12]),
        progFinal_RAW: row[13],
        progFinal_TIPO: (typeof row[13]) + (row[13] instanceof Date ? ' (Date)' : ''),
        progFinal_ISO: per__dataISO_(row[13]),
        medicao: row[15],
        atividadePendente: row[16],
        atividade: row[17]
      });
    }

    return {
      ok: true,
      regiaoSessao: minhaRegiao || '(global)',
      global: global,
      totalLinhasPlanilha: lastRow - 1,
      totalNaRegiao: totalRegiao,
      totalAgendados: totalAgendados,
      totalConcluidas: totalConcluidas,
      header: header,
      exemplos: exemplos
    };
  } catch (e) {
    return { ok: false, erro: e.toString(), stack: e.stack };
  }
}

/**
 * Retorna um exemplo de CSV para o usuário copiar
 */
function per_csvExemplo() {
  return [
    'REGIAO;COMARCA;EDIFICACAO;GRUPO;TIPO_ATENDIMENTO;PROG_INICIAL;PROG_FINAL;CONTRATO;MEDICAO;ATIVIDADE_PENDENTE',
    'NORTE;MONTES CLAROS;NOVO FÓRUM;A;MANUTENÇÃO PERIÓDICA TRIMESTRAL;16/05/2026;15/06/2026;017/2026;MAIO/2026;Vistoria geral conforme Anexo B',
    'NORTE;TEÓFILO OTONI;FÓRUM;B;MANUTENÇÃO PERIÓDICA TRIMESTRAL;16/05/2026;15/06/2026;017/2026;MAIO/2026;Vistoria geral conforme Anexo B',
    'NORTE;PARACATU;FÓRUM;C;MANUTENÇÃO PERIÓDICA TRIMESTRAL;16/05/2026;15/06/2026;017/2026;MAIO/2026;Inspeção sistemas civil + elétrico'
  ].join('\n');
}