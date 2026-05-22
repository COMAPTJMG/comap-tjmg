/**
 * Módulo LAU — adaptado para o sistema COMAP Unificado.
 * Funções públicas: lau_<nome>  (ex: lau_getDados)
 * Constantes top-level: LAU_<NOME>
 *
 * Ciclo 6 — POLO substituído por REGIÃO (coluna D da aba LAUDOS)
 *           Retrocompatibilidade mantida via alias.
 */

/**
 * SISTEMA LAUDO - TJMG (COMAP.NORTE)
 * Versão completa com Subestação Aprimorada
 * Configuração: Aba "LAUDOS" com colunas A–V | Data de Referência: W1
 */

// CORREÇÃO: substituídas as constantes top-level por funções lazy.
// Razão: constantes que chamam ss_() durante o carregamento quebram TODO o sistema
// caso ss_() ainda não esteja disponível ou a aba não exista.
function LAU_SS_() {
  return ss_();
}

/* ════════════════════════════════════════════════════════════
   LAU_SHEET_DATA_  —  Aba LAUDOS (col D = REGIÃO)
   ════════════════════════════════════════════════════════════ */
function LAU_SHEET_DATA_() {
  const ss = ss_();
  let sh = ss.getSheetByName("LAUDOS") || ss.getSheetByName("Dados");
  if (!sh) {
    sh = ss.insertSheet("LAUDOS");
    sh.appendRow([
      "ID","DATA_CADASTRO","CONTRATO","REGIÃO","COMARCA","EDIFICAÇÃO","GRUPO",
      "ST_SPDA","ENT_SPDA","VAL_SPDA",
      "ST_UNIFILAR","ENT_UNIFILAR","VAL_UNIFILAR",
      "ST_PIE","ENT_PIE","VAL_PIE",
      "ST_FACHADA","ENT_FACHADA","VAL_FACHADA",
      "ST_SUBESTACAO","ENT_SUBESTACAO","VAL_SUBESTACAO"
    ]);
  }
  return sh;
}

/* ════════════════════════════════════════════════════════════
   DATA DE REFERÊNCIA (célula W1)
   ════════════════════════════════════════════════════════════ */
function lau_getDataHojeReferencia() {
  const valorW1 = LAU_SHEET_DATA_().getRange("W1").getValue();
  const fuso    = Session.getScriptTimeZone();
  if (valorW1 instanceof Date) {
    return Utilities.formatDate(valorW1, fuso, "yyyy-MM-dd");
  }
  return Utilities.formatDate(new Date(), fuso, "yyyy-MM-dd");
}

/* ════════════════════════════════════════════════════════════
   LER DADOS — col D mapeada como REGIAO (alias POLO p/ retrocompat)
   ════════════════════════════════════════════════════════════ */
function lau_lerDados() {
  const valores = LAU_SHEET_DATA_().getDataRange().getValues();
  if (valores.length <= 1) return [];

  const linhas  = valores.slice(1);
  const fuso    = Session.getScriptTimeZone();
  const hojeW1  = lau_getDataHojeReferencia();

  return linhas
    .filter(linha => linha[0] !== "" && linha[0] !== null)
    .map(linha => ({
      ID:           linha[0],
      DATA_CADASTRO: linha[1] instanceof Date
                      ? Utilities.formatDate(linha[1], fuso, "yyyy-MM-dd")
                      : (linha[1] || ""),
      CONTRATO:     linha[2],
      REGIAO:       linha[3],   // ★ era POLO; agora REGIAO
      POLO:         linha[3],   // ★ alias mantido p/ retrocompatibilidade
      COMARCA:      linha[4],
      EDIFICACAO:   linha[5],
      GRUPO:        linha[6],

      st_spda:  linha[7],  ent_spda: lau__fmtDate(linha[8],  fuso), val_spda: lau__fmtDate(linha[9],  fuso),
      st_unif:  linha[10], ent_unif: lau__fmtDate(linha[11], fuso), val_unif: lau__fmtDate(linha[12], fuso),
      st_pie:   linha[13], ent_pie:  lau__fmtDate(linha[14], fuso), val_pie:  lau__fmtDate(linha[15], fuso),
      st_fach:  linha[16], ent_fach: lau__fmtDate(linha[17], fuso), val_fach: lau__fmtDate(linha[18], fuso),
      st_sub:   linha[19], ent_sub:  lau__fmtDate(linha[20], fuso), val_sub:  lau__fmtDate(linha[21], fuso),
      hojeRef:  hojeW1
    }));
}

function lau__fmtDate(valor, fuso) {
  if (valor instanceof Date) return Utilities.formatDate(valor, fuso, "yyyy-MM-dd");
  return valor || "";
}

/* ════════════════════════════════════════════════════════════
   SALVAR REGISTRO — recebe obj.regiao (fallback obj.polo)
   ════════════════════════════════════════════════════════════ */
function lau_salvarRegistro(obj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const data = LAU_SHEET_DATA_().getDataRange().getValues();
    let id       = obj.id ? parseInt(obj.id, 10) : null;
    let rowIndex = -1;

    if (id) {
      for (let i = 1; i < data.length; i++) {
        if (parseInt(data[i][0], 10) === id) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    if (rowIndex === -1) {
      const ids = data.slice(1)
        .map(r => parseInt(r[0], 10))
        .filter(n => !isNaN(n));
      id       = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      rowIndex = data.length + 1;
    }

    const dataCadastro = (rowIndex <= data.length && data[rowIndex - 1])
      ? data[rowIndex - 1][1]
      : new Date();

    const parseDate = (str) => {
      if (!str || str === "") return "";
      const parts = str.split("-");
      if (parts.length !== 3) return "";
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    };

    // ★ MUDANÇA: usa obj.regiao; se vazio, cai pro obj.polo (retrocompat)
    const regiaoValor = (obj.regiao || obj.polo || "").toUpperCase().trim();

    const linha = [
      id,
      dataCadastro,
      (obj.contrato   || "").toUpperCase().trim(),
      regiaoValor,                                          // ★ coluna D = REGIÃO
      (obj.comarca    || "").toUpperCase().trim(),
      (obj.edificacao || "").toUpperCase().trim(),
      (obj.grupo      || "").toUpperCase().trim(),
      obj.st_spda  || "", parseDate(obj.dt_ent_spda), parseDate(obj.dt_val_spda),
      obj.st_unif  || "", parseDate(obj.dt_ent_unif), parseDate(obj.dt_val_unif),
      obj.st_pie   || "", parseDate(obj.dt_ent_pie),  parseDate(obj.dt_val_pie),
      obj.st_fach  || "", parseDate(obj.dt_ent_fach), parseDate(obj.dt_val_fach),
      obj.st_sub   || "", parseDate(obj.dt_ent_sub),  parseDate(obj.dt_val_sub)
    ];

    LAU_SHEET_DATA_().getRange(rowIndex, 1, 1, linha.length).setValues([linha]);
    return { success: true, id: id };

  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/* ════════════════════════════════════════════════════════════
   EXCLUIR REGISTRO
   ════════════════════════════════════════════════════════════ */
function lau_excluirRegistro(id) {
  const data = LAU_SHEET_DATA_().getDataRange().getValues();
  const numId = parseInt(id, 10);
  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][0], 10) === numId) {
      LAU_SHEET_DATA_().deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: "ID não encontrado" };
}

/* ════════════════════════════════════════════════════════════
   RELATÓRIO POR E-MAIL — r.POLO substituído por (r.REGIAO || r.POLO)
   ════════════════════════════════════════════════════════════ */
function lau_processarRelatorio(ids) {
  const dados     = lau_lerDados();
  const hojeStr   = lau_getDataHojeReferencia();
  const hoje      = new Date(hojeStr + "T12:00:00");
  const d30       = new Date(hoje); d30.setDate(hoje.getDate() + 30);
  const d60       = new Date(hoje); d60.setDate(hoje.getDate() + 60);

  const selecionados = dados.filter(d => ids.includes(String(d.ID)));
  const dataFormatada = hojeStr.split('-').reverse().join('/');

  let totalLaudos = 0, totalVencidos = 0, total30d = 0, totalOk = 0;
  selecionados.forEach(r => {
    const laudos = [r.val_spda, r.val_unif, r.val_pie, r.val_fach, r.val_sub];
    laudos.forEach(v => {
      if (!v) return;
      totalLaudos++;
      const dV = new Date(v + "T12:00:00");
      if (dV < hoje)      totalVencidos++;
      else if (dV <= d30) total30d++;
      else                totalOk++;
    });
  });

  const pct = totalLaudos > 0 ? Math.round((totalOk / totalLaudos) * 100) : 0;

  let html = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<style>
  body   { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px; color: #222; }
  .wrap  { max-width: 820px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #003366 0%, #00245a 100%); color: white; padding: 0; border-radius: 10px 10px 0 0; overflow: hidden; }
  .header-top { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-bottom: 3px solid #c89c31; }
  .header-title { font-size: 17px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
  .header-sub   { font-size: 10.5px; opacity: 0.7; margin-top: 3px; letter-spacing: 0.3px; }
  .header-logo  { font-size: 28px; font-weight: 900; color: #c89c31; letter-spacing: -1px; text-align: right; }
  .header-meta  { background: rgba(255,255,255,0.08); padding: 10px 28px; font-size: 10.5px; display: flex; gap: 24px; flex-wrap: wrap; }
  .header-meta span { opacity: 0.85; }
  .header-meta strong { opacity: 1; color: #f0c040; }
  .kpi-row { display: flex; gap: 0; border-radius: 0; overflow: hidden; border: 1px solid #dee2e6; border-top: none; }
  .kpi-box { flex: 1; padding: 16px 12px; text-align: center; background: white; border-right: 1px solid #e9ecef; }
  .kpi-box:last-child { border-right: none; }
  .kpi-num  { font-size: 26px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
  .kpi-lbl  { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
  .kpi-venc { color: #c62828; border-top: 3px solid #c62828; }
  .kpi-30d  { color: #e65100; border-top: 3px solid #ff9800; }
  .kpi-ok   { color: #1b5e20; border-top: 3px solid #4caf50; }
  .kpi-pct  { color: #003366; border-top: 3px solid #003366; }
  .conf-wrap { background: white; padding: 14px 20px; border: 1px solid #dee2e6; border-top: none; }
  .conf-track { height: 8px; background: #e9ecef; border-radius: 8px; overflow: hidden; }
  .conf-fill  { height: 100%; border-radius: 8px; background: linear-gradient(90deg, #1b5e20, #4caf50); }
  .conf-labels { display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 4px; }
  .comarca-section { background: white; border: 1px solid #dee2e6; border-top: none; padding: 0; overflow: hidden; }
  .comarca-header { background: #f8f9fb; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e9ecef; border-top: 2px solid #003366; }
  .comarca-nome  { font-weight: 700; font-size: 12px; color: #003366; text-transform: uppercase; }
  .comarca-edif  { font-size: 10.5px; color: #666; }
  .comarca-polo  { font-size: 10px; color: #999; background: #f0f0f0; padding: 2px 8px; border-radius: 10px; }
  .laudos-table { width: 100%; border-collapse: collapse; }
  .laudos-table th { background: #003366; color: white; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 12px; text-align: left; }
  .laudos-table td { font-size: 11px; padding: 9px 12px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
  .laudos-table tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 5px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; }
  .b-vencido { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
  .b-30d     { background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; }
  .b-60d     { background: #fffde7; color: #f57f17; border: 1px solid #ffe082; }
  .b-ok      { background: #e8f5e9; color: #1b5e20; border: 1px solid #a5d6a7; }
  .b-pend    { background: #eceff1; color: #546e7a; border: 1px solid #cfd8dc; }
  .b-na      { background: #f5f5f5; color: #9e9e9e; border: 1px solid #e0e0e0; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
  .d-venc { background: #c62828; } .d-30d { background: #ff9800; } .d-ok { background: #4caf50; } .d-pend { background: #90a4ae; }
  .footer { background: #f8f9fb; border: 1px solid #dee2e6; border-top: 2px solid #c89c31; padding: 14px 22px; border-radius: 0 0 10px 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .footer-left  { font-size: 10px; color: #666; }
  .footer-right { font-size: 10px; color: #999; text-align: right; }
  .footer-brand { font-weight: 800; color: #003366; font-size: 11px; }
  .no-records { padding: 18px 20px; text-align: center; color: #999; font-size: 11px; }
</style>
</head>
<body>
<div class="wrap">
<div class="header">
  <div class="header-top">
    <div>
      <div class="header-title">⚖ TRIBUNAL DE JUSTIÇA DO ESTADO DE MINAS GERAIS</div>
      <div class="header-sub">RELATÓRIO DE CONFORMIDADE TÉCNICA — LAUDOS E CERTIFICAÇÕES</div>
      <div class="header-sub" style="margin-top:2px;opacity:0.6;">COMAP | COORDENADORIA DE MANUTENÇÃO PREDIAL — GEMAP / TJMG</div>
    </div>
    <div class="header-logo">TJMG</div>
  </div>
  <div class="header-meta">
    <span>Data de emissão: <strong>${dataFormatada}</strong></span>
    <span>Total de imóveis: <strong>${selecionados.length}</strong></span>
    <span>Total de laudos analisados: <strong>${totalLaudos}</strong></span>
    <span>Gerado por: <strong>COMAP.NORTE</strong></span>
  </div>
</div>
<div class="kpi-row">
  <div class="kpi-box kpi-venc"><div class="kpi-num">${totalVencidos}</div><div class="kpi-lbl">⚠ Vencidos</div></div>
  <div class="kpi-box kpi-30d"><div class="kpi-num">${total30d}</div><div class="kpi-lbl">⏱ Vencem em 30d</div></div>
  <div class="kpi-box kpi-ok"><div class="kpi-num">${totalOk}</div><div class="kpi-lbl">✓ Em Dia</div></div>
  <div class="kpi-box kpi-pct"><div class="kpi-num">${pct}%</div><div class="kpi-lbl">Conformidade</div></div>
</div>
<div class="conf-wrap">
  <div class="conf-track"><div class="conf-fill" style="width:${pct}%"></div></div>
  <div class="conf-labels">
    <span>${totalOk} laudos em dia</span>
    <span>Índice de conformidade: ${pct}%</span>
    <span>${totalVencidos} vencidos</span>
  </div>
</div>`;

  selecionados.forEach(r => {
    const laudosCfg = [
      { nome: "SPDA",       st: r.st_spda, ent: r.ent_spda, val: r.val_spda },
      { nome: "UNIFILAR",   st: r.st_unif, ent: r.ent_unif, val: r.val_unif },
      { nome: "PIE",        st: r.st_pie,  ent: r.ent_pie,  val: r.val_pie  },
      { nome: "FACHADA",    st: r.st_fach, ent: r.ent_fach, val: r.val_fach },
      { nome: "SUBESTAÇÃO", st: r.st_sub,  ent: r.ent_sub,  val: r.val_sub  }
    ];

    html += `
    <div class="comarca-section">
      <div class="comarca-header">
        <div>
          <div class="comarca-nome">${r.COMARCA || "—"}</div>
          <div class="comarca-edif">${r.EDIFICACAO || "—"}</div>
        </div>
        <div style="text-align:right">
          <div class="comarca-polo">${r.REGIAO || r.POLO || "—"} • Grupo ${r.GRUPO || "—"}</div>
          <div style="font-size:10px;color:#aaa;margin-top:3px">Contrato: ${r.CONTRATO || "—"}</div>
        </div>
      </div>
      <table class="laudos-table">
        <thead><tr><th>TIPO DE LAUDO</th><th>STATUS</th><th>DATA ENTREGA</th><th>VALIDADE</th><th>SITUAÇÃO</th></tr></thead>
        <tbody>`;

    laudosCfg.forEach(l => {
      const entFormatted = l.ent ? l.ent.split('-').reverse().join('/') : '—';
      let valFormatted = '—', situacaoHtml = '', dotClass = 'd-pend';

      if (l.st === 'N/A') {
        situacaoHtml = `<span class="badge b-na">N/A</span>`;
        valFormatted = 'N/A';
      } else if (!l.val) {
        situacaoHtml = `<span class="badge b-pend">PENDENTE</span>`;
      } else {
        valFormatted = l.val.split('-').reverse().join('/');
        const dV = new Date(l.val + "T12:00:00");
        if (dV < hoje) {
          situacaoHtml = `<span class="badge b-vencido">VENCIDO</span>`; dotClass = 'd-venc';
        } else if (dV <= d30) {
          situacaoHtml = `<span class="badge b-30d">VENCE EM ${Math.ceil((dV-hoje)/864e5)}d</span>`; dotClass = 'd-30d';
        } else if (dV <= d60) {
          situacaoHtml = `<span class="badge b-60d">VENCE EM ${Math.ceil((dV-hoje)/864e5)}d</span>`; dotClass = 'd-ok';
        } else {
          situacaoHtml = `<span class="badge b-ok">VIGENTE</span>`; dotClass = 'd-ok';
        }
      }

      html += `
          <tr>
            <td><span class="dot ${dotClass}"></span><strong>${l.nome}</strong></td>
            <td>${l.st || '—'}</td>
            <td>${entFormatted}</td>
            <td><strong>${valFormatted}</strong></td>
            <td>${situacaoHtml}</td>
          </tr>`;
    });

    html += `</tbody></table></div>`;
  });

  if (selecionados.length === 0) {
    html += `<div class="comarca-section"><div class="no-records">Nenhum registro selecionado.</div></div>`;
  }

  html += `
  <div class="footer">
    <div class="footer-left">
      <div class="footer-brand">TRIBUNAL DE JUSTIÇA DE MINAS GERAIS</div>
      <div>COMAP | Coordenadoria de Manutenção Predial — GEMAP</div>
      <div>Emitido automaticamente pelo Sistema PCI em ${dataFormatada}</div>
    </div>
    <div class="footer-right">
      <div>Este relatório é gerado automaticamente pelo sistema.</div>
      <div>Para dúvidas: <strong>comap.norte@tjmg.jus.br</strong></div>
    </div>
  </div>
</div>
</body></html>`;

  MailApp.sendEmail({
    to:       "comap.norte@tjmg.jus.br",
    subject:  `[TJMG] Relatório de Conformidade Técnica — ${dataFormatada} (${selecionados.length} imóvel/is)`,
    htmlBody: html
  });

  return { success: true };
}

/* ════════════════════════════════════════════════════════════════
   SUBESTAÇÃO — SALVAR LEITURA (VERSÃO APRIMORADA)
   Suporte: Aérea / Abrigada | Trimestral / Anual / Corretiva
   Checklist Anexo B.1 TJMG | NR-10 | NBR 5419 | NBR 5356
   ════════════════════════════════════════════════════════════════ */
function lau_salvarLeituraSubestacao(dados) {
  try {
    const fuso        = "GMT-3";
    const dataAtual   = Utilities.formatDate(new Date(), fuso, "dd/MM/yyyy HH:mm");
    const dataEmissao = Utilities.formatDate(new Date(), fuso, "dd/MM/yyyy");
    const comarca     = ((dados.sub_comarca     || "Não informada") + "").toUpperCase().trim();
    const tipoSub     = (dados.tipo_sub          || "NAO_INFORMADO").toUpperCase();
    const tipoMan     = (dados.tipo_manutencao   || "NAO_INFORMADO").toUpperCase();
    const responsavel = dados.sub_responsavel    || "Não informado";
    const emailDest   = dados.email_destino      || "comap.norte@tjmg.jus.br";
    const obsGeral    = dados.sub_obs_geral      || "";
    const contrato    = dados.sub_contrato       || "";
    const subNc       = dados.sub_nc             || "";
    const subAcoes    = dados.sub_acoes          || "";

    const chkTotal    = parseInt(dados.checklist_total    || 0);
    const chkMarcados = parseInt(dados.checklist_marcados || 0);
    const chkPct      = chkTotal > 0 ? Math.round((chkMarcados / chkTotal) * 100) : 0;

    const arr = (v) => (v === undefined || v === null || v === "") ? []
                       : (Array.isArray(v) ? v : [v]);

    const ttrRef      = arr(dados["ttr_ref[]"]   || dados["ttr_ref"]);
    const numTransfos = Math.max(ttrRef.length, arr(dados["ttr_x1[]"]).length, 1);
    const numDisj     = Math.max(arr(dados["disj_ab_r[]"]).length, 1);
    const numSecc     = Math.max(arr(dados["secc_ab_r[]"]).length, 1);

    const tipoSubLabel = tipoSub === "ABRIGADA"
      ? "Abrigada (Sala Técnica)" : "Aérea (Poste/Externo)";
    const tipoManLabel = tipoMan === "ANUAL"
      ? "Preventiva Anual — Anexo B.1 TJMG"
      : tipoMan === "TRIMESTRAL"
        ? "Preventiva Trimestral (a cada 03 meses)"
        : "Corretiva / Emergencial";
    const iconTipoSub  = tipoSub === "ABRIGADA" ? "🏠" : "🏗️";
    const corChecklist = chkPct >= 100 ? "#1b5e20" : chkPct >= 80 ? "#e65100" : "#c62828";

    /* ── MAPA DE LABELS DO CHECKLIST ── */
    const chkLabels = {
      chk_seg_nr10:"NR-10 — Procedimentos de segurança executados",
      chk_seg_aterramento_temp:"Aterramento temporário instalado",
      chk_seg_desenergizacao:"Instalação desenergizada, aterrada e sinalizada",
      chk_seg_concessionaria:"Contato com concessionária realizado",
      chk_seg_cargas_deslig:"Cargas elétricas desligadas antes da manobra",
      chk_seg_prontuario_nr10:"Prontuário NR-10 verificado e atualizado",
      chk_tr_desconexao:"Entrada e saída desconectadas",
      chk_tr_limpeza:"Limpeza completa de isoladores e componentes",
      chk_tr_inspecao_ext:"Inspeção externa realizada",
      chk_tr_vazamentos:"Sem vazamentos de óleo",
      chk_tr_trincas_buchas:"Buchas sem trincas ou fissuras",
      chk_tr_instrumentos:"Instrumentos e acessórios inspecionados",
      chk_tr_reaperto:"Conexões elétricas reapertadas",
      chk_tr_aterramento_conexoes:"Conexões de aterramento verificadas",
      chk_tr_iso_cc:"Resistência de isolamento (CC) ensaiada",
      chk_tr_ohmica:"Resistência ôhmica dos enrolamentos (variação ≤ 3%)",
      chk_tr_ttr:"Relação de transformação (TTR) ensaiada",
      chk_tr_oleo_coleta:"Óleo coletado para análise (Anual)",
      chk_tr_oleo_analise_fq:"Análise físico-química do óleo realizada (Anual)",
      chk_tr_oleo_cromatografia:"Análise cromatográfica do óleo realizada (Anual)",
      chk_tr_oleo_nivel:"Nível de óleo verificado e complementado",
      chk_tr_prateamento:"Pontos de contato prateados tratados",
      chk_tr_reconexao:"Reconexão após ensaios",
      chk_dj_inspecao_ext:"Inspeção externa e limpeza do disjuntor",
      chk_dj_mecanismo:"Mecanismo limpo e lubrificado",
      chk_dj_conexoes:"Conexões reapertadas com torque adequado",
      chk_dj_oleo_pvo:"Óleo PVO substituído (ABNT IEC 60296)",
      chk_dj_grandezas:"Grandezas elétricas ensaiadas",
      chk_dj_resist_contato:"Resistência de contato ensaiada (R, S, T)",
      chk_dj_iso:"Resistência de isolamento ensaiada (aberto e fechado)",
      chk_dj_operacao:"Operação do disjuntor testada",
      chk_dj_reles:"Relés primários ajustados",
      chk_sc_inspecao:"Inspeção e limpeza geral da chave",
      chk_sc_contatos:"Contatos desoxidados e polidos",
      chk_sc_lubrificacao:"Partes articuladas lubrificadas",
      chk_sc_resist_contato:"Resistência de contato ensaiada",
      chk_sc_iso:"Resistência de isolamento ensaiada",
      chk_sc_conexoes:"Conexões reapertadas",
      chk_sc_molas:"Pressão das molas ajustada",
      chk_sc_teste:"Operação da chave testada",
      chk_muf_visual:"Inspeção visual de todas as muflas",
      chk_muf_termico:"Medições termográficas realizadas",
      chk_muf_limpeza:"Limpeza executada",
      chk_muf_iso:"Testes de isolamento realizados",
      chk_rel_operacional:"Condições operacionais verificadas",
      chk_rel_nobreak:"Nobreak e baterias verificados",
      chk_rel_configuracao:"Relés reconfigurados se necessário",
      chk_bb_visual:"Inspeção visual de toda a extensão dos barramentos",
      chk_bb_torque:"Reaperto com torquímetro",
      chk_bb_limpeza:"Limpeza com soprador (remoção de poeira)",
      chk_bb_termico:"Medições termográficas",
      chk_pan_limpeza_geral:"Limpeza geral de barramentos e painéis",
      chk_pan_reaperto:"Conexões reapertadas com torque",
      chk_pan_limpeza_dependencias:"Dependências limpas",
      chk_pan_parafusos:"Parafusos e terminais faltantes supridos",
      chk_pan_corrosao:"Corrosões tratadas e pinturas aplicadas",
      chk_pan_termico:"Termografia dos painéis realizada",
      chk_pan_iluminacao:"Iluminação interna dos painéis mantida",
      chk_pan_coolers:"Coolers em perfeito funcionamento",
      chk_sala_limpeza:"Limpeza das áreas internas da subestação",
      chk_sala_grades_portas:"Grades e portões — reparos de segurança executados",
      chk_sala_cadeados:"Cadeados inspecionados e repostos se necessário",
      chk_sala_ilum_geral:"Iluminação geral e de emergência verificada",
      chk_sala_limpeza_sup:"Parte superior de cabines e painéis limpa",
      chk_sala_conectores:"Conectores faltantes repostos",
      chk_vis_integridade:"Inspeção visual de integridade realizada",
      chk_vis_medicoes_bt:"Medições BT (tensão e corrente a plena carga)",
      chk_vis_termografia:"Termografia realizada",
      chk_vis_substituicao:"Componentes danificados substituídos",
      chk_vis_ajustes:"Ajustes e reparos executados",
      chk_rel_fotos:"Relatório fotográfico elaborado",
      chk_rel_valores:"Valores dos ensaios registrados",
      chk_rel_conformidades:"Conformidades/não conformidades documentadas",
      chk_rel_corretivos:"Serviços corretivos documentados",
      chk_rel_religacao:"Instalação reenergizada — cargas restabelecidas",
      chk_rel_fiscalizacao:"Relatório a ser entregue à Fiscalização (10 dias úteis)"
    };

    const secoes = {
      "A — Segurança e NR-10":               ["chk_seg_nr10","chk_seg_aterramento_temp","chk_seg_desenergizacao","chk_seg_concessionaria","chk_seg_cargas_deslig","chk_seg_prontuario_nr10"],
      "B — Transformadores":                  ["chk_tr_desconexao","chk_tr_limpeza","chk_tr_inspecao_ext","chk_tr_vazamentos","chk_tr_trincas_buchas","chk_tr_instrumentos","chk_tr_reaperto","chk_tr_aterramento_conexoes","chk_tr_iso_cc","chk_tr_ohmica","chk_tr_ttr","chk_tr_oleo_coleta","chk_tr_oleo_analise_fq","chk_tr_oleo_cromatografia","chk_tr_oleo_nivel","chk_tr_prateamento","chk_tr_reconexao"],
      "C/D — Disjuntores de Média Tensão":   ["chk_dj_inspecao_ext","chk_dj_mecanismo","chk_dj_conexoes","chk_dj_oleo_pvo","chk_dj_grandezas","chk_dj_resist_contato","chk_dj_iso","chk_dj_operacao","chk_dj_reles"],
      "E — Chaves Seccionadoras":            ["chk_sc_inspecao","chk_sc_contatos","chk_sc_lubrificacao","chk_sc_resist_contato","chk_sc_iso","chk_sc_conexoes","chk_sc_molas","chk_sc_teste"],
      "G — Muflas":                          ["chk_muf_visual","chk_muf_termico","chk_muf_limpeza","chk_muf_iso"],
      "H — Relés Secundários (Abrigada)":    ["chk_rel_operacional","chk_rel_nobreak","chk_rel_configuracao"],
      "I — Barramentos Blindados (Abrigada)":["chk_bb_visual","chk_bb_torque","chk_bb_limpeza","chk_bb_termico"],
      "J — Painéis Principais (Abrigada)":   ["chk_pan_limpeza_geral","chk_pan_reaperto","chk_pan_limpeza_dependencias","chk_pan_parafusos","chk_pan_corrosao","chk_pan_termico","chk_pan_iluminacao","chk_pan_coolers"],
      "K — Sala da Subestação (Abrigada)":   ["chk_sala_limpeza","chk_sala_grades_portas","chk_sala_cadeados","chk_sala_ilum_geral","chk_sala_limpeza_sup","chk_sala_conectores"],
      "Inspeção Visual Trimestral":          ["chk_vis_integridade","chk_vis_medicoes_bt","chk_vis_termografia","chk_vis_substituicao","chk_vis_ajustes"],
      "Documentação e Relatório":            ["chk_rel_fotos","chk_rel_valores","chk_rel_conformidades","chk_rel_corretivos","chk_rel_religacao","chk_rel_fiscalizacao"]
    };

    function renderChecklist(secoesMap, dadosForm) {
      let h = "";
      for (const [titulo, chaves] of Object.entries(secoesMap)) {
        const items    = chaves.filter(k => dadosForm[k] !== undefined);
        if (items.length === 0) continue;
        const marcados = items.filter(k => dadosForm[k] === "SIM").length;
        const total    = items.length;
        const pctSec   = total > 0 ? Math.round((marcados / total) * 100) : 0;
        const corSec   = pctSec === 100 ? "#1b5e20" : pctSec >= 50 ? "#e65100" : "#c62828";

        h += `<div style="margin-bottom:12px;border:1px solid #dde3ec;border-radius:6px;overflow:hidden;page-break-inside:avoid;">
          <div style="background:#f8f9fb;padding:7px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e9ecef;">
            <span style="font-size:10.5px;font-weight:700;color:#003366;text-transform:uppercase;">${titulo}</span>
            <span style="font-size:9.5px;font-weight:700;color:${corSec};background:${corSec}18;padding:2px 8px;border-radius:10px;">${marcados}/${total} — ${pctSec}%</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">`;

        items.forEach(k => {
          const ok  = dadosForm[k] === "SIM";
          const cor = ok ? "#1b5e20" : "#c62828";
          const bg  = ok ? "#f9fff9" : "#fff9f9";
          h += `<tr style="background:${bg};border-bottom:1px solid #f0f2f5;">
            <td style="padding:5px 12px;font-size:10px;width:28px;text-align:center;font-weight:700;color:${cor};">${ok?"✓":"✗"}</td>
            <td style="padding:5px 8px 5px 0;font-size:10px;color:#334;">${chkLabels[k] || k}</td>
          </tr>`;
        });
        h += `</table></div>`;
      }
      return h;
    }

    /* ── HTML DO PDF ── */
    let html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a2332;font-size:11px;background:#fff}
  .doc-header{background:linear-gradient(135deg,#003366 0%,#00245a 100%);color:white;border-bottom:4px solid #c89c31}
  .doc-header-top{display:flex;align-items:center;justify-content:space-between;padding:18px 24px 14px}
  .doc-logo-text{font-size:36px;font-weight:900;color:#c89c31;line-height:1;letter-spacing:-1px}
  .doc-logo-sub{font-size:8px;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase}
  .doc-title{font-size:16px;font-weight:800;letter-spacing:-0.3px;line-height:1.2}
  .doc-subtitle{font-size:9px;opacity:0.7;margin-top:4px;letter-spacing:0.3px;text-transform:uppercase}
  .doc-meta-bar{background:rgba(255,255,255,0.1);padding:8px 24px;display:flex;gap:16px;flex-wrap:wrap;font-size:9.5px;border-top:1px solid rgba(255,255,255,0.15)}
  .doc-meta-bar b{color:#f0c040}
  .kpi-row{display:flex;border:1px solid #dee2e6}
  .kpi-box{flex:1;padding:12px;text-align:center;background:white;border-right:1px solid #e9ecef}
  .kpi-box:last-child{border-right:none}
  .kpi-num{font-size:22px;font-weight:800;line-height:1;margin-bottom:3px}
  .kpi-lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666}
  .section-header{background:#003366;color:white;padding:8px 14px;font-size:10.5px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;margin-top:18px;border-left:4px solid #c89c31}
  .equip-card{border:1px solid #dee2e6;margin:10px 0;border-radius:6px;overflow:hidden;page-break-inside:avoid}
  .equip-title{background:#f8f9fb;padding:7px 14px;font-weight:700;font-size:10px;color:#003366;text-transform:uppercase;border-bottom:1px solid #dee2e6}
  .equip-body{padding:12px 14px}
  .med-table{width:100%;border-collapse:collapse;margin-top:6px}
  .med-table .group-label{background:#eceff1;color:#546e7a;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:5px 10px}
  .med-table th{background:#f0f4f8;font-size:9px;font-weight:700;color:#003366;padding:5px 10px;text-align:left;border-bottom:1px solid #dde3ec;text-transform:uppercase}
  .med-table td{padding:6px 10px;border-bottom:1px solid #f0f2f5;font-size:10.5px}
  .val-cell{font-weight:700;color:#003366;background:#fffde7;text-align:center}
  .unit-cell{color:#777;font-size:9.5px;text-align:center;width:50px}
  .variacao-ok{background:#e8f5e9;color:#1b5e20;padding:5px 10px;border-radius:4px;font-size:10px;font-weight:700;margin-top:8px;display:inline-block}
  .variacao-fail{background:#ffebee;color:#c62828;padding:5px 10px;border-radius:4px;font-size:10px;font-weight:700;margin-top:8px;display:inline-block}
  .nc-box{border-left:4px solid #c62828;background:#fff5f5;padding:10px 14px;margin-top:14px;border-radius:0 6px 6px 0}
  .ac-box{border-left:4px solid #1b5e20;background:#f5fff5;padding:10px 14px;margin-top:8px;border-radius:0 6px 6px 0}
  .obs-box{border-left:4px solid #003366;background:#f0f4f8;padding:10px 14px;margin-top:8px;border-radius:0 6px 6px 0}
  .doc-footer{margin-top:24px;padding:12px 16px;border-top:2px solid #c89c31;background:#f8f9fb;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#777}
  .doc-footer-brand{font-weight:800;color:#003366;font-size:10.5px}
</style>
</head>
<body>
<div class="doc-header">
  <div class="doc-header-top">
    <div>
      <div class="doc-title">${iconTipoSub} RELATÓRIO DE INSPEÇÃO TÉCNICA — SUBESTAÇÃO ${tipoSub}</div>
      <div class="doc-subtitle">TRIBUNAL DE JUSTIÇA DO ESTADO DE MINAS GERAIS — TJMG<br>COMAP | Coordenadoria de Manutenção Predial — GEMAP</div>
    </div>
    <div style="text-align:right">
      <div class="doc-logo-text">TJMG</div>
      <div class="doc-logo-sub">Poder Judiciário<br>Minas Gerais</div>
    </div>
  </div>
  <div class="doc-meta-bar">
    <span>COMARCA: <b>${comarca}</b></span>
    <span>TIPO: <b>${tipoSubLabel}</b></span>
    <span>MANUTENÇÃO: <b>${tipoManLabel}</b></span>
    <span>DATA: <b>${dataAtual}</b></span>
    <span>RESPONSÁVEL: <b>${responsavel}</b></span>
    ${contrato ? `<span>CONTRATO: <b>${contrato}</b></span>` : ""}
  </div>
</div>

<div class="kpi-row" style="border-top:none;">
  <div class="kpi-box" style="border-top:3px solid #003366;">
    <div class="kpi-num" style="color:#003366;font-size:13px;">${tipoSub}</div>
    <div class="kpi-lbl">Tipo de Subestação</div>
  </div>
  <div class="kpi-box" style="border-top:3px solid #003366;">
    <div class="kpi-num" style="font-size:11px;color:#003366;">${tipoManLabel.split("—")[0].trim()}</div>
    <div class="kpi-lbl">Tipo de Manutenção</div>
  </div>
  <div class="kpi-box" style="border-top:3px solid ${corChecklist};">
    <div class="kpi-num" style="color:${corChecklist};">${chkPct}%</div>
    <div class="kpi-lbl">Checklist Concluído</div>
  </div>
  <div class="kpi-box" style="border-top:3px solid ${chkPct===100?"#1b5e20":"#c62828"};">
    <div class="kpi-num" style="color:${chkPct===100?"#1b5e20":"#c62828"};">${chkMarcados}/${chkTotal}</div>
    <div class="kpi-lbl">Itens Verificados</div>
  </div>
</div>

<div style="background:#fff;border:1px solid #dee2e6;border-top:none;padding:12px 16px;">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5px;color:#666;">
    <span>Índice de Conformidade do Checklist — Anexo B.1 TJMG | NR-10 | NBR 5419 | NBR 5356</span>
    <strong style="color:${corChecklist}">${chkPct}%</strong>
  </div>
  <div style="height:7px;background:#e9ecef;border-radius:7px;overflow:hidden;">
    <div style="height:100%;width:${chkPct}%;background:${corChecklist};border-radius:7px;"></div>
  </div>
</div>

${obsGeral ? `<div class="obs-box"><strong>Observações Gerais:</strong> ${obsGeral}</div>` : ""}

<div class="section-header">📋 CHECKLIST — ${tipoManLabel.toUpperCase()}</div>
${renderChecklist(secoes, dados)}
`;

    /* ── HELPERS DE AVALIAÇÃO NORMATIVA ── */
    function avaliarMin(valor, min, unidade, norma) {
      const v = parseFloat(valor);
      if (!v || v <= 0) return { status:'nd', badge:'N/D', bg:'#f5f5f5', cor:'#9e9e9e' };
      if (v < min) return { status:'danger', badge:`✗ FORA — mín. ${min} ${unidade} (${norma})`, bg:'#ffebee', cor:'#c62828' };
      return { status:'ok', badge:`✓ Conforme`, bg:'#e8f5e9', cor:'#1b5e20' };
    }
    function avaliarMax(valor, max, maxCrit, unidade, norma) {
      const v = parseFloat(valor);
      if (!v || v <= 0) return { status:'nd', badge:'N/D', bg:'#f5f5f5', cor:'#9e9e9e' };
      if (maxCrit && v > maxCrit) return { status:'danger', badge:`✗ CRÍTICO — máx. ${maxCrit} ${unidade} (${norma})`, bg:'#ffebee', cor:'#c62828' };
      if (v > max) return { status:'warn', badge:`⚠ Atenção — máx. ${max} ${unidade} (${norma})`, bg:'#fff3e0', cor:'#e65100' };
      return { status:'ok', badge:`✓ Conforme`, bg:'#e8f5e9', cor:'#1b5e20' };
    }

    const ncList   = [];
    const warnList = [];

    /* ── TRANSFORMADORES ── */
    html += `<div class="section-header">📦 MEDIÇÕES — TRANSFORMADORES (${numTransfos} unidade${numTransfos>1?"s":""})</div>`;
    for (let i = 0; i < numTransfos; i++) {
      const g = (key) => { const a = arr(dados[key+"[]"] || dados[key]); return a[i] || ""; };
      const equip = `Transformador #${i+1} (REF: ${g("ttr_ref")||"—"})`;

      const h12 = parseFloat(g("ohm_h1h2")) || 0;
      const h13 = parseFloat(g("ohm_h1h3")) || 0;
      const h23 = parseFloat(g("ohm_h2h3")) || 0;
      const vals3 = [h12, h13, h23].filter(v => v > 0);
      let varHtml = "";
      if (vals3.length === 3) {
        const variacao = ((Math.max(...vals3) / Math.min(...vals3)) - 1) * 100;
        const vOk = variacao <= 3;
        varHtml = `<div style="margin-top:8px;padding:6px 10px;border-radius:4px;background:${vOk?"#e8f5e9":"#ffebee"};display:inline-block;font-size:10px;font-weight:700;color:${vOk?"#1b5e20":"#c62828"};">
          ${vOk?"✓":"✗"} Variação Ôhmica: ${variacao.toFixed(2)}% — ${vOk?"CONFORME (≤ 3%) — NBR 5356":"FORA DO LIMITE (> 3%) — NBR 5356 — AÇÃO NECESSÁRIA"}
        </div>`;
        if (!vOk) ncList.push({ equip, ponto:'Variação Ôhmica H1-H2/H1-H3/H2-H3', valor:`${variacao.toFixed(2)}%`, limite:'máx. 3%', norma:'NBR 5356', nivel:'danger' });
      }

      const isoAT = ['iso_h1t','iso_h2t','iso_h3t'];
      const isoBT = ['iso_h1x1','iso_h2x2','iso_h3x3'];
      const isoLabels = {iso_h1t:'H1-T',iso_h2t:'H2-T',iso_h3t:'H3-T',iso_h1x1:'H1-X1',iso_h2x2:'H2-X2',iso_h3x3:'H3-X3'};
      isoAT.forEach(k => { const v = parseFloat(g(k)); if(v&&v<100) ncList.push({equip, ponto:`Isolação ${isoLabels[k]} (AT)`, valor:`${v} MΩ`, limite:'mín. 100 MΩ', norma:'NBR 5356', nivel:'danger'}); });
      isoBT.forEach(k => { const v = parseFloat(g(k)); if(v&&v<10)  ncList.push({equip, ponto:`Isolação ${isoLabels[k]} (BT)`, valor:`${v} MΩ`, limite:'mín. 10 MΩ',  norma:'NBR 5356', nivel:'danger'}); });

      // ── CÁLCULO DO TTR TEÓRICO ──
      const atKv  = parseFloat(g("ttr_tensao_at")) || 0;
      const btV   = parseFloat(g("ttr_tensao_bt")) || 0;
      const teoA  = (atKv > 0 && btV > 0) ? (atKv * 1000) / btV : null;
      const teoMin = teoA ? teoA * 0.995 : null;
      const teoMax = teoA ? teoA * 1.005 : null;

      const avaliarTTRPoint = (valStr, ponto) => {
        const v = parseFloat(valStr);
        if (!v || v <= 0) return { status:'nd', badge:'N/D', bg:'#f5f5f5', cor:'#9e9e9e', desvio:null };
        if (!teoA) return { status:'nd', badge:'Tensão AT/BT não informadas — validação indisponível', bg:'#fff8e1', cor:'#e65100', desvio:null };
        const desvio = ((v - teoA) / teoA) * 100;
        const ok = v >= teoMin && v <= teoMax;
        return ok
          ? { status:'ok', desvio, badge:`✓ Conforme — desvio: ${desvio>=0?'+':''}${desvio.toFixed(3)}% (tol. ±0,5%)`, bg:'#e8f5e9', cor:'#1b5e20' }
          : { status:'danger', desvio, badge:`✗ FORA — desvio: ${desvio>=0?'+':''}${desvio.toFixed(3)}% | limite ±0,5% (IEC 60076)`, bg:'#ffebee', cor:'#b71c1c' };
      };

      const avX1 = avaliarTTRPoint(g("ttr_x1"), "X1-T");
      const avX2 = avaliarTTRPoint(g("ttr_x2"), "X2-T");
      const avX3 = avaliarTTRPoint(g("ttr_x3"), "X3-T");

      [{av:avX1,k:'ttr_x1',p:'TTR X1-T'},{av:avX2,k:'ttr_x2',p:'TTR X2-T'},{av:avX3,k:'ttr_x3',p:'TTR X3-T'}].forEach(({av,k,p}) => {
        if(av.status==='danger') ncList.push({
          equip, ponto:p,
          valor:`${g(k)} (teórico: ${teoA?teoA.toFixed(2):'—'}, desvio: ${av.desvio!=null?(av.desvio>=0?'+':'')+av.desvio.toFixed(3)+'%':'—'})`,
          limite:'desvio ≤ ±0,5% do valor teórico', norma:'IEC 60076', nivel:'danger'
        });
      });

      const celTTR = (av, v) => {
        if (!v) return `<td style="background:#f5f5f5;text-align:center;padding:5px 8px;color:#9e9e9e;font-size:9px;">N/D</td>`;
        return `<td style="background:${av.bg};padding:5px 8px;vertical-align:middle;"><span style="font-weight:700;color:${av.cor};font-size:10.5px;">${v}</span><br><span style="font-size:7.5px;color:${av.cor};">${av.badge}</span></td>`;
      };

      const ttrTeoricoHtml = teoA
        ? `<div style="background:#e8f0fb;border:1px solid #90b4e8;border-radius:4px;padding:7px 12px;margin-bottom:8px;font-size:9px;">
            <b style="color:#003366">&#9881; Relação Teórica (a = V1 / V2):</b>
            ${(atKv*1000).toLocaleString('pt-BR')} V ÷ ${btV.toLocaleString('pt-BR')} V =
            <b style="color:#003366;font-size:11px"> ${teoA.toFixed(2)}</b>
            &nbsp;|&nbsp; Tolerância ±0,5% → Faixa admissível: <b>${teoMin.toFixed(2)} a ${teoMax.toFixed(2)}</b>
            &nbsp;|&nbsp; <i style="color:#555">IEC 60076</i>
           </div>`
        : `<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:6px 12px;margin-bottom:8px;font-size:8.5px;color:#e65100;">
            ⚠ Tensão AT e/ou BT não informadas — validação do TTR indisponível
           </div>`;

      const kva = g("ttr_kva") ? ` | ${g("ttr_kva")} kVA` : "";
      const tAt = atKv ? ` | AT: ${atKv} kV` : "";
      const tBt = btV  ? ` | BT: ${btV} V`  : "";

      const avH1t  = avaliarMin(g("iso_h1t"), 100, 'MΩ', 'NBR 5356');
      const avH2t  = avaliarMin(g("iso_h2t"), 100, 'MΩ', 'NBR 5356');
      const avH3t  = avaliarMin(g("iso_h3t"), 100, 'MΩ', 'NBR 5356');
      const avH1x1 = avaliarMin(g("iso_h1x1"), 10, 'MΩ', 'NBR 5356');
      const avH2x2 = avaliarMin(g("iso_h2x2"), 10, 'MΩ', 'NBR 5356');
      const avH3x3 = avaliarMin(g("iso_h3x3"), 10, 'MΩ', 'NBR 5356');

      html += `
      <div class="equip-card">
        <div class="equip-title">${equip}${kva}${tAt}${tBt}</div>
        <div class="equip-body">
          ${ttrTeoricoHtml}
          <table class="med-table">
            <tr><td colspan="4" class="group-label">RELAÇÃO DE TRANSFORMAÇÃO (TTR) — desvio máx. ±0,5% do valor teórico a = V1/V2 (IEC 60076)</td></tr>
            <tr><th>PONTO</th><th>VALOR MEDIDO / STATUS</th><th>PONTO</th><th>VALOR MEDIDO / STATUS</th></tr>
            <tr><td><b>X1-T</b></td>${celTTR(avX1,g("ttr_x1"))}<td><b>X2-T</b></td>${celTTR(avX2,g("ttr_x2"))}</tr>
            <tr><td><b>X3-T</b></td>${celTTR(avX3,g("ttr_x3"))}<td>—</td><td>—</td></tr>

            <tr><td colspan="4" class="group-label">ISOLAÇÃO MEGÔMETRO — AT ≥ 100 MΩ | BT ≥ 10 MΩ (NBR 5356 / IEC 60076)</td></tr>
            <tr><th>PONTO</th><th>VALOR / STATUS</th><th>PONTO</th><th>VALOR / STATUS</th></tr>
            <tr>
              <td><b>H1-T (AT)</b></td>
              <td style="background:${avH1t.bg};"><span style="font-weight:700;color:${avH1t.cor}">${g("iso_h1t")||'—'} ${g("iso_h1t")?g("u_iso_h1t")||'MΩ':''}</span><br><span style="font-size:8px;color:${avH1t.cor}">${avH1t.badge}</span></td>
              <td><b>H2-T (AT)</b></td>
              <td style="background:${avH2t.bg};"><span style="font-weight:700;color:${avH2t.cor}">${g("iso_h2t")||'—'} ${g("iso_h2t")?g("u_iso_h2t")||'MΩ':''}</span><br><span style="font-size:8px;color:${avH2t.cor}">${avH2t.badge}</span></td>
            </tr>
            <tr>
              <td><b>H3-T (AT)</b></td>
              <td style="background:${avH3t.bg};"><span style="font-weight:700;color:${avH3t.cor}">${g("iso_h3t")||'—'} ${g("iso_h3t")?g("u_iso_h3t")||'MΩ':''}</span><br><span style="font-size:8px;color:${avH3t.cor}">${avH3t.badge}</span></td>
              <td><b>H1-X1 (BT)</b></td>
              <td style="background:${avH1x1.bg};"><span style="font-weight:700;color:${avH1x1.cor}">${g("iso_h1x1")||'—'} ${g("iso_h1x1")?g("u_iso_h1x1")||'MΩ':''}</span><br><span style="font-size:8px;color:${avH1x1.cor}">${avH1x1.badge}</span></td>
            </tr>
            <tr>
              <td><b>H2-X2 (BT)</b></td>
              <td style="background:${avH2x2.bg};"><span style="font-weight:700;color:${avH2x2.cor}">${g("iso_h2x2")||'—'} ${g("iso_h2x2")?g("u_iso_h2x2")||'MΩ':''}</span><br><span style="font-size:8px;color:${avH2x2.cor}">${avH2x2.badge}</span></td>
              <td><b>H3-X3 (BT)</b></td>
              <td style="background:${avH3x3.bg};"><span style="font-weight:700;color:${avH3x3.cor}">${g("iso_h3x3")||'—'} ${g("iso_h3x3")?g("u_iso_h3x3")||'MΩ':''}</span><br><span style="font-size:8px;color:${avH3x3.cor}">${avH3x3.badge}</span></td>
            </tr>

            <tr><td colspan="4" class="group-label">RESISTÊNCIA ÔHMICA — Variação máx. 3% entre fases H1-H2, H1-H3, H2-H3 (NBR 5356 / IEC 60076)</td></tr>
            <tr><th>PONTO</th><th>VALOR</th><th>PONTO</th><th>VALOR</th></tr>
            <tr><td><b>X1-X0</b></td><td class="val-cell">${g("ohm_x1x0")||'—'} ${g("u_ohm_x1x0")||''}</td><td><b>X2-X0</b></td><td class="val-cell">${g("ohm_x2x0")||'—'} ${g("u_ohm_x2x0")||''}</td></tr>
            <tr><td><b>X3-X0</b></td><td class="val-cell">${g("ohm_x3x0")||'—'} ${g("u_ohm_x3x0")||''}</td><td><b>H1-H2</b></td><td class="val-cell">${g("ohm_h1h2")||'—'} ${g("u_ohm_h1h2")||''}</td></tr>
            <tr><td><b>H1-H3</b></td><td class="val-cell">${g("ohm_h1h3")||'—'}</td><td><b>H2-H3</b></td><td class="val-cell">${g("ohm_h2h3")||'—'}</td></tr>
          </table>
          ${varHtml}
          ${g("ttr_obs") ? `<div style="margin-top:8px;font-size:9.5px;color:#555;padding:6px 10px;background:#f8f9fb;border-radius:4px;border-left:3px solid #003366;"><b>Obs.:</b> ${g("ttr_obs")}</div>` : ""}
        </div>
      </div>`;
    }

    var celIso = function(av, v, u) {
      return '<td style="background:' + av.bg + ';padding:6px 10px;"><span style="font-weight:700;color:' + av.cor + '">' + (v||'—') + ' ' + (v?u:'') + '</span><br><span style="font-size:7.5px;color:' + av.cor + '">' + av.badge + '</span></td>';
    };

    /* ── DISJUNTORES ── */
    html += '<div class="section-header">🔌 MEDIÇÕES — DISJUNTORES DE MÉDIA TENSÃO (' + numDisj + ' unidade' + (numDisj>1?'s':'') + ')</div>';
    for (var di = 0; di < numDisj; di++) {
      var gd = (function(idx){ return function(key){ var a=arr(dados[key+'[]']||dados[key]); return a[idx]||''; }; })(di);
      var equipD = 'Disjuntor #' + (di+1);

      var avAbR_d = avaliarMin(gd("disj_ab_r"), 1000, 'MΩ', 'IEC 62271-100');
      var avAbS_d = avaliarMin(gd("disj_ab_s"), 1000, 'MΩ', 'IEC 62271-100');
      var avAbT_d = avaliarMin(gd("disj_ab_t"), 1000, 'MΩ', 'IEC 62271-100');
      var avFeR_d = avaliarMin(gd("disj_fe_r"), 1000, 'MΩ', 'IEC 62271-100');
      var avFeS_d = avaliarMin(gd("disj_fe_s"), 1000, 'MΩ', 'IEC 62271-100');
      var avFeT_d = avaliarMin(gd("disj_fe_t"), 1000, 'MΩ', 'IEC 62271-100');
      var avCR_d  = avaliarMax(gd("disj_cont_r"), 200, 300, 'µΩ', 'IEC 62271-100');
      var avCS_d  = avaliarMax(gd("disj_cont_s"), 200, 300, 'µΩ', 'IEC 62271-100');
      var avCT_d  = avaliarMax(gd("disj_cont_t"), 200, 300, 'µΩ', 'IEC 62271-100');

      [{av:avAbR_d,p:'Isolação AB: R'},{av:avAbS_d,p:'Isolação AB: S'},{av:avAbT_d,p:'Isolação AB: T'},
       {av:avFeR_d,p:'Isolação FE: R'},{av:avFeS_d,p:'Isolação FE: S'},{av:avFeT_d,p:'Isolação FE: T'}]
      .forEach(function(x){ if(x.av.status==='danger') ncList.push({equip:equipD,ponto:x.p,valor:x.av.badge,limite:'mín. 1000 MΩ',norma:'IEC 62271-100',nivel:'danger'}); });
      [{av:avCR_d,p:'Res.Contato R1-R2'},{av:avCS_d,p:'Res.Contato S1-S2'},{av:avCT_d,p:'Res.Contato T1-T2'}]
      .forEach(function(x){
        if(x.av.status==='danger') ncList.push({equip:equipD,ponto:x.p,valor:x.av.badge,limite:'máx. 300 µΩ',norma:'IEC 62271-100',nivel:'danger'});
        else if(x.av.status==='warn') warnList.push({equip:equipD,ponto:x.p,valor:x.av.badge,limite:'máx. 200 µΩ',norma:'IEC 62271-100',nivel:'warn'});
      });

      html += '\n      <div class="equip-card">'
        + '\n        <div class="equip-title">' + equipD + ' — Tipo: ' + (dados.tipo_disj||"Não informado") + '</div>'
        + '\n        <div class="equip-body">'
        + '\n          <table class="med-table">'
        + '\n            <tr><td colspan="7" class="group-label">ISOLAÇÃO — ABERTO ≥ 1000 MΩ | FECHADO ≥ 1000 MΩ (IEC 62271-100)</td></tr>'
        + '\n            <tr><th>FASE</th><th>ABERTO / STATUS</th><th></th><th></th><th>FECHADO / STATUS</th><th></th><th style="width:40px">UNID.</th></tr>'
        + '\n            <tr><td><b>R</b></td>' + celIso(avAbR_d,gd("disj_ab_r"),gd("u_disj_ab_r")||"MΩ") + '<td></td><td></td>' + celIso(avFeR_d,gd("disj_fe_r"),gd("u_disj_fe_r")||"MΩ") + '<td></td><td class="unit-cell">MΩ</td></tr>'
        + '\n            <tr><td><b>S</b></td>' + celIso(avAbS_d,gd("disj_ab_s"),gd("u_disj_ab_s")||"MΩ") + '<td></td><td></td>' + celIso(avFeS_d,gd("disj_fe_s"),gd("u_disj_fe_s")||"MΩ") + '<td></td><td></td></tr>'
        + '\n            <tr><td><b>T</b></td>' + celIso(avAbT_d,gd("disj_ab_t"),gd("u_disj_ab_t")||"MΩ") + '<td></td><td></td>' + celIso(avFeT_d,gd("disj_fe_t"),gd("u_disj_fe_t")||"MΩ") + '<td></td><td></td></tr>'
        + '\n            <tr><td colspan="7" class="group-label">RESISTÊNCIA DE CONTATO — atenção > 200 µΩ | crítico > 300 µΩ (IEC 62271-100)</td></tr>'
        + '\n            <tr><th>PONTO</th><th>VALOR / STATUS</th><th colspan="5"></th></tr>'
        + '\n            <tr><td><b>R1-R2</b></td>' + celIso(avCR_d,gd("disj_cont_r"),gd("u_disj_cont_r")||"µΩ") + '<td colspan="5"></td></tr>'
        + '\n            <tr><td><b>S1-S2</b></td>' + celIso(avCS_d,gd("disj_cont_s"),gd("u_disj_cont_s")||"µΩ") + '<td colspan="5"></td></tr>'
        + '\n            <tr><td><b>T1-T2</b></td>' + celIso(avCT_d,gd("disj_cont_t"),gd("u_disj_cont_t")||"µΩ") + '<td colspan="5"></td></tr>'
        + '\n          </table>'
        + (gd("disj_obs") ? '\n          <div style="margin-top:8px;font-size:9.5px;color:#555;padding:6px 10px;background:#f8f9fb;border-radius:4px;border-left:3px solid #003366;"><b>Obs.:</b> ' + gd("disj_obs") + '</div>' : '')
        + '\n        </div>\n      </div>';
    }

    /* ── CHAVES SECCIONADORAS ── */
    html += '<div class="section-header">🔑 MEDIÇÕES — CHAVE SECCIONADORA (' + numSecc + ' unidade' + (numSecc>1?'s':'') + ')</div>';
    for (var si = 0; si < numSecc; si++) {
      var gs = (function(idx){ return function(key){ var a=arr(dados[key+'[]']||dados[key]); return a[idx]||''; }; })(si);
      var equipS = 'Seccionadora #' + (si+1);

      var avAbR_s = avaliarMin(gs("secc_ab_r"), 1000, 'MΩ', 'IEC 62271-102');
      var avAbS_s = avaliarMin(gs("secc_ab_s"), 1000, 'MΩ', 'IEC 62271-102');
      var avAbT_s = avaliarMin(gs("secc_ab_t"), 1000, 'MΩ', 'IEC 62271-102');
      var avFeR_s = avaliarMin(gs("secc_fe_r"), 1000, 'MΩ', 'IEC 62271-102');
      var avFeS_s = avaliarMin(gs("secc_fe_s"), 1000, 'MΩ', 'IEC 62271-102');
      var avFeT_s = avaliarMin(gs("secc_fe_t"), 1000, 'MΩ', 'IEC 62271-102');
      var avCR_s  = avaliarMax(gs("secc_cont_r"), 200, 500, 'µΩ', 'IEC 62271-102');
      var avCS_s  = avaliarMax(gs("secc_cont_s"), 200, 500, 'µΩ', 'IEC 62271-102');
      var avCT_s  = avaliarMax(gs("secc_cont_t"), 200, 500, 'µΩ', 'IEC 62271-102');

      [{av:avAbR_s,p:'Isolação AB: R1-R2'},{av:avAbS_s,p:'Isolação AB: S1-S2'},{av:avAbT_s,p:'Isolação AB: T1-T2'},
       {av:avFeR_s,p:'Isolação FE: R1-R2'},{av:avFeS_s,p:'Isolação FE: S1-S2'},{av:avFeT_s,p:'Isolação FE: T1-T2'}]
      .forEach(function(x){ if(x.av.status==='danger') ncList.push({equip:equipS,ponto:x.p,valor:x.av.badge,limite:'mín. 1000 MΩ',norma:'IEC 62271-102',nivel:'danger'}); });
      [{av:avCR_s,p:'Res.Contato R1-R2'},{av:avCS_s,p:'Res.Contato S1-S2'},{av:avCT_s,p:'Res.Contato T1-T2'}]
      .forEach(function(x){
        if(x.av.status==='danger') ncList.push({equip:equipS,ponto:x.p,valor:x.av.badge,limite:'máx. 500 µΩ',norma:'IEC 62271-102',nivel:'danger'});
        else if(x.av.status==='warn') warnList.push({equip:equipS,ponto:x.p,valor:x.av.badge,limite:'máx. 200 µΩ',norma:'IEC 62271-102',nivel:'warn'});
      });

      html += '\n      <div class="equip-card">'
        + '\n        <div class="equip-title">' + equipS + '</div>'
        + '\n        <div class="equip-body">'
        + '\n          <table class="med-table">'
        + '\n            <tr><td colspan="7" class="group-label">ISOLAÇÃO — ABERTA ≥ 1000 MΩ | FECHADA ≥ 1000 MΩ (IEC 62271-102)</td></tr>'
        + '\n            <tr><th>POLO</th><th>ABERTA / STATUS</th><th></th><th></th><th>FECHADA / STATUS</th><th></th><th style="width:40px">UNID.</th></tr>'
        + '\n            <tr><td><b>R1-R2</b></td>' + celIso(avAbR_s,gs("secc_ab_r"),gs("u_secc_ab_r")||"MΩ") + '<td></td><td></td>' + celIso(avFeR_s,gs("secc_fe_r"),gs("u_secc_fe_r")||"MΩ") + '<td></td><td class="unit-cell">MΩ</td></tr>'
        + '\n            <tr><td><b>S1-S2</b></td>' + celIso(avAbS_s,gs("secc_ab_s"),gs("u_secc_ab_s")||"MΩ") + '<td></td><td></td>' + celIso(avFeS_s,gs("secc_fe_s"),gs("u_secc_fe_s")||"MΩ") + '<td></td><td></td></tr>'
        + '\n            <tr><td><b>T1-T2</b></td>' + celIso(avAbT_s,gs("secc_ab_t"),gs("u_secc_ab_t")||"MΩ") + '<td></td><td></td>' + celIso(avFeT_s,gs("secc_fe_t"),gs("u_secc_fe_t")||"MΩ") + '<td></td><td></td></tr>'
        + '\n            <tr><td colspan="7" class="group-label">RESISTÊNCIA DE CONTATO — atenção > 200 µΩ | crítico > 500 µΩ (IEC 62271-102)</td></tr>'
        + '\n            <tr><th>PONTO</th><th>VALOR / STATUS</th><th colspan="5"></th></tr>'
        + '\n            <tr><td><b>R1-R2</b></td>' + celIso(avCR_s,gs("secc_cont_r"),gs("u_secc_cont_r")||"µΩ") + '<td colspan="5"></td></tr>'
        + '\n            <tr><td><b>S1-S2</b></td>' + celIso(avCS_s,gs("secc_cont_s"),gs("u_secc_cont_s")||"µΩ") + '<td colspan="5"></td></tr>'
        + '\n            <tr><td><b>T1-T2</b></td>' + celIso(avCT_s,gs("secc_cont_t"),gs("u_secc_cont_t")||"µΩ") + '<td colspan="5"></td></tr>'
        + '\n          </table>'
        + (gs("secc_obs") ? '\n          <div style="margin-top:8px;font-size:9.5px;color:#555;padding:6px 10px;background:#f8f9fb;border-radius:4px;border-left:3px solid #003366;"><b>Obs.:</b> ' + gs("secc_obs") + '</div>' : '')
        + '\n        </div>\n      </div>';
    }

    /* ── SUMÁRIO DE NÃO CONFORMIDADES ── */
    var temNC = ncList.length > 0 || warnList.length > 0;
    if (temNC) {
      html += `<div class="section-header" style="background:#c62828;border-left-color:#ffcdd2;">⚠ SUMÁRIO DE MEDIÇÕES FORA DO PADRÃO NORMATIVO</div>
      <div style="border:2px solid #ef9a9a;border-radius:6px;overflow:hidden;margin-bottom:12px;page-break-inside:avoid;">`;

      if (ncList.length > 0) {
        html += `<div style="background:#ffebee;padding:8px 14px;border-bottom:1px solid #ef9a9a;">
          <span style="font-size:10.5px;font-weight:800;color:#c62828;">✗ NÃO CONFORMIDADES CRÍTICAS (${ncList.length} item${ncList.length>1?'s':''})</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#fce4ec;"><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#c62828;text-align:left;">Equipamento</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#c62828;text-align:left;">Ponto de Medição</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#c62828;text-align:left;">Valor / Diagnóstico</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#c62828;text-align:left;">Limite Normativo</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#c62828;text-align:left;">Norma</th></tr>`;
        ncList.forEach((nc, idx) => {
          html += `<tr style="background:${idx%2===0?'#fff5f5':'#fff'}; border-bottom:1px solid #ffcdd2;">
            <td style="padding:6px 12px;font-size:10px;">${nc.equip}</td>
            <td style="padding:6px 12px;font-size:10px;font-weight:700;">${nc.ponto}</td>
            <td style="padding:6px 12px;font-size:10px;color:#c62828;font-weight:700;">${nc.valor}</td>
            <td style="padding:6px 12px;font-size:10px;">${nc.limite}</td>
            <td style="padding:6px 12px;font-size:10px;font-style:italic;">${nc.norma}</td>
          </tr>`;
        });
        html += `</table>`;
      }

      if (warnList.length > 0) {
        html += `<div style="background:#fff3e0;padding:8px 14px;border-top:1px solid #ffe082;border-bottom:1px solid #ffe082;">
          <span style="font-size:10.5px;font-weight:800;color:#e65100;">⚠ ALERTAS DE ATENÇÃO (${warnList.length} item${warnList.length>1?'s':''})</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#fff8e1;"><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#e65100;text-align:left;">Equipamento</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#e65100;text-align:left;">Ponto</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#e65100;text-align:left;">Valor</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#e65100;text-align:left;">Limite</th><th style="padding:6px 12px;font-size:9px;text-transform:uppercase;color:#e65100;text-align:left;">Norma</th></tr>`;
        warnList.forEach((w, idx) => {
          html += `<tr style="background:${idx%2===0?'#fffde7':'#fff'}; border-bottom:1px solid #ffe082;">
            <td style="padding:6px 12px;font-size:10px;">${w.equip}</td>
            <td style="padding:6px 12px;font-size:10px;font-weight:700;">${w.ponto}</td>
            <td style="padding:6px 12px;font-size:10px;color:#e65100;font-weight:700;">${w.valor}</td>
            <td style="padding:6px 12px;font-size:10px;">${w.limite}</td>
            <td style="padding:6px 12px;font-size:10px;font-style:italic;">${w.norma}</td>
          </tr>`;
        });
        html += `</table>`;
      }

      html += `<div style="background:#f8f8f8;padding:8px 14px;font-size:8.5px;color:#777;border-top:1px solid #eee;">
        Limites de referência: Isolação Trafo AT ≥ 100 MΩ | Isolação Trafo BT ≥ 10 MΩ | Variação Ôhmica ≤ 3% | Isolação Disjuntor/Secc. ≥ 1000 MΩ | Res. Contato Disjuntor ≤ 200/300 µΩ | Res. Contato Secc. ≤ 200/500 µΩ
        <br>Normas: NBR 5356 | IEC 60076 | IEC 62271-100 | IEC 62271-102
      </div></div>`;
    } else if (numTransfos > 0 || numDisj > 0 || numSecc > 0) {
      html += `<div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:12px 16px;margin-bottom:12px;font-size:10.5px;font-weight:700;color:#1b5e20;">
        ✓ TODAS AS MEDIÇÕES DENTRO DOS LIMITES NORMATIVOS — NBR 5356 | IEC 60076 | IEC 62271-100 | IEC 62271-102
      </div>`;
    }

    /* ── NÃO CONFORMIDADES (livres) ── */
    if (subNc || subAcoes) {
      html += `<div class="section-header">⚠ NÃO CONFORMIDADES E AÇÕES CORRETIVAS</div>`;
      if (subNc)     html += `<div class="nc-box"><strong style="font-size:10px;color:#c62828;">NÃO CONFORMIDADES:</strong><br><span style="font-size:10.5px;">${subNc.replace(/\n/g,"<br>")}</span></div>`;
      if (subAcoes)  html += `<div class="ac-box"><strong style="font-size:10px;color:#1b5e20;">AÇÕES CORRETIVAS:</strong><br><span style="font-size:10.5px;">${subAcoes.replace(/\n/g,"<br>")}</span></div>`;
    }

    /* ── RODAPÉ ── */
    html += `
    <div class="doc-footer">
      <div>
        <div class="doc-footer-brand">TRIBUNAL DE JUSTIÇA DE MINAS GERAIS</div>
        <div>COMAP | Coordenadoria de Manutenção Predial — GEMAP</div>
        <div>Emitido em ${dataAtual} | Sistema PCI — COMAP.NORTE</div>
        <div style="margin-top:3px;font-size:8.5px;color:#aaa;">Anexo B / B.1 TJMG | NR-10 | NBR 5419 | NBR 5356</div>
      </div>
      <div style="text-align:right">
        <div>Relatório técnico entregar à Fiscalização em até 10 dias úteis.</div>
        <div style="margin-top:4px;color:#003366;font-weight:600;">comap.norte@tjmg.jus.br</div>
      </div>
    </div>
</body></html>`;

    const nomeArq = `Sub_${tipoSub}_${comarca.replace(/\s+/g,"_")}_${Utilities.formatDate(new Date(),fuso,"yyyyMMdd")}.pdf`;
    const blob    = HtmlService.createHtmlOutput(html).getAs("application/pdf");
    blob.setName(nomeArq);

    MailApp.sendEmail({
      to:       emailDest,
      subject:  `[TJMG] Inspeção Subestação ${iconTipoSub} ${tipoSub} — ${comarca} — ${dataEmissao}`,
      htmlBody: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;">
        <div style="background:#003366;color:white;padding:16px 20px;border-bottom:3px solid #c89c31;border-radius:6px 6px 0 0;">
          <strong style="font-size:15px;">⚡ TJMG — Inspeção Técnica de Subestação</strong>
        </div>
        <div style="background:#f8f9fb;padding:16px 20px;border:1px solid #dee2e6;border-top:none;border-radius:0 0 6px 6px;">
          <p>Segue em anexo o relatório de inspeção técnica de subestação.</p>
          <table style="border-collapse:collapse;margin:12px 0;width:100%;">
            <tr><td style="padding:4px 8px;font-weight:700;color:#003366;width:45%">Comarca</td><td style="padding:4px 8px;">${comarca}</td></tr>
            <tr style="background:#f0f4f8;"><td style="padding:4px 8px;font-weight:700;color:#003366;">Tipo de Subestação</td><td style="padding:4px 8px;">${iconTipoSub} ${tipoSubLabel}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:700;color:#003366;">Tipo de Manutenção</td><td style="padding:4px 8px;">${tipoManLabel}</td></tr>
            <tr style="background:#f0f4f8;"><td style="padding:4px 8px;font-weight:700;color:#003366;">Data da Inspeção</td><td style="padding:4px 8px;">${dataAtual}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:700;color:#003366;">Responsável</td><td style="padding:4px 8px;">${responsavel}</td></tr>
            <tr style="background:#f0f4f8;"><td style="padding:4px 8px;font-weight:700;color:#003366;">Checklist Anexo B.1</td><td style="padding:4px 8px;font-weight:700;color:${corChecklist};">${chkPct}% (${chkMarcados}/${chkTotal} itens)</td></tr>
            <tr><td style="padding:4px 8px;font-weight:700;color:#003366;">Não Conformidades</td><td style="padding:4px 8px;font-weight:700;color:${ncList.length>0?'#c62828':warnList.length>0?'#e65100':'#1b5e20'};">${ncList.length} crítica(s) | ${warnList.length} alerta(s)</td></tr>
          </table>
          ${subNc ? `<p style="color:#c62828;font-size:12px;"><strong>⚠ Não conformidades:</strong> ${subNc}</p>` : ""}
          <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;">
          <p style="font-size:11px;color:#888;">Gerado automaticamente pelo Sistema PCI — COMAP.NORTE / TJMG.<br>Para dúvidas: <strong>comap.norte@tjmg.jus.br</strong></p>
        </div>
      </div>`,
      attachments: [blob]
    });

    return `Sucesso! ${tipoSubLabel} | ${tipoManLabel} | Checklist: ${chkPct}% | ${numTransfos} trafo(s), ${numDisj} disjuntor(es), ${numSecc} chave(s).`;

  } catch (e) {
    throw new Error("Erro ao gerar relatório de subestação: " + e.message + " | Stack: " + e.stack);
  }
}