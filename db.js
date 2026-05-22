'use strict';
// ============================================================
// db.js — Persistência local (DB) + autoSave
// TJMG Fiscal PWA — Fase 2 da modularização
// Dependências (globais): S, US, PhotoStore, Sync, Tt, el
//   normalizeFormState, syncDraftFromF (carregados depois,
//   chamados apenas em runtime pelo autosave)
// ============================================================

var autoSaveTimer=null,autoSaveLastHash='',autoSaveLastAt=0;
function activeScreenId(){var a=document.querySelector('.scr.act');return a?a.id:'';}
function computeDraftHash(){
  if(!F||!F.id)return '';
  try{normalizeFormState(F);return JSON.stringify(F);}catch(e){return '';}
}
function saveRascunhoAuto(force){
  if(!F||!F.id)return false;
  if(!S.sessao)return false; /* sessão expirada: não salva/sincroniza */
  if(!force&&activeScreenId()!=='s-form')return false;
  try{
    normalizeFormState(F);
    var snap=JSON.stringify(F);
    if(!force&&snap===autoSaveLastHash)return false;
    syncDraftFromF(false);
    /* FIX v73: beforeunload/visibilitychange precisam de save SÍNCRONO
       pois o setTimeout de DB.sv() pode não disparar antes do unload */
    if(force){DB.svSync();}else{DB.sv();}
    var _asEl=el('autosave-ind');if(_asEl){var _now=new Date();_asEl.textContent='Salvo '+_now.getHours().toString().padStart(2,'0')+':'+_now.getMinutes().toString().padStart(2,'0');}
    autoSaveLastHash=snap;
    autoSaveLastAt=Date.now();
    return true;
  }catch(e){console.warn('Autosave falhou',e);return false;}
}
function startAutoSave(){
  if(autoSaveTimer)return;
  autoSaveTimer=setInterval(function(){saveRascunhoAuto(false);},5000);
}
function stopAutoSave(){
  if(autoSaveTimer){clearInterval(autoSaveTimer);autoSaveTimer=null;}
}

/* ── PhotoStore: IndexedDB para fotos (ilimitado, offline) ──────────────── */
var DB={
  /* ── FIX v73: Helper interno para remover fotos de um clone de inspeção ──
     Remove base64 de itens, snap.itens e sub/snap.sub para evitar
     QuotaExceededError no localStorage (BUG PRINCIPAL de perda de dados) */
  _stripFotos:function(clone,orig){
    /* 1) Itens principais */
    Object.keys(clone.itens||{}).forEach(function(k){
      var item=clone.itens[k];if(!item)return;
      var fotos=item.fotos||[];
      if(fotos.length&&orig){PhotoStore.put(orig.id+'::'+k,fotos);}
      item.fotos=[];
    });
    /* 2) FIX CRÍTICO: snap.itens também contém fotos — causa QuotaExceededError!
       O snap é o estado serializado do formulário (F) que inclui fotos completas.
       Ao salvar no localStorage, as fotos do snap inflam o JSON e causam quota cheia,
       o que aciona localStorage.removeItem('ti') e apaga TODOS os dados. */
    if(clone.snap&&clone.snap.itens){
      Object.keys(clone.snap.itens).forEach(function(k){
        var it=clone.snap.itens[k];if(it)it.fotos=[];
      });
    }
    /* 3) Sub principal */
    if(clone.sub){
      if(orig)PhotoStore.putSubAll(clone.id,orig.sub||{});
      if(clone.sub.chk)Object.keys(clone.sub.chk).forEach(function(k){if(clone.sub.chk[k])clone.sub.chk[k].fotos=[];});
      if(clone.sub.trafos)clone.sub.trafos.forEach(function(t){t.fotos_ttr=[];t.fotos_iso=[];t.fotos_ohm=[];});
      if(clone.sub.disjs)clone.sub.disjs.forEach(function(d){d.fotos_iso=[];d.fotos_cr=[];});
      if(clone.sub.secc)clone.sub.secc.forEach(function(s){s.fotos_iso=[];s.fotos_cr=[];});
    }
    /* 4) FIX CRÍTICO: snap.sub também pode ter fotos (mesmo problema do snap.itens) */
    if(clone.snap&&clone.snap.sub){
      var ss=clone.snap.sub;
      if(ss.chk)Object.keys(ss.chk).forEach(function(k){if(ss.chk[k])ss.chk[k].fotos=[];});
      if(ss.trafos)ss.trafos.forEach(function(t){t.fotos_ttr=[];t.fotos_iso=[];t.fotos_ohm=[];});
      if(ss.disjs)ss.disjs.forEach(function(d){d.fotos_iso=[];d.fotos_cr=[];});
      if(ss.secc)ss.secc.forEach(function(s){s.fotos_iso=[];s.fotos_cr=[];});
    }
    return clone;
  },
  /* ── Núcleo do save: pode rodar síncrono (force=true) ou via setTimeout ── */
  _execSv:function(notifyUI){
    var self=this;
    try{
      var inspSemFotos=S.insp.map(function(insp){
        var clone=JSON.parse(JSON.stringify(insp));
        return self._stripFotos(clone,insp);
      });
      /* Persiste no IDB (sem limite de quota) */
      PhotoStore.putAllInsp(inspSemFotos);
      /* Tenta localStorage (boot rápido); tolera quota cheia */
      try{
        localStorage.setItem('ti',JSON.stringify(inspSemFotos));
      }catch(qe){
        if(qe.name==='QuotaExceededError'||qe.code===22){
          console.warn('[DB] localStorage quota excedida — IDB é a fonte primária');
          localStorage.removeItem('ti');
          if(notifyUI)Tt('Dados salvos no IDB ✓');
        }else{
          console.warn('Erro ao salvar local:',qe);
          if(notifyUI)Tt('Erro ao salvar. Tente novamente.');
        }
      }
      if(S.sessao){var s=JSON.parse(JSON.stringify(S.sessao));s._t=Date.now();localStorage.setItem('ts',JSON.stringify(s));}
      localStorage.setItem('tu',JSON.stringify(US));
      /* v74 P1: verifica quota após save e alerta se necessário */
      if(typeof checkStorageQuota==='function')checkStorageQuota();
    }catch(e){
      console.warn('Erro ao salvar local:',e);
      if(notifyUI)Tt('Erro ao salvar. Tente novamente.');
    }
  },
  /* save assíncrono (normal — não bloqueia UI) */
  svLocal:function(){var self=this;setTimeout(function(){self._execSv(true);},0);},
  /* FIX v73: save SÍNCRONO para beforeunload/visibilitychange
     (setTimeout não dispara antes do unload → dados perdidos) */
  svSync:function(){this._execSv(false);},
  sv:function(){
    this.svLocal();
    Sync.schedulePush(600);
  },
  ld:async function(){
    /* ── PASSO 1 (SÍNCRONO): carrega usuários ANTES de qualquer async ────────
       Garante que US nunca fica vazio mesmo se IndexedDB rejeitar.
       Colocar antes do try/catch evita que erros async engulam este bloco. */
    var _defaultUS=[
      {id:'u1',nome:'Edenias Gonzaga Leão',mat:'P0155070',pin:'0872',reg:'NORTE',cargo:'Apoio Técnico',polo:'Montes Claros',ativo:true},
      {id:'u2',nome:'Túlio Heleno L. Lobato',mat:'T2183-2',pin:'2183',reg:'NORTE',cargo:'Fiscal',polo:'Montes Claros',ativo:true},
      {id:'u3',nome:'Jarém Guarany Gomes Jr.',mat:'T006387-5',pin:'6387',reg:'CENTRAL',cargo:'Fiscal',polo:'Contagem',ativo:true},
      {id:'u4',nome:'Luís Cláudio F. Cunha',mat:'600.94701',pin:'4701',reg:'CENTRAL',cargo:'Fiscal',polo:'Betim',ativo:true},
      {id:'u5',nome:'Márcia Gomes Alvarenga',mat:'T008172-9',pin:'8172',reg:'LESTE',cargo:'Fiscal',polo:'Gov. Valadares',ativo:true},
      {id:'u6',nome:'Guilherme A. Alencar',mat:'P0094702',pin:'4702',reg:'LESTE',cargo:'Fiscal',polo:'Ipatinga',ativo:true},
      {id:'u7',nome:'Rui Cassiano R. Lima',mat:'P0117128',pin:'7128',reg:'LESTE',cargo:'Fiscal',polo:'Itabira',ativo:true},
      {id:'u8',nome:'José Agostinho H. R. Assunção',mat:'',pin:'8001',reg:'ZONA_MATA',cargo:'Fiscal',polo:'Juiz de Fora',ativo:true},
      {id:'u9',nome:'Thiago Abreu',mat:'',pin:'9001',reg:'ZONA_MATA',cargo:'Fiscal',polo:'Juiz de Fora',ativo:true},
      {id:'u10',nome:'Alisson Cruz Pereira',mat:'8546-4',pin:'5461',reg:'TRIANGULO',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u11',nome:'Flávio Ferreira Ribeiro',mat:'60130718',pin:'3071',reg:'TRIANGULO',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u12',nome:'Raphael Alan Ferreira',mat:'P0115765',pin:'1157',reg:'SUL',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u13',nome:'Diego Henrique C. Oliveira',mat:'P0128696',pin:'2869',reg:'SUL',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u14',nome:'Vanderlúcio de Jesus Ferreira',mat:'',pin:'7743',reg:'SUDOESTE',cargo:'Fiscal',polo:'',ativo:true},
      {id:'u15',nome:'Taciano de Paula Costa Bastos',mat:'',pin:'9254',reg:'SUDOESTE',cargo:'Fiscal',polo:'',ativo:true}
    ];
    US.splice(0,US.length);
    _defaultUS.forEach(function(d){US.push(d);});
    /* Aplica edições do admin (tu) se existirem */
    try{
      var _tu0=localStorage.getItem('tu');
      if(_tu0){var _tuArr0=JSON.parse(_tu0);if(Array.isArray(_tuArr0)){_tuArr0.forEach(function(x){if(!x||!x.id)return;var _idx=US.findIndex(function(u){return u.id===x.id;});var _safe={};if(x.pin&&/^\d{4}$/.test(x.pin))_safe.pin=x.pin;if(x.nome&&x.nome.trim())_safe.nome=x.nome.trim();if(x.updated_at)_safe.updated_at=x.updated_at;if(x.cargo)_safe.cargo=x.cargo;if(x.reg)_safe.reg=x.reg;if(x.mat!==undefined)_safe.mat=x.mat;if(x.polo!==undefined)_safe.polo=x.polo;if(x.ativo!==undefined)_safe.ativo=x.ativo;if(_idx>=0)US[_idx]=Object.assign({},US[_idx],_safe);else US.push(x);});}}
    }catch(_e0){console.warn('tu parse erro (sync)',_e0);}

    /* ── PASSO 2 (ASYNC): carrega inspeções do IndexedDB/localStorage ────── */
    try{
    /* Carrega inspeções: localStorage (rápido) ou IDB (fallback quando quota excedida) */
    var rawInsp=localStorage.getItem('ti');
    if(!rawInsp){
      var idbInsp=await PhotoStore.getAllInsp();
      if(idbInsp&&idbInsp.length){
        rawInsp=JSON.stringify(idbInsp);
        console.log('[DB] Recuperado '+idbInsp.length+' insp. do IDB (localStorage vazio)');
      }
    }
    /* v75: recupera finalizadas do cofre fin_store e mescla com insp_store.
       Garante que relatórios finalizados nunca são perdidos por corrupção
       do localStorage ou insp_store. */
    try{
      var _finsCofre=await PhotoStore.getAllFinalizados();
      if(_finsCofre&&_finsCofre.length){
        var _base=rawInsp?JSON.parse(rawInsp):[];
        var _idxById={};_base.forEach(function(x,i){_idxById[x.id]=i;});
        var _changed=false;
        _finsCofre.forEach(function(f){
          var idx=_idxById[f.id];
          if(idx!==undefined){
            /* Cofre prevalece sobre rascunho — nunca deixa finalizada virar rascunho */
            if(_base[idx].st!=='finalizada'){
              f.itens=_base[idx].itens||f.itens;/* preserva itens do insp_store (mais completo) */
              f.st='finalizada';
              _base[idx]=f;_changed=true;
            }
          }else{
            /* Finalizada existia no cofre mas sumiu do insp_store — restaura */
            _base.unshift(f);_changed=true;
            console.log('[DB] Restaurado do fin_store:',f.id);
          }
        });
        if(_changed)rawInsp=JSON.stringify(_base);
      }
    }catch(_fc){console.warn('[DB] fin_store recovery erro:',_fc);}
    if(rawInsp){S.insp=JSON.parse(rawInsp);
    var _temAntigas=S.insp.some(function(insp){return Object.keys(insp.itens||{}).some(function(k){return(insp.itens[k].fotos||[]).length>0;});});
    if(_temAntigas){PhotoStore.migrate(S.insp).then(function(){DB.svLocal();console.log('[PhotoStore] Migracao concluida.');});}
    Promise.all(S.insp.map(function(insp){
      return PhotoStore.loadForInsp(insp).then(function(){
        if(insp.sub)return PhotoStore.loadSubAll(insp.id,insp.sub);
      });
    })).catch(function(){});}
    var s=localStorage.getItem('ts');if(s){var d=JSON.parse(s);if(Date.now()-(d._t||0)<28800000){S.sessao=d;}else{localStorage.removeItem('ts');setTimeout(function(){try{Tt('Sessão expirada. Faça login novamente.');}catch(e){}},1500);}}
    /* Atualiza US com dados do Supabase/pull que possam ter chegado via mergeRemoteUsers */
    }catch(e){console.warn('[DB.ld] erro async (inspeções/sessão):',e);}
  }
};



