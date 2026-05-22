'use strict';
// ============================================================
// photo-store.js — IndexedDB para fotos e inspeções (IIFE)
// TJMG Fiscal PWA — Fase 2 da modularização
// Sem dependências externas. Expõe: window.PhotoStore
// ============================================================

var PhotoStore=(function(){
  var DB_NAME='tjmg_fotos',DB_VER=3,STORE='fotos',INSP_STORE='insp_store';
  var _db=null;
  function open(){
    return new Promise(function(res,rej){
      if(_db){res(_db);return;}
      var req=indexedDB.open(DB_NAME,DB_VER);
      req.onupgradeneeded=function(e){
        var db=e.target.result;
        if(!db.objectStoreNames.contains(STORE))
          db.createObjectStore(STORE,{keyPath:'id'});
        if(!db.objectStoreNames.contains(INSP_STORE))
          db.createObjectStore(INSP_STORE,{keyPath:'k'});
        /* v75: cofre exclusivo de relatórios FINALIZADOS — nunca apagado por quota/sync/reload */
        if(!db.objectStoreNames.contains('fin_store'))
          db.createObjectStore('fin_store',{keyPath:'id'});
      };
      req.onsuccess=function(e){
        _db=e.target.result;
        res(_db);
        /* v75: solicita armazenamento PERSISTENTE ao SO.
           Sem isso, Chrome Android pode apagar o IDB quando o espaço fica baixo.
           Com persist() concedido, só é apagado se o usuário limpar dados manualmente. */
        if(navigator.storage&&navigator.storage.persist){
          navigator.storage.persisted().then(function(ja){
            if(!ja){
              navigator.storage.persist().then(function(ok){
                console.log('[IDB] Armazenamento persistente:'+(ok?'CONCEDIDO ✓':'negado — dados sujeitos a evicção'));
              });
            }
          });
        }
      };
      req.onerror=function(){rej(req.error);};
    });
  }
  /* Salva array de fotos de um item: chave = inspId+'::'+itemKey */
  function put(chave,fotos){
    return open().then(function(db){
      return new Promise(function(res,rej){
        var tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put({id:chave,fotos:fotos});
        tx.oncomplete=function(){res();};
        tx.onerror=function(){rej(tx.error);};
      });
    });
  }
  /* Lê fotos de um item */
  function get(chave){
    return open().then(function(db){
      return new Promise(function(res){
        var tx=db.transaction(STORE,'readonly');
        var req=tx.objectStore(STORE).get(chave);
        req.onsuccess=function(){res((req.result&&req.result.fotos)||[]);};
        req.onerror=function(){res([]);};
      });
    });
  }
  /* Remove fotos de um item */
  function del(chave){
    return open().then(function(db){
      return new Promise(function(res){
        var tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).delete(chave);
        tx.oncomplete=function(){res();};
        tx.onerror=function(){res();};
      });
    });
  }
  /* Lista todas as chaves */
  function listKeys(){
    return open().then(function(db){
      return new Promise(function(res){
        var tx=db.transaction(STORE,'readonly');
        var req=tx.objectStore(STORE).getAllKeys();
        req.onsuccess=function(){res(req.result||[]);};
        req.onerror=function(){res([]);};
      });
    });
  }
  /* Migração: move fotos do localStorage para o IndexedDB */
  function migrate(insps){
    var promises=[];
    insps.forEach(function(insp){
      Object.keys(insp.itens||{}).forEach(function(k){
        var it=insp.itens[k];
        if(it.fotos&&it.fotos.length){
          var chave=insp.id+'::'+k;
          promises.push(put(chave,it.fotos));
          it.fotos=[];/* remove base64 do localStorage */
        }
      });
    });
    return Promise.all(promises);
  }
  /* Restaura fotos dos itens de uma inspeção antes de exibir */
  function loadForInsp(insp){
    var promises=Object.keys(insp.itens||{}).map(function(k){
      var chave=insp.id+'::'+k;
      return get(chave).then(function(fotos){
        if(fotos&&fotos.length)insp.itens[k].fotos=fotos;
      });
    });
    return Promise.all(promises);
  }
  /* Apaga todas as fotos de uma inspeção (ao excluir) */
  function delInsp(inspId,itemKeys){
    return Promise.all((itemKeys||[]).map(function(k){return del(inspId+'::'+k);}));
  }
  /* ── Subestação: armazena todas as fotos do sub em uma entrada compacta ── */
  /* chave: inspId::sub → valor: {chk:{id:[fotos]}, trafos:[[ft,fi,fo],...], disjs:[[fi,fc],...], secc:[[fi,fc],...]} */
  function putSubAll(inspId,sub){
    if(!sub)return Promise.resolve();
    var fotos={chk:{},trafos:[],disjs:[],secc:[]};
    Object.keys(sub.chk||{}).forEach(function(id){
      var f=sub.chk[id].fotos;if(f&&f.length)fotos.chk[id]=f;
    });
    (sub.trafos||[]).forEach(function(t){
      fotos.trafos.push({ttr:t.fotos_ttr||[],iso:t.fotos_iso||[],ohm:t.fotos_ohm||[]});
    });
    (sub.disjs||[]).forEach(function(d){
      fotos.disjs.push({iso:d.fotos_iso||[],cr:d.fotos_cr||[]});
    });
    (sub.secc||[]).forEach(function(s){
      fotos.secc.push({iso:s.fotos_iso||[],cr:s.fotos_cr||[]});
    });
    return put(inspId+'::sub',fotos);
  }
  function loadSubAll(inspId,sub){
    if(!sub)return Promise.resolve();
    return get(inspId+'::sub').then(function(fotos){
      if(!fotos)return;
      Object.keys(fotos.chk||{}).forEach(function(id){
        if(sub.chk&&sub.chk[id])sub.chk[id].fotos=fotos.chk[id];
      });
      (fotos.trafos||[]).forEach(function(ft,i){
        var t=sub.trafos&&sub.trafos[i];if(!t)return;
        t.fotos_ttr=ft.ttr||[];t.fotos_iso=ft.iso||[];t.fotos_ohm=ft.ohm||[];
      });
      (fotos.disjs||[]).forEach(function(fd,i){
        var d=sub.disjs&&sub.disjs[i];if(!d)return;
        d.fotos_iso=fd.iso||[];d.fotos_cr=fd.cr||[];
      });
      (fotos.secc||[]).forEach(function(fs,i){
        var s=sub.secc&&sub.secc[i];if(!s)return;
        s.fotos_iso=fs.iso||[];s.fotos_cr=fs.cr||[];
      });
    }).catch(function(){});
  }
  /* ── Persistência de S.insp no IDB (sem limite de quota) ──────────────── */
  function putAllInsp(arr){
    return open().then(function(db){
      return new Promise(function(res,rej){
        var tx=db.transaction(INSP_STORE,'readwrite');
        tx.objectStore(INSP_STORE).put({k:'all',data:arr});
        tx.oncomplete=function(){res();};
        tx.onerror=function(){rej(tx.error);};
      });
    }).catch(function(e){console.warn('[IDB] putAllInsp falhou',e);});
  }
  function getAllInsp(){
    return open().then(function(db){
      return new Promise(function(res){
        var tx=db.transaction(INSP_STORE,'readonly');
        var req=tx.objectStore(INSP_STORE).get('all');
        req.onsuccess=function(){res((req.result&&req.result.data)||null);};
        req.onerror=function(){res(null);};
      });
    }).catch(function(){return null;});
  }

  /* ── v75: Cofre imutável para relatórios FINALIZADOS ────────────────────────
     Gravado em finalizarI() e salvarF(). Nunca sobrescrito por sync ou reload.
     Fonte de recuperação quando insp_store/localStorage são corrompidos.       */
  function putFinalizado(insp){
    if(!insp||insp.st!=='finalizada')return Promise.resolve();
    /* Remove fotos base64 antes de guardar (fotos ficam em STORE por chave) */
    var safe=JSON.parse(JSON.stringify(insp));
    Object.keys(safe.itens||{}).forEach(function(k){if(safe.itens[k])safe.itens[k].fotos=[];});
    if(safe.snap&&safe.snap.itens)Object.keys(safe.snap.itens).forEach(function(k){if(safe.snap.itens[k])safe.snap.itens[k].fotos=[];});
    return open().then(function(db){
      return new Promise(function(res){
        try{
          var tx=db.transaction('fin_store','readwrite');
          tx.objectStore('fin_store').put(safe);
          tx.oncomplete=function(){res(true);};
          tx.onerror=function(){console.warn('[fin_store] put erro',tx.error);res(false);};
        }catch(e){console.warn('[fin_store] put ex',e);res(false);}
      });
    }).catch(function(){return false;});
  }
  function getAllFinalizados(){
    return open().then(function(db){
      return new Promise(function(res){
        var tx=db.transaction('fin_store','readonly');
        var req=tx.objectStore('fin_store').getAll();
        req.onsuccess=function(){res(req.result||[]);};
        req.onerror=function(){res([]);};
      });
    }).catch(function(){return [];});
  }
  function delFinalizado(id){
    return open().then(function(db){
      return new Promise(function(res){
        var tx=db.transaction('fin_store','readwrite');
        tx.objectStore('fin_store').delete(id);
        tx.oncomplete=function(){res();};
        tx.onerror=function(){res();};
      });
    }).catch(function(){return Promise.resolve();});
  }

  return{put:put,get:get,del:del,listKeys:listKeys,migrate:migrate,loadForInsp:loadForInsp,delInsp:delInsp,putSubAll:putSubAll,loadSubAll:loadSubAll,putAllInsp:putAllInsp,getAllInsp:getAllInsp,putFinalizado:putFinalizado,getAllFinalizados:getAllFinalizados,delFinalizado:delFinalizado};
})();


