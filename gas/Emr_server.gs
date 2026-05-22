/**
 * Módulo EMR — adaptado para o sistema COMAP Unificado.
 * Funções públicas: emr_<nome>  (ex: emr_getDados)
 * Constantes top-level: EMR_<NOME>
 */

/**
 * COMAP - ATENDIMENTOS EMERGENCIAIS
 * SISTEMA INTEGRADO: WEBAPP + SANEAMENTO + GESTÃO DE USUÁRIOS + EDIÇÃO COMPLETA MASTER
 */

const EMR_COMARCAS_VIP = [
  "MONTES CLAROS", "TEÓFILO OTONI", "PARACATU", "GOVERNADOR VALADARES",
  "IPATINGA", "ITABIRA", "JUIZ DE FORA", "CONSELHEIRO LAFAIETE",
  "UBÁ", "CONTAGEM", "BETIM", "SETE LAGOAS"
];

const EMR_REGIOES_ESPECIAIS = ["NORTE", "LESTE", "CENTRAL", "ZONA DA MATA"];

const EMR_FUSO = "America/Sao_Paulo";



function emr_formatarHoraPura(dateObj) {
  if (!(dateObj instanceof Date)) return "--:--";
  return String(dateObj.getHours()).padStart(2,"0") + ":" + String(dateObj.getMinutes()).padStart(2,"0");
}

function emr_getDados() {
  try {
    emr_executarSaneamentoRetroativo();
    const ss    = ss_();
    const sheet = ss.getSheetByName("EMERGENCIAIS");
    if (!sheet) throw new Error("Aba 'EMERGENCIAIS' não encontrada!");
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    const agora = new Date();
    const dadosParaRetorno = [];
    const diasAtrasoParaGravar = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const linhaPlanilha = i + 1;
      const comarcaDaLinha = row[4] ? String(row[4]).trim().toUpperCase() : "";
      const regiaoDaLinha  = row[3] ? String(row[3]).trim().toUpperCase() : "";
      const statusOriginal = row[9] ? String(row[9]).trim().toUpperCase() : "NÃO INICIADO";
      const dataAbertura   = row[1];
      const horaAbertura   = row[2];
      let emAtraso = false, diasAtrasoContador = 0;
      if (dataAbertura instanceof Date) {
        diasAtrasoContador = Math.max(0, Math.floor((agora.getTime() - dataAbertura.getTime()) / (1000*60*60*24)));
        const prazo = emr_calcularPrazoLimite(dataAbertura, horaAbertura, regiaoDaLinha, comarcaDaLinha);
        if (agora > prazo && !statusOriginal.startsWith("CONCLUÍDO") && !statusOriginal.includes("CANCELAD")) emAtraso = true;
      }
      diasAtrasoParaGravar.push([diasAtrasoContador]);
      let horaFormatada = "--:--";
      if (row[2] instanceof Date) horaFormatada = emr_formatarHoraPura(row[2]);
      else if (typeof row[2] === "string" && row[2].length >= 5) horaFormatada = row[2].substring(0,5);
      let dataAberturaFormatada = "";
      if (dataAbertura instanceof Date) dataAberturaFormatada = Utilities.formatDate(dataAbertura, EMR_FUSO, "yyyy-MM-dd");
      let dataConclusaoFormatada = "", horaConclusaoFormatada = "--:--";
      if (row[10] instanceof Date) dataConclusaoFormatada = Utilities.formatDate(row[10], EMR_FUSO, "yyyy-MM-dd");
      if (row[11] instanceof Date) horaConclusaoFormatada = emr_formatarHoraPura(row[11]);
      else if (typeof row[11] === "string" && row[11].length >= 5) horaConclusaoFormatada = row[11].substring(0,5);
      dadosParaRetorno.push({
        dataFiltro: dataAberturaFormatada, horaAbertura: horaFormatada,
        regiao: regiaoDaLinha, comarca: comarcaDaLinha,
        status: statusOriginal, atrasado: emAtraso, diasAtraso: diasAtrasoContador,
        sistema: row[12] ? String(row[12]).trim() : "",
        subsistema: row[13] ? String(row[13]).trim() : "",
        elemento: row[14] ? String(row[14]).trim() : "",
        causaRaiz: row[15] ? String(row[15]).trim() : "",
        ose: row[16], contrato: row[18],
        edificacao: row[5] ? String(row[5]).trim() : "",
        descricao:  row[7] ? String(row[7]).trim() : "",   // col H da planilha
        dataConclusao: dataConclusaoFormatada, horaConclusao: horaConclusaoFormatada,
        linha: linhaPlanilha
      });
    }
    if (diasAtrasoParaGravar.length > 0) sheet.getRange(2, 21, diasAtrasoParaGravar.length, 1).setValues(diasAtrasoParaGravar);
    return dadosParaRetorno;
  } catch (e) { throw new Error(e.message); }
}

function emr_executarSaneamentoRetroativo() {
  const ss    = ss_();
  const sheet = ss.getSheetByName("EMERGENCIAIS");
  if (!sheet) return;
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;
  const rangeTotal = sheet.getRange(2, 1, ultimaLinha - 1, 12);
  const valores    = rangeTotal.getValues();
  const agora      = new Date();
  for (let i = 0; i < valores.length; i++) {
    let linha = valores[i];
    [3,4,5].forEach(ci => { if (typeof linha[ci]==='string') linha[ci]=linha[ci].toUpperCase().trim(); });
    const comarcaDaLinha = String(linha[4]).trim().toUpperCase();
    const regiaoDaLinha  = String(linha[3]).trim().toUpperCase();
    const statusOriginal = String(linha[9]).toUpperCase().trim();
    let novoStatus = statusOriginal;
    const dataAbertura = linha[1], horaAbertura = linha[2];
    if (dataAbertura instanceof Date) {
      const prazoLimite = emr_calcularPrazoLimite(dataAbertura, horaAbertura, regiaoDaLinha, comarcaDaLinha);
      if (statusOriginal.startsWith("CONCLUÍDO")) {
        const dataConclusao = linha[10], horaConclusao = linha[11];
        if (dataConclusao instanceof Date) {
          const dtConc = emr_combinarDataHora(dataConclusao, horaConclusao);
          const diff   = (dtConc.getTime() - prazoLimite.getTime()) / 3600000;
          if      (diff <= 0)  novoStatus = "CONCLUÍDO";
          else if (diff <= 24) novoStatus = "CONCLUÍDO(ATRASO24)";
          else if (diff <= 48) novoStatus = "CONCLUÍDO(ATRASO48)";
          else                 novoStatus = "CONCLUÍDO(ATRASOACIMA48)";
        }
      } else if (["ABERTO","EM ATRASO","ABERTO(REPROGRAMADO)","NÃO INICIADO","EM ATENDIMENTO"].includes(statusOriginal)) {
        if (agora > prazoLimite) novoStatus = "EM ATRASO";
        else if (statusOriginal === "EM ATRASO") novoStatus = "ABERTO";
      }
    }
    linha[9] = novoStatus;
  }
  rangeTotal.setValues(valores);
  sheet.getRange(2, 2, ultimaLinha - 1, 1).setNumberFormat("dd/MM/yyyy");
}

function emr_calcularPrazoLimite(dataAbertura, horaAbertura, regiao, comarca) {
  const regiaoNorm  = regiao  ? String(regiao).trim().toUpperCase()  : "";
  const comarcaNorm = comarca ? String(comarca).trim().toUpperCase() : "";
  const ehEspecial  = EMR_REGIOES_ESPECIAIS.includes(regiaoNorm);
  if (!ehEspecial) {
    let h=0, m=0;
    if (horaAbertura instanceof Date) { h=horaAbertura.getHours(); m=horaAbertura.getMinutes(); }
    else if (typeof horaAbertura==="string") { const p=horaAbertura.split(":"); h=parseInt(p[0])||0; m=parseInt(p[1])||0; }
    const dt = new Date(dataAbertura.getTime());
    dt.setHours(h, m, 0, 0);
    return new Date(dt.getTime() + 24*60*60*1000);
  }
  const ehVip = EMR_COMARCAS_VIP.includes(comarcaNorm);
  const horaDivisor = ehVip ? 12 : 10;
  let h=0;
  if (horaAbertura instanceof Date) h=horaAbertura.getHours();
  else if (typeof horaAbertura==="string") h=parseInt(horaAbertura.split(":")[0])||0;
  const deadline = new Date(dataAbertura.getTime());
  if (h < horaDivisor) { deadline.setHours(23,59,59,999); }
  else { deadline.setDate(deadline.getDate()+1); deadline.setHours(12,0,0,0); }
  return deadline;
}

function emr_validarLogin(email, senha) {
  try {
    const ss    = ss_();
    const sheet = ss.getSheetByName("USUARIOS");
    if (!sheet) return { sucesso:false, msg:"Aba 'USUARIOS' não encontrada." };
    const dados = sheet.getDataRange().getValues();
    for (let i=1; i<dados.length; i++) {
      const emailP  = (dados[i][1]||"").toString().trim().toLowerCase();
      const senhaP  = (dados[i][2]||"").toString().trim();
      const nomeP   = (dados[i][0]||"").toString().trim();
      const regiaoP = (dados[i][3]||"").toString().trim().toUpperCase();
      if (emailP===email.toLowerCase().trim() && senhaP===senha.trim()) return {sucesso:true,nome:nomeP,regiao:regiaoP};
    }
    return {sucesso:false,msg:"E-mail ou senha incorretos."};
  } catch (e) { return {sucesso:false,msg:"Erro no servidor: "+e.message}; }
}

function emr_temPermissao(regiaoUsuario, regiaoItem) {
  if (!regiaoUsuario) return false;
  if (regiaoUsuario.toUpperCase()==="MASTER") return true;
  return regiaoUsuario.toUpperCase()===(regiaoItem||"").toUpperCase().trim();
}

function emr_salvarConclusao(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss    = ss_();
    const sheet = ss.getSheetByName("EMERGENCIAIS");
    const L     = parseInt(dados.linha);
    const rowV  = sheet.getRange(L,1,1,20).getValues()[0];
    const regiaoItem = rowV[3] ? String(rowV[3]).trim().toUpperCase() : "";
    if (!emr_temPermissao(dados.regiaoUsuario, regiaoItem)) return "❌ Sem permissão: região "+dados.regiaoUsuario+".";
    let statusFinal = dados.status;
    if (dados.status==="CONCLUÍDO" && dados.dataConclusao) {
      const prazoLimite = emr_calcularPrazoLimite(rowV[1], rowV[2], String(rowV[3]).trim().toUpperCase(), String(rowV[4]).trim().toUpperCase());
      const dtConc = new Date(`${dados.dataConclusao}T${dados.horaConclusao||"00:00"}:00`);
      const diff   = (dtConc.getTime()-prazoLimite.getTime())/3600000;
      if      (diff<=0)  statusFinal="CONCLUÍDO";
      else if (diff<=24) statusFinal="CONCLUÍDO(ATRASO24)";
      else if (diff<=48) statusFinal="CONCLUÍDO(ATRASO48)";
      else               statusFinal="CONCLUÍDO(ATRASOACIMA48)";
    }
    sheet.getRange(L,10).setValue(statusFinal);
    sheet.getRange(L,11).setValue(dados.dataConclusao);
    sheet.getRange(L,12).setValue(dados.horaConclusao);
    sheet.getRange(L,13).setValue(dados.sistema);
    sheet.getRange(L,14).setValue(dados.subsistema);
    sheet.getRange(L,15).setValue(dados.elemento);
    sheet.getRange(L,16).setValue(dados.causaRaiz);
    SpreadsheetApp.flush();
    return "✅ OSE "+dados.ose+" atualizada! Status: "+statusFinal;
  } catch (e) { return "❌ Erro: "+e.message; }
  finally { lock.releaseLock(); }
}

function emr_combinarDataHora(data, hora) {
  const dt = new Date(data.getTime());
  if (hora instanceof Date) dt.setHours(hora.getHours(), hora.getMinutes(), hora.getSeconds());
  else dt.setHours(0,0,0,0);
  return dt;
}

function emr_onEdit(e) {
  if (!e||!e.range) return;
  const range=e.range, sheet=range.getSheet();
  if (sheet.getName()!=="EMERGENCIAIS") return;
  const col=range.getColumn();
  if (col===2) { range.setNumberFormat("dd/MM/yyyy"); range.setValue(range.getValue()); }
  if (col>=4&&col<=6) { const v=range.getValue(); if(typeof v==='string') range.setValue(v.toUpperCase().trim()); }
}

function emr_reprogramarOSE(linha, novaData, novaHora, ose, regiaoUsuario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss    = ss_();
    const sheet = ss.getSheetByName("EMERGENCIAIS");
    const L     = parseInt(linha);
    const rowV  = sheet.getRange(L,1,1,20).getValues()[0];
    const regiaoItem = rowV[3] ? String(rowV[3]).trim().toUpperCase() : "";
    if (!emr_temPermissao(regiaoUsuario, regiaoItem)) return "❌ Sem permissão: região "+regiaoUsuario+".";
    sheet.getRange(L,2).setValue(novaData);
    sheet.getRange(L,3).setValue(novaHora);
    sheet.getRange(L,10).setValue("ABERTO(REPROGRAMADO)");
    sheet.getRange(L,21).setValue(0);
    SpreadsheetApp.flush();
    return "✅ OSE "+ose+" reprogramada!";
  } catch(e) { return "❌ Erro: "+e.message; }
  finally { lock.releaseLock(); }
}

function emr_buscarListasCascata() {
  try {
    const ss=ss_(), sheet=ss.getSheetByName("SISTEMA");
    if (!sheet) return [];
    const ul=sheet.getLastRow();
    if (ul<2) return [];
    return sheet.getRange(2,1,ul-1,3).getValues();
  } catch(e) { return []; }
}

// ================================================================
//  GESTÃO DE USUÁRIOS — MASTER ONLY
// ================================================================

function emr_listarUsuarios() {
  try {
    const ss=ss_(), sheet=ss.getSheetByName("USUARIOS");
    if (!sheet) throw new Error("Aba 'USUARIOS' não encontrada.");
    const ul=sheet.getLastRow();
    if (ul<2) return [];
    return sheet.getRange(2,1,ul-1,4).getValues()
      .map((row,i) => ({linha:i+2, nome:String(row[0]||"").trim(), email:String(row[1]||"").trim().toLowerCase(), regiao:String(row[3]||"").trim().toUpperCase()}))
      .filter(u => u.email.length>0);
  } catch(e) { throw new Error("Erro ao listar usuários: "+e.message); }
}

function emr_salvarUsuario(dados) {
  const lock=LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!dados.regiaoUsuario||dados.regiaoUsuario.toUpperCase()!=="MASTER") return "❌ Acesso negado.";
    const email=(dados.email||"").trim().toLowerCase(), nome=(dados.nome||"").trim();
    const regiao=(dados.regiao||"").trim().toUpperCase(), senha=(dados.senha||"").trim();
    const ehEdicao=dados.linha&&parseInt(dados.linha)>=2;
    if (!nome)   return "❌ Nome é obrigatório.";
    if (!email)  return "❌ E-mail é obrigatório.";
    if (!regiao) return "❌ Nível de acesso é obrigatório.";
    if (!ehEdicao&&(!senha||senha.length<4)) return "❌ Senha inválida — mínimo 4 caracteres.";
    const ss=ss_(), sheet=ss.getSheetByName("USUARIOS");
    if (!sheet) return "❌ Aba 'USUARIOS' não encontrada.";
    const ul=sheet.getLastRow();
    if (ul>=2 && senha.length>=4) {
      const linhasExistentes=sheet.getRange(2,1,ul-1,4).getValues();
      const conflito=linhasExistentes.some((row,idx)=>{
        const lp=idx+2;
        const ehMesmaLinha=ehEdicao&&parseInt(dados.linha)===lp;
        if (ehMesmaLinha) return false;
        const emailExistente=String(row[1]||"").trim().toLowerCase();
        const senhaExistente=String(row[2]||"").trim();
        return emailExistente===email && senhaExistente===senha;
      });
      if (conflito) return "❌ Já existe um login com esse e-mail E essa senha. Use uma senha diferente para criar um acesso distinto.";
    }
    if (ehEdicao) {
      const L=parseInt(dados.linha);
      sheet.getRange(L,1).setValue(nome); sheet.getRange(L,2).setValue(email);
      if (senha&&senha.length>=4) sheet.getRange(L,3).setValue(senha);
      sheet.getRange(L,4).setValue(regiao);
      SpreadsheetApp.flush(); return "✅ Usuário '"+nome+"' atualizado!";
    }
    sheet.appendRow([nome,email,senha,regiao]); SpreadsheetApp.flush();
    return "✅ Usuário '"+nome+"' ("+email+") cadastrado com acesso "+regiao+"!";
  } catch(e) { return "❌ Erro: "+e.message; }
  finally { lock.releaseLock(); }
}

function emr_excluirUsuario(linha, regiaoUsuario) {
  const lock=LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!regiaoUsuario||regiaoUsuario.toUpperCase()!=="MASTER") return "❌ Acesso negado.";
    const L=parseInt(linha);
    if (isNaN(L)||L<2) return "❌ Linha inválida.";
    const ss=ss_(), sheet=ss.getSheetByName("USUARIOS");
    if (!sheet) return "❌ Aba 'USUARIOS' não encontrada.";
    const emailExcluido=String(sheet.getRange(L,2).getValue()).trim();
    sheet.deleteRow(L); SpreadsheetApp.flush();
    return "✅ Usuário '"+emailExcluido+"' excluído.";
  } catch(e) { return "❌ Erro: "+e.message; }
  finally { lock.releaseLock(); }
}

// ================================================================
//  EDIÇÃO COMPLETA DE REGISTRO — MASTER ONLY
// ================================================================

function emr_editarRegistroCompleto(dados) {
  const lock=LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!dados.regiaoUsuario||dados.regiaoUsuario.toUpperCase()!=="MASTER") {
      return "❌ Acesso negado. Apenas MASTER pode editar registros completos.";
    }

    const ss=ss_(), sheet=ss.getSheetByName("EMERGENCIAIS");
    if (!sheet) return "❌ Aba 'EMERGENCIAIS' não encontrada.";

    const L=parseInt(dados.linha);
    if (isNaN(L)||L<2) return "❌ Número de linha inválido.";
    if (L>sheet.getLastRow()) return "❌ Linha "+L+" não existe.";

    if (dados.dataAbertura) {
      const dtAb=new Date(dados.dataAbertura+"T00:00:00");
      sheet.getRange(L,2).setValue(dtAb).setNumberFormat("dd/MM/yyyy");
    }
    if (dados.horaAbertura) sheet.getRange(L,3).setValue(dados.horaAbertura);

    if (dados.regiao)  sheet.getRange(L,4).setValue(dados.regiao.toUpperCase().trim());
    if (dados.comarca) sheet.getRange(L,5).setValue(dados.comarca.toUpperCase().trim());

    const statusFinal=(dados.status||"ABERTO").trim().toUpperCase();
    sheet.getRange(L,10).setValue(statusFinal);

    if (dados.dataConclusao) {
      const dtConc=new Date(dados.dataConclusao+"T00:00:00");
      sheet.getRange(L,11).setValue(dtConc).setNumberFormat("dd/MM/yyyy");
    } else { sheet.getRange(L,11).setValue(""); }
    if (dados.horaConclusao) sheet.getRange(L,12).setValue(dados.horaConclusao);
    else sheet.getRange(L,12).setValue("");

    sheet.getRange(L,13).setValue(dados.sistema    ||"");
    sheet.getRange(L,14).setValue(dados.subsistema ||"");
    sheet.getRange(L,15).setValue(dados.elemento   ||"");
    sheet.getRange(L,16).setValue(dados.causaRaiz  ||"");

    if (dados.ose)      sheet.getRange(L,17).setValue(dados.ose);
    if (dados.contrato) sheet.getRange(L,19).setValue(dados.contrato);

    const statusAbertos=["ABERTO","NÃO INICIADO","ABERTO(REPROGRAMADO)","CONCLUÍDO",
                         "CONCLUÍDO(ATRASO24)","CONCLUÍDO(ATRASO48)","CONCLUÍDO(ATRASOACIMA48)","CANCELADO"];
    if (statusAbertos.includes(statusFinal)) sheet.getRange(L,21).setValue(0);

    SpreadsheetApp.flush();
    return "✅ Registro (linha "+L+" · OSE "+(dados.ose||"—")+") atualizado! Status: "+statusFinal;

  } catch(e) {
    console.error("Erro emr_editarRegistroCompleto: "+e.message);
    return "❌ Erro: "+e.message;
  } finally { lock.releaseLock(); }
}
function emr_verificarENotificarAtrasos() {
  const ss    = ss_();
  const sheet = ss.getSheetByName("EMERGENCIAIS");
  if (!sheet) return;

  const agora       = new Date();
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const dados = sheet.getRange(2, 1, ultimaLinha - 1, 22).getValues();

  const DESTINATARIOS_FIXOS = [
    "comap@tjmg.jus.br",
  ];

  const EMAIL_POR_REGIAO = {
    "NORTE":        "comap.norte@tjmg.jus.br",
    "LESTE":        "comap.leste@tjmg.jus.br",
    "CENTRAL":      "comap.central@tjmg.jus.br",
    "ZONA DA MATA": "comap.mata@tjmg.jus.br",
    "SUL":          "comap.sul@tjmg.jus.br",
    "TRIANGULO":    "comap.triangulo@tjmg.jus.br"
  };

  for (let i = 0; i < dados.length; i++) {
    const row         = dados[i];
    const status      = String(row[9]  || "").trim().toUpperCase();
    const flagEnviado = String(row[21] || "").trim().toUpperCase();
    const dataAbertura = row[1];
    const horaAbertura = row[2];
    const regiao      = String(row[3]  || "").trim().toUpperCase();
    const comarca     = String(row[4]  || "").trim().toUpperCase();
    const ose         = row[16] || "—";
    const contrato    = row[18] || "—";
    const edificacao  = row[5]  || "—";

    if (status !== "EM ATRASO") continue;
    if (flagEnviado === "SIM")  continue;
    if (!(dataAbertura instanceof Date)) continue;

    const destinatarios = [...DESTINATARIOS_FIXOS];
    if (EMAIL_POR_REGIAO[regiao]) destinatarios.push(EMAIL_POR_REGIAO[regiao]);

    const dtFmt = Utilities.formatDate(dataAbertura, "America/Sao_Paulo", "dd/MM/yyyy");
    let horaFmt = "--:--";
    if (horaAbertura instanceof Date) {
      horaFmt = String(horaAbertura.getHours()).padStart(2,"0") + ":" +
                String(horaAbertura.getMinutes()).padStart(2,"0");
    }

    const assunto = `🚨 OSE EM ATRASO — ${ose} | ${comarca} | ${regiao}`;

    const corpo = `
COMAP · TJMG — Atendimentos Emergenciais
==========================================

⚠️ A OSE abaixo ULTRAPASSOU O PRAZO DE ATENDIMENTO.

  OSE:        ${ose}
  Contrato:   ${contrato}
  Comarca:    ${comarca}
  Região:     ${regiao}
  Edificação: ${edificacao}
  Abertura:   ${dtFmt} às ${horaFmt}
  Status:     EM ATRASO

Acesse o painel para registrar o atendimento ou reprogramar.

— Sistema COMAP · TJMG
    `.trim();

    const corpoHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
  <div style="background:#003366;color:white;padding:16px 20px;border-bottom:3px solid #c5a059;">
    <strong style="font-size:16px;">COMAP · Atendimentos Emergenciais</strong>
    <div style="font-size:11px;opacity:.7;margin-top:4px;">TJMG — Coordenação de Manutenção Predial</div>
  </div>
  <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:14px 18px;margin:16px 0;">
    <strong style="color:#b91c1c;font-size:15px;">🚨 OSE EM ATRASO — Prazo ultrapassado</strong>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr style="background:#f8fafc;">
      <td style="padding:8px 12px;font-weight:700;color:#475569;width:35%;">OSE</td>
      <td style="padding:8px 12px;font-weight:700;color:#003366;">${ose}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:700;color:#475569;">Contrato</td>
      <td style="padding:8px 12px;">${contrato}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td style="padding:8px 12px;font-weight:700;color:#475569;">Comarca</td>
      <td style="padding:8px 12px;">${comarca}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:700;color:#475569;">Região</td>
      <td style="padding:8px 12px;">${regiao}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td style="padding:8px 12px;font-weight:700;color:#475569;">Edificação</td>
      <td style="padding:8px 12px;">${edificacao}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:700;color:#475569;">Abertura</td>
      <td style="padding:8px 12px;">${dtFmt} às ${horaFmt}</td>
    </tr>
    <tr style="background:#fee2e2;">
      <td style="padding:8px 12px;font-weight:700;color:#475569;">Status</td>
      <td style="padding:8px 12px;font-weight:700;color:#b91c1c;">EM ATRASO ⚠️</td>
    </tr>
  </table>
  <div style="background:#f1f5f9;padding:12px 16px;margin-top:16px;border-radius:6px;font-size:12px;color:#64748b;">
    Acesse o painel COMAP para registrar o atendimento ou reprogramar a OSE.
  </div>
</div>
    `.trim();

    try {
      MailApp.sendEmail({
        to:       destinatarios.join(","),
        subject:  assunto,
        body:     corpo,
        htmlBody: corpoHtml
      });
      sheet.getRange(i + 2, 22).setValue("SIM");
    } catch(err) {
      console.error("Erro ao enviar e-mail para OSE " + ose + ": " + err.message);
    }
  }
}

function emr_criarTriggerAtraso() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "emr_verificarENotificarAtrasos") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("emr_verificarENotificarAtrasos")
    .timeBased()
    .everyMinutes(15)
    .create();
}