'use strict';
/* ============================================================
   TJMG Fiscal PWA — report-html.js  v69
   Fase 3 da modularização: geração de relatórios HTML locais.

   ═══ MELHORIAS v69 vs v68 ═══
   ✅ VISUAL: Tipografia refinada, espaçamentos melhorados,
      gradientes suaves, sombras de profundidade, ícones SVG
   ✅ SUMÁRIO EXECUTIVO: Resumo expandido com gráfico de rosca SVG
   ✅ MARCA D'ÁGUA: "RASCUNHO" diagonal quando st !== 'finalizada'
   ✅ QR CODE: QR Code SVG com protocolo do documento
   ✅ NUMERAÇÃO DE PÁGINAS: Rodapé com contador de páginas (@media print)
   ✅ ÍNDICE: Sumário clicável com âncoras para cada sistema
   ✅ PRINT: Page-breaks inteligentes, headers repetidos em tabelas
   ✅ ROBUSTEZ: try/catch em todos os blocos, fallbacks seguros,
      validação de dados, tratamento de fotos corrompidas
   ✅ PERFORMANCE: Lazy loading de imagens, CSS otimizado

   Funções exportadas (globais):
     exportHTML(id)         — ponto de entrada principal
     exportHTMLSub(id)      — ponto de entrada subestação

   Dependências (globais em index.html):
     S, US, REG, TIPOS, SIS, TCOR, ST, SUB_SECOES,
     PhotoStore, Tt, fdt, oentries, ovals, _spf
   ============================================================ */

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

function _safe(v, fb) { return (v != null && v !== '') ? v : (fb || '—'); }
function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function normProt(s) {
  return (s || '').toUpperCase()
    .replace(/[ÀÁÂÃÄ]/g,'A').replace(/[ÈÉÊË]/g,'E')
    .replace(/[ÌÍÎÏ]/g,'I').replace(/[ÒÓÔÕÖ]/g,'O')
    .replace(/[ÙÚÛÜ]/g,'U').replace(/Ç/g,'C')
    .replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function gerarProtocolo(i) {
  var _dt = (i.dtVistoria || i.data || new Date().toISOString().slice(0,10));
  var _dtFmt = _dt.replace(/-/g,'');
  if (_dtFmt.length === 8 && _dtFmt.indexOf('-') < 0) {
    _dtFmt = _dtFmt.slice(6,8) + _dtFmt.slice(4,6) + _dtFmt.slice(0,4);
  } else {
    try { var _p = fdt(i.dtVistoria || i.data); _dtFmt = _p.replace(/\//g,''); } catch(e) {}
  }
  var _com  = normProt(i.com);
  var _edif = normProt(i.edif);
  var _COMP = ['fachada','spda','prontuario','subestacao'];
  if (_COMP.indexOf(i.tipo) >= 0) return 'RITMP-COMPLEMENTAR-' + _dtFmt + '-' + _com + '-' + _edif;
  if (i.tipo === 'periodica')     return 'RITMP-' + _dtFmt + '-' + _com + '-' + _edif;
  var _osRaw = (i.os || '').trim().toUpperCase();
  var _osNum = _osRaw.replace(/[^0-9]/g,'');
  var _osStr = i.tipo === 'ose'
    ? (_osRaw.startsWith('OSE') ? _osRaw : (_osNum ? 'OSE' + _osNum.padStart(3,'0') : ''))
    : (_osRaw.startsWith('OSP') ? _osRaw : (_osNum ? 'OSP' + _osNum.padStart(3,'0') : ''));
  if (i.tipo === 'ose') return 'RITE-' + _dtFmt + (_osStr ? '-' + _osStr : '') + '-' + _com + '-' + _edif;
  if (i.tipo === 'osp') {
    var _ospN = (i.os || '').trim().toUpperCase().replace(/[^0-9]/g,'');
    var _ospS = _ospN ? 'OSP' + _ospN.padStart(3,'0') : '';
    return 'OSP-' + _dtFmt + (_ospS ? '-' + _ospS : '') + '-' + _com + '-' + _edif;
  }
  return 'RITP-' + _dtFmt + (_osStr ? '-' + _osStr : '') + '-' + _com + '-' + _edif;
}

function gerarTipoLbl(tipo) {
  var _COMP = ['fachada','spda','prontuario','subestacao'];
  if (_COMP.indexOf(tipo) >= 0) return 'RITMP \u2014 COMPLEMENTAR DE MANUTEN\u00c7\u00c3O PERI\u00d3DICA';
  if (tipo === 'periodica')     return 'RITMP \u2014 RELAT\u00d3RIO DE INSPE\u00c7\u00c3O T\u00c9CNICA DE MANUTEN\u00c7\u00c3O PERI\u00d3DICA';
  if (tipo === 'ose')           return 'RITE \u2014 RELAT\u00d3RIO DE INSPE\u00c7\u00c3O T\u00c9CNICA EMERGENCIAL';
  if (tipo === 'osp')           return 'OSP \u2014 ORDEM DE SERVI\u00c7O PROGRAMADA';
  return                               'RITP \u2014 RELAT\u00d3RIO DE INSPE\u00c7\u00c3O T\u00c9CNICA PROGRAMADA';
}

/* ── QR Code SVG (encoder simples para texto curto) ──────── */
function _gerarQRSvg(texto, size) {
  size = size || 100;
  /* QR Code real usando qrcode-generator (carregado no <head> do relatório).
     Fallback visual caso a lib nao esteja disponivel (ex: sem internet). */
  try {
    if (typeof qrcode === 'function') {
      var qr = qrcode(0, 'M'); /* type=0 = auto, correctionLevel=M */
      qr.addData(texto);
      qr.make();
      var mod = qr.getModuleCount();
      var cell = (size / mod).toFixed(4);
      var rects = [];
      for (var row = 0; row < mod; row++) {
        for (var col = 0; col < mod; col++) {
          if (qr.isDark(row, col)) {
            rects.push('<rect x="' + (col * cell).toFixed(1) + '" y="' + (row * cell).toFixed(1)
              + '" width="' + cell + '" height="' + cell + '" fill="#1a2332"/>');
          }
        }
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size
        + '" width="' + size + '" height="' + size
        + '" style="border:1px solid #e2e8f0;border-radius:6px;background:#fff;padding:4px;">'
        + '<rect width="' + size + '" height="' + size + '" fill="#fff"/>'
        + rects.join('')
        + '</svg>';
    }
  } catch(e) { /* cai no fallback abaixo */ }

  /* Fallback: exibe o texto quando a lib nao esta disponivel */
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size
    + '" width="' + size + '" height="' + size
    + '" style="border:1px solid #e2e8f0;border-radius:6px;background:#fff;padding:4px;">'
    + '<rect width="' + size + '" height="' + size + '" fill="#f8fafc"/>'
    + '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" '
    + 'font-size="8" font-family="monospace" fill="#64748b">'
    + _esc(texto.length > 20 ? texto.slice(0,20) + '...' : texto)
    + '</text></svg>';
}

/* ── Gráfico de rosca SVG ────────────────────────────────── */
function _gerarDonutSvg(pct, cor, size) {
  size = size || 80;
  var r = 32, cx = size/2, cy = size/2, circ = 2 * Math.PI * r;
  var dashLen = circ * pct / 100;
  var dashGap = circ - dashLen;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="8"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="8"'
    + ' stroke-dasharray="' + dashLen.toFixed(1) + ' ' + dashGap.toFixed(1) + '"'
    + ' stroke-linecap="round" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
    + '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-size="16" font-weight="800" fill="' + cor + '">'
    + pct + '%</text></svg>';
}

/* ── CSS compartilhado (base) ────────────────────────────── */
function _cssBase(tipoCorHex) {
  return [
    '*{box-sizing:border-box;margin:0;padding:0;}',
    'body{font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;background:#eef1f6;color:#1a2332;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}',

    /* Botões flutuantes */
    '.btn-bar{position:fixed;bottom:28px;right:28px;z-index:999;display:flex;flex-direction:column;gap:10px;align-items:flex-end;}',
    '.print-btn{background:' + tipoCorHex + ';color:#fff;border:none;border-radius:12px;padding:13px 22px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;letter-spacing:.3px;white-space:nowrap;transition:transform .15s,box-shadow .15s;}',
    '.print-btn:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(0,0,0,.3);}',
    '.pdf-btn{background:#1a2332;color:#fff;border:none;border-radius:12px;padding:13px 22px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;letter-spacing:.3px;white-space:nowrap;transition:transform .15s,box-shadow .15s;}',
    '.pdf-btn:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(0,0,0,.3);}',
    '.pdf-btn:disabled{opacity:.6;cursor:wait;transform:none;}',

    /* Layout */
    '.page{width:730px;max-width:730px;margin:24px auto;background:#fff;box-shadow:0 4px 40px rgba(0,0,0,.10),0 0 0 1px rgba(0,0,0,.04);word-break:break-word;border-radius:6px;overflow:hidden;position:relative;}',

    /* Marca d'água */
    '.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(220,38,38,.06);letter-spacing:20px;pointer-events:none;z-index:1;white-space:nowrap;user-select:none;}',

    /* Topo institucional */
    '.topo{background:' + tipoCorHex + ';padding:0;overflow:hidden;position:relative;}',
    '.topo::after{content:"";position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(to top,rgba(0,0,0,.12),transparent);pointer-events:none;}',
    '.topo-strip{height:5px;background:linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.08));}',
    '.topo-body{padding:18px 22px 16px;display:flex;align-items:center;gap:14px;position:relative;z-index:2;}',
    '.topo-brasao{width:48px;height:48px;min-width:48px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;backdrop-filter:blur(4px);}',
    '.topo-inst{flex:1;min-width:0;overflow:hidden;}',
    '.topo-estado{font-size:8px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:3px;}',
    '.topo-nome{font-size:15px;font-weight:800;color:#fff;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,.15);}',
    '.topo-sub{font-size:9px;color:rgba(255,255,255,.65);margin-top:3px;letter-spacing:.3px;}',
    '.topo-doc{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 10px;text-align:right;flex-shrink:0;max-width:210px;min-width:0;backdrop-filter:blur(4px);}',
    '.doc-label{font-size:8px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.55);}',
    '.doc-num{font-family:"JetBrains Mono","Fira Code",monospace;font-size:8px;font-weight:600;color:#fff;margin-top:3px;word-break:break-all;line-height:1.5;}',

    /* Faixa tipo */
    '.tipo-faixa{background:#1a2332;padding:8px 22px;display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden;}',
    '.tipo-badge{background:' + tipoCorHex + ';color:#fff;border-radius:5px;padding:4px 12px;font-size:10px;font-weight:700;letter-spacing:.4px;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.2);}',
    '.tipo-data{font-size:9px;color:rgba(255,255,255,.45);font-family:"JetBrains Mono","Fira Code",monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    /* Corpo */
    '.corpo{padding:28px;position:relative;z-index:2;}',

    /* Sumário executivo */
    '.sumario{background:linear-gradient(135deg,#f8fafc,#f0f4f9);border:1px solid #dde3ec;border-radius:12px;padding:20px 24px;margin-bottom:28px;display:flex;gap:24px;align-items:center;}',
    '.sumario-info{flex:1;}',
    '.sumario-title{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:12px;}',
    '.sumario-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}',
    '.sumario-item{font-size:12px;color:#475569;display:flex;align-items:center;gap:6px;}',
    '.sumario-item b{color:#1a2332;font-weight:700;}',
    '.sumario-donut{flex-shrink:0;text-align:center;}',
    '.sumario-donut-label{font-size:9px;color:#94a3b8;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-top:6px;}',

    /* Índice */
    '.indice{border:1px solid #dde3ec;border-radius:10px;overflow:hidden;margin-bottom:28px;}',
    '.indice-title{background:#f0f4f9;padding:10px 18px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;display:flex;align-items:center;gap:8px;}',
    '.indice-body{padding:8px 0;}',
    '.indice-item{display:flex;align-items:center;gap:10px;padding:6px 18px;text-decoration:none;color:#1a2332;font-size:12px;transition:background .1s;}',
    '.indice-item:hover{background:#f8fafc;}',
    '.indice-num{background:#e2e8f0;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:800;color:#64748b;flex-shrink:0;min-width:28px;text-align:center;}',
    '.indice-nome{flex:1;font-weight:600;}',
    '.indice-badges{display:flex;gap:4px;}',
    '.indice-ok{background:#dcfce7;color:#16a34a;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700;}',
    '.indice-nc{background:#fee2e2;color:#dc2626;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700;}',

    /* Ficha técnica */
    '.ficha{border:1px solid #dde3ec;border-radius:12px;overflow:hidden;margin-bottom:28px;box-shadow:0 1px 4px rgba(0,0,0,.04);}',
    '.ficha-title{background:linear-gradient(135deg,#f0f4f9,#e8ecf4);padding:11px 18px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #dde3ec;display:flex;align-items:center;gap:8px;}',
    '.ficha-grid{display:grid;grid-template-columns:repeat(2,1fr);}',
    '.ficha-item{padding:13px 18px;border-right:1px solid #eef1f6;border-bottom:1px solid #eef1f6;}',
    '.ficha-item:nth-child(2n){border-right:none;}',
    '.ficha-label{font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px;}',
    '.ficha-val{font-size:13px;font-weight:600;color:#1a2332;}',
    '.ficha-val.mono{font-family:"JetBrains Mono","Fira Code",monospace;font-size:12px;color:' + tipoCorHex + ';}',

    /* QR Code + Protocolo lateral */
    '.qr-bar{display:flex;align-items:center;gap:14px;padding:14px 18px;background:#fafbfc;border:1px solid #eef1f6;border-radius:10px;margin-bottom:24px;}',
    '.qr-info{flex:1;}',
    '.qr-info-label{font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;}',
    '.qr-info-val{font-family:"JetBrains Mono","Fira Code",monospace;font-size:11px;font-weight:600;color:#1a2332;word-break:break-all;line-height:1.5;}',

    /* KPIs */
    '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;}',
    '.kpi{border-radius:12px;padding:14px 16px;border:1px solid #dde3ec;position:relative;overflow:hidden;}',
    '.kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;}',
    '.kpi-num{font-size:28px;font-weight:800;line-height:1;margin-bottom:5px;}',
    '.kpi-lbl{font-size:10px;font-weight:600;letter-spacing:.5px;color:#64748b;}',
    '.kpi-total{background:linear-gradient(135deg,#1a2332,#2d3748);border-color:#1a2332;}.kpi-total .kpi-num,.kpi-total .kpi-lbl{color:#fff;}',
    '.kpi-total::before{background:rgba(255,255,255,.2);}',
    '.kpi-ok{background:linear-gradient(135deg,#f0fdf4,#ecfce5);border-color:#bbf7d0;}.kpi-ok .kpi-num{color:#16a34a;}.kpi-ok::before{background:#16a34a;}',
    '.kpi-nc{background:linear-gradient(135deg,#fff1f2,#ffe4e6);border-color:#fecdd3;}.kpi-nc .kpi-num{color:#dc2626;}.kpi-nc::before{background:#dc2626;}',
    '.kpi-pend{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fde68a;}.kpi-pend .kpi-num{color:#d97706;}.kpi-pend::before{background:#d97706;}',
    '.kpi-amb{background:linear-gradient(135deg,#fff7ed,#ffedd5);border-color:#fed7aa;}.kpi-amb .kpi-num{color:#ea580c;}.kpi-amb::before{background:#ea580c;}',

    /* Barra progresso */
    '.prog-wrap{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #dde3ec;border-radius:12px;padding:18px 22px;margin-bottom:28px;}',
    '.prog-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}',
    '.prog-title{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;}',
    '.prog-pct{font-size:24px;font-weight:800;}',
    '.prog-track{height:10px;background:#e2e8f0;border-radius:20px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.08);}',
    '.prog-fill{height:100%;border-radius:20px;transition:width .6s ease;box-shadow:0 2px 8px rgba(0,0,0,.15);}',

    /* Painel OSE */
    '.osp-panel{background:linear-gradient(135deg,#f8fafc,#f0f4f9);border:1px solid #dde3ec;border-radius:12px;padding:20px 24px;margin-bottom:28px;}',
    '.osp-title{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:16px;}',
    '.osp-num{font-family:"JetBrains Mono","Fira Code",monospace;font-size:24px;font-weight:700;color:' + tipoCorHex + ';margin-bottom:14px;}',
    '.osp-desc{font-size:12px;color:#1a2332;line-height:1.8;background:#fff;border-radius:10px;padding:14px 18px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04);}',
    '.sist-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;}',
    '.sist-chip{background:#fff;color:' + tipoCorHex + ';border:1px solid ' + tipoCorHex + '33;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.04);}',

    /* Seções checklist */
    '.sec-titulo{background:linear-gradient(135deg,#1a2332,#2d3748);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:10px;margin-top:28px;border-radius:10px 10px 0 0;}',
    '.sec-titulo-txt{font-size:14px;font-weight:700;flex:1;}',
    '.sec-count{font-size:10px;background:rgba(255,255,255,.12);border-radius:20px;padding:4px 12px;backdrop-filter:blur(4px);}',
    '.secao{margin-bottom:0;break-inside:avoid-page;}',
    '.sec-hdr{padding:10px 18px;display:flex;align-items:center;gap:10px;border-top:2px solid #e2e8f0;background:linear-gradient(135deg,#fafbfc,#f0f4f9);}',
    '.sec-hdr-inner{flex:1;}',
    '.sec-hdr-nm{font-size:13px;font-weight:700;color:#1a2332;}',
    '.sec-hdr-num{background:' + tipoCorHex + ';color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:800;margin-right:6px;display:inline-block;}',
    '.sec-badges{display:flex;gap:4px;flex-shrink:0;}',
    '.sbdg{border-radius:10px;padding:3px 10px;font-size:11px;font-weight:700;}',
    '.sbdg-ok{background:#dcfce7;color:#16a34a;}',
    '.sbdg-nc{background:#fee2e2;color:#dc2626;}',

    /* Tabelas */
    '.check-table{width:100%;border-collapse:collapse;}',
    '.check-table thead{background:linear-gradient(135deg,#f8fafc,#f0f4f9);}',
    '.check-table thead tr{break-inside:avoid;}',
    '.th-n{padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #dde3ec;text-align:left;width:50px;}',
    '.th-d{padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #dde3ec;text-align:left;}',
    '.th-s{padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #dde3ec;text-align:center;width:110px;}',
    '.item-row{border-bottom:1px solid #f1f5f9;vertical-align:top;break-inside:avoid;}',
    '.item-row:nth-child(even){background:#fafbfc;}',
    '.row-nc{background:#fff8f8!important;border-left:3px solid #dc2626;}',
    '.td-n{padding:10px 12px;font-size:12px;font-weight:700;color:#94a3b8;vertical-align:top;}',
    '.td-d{padding:10px 12px;font-size:12px;vertical-align:top;}',
    '.td-s{padding:10px 12px;text-align:center;vertical-align:top;}',
    '.item-nm{font-weight:600;margin-bottom:4px;color:#1a2332;line-height:1.4;}',
    '.obs-blk{font-size:11px;color:#475569;margin-top:6px;padding:6px 10px;background:#f8fafc;border-left:3px solid #94a3b8;border-radius:0 6px 6px 0;line-height:1.6;}',
    '.st-badge{padding:4px 10px;border-radius:8px;font-size:10px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;}',
    '.st-ok{background:#dcfce7;color:#15803d;}.st-nc{background:#fee2e2;color:#b91c1c;}.st-na{background:#f1f5f9;color:#64748b;}',
    '.st-pend{background:#fef3c7;color:#92400e;}.st-fp{background:#fef3c7;color:#92400e;}.st-prog{background:#ede9fe;color:#6d28d9;}',

    /* Materiais */
    '.mat-blk{font-size:11px;color:#475569;margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;}',
    '.mat-tag{background:#f0f4f9;border:1px solid #dde3ec;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;}',
    '.mat-sec{margin-top:28px;border:1px solid #dde3ec;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);}',
    '.mat-sec-hdr{padding:12px 18px;font-size:13px;font-weight:700;border-bottom:1px solid #dde3ec;background:linear-gradient(135deg,#f0f4f9,#e8ecf4);}',
    '.mat-table{width:100%;border-collapse:collapse;}',
    '.mat-table th{padding:8px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:2px solid #dde3ec;background:#fafbfc;}',
    '.mat-even{background:#fff;}.mat-odd{background:#fafbfc;}',
    '.mat-cod{padding:8px 14px;font-family:"JetBrains Mono","Fira Code",monospace;font-size:11px;font-weight:600;color:' + tipoCorHex + ';}',
    '.mat-desc{padding:8px 14px;font-size:12px;}.mat-qty{padding:8px 14px;font-size:12px;font-weight:700;text-align:right;}',
    '.mat-un{padding:8px 14px;font-size:11px;color:#64748b;text-align:center;}',

    /* Fotos */
    '.foto-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:8px 0;}',
    '.foto-item{display:flex;flex-direction:column;border-radius:10px;overflow:hidden;border:1px solid #dde3ec;background:#f8fafc;cursor:zoom-in;transition:transform .15s,box-shadow .15s;break-inside:avoid;}',
    '.foto-item:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.1);}',
    '.foto-item img{width:100%;height:130px;object-fit:cover;display:block;}',
    '.foto-item figcaption{font-size:10px;color:#64748b;padding:5px 10px;text-align:center;background:#fff;border-top:1px solid #eef1f6;}',
    '.foto-err{width:100%;height:130px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;}',

    /* Lightbox */
    '#foto-lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(4px);}',
    '#foto-lb.open{display:flex;}',
    '#foto-lb img{max-width:94vw;max-height:90vh;border-radius:12px;box-shadow:0 10px 60px rgba(0,0,0,.5);}',
    '#foto-lb-cap{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);color:#fff;padding:8px 24px;border-radius:24px;font-size:13px;pointer-events:none;white-space:nowrap;backdrop-filter:blur(8px);}',

    /* Assinatura */
    '.ass-wrap{margin-top:48px;padding-top:28px;border-top:2px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:24px;}',
    '.ass-box{flex:1;min-width:200px;}',
    '.ass-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:18px;}',
    '.ass-linha{border-top:1px solid #64748b;margin:44px 0 10px;}',
    '.ass-nome{font-size:13px;font-weight:700;color:#1a2332;}',
    '.ass-cargo{font-size:11px;color:#64748b;margin-top:3px;}',
    '.ass-mat{font-family:"JetBrains Mono","Fira Code",monospace;font-size:10px;color:#94a3b8;margin-top:3px;}',

    /* Rodapé */
    '.rodape-rit{margin-top:36px;padding:16px 22px;background:linear-gradient(135deg,#f8fafc,#f0f4f9);border-top:2px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;line-height:1.8;border-radius:0 0 6px 6px;}',

    /* Impressão */
    '@page{size:A4 portrait;margin:12mm 10mm 16mm 10mm;}',
    '@media print{',
    'html,body{height:auto!important;overflow:visible!important;background:#fff!important;margin:0!important;padding:0!important;}',
    '.btn-bar{display:none!important;}#foto-lb{display:none!important;}',
    '.page{width:100%!important;max-width:100%!important;box-shadow:none!important;margin:0!important;border-radius:0!important;}',
    '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '.ficha,.ficha-item,.kpi,.ass-box,.prog-wrap,.sec-hdr,.sumario,.qr-bar,.indice{break-inside:avoid;}',
    '.secao{break-inside:avoid-page;}',
    '.foto-item{break-inside:avoid;page-break-inside:avoid;}',
    '.foto-item:hover{transform:none;box-shadow:none;}',
    '.check-table{break-inside:auto;}',
    '.check-table thead{display:table-header-group;}',
    '.item-row{break-inside:avoid;page-break-inside:avoid;}',
    '.foto-grid{grid-template-columns:repeat(3,1fr)!important;}',
    '.foto-item img{height:85px!important;}',
    '.corpo{padding:16px!important;}',
    '.watermark{font-size:70px!important;}',
    '.rodape-page{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:#94a3b8;padding:4px;}',
    '}'
  ].join('\n');
}

/* ── Script inline para o HTML exportado ─────────────────── */
function _inlineScript() {
  return 'function abrirLB(fig){'
    + 'var img=fig.querySelector("img");if(!img)return;'
    + 'var cap=fig.querySelector("figcaption");'
    + 'var lbImg=document.getElementById("foto-lb-img");'
    + 'if(lbImg)lbImg.src=img.src;'
    + 'var lbCap=document.getElementById("foto-lb-cap");'
    + 'if(lbCap)lbCap.textContent=cap?cap.textContent:"";'
    + 'var lb=document.getElementById("foto-lb");'
    + 'if(lb)lb.classList.add("open");'
    + '}'
    + 'function fecharLB(){var lb=document.getElementById("foto-lb");if(lb)lb.classList.remove("open");}'
    + 'document.addEventListener("keydown",function(e){if(e.key==="Escape")fecharLB();});'
    + 'function gerarPDF(btn){'
    + 'if(!btn)return;btn.disabled=true;btn.textContent="Gerando PDF...";'
    + 'var bar=document.querySelector(".btn-bar");if(bar)bar.style.display="none";'
    + 'var lb=document.getElementById("foto-lb");if(lb)lb.style.display="none";'
    + 'var wm=document.querySelector(".watermark");if(wm)wm.style.display="none";'
    + 'var el=document.querySelector(".page");if(!el){btn.disabled=false;btn.textContent="\\uD83D\\uDCC4 Exportar PDF A4";return;}'
    + 'var nomeArq=(document.title||"relatorio").replace(/[^a-zA-Z0-9_\\-]/g,"_")+".pdf";'
    + 'html2pdf().set({'
    + 'margin:8,'
    + 'filename:nomeArq,'
    + 'image:{type:"jpeg",quality:0.96},'
    + 'html2canvas:{scale:2,useCORS:true,logging:false,windowWidth:730,scrollY:0,allowTaint:false},'
    + 'jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},'
    + 'pagebreak:{mode:["avoid-all","css","legacy"]}'
    + '}).from(el).save()'
    + '.then(function(){btn.disabled=false;btn.textContent="\\uD83D\\uDCC4 Exportar PDF A4";if(bar)bar.style.display="";if(wm)wm.style.display="";})'
    + '.catch(function(e){console.warn("PDF error:",e);btn.disabled=false;btn.textContent="\\uD83D\\uDCC4 Exportar PDF A4";if(bar)bar.style.display="";if(wm)wm.style.display="";});'
    + '}'
    /* Tratamento de imagens corrompidas */
    + 'document.querySelectorAll(".foto-item img").forEach(function(img){'
    + 'img.onerror=function(){this.style.display="none";'
    + 'var d=document.createElement("div");d.className="foto-err";d.textContent="Foto indisponível";'
    + 'this.parentNode.insertBefore(d,this);};'
    + '});';
}

/* ══════════════════════════════════════════════════════════════
   RELATÓRIO PRINCIPAL
   ══════════════════════════════════════════════════════════════ */

function exportHTML(id) {
  try {
    var i = S.insp.find(function(x){ return x.id === id; }); if (!i) { Tt('Inspeção não encontrada.'); return; }
    if (i.tipo === 'subestacao') { exportHTMLSub(id); return; }
    /* Carrega fotos do IDB se necessário */
    var _hasEmptyFotos = Object.keys(i.itens || {}).some(function(k){ return !(i.itens[k].fotos || []).length; });
    if (_hasEmptyFotos) {
      Tt('Carregando fotos...');
      PhotoStore.loadForInsp(i).then(function(){ _doExportHTML(id); }).catch(function(e){ console.warn('Erro fotos:', e); _doExportHTML(id); });
      return;
    }
    _doExportHTML(id);
  } catch(e) {
    console.error('exportHTML erro:', e);
    Tt('Erro ao exportar relatório. Tente novamente.');
  }
}

function _gerarHTMLStr(id) {
  try {
    var i = S.insp.find(function(x){ return x.id === id; }); if (!i) return null;
    if (i.tipo === 'subestacao') return null;

    var t     = TIPOS[i.tipo] || TIPOS.periodica;
    var _osp  = i.tipo === 'ose' || i.tipo === 'programada' || i.tipo === 'osp';
    var _ativSelKeys = i.ativSel || {};
    var _hasSel = _osp && Object.keys(_ativSelKeys).some(function(k){ return !!_ativSelKeys[k]; });

    var its = oentries(i.itens || {}).filter(function(e){
      if (!_osp) return true;
      if (!_hasSel) return e[1].s !== 'nao_aplicavel';
      var _aid = e[0].replace(/^[^_]*_/,'');
      return !!_ativSelKeys[_aid];
    }).map(function(e){ return e[1]; });

    /* ── Estatísticas ── */
    var stats = { total:0,exec:0,nexec:0,conf:0,nc:0,na:0,pend:0,emexec:0,fp:0,prog:0,fotos:0,mats:0 };
    stats.total = its.length;
    its.forEach(function(it){
      var s = it.s || 'pendente';
      if (s==='executado')        stats.exec++;
      else if (s==='nao_executado') stats.nexec++;
      else if (s==='conforme')    stats.conf++;
      else if (s==='nao_conforme') stats.nc++;
      else if (s==='nao_aplicavel') stats.na++;
      else if (s==='pendente')    stats.pend++;
      else if (s==='em_execucao') stats.emexec++;
      else if (s==='fora_periodo') stats.fp++;
      else if (s==='programado')  stats.prog++;
      if (it.fotos && it.fotos.length) stats.fotos += it.fotos.length;
      /* stats.mats é derivado de _matsC após consolidação — não contar aqui */
    });
    /* stats.mats será atribuído abaixo, após _matsC ser calculado */

    var _isOse  = i.tipo === 'ose';
    var _pct    = _isOse
      ? (stats.total ? Math.round(stats.exec  / stats.total * 100) : 0)
      : (stats.total ? Math.round(stats.conf  / stats.total * 100) : 0);
    var _pctCor = _pct >= 80 ? '#15803d' : _pct >= 50 ? '#d97706' : '#b91c1c';
    var _pctG   = _pct >= 80 ? '#15803d,#22c55e' : _pct >= 50 ? '#b45309,#f59e0b' : '#b91c1c,#ef4444';

    /* ── Monta seções do checklist ── */
    var sim = {};
    its.forEach(function(v){
      var k = v.sk || '?';
      if (!sim[k]) sim[k] = { n: v.sn || '', nn: v.snn || '', its: [] };
      sim[k].its.push(v);
    });

    var _sIco = {
      conforme:'✅', nao_conforme:'❌', nao_aplicavel:'➖', pendente:'⏳',
      fora_periodo:'🔄', programado:'📋', executado:'✅', nao_executado:'❌', em_execucao:'⚙️'
    };
    var _sCls = {
      conforme:'st-ok', nao_conforme:'st-nc', nao_aplicavel:'st-na', pendente:'st-pend',
      fora_periodo:'st-fp', programado:'st-prog', executado:'st-ok', nao_executado:'st-nc', em_execucao:'st-prog'
    };

    /* ── ÍNDICE ── */
    var indiceHtml = '<div class="indice"><div class="indice-title">📑 Índice de Sistemas</div><div class="indice-body">';
    var secIdx = 0;
    Object.keys(sim).forEach(function(sk){
      var s = sim[sk];
      secIdx++;
      var sPos = _osp
        ? s.its.filter(function(x){ return x.s === 'executado'; }).length
        : s.its.filter(function(x){ return x.s === 'conforme'; }).length;
      var sNeg = _osp
        ? s.its.filter(function(x){ return x.s === 'nao_executado'; }).length
        : s.its.filter(function(x){ return x.s === 'nao_conforme'; }).length;
      indiceHtml += '<a class="indice-item" href="#sec-' + sk + '">'
        + '<span class="indice-num">' + (s.nn || secIdx) + '</span>'
        + '<span class="indice-nome">' + _esc(s.n) + '</span>'
        + '<span class="indice-badges">'
        + (sPos ? '<span class="indice-ok">' + sPos + ' ✅</span>' : '')
        + (sNeg ? '<span class="indice-nc">' + sNeg + ' ❌</span>' : '')
        + '</span></a>';
    });
    indiceHtml += '</div></div>';

    /* ── Seções ── */
    var secoes = '';
    Object.keys(sim).forEach(function(sk){
      var s    = sim[sk];
      var sPos = _osp
        ? s.its.filter(function(x){ return x.s === 'executado'; }).length
        : s.its.filter(function(x){ return x.s === 'conforme'; }).length;
      var sNeg = _osp
        ? s.its.filter(function(x){ return x.s === 'nao_executado'; }).length
        : s.its.filter(function(x){ return x.s === 'nao_conforme'; }).length;

      var linhas = s.its.map(function(it){
        var stv  = ST[it.s || 'pendente'] || ST.pendente;
        var sIco = _sIco[it.s || 'pendente'] || '⏳';
        var sC   = _sCls[it.s || 'pendente'] || 'st-pend';

        var fotosHtml = '';
        if (it.fotos && it.fotos.length) {
          fotosHtml = '<div class="foto-grid">';
          it.fotos.forEach(function(f){
            if (!f || !f.b64) return;
            fotosHtml += '<figure class="foto-item" onclick="abrirLB(this)">'
              + '<img src="' + f.b64 + '" alt="' + _esc(f.leg || 'Foto') + '" loading="lazy">'
              + '<figcaption>' + _esc(f.leg || '') + '</figcaption></figure>';
          });
          fotosHtml += '</div>';
        }

        var matsHtml = '';
        if (it.mats && it.mats.length) {
          matsHtml = '<div class="mat-blk">🔧 '
            + it.mats.map(function(m){ return '<span class="mat-tag">' + _esc(m.d) + ' &times;' + m.q + ' ' + _esc(m.u) + '</span>'; }).join('')
            + '</div>';
        }
        var obsHtml = it.obs ? '<div class="obs-blk">💬 ' + _esc(it.obs) + '</div>' : '';

        return '<tr class="item-row ' + (it.s === 'nao_conforme' || it.s === 'nao_executado' ? 'row-nc' : '') + '">'
          + '<td class="td-n">' + _safe(it.n, '') + '</td>'
          + '<td class="td-d"><div class="item-nm">' + _safe(it.nm, '') + '</div>' + obsHtml + fotosHtml + matsHtml + '</td>'
          + '<td class="td-s"><span class="st-badge ' + sC + '">' + sIco + ' ' + stv.l + '</span></td>'
          + '</tr>';
      }).join('');

      secoes += '<div class="secao" id="sec-' + sk + '">'
        + '<div class="sec-hdr"><div class="sec-hdr-inner">'
        + '<div class="sec-hdr-nm"><span class="sec-hdr-num">' + (s.nn || '') + '</span> ' + _esc(s.n) + '</div>'
        + '</div>'
        + '<div class="sec-badges">'
        + (sPos ? '<span class="sbdg sbdg-ok">' + sPos + ' ✅</span>' : '')
        + (sNeg ? '<span class="sbdg sbdg-nc">' + sNeg + ' ❌</span>' : '')
        + '</div></div>'
        + '<table class="check-table"><thead><tr>'
        + '<th class="th-n">Nº</th>'
        + '<th class="th-d">Item / Observações / Registros</th>'
        + '<th class="th-s">Status</th>'
        + '</tr></thead><tbody>' + linhas + '</tbody></table>'
        + '</div>';
    });

    /* ── Painel OSE / Programada ── */
    var ospPanel = '';
    if (_osp && (i.os || i.descricao || (i.sistemas && i.sistemas.length))) {
      ospPanel = '<div class="osp-panel">'
        + '<div class="osp-title">📋 '
        + (i.tipo==='ose' ? 'Dados da Emergência' : i.tipo==='osp' ? 'Ordem de Serviço Programada — Abertura' : 'Dados da OS Programada')
        + '</div>'
        + (i.os ? '<div class="osp-num">' + (i.tipo==='ose'?'OSE':'OSP') + ' ' + _esc(i.os) + '</div>' : '')
        + (i.descricao ? '<div class="osp-desc">' + _esc(i.descricao) + '</div>' : '')
        + ((i.sistemas && i.sistemas.length)
            ? '<div class="sist-chips">'
              + i.sistemas.map(function(sid){
                  var _s = SIS.find(function(x){ return x.id === sid; });
                  return _s ? '<span class="sist-chip">' + _s.n + ' ' + _esc(_s.nm) + '</span>' : '';
                }).join('')
              + '</div>'
            : '')
        + '</div>';
    }

    /* ── Materiais consolidados ── */
    /* ── Materiais consolidados: usa i.mats (já sincronizado pelo app) como
       fonte única. Só cai nos itens como fallback se i.mats estiver vazio,
       evitando assim a dupla contagem que ocorria ao somar as duas fontes. ── */
    var _matsMap = {};
    if (i.mats && i.mats.length) {
      (i.mats).forEach(function(m){
        if (!m || !m.c) return;
        if (_matsMap[m.c]) _matsMap[m.c].q = parseFloat(_matsMap[m.c].q || 0) + parseFloat(m.q || 0);
        else               _matsMap[m.c] = { c:m.c, d:m.d, u:m.u, q:parseFloat(m.q || 0) };
      });
    } else {
      /* fallback: relatório gerado sem etapa Materiais concluída */
      ovals(i.itens || {}).forEach(function(it){
        (it.mats || []).forEach(function(m){
          if (!m || !m.c) return;
          if (_matsMap[m.c]) _matsMap[m.c].q = parseFloat(_matsMap[m.c].q || 0) + parseFloat(m.q || 0);
          else               _matsMap[m.c] = { c:m.c, d:m.d, u:m.u, q:parseFloat(m.q || 0) };
        });
      });
    }
    var _matsC = Object.keys(_matsMap).map(function(k){ return _matsMap[k]; });
    stats.mats = _matsC.length; /* contagem única, sem dupla contagem */
    var matsGerais = '';
    if (_matsC.length) {
      matsGerais = '<div class="mat-sec">'
        + '<div class="mat-sec-hdr">🔧 Materiais e Peças Utilizadas <span style="font-size:11px;font-weight:400;opacity:.7;">' + _matsC.length + ' item(ns)</span></div>'
        + '<table class="mat-table"><thead><tr><th>Código</th><th>Descrição</th><th style="text-align:right;">Qtd</th><th style="text-align:center;">Un.</th></tr></thead><tbody>'
        + _matsC.map(function(m, ix){
            var _q = parseFloat(m.q || 0);
            var _qs = Number.isInteger(_q) ? _q : parseFloat(_q.toFixed(2));
            return '<tr class="' + (ix%2===0 ? 'mat-even' : 'mat-odd') + '">'
              + '<td class="mat-cod">'  + _esc(m.c)  + '</td>'
              + '<td class="mat-desc">' + _esc(m.d)  + '</td>'
              + '<td class="mat-qty">'  + _qs  + '</td>'
              + '<td class="mat-un">'   + _esc(m.u)  + '</td></tr>';
          }).join('')
        + '</tbody></table></div>';
    }

    /* ── Metadados ── */
    var geradoEm    = new Date().toLocaleString('pt-BR', { dateStyle:'full', timeStyle:'short' });
    var _dataVist   = i.dtVistoria || i.data;
    var numDoc      = i.protocolo || gerarProtocolo(i);
    var tipoLbl     = gerarTipoLbl(i.tipo);
    var tipoCorHex  = TCOR[i.tipo] || '#003580';
    var fiscalNome  = _safe(i.fiscal || (S.sessao && S.sessao.nome));
    var fiscalCargo = (S.sessao && S.sessao.cargo)
      ? S.sessao.cargo + ' – TJMG / COMAP-GEMAP-DENGEP'
      : 'Fiscal de Contrato – TJMG / COMAP-GEMAP-DENGEP';
    var regLbl = i.reg && REG[i.reg] ? 'Região ' + REG[i.reg].l : '';

    var css = _cssBase(tipoCorHex);
    var isRascunho = i.st !== 'finalizada';

    /* ── KPIs ── */
    var kpisHtml = '';
    if (_osp) {
      kpisHtml = '<div class="kpi kpi-total"><div class="kpi-num">' + stats.total + '</div><div class="kpi-lbl">Total</div></div>'
        + '<div class="kpi kpi-ok"><div class="kpi-num">' + stats.exec + '</div><div class="kpi-lbl">✅ Executados</div></div>'
        + '<div class="kpi kpi-nc"><div class="kpi-num">' + stats.nexec + '</div><div class="kpi-lbl">❌ Não Exec.</div></div>'
        + '<div class="kpi kpi-pend"><div class="kpi-num">' + (stats.pend + stats.emexec) + '</div><div class="kpi-lbl">⏳ Pendentes</div></div>';
    } else {
      kpisHtml = '<div class="kpi kpi-total"><div class="kpi-num">' + stats.total + '</div><div class="kpi-lbl">Total</div></div>'
        + '<div class="kpi kpi-ok"><div class="kpi-num">' + stats.conf + '</div><div class="kpi-lbl">✅ Conformes</div></div>'
        + '<div class="kpi kpi-nc"><div class="kpi-num">' + stats.nc + '</div><div class="kpi-lbl">❌ Não Conf.</div></div>'
        + '<div class="kpi kpi-pend"><div class="kpi-num">' + (stats.pend + stats.na + stats.fp) + '</div><div class="kpi-lbl">⏳ Outros</div></div>';
    }

    /* ── Assinatura ── */
    /* Para RITMP/RITE/RITP: só fiscais da região (sem gestor de contrato).
       Para outros tipos: fiscal responsável + demais + gestor. */
    var _isRITxx = (i.tipo === 'periodica' || i.tipo === 'ose' || i.tipo === 'programada');
    var _outrosFiscais = (typeof US !== 'undefined' ? US : []).filter(function(u) {
      return u.ativo && u.reg === i.reg && u.nome !== fiscalNome;
    });
    var _outrosAssHtml = _outrosFiscais.map(function(u) {
      return '<div class="ass-box"><div class="ass-title">Fiscal da Região</div>'
        + '<div class="ass-linha"></div>'
        + '<div class="ass-nome">' + _safe(u.nome) + '</div>'
        + '<div class="ass-cargo">' + _safe(u.cargo || 'Fiscal de Contrato – TJMG / COMAP-GEMAP-DENGEP') + '</div>'
        + (u.mat ? '<div class="ass-mat">Mat. ' + _safe(u.mat) + '</div>' : '')
        + '</div>';
    }).join('');
    var _gestorBox = _isRITxx ? '' :
        '<div class="ass-box"><div class="ass-title">Gestor de Contrato</div>'
      + '<div class="ass-linha"></div>'
      + '<div class="ass-nome">________________________________</div>'
      + '<div class="ass-cargo">Gestor de Contrato — TJMG / COMAP-GEMAP-DENGEP</div>'
      + '</div>';
    var assHtml = '<div class="ass-wrap">'
      + '<div class="ass-box"><div class="ass-title">Fiscal Responsável</div>'
      + '<div class="ass-linha"></div>'
      + '<div class="ass-nome">' + fiscalNome + '</div>'
      + '<div class="ass-cargo">' + fiscalCargo + '</div>'
      + (i.mat ? '<div class="ass-mat">Mat. ' + i.mat + '</div>' : '')
      + '</div>'
      + _outrosAssHtml
      + _gestorBox
      + '</div>';

    /* ── Sumário Executivo ── */
    var sumarioHtml = '<div class="sumario">'
      + '<div class="sumario-info">'
      + '<div class="sumario-title">📊 Sumário Executivo</div>'
      + '<div class="sumario-grid">'
      + '<div class="sumario-item">📍 <b>' + _safe(i.edif) + '</b></div>'
      + '<div class="sumario-item">🏛️ <b>' + _safe(i.com) + '</b></div>'
      + '<div class="sumario-item">📅 <b>' + fdt(_dataVist) + '</b></div>'
      + '<div class="sumario-item">👤 <b>' + fiscalNome + '</b></div>'
      + '<div class="sumario-item">📋 <b>' + stats.total + ' itens</b> inspecionados</div>'
      + '<div class="sumario-item">📸 <b>' + stats.fotos + ' fotos</b> registradas</div>'
      + (stats.mats ? '<div class="sumario-item">🔧 <b>' + stats.mats + ' materiais</b> utilizados</div>' : '')
      + (regLbl ? '<div class="sumario-item">🗺️ <b>' + regLbl + '</b></div>' : '')
      + '</div></div>'
      + '<div class="sumario-donut">'
      + _gerarDonutSvg(_pct, _pctCor, 90)
      + '<div class="sumario-donut-label">' + (_osp ? 'Execução' : 'Conformidade') + '</div>'
      + '</div></div>';

    /* ── Monta HTML ── */
    var html = '<!DOCTYPE html><html lang="pt-BR"><head>'
      + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + _esc(numDoc) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">'
      + '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>'
      + '<style>' + css + '</style>'
      + '</head><body>'
      + '<div class="btn-bar">'
      + '<button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>'
      + '<button class="pdf-btn" id="btn-pdf" onclick="gerarPDF(this)">📄 Exportar PDF A4</button>'
      + '</div>'
      + '<div class="page">'

      /* Marca d'água */
      + (isRascunho ? '<div class="watermark">RASCUNHO</div>' : '')

      /* Topo */
      + '<div class="topo">'
      + '<div class="topo-strip"></div>'
      + '<div class="topo-body">'
      + '<div class="topo-brasao">⚖️</div>'
      + '<div class="topo-inst">'
      + '<div class="topo-estado">Estado de Minas Gerais</div>'
      + '<div class="topo-nome">Tribunal de Justiça do Estado de Minas Gerais</div>'
      + '<div class="topo-sub">COMAP-GEMAP-DENGEP · Fiscalização de Contratos' + (regLbl ? ' · ' + regLbl : '') + '</div>'
      + '</div>'
      + '<div class="topo-doc"><div class="doc-label">Protocolo</div><div class="doc-num">' + numDoc + '</div></div>'
      + '</div>'
      + '</div>'

      /* Faixa tipo */
      + '<div class="tipo-faixa">'
      + '<span class="tipo-badge">' + tipoLbl + '</span>'
      + '<span class="tipo-data">' + geradoEm + '</span>'
      + '</div>'

      /* Corpo */
      + '<div class="corpo">'

      /* Sumário Executivo */
      + sumarioHtml


      /* Ficha técnica */
      + '<div class="ficha"><div class="ficha-title">📋 Identificação da Edificação</div>'
      + '<div class="ficha-grid">'
      + '<div class="ficha-item"><div class="ficha-label">Edificação</div><div class="ficha-val">' + _safe(i.edif) + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">Comarca</div><div class="ficha-val">' + _safe(i.com) + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">' + ((i.tipo==='periodica'||i.tipo==='ose'||i.tipo==='programada')?'Data de Início':'Data da Vistoria') + '</div><div class="ficha-val">' + fdt(_dataVist) + '</div></div>'
      + ((i.tipo==='periodica'||i.tipo==='ose'||i.tipo==='programada')&&i.dtVistoriaFim ? '<div class="ficha-item"><div class="ficha-label">Data Final</div><div class="ficha-val">' + fdt(i.dtVistoriaFim) + '</div></div>' : '')
      + '<div class="ficha-item"><div class="ficha-label">Fiscal Responsável</div><div class="ficha-val">' + fiscalNome + '</div></div>'
      + (_osp && i.os ? '<div class="ficha-item"><div class="ficha-label">' + (i.tipo==='ose'?'Nº da OSE':'Nº da OSP') + '</div><div class="ficha-val mono">' + _esc(i.os) + '</div></div>' : '')
      + (i.tipo==='osp'&&i.dtInicioExec ? '<div class="ficha-item"><div class="ficha-label">Início Execução</div><div class="ficha-val">' + fdt(i.dtInicioExec) + '</div></div>' : '')
      + (i.tipo==='osp'&&i.diasPrazo    ? '<div class="ficha-item"><div class="ficha-label">Prazo</div><div class="ficha-val">' + i.diasPrazo + ' dias</div></div>' : '')
      + (i.tipo==='osp'&&i.dtFinalExec  ? '<div class="ficha-item"><div class="ficha-label">Data Final</div><div class="ficha-val">' + fdt(i.dtFinalExec) + '</div></div>' : '')
      + '</div></div>'

      /* KPIs */
      + '<div class="kpis">' + kpisHtml + '</div>'

      /* Barra de progresso */
      + '<div class="prog-wrap">'
      + '<div class="prog-header">'
      + '<span class="prog-title">' + (_osp ? 'Índice de Execução' : 'Índice de Conformidade') + '</span>'
      + '<span class="prog-pct" style="color:' + _pctCor + ';">' + _pct + '%</span>'
      + '</div>'
      + '<div class="prog-track"><div class="prog-fill" style="width:' + _pct + '%;background:linear-gradient(90deg,' + _pctG + ');"></div></div>'
      + '</div>'

      /* Painel OSE/OSP */
      + ospPanel

      /* Índice de Sistemas */
      + indiceHtml

      /* Seções */
      + '<div class="sec-titulo">'
      + '<span class="sec-titulo-txt">📋 ' + (_osp ? 'Atividades por Sistema' : 'Checklist de Inspeção Técnica') + '</span>'
      + '<span class="sec-count">' + stats.total + ' itens · ' + Object.keys(sim).length + ' sistemas</span>'
      + '</div>'
      + '<div style="border:1px solid #dde3ec;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">'
      + secoes
      + '</div>'

      /* Materiais consolidados */
      + matsGerais

      /* Obs OSP */
      + (i.tipo === 'osp'
          ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 18px;margin-top:24px;">'
            + '<span style="font-size:11px;color:#92400e;font-weight:600;"><b>Observação:</b> Quantitativo e Qualitativo pode alterar conforme execução e verificação in-loco.</span></div>'
          : '')

      /* Assinaturas */
      + assHtml

      + '</div>'  /* corpo */
      + '</div>'  /* page */
      + '<div id="foto-lb" onclick="fecharLB()"><img id="foto-lb-img" src=""><div id="foto-lb-cap"></div></div>'
      + '<scr' + 'ipt>' + _inlineScript() + '<\/script>'
      + '</body></html>';

    return html;
  } catch(e) {
    console.error('_gerarHTMLStr erro:', e);
    return null;
  }
}

function _doExportHTML(id) {
  try {
    var i = S.insp.find(function(x){ return x.id === id; }); if (!i) return;
    if (i.tipo === 'subestacao') { exportHTMLSub(id); return; }
    var html = _gerarHTMLStr(id); if (!html) { Tt('Erro ao gerar relatório.'); return; }
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    var nomeArq = 'TJMG_' + (i.tipo || 'REL').toUpperCase()
      + '_' + (i.edif || 'EDIF').replace(/[^a-zA-Z0-9]/g,'_')
      + (i.os ? '_' + i.os.replace(/[^a-zA-Z0-9]/g,'_') : '')
      + '_' + fdt(i.dtVistoria || i.data).replace(/\//g,'-') + '.html';
    a.download = nomeArq;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    Tt('✅ Relatório exportado com sucesso!');
  } catch(e) {
    console.error('_doExportHTML erro:', e);
    Tt('Erro ao baixar relatório.');
  }
}

/* ══════════════════════════════════════════════════════════════
   SUBESTAÇÃO — identidade visual TJMG unificada
   ══════════════════════════════════════════════════════════════ */

function exportHTMLSub(id) {
  try {
    var insp = S.insp.find(function(x){ return x.id === id; }); if (!insp) { Tt('Inspeção não encontrada.'); return; }
    if (insp.sub) {
      Tt('Carregando fotos...');
      PhotoStore.loadSubAll(id, insp.sub).then(function(){ _doExportHTMLSub(id); }).catch(function(e){ console.warn('Erro fotos sub:', e); _doExportHTMLSub(id); });
      return;
    }
    _doExportHTMLSub(id);
  } catch(e) {
    console.error('exportHTMLSub erro:', e);
    Tt('Erro ao exportar relatório de subestação.');
  }
}

function _gerarHTMLSubStr(id) {
  try {
    var insp = S.insp.find(function(x){ return x.id === id; }); if (!insp) return null;
    var sub  = insp.sub || {};
    var d    = insp.d   || {};

    var tipoSub = sub.tipo_sub        || d.tipo_sub        || 'AEREA';
    var tipoMan = sub.tipo_manutencao || d.tipo_manutencao || 'ANUAL';
    var chk     = sub.chk || {};
    var COR_SUB = '#b45309';

    var secoes = SUB_SECOES.filter(function(s){
      if (s.sempre) return true;
      if (s.anual    && tipoMan !== 'ANUAL')     return false;
      if (s.abrigada && tipoSub !== 'ABRIGADA')  return false;
      return true;
    });

    var total = 0, marc = 0;
    secoes.forEach(function(s){ s.itens.forEach(function(it){ total++; if (chk[it.id] && chk[it.id].v) marc++; }); });
    var pct  = total ? Math.round(marc / total * 100) : 0;
    var pCor = pct >= 80 ? '#15803d' : pct >= 50 ? '#d97706' : '#b91c1c';
    var pG   = pct >= 80 ? '#15803d,#22c55e' : pct >= 50 ? '#b45309,#f59e0b' : '#b91c1c,#ef4444';

    var geradoEm   = new Date().toLocaleString('pt-BR', { dateStyle:'full', timeStyle:'short' });
    var numDoc     = insp.protocolo || gerarProtocolo(insp);
    var regLbl     = insp.reg && REG[insp.reg] ? 'Região ' + REG[insp.reg].l : '';
    var fiscalNome = _safe(insp.fiscal || (S.sessao && S.sessao.nome));
    var dt         = insp.data ? new Date(insp.data).toLocaleDateString('pt-BR') : fdt(Date.now());
    var isRascunho = insp.st !== 'finalizada';

    function fImgs(fotos) {
      if (!fotos || !fotos.length) return '';
      return '<div class="foto-grid">'
        + fotos.map(function(f){
            if (!f || !f.b64) return '';
            return '<figure class="foto-item" onclick="abrirLB(this)">'
              + '<img src="' + f.b64 + '" alt="Foto" loading="lazy">'
              + '<figcaption>' + _esc(f.leg || '') + '</figcaption></figure>';
          }).join('')
        + '</div>';
    }
    function mRow(l, v, lim, ok) {
      var bg = ok === false ? '#fff1f2' : ok === true ? '#f0fdf4' : '#fff';
      var fc = ok === false ? '#dc2626' : ok === true ? '#16a34a' : '#64748b';
      var st = ok === false ? 'FORA' : ok === true ? 'OK' : '—';
      return '<tr style="background:' + bg + ';">'
        + '<td class="med-lbl">' + _esc(l) + '</td>'
        + '<td class="med-val"><b>' + _esc(v) + '</b></td>'
        + '<td class="med-lim">' + _esc(lim) + '</td>'
        + '<td class="med-st" style="color:' + fc + ';">' + st + '</td></tr>';
    }

    var css = _cssBase(COR_SUB);
    /* CSS adicional para subestação */
    css += '\n'
      + '.sec-blk{margin-bottom:0;border:1px solid #dde3ec;border-top:none;break-inside:avoid-page;}'
      + '.sec-hdr .sec-id{background:' + COR_SUB + ';color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:800;flex-shrink:0;}'
      + '.sec-nm{flex:1;font-weight:700;font-size:12px;}'
      + '.sec-prog{font-size:11px;font-weight:700;}'
      + '.chk-table{width:100%;border-collapse:collapse;}'
      + '.chk-table thead tr{background:#fafafa;}'
      + '.chk-th{padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:1px solid #e2e8f0;text-align:left;}'
      + '.chk-row{border-bottom:1px solid #f1f5f9;vertical-align:top;break-inside:avoid;}'
      + '.chk-row:last-child{border-bottom:none;}'
      + '.chk-cb{padding:8px 10px;text-align:center;font-size:16px;width:36px;}'
      + '.chk-d{padding:8px 10px;font-size:12px;}'
      + '.chk-obs{padding:8px 10px;font-size:11px;color:#64748b;width:200px;vertical-align:top;}'
      + '.med-wrap{margin-top:28px;}'
      + '.med-titulo{background:linear-gradient(135deg,#1e3a5f,#2d4a6f);color:#fff;padding:12px 18px;font-size:13px;font-weight:700;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;}'
      + '.med-sub{border:1px solid #dde3ec;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;margin-bottom:16px;break-inside:avoid;}'
      + '.med-equip-hdr{padding:8px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#f8fafc,#f0f4f9);}'
      + '.med-equip-badge{border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;color:#fff;}'
      + '.med-table{width:100%;border-collapse:collapse;}'
      + '.med-table thead tr{background:#fafafa;}'
      + '.med-th{padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;border-bottom:1px solid #e2e8f0;text-align:left;}'
      + '.med-lbl{padding:8px 10px;font-size:12px;}'
      + '.med-val{padding:8px 10px;font-size:12px;font-family:"JetBrains Mono","Fira Code",monospace;font-weight:600;}'
      + '.med-lim{padding:8px 10px;font-size:11px;color:#64748b;}'
      + '.med-st{padding:8px 10px;font-size:11px;font-weight:700;text-align:center;}'
      + '.nc-wrap{margin-top:28px;display:flex;flex-direction:column;gap:12px;}'
      + '.nc-blk{border-radius:12px;padding:16px 20px;border:1px solid #fde68a;background:linear-gradient(135deg,#fffbeb,#fef3c7);}'
      + '.nc-blk.acoes{border-color:#bbf7d0;background:linear-gradient(135deg,#f0fdf4,#dcfce7);}'
      + '.nc-lbl{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:10px;}'
      + '.nc-blk.acoes .nc-lbl{color:#15803d;}'
      + '.nc-txt{font-size:12px;line-height:1.8;color:#1a2332;}';

    /* ── Blocos de checklist ── */
    var checkHtml = '';
    secoes.forEach(function(s){
      var sm = s.itens.filter(function(it){ return chk[it.id] && chk[it.id].v; }).length;
      var smCor = sm === s.itens.length ? '#16a34a' : sm === 0 ? '#dc2626' : '#d97706';
      checkHtml += '<div class="sec-blk">'
        + '<div class="sec-hdr">'
        + '<span class="sec-id">' + _esc(s.id) + '</span>'
        + '<span class="sec-nm">' + _esc(s.n) + '</span>'
        + '<span class="sec-prog" style="color:' + smCor + ';">' + sm + '/' + s.itens.length + '</span>'
        + '</div>'
        + '<table class="chk-table"><thead><tr>'
        + '<th class="chk-th" style="width:36px;text-align:center;">✓</th>'
        + '<th class="chk-th">Item</th>'
        + '<th class="chk-th" style="width:200px;">Obs / Fotos</th>'
        + '</tr></thead><tbody>';
      s.itens.forEach(function(it){
        var ck = chk[it.id] || { v:false, obs:'', fotos:[] };
        checkHtml += '<tr class="chk-row" style="background:' + (ck.v ? '#f8fff8' : '#fff') + ';">'
          + '<td class="chk-cb">' + (ck.v ? '✅' : '☐') + '</td>'
          + '<td class="chk-d">' + _esc(it.d) + '</td>'
          + '<td class="chk-obs">' + _esc(ck.obs || '')
          + (ck.fotos && ck.fotos.length ? fImgs(ck.fotos) : '')
          + '</td></tr>';
      });
      checkHtml += '</tbody></table></div>';
    });

    /* ── Medições elétricas (somente ABRIGADA) ── */
    var medHtml = '';
    if (tipoSub === 'ABRIGADA') {
      (sub.trafos || []).forEach(function(tr, idx){
        try {
          var at2 = _spf(tr.at), bt2 = _spf(tr.bt);
          var teo2 = at2 && bt2 ? at2 * 1000 / bt2 : 0;
          medHtml += '<div class="med-sub">'
            + '<div class="med-equip-hdr">'
            + '<span class="med-equip-badge" style="background:#b45309;">TR-' + (idx+1) + '</span>'
            + '<span style="font-weight:700;font-size:12px;">Transformador #' + (idx+1) + (tr.ref ? ' — Ref. ' + _esc(tr.ref) : '') + '</span>'
            + '</div>'
            + '<table class="med-table"><thead><tr>'
            + '<th class="med-th">Ponto</th><th class="med-th">Valor</th><th class="med-th">Limite</th><th class="med-th" style="text-align:center;">Status</th>'
            + '</tr></thead><tbody>'
            + mRow('Tensão AT (kV)', _safe(tr.at,'—'), '≤ 15 kV', at2 ? at2 <= 15 : null)
            + mRow('Tensão BT (V)',  _safe(tr.bt,'—'), '220/127 V', bt2 ? (bt2 >= 210 && bt2 <= 240) : null)
            + mRow('Relação Teórica', teo2 ? teo2.toFixed(2) : '—', '—', null)
            + mRow('TTR medido',     _safe(tr.ttr,'—'), 'Desvio ≤ 0.5%', null)
            + mRow('Isolação (MΩ)',  _safe(tr.iso,'—'), '≥ 50 MΩ', tr.iso ? _spf(tr.iso) >= 50 : null)
            + mRow('Aterramento (Ω)',_safe(tr.ohm,'—'), '≤ 10 Ω', tr.ohm ? _spf(tr.ohm) <= 10 : null)
            + '</tbody></table>'
            + fImgs(tr.fotos_ttr || [])
            + fImgs(tr.fotos_iso || [])
            + fImgs(tr.fotos_ohm || [])
            + '</div>';
        } catch(e) { console.warn('Erro trafo ' + idx, e); }
      });

      (sub.disjs || []).forEach(function(dj, idx){
        try {
          medHtml += '<div class="med-sub">'
            + '<div class="med-equip-hdr">'
            + '<span class="med-equip-badge" style="background:#1e40af;">DJ-' + (idx+1) + '</span>'
            + '<span style="font-weight:700;font-size:12px;">Disjuntor #' + (idx+1) + (dj.ref ? ' — ' + _esc(dj.ref) : '') + '</span>'
            + '</div>'
            + '<table class="med-table"><thead><tr>'
            + '<th class="med-th">Ponto</th><th class="med-th">Valor</th><th class="med-th">Limite</th><th class="med-th" style="text-align:center;">Status</th>'
            + '</tr></thead><tbody>'
            + mRow('Isolação (MΩ)',  _safe(dj.iso,'—'), '≥ 50 MΩ', dj.iso ? _spf(dj.iso) >= 50 : null)
            + mRow('Cont. Resist. (mΩ)', _safe(dj.cr,'—'), '≤ 200 mΩ', dj.cr ? _spf(dj.cr) <= 200 : null)
            + '</tbody></table>'
            + fImgs(dj.fotos_iso || [])
            + fImgs(dj.fotos_cr  || [])
            + '</div>';
        } catch(e) { console.warn('Erro disj ' + idx, e); }
      });

      (sub.secc || []).forEach(function(sc, idx){
        try {
          medHtml += '<div class="med-sub">'
            + '<div class="med-equip-hdr">'
            + '<span class="med-equip-badge" style="background:#059669;">SC-' + (idx+1) + '</span>'
            + '<span style="font-weight:700;font-size:12px;">Seccionadora #' + (idx+1) + (sc.ref ? ' — ' + _esc(sc.ref) : '') + '</span>'
            + '</div>'
            + '<table class="med-table"><thead><tr>'
            + '<th class="med-th">Ponto</th><th class="med-th">Valor</th><th class="med-th">Limite</th><th class="med-th" style="text-align:center;">Status</th>'
            + '</tr></thead><tbody>'
            + mRow('Isolação (MΩ)',  _safe(sc.iso,'—'), '≥ 50 MΩ', sc.iso ? _spf(sc.iso) >= 50 : null)
            + mRow('Cont. Resist. (mΩ)', _safe(sc.cr,'—'), '≤ 200 mΩ', sc.cr ? _spf(sc.cr) <= 200 : null)
            + '</tbody></table>'
            + fImgs(sc.fotos_iso || [])
            + fImgs(sc.fotos_cr  || [])
            + '</div>';
        } catch(e) { console.warn('Erro secc ' + idx, e); }
      });
    }

    /* ── Assinatura ── */
    var fiscalCargo = 'Fiscal de Contrato – TJMG / COMAP-GEMAP-DENGEP';
    var assHtml = '<div class="ass-wrap">'
      + '<div class="ass-box"><div class="ass-title">Fiscal Responsável</div>'
      + '<div class="ass-linha"></div>'
      + '<div class="ass-nome">' + fiscalNome + '</div>'
      + '<div class="ass-cargo">' + fiscalCargo + '</div>'
      + '</div>'
      + '<div class="ass-box"><div class="ass-title">Responsável Técnico</div>'
      + '<div class="ass-linha"></div>'
      + '<div class="ass-nome">' + _safe(sub.responsavel, '________________________________') + '</div>'
      + '<div class="ass-cargo">Responsável Técnico — TJMG</div>'
      + '</div></div>';

    /* ── Sumário Executivo ── */
    var sumarioHtml = '<div class="sumario">'
      + '<div class="sumario-info">'
      + '<div class="sumario-title">📊 Sumário Executivo</div>'
      + '<div class="sumario-grid">'
      + '<div class="sumario-item">📍 <b>' + _safe(insp.edif) + '</b></div>'
      + '<div class="sumario-item">🏛️ <b>' + _safe(insp.com) + '</b></div>'
      + '<div class="sumario-item">📅 <b>' + dt + '</b></div>'
      + '<div class="sumario-item">👤 <b>' + fiscalNome + '</b></div>'
      + '<div class="sumario-item">⚡ <b>' + tipoSub + '</b> · <b>' + tipoMan + '</b></div>'
      + '<div class="sumario-item">📋 <b>' + total + ' itens</b> no checklist</div>'
      + '</div></div>'
      + '<div class="sumario-donut">'
      + _gerarDonutSvg(pct, pCor, 90)
      + '<div class="sumario-donut-label">Conformidade</div>'
      + '</div></div>';

    /* ── Monta HTML ── */
    var html = '<!DOCTYPE html><html lang="pt-BR"><head>'
      + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + _esc(numDoc) + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">'
      + '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>'
      + '<style>' + css + '</style>'
      + '</head><body>'
      + '<div class="btn-bar">'
      + '<button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>'
      + '<button class="pdf-btn" id="btn-pdf" onclick="gerarPDF(this)">📄 Exportar PDF A4</button>'
      + '</div>'
      + '<div class="page">'

      /* Marca d'água */
      + (isRascunho ? '<div class="watermark">RASCUNHO</div>' : '')

      /* Topo */
      + '<div class="topo">'
      + '<div class="topo-strip"></div>'
      + '<div class="topo-body">'
      + '<div class="topo-brasao">⚡</div>'
      + '<div class="topo-inst">'
      + '<div class="topo-estado">Estado de Minas Gerais</div>'
      + '<div class="topo-nome">Tribunal de Justiça do Estado de Minas Gerais</div>'
      + '<div class="topo-sub">COMAP-GEMAP-DENGEP · Manutenção de Subestação — Anexo B.1 TJMG' + (regLbl ? ' · ' + regLbl : '') + '</div>'
      + '</div>'
      + '<div class="topo-doc"><div class="doc-label">Protocolo</div><div class="doc-num">' + numDoc + '</div></div>'
      + '</div>'
      + '</div>'

      /* Faixa tipo */
      + '<div class="tipo-faixa">'
      + '<span class="tipo-badge">RITMP — COMPLEMENTAR — SUBESTAÇÃO</span>'
      + '<span class="tipo-data">' + geradoEm + '</span>'
      + '</div>'

      /* Corpo */
      + '<div class="corpo">'

      /* Sumário */
      + sumarioHtml

      /* QR Code */

      /* Ficha técnica */
      + '<div class="ficha"><div class="ficha-title">📋 Identificação da Edificação</div>'
      + '<div class="ficha-grid">'
      + '<div class="ficha-item"><div class="ficha-label">Edificação</div><div class="ficha-val">' + _safe(insp.edif) + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">Comarca</div><div class="ficha-val">' + _safe(insp.com) + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">Data da Inspeção</div><div class="ficha-val">' + dt + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">Fiscal Responsável</div><div class="ficha-val">' + fiscalNome + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">Tipo de Subestação</div><div class="ficha-val mono">' + tipoSub + '</div></div>'
      + '<div class="ficha-item"><div class="ficha-label">Tipo de Manutenção</div><div class="ficha-val mono">' + tipoMan + '</div></div>'
      + (sub.responsavel ? '<div class="ficha-item"><div class="ficha-label">Resp. Técnico</div><div class="ficha-val">' + _esc(sub.responsavel) + '</div></div>' : '')
      + '</div></div>'

      /* KPIs */
      + '<div class="kpis">'
      + '<div class="kpi kpi-total"><div class="kpi-num">' + total + '</div><div class="kpi-lbl">Total Itens</div></div>'
      + '<div class="kpi kpi-ok"><div class="kpi-num" style="color:#16a34a;">' + marc + '</div><div class="kpi-lbl">✅ Marcados</div></div>'
      + '<div class="kpi kpi-nc"><div class="kpi-num" style="color:#dc2626;">' + (total - marc) + '</div><div class="kpi-lbl">❌ Pendentes</div></div>'
      + '<div class="kpi kpi-amb"><div class="kpi-num" style="color:' + pCor + ';">' + pct + '%</div><div class="kpi-lbl">Conformidade</div></div>'
      + '</div>'

      /* Barra de progresso */
      + '<div class="prog-wrap">'
      + '<div class="prog-header">'
      + '<span class="prog-title">Índice de Conformidade do Checklist</span>'
      + '<span class="prog-pct" style="color:' + pCor + ';">' + pct + '%</span>'
      + '</div>'
      + '<div class="prog-track"><div class="prog-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + pG + ');"></div></div>'
      + '</div>'

      /* Obs gerais */
      + (sub.obs_geral
          ? '<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:28px;">'
            + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:10px;">Observações Gerais</div>'
            + '<div style="font-size:12px;line-height:1.8;">' + _esc(sub.obs_geral) + '</div>'
            + '</div>'
          : '')

      /* Checklist */
      + '<div class="sec-titulo">'
      + '<span class="sec-titulo-txt">📋 Checklist Inspeção — Anexo B.1 TJMG</span>'
      + '<span class="sec-count">' + total + ' itens · ' + secoes.length + ' seções</span>'
      + '</div>'
      + checkHtml

      /* Medições */
      + (tipoSub === 'ABRIGADA' && medHtml
          ? '<div class="med-wrap">'
            + '<div class="med-titulo">📊 Medições Elétricas</div>'
            + medHtml
            + '</div>'
          : '')

      /* Não conformidades */
      + ((sub.nc || sub.acoes)
          ? '<div class="nc-wrap">'
            + '<div class="nc-blk"><div class="nc-lbl">⚠️ Não Conformidades</div><div class="nc-txt">' + _esc(sub.nc || 'Nenhuma registrada.') + '</div></div>'
            + '<div class="nc-blk acoes"><div class="nc-lbl">✅ Ações Corretivas</div><div class="nc-txt">' + _esc(sub.acoes || 'Nenhuma registrada.') + '</div></div>'
            + '</div>'
          : '')

      /* Assinaturas */
      + assHtml

      + '</div>'  /* corpo */
      + '</div>'  /* page */

      + '<div id="foto-lb" onclick="fecharLB()"><img id="foto-lb-img" src=""><div id="foto-lb-cap"></div></div>'
      + '<scr' + 'ipt>' + _inlineScript() + '<\/script>'
      + '</body></html>';

    return html;
  } catch(e) {
    console.error('_gerarHTMLSubStr erro:', e);
    return null;
  }
}

function _doExportHTMLSub(id) {
  try {
    var insp = S.insp.find(function(x){ return x.id === id; }); if (!insp) return;
    var html = _gerarHTMLSubStr(id); if (!html) { Tt('Erro ao gerar relatório de subestação.'); return; }
    var tipoSub = (insp.sub || {}).tipo_sub || 'AEREA';
    var blob    = new Blob([html], { type: 'text/html;charset=utf-8' });
    var a       = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    var nomeArq = 'Sub_' + tipoSub
      + '_' + (insp.com  || 'COMARCA').replace(/[^a-zA-Z0-9]/g,'_')
      + '_' + fdt(insp.data || Date.now()).replace(/\//g,'-') + '.html';
    a.download = nomeArq;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    Tt('✅ HTML exportado com sucesso!');
  } catch(e) {
    console.error('_doExportHTMLSub erro:', e);
    Tt('Erro ao baixar relatório de subestação.');
  }
}
