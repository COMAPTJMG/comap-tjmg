/**
 * Módulo PCI — adaptado para o sistema COMAP Unificado.
 * Funções públicas: pci_<nome>  (ex: pci_getDados)
 * Constantes top-level: PCI_<NOME>
 */

/**
 * SISTEMA PCI NORTE - TJMG  v4.5
 * Col: ID(1)|DATA_CADASTRO(2)|CONTRATO(3)|COMARCA(4)|EDIFICAÇÃO(5)|TIPO_PCI(6)|
 * QTD(7)|RECARGA(8)|VALIDADE(9)|RTI(10)|CONDENADO(11)|OBS(12)|
 * DATA_REF(13)|STATUS(14)|MED1(15)|MED2(16)|MED3(17)|MED4(18)|SUSPENSO(19)|RTI_URL(20)
 */
const PCI_SHEET_NAME    = "PCI";
const PCI_FUSO          = "America/Sao_Paulo";
const PCI_RTI_FOLDER_ID = "1Z7Xifwna9Pbt46t96QlUdEZ3yWTpXrBa";



function pci_salvarDestinatarios(lista) {
  PropertiesService.getScriptProperties().setProperty('EMAIL_DESTINATARIOS', JSON.stringify(lista));
  return 'Destinatários salvos!';
}

function pci_lerDestinatarios() {
  const raw = PropertiesService.getScriptProperties().getProperty('EMAIL_DESTINATARIOS');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function pci__getSheet() {
  const ss = ss_();
  return ss.getSheetByName(PCI_SHEET_NAME) || ss.insertSheet(PCI_SHEET_NAME);
}

function pci__fmtDate(val) {
  if (!val) return "";
  if (val instanceof Date) return Utilities.formatDate(val, PCI_FUSO, "yyyy-MM-dd");
  return String(val);
}

function pci__getDataRef(sheet) {
  const raw = sheet.getRange("M1").getValue();
  if (raw instanceof Date) return Utilities.formatDate(raw, PCI_FUSO, "yyyy-MM-dd");
  if (String(raw).match(/^\d{4}-\d{2}-\d{2}$/)) return String(raw);
  return Utilities.formatDate(new Date(), PCI_FUSO, "yyyy-MM-dd");
}

function pci__norm(s) { return String(s||'').trim().toUpperCase().replace(/\s+/g,' '); }

function pci__calcStatus(val, ref) {
  if (!val||!ref) return "";
  try {
    const p=ref.split('-'), hoje=new Date(p[0],p[1]-1,p[2]);
    const d=new Date(val+'T00:00:00'), diff=Math.ceil((d-hoje)/86400000);
    if(diff<=0) return "VENCIDO";
    if(diff<=30) return "VENCE EM 30 DIAS";
    if(diff<=60) return "VENCE EM 60 DIAS";
    if(diff<=90) return "VENCE EM 90 DIAS";
    return "VIGENTE";
  } catch(e){ return ""; }
}

function pci__getUltimoId(sheet) {
  const last=sheet.getLastRow(); if(last<=1) return 0;
  return sheet.getRange(2,1,last-1,1).getValues().reduce((m,r)=>Math.max(m,Number(r[0])||0),0);
}

function pci__toUpper(sheet,linha) {
  // Era col 4,5,6 (COMARCA,EDIF,TIPO). Agora col 5,6,7 por causa da REGIÃO em col 4.
  const r=sheet.getRange(linha,5,1,3);
  r.setValues(r.getValues().map(row=>row.map(c=>typeof c==='string'?c.trim().toUpperCase().replace(/\s+/g,' '):c)));
}

function pci__trashUrl(fid) {
  if(!fid) return;
  try { DriveApp.getFileById(String(fid).trim()).setTrashed(true); } catch(e) {}
}

// ─── SALVAR / EDITAR ─────────────────────────────────────
/**
 * Processa payload misto: itens COM id são atualizados,
 * itens SEM id são inseridos como novos registros.
 * Retorna { message, ids } onde ids mantém a ordem original do array itens.
 */
function pci_salvarDados(payload, filtroSes) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet   = pci__getSheet();
    const agora   = new Date();
    const dataRef = pci__getDataRef(sheet);
    const cab     = payload.cabecalho;
    const itens   = payload.itens;

    // SEGURANÇA: travar gravação por região (não-globais só salvam na própria região)
    filtroSes = filtroSes || {};
    const minhaRegiao = (filtroSes.regiao || '').toString().toUpperCase().trim();
    const minhaGlobal = !!filtroSes.global ||
                        ['MASTER','ADMIN','COORD','COORDENADOR'].indexOf(minhaRegiao) >= 0;
    if (!minhaGlobal && minhaRegiao) {
      // Força a região do cabeçalho a ser a do usuário (impede burla por DevTools)
      cab.regiao = minhaRegiao;
    }

    const itensEditar = itens.filter(i => i.id);
    const itensNovos  = itens.filter(i => !i.id);

    // Pré-calcula IDs novos para preservar ordem no array de retorno
    let uid = pci__getUltimoId(sheet);
    let newCounter = 0;
    const idsOrdenados = itens.map(item =>
      item.id ? Number(item.id) : uid + (++newCounter)
    );

    // ── Atualizar registros existentes ──────────────────
    if (itensEditar.length > 0) {
      const data = sheet.getDataRange().getValues();
      itensEditar.forEach(item => {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) !== String(item.id)) continue;
          // SEGURANÇA: não-globais não podem editar item de outra região
          if (!minhaGlobal && minhaRegiao) {
            const regItem = (data[i][3] || '').toString().toUpperCase().trim();
            if (regItem !== minhaRegiao) {
              throw new Error('Sem permissão: este item pertence à região ' + regItem);
            }
          }
          const status = item.suspenso ? "SUSPENSO" : pci__calcStatus(item.validade, dataRef);
          if (!item.rti) {
            const oldFid = String(data[i][20] || '').trim();
            if (oldFid) { try { DriveApp.getFileById(oldFid).setTrashed(true); } catch(e) {} }
            sheet.getRange(i + 1, 21).setValue('');
          }
          // Preserva REGIÃO existente (col 4 = idx 3 na planilha real)
          const regiaoAtual = data[i][3] || 'NORTE';
          sheet.getRange(i + 1, 3, 1, 18).setValues([[
            cab.contrato,
            regiaoAtual,                                   // col 4 (REGIÃO)
            cab.comarca,                                   // col 5
            cab.edificacao,                                // col 6
            item.tipoPci,                                  // col 7
            item.qtd,                                      // col 8
            item.recarga,                                  // col 9
            item.validade,                                 // col 10
            item.rti ? "SIM" : "NÃO",                      // col 11
            item.condenado ? "SIM" : "NÃO",                // col 12
            cab.obs,                                       // col 13
            dataRef,                                       // col 14
            status,                                        // col 15
            item.med1 || "", item.med2 || "", item.med3 || "", item.med4 || "",  // 16-19
            item.suspenso ? "SIM" : "NÃO"                  // col 20
          ]]);
          pci__toUpper(sheet, i + 1);
          break;
        }
      });
    }

    // ── Inserir novos registros ──────────────────────────
    if (itensNovos.length > 0) {
      const rows = itensNovos.map((item, idx) => [
        uid + idx + 1,                                     // col 1: ID
        agora,                                             // col 2: DATA_CADASTRO
        cab.contrato,                                      // col 3: CONTRATO
        (cab.regiao || 'NORTE').toString().toUpperCase(),  // col 4: REGIÃO (novo)
        cab.comarca,                                       // col 5: COMARCA
        cab.edificacao,                                    // col 6: EDIFICAÇÃO
        item.tipoPci,                                      // col 7: TIPO_PCI
        item.qtd,                                          // col 8: QTD
        item.recarga,                                      // col 9: RECARGA
        item.validade,                                     // col 10: VALIDADE
        item.rti ? "SIM" : "NÃO",                          // col 11: RTI
        item.condenado ? "SIM" : "NÃO",                    // col 12: CONDENADO
        cab.obs,                                           // col 13: OBS
        dataRef,                                           // col 14: DATA_REF
        item.suspenso ? "SUSPENSO" : pci__calcStatus(item.validade, dataRef),  // col 15: STATUS
        item.med1 || "",                                   // col 16: MED1
        item.med2 || "",                                   // col 17: MED2
        item.med3 || "",                                   // col 18: MED3
        item.med4 || "",                                   // col 19: MED4
        item.suspenso ? "SIM" : "NÃO",                     // col 20: SUSPENSO
        ""                                                 // col 21: RTI_URL
      ]);
      const first = sheet.getLastRow() + 1;
      sheet.getRange(first, 1, rows.length, 21).setValues(rows);
      for (let i = 0; i < rows.length; i++) pci__toUpper(sheet, first + i);
    }

    const msg = [];
    if (itensEditar.length) msg.push(`${itensEditar.length} registro(s) atualizado(s)`);
    if (itensNovos.length)  msg.push(`${itensNovos.length} novo(s) gravado(s)`);
    return { message: (msg.join(' + ') || '0 alterações') + '!', ids: idsOrdenados };

  } finally { lock.releaseLock(); }
}

// ─── FIX v4.5: salva fileId NA PLANILHA antes do setSharing ──────────────
// Motivo: setSharing pode falhar por política do Google Workspace.
// Se o setSharing fosse chamado primeiro e falhasse, o arquivo ficava
// criado no Drive (órfão) mas a coluna 20 nunca era atualizada.
// Agora: (1) cria arquivo, (2) salva fileId na planilha, (3) tenta setSharing
// em bloco isolado — se falhar, o vínculo já está garantido.
function pci_salvarArquivoRTI(recordId, base64Data, mimeType, fileName) {
  try {
    const sheet=pci__getSheet(), dados=sheet.getDataRange().getValues();
    let rowIdx=-1, oldFileId='';
    for(let i=1;i<dados.length;i++){
      if(String(dados[i][0])===String(recordId)){
        rowIdx=i+1;
        oldFileId=String(dados[i][20]||'').trim();
        break;
      }
    }

    // Apaga arquivo antigo (substituição)
    if(oldFileId){ try{ DriveApp.getFileById(oldFileId).setTrashed(true); }catch(e){} }

    // Cria o novo arquivo no Drive
    const folder=DriveApp.getFolderById(PCI_RTI_FOLDER_ID);
    const nome='RTI_ID'+recordId+'_'+fileName.replace(/[^a-zA-Z0-9._\-]/g,'_');
    const blob=Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType||'application/octet-stream', nome);
    const file=folder.createFile(blob);
    const fileId=file.getId();

    // ✅ SALVA O fileId NA PLANILHA ANTES do setSharing
    // Garante o vínculo mesmo que setSharing falhe por política organizacional
    if(rowIdx>0) sheet.getRange(rowIdx,21).setValue(fileId);

    // setSharing em bloco isolado — falha silenciosa não quebra o vínculo
    try{
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }catch(e){
      // Política do Google Workspace pode bloquear compartilhamento externo.
      // O arquivo ainda fica acessível internamente. Não crítico.
    }

    return {success:true, fileId};
  } catch(e) {
    return {success:false, error:e.message};
  }
}

function pci_removerRTI(recordId) {
  const sheet=pci__getSheet(), dados=sheet.getDataRange().getValues();
  for(let i=1;i<dados.length;i++){
    if(String(dados[i][0])===String(recordId)){
      const fid=String(dados[i][20]||'').trim();
      if(fid){ try{ DriveApp.getFileById(fid).setTrashed(true); }catch(e){} }
      sheet.getRange(i+1,21).setValue('');
      return {success:true, message:'RTI removido!'};
    }
  }
  return {success:false, message:'Registro não encontrado.'};
}

// ─── LIMPAR REFERÊNCIA INVÁLIDA ──────────────────────────
// Chamado quando o arquivo não existe mais no Drive mas a coluna 20 tem um fileId.
// Apenas zera a coluna 20 — não tenta deletar (arquivo já não existe).
function pci_limparReferenciaRTI(recordId) {
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet=pci__getSheet(), dados=sheet.getDataRange().getValues();
    for(let i=1;i<dados.length;i++){
      if(String(dados[i][0])===String(recordId)){
        sheet.getRange(i+1,21).setValue('');
        return {success:true, message:'Referência limpa! Use Vincular Automático para re-associar.'};
      }
    }
    return {success:false, message:'Registro não encontrado.'};
  } finally { lock.releaseLock(); }
}

function pci_deletarRegistro(id, filtroSes) {
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    filtroSes = filtroSes || {};
    const minhaRegiao = (filtroSes.regiao || '').toString().toUpperCase().trim();
    const minhaGlobal = !!filtroSes.global ||
                        ['MASTER','ADMIN','COORD','COORDENADOR'].indexOf(minhaRegiao) >= 0;
    const sheet=pci__getSheet(), dados=sheet.getDataRange().getValues();
    for(let i=1;i<dados.length;i++){
      if(String(dados[i][0])===String(id)){
        // SEGURANÇA: não-globais não podem deletar item de outra região
        if (!minhaGlobal && minhaRegiao) {
          const regItem = (dados[i][3] || '').toString().toUpperCase().trim();
          if (regItem !== minhaRegiao) {
            throw new Error('Sem permissão: este item pertence à região ' + regItem);
          }
        }
        const fid=String(dados[i][20]||'').trim();
        if(fid){ try{ DriveApp.getFileById(fid).setTrashed(true); }catch(e){} }
        sheet.deleteRow(i+1);
        return "Registro removido!";
      }
    }
    return "Registro não encontrado.";
  } finally { lock.releaseLock(); }
}

function pci_lerDados(filtroSessao) {
  const sheet=pci__getSheet(), dataRef=pci__getDataRef(sheet);
  if(sheet.getLastRow()<=1) return {dados:[],dataRef,minhaRegiao:'',minhaGlobal:false};

  filtroSessao = filtroSessao || {};
  const regiaoUsuario = String(filtroSessao.regiao || '').toUpperCase().trim();
  const ehGlobal = !!filtroSessao.global || regiaoUsuario === 'MASTER';

  // ADAPTADOR: a planilha tem REGIÃO em col 4 (idx 3) entre CONTRATO e COMARCA.
  // Estrutura RETORNADA ao frontend (21 colunas):
  //   [0]=ID, [1]=DATA, [2]=CONTRATO, [3]=COMARCA, [4]=EDIF, [5]=TIPO_PCI,
  //   [6]=QTD, [7]=RECARGA, [8]=VALIDADE, [9]=RTI, [10]=CONDENADO, [11]=OBS,
  //   [12]=DATA_REF, [13]=STATUS, [14]=MED1, [15]=MED2, [16]=MED3, [17]=MED4,
  //   [18]=SUSPENSO, [19]=RTI_URL, [20]=REGIÃO  ← NOVO no final (não quebra índices)
  let dados = sheet.getDataRange().getValues();

  // Filtra por região quando o usuário NÃO é global
  if (regiaoUsuario && !ehGlobal) {
    const cab = dados[0];
    dados = [cab].concat(dados.slice(1).filter(row =>
      String(row[3] || '').toUpperCase().trim() === regiaoUsuario
    ));
  }

  // Faz shift (remove REGIÃO de idx 3) e adiciona REGIÃO no FINAL (idx 20)
  return {
    dados: dados
      .map(row => [row[0], row[1], row[2]].concat(row.slice(4)).concat([row[3] || '']))
      .map(row => row.map(c => (c instanceof Date) ? pci__fmtDate(c) : c)),
    dataRef,
    minhaRegiao: regiaoUsuario,
    minhaGlobal: ehGlobal
  };
}

function pci_recalcularTodosStatus() {
  const sheet=pci__getSheet(), last=sheet.getLastRow();
  if(last<=1) return "Nenhum registro.";
  const dataRef=pci__getDataRef(sheet);
  // Planilha real tem 21 colunas; SUSPENSO=col 20 (idx 19), VALIDADE=col 10 (idx 9), STATUS=col 15
  sheet.getRange(2,1,last-1,21).getValues().forEach((row,idx)=>{
    const susp=pci__norm(row[19])==='SIM';
    sheet.getRange(idx+2,15).setValue(susp?'SUSPENSO':pci__calcStatus(pci__fmtDate(row[9]),dataRef));
  });
  return "Status recalculados!";
}

// ─── LISTAR ARQUIVOS RTI DO DRIVE ───────────────────────
function pci_listarArquivosRTI() {
  try {
    const folder  = DriveApp.getFolderById(PCI_RTI_FOLDER_ID);
    const files   = folder.getFiles();
    const driveMap = {};
    while (files.hasNext()) {
      const f = files.next();
      const fid = f.getId();
      driveMap[fid] = {
        fileId     : fid,
        nome       : f.getName(),
        tamanho    : f.getSize(),
        dataCriacao: Utilities.formatDate(f.getDateCreated(), PCI_FUSO, "yyyy-MM-dd HH:mm"),
        url        : 'https://drive.google.com/file/d/' + fid + '/view',
        mimeType   : f.getMimeType()
      };
    }

    const sheet = pci__getSheet();
    const dados = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
    const resultado = [];

    const fidUsados = new Set();
    for (let i = 1; i < dados.length; i++) {
      const fid = String(dados[i][20] || '').trim();
      if (!fid) continue;
      fidUsados.add(fid);
      const info = driveMap[fid] || null;
      resultado.push({
        id         : dados[i][0],
        contrato   : dados[i][2],
        comarca    : String(dados[i][4] || '').trim().toUpperCase(),
        edificacao : dados[i][5],
        tipoPci    : dados[i][6],
        validade   : pci__fmtDate(dados[i][9]),
        status     : dados[i][14],
        fileId     : fid,
        nome       : info ? info.nome       : 'Arquivo não encontrado no Drive',
        tamanho    : info ? info.tamanho    : 0,
        dataCriacao: info ? info.dataCriacao: '',
        url        : info ? info.url        : '',
        mimeType   : info ? info.mimeType   : '',
        vinculado  : !!info
      });
    }

    Object.values(driveMap).forEach(info => {
      if (!fidUsados.has(info.fileId)) {
        resultado.push({
          id:'—', contrato:'—', comarca:'—', edificacao:'—',
          tipoPci:'—', validade:'—', status:'—',
          fileId     : info.fileId,
          nome       : info.nome,
          tamanho    : info.tamanho,
          dataCriacao: info.dataCriacao,
          url        : info.url,
          mimeType   : info.mimeType,
          vinculado  : false,
          orfao      : true
        });
      }
    });

    resultado.sort((a,b) => {
      if(a.orfao && !b.orfao) return 1;
      if(!a.orfao && b.orfao) return -1;
      return a.comarca.localeCompare(b.comarca, 'pt-BR') ||
             a.edificacao.toString().localeCompare(b.edificacao.toString(), 'pt-BR');
    });

    return { sucesso: true, itens: resultado, totalDrive: Object.keys(driveMap).length };
  } catch(e) {
    return { sucesso: false, erro: e.message, itens: [] };
  }
}

// ─── RELINKAR ÓRFÃOS ────────────────────────────────────
function pci_relinkarOrfaos() {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sheet  = pci__getSheet();
    const dados  = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
    const folder = DriveApp.getFolderById(PCI_RTI_FOLDER_ID);
    const files  = folder.getFiles();

    const idParaFile = {};
    while (files.hasNext()) {
      const f    = files.next();
      const nome = f.getName();
      const match = nome.match(/^RTI_ID(\d+)_/i);
      if (!match) continue;
      const recId = String(parseInt(match[1]));
      if (!idParaFile[recId] || f.getDateCreated() > idParaFile[recId].data) {
        idParaFile[recId] = { fileId: f.getId(), nome, data: f.getDateCreated() };
      }
    }

    if (Object.keys(idParaFile).length === 0) {
      return { sucesso: false, msg: 'Nenhum arquivo com padrão RTI_ID<n>_ encontrado na pasta.', vinculados: 0 };
    }

    let vinculados = 0, jaVinculados = 0, naoEncontrados = [];
    for (let i = 1; i < dados.length; i++) {
      const recId    = String(dados[i][0]);
      const fileAtual = String(dados[i][20] || '').trim();

      if (fileAtual) { jaVinculados++; continue; }

      if (idParaFile[recId]) {
        const fid = idParaFile[recId].fileId;
        try { DriveApp.getFileById(fid).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
        sheet.getRange(i + 1, 21).setValue(fid);
        sheet.getRange(i + 1, 11).setValue('SIM');
        vinculados++;
      } else {
        naoEncontrados.push(recId);
      }
    }

    return {
      sucesso     : true,
      vinculados,
      jaVinculados,
      naoEncontrados,
      msg: vinculados > 0
        ? vinculados + ' registro(s) vinculado(s) com sucesso!'
        : 'Nenhum vínculo novo encontrado. Verifique se os arquivos seguem o padrão RTI_ID<n>_...'
    };
  } catch(e) {
    return { sucesso: false, msg: e.message, vinculados: 0 };
  } finally {
    lock.releaseLock();
  }
}

// ─── DASHBOARD HELPERS ───────────────────────────────────
function pci__getGrupo(t) {
  t=String(t).trim().toUpperCase();
  if(t.startsWith('EXTINTOR AP')) return 'ap';
  if(t.startsWith('EXTINTOR CO²')||t.startsWith('EXTINTOR CO2')) return 'co2';
  if(t.startsWith('EXTINTOR PQS')) return 'pqs';
  if(t.startsWith('EXTINTOR ABC')) return 'abc';
  if(t.startsWith('MANGUEIRA 15')) return 'mang15';
  if(t.startsWith('MANGUEIRA 20')) return 'mang20';
  return 'outros';
}
const PCI_GRUPOS_LABEL={ap:'Extintor AP',co2:'Extintor CO²',pqs:'Extintor PQS BC',abc:'Extintor ABC',mang15:'Mangueira 15m',mang20:'Mangueira 20m',outros:'Outros'};

function pci__filtrarPorPeriodo(base, dataRef, filtroContrato, meses, filtroStatus) {
  const p=dataRef.split('-'), hoje=new Date(p[0],p[1]-1,p[2]);
  const limit=new Date(hoje); limit.setMonth(limit.getMonth()+(meses||12));
  const usarStatus = filtroStatus && filtroStatus.length > 0;

  return base.filter(r=>{
    if(filtroContrato && String(r[2])!==String(filtroContrato)) return false;
    const dV=new Date(pci__fmtDate(r[8])+'T00:00:00');
    const diff=Math.ceil((dV-hoje)/86400000);
    const susp=pci__norm(r[18])==='SIM';
    if(susp) return false;

    if(usarStatus){
      for(const st of filtroStatus){
        if(st==='VENCIDO'   && diff<=0)              return true;
        if(st==='30'        && diff>0  && diff<=30)  return true;
        if(st==='60'        && diff>30 && diff<=60)  return true;
        if(st==='60MAIS'    && diff>60)               return true;
      }
      return false;
    } else {
      return diff<=0 || dV<=limit;
    }
  }).map(r=>{
    const dV=new Date(pci__fmtDate(r[8])+'T00:00:00'), diff=Math.ceil((dV-hoje)/86400000);
    const susp=pci__norm(r[18])==='SIM';
    return {
      id:r[0], contrato:r[2], comarca:pci__norm(r[3]), edificacao:r[4], tipoPci:r[5],
      qtd:parseInt(r[6])||0, recarga:pci__fmtDate(r[7]), validade:pci__fmtDate(r[8]),
      rti:r[9], condenado:r[10], obs:r[11],
      med1:pci__fmtDate(r[14]), med2:pci__fmtDate(r[15]), med3:pci__fmtDate(r[16]), med4:pci__fmtDate(r[17]),
      suspenso:susp, rtiUrl:String(r[19]||''), grupo:pci__getGrupo(r[5]), diff,
      status:susp?'SUSPENSO':diff<=0?'VENCIDO':diff<=30?'VENCE EM 30 DIAS':diff<=60?'VENCE EM 60 DIAS':diff<=90?'VENCE EM 90 DIAS':'VIGENTE'
    };
  }).sort((a,b)=>a.diff-b.diff);
}

function pci__resumoPorTipo(itens) {
  const map={};
  Object.keys(PCI_GRUPOS_LABEL).forEach(k=>{map[k]={label:PCI_GRUPOS_LABEL[k],totalVencido:0,totalAlerta:0,totalOk:0,totalGeral:0};});
  itens.forEach(item=>{const g=item.grupo;if(!map[g])return;map[g].totalGeral+=item.qtd;if(item.diff<=0)map[g].totalVencido+=item.qtd;else if(item.diff<=30)map[g].totalAlerta+=item.qtd;else map[g].totalOk+=item.qtd;});
  return map;
}

function pci__resumoPorComarca(itens) {
  const map={};
  itens.forEach(item=>{const c=item.comarca;if(!map[c])map[c]={comarca:c,itens:[],criticos:0};map[c].itens.push(item);if(item.diff<=0)map[c].criticos+=item.qtd;});
  return Object.values(map).sort((a,b)=>b.criticos-a.criticos);
}

function pci__labelFiltroStatus(filtroStatus, meses) {
  if(!filtroStatus || filtroStatus.length===0){
    return meses===1?'1 mês':meses+' meses';
  }
  const map={VENCIDO:'Vencidos','30':'Vence 30d','60':'Vence 60d','60MAIS':'Acima 60d'};
  return filtroStatus.map(s=>map[s]||s).join(' + ');
}

// ─── PDF ─────────────────────────────────────────────────
function pci_gerarRelatorioPDF(filtroContrato, meses, filtroStatus) {
  meses=parseInt(meses)||12;
  filtroStatus=filtroStatus||[];
  const {dados,dataRef}=pci_lerDados(), base=dados.slice(1), pRef=dataRef.split('-');
  const itens=pci__filtrarPorPeriodo(base,dataRef,filtroContrato,meses,filtroStatus);
  const tipoMap=pci__resumoPorTipo(itens), comarcas=pci__resumoPorComarca(itens);
  const pl=pci__labelFiltroStatus(filtroStatus,meses);

  let h=`<html><head><meta charset="UTF-8"><style>body{font-family:Arial;margin:20px;font-size:11px}h1{color:#003366;font-size:16px}h2{color:#003366;font-size:13px;margin:18px 0 6px;border-bottom:2px solid #003366;padding-bottom:3px}.sub{color:#666;font-size:10px;margin-bottom:16px}.tg{display:table;width:100%;border-collapse:collapse;margin-bottom:10px}.tr{display:table-row}.tc{display:table-cell;padding:5px 8px;border:1px solid #ddd;vertical-align:middle}.th{background:#003366;color:white;font-weight:bold}table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px}thead tr{background:#003366;color:white}th,td{padding:5px 7px;border:1px solid #ccc}tr:nth-child(even){background:#f7f9fc}.ch{background:#e8eef6;font-weight:bold;color:#003366}.tv{background:#d63031;color:white;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:bold}.t30{background:#f59e0b;color:white;padding:1px 5px;border-radius:4px;font-size:9px}.t60{background:#f39c12;color:white;padding:1px 5px;border-radius:4px;font-size:9px}.t90{background:#3b82f6;color:white;padding:1px 5px;border-radius:4px;font-size:9px}.tok{background:#16a34a;color:white;padding:1px 5px;border-radius:4px;font-size:9px}.ts{background:#94a3b8;color:white;padding:1px 5px;border-radius:4px;font-size:9px}.ft{margin-top:20px;font-size:9px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:8px}</style></head><body>
  <h1>⚠️ Relatório de Vencimentos PCI — TJMG / COMAP</h1>
  <div class="sub">Contrato:<strong>${filtroContrato||'Todos'}</strong> | Filtro:<strong>${pl}</strong> | Ref:<strong>${pRef[2]}/${pRef[1]}/${pRef[0]}</strong> | Total:<strong>${itens.length}</strong></div>
  <h2>1. Resumo por Tipo</h2><div class="tg"><div class="tr"><div class="tc th">Tipo</div><div class="tc th" style="text-align:center">Total</div><div class="tc th" style="text-align:center">Vencidos</div><div class="tc th" style="text-align:center">30d</div><div class="tc th" style="text-align:center">No Prazo</div></div>`;
  ['ap','co2','pqs','abc','mang15','mang20','outros'].forEach(k=>{const g=tipoMap[k];if(!g||!g.totalGeral)return;h+=`<div class="tr"><div class="tc"><strong>${g.label}</strong></div><div class="tc" style="text-align:center;font-weight:bold">${g.totalGeral}</div><div class="tc" style="text-align:center;color:${g.totalVencido>0?'#d63031':'#aaa'}">${g.totalVencido||'—'}</div><div class="tc" style="text-align:center;color:${g.totalAlerta>0?'#f59e0b':'#aaa'}">${g.totalAlerta||'—'}</div><div class="tc" style="text-align:center;color:${g.totalOk>0?'#16a34a':'#aaa'}">${g.totalOk||'—'}</div></div>`;});
  h+=`</div><h2>2. Detalhamento por Comarca</h2>`;
  comarcas.forEach(({comarca,itens:ic})=>{
    h+=`<table><thead><tr><th colspan="9" class="ch">📍 ${comarca}</th></tr><tr><th>ID</th><th>Edif.</th><th>Tipo PCI</th><th>Qtd</th><th>Recarga</th><th>Validade</th><th>RTI</th><th>Status/Medições</th><th>Arquivo RTI</th></tr></thead><tbody>`;
    ic.forEach(item=>{
      const tc=item.suspenso?'ts':item.diff<=0?'tv':item.diff<=30?'t30':item.diff<=60?'t60':item.diff<=90?'t90':'tok';
      const meds=[item.med1,item.med2,item.med3,item.med4].filter(Boolean).map((d,i)=>`${i+1}º:${d.split('-').reverse().join('/')}`).join(' | ')||'—';
      const rtiUrl=item.rtiUrl?'https://drive.google.com/file/d/'+item.rtiUrl+'/view':'';
      h+=`<tr><td>${item.id}</td><td>${item.edificacao}</td><td>${item.tipoPci}</td><td style="text-align:center;font-weight:bold">${item.qtd}</td><td style="text-align:center">${item.recarga?item.recarga.split('-').reverse().join('/'):'—'}</td><td style="text-align:center">${item.validade.split('-').reverse().join('/')}</td><td style="text-align:center">${item.rti}</td><td><span class="${tc}">${item.status}</span><br><small>${meds}</small></td><td>${rtiUrl?'<a href="'+rtiUrl+'">📎 Abrir</a>':'—'}</td></tr>`;
    });
    h+=`</tbody></table>`;
  });
  h+=`<div class="ft">COMAP/TJMG · Ref:${pRef[2]}/${pRef[1]}/${pRef[0]} · ${pl}</div></body></html>`;
  return "data:application/pdf;base64,"+Utilities.base64Encode(Utilities.newBlob(h,"text/html","Relatorio_PCI_Norte.pdf").getAs("application/pdf").getBytes());
}

// ─── E-MAIL ──────────────────────────────────────────────
function pci_enviarEmailAlertas(filtroContrato, meses, filtroStatus) {
  meses=parseInt(meses)||12;
  filtroStatus=filtroStatus||[];
  const {dados,dataRef}=pci_lerDados(), base=dados.slice(1), pRef=dataRef.split('-');
  const itens=pci__filtrarPorPeriodo(base,dataRef,filtroContrato,meses,filtroStatus);
  const comarcas=pci__resumoPorComarca(itens);
  if(!itens.length) return "Nenhum equipamento encontrado com os filtros selecionados.";

  const pl=pci__labelFiltroStatus(filtroStatus,meses);
  const tv=itens.reduce((s,i)=>s+(i.diff<=0?i.qtd:0),0);
  const t30=itens.reduce((s,i)=>s+(i.diff>0&&i.diff<=30?i.qtd:0),0);
  const tot=itens.reduce((s,i)=>s+i.qtd,0);

  let rows='';
  comarcas.forEach(({comarca,itens:ic})=>{
    rows+=`<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;"><thead><tr><th colspan="8" style="padding:9px 12px;background:#003366;color:white;text-align:left;font-size:13px;border-bottom:3px solid #c5a059;">📍 ${comarca}</th></tr><tr style="background:#e8eef6;color:#003366;"><th style="padding:7px 10px;border:1px solid #c8d6e8">Edif.</th><th style="padding:7px 10px;border:1px solid #c8d6e8">Equip.</th><th style="padding:7px 10px;border:1px solid #c8d6e8;text-align:center">Qtd</th><th style="padding:7px 10px;border:1px solid #c8d6e8;text-align:center">Recarga</th><th style="padding:7px 10px;border:1px solid #c8d6e8;text-align:center">Validade</th><th style="padding:7px 10px;border:1px solid #c8d6e8;text-align:center">Status</th><th style="padding:7px 10px;border:1px solid #c8d6e8;text-align:center">Medições</th><th style="padding:7px 10px;border:1px solid #c8d6e8;text-align:center">RTI</th></tr></thead><tbody>`;
    ic.forEach((item,idx)=>{
      const bg=idx%2===0?'#fff':'#f4f7fb';
      const stBg=item.suspenso?'#94a3b8':item.diff<=0?'#d63031':item.diff<=30?'#f59e0b':item.diff<=60?'#f39c12':item.diff<=90?'#3b82f6':'#16a34a';
      const meds=[item.med1,item.med2,item.med3,item.med4].filter(Boolean).map((d,i)=>`${i+1}º:${d.split('-').reverse().join('/')}`).join(' | ')||'—';
      const rtiUrl=item.rtiUrl?'https://drive.google.com/file/d/'+item.rtiUrl+'/view':'';
      rows+=`<tr style="background:${bg}"><td style="padding:7px 10px;border:1px solid #dde6f0">${item.edificacao}</td><td style="padding:7px 10px;border:1px solid #dde6f0;font-weight:600">${item.tipoPci}</td><td style="padding:7px 10px;border:1px solid #dde6f0;text-align:center;font-weight:800">${item.qtd}</td><td style="padding:7px 10px;border:1px solid #dde6f0;text-align:center">${item.recarga?item.recarga.split('-').reverse().join('/'):'—'}</td><td style="padding:7px 10px;border:1px solid #dde6f0;text-align:center">${item.validade.split('-').reverse().join('/')}</td><td style="padding:7px 10px;border:1px solid #dde6f0;text-align:center"><span style="background:${stBg};color:white;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:bold">${item.status}</span></td><td style="padding:7px 10px;border:1px solid #dde6f0;font-size:10px">${meds}</td><td style="padding:7px 10px;border:1px solid #dde6f0;text-align:center">${rtiUrl?'<a href="'+rtiUrl+'" style="color:#003366;font-weight:700;font-size:11px;">📎 Abrir RTI</a>':'—'}</td></tr>`;
    });
    rows+=`</tbody></table>`;
  });

  const body=`<div style="font-family:Arial,sans-serif;max-width:820px;margin:0 auto;color:#222;"><div style="background:#003366;padding:20px 24px;border-bottom:4px solid #c5a059;border-radius:8px 8px 0 0;"><h2 style="color:white;margin:0;font-size:18px;">⚠️ Relatório de Vencimentos PCI — TJMG</h2><p style="color:#c5a059;margin:6px 0 0;font-size:13px;">COMAP — Norte</p></div><div style="background:#f4f7fb;padding:16px 24px;border:1px solid #dde6f0;"><table style="width:100%;border-collapse:collapse"><tr><td style="font-size:13px;padding:6px 16px 6px 0">📅 Data Ref.:</td><td style="font-weight:bold;font-size:13px">${pRef[2]}/${pRef[1]}/${pRef[0]}</td><td style="font-size:13px;padding:6px 16px">📋 Contrato:</td><td style="font-weight:bold;font-size:13px">${filtroContrato||'Todos'}</td></tr><tr><td style="font-size:13px">🔎 Filtro:</td><td style="font-weight:bold;font-size:13px">${pl}</td><td style="font-size:13px;padding:6px 16px">🏛️ Comarcas:</td><td style="font-weight:bold;font-size:13px">${comarcas.length}</td></tr></table></div><div style="display:flex;border:1px solid #dde6f0;border-top:none"><div style="flex:1;padding:14px;text-align:center;background:#ffe5e5;border-right:1px solid #dde6f0"><div style="font-size:26px;font-weight:900;color:#d63031">${tv}</div><div style="font-size:11px;color:#d63031;font-weight:600">VENCIDAS</div></div><div style="flex:1;padding:14px;text-align:center;background:#fff4e5;border-right:1px solid #dde6f0"><div style="font-size:26px;font-weight:900;color:#e67e22">${t30}</div><div style="font-size:11px;color:#e67e22;font-weight:600">vencem em 30d</div></div><div style="flex:1;padding:14px;text-align:center;background:#e8f4fe"><div style="font-size:26px;font-weight:900;color:#2196F3">${tot}</div><div style="font-size:11px;color:#2196F3;font-weight:600">total período</div></div></div><div style="padding:20px 24px;background:white;border:1px solid #dde6f0;border-top:none"><h3 style="color:#003366;font-size:14px;margin:0 0 16px;padding-bottom:6px;border-bottom:2px solid #003366">Detalhamento por Comarca (${comarcas.length})</h3>${rows}</div><div style="background:#f4f7fb;padding:12px 24px;border:1px solid #dde6f0;border-top:none;border-radius:0 0 8px 8px"><p style="font-size:11px;color:#888;margin:0;text-align:center">COMAP/TJMG · ${pl} · Ref:${pRef[2]}/${pRef[1]}/${pRef[0]}</p></div></div>`;

  const dest=pci_lerDestinatarios();
  MailApp.sendEmail({
    to:dest.length>0?dest.join(','):"comap.norte@tjmg.jus.br,edenias.leao@tjmg.jus.br",
    subject:`⚠️ Relatório PCI Norte (${pl}) — ${filtroContrato||'Geral'} — ${pRef[2]}/${pRef[1]}/${pRef[0]}`,
    htmlBody:body
  });
  return `E-mail enviado para ${dest.length||2} destinatário(s)! Filtro: ${pl}`;
}




function pci_converterParaMaiusculas() {
  const aba = ss_().getActiveSheet();
  const ultimaLinha = aba.getLastRow();
  
  if (ultimaLinha === 0) return; // Sai se a planilha estiver vazia

  // Definimos o intervalo que abrange das colunas D até F
  // getRange(linhaInicial, colunaInicial, numeroLinhas, numeroColunas)
  const intervalo = aba.getRange(1, 4, ultimaLinha, 3); 
  const valores = intervalo.getValues();

  // Processa os dados na memória (muito mais rápido que célula por célula)
  const novosValores = valores.map(linha => {
    return linha.map(celula => {
      return typeof celula === 'string' ? celula.toUpperCase() : celula;
    });
  });

  // Devolve os valores para a planilha de uma só vez
  intervalo.setValues(novosValores);
}