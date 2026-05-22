'use strict';
/* ============================================================
   TJMG Fiscal PWA — report-pdf.js  v71
   Módulo separado para exportação de PDF.

   ═══ DESCRIÇÃO ═══
   Gera PDF com o MESMO design e layout do relatório HTML,
   utilizando as funções _gerarHTMLStr() e _gerarHTMLSubStr()
   do report-html.js como base.

   ═══ COMO FUNCIONA ═══
   1. Reutiliza a string HTML gerada pelo report-html.js
   2. Renderiza num iframe oculto com html2pdf.js
   3. Gera PDF A4 com alta fidelidade visual
   4. Remove o iframe após a geração

   ═══ FUNÇÕES EXPORTADAS (globais) ═══
     exportPDF(id)         — PDF da inspeção principal
     exportPDFSub(id)      — PDF da subestação
     exportPDFBatch(ids)   — PDF de múltiplas inspeções (sequencial)

   ═══ DEPENDÊNCIAS ═══
   - report-html.js (deve estar carregado ANTES deste módulo)
     → usa: _gerarHTMLStr(id), _gerarHTMLSubStr(id)
   - state.js → S, US
   - utils.js → fdt
   - photo-store.js → PhotoStore
   - html2pdf.js CDN (carregado dinamicamente se necessário)

   ═══ ORDEM DE CARREGAMENTO (index.html) ═══
   Deve vir DEPOIS de report-html.js:
     <script src="report-html.js"></script>
     <script src="report-pdf.js"></script>
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DO PDF
   ══════════════════════════════════════════════════════════════ */

var PDF_CONFIG = {
  margin:       [8, 8, 12, 8],   /* top, left, bottom, right (mm) */
  image:        { type: 'jpeg', quality: 0.96 },
  html2canvas:  {
    scale:        2,
    useCORS:      true,
    logging:      false,
    windowWidth:  730,
    scrollY:      0,
    allowTaint:   false,
    letterRendering: true
  },
  jsPDF: {
    unit:        'mm',
    format:      'a4',
    orientation: 'portrait',
    compress:    true
  },
  pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
};

/* ══════════════════════════════════════════════════════════════
   CARREGAMENTO DINÂMICO DO html2pdf.js
   ══════════════════════════════════════════════════════════════ */

var _html2pdfLoaded = false;
var _html2pdfLoading = null;

function _ensureHtml2Pdf() {
  /* Já disponível globalmente */
  if (typeof html2pdf === 'function') {
    _html2pdfLoaded = true;
    return Promise.resolve();
  }
  /* Já em carregamento */
  if (_html2pdfLoading) return _html2pdfLoading;

  _html2pdfLoading = new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = function() {
      _html2pdfLoaded = true;
      resolve();
    };
    script.onerror = function() {
      _html2pdfLoading = null;
      reject(new Error('Falha ao carregar html2pdf.js'));
    };
    document.head.appendChild(script);
  });

  return _html2pdfLoading;
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

function _pdfNomeArquivo(i, sufixo) {
  var tipo = (i.tipo || 'REL').toUpperCase();
  var edif = (i.edif || 'EDIF').replace(/[^a-zA-Z0-9]/g, '_');
  var os   = i.os ? '_' + i.os.replace(/[^a-zA-Z0-9]/g, '_') : '';
  var dt   = fdt(i.dtVistoria || i.data).replace(/\//g, '-');
  return 'TJMG_' + tipo + '_' + edif + os + '_' + dt + (sufixo || '') + '.pdf';
}

function _pdfNomeArquivoSub(insp) {
  var tipoSub = (insp.sub || {}).tipo_sub || 'AEREA';
  var com     = (insp.com || 'COMARCA').replace(/[^a-zA-Z0-9]/g, '_');
  var dt      = fdt(insp.data || Date.now()).replace(/\//g, '-');
  return 'Sub_' + tipoSub + '_' + com + '_' + dt + '.pdf';
}

/**
 * Remove botões flutuantes e lightbox do HTML para impressão limpa.
 * Remove scripts (não precisamos executar JS no PDF).
 */
function _limparHTMLParaPDF(htmlStr) {
  /* Remove a barra de botões flutuantes */
  htmlStr = htmlStr.replace(/<div class="btn-bar">[\s\S]*?<\/div>/gi, '');

  /* Remove lightbox */
  htmlStr = htmlStr.replace(/<div id="foto-lb"[\s\S]*?<\/div>\s*<\/div>/gi, '');

  /* Remove scripts (html2pdf, qrcode, funções inline) */
  htmlStr = htmlStr.replace(/<script[\s\S]*?<\/script>/gi, '');

  /* Remove marca d'água para PDF (opcional — descomente se quiser sem) */
  /* htmlStr = htmlStr.replace(/<div class="watermark">[\s\S]*?<\/div>/gi, ''); */

  return htmlStr;
}

/**
 * Renderiza HTML num iframe oculto e converte para PDF.
 * @param {string} htmlStr  - HTML completo do relatório
 * @param {string} nomeArq  - Nome do arquivo PDF
 * @returns {Promise}
 */
function _renderizarPDF(htmlStr, nomeArq) {
  return _ensureHtml2Pdf().then(function() {
    return new Promise(function(resolve, reject) {
      /* Limpa o HTML */
      var htmlLimpo = _limparHTMLParaPDF(htmlStr);

      /* Cria iframe oculto para renderização isolada */
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:730px;height:100vh;border:none;opacity:0;pointer-events:none;';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      /* Escreve o HTML no iframe */
      var iDoc = iframe.contentDocument || iframe.contentWindow.document;
      iDoc.open();
      iDoc.write(htmlLimpo);
      iDoc.close();

      /* Aguarda carregamento de fontes e imagens */
      var _timeout = setTimeout(function() {
        _gerarPDFDoIframe(iframe, nomeArq, resolve, reject);
      }, 2500);

      /* Tenta usar fonts.ready se disponível */
      if (iDoc.fonts && iDoc.fonts.ready) {
        iDoc.fonts.ready.then(function() {
          clearTimeout(_timeout);
          /* Pequeno delay extra para imagens */
          setTimeout(function() {
            _gerarPDFDoIframe(iframe, nomeArq, resolve, reject);
          }, 800);
        }).catch(function() {
          /* Fallback ao timeout já definido */
        });
      }
    });
  });
}

function _gerarPDFDoIframe(iframe, nomeArq, resolve, reject) {
  try {
    var iDoc = iframe.contentDocument || iframe.contentWindow.document;
    var el = iDoc.querySelector('.page');

    if (!el) {
      document.body.removeChild(iframe);
      reject(new Error('Elemento .page não encontrado no relatório.'));
      return;
    }

    /* Injeta html2pdf no iframe */
    var script = iDoc.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = function() {
      try {
        var worker = iframe.contentWindow.html2pdf();
        /* FIX: injeta o config como literal JS no realm do iframe para que
           o array margin seja criado com o Array constructor correto.
           JSON.parse cross-frame ainda pode falhar em html2pdf.js porque
           ele checa obj.constructor === Array (não Array.isArray). */
        var cfgScript = iDoc.createElement('script');
        cfgScript.textContent = 'window._PDFCFG = {'
          + 'margin:[8,8,12,8],'
          + 'image:{type:"jpeg",quality:0.96},'
          + 'html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:730,scrollY:0,allowTaint:false,letterRendering:true},'
          + 'jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},'
          + 'pagebreak:{mode:["avoid-all","css","legacy"]},'
          + 'filename:' + JSON.stringify(nomeArq)
          + '};';
        iDoc.head.appendChild(cfgScript);
        var config = iframe.contentWindow._PDFCFG;

        worker.set(config)
          .from(el)
          .save()
          .then(function() {
            setTimeout(function() {
              if (iframe.parentNode) document.body.removeChild(iframe);
            }, 500);
            resolve();
          })
          .catch(function(err) {
            if (iframe.parentNode) document.body.removeChild(iframe);
            reject(err);
          });
      } catch(e) {
        if (iframe.parentNode) document.body.removeChild(iframe);
        reject(e);
      }
    };
    script.onerror = function() {
      if (iframe.parentNode) document.body.removeChild(iframe);
      reject(new Error('Falha ao carregar html2pdf no iframe.'));
    };
    iDoc.head.appendChild(script);

  } catch(e) {
    if (iframe.parentNode) document.body.removeChild(iframe);
    reject(e);
  }
}

/* ══════════════════════════════════════════════════════════════
   FUNÇÕES PÚBLICAS
   ══════════════════════════════════════════════════════════════ */

/**
 * Exporta PDF de uma inspeção principal.
 * Mesmo design e padrão do exportHTML().
 * @param {string} id - ID da inspeção
 */
function exportPDF(id) {
  try {
    var i = S.insp.find(function(x) { return x.id === id; });
    if (!i) { Tt('Inspeção não encontrada.'); return; }

    /* Redireciona subestação */
    if (i.tipo === 'subestacao') { exportPDFSub(id); return; }

    Tt('Gerando PDF...');

    /* Carrega fotos do IDB se necessário */
    var _hasEmptyFotos = Object.keys(i.itens || {}).some(function(k) {
      return !(i.itens[k].fotos || []).length;
    });

    if (_hasEmptyFotos) {
      PhotoStore.loadForInsp(i)
        .then(function() { _doExportPDF(id); })
        .catch(function(e) { console.warn('Erro fotos PDF:', e); _doExportPDF(id); });
      return;
    }

    _doExportPDF(id);
  } catch(e) {
    console.error('exportPDF erro:', e);
    Tt('Erro ao exportar PDF. Tente novamente.');
  }
}

function _doExportPDF(id) {
  try {
    var i = S.insp.find(function(x) { return x.id === id; });
    if (!i) return;
    if (i.tipo === 'subestacao') { exportPDFSub(id); return; }

    /* Reutiliza a mesma função de geração HTML do report-html.js */
    var htmlStr = _gerarHTMLStr(id);
    if (!htmlStr) { Tt('Erro ao gerar relatório para PDF.'); return; }

    var nomeArq = _pdfNomeArquivo(i);

    _renderizarPDF(htmlStr, nomeArq)
      .then(function() { Tt('✅ PDF exportado com sucesso!'); })
      .catch(function(e) {
        console.error('Erro ao gerar PDF:', e);
        Tt('Erro ao gerar PDF. Tente novamente.');
      });
  } catch(e) {
    console.error('_doExportPDF erro:', e);
    Tt('Erro ao exportar PDF.');
  }
}

/**
 * Exporta PDF de uma subestação.
 * Mesmo design e padrão do exportHTMLSub().
 * @param {string} id - ID da inspeção
 */
function exportPDFSub(id) {
  try {
    var insp = S.insp.find(function(x) { return x.id === id; });
    if (!insp) { Tt('Inspeção não encontrada.'); return; }

    Tt('Gerando PDF da subestação...');

    /* Carrega fotos se necessário */
    var _needsPhotos = insp.sub && (insp.sub.chk || insp.sub.trafos || insp.sub.disjs || insp.sub.secc);
    if (_needsPhotos) {
      PhotoStore.loadSubAll(id, insp.sub)
        .then(function() { _doExportPDFSub(id); })
        .catch(function(e) { console.warn('Erro fotos sub PDF:', e); _doExportPDFSub(id); });
      return;
    }

    _doExportPDFSub(id);
  } catch(e) {
    console.error('exportPDFSub erro:', e);
    Tt('Erro ao exportar PDF da subestação.');
  }
}

function _doExportPDFSub(id) {
  try {
    var insp = S.insp.find(function(x) { return x.id === id; });
    if (!insp) return;

    /* Reutiliza a mesma função de geração HTML do report-html.js */
    var htmlStr = _gerarHTMLSubStr(id);
    if (!htmlStr) { Tt('Erro ao gerar relatório de subestação para PDF.'); return; }

    var nomeArq = _pdfNomeArquivoSub(insp);

    _renderizarPDF(htmlStr, nomeArq)
      .then(function() { Tt('✅ PDF da subestação exportado com sucesso!'); })
      .catch(function(e) {
        console.error('Erro ao gerar PDF sub:', e);
        Tt('Erro ao gerar PDF. Tente novamente.');
      });
  } catch(e) {
    console.error('_doExportPDFSub erro:', e);
    Tt('Erro ao exportar PDF da subestação.');
  }
}

/**
 * Exporta PDFs em lote (sequencial para evitar sobrecarga).
 * @param {string[]} ids - Array de IDs de inspeções
 * @param {number} delay - Delay entre cada PDF em ms (padrão: 1500)
 */
function exportPDFBatch(ids, delay) {
  if (!ids || !ids.length) { Tt('Nenhuma inspeção selecionada.'); return; }
  delay = delay || 1500;
  var total = ids.length;
  var current = 0;

  function _next() {
    if (current >= total) {
      Tt('✅ ' + total + ' PDFs exportados com sucesso!');
      return;
    }
    var id = ids[current];
    var i = S.insp.find(function(x) { return x.id === id; });
    current++;
    Tt('Gerando PDF ' + current + '/' + total + '...');

    if (!i) { setTimeout(_next, 300); return; }

    /* Determina tipo e gera */
    var htmlStr;
    var nomeArq;
    if (i.tipo === 'subestacao') {
      htmlStr = _gerarHTMLSubStr(id);
      nomeArq = _pdfNomeArquivoSub(i);
    } else {
      htmlStr = _gerarHTMLStr(id);
      nomeArq = _pdfNomeArquivo(i);
    }

    if (!htmlStr) { setTimeout(_next, 300); return; }

    _renderizarPDF(htmlStr, nomeArq)
      .then(function() { setTimeout(_next, delay); })
      .catch(function(e) {
        console.warn('Erro PDF lote:', e);
        setTimeout(_next, delay);
      });
  }

  /* Carrega fotos antes de iniciar */
  var _loadPromises = ids.map(function(id) {
    var i = S.insp.find(function(x) { return x.id === id; });
    if (!i) return Promise.resolve();
    if (i.tipo === 'subestacao' && i.sub) {
      return PhotoStore.loadSubAll(id, i.sub).catch(function() {});
    }
    return PhotoStore.loadForInsp(i).catch(function() {});
  });

  Promise.all(_loadPromises)
    .then(function() { _next(); })
    .catch(function() { _next(); });
}

/* ══════════════════════════════════════════════════════════════
   FIM DO MÓDULO report-pdf.js
   ══════════════════════════════════════════════════════════════ */
