/**
 * Auth.gs — Autenticação centralizada (Email + Senha)
 * --------------------------------------------------------------
 * Compatível com a aba USUARIOS atual:
 *   Nome | Email | Senha | REGIÃO
 *
 * Os módulos originais também chamavam validarLogin(email,senha),
 * mas foram renomeados para emr_validarLogin, per_validarLogin etc.
 * Cada um simplesmente delega para esta função central.
 */

/**
 * Função central de validação. Pode ser chamada pelo shell OU pelos módulos.
 * Retorna o mesmo formato que os sistemas originais esperam:
 *   { sucesso, nome, regiao, msg? }
 */
/**
 * ============================================================
 *  Auth_patch.gs — PATCH no validarLoginCentral
 *  Ciclo 3 do COMAP Sistema Integrado
 * ============================================================
 *
 *  PROPÓSITO:
 *    Bloquear login de usuários com STATUS = INATIVO.
 *    Sem este patch, inativar um usuário em USUARIOS não impede
 *    o login (porque o Auth.gs original não confere a coluna E).
 *
 *  COMO APLICAR:
 *    Abra o arquivo Auth.gs no editor e SUBSTITUA APENAS a função
 *    validarLoginCentral pelo bloco abaixo. As outras funções
 *    (loginShell, getResumoGeral) NÃO precisam ser tocadas.
 *
 *  COMO LOCALIZAR a função no seu Auth.gs:
 *    Procure por:  function validarLoginCentral(email, senha) {
 *
 *  Detalhes da mudança:
 *    - Linha extra logo após validar email+senha:
 *        const statusUsr = String(linha[4] || 'ATIVO').trim().toUpperCase();
 *        if (statusUsr === 'INATIVO') return { sucesso:false, msg:'...' };
 *    - Mensagem clara para o usuário sobre o motivo do bloqueio.
 *    - Log estruturado para rastreamento (LOGIN_INATIVO).
 */

function validarLoginCentral(email, senha) {
  try {
    const sh = ss_().getSheetByName(CONFIG.USUARIOS_SHEET);
    if (!sh) return { sucesso: false, msg: "Aba 'USUARIOS' não encontrada." };

    const dados = sh.getDataRange().getValues();
    if (dados.length < 2) return { sucesso: false, msg: 'Aba USUARIOS vazia.' };

    const e = String(email || '').trim().toLowerCase();
    const s = String(senha || '').trim();

    if (!e || !s) return { sucesso: false, msg: 'Informe e-mail e senha.' };

    // Estrutura: Nome(0) | Email(1) | Senha(2) | Região(3) | Status(4)
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      const emailP  = String(linha[1] || '').trim().toLowerCase();
      const senhaP  = String(linha[2] || '').trim();
      const nomeP   = String(linha[0] || '').trim();
      const regiaoP = String(linha[3] || '').trim().toUpperCase();
      const statusP = String(linha[4] || 'ATIVO').trim().toUpperCase();  // ★ NOVO

      if (emailP === e && senhaP === s) {
        // ★ NOVO: bloqueia login se inativo
        if (statusP === 'INATIVO') {
          log_('WARN', e, 'LOGIN_INATIVO', { regiao: regiaoP });
          return {
            sucesso: false,
            msg: 'Acesso suspenso. Seu usuário está marcado como inativo. Procure um administrador (MASTER) para reativar.'
          };
        }
        log_('INFO', nomeP, 'LOGIN', { email: emailP, regiao: regiaoP });
        return { sucesso: true, nome: nomeP, regiao: regiaoP };
      }
    }

    log_('WARN', e, 'LOGIN_FALHA', null);
    return { sucesso: false, msg: 'E-mail ou senha incorretos.' };

  } catch (err) {
    log_('ERROR', '?', 'LOGIN_EXCECAO', { msg: err.message });
    return { sucesso: false, msg: 'Erro: ' + err.message };
  }
}

/**
 * Função pública chamada pelo SHELL (index.html) — retorna formato moderno.
 */
function loginShell(email, senha) {
  const r = validarLoginCentral(email, senha);
  if (!r.sucesso) return { ok: false, erro: r.msg };
  return {
    ok: true,
    sessao: {
      nome: r.nome,
      email: String(email).trim().toLowerCase(),
      regiao: r.regiao,
      global: CONFIG.REGIOES_GLOBAIS.indexOf(r.regiao) >= 0,
      token: Utilities.getUuid().replace(/-/g, '')
    }
  };
}

/**
 * Os módulos originais chamavam validarLogin(email,senha). Como elas foram
 * prefixadas para emr_validarLogin, per_validarLogin, etc., e ainda
 * delegam para essa função central, mantemos compatibilidade total.
 *
 * Mas no fluxo atual, o usuário já vai logado para o módulo (via sessão
 * gravada em localStorage pelo shell). Os módulos não chamam mais o login
 * — eles leem o localStorage e vão direto pro dashboard.
 */

/**
 * Devolve o resumo de cada módulo para os cards do dashboard inicial.
 */
function getResumoGeral(sessao) {
  const resumo = {};
  const regiao = (sessao && sessao.regiao || '').toUpperCase();
  const global = sessao && sessao.global;

  Object.keys(CONFIG.MODULOS).forEach(id => {
    const m = CONFIG.MODULOS[id];
    let total = 0, erro = null;
    try {
      const sh = ss_().getSheetByName(m.sheet);
      if (!sh) {
        erro = 'Aba "' + m.sheet + '" não encontrada';
      } else {
        const ul = sh.getLastRow();
        const lc = sh.getLastColumn();
        if (ul < 2) {
          total = 0;
        } else if (global) {
          total = ul - 1;
        } else {
          // Filtra por região: descobre coluna REGIÃO
          const head = sh.getRange(1, 1, 1, lc).getValues()[0];
          let iReg = -1;
          for (let j = 0; j < head.length; j++) {
            const norm = String(head[j] || '').trim().toUpperCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (norm === 'REGIAO') { iReg = j; break; }
          }
          if (iReg < 0) {
            total = ul - 1; // sem coluna região = mostra tudo
          } else {
            const col = sh.getRange(2, iReg + 1, ul - 1, 1).getValues();
            total = col.filter(r => String(r[0] || '').trim().toUpperCase() === regiao).length;
          }
        }
      }
    } catch (e) {
      erro = e.message;
    }
    resumo[id] = {
      label: m.label,
      icone: m.icone,
      cor: m.cor,
      total: total,
      erro: erro
    };
  });

  return { ok: true, resumo: resumo };
}