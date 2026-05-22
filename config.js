'use strict';
// ============================================================
// config.js — Constantes, credenciais e metadados do app
// TJMG Fiscal PWA — Fase 1 da modularização
// Carregar ANTES de qualquer outro script do app.
// Variáveis são globais (var) — compatível com classic scripts.
// ============================================================

// VERSÃO CENTRALIZADA — v77
// Manter em sincronia com sw.js (const V) e manifest.json (start_url ?v=)
// ------------------------------------------------------------
var APP_VERSION = 'v77';
/* US é sempre populado por DB.ld() — não pré-definir aqui evita divergência
   entre duas fontes de verdade e elimina o risco de dados obsoletos serem
   enviados ao Supabase antes do pull inicial. */
var US=[];
/* ⚠ SEGURANÇA: credenciais expostas no cliente. Em produção, migrar para autenticação via Supabase Auth. */
var ADM={u:'admin',p:'1530'};
/* ⚠ Idem acima — credenciais de coordenador expostas. */
var COORD={u:'coord',p:'2026'};
var REG={NORTE:{l:'Norte',ct:'CT 017-2026',c:'#2563eb',bg:'#dbeafe'},CENTRAL:{l:'Central',ct:'CT 025-2026',c:'#7c3aed',bg:'#ede9fe'},LESTE:{l:'Leste',ct:'CT 019-2026',c:'#16a34a',bg:'#dcfce7'},ZONA_MATA:{l:'Zona da Mata',ct:'CT 018-2026',c:'#b45309',bg:'#fef3c7'},TRIANGULO:{l:'Tri\u00e2ngulo',ct:'CT 392-2022',c:'#0891b2',bg:'#cffafe'},SUL:{l:'Sul',ct:'CT 138-2023',c:'#be185d',bg:'#fce7f3'},SUDOESTE:{l:'Sudoeste',ct:'CT 421-2022',c:'#65a30d',bg:'#ecfccb'}};
var TIPOS={
  periodica:  {l:'RITMP \u2013 Manuten\u00e7\u00e3o Peri\u00f3dica',c:'#16a34a',bg:'#dcfce7',i:'&#128295;',e:['Dados','Checklist','Materiais','Concluir']},
  ose:        {l:'RITE \u2013 Emergencial',c:'#dc2626',bg:'#fee2e2',i:'&#9889;',e:['Dados','Sistemas','Sel. Atividades','Atividades','Materiais','Concluir']},
  programada: {l:'RITP \u2013 Programada',c:'#2563eb',bg:'#dbeafe',i:'&#128203;',e:['Dados','Sistemas','Sel. Atividades','Atividades','Materiais','Concluir']},
  fachada:    {l:'Fachada',c:'#7c3aed',bg:'#ede9fe',i:'&#127963;',e:['Dados','Fachadas','Conclusao']},
  spda:       {l:'SPDA',c:'#d97706',bg:'#fef3c7',i:'&#9889;',e:['Dados','Inspecao Visual','Medicoes','Conclusao']},
  prontuario: {l:'Laudos, prontuários e diagramas',c:'#0369a1',bg:'#e0f2fe',i:'&#9889;&#65039;',e:['Dados','Documentos','Concluir']},
  subestacao:  {l:'Manutencao Subestacao Anexo B.1',c:'#b45309',bg:'#fef3c7',i:'&#9889;',e:['Dados','Checklist Sub','Concluir']},
  osp:          {l:'OSP – Abertura',c:'#0f766e',bg:'#ccfbf1',i:'&#128221;',e:['Dados OSP','Sistemas','Sel. Atividades','Atividades','Materiais','Concluir']}
};
var ST={
  pendente:     {l:'Pendente',    e:'&#9203;',c:'#94a3b8',bg:'#f1f5f9'},
  conforme:     {l:'Conforme',    e:'&#9989;',c:'#16a34a',bg:'#dcfce7'},
  nao_conforme: {l:'N\u00e3o Conf.',e:'&#10060;',c:'#dc2626',bg:'#fee2e2'},
  nao_aplicavel:{l:'N/A',         e:'&#10134;',c:'#64748b',bg:'#f1f5f9'},
  fora_periodo: {l:'Fora Per.',   e:'&#128260;',c:'#d97706',bg:'#fef3c7'},
  programado:   {l:'Programado',  e:'&#128203;',c:'#7c3aed',bg:'#ede9fe'},
  executado:    {l:'Executado',   e:'&#9989;',c:'#16a34a',bg:'#dcfce7'},
  nao_executado:{l:'Não Exec.',  e:'&#10060;',c:'#dc2626',bg:'#fee2e2'},
  em_execucao:  {l:'Em Execução',e:'&#9881;',c:'#d97706',bg:'#fef3c7'}
};
var SIS=[
  {id:'1',n:'1.0',nm:'Instala\u00e7\u00f5es Civis'},
  {id:'2',n:'2.0',nm:'Instala\u00e7\u00f5es Hidrossanit\u00e1rias'},
  {id:'3',n:'3.0',nm:'SPCIP - Preven\u00e7\u00e3o e Combate a Inc\u00eandio'},
  {id:'4',n:'4.0',nm:'Instala\u00e7\u00f5es e Sistemas El\u00e9tricos'},
  {id:'5',n:'5.0',nm:'Rede de Voz e Dados'},
  {id:'6',n:'6.0',nm:'Bombeamento e Motoriza\u00e7\u00f5es'},
  {id:'7',n:'7.0',nm:'Infraestrutura de GLP'}
];

// ── TCOR: Cores por tipo de relatório (movido do inline do index.html — Bug 2 fix) ──
var TCOR={periodica:'#003580',ose:'#dc2626',programada:'#2563eb',fachada:'#7c3aed',spda:'#d97706',prontuario:'#0369a1',subestacao:'#b45309',osp:'#0f766e'};
