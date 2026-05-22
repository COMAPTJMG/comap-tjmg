/**
 * Módulo PER — adaptado para o sistema COMAP Unificado.
 * Funções públicas: per_<nome>  (ex: per_getDados)
 * Constantes top-level: PER_<NOME>
 */

/**
 * SISTEMA DE GESTÃO DE MANUTENÇÃO - TJMG
 * Versão: 4.3 — Velocímetro SVG no e-mail + liberação de Grupo/Tipo no modo edição
 *
 * CORREÇÕES v4.3:
 * - EMAIL: velocímetro agora é SVG puro inline (sem JS), renderiza corretamente no Gmail
 * - EMAIL: layout gauge + stats + barra de eficiência lado a lado
 * - PERIODICAS: Grupo e Tipo de Atendimento agora editáveis no modo atualização
 *
 * CORREÇÕES v4.2 (mantidas):
 * - EMAIL: per__buildEmailHtml() gera HTML diretamente no backend (sem EJS)
 * - PERIODICAS: comarca editável no modo atualização
 *
 * CORREÇÕES v4.1 (mantidas):
 * - BUG #3: OSP sem data em row[6] não passa mais filtro de data indevidamente
 * - BUG #4: per_buscarDadosParaEmail e per_getDadosDashboard usam mesma lógica de status
 * - BUG #8: status vazio em OSP tratado antes do matchFiltros
 * - BUG #9: dias trabalhados OSP usa row[13] da planilha se disponível
 */



function per_incluir(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─────────────────────────────────────────────
//  HELPERS GLOBAIS
// ─────────────────────────────────────────────

function per__toTime(raw) {
  if (!raw) return 0;
  if (raw instanceof Date) return raw.getTime();
  const p = new Date(raw);
  return isNaN(p.getTime()) ? 0 : p.getTime();
}

function per__normalizarStatus(s) {
  if (!s) return "";
  return s.toString().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function per__fmtData(v) {
  if (!v) return "--";
  if (v instanceof Date) return Utilities.formatDate(v, "GMT-3", "dd/MM/yyyy");
  if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return v.split("-").reverse().join("/");
  }
  return v.toString() || "--";
}

function per__calcStatusKey(dRealIni, dRealFim, dProgFimRaw, hojeTime) {
  const dProgFimTime = per__toTime(dProgFimRaw);
  if (dRealFim) {
    const fimRealTime = per__toTime(dRealFim);
    return (dProgFimTime > 0 && fimRealTime <= dProgFimTime) ? 'noPrazo' : 'atraso';
  }
  if (dRealIni) return 'andamento';
  if (dProgFimTime > 0 && dProgFimTime < hojeTime) return 'atraso';
  return 'agendado';
}

// ─────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────

function per_validarLogin(email, senha) {
  try {
    const ss    = ss_();
    const sheet = ss.getSheetByName("USUARIOS");
    if (!sheet) return { sucesso: false, msg: "Erro: Aba 'USUARIOS' não encontrada." };
    const dados = sheet.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][1].toString().toLowerCase() === email.toLowerCase() &&
          dados[i][2].toString() === senha) {
        return { sucesso: true, nome: dados[i][0] };
      }
    }
    return { sucesso: false, msg: "E-mail ou senha incorretos." };
  } catch (e) {
    return { sucesso: false, msg: "Erro no servidor: " + e.message };
  }
}

// ─────────────────────────────────────────────
//  SALVAR PERIODICAS
// ─────────────────────────────────────────────

function per_salvarDados(obj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss    = ss_();
    let   sheet = ss.getSheetByName("PERIODICAS");

    if (!sheet) {
      sheet = ss.insertSheet("PERIODICAS");
      sheet.appendRow(["ID","REGIÃO","COMARCA","EDIFICAÇÃO","GRUPO","TIPO DE ATENDIMENTO",
        "DATA INÍCIO","DATA CONCLUSÃO","STATUS","DIAS TRABALHADOS","CRONOGRAMA",
        "CONTRATO","PROGRAMADO INICIAL","PROGRAMADO FINAL"]);
    }

    const data        = sheet.getDataRange().getValues();
    const dRealInicio = obj.dataInicio;
    const dRealFim    = obj.dataConclusao;
    const dProgFim    = obj.progFinal;

    let status          = "AGENDADO";
    let diasTrabalhados = "";

    if (dRealInicio && dRealFim) {
      status = (new Date(dRealFim) > new Date(dProgFim))
        ? "CONCLUÍDO (ATRASO)"
        : "CONCLUÍDO (NO PRAZO)";
      const d1 = new Date(dRealInicio + "T12:00:00");
      const d2 = new Date(dRealFim    + "T12:00:00");
      diasTrabalhados = Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
    } else if (dRealInicio) {
      status = "EM ANDAMENTO";
    }

    let rowToUpdate = -1;
    let idFinal     = obj.id;

    if (obj.id) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === obj.id.toString()) { rowToUpdate = i + 1; break; }
      }
    } else {
      if (data.length > 1) {
        const ultimoId = parseFloat(data[data.length - 1][0]);
        idFinal = isNaN(ultimoId) ? 1 : ultimoId + 1;
      } else {
        idFinal = 1;
      }
    }

    const linhaDados = [
      idFinal, obj.regiao, obj.comarca, obj.edificacao, obj.grupo, obj.tipoAtendimento,
      dRealInicio, dRealFim, status, diasTrabalhados, "", obj.contrato, obj.progInicial, dProgFim
    ];
    // Campos novos: col P (16)=MEDIÇÃO, col Q (17)=ATIVIDADE PENDENTE, col R (18)=ATIVIDADE
    // Col O (15) é a fórmula =TODAY() — não tocar.
    const camposExtras = [
      obj.medicao || '',
      obj.atividadePendente || '',
      obj.atividade || ''
    ];

    if (rowToUpdate > -1) {
      sheet.getRange(rowToUpdate, 1, 1, linhaDados.length).setValues([linhaDados]);
      // Grava extras nas colunas P, Q, R (16, 17, 18) — pulando col O (15) que tem fórmula TODAY
      sheet.getRange(rowToUpdate, 16, 1, 3).setValues([camposExtras]);
    } else {
      sheet.appendRow(linhaDados);
      const novaLinha = sheet.getLastRow();
      sheet.getRange(novaLinha, 16, 1, 3).setValues([camposExtras]);
    }

    SpreadsheetApp.flush();
    return "Gravado com Sucesso!";
  } catch (e) {
    return "Erro: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
//  BUSCAR LISTA (aba Periódicas)
// ─────────────────────────────────────────────

function per_buscarDadosFiltrados(filtroTipo, regiaoFiltro, progDe, progAte, statusEspecifico) {
  const ss    = ss_();
  const sheet = ss.getSheetByName("PERIODICAS");
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const dDe  = progDe  ? new Date(progDe  + "T00:00:00").getTime() : null;
  const dAte = progAte ? new Date(progAte + "T23:59:59").getTime() : null;

  // LÓGICA: INTERSECÇÃO do intervalo [PROG_INICIAL, PROG_FINAL] com [dDe, dAte]
  // Periódica entra se a janela do cronograma SE SOBREPÕE ao período filtrado.
  // PROG_INICIAL = row[12] (col M), PROG_FINAL = row[13] (col N)
  return data.filter((row, index) => {
    if (index === 0) return false;
    const regiaoLinha  = (row[1] || "").toString().toUpperCase();
    const statusLinha  = (row[8] || "").toString().toUpperCase();
    const pInicialTime = per__toTime(row[12]);
    const pFinalTime   = per__toTime(row[13]);

    // Região
    if (regiaoFiltro && regiaoFiltro !== "" && regiaoFiltro !== "TODAS" &&
        regiaoLinha !== regiaoFiltro.toUpperCase()) return false;

    // Intersecção de janelas: PROG_INICIAL <= dAte AND PROG_FINAL >= dDe
    // - Se a periódica não tem PROG_INICIAL nem PROG_FINAL, deixa passar (sem filtro de data)
    if (pInicialTime > 0 || pFinalTime > 0) {
      const ini = pInicialTime > 0 ? pInicialTime : pFinalTime;
      const fim = pFinalTime   > 0 ? pFinalTime   : pInicialTime;
      if (dDe  && fim < dDe)  return false;   // termina antes do filtro
      if (dAte && ini > dAte) return false;   // começa depois do filtro
    }

    // Status
    if (statusEspecifico && statusEspecifico !== "TODOS") {
      if (statusLinha !== statusEspecifico.toUpperCase()) return false;
    }
    if (filtroTipo === 'pendentes') return !statusLinha.includes("CONCLUÍDO");
    return true;
  }).map(row => row.map(cell =>
    (cell instanceof Date) ? Utilities.formatDate(cell, "GMT-3", "yyyy-MM-dd") : cell
  ));
}

/**
 * Diagnóstico: conta quantas periódicas existem em uma região (sem filtro de data).
 * Usado pelo frontend para informar o usuário se há registros mas o filtro está excluindo.
 */
function per_contarRegiao(regiao) {
  const ss    = ss_();
  const sheet = ss.getSheetByName("PERIODICAS");
  if (!sheet) return { ok: false, total: 0, erro: "Aba PERIODICAS não encontrada" };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, total: 0, exemploProgInicial: null, exemploProgFinal: null };

  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  const regUp = (regiao || "").toString().toUpperCase();

  let total = 0;
  let exemploIni = null, exemploFim = null;
  const datasIni = [], datasFim = [];

  for (let i = 0; i < data.length; i++) {
    const r = (data[i][1] || "").toString().toUpperCase();
    if (regUp && regUp !== "TODAS" && r !== regUp) continue;
    if (!data[i][0]) continue;

    total++;
    const pIni = data[i][12];
    const pFim = data[i][13];
    if (pIni) {
      const t = per__toTime(pIni);
      if (t > 0) datasIni.push(t);
      if (!exemploIni && pIni) exemploIni = pIni instanceof Date ? Utilities.formatDate(pIni, "GMT-3", "dd/MM/yyyy") : pIni.toString();
    }
    if (pFim) {
      const t = per__toTime(pFim);
      if (t > 0) datasFim.push(t);
      if (!exemploFim && pFim) exemploFim = pFim instanceof Date ? Utilities.formatDate(pFim, "GMT-3", "dd/MM/yyyy") : pFim.toString();
    }
  }

  let minIni = null, maxFim = null;
  if (datasIni.length) minIni = Utilities.formatDate(new Date(Math.min.apply(null, datasIni)), "GMT-3", "dd/MM/yyyy");
  if (datasFim.length) maxFim = Utilities.formatDate(new Date(Math.max.apply(null, datasFim)), "GMT-3", "dd/MM/yyyy");

  return {
    ok: true,
    regiao: regUp || "TODAS",
    total: total,
    exemploProgInicial: exemploIni,
    exemploProgFinal: exemploFim,
    progInicialMin: minIni,
    progFinalMax: maxFim
  };
}

// ─────────────────────────────────────────────
//  DASHBOARD CONSOLIDADO
// ─────────────────────────────────────────────

function per_getDadosDashboard(filtroTipo, regiaoFiltro, progDe, progAte, dataRefManual) {
  const ss        = ss_();
  const sheetP    = ss.getSheetByName("PERIODICAS");
  const sheetProg = ss.getSheetByName("PROGRAMADAS");

  let hojeTime;
  if (dataRefManual && dataRefManual !== "") {
    hojeTime = new Date(dataRefManual + "T23:59:59").getTime();
  } else {
    const refCell = sheetP ? sheetP.getRange("O1").getValue() : null;
    hojeTime = (refCell instanceof Date) ? refCell.getTime() : new Date().getTime();
  }

  const regioesLista = ["CENTRAL","SUL","NORTE","ZONA DA MATA","SUDOESTE","LESTE","TRIÂNGULO"];
  const kpis         = { total:0, concluido:0, andamento:0, atraso:0, agendado:0, noPrazo:0, somaDias:0, contagemDias:0 };
  const mapaRegioes  = {};
  const mapaTipos    = {};

  regioesLista.forEach(r => mapaRegioes[r] = { concluido:0, atraso:0, andamento:0, agendado:0 });

  const dDe  = progDe  ? new Date(progDe  + "T00:00:00").getTime() : null;
  const dAte = progAte ? new Date(progAte + "T23:59:59").getTime() : null;

  const processarLinha = (regiaoLinha, pFiltroRaw, pFinalRaw, tipo, diasTrab, dRealIni, dRealFim) => {
    regiaoLinha = (regiaoLinha || "").toString().toUpperCase();
    const pFiltroTime = per__toTime(pFiltroRaw);

    if (dDe || dAte) {
      if (pFiltroTime === 0) return;
      if (dDe  && pFiltroTime < dDe)  return;
      if (dAte && pFiltroTime > dAte) return;
    }

    if (regiaoFiltro && regiaoFiltro !== "" && regiaoFiltro !== "TODAS" &&
        regiaoLinha !== regiaoFiltro.toUpperCase()) return;
    if (filtroTipo === 'pendentes' && dRealFim) return;

    kpis.total++;
    const statusKey = per__calcStatusKey(dRealIni, dRealFim, pFinalRaw, hojeTime);

    if      (statusKey === 'noPrazo')  { kpis.concluido++; kpis.noPrazo++; }
    else if (statusKey === 'atraso')   { kpis.atraso++;   if (dRealFim) kpis.concluido++; }
    else if (statusKey === 'andamento'){ kpis.andamento++; }
    else                               { kpis.agendado++; }

    if (mapaRegioes[regiaoLinha]) mapaRegioes[regiaoLinha][statusKey === 'noPrazo' ? 'concluido' : statusKey]++;
    mapaTipos[tipo] = (mapaTipos[tipo] || 0) + 1;

    const d = parseFloat(diasTrab);
    if (!isNaN(d) && d > 0) { kpis.somaDias += d; kpis.contagemDias++; }
  };

  if (sheetP) {
    sheetP.getDataRange().getValues().slice(1).forEach(row => {
      if (!row[0]) return;
      processarLinha(row[1], row[12], row[13], row[5], row[9], row[6], row[7]);
    });
  }

  if (sheetProg) {
    sheetProg.getDataRange().getValues().slice(1).forEach(row => {
      if (!row[0]) return;
      const ospLabel = "OSP · " + (row[3] ? String(row[3]).trim().toUpperCase() : "S/COMARCA");
      let diasOsp = parseFloat(row[13]);
      if (isNaN(diasOsp) || diasOsp <= 0) {
        if (row[15] && row[16]) {
          const d1 = new Date(per__toTime(row[15]));
          const d2 = new Date(per__toTime(row[16]));
          diasOsp = Math.max(0, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
        } else {
          diasOsp = "";
        }
      }
      processarLinha(row[2], row[6], row[12], ospLabel, diasOsp, row[15], row[16]);
    });
  }

  const eficiencia = kpis.total > 0 ? Math.round((kpis.noPrazo / kpis.total) * 100) : 0;

  return {
    kpis: kpis,
    chartData: [['Região','Concluído','Atraso','Andamento','Agendado']].concat(
      regioesLista.map(r => [r, mapaRegioes[r].concluido, mapaRegioes[r].atraso,
                                mapaRegioes[r].andamento, mapaRegioes[r].agendado])
    ),
    chartDataTipos: [['Tipo','Quantidade']].concat(
      Object.keys(mapaTipos).map(t => [t, mapaTipos[t]])
    ),
    extra: {
      eficiencia: eficiencia,
      media:      kpis.contagemDias > 0 ? (kpis.somaDias / kpis.contagemDias).toFixed(1) : 0,
      pAtraso:    kpis.total > 0 ? Math.round((kpis.atraso / kpis.total) * 100) : 0
    }
  };
}

// ─────────────────────────────────────────────
//  BUSCAR DADOS PARA EMAIL
// ─────────────────────────────────────────────

function per_buscarDadosParaEmail(filtros) {
  filtros = filtros || {};
  const origens      = filtros.origens  || ['PER','OSP'];
  const regiao       = (filtros.regiao  || "TODAS").toUpperCase().trim();
  const dataDe       = filtros.dataDe   || "";
  const dataAte      = filtros.dataAte  || "";
  const statusFiltro = per__normalizarStatus(filtros.status || "TODOS");

  const ss        = ss_();
  const resultado = [];

  const dDe  = dataDe  ? new Date(dataDe  + "T00:00:00").getTime() : null;
  const dAte = dataAte ? new Date(dataAte + "T23:59:59").getTime() : null;

  const sheetP   = ss.getSheetByName("PERIODICAS");
  const refCell  = sheetP ? sheetP.getRange("O1").getValue() : null;
  const hojeTime = (refCell instanceof Date) ? refCell.getTime() : new Date().getTime();

  function matchFiltros(regiaoItem, statusItem, dataRefRaw) {
    const r        = (regiaoItem || "").toString().toUpperCase().trim();
    const sNorm    = per__normalizarStatus(statusItem);
    const dataTime = per__toTime(dataRefRaw);

    if (regiao !== "TODAS" && r !== regiao) return false;

    if (statusFiltro !== "TODOS") {
      if (statusFiltro === "ATRASO") {
        if (!sNorm.includes("ATRASO")) return false;
      } else {
        if (sNorm !== statusFiltro) return false;
      }
    }

    if (dDe || dAte) {
      if (dataTime === 0) return false;
      if (dDe  && dataTime < dDe)  return false;
      if (dAte && dataTime > dAte) return false;
    }

    return true;
  }

  if (origens.indexOf('PER') !== -1) {
    const sheetPer = ss.getSheetByName("PERIODICAS");
    if (sheetPer) {
      sheetPer.getDataRange().getValues().slice(1).forEach(r => {
        if (!r[0]) return;
        const statusCalc  = per__calcStatusKey(r[6], r[7], r[13], hojeTime);
        const statusLabel = {
          noPrazo:  "CONCLUÍDO (NO PRAZO)",
          atraso:   r[7] ? "CONCLUÍDO (ATRASO)" : "AGENDADO (ATRASADO)",
          andamento:"EM ANDAMENTO",
          agendado: "AGENDADO"
        }[statusCalc];
        const statusFinal = (r[8] && r[8].toString().trim()) ? r[8].toString() : statusLabel;
        if (!matchFiltros(r[1], statusFinal, r[12])) return;
        resultado.push({
          origem:      "PERIÓDICA",
          id:          r[0],
          regiao:      r[1]  || "--",
          comarca:     r[2]  || "--",
          edificacao:  r[3]  || "--",
          grupo:       r[4]  || "--",
          servico:     r[5]  || "--",
          dataInicio:  per__fmtData(r[6]),
          dataFim:     per__fmtData(r[7]),
          status:      statusFinal,
          contrato:    r[11] || "--",
          progInicial: per__fmtData(r[12]),
          progFinal:   per__fmtData(r[13])
        });
      });
    }
  }

  if (origens.indexOf('OSP') !== -1) {
    const sheetProg = ss.getSheetByName("PROGRAMADAS");
    if (sheetProg) {
      sheetProg.getDataRange().getValues().slice(1).forEach(r => {
        if (!r[0]) return;
        const statusPlilha = (r[11] && r[11].toString().trim()) ? r[11].toString() : "ABERTO";
        const statusCalc   = per__calcStatusKey(r[15], r[16], r[12], hojeTime);
        const statusLabel  = {
          noPrazo:  "CONCLUÍDO (NO PRAZO)",
          atraso:   r[16] ? "CONCLUÍDO (ATRASO)" : "ABERTO (ATRASADO)",
          andamento:"EM ANDAMENTO",
          agendado: "ABERTO"
        }[statusCalc];
        const statusFinal = (statusCalc === 'noPrazo' || statusCalc === 'atraso' || statusCalc === 'andamento')
          ? statusLabel
          : statusPlilha;
        if (!matchFiltros(r[2], statusFinal, r[6])) return;
        resultado.push({
          origem:      "OSP",
          id:          r[0],
          regiao:      r[2]  || "--",
          comarca:     r[3]  || "--",
          edificacao:  r[4]  || "--",
          grupo:       "--",
          servico:     r[7]  || "--",
          dataInicio:  per__fmtData(r[15]),
          dataFim:     per__fmtData(r[16]),
          status:      statusFinal,
          contrato:    "--",
          progInicial: per__fmtData(r[6]),
          progFinal:   per__fmtData(r[12]),
          ospNumero:   r[17] || "--"
        });
      });
    }
  }

  resultado.sort((a, b) => (a.regiao < b.regiao ? -1 : a.regiao > b.regiao ? 1 : 0));
  return resultado;
}

// ─────────────────────────────────────────────
//  HELPER: UMA LINHA DA TABELA DE STATS DO GAUGE
// ─────────────────────────────────────────────

function per__gaugeStatRow(label, value, color) {
  return '<tr>'
    + '<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">'
    +   '<span style="font-size:12px;color:#64748b;font-weight:600;">' + label + '</span>'
    + '</td>'
    + '<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">'
    +   '<span style="font-size:20px;font-weight:900;color:' + color + ';">' + value + '</span>'
    + '</td>'
    + '</tr>';
}

// ─────────────────────────────────────────────
//  HELPER: SVG DO VELOCÍMETRO (SEM JAVASCRIPT)
//  Funciona em qualquer cliente de e-mail que
//  renderize SVG inline (Gmail, Outlook Web, etc.)
// ─────────────────────────────────────────────

function per__buildGaugeSvg(eff, gaugeColor) {
  var cx = 100, cy = 100, r = 75;

  // Converte % (0-100) para ângulo: -135° (esquerda) → +135° (direita)
  var angle   = -135 + (eff / 100) * 270;
  var rad     = (angle * Math.PI) / 180;
  var arcEndX = cx + r * Math.cos(rad);
  var arcEndY = cy + r * Math.sin(rad);

  // largeArc = 1 quando eff > 50% (arco > 180°)
  var largeArc = eff > 50 ? 1 : 0;

  // Coordenadas da ponta do ponteiro (raio menor para ficar dentro do arco)
  var nX = (cx + 58 * Math.cos(rad)).toFixed(2);
  var nY = (cy + 58 * Math.sin(rad)).toFixed(2);

  // Arco de preenchimento (somente se eff > 0)
  var arcFill = '';
  if (eff > 0) {
    arcFill = '<path d="M 25 100 A 75 75 0 ' + largeArc + ' 1 '
      + arcEndX.toFixed(2) + ' ' + arcEndY.toFixed(2) + '"'
      + ' fill="none" stroke="' + gaugeColor + '" stroke-width="18" stroke-linecap="round"/>';
  }

  return '<svg width="220" height="145" viewBox="0 0 200 130"'
    + ' xmlns="http://www.w3.org/2000/svg"'
    + ' style="display:block;margin:0 auto;">'

    // ── Trilha de fundo (arco cinza completo 270°) ──
    + '<path d="M 25 100 A 75 75 0 1 1 175 100"'
    +   ' fill="none" stroke="#e2e8f0" stroke-width="18" stroke-linecap="round"/>'

    // ── Zonas de cor (0-50% vermelho, 50-80% amarelo, 80-100% verde) ──
    + '<path d="M 25 100 A 75 75 0 0 1 100 25"'
    +   ' fill="none" stroke="#fca5a5" stroke-width="18" stroke-linecap="round" opacity="0.6"/>'
    + '<path d="M 100 25 A 75 75 0 0 1 162 60"'
    +   ' fill="none" stroke="#fde68a" stroke-width="18" stroke-linecap="round" opacity="0.6"/>'
    + '<path d="M 162 60 A 75 75 0 0 1 175 100"'
    +   ' fill="none" stroke="#86efac" stroke-width="18" stroke-linecap="round" opacity="0.6"/>'

    // ── Arco de preenchimento real ──
    + arcFill

    // ── Tampa branca central (esconde o interior do arco) ──
    + '<circle cx="100" cy="100" r="55" fill="white"/>'

    // ── Ponteiro ──
    + '<line x1="100" y1="100" x2="' + nX + '" y2="' + nY + '"'
    +   ' stroke="' + gaugeColor + '" stroke-width="3.5" stroke-linecap="round"/>'
    + '<circle cx="100" cy="100" r="7" fill="' + gaugeColor + '"/>'
    + '<circle cx="100" cy="100" r="3.5" fill="white"/>'

    // ── Texto central: percentual ──
    + '<text x="100" y="94"'
    +   ' fill="' + gaugeColor + '"'
    +   ' font-size="24" font-weight="900" text-anchor="middle"'
    +   ' font-family="Arial,Helvetica,sans-serif">'
    + eff + '%</text>'

    // ── Texto central: label ──
    + '<text x="100" y="110"'
    +   ' fill="#94a3b8" font-size="9" font-weight="700" text-anchor="middle"'
    +   ' font-family="Arial,Helvetica,sans-serif">EFICIÊNCIA</text>'

    // ── Labels de escala ──
    + '<text x="20"  y="120" fill="#94a3b8" font-size="8" text-anchor="middle"'
    +   ' font-family="Arial,Helvetica,sans-serif">0%</text>'
    + '<text x="100" y="16"  fill="#94a3b8" font-size="8" text-anchor="middle"'
    +   ' font-family="Arial,Helvetica,sans-serif">50%</text>'
    + '<text x="180" y="120" fill="#94a3b8" font-size="8" text-anchor="middle"'
    +   ' font-family="Arial,Helvetica,sans-serif">100%</text>'

    + '</svg>';
}

// ─────────────────────────────────────────────
//  BUILDER DO HTML DO E-MAIL
// ─────────────────────────────────────────────

function per__buildEmailHtml(dados, kpis, extra, filtroDesc, dataGeracao) {
  const eff      = parseInt(extra.eficiencia) || 0;
  const effColor = eff >= 90 ? '#1b7a3e' : (eff >= 70 ? '#b45309' : '#b91c1c');

  // ── Helper: célula de tabela de dados ──
  function td(content, style) {
    return '<td style="padding:8px 10px;border-bottom:1px solid #f0f4f8;color:#334155;font-size:11px;'
      + (style || '') + '">' + (content || '--') + '</td>';
  }

  // ── Helper: card KPI ──
  function kpiCard(label, value, color, sub) {
    return '<td style="padding:4px;vertical-align:top;width:16.6%;">'
      + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
      + '<td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:4px solid ' + color
      +   ';border-radius:10px;padding:14px 8px;text-align:center;">'
      + '<div style="font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;'
      +   'letter-spacing:.1em;margin-bottom:6px;">' + label + '</div>'
      + '<div style="font-size:26px;font-weight:900;color:' + color + ';line-height:1;">' + value + '</div>'
      + '<div style="font-size:10px;color:#94a3b8;margin-top:4px;">' + sub + '</div>'
      + '</td></tr></table></td>';
  }

  // ── Alerta de atraso ──
  const alertHtml = kpis.atraso > 0
    ? '<tr><td style="padding:0 0 20px 0;">'
      + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
      + '<td style="background:#fee2e2;border:1px solid #fca5a5;border-left:5px solid #b91c1c;'
      +   'border-radius:8px;padding:14px 18px;">'
      + '<strong style="color:#b91c1c;font-size:13px;">⚠️ ' + kpis.atraso
      +   ' registro' + (kpis.atraso > 1 ? 's' : '')
      +   ' com atraso identificado' + (kpis.atraso > 1 ? 's' : '') + '.</strong><br>'
      + '<span style="color:#7f1d1d;font-size:12px;">'
      +   'Verifique o cronograma e acione os responsáveis para regularização.</span>'
      + '</td></tr></table></td></tr>'
    : '';

  // ── Linhas da tabela de detalhamento ──
  const rows = dados.map(function(d, idx) {
    const st = (d.status || '').toUpperCase();
    let stColor = '#1d4ed8', stBg = '#dbeafe';
    if      (st.indexOf('NO PRAZO')  !== -1) { stColor = '#1b7a3e'; stBg = '#e8f5ee'; }
    else if (st.indexOf('ATRASO')    !== -1) { stColor = '#b91c1c'; stBg = '#fee2e2'; }
    else if (st.indexOf('ANDAMENTO') !== -1) { stColor = '#b45309'; stBg = '#fef3c7'; }
    else if (st.indexOf('REAGEND')   !== -1) { stColor = '#5b21b6'; stBg = '#ede9fe'; }
    else if (st.indexOf('CANCELADO') !== -1) { stColor = '#64748b'; stBg = '#f1f5f9'; }

    const origemColor = d.origem === 'OSP' ? '#b45309' : '#003366';
    const origemBg    = d.origem === 'OSP' ? '#fdf6e8' : '#e8f0fb';
    const rowBg       = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';

    return '<tr style="background:' + rowBg + ';">'
      + '<td style="padding:8px 10px;border-bottom:1px solid #f0f4f8;white-space:nowrap;">'
      +   '<span style="background:' + origemBg + ';color:' + origemColor
      +     ';padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;">'
      +   d.origem + '</span>'
      + '</td>'
      + td('<strong style="color:#003366;">#' + d.id + '</strong>', 'white-space:nowrap;')
      + td(d.regiao, 'white-space:nowrap;')
      + td(d.comarca)
      + td(d.edificacao)
      + td(d.servico, 'font-size:10px;max-width:170px;')
      + td(d.dataInicio, 'white-space:nowrap;')
      + td(d.dataFim,    'white-space:nowrap;')
      + '<td style="padding:8px 10px;border-bottom:1px solid #f0f4f8;white-space:nowrap;">'
      +   '<span style="background:' + stBg + ';color:' + stColor
      +     ';padding:3px 9px;border-radius:99px;font-size:9px;font-weight:700;'
      +     'text-transform:uppercase;white-space:nowrap;">'
      +   (d.status || '--') + '</span>'
      + '</td>'
      + td(d.progInicial, 'white-space:nowrap;')
      + td(d.progFinal,   'white-space:nowrap;')
      + '</tr>';
  }).join('');

  // ── SVG do velocímetro ──
  const gaugeSvg = per__buildGaugeSvg(eff, effColor);

  // ── Barra de eficiência (dentro do bloco do gauge) ──
  const barColor = eff >= 90
    ? 'background:linear-gradient(90deg,#1b7a3e,#22c55e)'
    : eff >= 70
      ? 'background:linear-gradient(90deg,#b45309,#f59e0b)'
      : 'background:linear-gradient(90deg,#b91c1c,#ef4444)';

  // ── HTML completo ──
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>'
    + '<body style="margin:0;padding:24px 12px;background:#dce3ec;'
    +   'font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:14px;line-height:1.6;">'
    + '<div style="max-width:920px;margin:0 auto;">'

    // ════ HEADER ════
    + '<table width="100%" cellpadding="0" cellspacing="0"'
    +   ' style="background:#003366;border-radius:16px 16px 0 0;border-bottom:4px solid #c5a059;">'
    + '<tr><td style="padding:32px 40px 22px;">'

    // Logo + título
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    + '<td style="vertical-align:middle;">'
    +   '<table cellpadding="0" cellspacing="0"><tr>'
    +   '<td style="vertical-align:middle;padding-right:16px;">'
    +     '<div style="width:52px;height:52px;background:#c5a059;border-radius:13px;'
    +       'text-align:center;line-height:52px;font-size:24px;font-weight:900;'
    +       'color:#003366;display:inline-block;">C</div>'
    +   '</td>'
    +   '<td style="vertical-align:middle;">'
    +     '<div style="font-size:26px;font-weight:900;color:#ffffff;'
    +       'letter-spacing:.04em;line-height:1;">COMAP</div>'
    +     '<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px;'
    +       'letter-spacing:.08em;text-transform:uppercase;">'
    +       'TJMG · Coordenação de Manutenção Predial</div>'
    +   '</td>'
    +   '</tr></table>'
    + '</td>'
    + '<td style="text-align:right;vertical-align:top;">'
    +   '<div style="display:inline-block;background:rgba(255,255,255,.12);'
    +     'border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:5px 14px;'
    +     'font-size:11px;color:rgba(255,255,255,.85);font-weight:600;">'
    +     '📅 Gerado em: ' + dataGeracao + '</div>'
    +   '<div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:8px;'
    +     'max-width:260px;line-height:1.5;">Filtros: ' + filtroDesc + '</div>'
    + '</td>'
    + '</tr></table>'

    // Badges
    + '<table cellpadding="0" cellspacing="6" style="margin-top:18px;"><tr>'
    + '<td><span style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);'
    +   'border-radius:20px;padding:5px 12px;font-size:11px;color:rgba(255,255,255,.8);font-weight:600;">'
    +   '● ' + kpis.noPrazo + ' concluído' + (kpis.noPrazo !== 1 ? 's' : '') + ' no prazo</span></td>'
    + (kpis.atraso > 0
      ? '<td><span style="background:rgba(185,28,28,.28);border:1px solid rgba(185,28,28,.45);'
        + 'border-radius:20px;padding:5px 12px;font-size:11px;color:#f87171;font-weight:600;">'
        + '● ' + kpis.atraso + ' em atraso</span></td>'
      : '')
    + '<td><span style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);'
    +   'border-radius:20px;padding:5px 12px;font-size:11px;color:rgba(255,255,255,.8);font-weight:600;">'
    +   '● Eficiência: ' + eff + '%</span></td>'
    + '</tr></table>'
    + '</td></tr></table>'

    // ════ CORPO ════
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">'
    + '<tr><td style="padding:32px 40px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'

    // Alerta
    + alertHtml

    // ── SEÇÃO: VELOCÍMETRO + STATS ──
    + '<tr><td style="padding-bottom:14px;">'
    +   '<div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;'
    +     'letter-spacing:.14em;border-left:4px solid #c5a059;padding-left:10px;">'
    +     '🎯 Índice de Eficiência Operacional</div>'
    + '</td></tr>'

    + '<tr><td style="padding-bottom:28px;">'
    +   '<table width="100%" cellpadding="0" cellspacing="0"'
    +     ' style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">'
    +   '<tr><td style="padding:22px 24px;">'
    +     '<table width="100%" cellpadding="0" cellspacing="0"><tr>'

    // Coluna esquerda: SVG gauge
    +       '<td style="vertical-align:middle;text-align:center;width:240px;'
    +         'padding-right:24px;border-right:1px solid #e2e8f0;">'
    +         '<div style="font-size:10px;font-weight:800;color:#003366;text-transform:uppercase;'
    +           'letter-spacing:.08em;margin-bottom:10px;">Velocímetro</div>'
    +         gaugeSvg
    +         '<div style="font-size:9px;color:#94a3b8;margin-top:8px;font-weight:600;">'
    +           '0% Crítico &nbsp;·&nbsp; 70% Regular &nbsp;·&nbsp; 100% Ótimo'
    +         '</div>'
    +       '</td>'

    // Coluna direita: stats + barra
    +       '<td style="vertical-align:top;padding-left:28px;">'
    +         '<table width="100%" cellpadding="0" cellspacing="0">'
    +           per__gaugeStatRow('Total de Registros',   kpis.total,    '#1d4ed8')
    +           per__gaugeStatRow('Concluídos no Prazo',  kpis.noPrazo,  '#1b7a3e')
    +           per__gaugeStatRow('Em Atraso',            kpis.atraso,   kpis.atraso > 0 ? '#b91c1c' : '#1b7a3e')
    +           per__gaugeStatRow('Em Andamento',         kpis.andamento,'#b45309')
    +           per__gaugeStatRow('Agendados',            kpis.agendado, '#64748b')
    +           per__gaugeStatRow('Média por Atend.',     extra.media + ' dias', '#c5a059')
    +         '</table>'

    // Barra de eficiência abaixo dos stats
    +         '<div style="margin-top:18px;">'
    +           '<table width="100%" cellpadding="0" cellspacing="0"'
    +             ' style="margin-bottom:8px;"><tr>'
    +             '<td style="font-size:12px;font-weight:700;color:#003366;">'
    +               'Eficiência Operacional</td>'
    +             '<td style="text-align:right;font-size:22px;font-weight:900;color:' + effColor + ';">'
    +               eff + '%</td>'
    +           '</tr></table>'
    +           '<div style="width:100%;height:14px;background:#e2e8f0;border-radius:99px;overflow:hidden;">'
    +             '<div style="width:' + eff + '%;height:14px;' + barColor
    +               + ';border-radius:99px;"></div>'
    +           '</div>'
    +           '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>'
    +             '<td style="font-size:9px;color:#94a3b8;font-weight:600;">0% — Crítico</td>'
    +             '<td style="text-align:center;font-size:9px;color:#94a3b8;font-weight:600;">'
    +               '70% — Regular</td>'
    +             '<td style="text-align:right;font-size:9px;color:#94a3b8;font-weight:600;">'
    +               '100% — Ótimo</td>'
    +           '</tr></table>'
    +         '</div>'

    +       '</td>'
    +     '</tr></table>'
    +   '</td></tr></table>'
    + '</td></tr>'

    // ── SEÇÃO: KPI CARDS ──
    + '<tr><td style="padding-bottom:14px;">'
    +   '<div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;'
    +     'letter-spacing:.14em;border-left:4px solid #c5a059;padding-left:10px;">'
    +     'Resumo Executivo do Período</div>'
    + '</td></tr>'
    + '<tr><td style="padding-bottom:28px;">'
    +   '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    +   kpiCard('Total',      kpis.total,    '#003366', 'registros')
    +   kpiCard('No Prazo',   kpis.noPrazo,  '#1b7a3e', 'concluídos')
    +   kpiCard('Em Atraso',  kpis.atraso,   kpis.atraso > 0 ? '#b91c1c' : '#1b7a3e', extra.pAtraso + '% do total')
    +   kpiCard('Andamento',  kpis.andamento,'#2563eb', 'em execução')
    +   kpiCard('Agendados',  kpis.agendado, '#64748b', 'aguardando')
    +   kpiCard('Eficiência', eff + '%',     effColor,  'atend. no prazo')
    +   '</tr></table>'
    + '</td></tr>'

    // ── SEÇÃO: TABELA DE DETALHAMENTO ──
    + '<tr><td style="padding-bottom:10px;">'
    +   '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    +   '<td style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;'
    +     'letter-spacing:.14em;border-left:4px solid #c5a059;padding-left:10px;">'
    +     'Detalhamento dos Registros</td>'
    +   '<td style="text-align:right;">'
    +     '<span style="background:#e8f0fb;color:#003366;border-radius:99px;'
    +       'padding:4px 12px;font-size:11px;font-weight:700;">'
    +     dados.length + ' registro' + (dados.length !== 1 ? 's' : '')
    +     '</span>'
    +   '</td>'
    +   '</tr></table>'
    + '</td></tr>'

    // Tabela de dados
    + '<tr><td>'
    +   '<table width="100%" cellpadding="0" cellspacing="0"'
    +     ' style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">'
    +   '<thead><tr style="background:#003366;">'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">Tipo</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">ID</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">Região</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);">Comarca</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);">Edificação</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);">Serviço / Tipo Atend.</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">Início Real</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">Fim Real</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">Status</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'border-right:1px solid rgba(255,255,255,.1);white-space:nowrap;">Prog. Início</th>'
    +   '<th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;'
    +     'letter-spacing:.07em;text-transform:uppercase;color:#fff;'
    +     'white-space:nowrap;">Prog. Fim</th>'
    +   '</tr></thead>'
    +   '<tbody>' + rows + '</tbody>'
    +   '</table>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'

    // ════ FOOTER ════
    + '<table width="100%" cellpadding="0" cellspacing="0"'
    +   ' style="background:#001f4d;border-radius:0 0 16px 16px;">'
    + '<tr>'
    + '<td style="padding:22px 40px;">'
    +   '<div style="font-size:11px;color:rgba(255,255,255,.45);line-height:1.7;">'
    +     '<strong style="color:rgba(255,255,255,.7);">Sistema COMAP — TJMG</strong><br>'
    +     'Coordenação de Manutenção Predial<br>'
    +     'Relatório gerado automaticamente em ' + dataGeracao
    +   '</div>'
    + '</td>'
    + '<td style="padding:22px 40px;text-align:right;vertical-align:middle;">'
    +   '<div style="display:inline-block;background:#c5a059;color:#003366;border-radius:8px;'
    +     'padding:7px 18px;font-size:11px;font-weight:900;letter-spacing:.06em;">'
    +     'TJMG · COMAP</div>'
    + '</td>'
    + '</tr></table>'

    + '</div>'
    + '</body></html>';
}

// ─────────────────────────────────────────────
//  ENVIO DE RELATÓRIO POR EMAIL
// ─────────────────────────────────────────────

function per_enviarRelatorioPorEmail(filtros, emailDestino) {
  filtros = filtros || {};

  const hoje           = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm");
  const dadosFiltrados = per_buscarDadosParaEmail(filtros);

  if (dadosFiltrados.length === 0)
    return "Nenhum dado encontrado para os filtros selecionados.";

  // KPIs do e-mail
  const kpis = dadosFiltrados.reduce((acc, r) => {
    acc.total++;
    const s = (r.status || "").toUpperCase();
    if      (s.includes("NO PRAZO"))  acc.noPrazo++;
    else if (s.includes("ATRASO"))    acc.atraso++;
    else if (s.includes("ANDAMENTO")) acc.andamento++;
    else                              acc.agendado++;
    return acc;
  }, { total:0, noPrazo:0, atraso:0, andamento:0, agendado:0 });

  kpis.eficiencia = kpis.total > 0 ? Math.round((kpis.noPrazo / kpis.total) * 100) : 0;

  // KPIs do dashboard com mesmo período (para média de dias)
  const dashData = per_getDadosDashboard(
    'todos',
    filtros.regiao  || "TODAS",
    filtros.dataDe  || "",
    filtros.dataAte || "",
    ""
  );

  const origensLabel = (filtros.origens || ['PER','OSP'])
    .map(o => o === 'PER' ? 'Periódicas' : 'OSP').join(' + ');
  const regiaoLabel  = (filtros.regiao && filtros.regiao !== 'TODAS')
    ? filtros.regiao : 'Todas as Regiões';
  const periodoLabel = (filtros.dataDe || filtros.dataAte)
    ? ((filtros.dataDe  ? filtros.dataDe.split('-').reverse().join('/')  : '--') + ' a ' +
       (filtros.dataAte ? filtros.dataAte.split('-').reverse().join('/') : '--'))
    : 'Todo o período';
  const statusLabel  = (filtros.status && filtros.status !== 'TODOS')
    ? filtros.status : 'Todos os status';

  const filtroDescricao = origensLabel + ' | ' + regiaoLabel + ' | ' + periodoLabel
                        + ' | Status: ' + statusLabel;

  const extra = {
    eficiencia: kpis.eficiencia,
    media:      dashData.extra.media,
    pAtraso:    kpis.total > 0 ? Math.round((kpis.atraso / kpis.total) * 100) : 0
  };

  const htmlBody = per__buildEmailHtml(dadosFiltrados, kpis, extra, filtroDescricao, hoje);

  MailApp.sendEmail({
    to:       emailDestino,
    subject:  "📊 Relatório de Manutenção COMAP/TJMG — " + regiaoLabel + " | " + periodoLabel,
    htmlBody: htmlBody
  });

  return "Relatório enviado com sucesso para " + emailDestino
       + "! (" + dadosFiltrados.length + " registros)";
}

// ─────────────────────────────────────────────
//  GATILHO AUTOMÁTICO — TODO DIA 09
// ─────────────────────────────────────────────

function per_dispararRelatorioMesAnterior() {
  const destinatario = "edenias.leao@tjmg.jus.br";
  const hoje         = new Date();
  const dataRef      = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

  const primeiroDia = Utilities.formatDate(dataRef, "GMT-3", "yyyy-MM-dd");
  const ultimoDia   = Utilities.formatDate(
    new Date(hoje.getFullYear(), hoje.getMonth(), 0), "GMT-3", "yyyy-MM-dd"
  );

  return per_enviarRelatorioPorEmail({
    origens: ['PER','OSP'],
    status:  "TODOS",
    regiao:  "TODAS",
    dataDe:  primeiroDia,
    dataAte: ultimoDia
  }, destinatario);
}

function per_configurarGatilhoMensal() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'per_dispararRelatorioMesAnterior') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('per_dispararRelatorioMesAnterior')
    .timeBased().onMonthDay(9).atHour(8).create();
  console.log("Gatilho configurado: todo dia 09 às 08h.");
}



/**
 * GESTÃO DE MANUTENÇÃO - TJMG
 * Sistema de Ordem de Serviço (O.S.) - VERSÃO COM REFERÊNCIA EM R1
 */



function per_abrirFormOS() {
  const html = HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle('Sistema de Ordem de Serviço - TJMG')
      .setWidth(1200)
      .setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/**
 * Função auxiliar para capturar a data da célula R1
 */
function per_getDataReferenciaR1(sheet) {
  const valorR1 = sheet.getRange("R1").getValue();
  
  // Se R1 for uma data válida, formata. Se não, usa a data do sistema como plano B.
  if (valorR1 instanceof Date) {
    return Utilities.formatDate(valorR1, "GMT-3", "yyyy-MM-dd");
  } else {
    return Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  }
}

function per_buscarTodasOS() {
  try {
    const ss = ss_();
    const sheet = ss.getSheetByName("PROGRAMADAS");
    if (!sheet) return [];
    const valores = sheet.getDataRange().getValues();
    if (valores.length <= 1) return []; 
    
    return valores.slice(1).map(row => {
      return row.map(cell => {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, "GMT-3", "yyyy-MM-dd");
        }
        return cell;
      });
    });
  } catch(e) {
    return [];
  }
}

function per_salvarDadosOS(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    const ss = ss_();
    const sheet = ss.getSheetByName("PROGRAMADAS");
    if (!sheet) return "ERRO: Aba 'PROGRAMADAS' não encontrada!";

    const data = sheet.getDataRange().getValues();
    
    // --- REFERÊNCIA TEMPORAL (CÉLULA R1) ---
    const hoje = per_getDataReferenciaR1(sheet);
    
    // --- VARIÁVEIS DE CONTROLE ---
    let statusFinal = dados.status;
    let dataIniReal = dados.dataInicioExecucao;
    let dataFinReal = dados.dataFinalExecucao;
    let diasTrabalhados = "";
    
    // --- APLICAÇÃO DAS REGRAS DE NEGÓCIO ---

    // 1. Regra para CANCELADO (Utiliza a data de R1)
    if (statusFinal === "CANCELADO") {
      dataIniReal = hoje;
      dataFinReal = hoje;
    } 
    // 2. Regra para REAGENDADO
    else if (statusFinal === "REAGENDADO" || statusFinal === "REAGENDAR") {
      statusFinal = "REAGENDADO";
    }
    // 3. Regras de Status baseadas em Datas de Execução
    else {
      if (dataIniReal && !dataFinReal) {
        statusFinal = "EM ANDAMENTO";
      } 
      else if (dataIniReal && dataFinReal) {
        // Cálculo de Atraso/Prazo
        const dPrevista = new Date(dados.dataPrevistaConclusao + "T12:00:00");
        const dFimReal = new Date(dataFinReal + "T12:00:00");
        const dInicioReal = new Date(dataIniReal + "T12:00:00");

        statusFinal = (dFimReal > dPrevista) ? "CONCLUÍDO (ATRASO)" : "CONCLUÍDO (NO PRAZO)";
        
        // Cálculo de Dias Trabalhados
        const diffTime = Math.abs(dFimReal - dInicioReal);
        diasTrabalhados = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    // --- MODO ATUALIZAÇÃO ---
    if (dados.id_ref && dados.id_ref !== "") {
      const idProcurado = dados.id_ref.toString().trim();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === idProcurado) {
          const linha = i + 1;
          
          const novosValores = [
            dados.edificacao,            // Col E (5)
            dados.motivacao,             // Col F (6)
            dados.dataInicio,            // Col G (7)
            dados.servicoPrincipal,      // Col H (8)
            dados.servicoSec1,           // Col I (9)
            dados.servicoSec2,           // Col J (10)
            dados.prazo,                 // Col K (11)
            statusFinal,                 // Col L (12)
            dados.dataPrevistaConclusao,  // Col M (13)
            diasTrabalhados,             // Col N (14)
            dados.responsavel,           // Col O (15)
            dataIniReal,                 // Col P (16)
            dataFinReal                  // Col Q (17)
          ];
          
          sheet.getRange(linha, 5, 1, 13).setValues([novosValores]);
          SpreadsheetApp.flush();
          return "O.S. nº " + idProcurado + " atualizada como " + statusFinal;
        }
      }
      return "ERRO: ID " + idProcurado + " não encontrado.";
    }

    // --- MODO NOVO CADASTRO ---
    let novoId = 1;
    if (data.length > 1) {
      const ids = data.slice(1).map(r => parseFloat(r[0])).filter(id => !isNaN(id));
      novoId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    }

    sheet.appendRow([
      novoId,                       // A
      dados.dataAbertura,           // B
      dados.regiao,                 // C
      dados.comarca,                // D
      dados.edificacao,             // E
      dados.motivacao,              // F
      dados.dataInicio,             // G
      dados.servicoPrincipal,       // H
      dados.servicoSec1,            // I
      dados.servicoSec2,            // J
      dados.prazo,                  // K
      statusFinal,                  // L
      dados.dataPrevistaConclusao,  // M
      diasTrabalhados,              // N
      dados.responsavel,            // O
      dataIniReal,                  // P
      dataFinReal                   // Q
    ]);
    
    SpreadsheetApp.flush();
    return "Nova O.S. Gerada com ID: " + novoId;
    
  } catch(e) {
    return "Erro: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}


/**
 * GESTÃO DE MANUTENÇÃO - TJMG
 * Sistema de Ordem de Serviço (O.S.)
 * VERSÃO CORRIGIDA v4.1
 *
 * CORREÇÕES:
 * - BUG #2: Campo OSP/Número agora salvo na coluna R (índice 17) e lido corretamente
 * - BUG #6: Comarca agora é atualizada no modo edição (getRange começa na col D)
 */



function per_abrirFormOS() {
  const html = HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle('Sistema de Ordem de Serviço - TJMG')
      .setWidth(1200)
      .setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/**
 * Função auxiliar para capturar a data da célula R1
 * ATENÇÃO: agora a planilha usa coluna S1 para data de referência
 * (pois coluna R passou a ser usada para o número da OSP)
 */
function per_getDataReferenciaS1(sheet) {
  const valorS1 = sheet.getRange("S1").getValue();
  if (valorS1 instanceof Date) {
    return Utilities.formatDate(valorS1, "GMT-3", "yyyy-MM-dd");
  } else {
    return Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  }
}

function per_buscarTodasOS() {
  try {
    const ss = ss_();
    const sheet = ss.getSheetByName("PROGRAMADAS");
    if (!sheet) return [];
    const valores = sheet.getDataRange().getValues();
    if (valores.length <= 1) return [];

    return valores.slice(1).map(row => {
      return row.map(cell => {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, "GMT-3", "yyyy-MM-dd");
        }
        return cell;
      });
    });
  } catch(e) {
    return [];
  }
}

function per_salvarDadosOS(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = ss_();
    const sheet = ss.getSheetByName("PROGRAMADAS");
    if (!sheet) return "ERRO: Aba 'PROGRAMADAS' não encontrada!";

    const data = sheet.getDataRange().getValues();

    // --- REFERÊNCIA TEMPORAL ---
    // Tenta S1 primeiro (novo padrão), cai para R1 (legado), depois usa hoje
    let hoje;
    const valorS1 = sheet.getRange("S1").getValue();
    const valorR1 = sheet.getRange("R1").getValue();
    if (valorS1 instanceof Date) {
      hoje = Utilities.formatDate(valorS1, "GMT-3", "yyyy-MM-dd");
    } else if (valorR1 instanceof Date) {
      hoje = Utilities.formatDate(valorR1, "GMT-3", "yyyy-MM-dd");
    } else {
      hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
    }

    // --- VARIÁVEIS DE CONTROLE ---
    let statusFinal     = dados.status;
    let dataIniReal     = dados.dataInicioExecucao;
    let dataFinReal     = dados.dataFinalExecucao;
    let diasTrabalhados = "";

    // --- REGRAS DE NEGÓCIO ---
    if (statusFinal === "CANCELADO") {
      dataIniReal = hoje;
      dataFinReal = hoje;
    } else if (statusFinal === "REAGENDADO" || statusFinal === "REAGENDAR") {
      statusFinal = "REAGENDADO";
    } else {
      if (dataIniReal && !dataFinReal) {
        statusFinal = "EM ANDAMENTO";
      } else if (dataIniReal && dataFinReal) {
        const dPrevista   = new Date(dados.dataPrevistaConclusao + "T12:00:00");
        const dFimReal    = new Date(dataFinReal + "T12:00:00");
        const dInicioReal = new Date(dataIniReal + "T12:00:00");
        statusFinal       = (dFimReal > dPrevista) ? "CONCLUÍDO (ATRASO)" : "CONCLUÍDO (NO PRAZO)";
        const diffTime    = Math.abs(dFimReal - dInicioReal);
        diasTrabalhados   = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    // ── MODO ATUALIZAÇÃO ──
    // BUG #6 CORRIGIDO: update agora começa na col D (comarca incluída)
    // Estrutura de atualização: D=comarca, E=edificacao, F=motivacao, G=dataInicio,
    // H=servicoPrincipal, I=servicoSec1, J=servicoSec2, K=prazo, L=status,
    // M=dataPrevistaConclusao, N=diasTrabalhados, O=responsavel, P=dataIniReal,
    // Q=dataFinReal, R=osp  → 14 colunas a partir da col D (coluna 4)
    if (dados.id_ref && dados.id_ref !== "") {
      const idProcurado = dados.id_ref.toString().trim();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === idProcurado) {
          const linha = i + 1;

          const novosValores = [
            dados.comarca,               // Col D (4)  ← BUG #6 CORRIGIDO
            dados.edificacao,            // Col E (5)
            dados.motivacao,             // Col F (6)
            dados.dataInicio,            // Col G (7)
            dados.servicoPrincipal,      // Col H (8)
            dados.servicoSec1 || "",     // Col I (9)
            dados.servicoSec2 || "",     // Col J (10)
            dados.prazo,                 // Col K (11)
            statusFinal,                 // Col L (12)
            dados.dataPrevistaConclusao, // Col M (13)
            diasTrabalhados,             // Col N (14)
            dados.responsavel,           // Col O (15)
            dataIniReal,                 // Col P (16)
            dataFinReal,                 // Col Q (17)
            dados.osp || ""              // Col R (18) ← BUG #2 CORRIGIDO
          ];

          // Começa na coluna D = coluna 4
          sheet.getRange(linha, 4, 1, novosValores.length).setValues([novosValores]);
          SpreadsheetApp.flush();
          return "O.S. nº " + idProcurado + " atualizada como " + statusFinal;
        }
      }
      return "ERRO: ID " + idProcurado + " não encontrado.";
    }

    // ── MODO NOVO CADASTRO ──
    // BUG #2 CORRIGIDO: osp agora salvo na coluna R (18ª coluna)
    let novoId = 1;
    if (data.length > 1) {
      const ids = data.slice(1).map(r => parseFloat(r[0])).filter(id => !isNaN(id));
      novoId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    }

    sheet.appendRow([
      novoId,                        // A  (0)
      dados.dataAbertura,            // B  (1)
      dados.regiao,                  // C  (2)
      dados.comarca,                 // D  (3)
      dados.edificacao,              // E  (4)
      dados.motivacao,               // F  (5)
      dados.dataInicio,              // G  (6)
      dados.servicoPrincipal,        // H  (7)
      dados.servicoSec1 || "",       // I  (8)
      dados.servicoSec2 || "",       // J  (9)
      dados.prazo,                   // K  (10)
      statusFinal,                   // L  (11)
      dados.dataPrevistaConclusao,   // M  (12)
      diasTrabalhados,               // N  (13)
      dados.responsavel,             // O  (14)
      dataIniReal,                   // P  (15)
      dataFinReal,                   // Q  (16)
      dados.osp || ""                // R  (17) ← BUG #2 CORRIGIDO
    ]);

    SpreadsheetApp.flush();
    return "Nova O.S. Gerada com ID: " + novoId;

  } catch(e) {
    return "Erro: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}