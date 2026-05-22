/* ── v76: Botão sync no header do coordenador ── */
var _coordSyncBusy=false;
async function syncCoord(){
  var btn=document.getElementById('btn-coord-sync');
  if(_coordSyncBusy){Tt('☁️ Já sincronizando...');return;}
  if(!navigator.onLine){Tt('⚠️ Sem conexão');if(typeof _coordAtualizarStatusBar==='function')_coordAtualizarStatusBar();return;}
  if(!Sync.ready){Tt('Sync não configurado');return;}
  _coordSyncBusy=true;
  if(btn){btn.disabled=true;btn.textContent='⏳';}
  if(typeof _coordAtualizarStatusBar==='function')_coordAtualizarStatusBar('sincronizando');
  Tt('☁️ Buscando dados de todas as regiões...');
  try{
    await Sync.pullAll();
    await new Promise(function(r){Sync.schedulePush(200);setTimeout(r,1000);});
    S._lastSync=Date.now();S._lastSyncCoord=Date.now();
    localStorage.setItem('_lastSyncCoord',String(S._lastSyncCoord));
    try{localStorage.removeItem('_pendingPush');}catch(e){}
    DB.sv();
    var _fin=S.insp.filter(function(i){return i.st==='finalizada';}).length;
    var _rasc=S.insp.filter(function(i){return i.st==='em_andamento';}).length;
    Tt('✅ '+_fin+' enviado(s), '+_rasc+' rascunho(s) — '+S.insp.length+' total');
    rCoord();
  }catch(e){Tt('⚠️ Erro: '+(e&&e.message?e.message:'falha de rede'));}
  finally{_coordSyncBusy=false;if(btn){btn.disabled=false;btn.textContent='🔄 Sync';}if(typeof _coordAtualizarStatusBar==='function')_coordAtualizarStatusBar();}
}
function _coordAtualizarStatusBar(estado){
  var dot=document.getElementById('coord-net-dot');
  var lbl=document.getElementById('coord-net-lbl');
  var ts=document.getElementById('coord-sync-ts');
  if(!dot||!lbl)return;
  var online=navigator.onLine;
  if(estado==='sincronizando'){dot.style.background='#f59e0b';lbl.textContent='Sincronizando...';}
  else if(online){dot.style.background='#16a34a';lbl.textContent='Online';}
  else{dot.style.background='#dc2626';lbl.textContent='Offline — dados salvos localmente';}
  if(ts){var _lsc=S._lastSyncCoord||parseInt(localStorage.getItem('_lastSyncCoord')||'0');
    if(!_lsc)ts.textContent='Nunca sincronizado';
    else{var d=Math.round((Date.now()-_lsc)/60000);ts.textContent=d<1?'Sync: agora':d<60?'Sync: '+d+'min atrás':'Sync: '+Math.round(d/60)+'h atrás';}}
}

'use strict';
// ============================================================
function _escA(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// auth.js — Autenticação, Logout e Telas de Coordenação
// TJMG Fiscal PWA — Fase 4 da modularização
// Dependências: state.js (S, US, ADM, COORD, REG, TIPOS),
//               utils.js (el, cm, cf, Tt, fdt, oentries, ini),
//               router.js (G, Gb, BNS, bH),
//               db.js (DB), report-html.js (exportHTML)
// window-exports: rLogin, openPin, kp, kpOK, openAdm, loginAdm,
//                 logout, openCoord, loginCoord, rCoord,
//                 coordToggleSel, coordSelAll, coordExpSel,
//                 openDetCoord
// ============================================================

function rLogin(){
  var por={};
  US.filter(function(u){return u.ativo;}).forEach(function(u){
    if(!por[u.reg])por[u.reg]=[];
    por[u.reg].push(u);
  });
  var h='';
  Object.keys(por).forEach(function(r){
    var us=por[r];
    var R=REG[r]||{l:r,c:'#64748b',bg:'#f1f5f9'};
    h+='<div style="border-left:4px solid '+R.c+';padding-left:10px;margin:10px 0 6px;">';
    h+='<div style="font-size:10px;font-weight:700;color:'+R.c+';text-transform:uppercase;letter-spacing:1px;">';
    h+='Regiao '+R.l+'</div></div>';
    us.forEach(function(u){
      h+='<div class="card" onclick="openPin(\''+u.id+'\')" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer;">';
      h+='<div class="av" style="width:42px;height:42px;font-size:14px;background:'+R.c+';">'+ini(u.nome)+'</div>';
      h+='<div style="flex:1;">';
      h+='<div style="font-size:13px;font-weight:700;">'+_escA(u.nome)+'</div>';
      h+='<div style="font-size:11px;color:#64748b;">'+_escA(u.cargo)+' - '+_escA(u.polo)+'</div>';
      h+='</div>';
      h+='<span class="bdg" style="background:'+R.bg+';color:'+R.c+';">'+R.l+'</span>';
      h+='</div>';
    });
  });
  el('ll').innerHTML=h;
}
var _pid='',_pbuf='';
function openPin(id){
  var u=US.find(function(x){return x.id===id;});if(!u)return;
  var R=REG[u.reg]||{c:'#003580'};_pid=id;_pbuf='';
  el('mav').textContent=ini(u.nome);el('mav').style.background=R.c;
  el('mnm').textContent=u.nome;el('mcg').textContent=u.cargo;
  el('perr').textContent='';rpd();el('m-pin').style.display='flex';
}
function rpd(){for(var i=0;i<4;i++)el('pd'+i).classList.toggle('on',i<_pbuf.length);}
function cancelPin(){_pbuf="";_pid="";rpd();cm("m-pin");}
function kp(n){if(n===-1){_pbuf=_pbuf.slice(0,-1);rpd();el('perr').textContent='';return;}if(_pbuf.length<4){_pbuf+=String(n);rpd();if(_pbuf.length===4)setTimeout(doLogin,120);}}
function kpOK(){doLogin();}
function doLogin(){
  var u=US.find(function(x){return x.id===_pid;});if(!u)return;
  if(_pbuf!==u.pin){el('perr').textContent='PIN incorreto. Tente novamente.';_pbuf='';rpd();return;}
  S.sessao={tipo:'usuario',userId:u.id,nome:u.nome,mat:u.mat,reg:u.reg,cargo:u.cargo,polo:u.polo||'',_t:Date.now()};
  DB.sv();cm('m-pin');rHome();G('s-home');BNS.forEach(function(id){var e=el(id);if(e)e.innerHTML=bH('home');});
}
function openAdm(){el('au').value='';el('ap').value='';el('ae').textContent='';el('m-adm').style.display='flex';}
function loginAdm(){
  var u=el('au').value.trim();var p=el('ap').value.trim();
  if(u===ADM.u&&p===ADM.p){S.sessao={tipo:'admin',userId:'admin',nome:'Administrador',reg:null,cargo:'Admin',polo:'',_t:Date.now()};DB.sv();cm('m-adm');rAdm();G('s-admin');}
  else el('ae').textContent='Usuario ou PIN incorretos.';
}
function logout(){cf('X','Sair','Encerrar sua sessao?',function(){S.sessao=null;localStorage.removeItem('ts');rLogin();Gb('s-login');});}
function openCoord(){el('cu').value='';el('cp').value='';el('ce').textContent='';el('m-coord').style.display='flex';}
function loginCoord(){
  var u=el('cu').value.trim();var p=el('cp').value.trim();
  if(u===COORD.u&&p===COORD.p){
    S.sessao={tipo:'coordenador',userId:'coord',nome:'Coordenador',reg:null,cargo:'Coordenador',polo:'',_t:Date.now()};
    DB.sv();cm('m-coord');rCoord();G('s-coord');
    setTimeout(function(){if(navigator.onLine&&Sync.ready&&typeof syncCoord==='function')syncCoord();},800);
  } else el('ce').textContent='Usuário ou PIN incorretos.';
}
function rCoord(){
  var sub=el('coord-sub');
  if(sub)sub.textContent=S.insp.length+' relatório(s) no sistema';
  /* ── Filtro de REGIÃO ── */
  S._coordReg=S._coordReg||'todos';
  var regFlt=el('coord-reg-flt');
  if(regFlt){
    var rh='<button onclick="S._coordReg=\'todos\';S._coordSel=[];rCoord()" style="border:none;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;background:'+(S._coordReg==='todos'?'#7c3aed':'#f1f5f9')+';color:'+(S._coordReg==='todos'?'#fff':'#64748b')+';margin-bottom:2px;">Todas</button>';
    Object.keys(REG).forEach(function(rk){var R=REG[rk];rh+='<button onclick="S._coordReg=\''+rk+'\';S._coordSel=[];rCoord()" style="border:none;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;background:'+(S._coordReg===rk?R.c:'#f1f5f9')+';color:'+(S._coordReg===rk?'#fff':'#64748b')+';margin-bottom:2px;">'+R.l+'</button>';});
    regFlt.innerHTML=rh;
  }
  /* ── Filtro de TIPO ── */
  var tipos_keys=['todos'].concat(Object.keys(TIPOS));
  var nl={todos:'Todos',periodica:'RITMP',ose:'RITE – Emergencial',programada:'RITP – Programada',osp:'OSP – Abertura',fachada:'Fachada',spda:'SPDA',prontuario:'Laudos',subestacao:'Subestação'};
  var fltEl=el('coord-flt');
  if(fltEl)fltEl.innerHTML=tipos_keys.map(function(f){var sel=S.rflt===f;return'<button onclick="S.rflt=\''+f+'\';rCoord()" style="border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;background:'+(sel?'#7c3aed':'#f1f5f9')+';color:'+(sel?'#fff':'#64748b')+';">'+( nl[f]||f)+'</button>';}).join('');
  /* ── Base filtrada ── */
  var _cbEl=el('coord-busca');var _cb=_cbEl?_cbEl.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''):'';
  S._coordSel=S._coordSel||[];
  var _cReg=S._coordReg||'todos';
  var base=S.insp.filter(function(i){
    if(_cReg!=='todos'&&i.reg!==_cReg)return false;
    if(S.rflt!=='todos'&&i.tipo!==S.rflt)return false;
    if(_cb){var txt=((i.com||'')+' '+(i.edif||'')+' '+(i.fiscal||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(txt.indexOf(_cb)<0)return false;}
    return true;
  });
  var r2=base.filter(function(i){return i.st==='em_andamento';});
  var e2=base.filter(function(i){return i.st==='finalizada';});
  var allIds=base.map(function(i){return i.id;});
  var nSel=S._coordSel.length;
  var todosSelected=allIds.length>0&&allIds.every(function(id){return S._coordSel.indexOf(id)!==-1;});
  /* ── Barra de seleção ── */
  var selBar=el('coord-sel-bar');
  if(selBar){
    if(nSel>0){
      selBar.style.display='block';
      selBar.innerHTML='<div style="background:#7c3aed;padding:10px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
        +'<span style="font-size:12px;font-weight:800;color:#fff;flex:1;">'+nSel+' selecionada(s)</span>'
        +'<button onclick="coordExpSel()" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer;">📄 Exportar HTML</button>'
        +'<button onclick="coordExpSelPDF()" style="background:#1a2332;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer;margin-left:6px;">📄 Exportar PDF</button>'
        +'<button onclick="S._coordSel=[];rCoord()" style="background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:8px;padding:7px 10px;font-size:11px;cursor:pointer;">✕ Limpar</button>'
        +'</div>';
    }else{selBar.style.display='none';selBar.innerHTML='';}
  }
  var lstEl=el('coord-lst');
  if(!lstEl)return;
  if(!base.length){lstEl.innerHTML='<div style="text-align:center;padding:48px;"><div style="font-size:48px;">📋</div><div style="font-size:14px;color:#94a3b8;margin-top:12px;font-weight:600;">Nenhum relatório encontrado</div></div>';return;}
  /* ── Botão selecionar todos ── */
  var h='<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #f1f5f9;">'
    +'<button onclick="coordSelAll()" style="border:1px solid #e2e8f0;background:'+(todosSelected?'#7c3aed':'#f8fafc')+';color:'+(todosSelected?'#fff':'#64748b')+';border-radius:8px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;">'+(todosSelected?'☑ Desmarcar todos':'☐ Selecionar todos')+'</button>';
  if(nSel>0)h+='<span style="font-size:11px;color:#7c3aed;font-weight:700;">'+nSel+' de '+allIds.length+' selecionada(s)</span>';
  h+='</div>';
  /* ── Card ── */
  function _crd(i){
    var t=TIPOS[i.tipo]||TIPOS.periodica;
    var st=i.st==='finalizada'?{l:'Enviado',bg:'#dcfce7',c:'#16a34a'}:{l:'Rascunho',bg:'#fef3c7',c:'#d97706'};
    var reg=i.reg||'';var R=REG[reg]||{c:'#64748b',bg:'#f1f5f9',l:reg};
    var sel=S._coordSel.indexOf(i.id)!==-1;
    var fin=i.st==='finalizada';
    return'<div class="card" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;border:2px solid '+(sel?'#7c3aed':'transparent')+';cursor:pointer;" onclick="coordToggleSel(\''+i.id+'\')">'      +'<div style="width:22px;height:22px;border-radius:6px;border:2px solid '+(sel?'#7c3aed':'#cbd5e1')+';background:'+(sel?'#7c3aed':'#fff')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#fff;">'+(sel?'✓':'')+'</div>'      +'<div style="width:34px;height:34px;border-radius:9px;background:'+t.bg+';display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">'+t.i+'</div>'      +'<div style="flex:1;min-width:0;">'        +'<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_escA(i.edif)+'</div>'        +'<div style="font-size:10px;color:#64748b;">'+_escA(i.com||'-')+' · '+fdt(i.dtVistoria||i.data)+'</div>'        +'<div style="display:flex;gap:3px;margin-top:3px;flex-wrap:wrap;">'          +'<span class="bdg" style="background:'+t.bg+';color:'+t.c+';">'+t.l+'</span>'          +'<span class="bdg" style="background:'+st.bg+';color:'+st.c+';">'+st.l+'</span>'          +(reg?'<span class="bdg" style="background:'+R.bg+';color:'+R.c+';">'+R.l+'</span>':'')+'</div>'      +'</div>'      +'<div style="display:flex;flex-direction:column;gap:4px;" onclick="event.stopPropagation();">'        +'<button class="btn bo" style="padding:5px 10px;width:auto;font-size:11px;" onclick="openDet(\''+i.id+'\')">👁 Ver</button>'        +(fin?'<button class="btn" style="padding:5px 10px;width:auto;font-size:11px;background:#003580;color:#fff;" onclick="exportHTML(\''+i.id+'\')">📄 HTML</button>':'')
      +(fin?'<button class="btn" style="padding:5px 10px;width:auto;font-size:11px;background:#1a2332;color:#fff;margin-left:3px;" onclick="exportPDF(\''+i.id+'\')">📄 PDF</button>':'')+'</div>'    +'</div>';
  }
  if(r2.length){h+='<div class="sec" style="padding:10px 12px 4px;">Rascunhos ('+r2.length+')</div>';h+=r2.map(_crd).join('');}
  if(e2.length){h+='<div class="sec" style="padding:10px 12px 4px;margin-top:'+(r2.length?'8':'0')+'px">Enviados ('+e2.length+')</div>';h+=e2.map(_crd).join('');}
  lstEl.innerHTML=h;
}
function coordToggleSel(id){
  S._coordSel=S._coordSel||[];
  var idx=S._coordSel.indexOf(id);
  if(idx===-1)S._coordSel.push(id);else S._coordSel.splice(idx,1);
  rCoord();
}
function coordSelAll(){
  var _cReg=S._coordReg||'todos';
  var base=S.insp.filter(function(i){return _cReg==='todos'||i.reg===_cReg;});
  if(S.rflt!=='todos')base=base.filter(function(i){return i.tipo===S.rflt;});
  var allIds=base.map(function(i){return i.id;});
  S._coordSel=S._coordSel||[];
  var todosSelected=allIds.every(function(id){return S._coordSel.indexOf(id)!==-1;});
  S._coordSel=todosSelected?[]:allIds.slice();
  rCoord();
}
function coordExpSel(){
  S._coordSel=S._coordSel||[];
  var ids=S._coordSel.filter(function(id){var i=S.insp.find(function(x){return x.id===id;});return i&&i.st==='finalizada';});
  if(!ids.length){Tt('Nenhuma finalizada selecionada para exportar');return;}
  Tt('Exportando '+ids.length+' relatório(s)...');
  ids.forEach(function(id,idx){setTimeout(function(){exportHTML(id);},idx*600);});
}
function openDetCoord(id){
  S.did=id;
  var i=S.insp.find(function(x){return x.id===id;});if(!i)return;
  var t=TIPOS[i.tipo]||TIPOS.periodica;
  el('dt').textContent=i.edif;
  el('ds').textContent=t.l+' - '+(i.com||'-')+' - '+fdt(i.dtVistoria||i.data);
  var _osp=i.tipo==='ose'||i.tipo==='programada'||i.tipo==='osp';
  var _cor=TCOR[i.tipo]||'#7c3aed';

  /* Filtra por ativSel para OSE/Programada */
  var _ativSelKeys=i.ativSel||{};
  var _hasSel=_osp&&Object.keys(_ativSelKeys).some(function(k){return !!_ativSelKeys[k];});
  var its=oentries(i.itens||{}).filter(function(e){
    if(!_osp)return true;
    if(!_hasSel)return e[1].s!=='nao_aplicavel';
    var _aid=e[0].replace(/^[^_]*_/,'');
    return !!_ativSelKeys[_aid];
  });

  var atv=its.filter(function(e){return e[1].s!=='fora_periodo'&&e[1].s!=='nao_aplicavel';});
  var fet=_osp?its.filter(function(e){return e[1].s==='executado';})
              :its.filter(function(e){return e[1].s==='conforme'||e[1].s==='nao_conforme';});
  var prb=_osp?its.filter(function(e){return e[1].s==='nao_executado';}).length
              :its.filter(function(e){return e[1].s==='nao_conforme';}).length;
  var pct=atv.length?Math.round(fet.length/atv.length*100):0;

  var sim={};
  its.forEach(function(e){
    var v=e[1];var sk=v.sk||'?';
    if(!sim[sk])sim[sk]={nm:v.sn||'',nn:v.snn||'',its:[]};
    sim[sk].its.push({s:v.s,nm:v.nm,obs:v.obs,_k:e[0]});
  });

  var h='<div class="card"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
    +'<div style="font-size:28px;font-weight:900;color:'+_cor+';">'+pct+'%</div>'
    +'<div style="flex:1;"><div class="pb"><div class="pf" style="width:'+pct+'%;background:'+_cor+';"></div></div>'
    +'<div style="font-size:10px;color:#64748b;margin-top:3px;">'+fet.length+'/'+atv.length+' itens'+(prb?' - '+prb+' problema(s)':'')+'</div>'
    +'</div></div><div style="display:flex;justify-content:space-around;">';
  Object.keys(ST).forEach(function(k){var v=ST[k];h+='<div style="text-align:center;"><div>'+v.e+'</div><div style="font-size:10px;font-weight:700;">'+its.filter(function(e){return e[1].s===k;}).length+'</div></div>';});
  h+='</div></div>';

  Object.keys(sim).forEach(function(sk){
    var s=sim[sk];
    if(!s.its.length)return;
    var a=s.its.filter(function(x){return x.s!=='fora_periodo'&&x.s!=='nao_aplicavel';});
    var f=_osp?s.its.filter(function(x){return x.s==='executado';})
              :s.its.filter(function(x){return x.s==='conforme'||x.s==='nao_conforme';});
    var p=a.length?Math.round(f.length/a.length*100):0;
    h+='<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.09);margin-bottom:10px;">';
    h+='<div style="background:'+_cor+';color:#fff;padding:9px 12px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">';
    h+='<div><div style="font-size:12px;font-weight:700;">'+s.nn+' '+s.nm+'</div><div style="font-size:10px;opacity:.8;">'+f.length+'/'+a.length+'</div></div>';
    h+='<span style="background:'+(p>=100?'#dcfce7':p>=50?'#fef9c3':'#fee2e2')+';color:'+(p>=100?'#16a34a':p>=50?'#d97706':'#dc2626')+';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:800;">'+p+'%</span></div>';
    /* Sempre expandido — sem toggle */
    h+='<div style="display:block;">';
    s.its.forEach(function(it){
      var stv=ST[it.s||'pendente']||ST.pendente;
      h+='<div class="prow"><div style="flex:1;">'+it.nm+'</div>'
        +'<span class="pst" style="background:'+stv.bg+';color:'+stv.c+';">'+stv.e+' '+stv.l+'</span>'
        +(it.obs?'<div style="font-size:10px;color:#64748b;margin-top:2px;">'+it.obs+'</div>':'')
        +'</div>';
    });
    h+='</div></div>';
  });

  if(i.tipo==='osp'&&(i.dtInicioExec||i.dtFinalExec)){
    h+='<div class="card" style="border-left:4px solid #0f766e;margin-bottom:8px;">';
    h+='<div style="font-size:11px;font-weight:800;color:#0f766e;margin-bottom:8px;">📅 Prazos da OS Programada</div>';
    h+='<div style="display:flex;gap:8px;">';
    if(i.dtInicioExec)h+='<div style="flex:1;text-align:center;"><div style="font-size:9px;color:#64748b;">Início</div><div style="font-size:12px;font-weight:700;color:#0f766e;">'+fdt(i.dtInicioExec)+'</div></div>';
    if(i.diasPrazo)h+='<div style="flex:1;text-align:center;"><div style="font-size:9px;color:#64748b;">Prazo</div><div style="font-size:12px;font-weight:700;color:#0f766e;">'+i.diasPrazo+'d</div></div>';
    if(i.dtFinalExec)h+='<div style="flex:1;text-align:center;"><div style="font-size:9px;color:#64748b;">Final</div><div style="font-size:12px;font-weight:700;color:#15803d;">'+fdt(i.dtFinalExec)+'</div></div>';
    h+='</div></div>';
  }
  h+='<button class="btn" style="background:'+_cor+';color:#fff;" onclick="exportHTML(\''+id+'\')">&#128196; Exportar HTML</button>';
  h+='<button class="btn" style="background:#1a2332;color:#fff;margin-top:6px;" onclick="exportPDF(\''+id+'\')">📄 Exportar PDF</button>';
  h+='<div style="height:16px;"></div>';
  el('dbody').innerHTML=h;
  if(i.tipo==='prontuario'){el('dbody').innerHTML=renderDetPron(i);}
  var dd=el('det-del');if(dd)dd.style.display='none';
  G('s-det');
}

// ── Expor para onclick inline ─────────────────────────────────────────────
window.rLogin         = rLogin;
window.openPin        = openPin;
window.kp             = kp;
window.kpOK           = kpOK;
window.openAdm        = openAdm;
window.loginAdm       = loginAdm;
window.logout         = logout;
window.openCoord      = openCoord;
window.loginCoord     = loginCoord;
window.rCoord         = rCoord;
window.syncCoord       = syncCoord;
window.coordToggleSel = coordToggleSel;
window.coordSelAll    = coordSelAll;
window.coordExpSel    = coordExpSel;
window.openDetCoord   = openDetCoord;
window.cancelPin      = cancelPin;
/* coordExpSelPDF definida no script inline do index.html — já é global, não precisa re-exportar */
