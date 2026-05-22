/**
 * ============================================================
 *  Usr_Server.gs — Gestão de Usuários (MASTER)
 *  Ciclo 3 do COMAP Sistema Integrado v5.x
 * ============================================================
 *
 *  Aba USUARIOS (5 colunas):
 *    A: NOME  | B: EMAIL  | C: SENHA  | D: REGIÃO  | E: STATUS
 *
 *  Funções públicas (todas exigem perfil MASTER):
 *    - usr_listar(sessao)                            → lista todos
 *    - usr_buscar(email, sessao)                     → busca um
 *    - usr_criar(dados, sessao)                      → cria novo
 *    - usr_atualizar(emailOriginal, dados, sessao)   → atualiza
 *    - usr_alterarSenha(email, novaSenha, sessao)    → muda só senha
 *    - usr_inativar(email, sessao)                   → STATUS=INATIVO
 *    - usr_reativar(email, sessao)                   → STATUS=ATIVO
 *    - usr_excluir(email, sessao)                    → deleta linha
 *    - usr_setupColunas()                            → SETUP: adiciona col E se faltar
 *
 *  Travas de segurança:
 *    - Só MASTER acessa qualquer função
 *    - Não pode se auto-excluir, auto-inativar, mudar próprio email
 *    - Não pode rebaixar/excluir o último MASTER ativo
 *    - Email deve ser único na planilha
 */

/* ===== CONSTANTES ===== */
const USR_SHEET = 'USUARIOS';
const USR_COLS = {
  NOME:    1,  // A
  EMAIL:   2,  // B
  SENHA:   3,  // C
  REGIAO:  4,  // D
  STATUS:  5   // E
};
const USR_STATUS = { ATIVO: 'ATIVO', INATIVO: 'INATIVO' };

/* ===== HELPERS PRIVADOS ===== */

/** Lê a aba USUARIOS retornando array de objetos. */
function usr__lerTudo_() {
  const ss = ss_();
  const sh = ss.getSheetByName(USR_SHEET);
  if (!sh) throw new Error("Aba '" + USR_SHEET + "' não encontrada.");
  const ul = sh.getLastRow();
  if (ul < 2) return { sheet: sh, dados: [], headerRow: 1 };

  const lc = Math.max(sh.getLastColumn(), 5);
  const valores = sh.getRange(2, 1, ul - 1, lc).getValues();

  const dados = valores.map(function(row, idx) {
    return {
      _linha: idx + 2,
      nome:   String(row[0] || '').trim(),
      email:  String(row[1] || '').trim().toLowerCase(),
      senha:  String(row[2] || ''),
      regiao: String(row[3] || '').trim().toUpperCase(),
      status: String(row[4] || USR_STATUS.ATIVO).trim().toUpperCase()
    };
  });
  return { sheet: sh, dados: dados };
}

/** Confirma que a sessão é MASTER (perfil global). */
function usr__exigirMaster_(sessao) {
  if (!sessao || !sessao.email) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }
  if (!sessao.global) {
    throw new Error('Acesso negado: apenas perfis MASTER podem gerir usuários.');
  }
  return true;
}

/** Verifica se o email é o próprio usuário da sessão (mesma conta). */
function usr__ehProprio_(emailAlvo, sessao) {
  if (!sessao || !sessao.email) return false;
  return String(emailAlvo || '').trim().toLowerCase() ===
         String(sessao.email).trim().toLowerCase();
}

/** Conta quantos MASTERs ATIVOS existem (excluindo opcionalmente um email). */
function usr__contarMastersAtivos_(excluirEmail) {
  const exc = excluirEmail ? String(excluirEmail).trim().toLowerCase() : null;
  const { dados } = usr__lerTudo_();
  return dados.filter(function(u) {
    if (u.status !== USR_STATUS.ATIVO) return false;
    if (u.regiao !== 'MASTER') return false;
    if (exc && u.email === exc) return false;
    return true;
  }).length;
}

/** Valida campos obrigatórios e formato. */
function usr__validarDados_(d, criando) {
  if (!d) throw new Error('Dados ausentes.');
  const nome = String(d.nome || '').trim();
  const email = String(d.email || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  const regiao = String(d.regiao || '').trim().toUpperCase();
  const status = String(d.status || USR_STATUS.ATIVO).trim().toUpperCase();

  if (!nome) throw new Error('Nome é obrigatório.');
  if (nome.length < 2) throw new Error('Nome muito curto.');
  if (!email) throw new Error('Email é obrigatório.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email com formato inválido.');
  if (criando && !senha) throw new Error('Senha é obrigatória para novos cadastros.');
  if (senha && senha.length < 4) throw new Error('Senha deve ter pelo menos 4 caracteres.');
  if (!regiao) throw new Error('Região é obrigatória.');

  const regioesValidas = (CONFIG.REGIOES || []).concat(CONFIG.REGIOES_GLOBAIS || []);
  if (regioesValidas.length && regioesValidas.indexOf(regiao) < 0) {
    throw new Error('Região "' + regiao + '" não é válida. Use uma de: ' + regioesValidas.join(', '));
  }
  if (status !== USR_STATUS.ATIVO && status !== USR_STATUS.INATIVO) {
    throw new Error('Status deve ser ATIVO ou INATIVO.');
  }
  return { nome: nome, email: email, senha: senha, regiao: regiao, status: status };
}

/* ===== SETUP ===== */

/**
 * Adiciona a coluna STATUS (E) à aba USUARIOS se ainda não existir.
 * Marca todos os usuários existentes como ATIVO.
 *
 * Execute UMA VEZ no editor antes de usar o módulo.
 */
function usr_setupColunas() {
  const ss = ss_();
  const sh = ss.getSheetByName(USR_SHEET);
  if (!sh) throw new Error("Aba '" + USR_SHEET + "' não encontrada.");

  let lc = sh.getLastColumn();
  if (lc < 5) {
    // Cria cabeçalho da coluna E
    sh.getRange(1, 5).setValue('STATUS')
      .setFontWeight('bold')
      .setBackground('#003366')
      .setFontColor('#ffffff');
    // Marca todos os usuários existentes como ATIVO
    const ul = sh.getLastRow();
    if (ul >= 2) {
      const valoresStatus = [];
      for (let i = 0; i < ul - 1; i++) valoresStatus.push([USR_STATUS.ATIVO]);
      sh.getRange(2, 5, ul - 1, 1).setValues(valoresStatus);
    }
    Logger.log('Coluna STATUS adicionada. ' + (ul - 1) + ' usuários marcados como ATIVO.');
    return { ok: true, msg: 'Coluna STATUS criada e ' + (ul - 1) + ' usuários marcados como ATIVO.' };
  }
  // Verifica se algumas linhas têm STATUS vazio e preenche com ATIVO
  const ul = sh.getLastRow();
  if (ul >= 2) {
    const range = sh.getRange(2, 5, ul - 1, 1);
    const valores = range.getValues();
    let preenchidos = 0;
    for (let i = 0; i < valores.length; i++) {
      if (!valores[i][0] || String(valores[i][0]).trim() === '') {
        valores[i][0] = USR_STATUS.ATIVO;
        preenchidos++;
      }
    }
    if (preenchidos > 0) {
      range.setValues(valores);
      return { ok: true, msg: preenchidos + ' linha(s) com STATUS vazio preenchidas como ATIVO.' };
    }
  }
  return { ok: true, msg: 'Coluna STATUS já existe e está preenchida.' };
}

/* ===== LEITURA ===== */

/** Lista todos os usuários (MASTER only). */
function usr_listar(sessao) {
  try {
    usr__exigirMaster_(sessao);
    const { dados } = usr__lerTudo_();
    // Não retorna senha por segurança — só metadados de existência
    return {
      ok: true,
      total: dados.length,
      usuarios: dados.map(function(u) {
        return {
          linha:    u._linha,
          nome:     u.nome,
          email:    u.email,
          regiao:   u.regiao,
          status:   u.status,
          temSenha: !!u.senha,
          eProprio: usr__ehProprio_(u.email, sessao),
          eMaster:  u.regiao === 'MASTER'
        };
      })
    };
  } catch (e) {
    log_('ERROR', sessao && sessao.email, 'USR_LISTAR_FAIL', { msg: e.message });
    return { ok: false, erro: e.message };
  }
}

/** Busca um usuário específico. */
function usr_buscar(email, sessao) {
  try {
    usr__exigirMaster_(sessao);
    const alvo = String(email || '').trim().toLowerCase();
    const { dados } = usr__lerTudo_();
    const u = dados.find(function(x) { return x.email === alvo; });
    if (!u) return { ok: false, erro: 'Usuário não encontrado.' };
    return {
      ok: true,
      usuario: {
        linha:  u._linha,
        nome:   u.nome,
        email:  u.email,
        regiao: u.regiao,
        status: u.status
        // senha NÃO retornada
      }
    };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

/* ===== CRIAÇÃO ===== */

function usr_criar(dadosBrutos, sessao) {
  const lock = LockService.getScriptLock();
  try {
    usr__exigirMaster_(sessao);
    const d = usr__validarDados_(dadosBrutos, true);
    lock.waitLock(15000);

    const { sheet, dados } = usr__lerTudo_();

    // Email único
    if (dados.some(function(u) { return u.email === d.email; })) {
      throw new Error('Já existe usuário com este email: ' + d.email);
    }

    // Acrescenta linha
    sheet.appendRow([d.nome, d.email, d.senha, d.regiao, d.status]);
    log_('INFO', sessao.email, 'USR_CRIAR', { email: d.email, regiao: d.regiao });
    return { ok: true, msg: 'Usuário cadastrado com sucesso.', email: d.email };

  } catch (e) {
    log_('ERROR', sessao && sessao.email, 'USR_CRIAR_FAIL', { msg: e.message });
    return { ok: false, erro: e.message };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

/* ===== ATUALIZAÇÃO ===== */

function usr_atualizar(emailOriginal, dadosBrutos, sessao) {
  const lock = LockService.getScriptLock();
  try {
    usr__exigirMaster_(sessao);
    const alvo = String(emailOriginal || '').trim().toLowerCase();
    if (!alvo) throw new Error('Email original ausente.');

    // No update, senha pode vir vazia (não muda)
    const senhaNova = String((dadosBrutos && dadosBrutos.senha) || '');
    const d = usr__validarDados_(dadosBrutos, false);

    lock.waitLock(15000);
    const { sheet, dados } = usr__lerTudo_();
    const usr = dados.find(function(x) { return x.email === alvo; });
    if (!usr) throw new Error('Usuário não encontrado: ' + alvo);

    // Trava: não mudar próprio email
    if (usr__ehProprio_(alvo, sessao) && d.email !== alvo) {
      throw new Error('Você não pode alterar seu próprio email (perderia acesso). Peça a outro MASTER para fazer essa mudança.');
    }

    // Trava: email novo não pode colidir com outro
    if (d.email !== alvo && dados.some(function(u) { return u.email === d.email && u._linha !== usr._linha; })) {
      throw new Error('Já existe outro usuário com este email: ' + d.email);
    }

    // Trava: não rebaixar o único MASTER ativo
    const eraMaster = usr.regiao === 'MASTER' && usr.status === USR_STATUS.ATIVO;
    const seraMaster = d.regiao === 'MASTER' && d.status === USR_STATUS.ATIVO;
    if (eraMaster && !seraMaster) {
      const outros = usr__contarMastersAtivos_(alvo);
      if (outros === 0) {
        throw new Error('Não é permitido rebaixar/inativar o último MASTER ativo. Promova outro usuário a MASTER ATIVO antes.');
      }
    }

    // Trava: não auto-inativar
    if (usr__ehProprio_(alvo, sessao) && d.status === USR_STATUS.INATIVO) {
      throw new Error('Você não pode inativar a si mesmo.');
    }

    // Atualiza linha
    const linha = usr._linha;
    sheet.getRange(linha, USR_COLS.NOME).setValue(d.nome);
    sheet.getRange(linha, USR_COLS.EMAIL).setValue(d.email);
    if (senhaNova) {
      sheet.getRange(linha, USR_COLS.SENHA).setValue(senhaNova);
    }
    sheet.getRange(linha, USR_COLS.REGIAO).setValue(d.regiao);
    sheet.getRange(linha, USR_COLS.STATUS).setValue(d.status);

    log_('INFO', sessao.email, 'USR_ATUALIZAR', { de: alvo, para: d.email, regiao: d.regiao, status: d.status, senhaAlterada: !!senhaNova });
    return { ok: true, msg: 'Usuário atualizado com sucesso.' };

  } catch (e) {
    log_('ERROR', sessao && sessao.email, 'USR_ATUALIZAR_FAIL', { msg: e.message, alvo: emailOriginal });
    return { ok: false, erro: e.message };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

/* ===== SENHA ===== */

function usr_alterarSenha(email, novaSenha, sessao) {
  const lock = LockService.getScriptLock();
  try {
    usr__exigirMaster_(sessao);
    const alvo = String(email || '').trim().toLowerCase();
    const senha = String(novaSenha || '');
    if (!senha || senha.length < 4) throw new Error('Nova senha deve ter pelo menos 4 caracteres.');

    lock.waitLock(15000);
    const { sheet, dados } = usr__lerTudo_();
    const usr = dados.find(function(x) { return x.email === alvo; });
    if (!usr) throw new Error('Usuário não encontrado: ' + alvo);

    sheet.getRange(usr._linha, USR_COLS.SENHA).setValue(senha);
    log_('INFO', sessao.email, 'USR_SENHA', { alvo: alvo });
    return { ok: true, msg: 'Senha alterada com sucesso.' };

  } catch (e) {
    return { ok: false, erro: e.message };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

/* ===== INATIVAR / REATIVAR ===== */

function usr_inativar(email, sessao) {
  const lock = LockService.getScriptLock();
  try {
    usr__exigirMaster_(sessao);
    const alvo = String(email || '').trim().toLowerCase();

    if (usr__ehProprio_(alvo, sessao)) {
      throw new Error('Você não pode inativar a si mesmo.');
    }

    lock.waitLock(15000);
    const { sheet, dados } = usr__lerTudo_();
    const usr = dados.find(function(x) { return x.email === alvo; });
    if (!usr) throw new Error('Usuário não encontrado: ' + alvo);

    if (usr.status === USR_STATUS.INATIVO) {
      return { ok: true, msg: 'Usuário já estava inativo.' };
    }

    // Se for MASTER, conferir se há outros
    if (usr.regiao === 'MASTER') {
      const outros = usr__contarMastersAtivos_(alvo);
      if (outros === 0) {
        throw new Error('Não é permitido inativar o último MASTER ativo. Promova outro usuário a MASTER antes.');
      }
    }

    sheet.getRange(usr._linha, USR_COLS.STATUS).setValue(USR_STATUS.INATIVO);
    log_('INFO', sessao.email, 'USR_INATIVAR', { alvo: alvo });
    return { ok: true, msg: 'Usuário inativado. Ele não conseguirá mais fazer login.' };

  } catch (e) {
    return { ok: false, erro: e.message };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

function usr_reativar(email, sessao) {
  const lock = LockService.getScriptLock();
  try {
    usr__exigirMaster_(sessao);
    const alvo = String(email || '').trim().toLowerCase();

    lock.waitLock(15000);
    const { sheet, dados } = usr__lerTudo_();
    const usr = dados.find(function(x) { return x.email === alvo; });
    if (!usr) throw new Error('Usuário não encontrado: ' + alvo);

    if (usr.status === USR_STATUS.ATIVO) {
      return { ok: true, msg: 'Usuário já estava ativo.' };
    }

    sheet.getRange(usr._linha, USR_COLS.STATUS).setValue(USR_STATUS.ATIVO);
    log_('INFO', sessao.email, 'USR_REATIVAR', { alvo: alvo });
    return { ok: true, msg: 'Usuário reativado. Ele já pode fazer login novamente.' };

  } catch (e) {
    return { ok: false, erro: e.message };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}

/* ===== EXCLUSÃO (HARD DELETE) ===== */

function usr_excluir(email, sessao) {
  const lock = LockService.getScriptLock();
  try {
    usr__exigirMaster_(sessao);
    const alvo = String(email || '').trim().toLowerCase();

    if (usr__ehProprio_(alvo, sessao)) {
      throw new Error('Você não pode excluir a si mesmo.');
    }

    lock.waitLock(15000);
    const { sheet, dados } = usr__lerTudo_();
    const usr = dados.find(function(x) { return x.email === alvo; });
    if (!usr) throw new Error('Usuário não encontrado: ' + alvo);

    // Trava: não excluir último MASTER ATIVO
    if (usr.regiao === 'MASTER' && usr.status === USR_STATUS.ATIVO) {
      const outros = usr__contarMastersAtivos_(alvo);
      if (outros === 0) {
        throw new Error('Não é permitido excluir o último MASTER ativo. Promova outro usuário a MASTER antes.');
      }
    }

    sheet.deleteRow(usr._linha);
    log_('WARN', sessao.email, 'USR_EXCLUIR', { alvo: alvo, regiao: usr.regiao });
    return { ok: true, msg: 'Usuário excluído permanentemente.' };

  } catch (e) {
    return { ok: false, erro: e.message };
  } finally {
    try { lock.releaseLock(); } catch(e){}
  }
}