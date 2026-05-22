'use strict';
// ============================================================
// state.js — Estado global mútavel do app: S, F, US
//             + variáveis de ambiente (URLs Supabase/Drive)
// TJMG Fiscal PWA — Fase 1 da modularização
// Carregar DEPOIS de config.js e data.js.
//
// REGRA: Nunca importar state.js em data.js ou config.js.
//        Dependências apenas na direção: config → data → state → demais.
// ============================================================

var S={sessao:null,insp:[],rflt:'todos',rsts:'todos',ptipo:'todos',dadm:'usuarios',did:null,_lastSync:0,_syncBusy:false};
// F — estado completo do formulário ativo.
// Campos inicializados aqui para garantir que qualquer módulo que leia F
// antes de iniciarF() nunca encontre undefined (normalizeFormState também cobre).
var F={
  tipo:'periodica',et:0,id:'',ets:[],
  d:{com:'',edif:'',grp:'B',polo:'',tv:'trimestral',
     fiscal:'',mat:'',reg:'',os:'',descricao:'',
     dtVistoria:'',dtInicioExec:'',diasPrazo:'',dtFinalExec:'',
     tipo_sub:'AEREA',tipo_manutencao:'ANUAL',tem_pvo:'NAO'},
  itens:{},mats:[],sistemas:[],ativSel:{},
  ativ:'',causas:'',lim:'',normas:'NBR 5674',concl:'',pron:{},
  fach:{FR:{obs:'',nc:false,nd:''},LD:{obs:'',nc:false,nd:''},
        LE:{obs:'',nc:false,nd:''},FU:{obs:'',nc:false,nd:''}},
  schk:{},med:{p1:'',p2:'',p3:'',bep:''},
  sub:null,_ospVinculada:null
};


// ============================================================
// v77-fix: Supabase ativo → projeto `rrlhtnwdokqbtkwrlsfa`
// (substitui o antigo `nvjxylgdnashebaepern`)
// ============================================================
var SUPABASE_URL='https://rrlhtnwdokqbtkwrlsfa.supabase.co';
var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJybGh0bndkb2txYnRrd3Jsc2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQ1NDcsImV4cCI6MjA5MDQ4MDU0N30.aT-XBqF8nFkyn8tfCpI8ptanDgSY_uhNkcowDFkrx-0';
var SUPABASE_PUBLISHABLE_KEY=SUPABASE_ANON_KEY; /* alias — sync.js usa este nome */
/* ── Edge Functions — substituem chamadas diretas ao SDK quando disponíveis ── */
var EDGE_SYNC_URL='https://rrlhtnwdokqbtkwrlsfa.supabase.co/functions/v1/tjmg-sync';
var EDGE_EMAIL_URL='https://rrlhtnwdokqbtkwrlsfa.supabase.co/functions/v1/send-report-email';
/* Segredo compartilhado com a Edge Function.
   SETUP: Supabase Dashboard → Edge Functions → tjmg-sync → Secrets → SYNC_SECRET
   Deve ser idêntico ao valor configurado no painel Supabase.
   ⚠ NUNCA deixar vazio em produção — qualquer cliente poderia fazer push de dados. */
var SYNC_SECRET=''; /* v77: vazio = Edge Function aceita qualquer chamada — definir segredo forte em produção */
// ── Google Drive (Apps Script) ─────────────────────────────────────────────
// URL gerada após publicar o TJMG_Drive.gs como Web App
var DRIVE_SCRIPT_URL='https://script.google.com/macros/s/AKfycbzJsl9A3jweqcxHv0Ibm_2aEeEc4m8F1gGkurGxkcW_TUWpx_PH2ABOaccdYI3AUro/exec';
var SB=null;
