'use strict';
// ============================================================
// utils.js — Utilitários, controle de acesso, PCI helpers
// TJMG Fiscal PWA — Fase 4 da modularização
// Dependências: state.js (S), data.js (PCI_DATA)
// window-exports: el, cm, cf, Tt, uid, ini, fdt, fdth,
//                 ovals, oentries, isGlobal, canDelInsp,
//                 filterByReg, pciSt, pciDataForUser
// ============================================================

function ini(n){if(!n)return'';var p=(n+'').split(' ').filter(function(x){return x.length>0;}).slice(0,2);return p.map(function(x){return x[0].toUpperCase();}).join('');}
function fdt(x){if(x==null)return'-';try{var d=new Date(x);if(isNaN(d.getTime()))return'-';return d.toLocaleDateString('pt-BR');}catch(e){return'-';}}
function fdth(x){if(x==null)return'-';try{var d=new Date(x);if(isNaN(d.getTime()))return'-';return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){return'-';}}
function uid(){if(crypto&&crypto.randomUUID)return crypto.randomUUID();return Math.random().toString(36).slice(2)+Date.now().toString(36);}
function Tt(m){var e=document.getElementById('toast');e.textContent=m;e.classList.add('show');setTimeout(function(){e.classList.remove('show');},2500);}
function cm(id){document.getElementById(id).style.display='none';}
function el(id){return document.getElementById(id);}
function cf(ico,tit,msg,cb){el('ci').textContent=ico;el('ct').textContent=tit;el('cm_t').textContent=msg;el('cok').onclick=function(){cm('m-cf');cb();};el('m-cf').style.display='flex';}

// ── Controle de acesso por região ─────────────────────────────────────────
function isGlobal(s){
  s=s||S.sessao;
  return !!(s&&(s.tipo==='admin'||s.tipo==='coordenador'));
}
function canDelInsp(i){
  var s=S.sessao;
  if(!s)return false;
  if(s.tipo==='coordenador')return false;
  if(s.tipo==='admin')return !!(i&&i.st==='finalizada');
  return !!(i&&(!i.reg||i.reg===s.reg));
}
function filterByReg(lista){
  var s=S.sessao;
  if(isGlobal(s))return lista;
  var reg=s.reg;
  if(!reg)return lista;
  return lista.filter(function(i){return !i.reg||i.reg===reg;});
}

// ── PCI por região ────────────────────────────────────────────────────────
var PCI_BY_REG={
  NORTE:     PCI_DATA,
  CENTRAL:   [],
  LESTE:     [],
  ZONA_MATA: [],
  TRIANGULO: [],
  SUL:       [],
  SUDOESTE:  []
};
var PCI_READY={NORTE:true,CENTRAL:false,LESTE:false,ZONA_MATA:false,TRIANGULO:false,SUL:false,SUDOESTE:false};

function pciDataForUser(){
  var s=S.sessao;
  if(isGlobal(s)){
    var all=[];
    Object.keys(PCI_BY_REG).forEach(function(k){all=all.concat(PCI_BY_REG[k]||[]);});
    return all;
  }
  return PCI_BY_REG[s.reg]||[];
}

function pciSt(val){
  if(!val)return{s:'SEM DATA',bg:'#f1f5f9',c:'#64748b'};
  var h=new Date();h.setHours(0,0,0,0);
  var v=new Date(val+'T00:00:00');var d=Math.floor((v-h)/86400000);
  if(d<0)return{s:'VENCIDO',bg:'#fee2e2',c:'#dc2626'};
  if(d<=30)return{s:'30d',bg:'#ffedd5',c:'#ea580c'};
  if(d<=60)return{s:'60d',bg:'#fef9c3',c:'#ca8a04'};
  return{s:'VIGENTE',bg:'#dcfce7',c:'#16a34a'};
}

function ovals(o){return Object.keys(o).map(function(k){return o[k];});}
function oentries(o){return Object.keys(o).map(function(k){return[k,o[k]];});}

// ── Expor para onclick inline ─────────────────────────────────────────────
window.el            = el;
window.cm            = cm;
window.cf            = cf;
window.Tt            = Tt;
window.uid           = uid;
window.ini           = ini;
window.fdt           = fdt;
window.fdth          = fdth;
window.ovals         = ovals;
window.oentries      = oentries;
window.isGlobal      = isGlobal;
window.canDelInsp    = canDelInsp;
window.filterByReg   = filterByReg;
window.pciSt         = pciSt;
window.pciDataForUser= pciDataForUser;

// ── Helpers de inputs numéricos (movido do inline do index.html — Bug 4 fix) ──
function _spf(v){return parseFloat(((v||'')+'').replace(',','.'))||0;}
function _iCor(v,min){if(!v)return '#e2e8f0';return _spf(v)>=min?'#16a34a':'#dc2626';}
function _iLbl(v,min){if(!v)return 'min. '+min;return _spf(v)>=min?'OK':'FORA';}
function _iCorMax(v,w,crit){if(!v)return '#e2e8f0';var n=_spf(v);return n>crit?'#dc2626':n>w?'#f59e0b':'#16a34a';}
function _iLblMax(v,w,crit){if(!v)return 'max. '+w;var n=_spf(v);return n>crit?'CRÍTICO':n>w?'ATENÇÃO':'OK';}

window._spf       = _spf;
window._iCor      = _iCor;
window._iLbl      = _iLbl;
window._iCorMax   = _iCorMax;
window._iLblMax   = _iLblMax;
