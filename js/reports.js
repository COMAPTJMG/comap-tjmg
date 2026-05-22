'use strict';
// ═══════════════════════════════════════════════════════════════
//  reports.js — Geração de relatórios profissionais HTML/PDF
//  Gera HTML que pode ser impresso ou salvo como PDF pelo browser
// ═══════════════════════════════════════════════════════════════

const Reports = (() => {

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;}
    .page{width:210mm;min-height:297mm;margin:0 auto;padding:16mm 18mm;position:relative;}
    @media print{.page{width:100%;padding:12mm 15mm;} .no-print{display:none!important;}}

    /* HEADER */
    .rpt-header{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:3px solid #003580;margin-bottom:18px;}
    .rpt-logo{width:52px;height:52px;background:#003580;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:900;flex-shrink:0;}
    .rpt-header-text h1{font-size:18px;font-weight:900;color:#003580;}
    .rpt-header-text p{font-size:10px;color:#64748b;margin-top:2px;}
    .rpt-header-right{margin-left:auto;text-align:right;font-size:10px;color:#64748b;}
    .rpt-header-right strong{display:block;font-size:13px;color:#003580;font-weight:700;}

    /* TITLE SECTION */
    .rpt-title{background:#003580;color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:16px;}
    .rpt-title h2{font-size:16px;font-weight:900;}
    .rpt-title p{font-size:10px;opacity:.8;margin-top:3px;}

    /* KPI ROW */
    .kpi-row{display:grid;gap:10px;margin-bottom:16px;}
    .kpi-row.cols4{grid-template-columns:repeat(4,1fr);}
    .kpi-row.cols3{grid-template-columns:repeat(3,1fr);}
    .kpi-card{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;text-align:center;}
    .kpi-card .kv{font-size:26px;font-weight:900;color:#003580;}
    .kpi-card .kv.red{color:#dc2626;}.kpi-card .kv.green{color:#16a34a;}.kpi-card .kv.amber{color:#d97706;}
    .kpi-card .kl{font-size:9px;color:#64748b;margin-top:2px;text-transform:uppercase;font-weight:600;}

    /* TABLE */
    table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px;}
    thead tr{background:#003580;color:#fff;}
    thead th{padding:7px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.3px;}
    tbody tr:nth-child(even){background:#f8fafc;}
    tbody tr:hover{background:#f1f5f9;}
    tbody td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}

    /* BADGES */
    .bdg{display:inline-block;padding:2px 7px;border-radius:5px;font-size:9px;font-weight:700;white-space:nowrap;}
    .bdg-red{background:#fee2e2;color:#b91c1c;}
    .bdg-green{background:#dcfce7;color:#15803d;}
    .bdg-amber{background:#fef3c7;color:#92400e;}
    .bdg-blue{background:#dbeafe;color:#1d4ed8;}
    .bdg-gray{background:#f1f5f9;color:#64748b;}

    /* SECTION */
    .rpt-section{margin-bottom:18px;}
    .rpt-section-title{font-size:11px;font-weight:800;color:#003580;text-transform:uppercase;letter-spacing:.5px;padding:6px 10px;background:#f1f5f9;border-radius:6px;margin-bottom:10px;border-left:3px solid #003580;}

    /* DETAIL CARD */
    .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
    .detail-item{padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;}
    .detail-item .dl{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:2px;}
    .detail-item .dv{font-size:11px;font-weight:600;color:#1e293b;}

    /* CHART BAR */
    .bar-chart{margin-bottom:14px;}
    .bar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:10px;}
    .bar-label{width:120px;flex-shrink:0;color:#475569;}
    .bar-track{flex:1;height:14px;background:#f1f5f9;border-radius:4px;overflow:hidden;}
    .bar-fill{height:100%;border-radius:4px;background:#003580;}
    .bar-val{width:30px;text-align:right;font-weight:700;color:#003580;}

    /* FOOTER */
    .rpt-footer{position:fixed;bottom:12mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;}
    @media print{.rpt-footer{position:fixed;}}

    /* PRINT BTN */
    .print-bar{position:fixed;top:0;left:0;right:0;background:#003580;color:#fff;padding:10px 20px;display:flex;gap:10px;align-items:center;z-index:999;}
    .print-bar button{padding:7px 18px;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;}
    .print-bar .btn-print{background:#fff;color:#003580;}
    .print-bar .btn-close{background:rgba(255,255,255,.15);color:#fff;}
    @media print{.print-bar{display:none!important;}}
  `;

  function fmt(d) {
    if (!d) return '—';
    if (d.includes('T')) d = d.split('T')[0];
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }
  function now() { return new Date().toLocaleString('pt-BR'); }
  function pctBar(v, total, color = '#003580') {
    const pct = total > 0 ? Math.round(v / total * 100) : 0;
    return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>`;
  }
  function badge(txt) {
    const t = (txt || '').toUpperCase();
    if (t.includes('ATRASO') || t.includes('VENCIDO')) return `<span class="bdg bdg-red">${txt}</span>`;
    if (t.includes('CONCLU') || t.includes('VIGENTE')) return `<span class="bdg bdg-green">${txt}</span>`;
    if (t.includes('ABERTO') || t.includes('AGENDADO')) return `<span class="bdg bdg-blue">${txt}</span>`;
    if (t.includes('30') || t.includes('ANDAMENTO')) return `<span class="bdg bdg-amber">${txt}</span>`;
    if (t.includes('CANCEL')) return `<span class="bdg bdg-gray">${txt}</span>`;
    return `<span class="bdg bdg-blue">${txt}</span>`;
  }

  function open(html, titulo) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width">
      <title>COMAP · ${titulo}</title>
      <style>${CSS}</style>
    </head><body>
    <div class="print-bar no-print">
      <span style="font-weight:800;font-size:14px;">📄 ${titulo}</span>
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
      <button class="btn-close" onclick="window.close()">✕ Fechar</button>
    </div>
    <div style="margin-top:48px;" class="no-print"></div>
    ${html}
    </body></html>`);
    w.document.close();
  }

  function headerHTML(titulo, subtitulo, regiao) {
    return `<div class="page">
    <div class="rpt-header">
      <div class="rpt-logo">C</div>
      <div class="rpt-header-text">
        <h1>COMAP · TJMG</h1>
        <p>Coordenação de Manutenção Predial — Tribunal de Justiça de Minas Gerais</p>
      </div>
      <div class="rpt-header-right">
        <strong>${titulo}</strong>
        <span>Emitido em ${now()}</span>
        ${regiao ? `<br><span>Região: ${regiao}</span>` : ''}
      </div>
    </div>
    <div class="rpt-title"><h2>${titulo}</h2><p>${subtitulo || ''}</p></div>`;
  }

  // ── RELATÓRIO EMERGENCIAL ──────────────────────────────────
  function emergencial(dados, filtros = {}) {
    const d = dados.filter(r => {
      if (filtros.regiao && r.regiao !== filtros.regiao) return false;
      if (filtros.status && !String(r.status || '').toUpperCase().includes(filtros.status.toUpperCase())) return false;
      return true;
    });

    const total = d.length;
    const abertos = d.filter(r => !String(r.status || '').toUpperCase().includes('CONCLU') && !String(r.status || '').toUpperCase().includes('CANCEL'));
    const atraso  = d.filter(r => String(r.status || '').toUpperCase().includes('ATRASO'));
    const concl   = d.filter(r => String(r.status || '').toUpperCase().includes('CONCLU'));
    const cancel  = d.filter(r => String(r.status || '').toUpperCase().includes('CANCEL'));

    // Agrupamento por região
    const porRegiao = {};
    d.forEach(r => { if (!porRegiao[r.regiao]) porRegiao[r.regiao] = []; porRegiao[r.regiao].push(r); });

    const html = headerHTML('Relatório de Atendimentos Emergenciais',
      `Total de ${total} OSE(s) | Período: ${filtros.periodo || 'Geral'}`, filtros.regiao)
    + `
    <div class="kpi-row cols4">
      <div class="kpi-card"><div class="kv">${total}</div><div class="kl">Total de OSE</div></div>
      <div class="kpi-card"><div class="kv amber">${abertos.length}</div><div class="kl">Em Aberto</div></div>
      <div class="kpi-card"><div class="kv red">${atraso.length}</div><div class="kl">Em Atraso</div></div>
      <div class="kpi-card"><div class="kv green">${concl.length}</div><div class="kl">Concluídos</div></div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">Distribuição por Região</div>
      <div class="bar-chart">
        ${Object.entries(porRegiao).sort((a,b)=>b[1].length-a[1].length).map(([reg,items])=>`
          <div class="bar-row">
            <div class="bar-label">${reg}</div>
            ${pctBar(items.length, total)}
            <div class="bar-val">${items.length}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">Listagem de Ordens de Serviço Emergenciais</div>
      <table>
        <thead><tr>
          <th>OSE</th><th>Data Abertura</th><th>Região</th><th>Comarca</th>
          <th>Edificação</th><th>Sistema</th><th>Causa Raiz</th>
          <th>Status</th><th>Conclusão</th>
        </tr></thead>
        <tbody>
        ${d.sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(r=>`
          <tr>
            <td><strong>#${r.ose||r.id}</strong></td>
            <td>${fmt(r.data)} ${r.hora||''}</td>
            <td>${r.regiao||'—'}</td>
            <td>${r.comarca||'—'}</td>
            <td>${r.edificacao||'—'}</td>
            <td style="font-size:9px;">${r.sistema||'—'}${r.subsistema?` › ${r.subsistema}`:''}</td>
            <td style="font-size:9px;">${r.causa_raiz||'—'}</td>
            <td>${badge(r.status)}</td>
            <td>${fmt(r.data_conclusao)||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="rpt-footer">
      <span>COMAP · TJMG — Sistema Integrado de Manutenção Predial</span>
      <span>Emitido em ${now()}</span>
    </div></div>`;

    open(html, 'Relatório Emergencial');
  }

  // ── RELATÓRIO PERIÓDICA ────────────────────────────────────
  function periodica(dados, filtros = {}) {
    const d = dados.filter(r => {
      if (filtros.regiao && (r.regiao || '').toUpperCase() !== filtros.regiao.toUpperCase()) return false;
      return true;
    });
    const total = d.length;
    const concl  = d.filter(r => String(r.status||'').toUpperCase().includes('CONCLU'));
    const agend  = d.filter(r => String(r.status||'').toUpperCase().includes('AGENDADO'));
    const atraso = d.filter(r => { const s=String(r.status||'').toUpperCase(); return !s.includes('CONCLU')&&!s.includes('CANCEL')&&r.prog_fim&&new Date(r.prog_fim)<new Date(); });

    const eficiencia = total > 0 ? Math.round(concl.length / total * 100) : 0;
    const porRegiao = {};
    d.forEach(r => { if(!porRegiao[r.regiao]) porRegiao[r.regiao]={total:0,concl:0,atraso:0}; porRegiao[r.regiao].total++; if(String(r.status||'').toUpperCase().includes('CONCLU')) porRegiao[r.regiao].concl++; });

    const html = headerHTML('Relatório de Manutenções Periódicas',
      `Total: ${total} | Eficiência: ${eficiencia}%`, filtros.regiao)
    + `
    <div class="kpi-row cols4">
      <div class="kpi-card"><div class="kv">${total}</div><div class="kl">Total</div></div>
      <div class="kpi-card"><div class="kv green">${concl.length}</div><div class="kl">Concluídos</div></div>
      <div class="kpi-card"><div class="kv red">${atraso.length}</div><div class="kl">Atrasados</div></div>
      <div class="kpi-card"><div class="kv amber">${eficiencia}%</div><div class="kl">Eficiência</div></div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">Execução por Região</div>
      <table>
        <thead><tr><th>Região</th><th>Total</th><th>Concluídos</th><th>Eficiência</th><th>Progresso</th></tr></thead>
        <tbody>
        ${Object.entries(porRegiao).map(([reg,v])=>`<tr>
          <td><strong>${reg}</strong></td>
          <td>${v.total}</td>
          <td>${v.concl}</td>
          <td>${v.total>0?Math.round(v.concl/v.total*100):0}%</td>
          <td style="width:120px;">${pctBar(v.concl,v.total,'#16a34a')}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">Cronograma de Atividades</div>
      <table>
        <thead><tr><th>#</th><th>Comarca</th><th>Edificação</th><th>Grupo</th><th>Tipo</th>
          <th>Prog. Início</th><th>Prog. Fim</th><th>Real Início</th><th>Real Fim</th>
          <th>Dias</th><th>Contrato</th><th>Status</th></tr></thead>
        <tbody>
        ${d.map(r=>`<tr>
          <td>${r.id}</td>
          <td>${r.comarca||'—'}</td>
          <td style="font-size:9px;">${r.edificacao||'—'}</td>
          <td style="text-align:center;">${r.grupo||'—'}</td>
          <td style="font-size:9px;">${(r.tipo_atend||'').replace('MANUTENÇÃO PERIÓDICA ','')}</td>
          <td>${fmt(r.prog_inicio)}</td>
          <td>${fmt(r.prog_fim)}</td>
          <td>${fmt(r.data_inicio)||'—'}</td>
          <td>${fmt(r.data_conclusao)||'—'}</td>
          <td style="text-align:center;">${r.dias_trabalhados||'—'}</td>
          <td style="font-size:9px;">${r.contrato||'—'}</td>
          <td>${badge(r.status)}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="rpt-footer">
      <span>COMAP · TJMG — Manutenções Periódicas</span><span>Emitido em ${now()}</span>
    </div></div>`;

    open(html, 'Relatório Periódica');
  }

  // ── RELATÓRIO PCI ──────────────────────────────────────────
  function pci(dados, filtros = {}) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    function diasAte(d) { if(!d) return null; return Math.ceil((new Date(d+'T00:00:00')-hoje)/86400000); }
    function stPci(d) {
      const diff=diasAte(d);
      if(diff===null) return {lbl:'SEM DATA',cls:'bdg-gray'};
      if(diff<=0) return {lbl:'VENCIDO',cls:'bdg-red'};
      if(diff<=30) return {lbl:`VENCE ${diff}d`,cls:'bdg-amber'};
      if(diff<=60) return {lbl:`VENCE ${diff}d`,cls:'bdg-amber'};
      return {lbl:'VIGENTE',cls:'bdg-green'};
    }

    const d = dados.filter(r => !r.suspenso && (!filtros.regiao || (r.regiao||'').toUpperCase()===filtros.regiao.toUpperCase()));
    const vencidos = d.filter(r=>{ const diff=diasAte(r.validade); return diff!==null&&diff<=0; });
    const d30 = d.filter(r=>{ const diff=diasAte(r.validade); return diff!==null&&diff>0&&diff<=30; });
    const d60 = d.filter(r=>{ const diff=diasAte(r.validade); return diff!==null&&diff>30&&diff<=60; });
    const vigentes = d.filter(r=>{ const diff=diasAte(r.validade); return diff!==null&&diff>60; });
    const qtdTotal = d.reduce((s,r)=>s+(r.qtd||1),0);

    const html = headerHTML('Relatório de Controle PCI',
      `Prevenção e Combate a Incêndio | ${d.length} registros · ${qtdTotal} unidades`, filtros.regiao)
    + `
    <div class="kpi-row cols4">
      <div class="kpi-card"><div class="kv">${d.length}</div><div class="kl">Registros</div></div>
      <div class="kpi-card"><div class="kv red">${vencidos.length}</div><div class="kl">Vencidos</div></div>
      <div class="kpi-card"><div class="kv amber">${d30.length}</div><div class="kl">Vence em 30d</div></div>
      <div class="kpi-card"><div class="kv green">${vigentes.length}</div><div class="kl">Vigentes</div></div>
    </div>

    ${vencidos.length > 0 ? `
    <div class="rpt-section">
      <div class="rpt-section-title" style="border-color:#dc2626;color:#dc2626;">⚠️ PCI VENCIDOS — Ação Imediata Necessária</div>
      <table>
        <thead><tr><th>Comarca</th><th>Edificação</th><th>Tipo</th><th>Qtd</th><th>Validade</th><th>Dias Vencido</th><th>RTI</th></tr></thead>
        <tbody>
        ${vencidos.map(r=>`<tr style="background:#fff5f5;">
          <td><strong>${r.comarca||'—'}</strong></td>
          <td>${r.edificacao||'—'}</td>
          <td style="font-size:9px;">${r.tipo_pci||'—'}</td>
          <td style="text-align:center;">${r.qtd||1}</td>
          <td style="color:#dc2626;font-weight:700;">${fmt(r.validade)}</td>
          <td style="color:#dc2626;font-weight:700;">${Math.abs(diasAte(r.validade))} dias</td>
          <td>${r.rti==='SIM'?'✅':'❌'}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <div class="rpt-section">
      <div class="rpt-section-title">Listagem Completa PCI</div>
      <table>
        <thead><tr><th>Região</th><th>Comarca</th><th>Edificação</th><th>Tipo PCI</th>
          <th>Qtd</th><th>Recarga</th><th>Validade</th><th>Status</th>
          <th>Med.1</th><th>Med.2</th><th>RTI</th></tr></thead>
        <tbody>
        ${d.sort((a,b)=>(a.validade||'').localeCompare(b.validade||'')).map(r=>{
          const st=stPci(r.validade);
          return `<tr>
            <td style="font-size:9px;">${r.regiao||'—'}</td>
            <td>${r.comarca||'—'}</td>
            <td style="font-size:9px;">${r.edificacao||'—'}</td>
            <td style="font-size:9px;">${r.tipo_pci||'—'}</td>
            <td style="text-align:center;">${r.qtd||1}</td>
            <td>${fmt(r.recarga)}</td>
            <td><strong>${fmt(r.validade)}</strong></td>
            <td><span class="bdg ${st.cls}">${st.lbl}</span></td>
            <td>${fmt(r.med1)||'—'}</td>
            <td>${fmt(r.med2)||'—'}</td>
            <td style="text-align:center;">${r.rti==='SIM'?'✅':'❌'}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
    <div class="rpt-footer">
      <span>COMAP · TJMG — Controle PCI · Contrato ${filtros.contrato||'Geral'}</span>
      <span>Emitido em ${now()}</span>
    </div></div>`;

    open(html, 'Relatório PCI');
  }

  // ── RELATÓRIO DIÁRIO ───────────────────────────────────────
  function diario(dados, mes, ano) {
    const d = dados.filter(e => {
      if (!e.data) return false;
      const [y, m] = e.data.split('-');
      return parseInt(y) === ano && parseInt(m) === mes;
    }).sort((a, b) => a.data.localeCompare(b.data));

    const html = headerHTML(`Diário de Fiscalização — ${['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes]}/${ano}`,
      `${d.length} registro(s) no período`)
    + `
    ${d.map(e => `
    <div class="rpt-section" style="break-inside:avoid;page-break-inside:avoid;">
      <div class="rpt-section-title">${fmt(e.data)} · ${e.local||'CAMPO'} · ${e.usuario_nome||'—'}</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="dl">Manutenção no Período</div><div class="dv">${e.manut_dentro_periodo===false?'❌ Não — '+( e.manut_justif_periodo||''):'✅ Sim'}</div></div>
        <div class="detail-item"><div class="dl">Plano Integral</div><div class="dv">${e.plano_integral===false?'❌ Não — '+(e.plano_justif||''):'✅ Sim'}</div></div>
        <div class="detail-item"><div class="dl">Chamados Emergenciais</div><div class="dv">${e.teve_chamados?`${(e.chamados||[]).length} chamado(s)${e.chamados_no_prazo===false?' — Fora do prazo':' — No prazo'}`:'Sem chamados'}</div></div>
        <div class="detail-item"><div class="dl">Notificações</div><div class="dv">Email: ${e.notif_email||0} · SEI: ${e.notif_sei||0} · WhatsApp: ${e.notif_whats||0}</div></div>
      </div>
      ${e.obs ? `<div style="padding:8px;background:#f8fafc;border-radius:6px;font-size:10px;color:#475569;"><strong>Obs:</strong> ${e.obs}</div>` : ''}
    </div>`).join('')}
    <div class="rpt-footer">
      <span>COMAP · TJMG — Diário de Fiscalização</span><span>Emitido em ${now()}</span>
    </div></div>`;

    open(html, `Diário ${mes}/${ano}`);
  }

  // ── RELATÓRIO PENDÊNCIAS (GERENCIAL) ──────────────────────
  function pendencias(emr, per, pci_data) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    function dias(d) { if(!d) return null; return Math.ceil((new Date(d+'T00:00:00')-hoje)/86400000); }

    const emrAtraso  = emr.filter(r => String(r.status||'').toUpperCase().includes('ATRASO'));
    const emrAberto  = emr.filter(r => !String(r.status||'').toUpperCase().includes('CONCLU') && !String(r.status||'').toUpperCase().includes('CANCEL'));
    const pciVenc    = pci_data.filter(r => !r.suspenso && dias(r.validade)!==null && dias(r.validade)<=0);
    const pci30      = pci_data.filter(r => !r.suspenso && dias(r.validade)!==null && dias(r.validade)>0 && dias(r.validade)<=30);
    const perAtraso  = per.filter(r => { const s=String(r.status||'').toUpperCase(); return !s.includes('CONCLU')&&!s.includes('CANCEL')&&r.prog_fim&&new Date(r.prog_fim)<hoje; });

    const html = headerHTML('Relatório Gerencial de Pendências', `Gerado em ${now()} — Visão consolidada de todas as pendências`)
    + `
    <div class="kpi-row cols4">
      <div class="kpi-card"><div class="kv red">${emrAtraso.length}</div><div class="kl">OSE em Atraso</div></div>
      <div class="kpi-card"><div class="kv amber">${emrAberto.length}</div><div class="kl">OSE em Aberto</div></div>
      <div class="kpi-card"><div class="kv red">${pciVenc.length}</div><div class="kl">PCI Vencidos</div></div>
      <div class="kpi-card"><div class="kv amber">${perAtraso.length}</div><div class="kl">Periódicas Atrasadas</div></div>
    </div>

    ${emrAtraso.length > 0 ? `
    <div class="rpt-section">
      <div class="rpt-section-title" style="border-color:#dc2626;color:#dc2626;">🚨 OSE em Atraso</div>
      <table><thead><tr><th>OSE</th><th>Data Abertura</th><th>Região</th><th>Comarca</th><th>Edificação</th><th>Desc.</th><th>Dias Atraso</th></tr></thead>
      <tbody>${emrAtraso.map(r=>`<tr style="background:#fff5f5;">
        <td><strong>#${r.ose||r.id}</strong></td>
        <td>${fmt(r.data)}</td>
        <td>${r.regiao||'—'}</td>
        <td>${r.comarca||'—'}</td>
        <td>${r.edificacao||'—'}</td>
        <td style="font-size:9px;">${(r.descricao||'').substring(0,60)}${r.descricao&&r.descricao.length>60?'...':''}</td>
        <td style="color:#dc2626;font-weight:700;">${r.dias_atraso||'?'} d</td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}

    ${pciVenc.length > 0 ? `
    <div class="rpt-section">
      <div class="rpt-section-title" style="border-color:#dc2626;color:#dc2626;">🔥 PCI Vencidos</div>
      <table><thead><tr><th>Região</th><th>Comarca</th><th>Edificação</th><th>Tipo</th><th>Qtd</th><th>Validade</th><th>Dias Vencido</th></tr></thead>
      <tbody>${pciVenc.map(r=>`<tr style="background:#fff5f5;">
        <td>${r.regiao||'—'}</td><td>${r.comarca||'—'}</td>
        <td>${r.edificacao||'—'}</td>
        <td style="font-size:9px;">${r.tipo_pci||'—'}</td>
        <td style="text-align:center;">${r.qtd||1}</td>
        <td style="color:#dc2626;font-weight:700;">${fmt(r.validade)}</td>
        <td style="color:#dc2626;font-weight:700;">${Math.abs(dias(r.validade))} d</td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}

    ${perAtraso.length > 0 ? `
    <div class="rpt-section">
      <div class="rpt-section-title" style="border-color:#d97706;color:#d97706;">🔄 Periódicas Atrasadas</div>
      <table><thead><tr><th>Comarca</th><th>Edificação</th><th>Tipo</th><th>Prog. Fim</th><th>Dias Atraso</th><th>Status</th></tr></thead>
      <tbody>${perAtraso.map(r=>`<tr>
        <td>${r.comarca||'—'}</td><td>${r.edificacao||'—'}</td>
        <td style="font-size:9px;">${(r.tipo_atend||'').replace('MANUTENÇÃO PERIÓDICA ','')}</td>
        <td>${fmt(r.prog_fim)}</td>
        <td style="color:#d97706;font-weight:700;">${Math.abs(dias(r.prog_fim))} d</td>
        <td>${badge(r.status)}</td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}

    <div class="rpt-footer">
      <span>COMAP · TJMG — Relatório Gerencial de Pendências</span><span>Emitido em ${now()}</span>
    </div></div>`;

    open(html, 'Relatório de Pendências');
  }

  return { emergencial, periodica, pci, diario, pendencias };
})();
