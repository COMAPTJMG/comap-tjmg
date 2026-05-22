'use strict';
// ============================================================
// router.js — Navegação entre telas: G, Gb, navt, bH
// TJMG Fiscal PWA — Fase 4 da modularização
// Dependências: utils.js (el), state.js (S)
// window-exports: G, Gb, navt, bH, BNS
// ============================================================

function G(id){var c=document.querySelector('.scr.act');var n=el(id);if(!n||c===n)return;if(c){c.classList.add('bk');setTimeout(function(){c.classList.remove('act','bk');},300);}n.classList.add('act');}
function Gb(id){var c=document.querySelector('.scr.act');var n=el(id);if(!n||c===n)return;c.classList.remove('act');n.classList.add('act');}
var BNS=['bn0','bn1','bn2','bn3'];
function bH(act){
  var ts=[{id:'home',i:'&#127968;',l:'Inicio'},{id:'tipos',i:'+',l:'Novo'},{id:'rel',i:'&#128196;',l:'Relatorios'},{id:'perf',i:'&#128100;',l:'Perfil'}];
  var h='';
  ts.forEach(function(t){
    var on=t.id===act;
    h+='<button class="tab" onclick="navt(\'' +t.id+ '\')">';
    h+='<span class="ti'+(on?' on':'')+'">'+(t.i)+'</span>';
    h+='<span class="tl'+(on?' on':'')+'">'+(t.l)+'</span>';
    if(on)h+='<div class="pip"></div>';
    h+='</button>';
  });
  return h;
}
function navt(t){
  var m={home:{s:'s-home',r:rHome},tipos:{s:'s-tipos',r:rTipos},rel:{s:'s-rel',r:rRel},perf:{s:'s-perfil',r:rPerf}};
  var x=m[t];if(!x)return;x.r();
  BNS.forEach(function(id){var e=el(id);if(e)e.innerHTML=bH(t);});
  var c=document.querySelector('.scr.act');var n=el(x.s);if(!n||c===n)return;if(c)c.classList.remove('act');n.classList.add('act');
}

// ── Expor para onclick inline ─────────────────────────────────────────────
window.G    = G;
window.Gb   = Gb;
window.navt = navt;
window.bH   = bH;
window.BNS  = BNS;
