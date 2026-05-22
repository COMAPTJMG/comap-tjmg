'use strict';
// ============================================================
// sync.js — Objeto Sync: push/pull Supabase via Edge Function (v70 bugfixes)
// TJMG Fiscal PWA — Fase 2 da modularização
// Dependências (globais): S, US, SB, SUPABASE_URL,
//   SUPABASE_PUBLISHABLE_KEY, EDGE_SYNC_URL, SYNC_SECRET
//   Tt, el (utils — carregados depois, mas chamados só em runtime)
// ============================================================

var Sync={
  ready:false,
  busy:false,
  timer:null,
  deletedInsps:[],
  deletedUsers:[],
  stateKey:'tjmg_sync_state_v1',
  init:function(){
    try{
      /* Tenta inicializar o SDK como fallback */
      if(window.supabase&&SUPABASE_URL&&(SUPABASE_PUBLISHABLE_KEY||SUPABASE_ANON_KEY)){
        SB=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY||SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      }
      /* Edge Function tem prioridade: não depende do PostgREST, sem CORS overhead */
      this.useEdge=!!(typeof EDGE_SYNC_URL!=='undefined'&&EDGE_SYNC_URL);
      this.ready=this.useEdge||!!SB;
      this.loadState();
      var _self=this;
      if(this.ready&&navigator.onLine){
        try{if(localStorage.getItem('_pendingPush')==='1'){setTimeout(function(){_self.schedulePush(2000);},3000);}}catch(e){}
      }
      return this.ready;
    }catch(e){console.warn('Sync init falhou',e);return false;}
  },
  loadState:function(){
    try{
      var raw=localStorage.getItem(this.stateKey);
      if(!raw)return;
      var d=JSON.parse(raw)||{};
      this.deletedInsps=Array.isArray(d.deletedInsps)?d.deletedInsps:[];
      this.deletedUsers=Array.isArray(d.deletedUsers)?d.deletedUsers:[];
      /* Migração: converte entradas antigas (string pura) para {id,_t} */
      this.deletedInsps=this.deletedInsps.map(function(e){
        return (typeof e==='string')?{id:e,_t:Date.now()}:e;
      });
    }catch(e){}
  },
  saveState:function(){
    /* Prune blacklist: mantém entradas dos últimos 30 dias (proteção contra ressurreição) */
    var _30d=Date.now()-30*24*60*60*1000;
    this.deletedInsps=this.deletedInsps.filter(function(e){
      /* suporte a formato antigo (string pura) e novo ({id,_t}) */
      if(typeof e==='string')return false; /* v71: purga entradas legadas sem timestamp */
      return e&&e._t&&e._t>_30d;
    });
    /* Limite absoluto de segurança: 500 entradas */
    if(this.deletedInsps.length>500)this.deletedInsps=this.deletedInsps.slice(-500);
    try{localStorage.setItem(this.stateKey,JSON.stringify({deletedInsps:this.deletedInsps,deletedUsers:this.deletedUsers}));}catch(e){}
  },
  queueDeleteInspection:function(id){
    if(!id)return;
    /* Armazena como {id, _t} para permitir pruning por tempo */
    var _jaExiste=this.deletedInsps.some(function(e){return e===id||(e&&e.id===id);});
    if(!_jaExiste)this.deletedInsps.push({id:id,_t:Date.now()});
    this.saveState();this.schedulePush(50);
  },
  queueDeleteUser:function(id){if(!id)return; if(this.deletedUsers.indexOf(id)===-1)this.deletedUsers.push(id); this.saveState(); this.schedulePush(50);},
  schedulePush:function(delay){
    var self=this;
    if(!self.ready||!navigator.onLine){
      try{localStorage.setItem('_pendingPush','1');}catch(e){}
      if(navigator.serviceWorker&&navigator.serviceWorker.ready){
        navigator.serviceWorker.ready.then(function(reg){
          if(reg.sync)reg.sync.register('tjmg-push').catch(function(){});
        }).catch(function(){});
      }
      return;
    }
    clearTimeout(self.timer);
    self.timer=setTimeout(function(){self.pushAll();},delay||800);
  },
  /* ── Comprime uma foto para thumb de sincronização ────────────────────────
     Reduz para maxDim px (largura ou altura, mantendo proporção) e
     reencoda como JPEG com a qualidade informada.
     Retorna Promise<string> com o novo dataURL (ou o original se falhar). */
  comprimirFotoSync:function(b64,maxDim,qual){
    maxDim=maxDim||480; qual=qual||0.45;
    return new Promise(function(res){
      try{
        var img=new Image();
        img.onload=function(){
          try{
            var w=img.naturalWidth,h=img.naturalHeight;
            if(w>maxDim||h>maxDim){
              if(w>=h){h=Math.round(h*(maxDim/w));w=maxDim;}
              else{w=Math.round(w*(maxDim/h));h=maxDim;}
            }
            var cv=document.createElement('canvas');
            cv.width=w;cv.height=h;
            cv.getContext('2d').drawImage(img,0,0,w,h);
            res(cv.toDataURL('image/jpeg',qual));
          }catch(e){res(b64);}
        };
        img.onerror=function(){res(b64);};
        img.src=b64;
      }catch(e){res(b64);}
    });
  },
  /* ── Versão async de normalizeInspection com fotos comprimidas ─────────── */
  normalizarInspComFotos:async function(i){
    var self=this;
    /* Garante que as fotos do IDB estejam carregadas na memória */
    await PhotoStore.loadForInsp(i).catch(function(){});
    if(i.tipo==='subestacao'||i.sub)
      await PhotoStore.loadSubAll(i.id,i.sub||{}).catch(function(){});

    var payloadLimpo=JSON.parse(JSON.stringify(i));

    /* Comprime fotos de itens normais */
    var itPromises=[];
    Object.keys(payloadLimpo.itens||{}).forEach(function(k){
      var fotos=payloadLimpo.itens[k].fotos||[];
      if(!fotos.length)return;
      var p=Promise.all(fotos.map(function(f){
        if(!f||!f.b64)return Promise.resolve(f);
        return self.comprimirFotoSync(f.b64,480,0.45).then(function(b64c){
          return {b64:b64c,leg:f.leg||''};
        });
      })).then(function(comprimidas){
        payloadLimpo.itens[k].fotos=comprimidas;
      });
      itPromises.push(p);
    });
    await Promise.all(itPromises);

    /* Comprime fotos de subestação */
    var sub=payloadLimpo.sub;
    if(sub){
      var subP=[];
      var _compFArr=function(arr){
        if(!arr||!arr.length)return Promise.resolve(arr||[]);
        return Promise.all(arr.map(function(f){
          if(!f||!f.b64)return Promise.resolve(f);
          return self.comprimirFotoSync(f.b64,480,0.45).then(function(b){return{b64:b,leg:f.leg||''};});
        }));
      };
      if(sub.chk)Object.keys(sub.chk).forEach(function(k){
        if(!sub.chk[k])return;
        subP.push(_compFArr(sub.chk[k].fotos||[]).then(function(c){sub.chk[k].fotos=c;}));
      });
      if(Array.isArray(sub.trafos))sub.trafos.forEach(function(t){
        subP.push(_compFArr(t.fotos_ttr||[]).then(function(c){t.fotos_ttr=c;}));
        subP.push(_compFArr(t.fotos_iso||[]).then(function(c){t.fotos_iso=c;}));
        subP.push(_compFArr(t.fotos_ohm||[]).then(function(c){t.fotos_ohm=c;}));
      });
      if(Array.isArray(sub.disjs))sub.disjs.forEach(function(d){
        subP.push(_compFArr(d.fotos_iso||[]).then(function(c){d.fotos_iso=c;}));
        subP.push(_compFArr(d.fotos_cr||[]).then(function(c){d.fotos_cr=c;}));
      });
      if(Array.isArray(sub.secc))sub.secc.forEach(function(s){
        subP.push(_compFArr(s.fotos_iso||[]).then(function(c){s.fotos_iso=c;}));
        subP.push(_compFArr(s.fotos_cr||[]).then(function(c){s.fotos_cr=c;}));
      });
      await Promise.all(subP);
    }

    return {
      id:i.id,
      tipo:i.tipo||'',
      comarca:i.com||'',
      edificacao:i.edif||'',
      regiao:i.reg||'',
      fiscal:i.fiscal||'',
      status:i.st||'',        /* v69-fix: sincroniza status com o banco */
      protocolo:i.protocolo||'', /* v69-fix: sincroniza protocolo com o banco */
      _fotosSync:true, /* marca que este payload tem thumbs */
      payload:payloadLimpo,
      updated_at:new Date().toISOString()
    };
  },
  normalizeInspection:function(i){
    /* Versão síncrona (fallback/legado) — sem fotos */
    var payloadLimpo=JSON.parse(JSON.stringify(i));
    Object.keys(payloadLimpo.itens||{}).forEach(function(k){
      if(payloadLimpo.itens[k].fotos)payloadLimpo.itens[k].fotos=[];
    });
    var sub=payloadLimpo.sub;
    if(sub){
      if(sub.chk)Object.keys(sub.chk).forEach(function(k){if(sub.chk[k])sub.chk[k].fotos=[];});
      if(Array.isArray(sub.trafos))sub.trafos.forEach(function(t){t.fotos_ttr=[];t.fotos_iso=[];t.fotos_ohm=[];});
      if(Array.isArray(sub.disjs))sub.disjs.forEach(function(d){d.fotos_iso=[];d.fotos_cr=[];});
      if(Array.isArray(sub.secc))sub.secc.forEach(function(s){s.fotos_iso=[];s.fotos_cr=[];});
    }
    return {
      id:i.id,
      tipo:i.tipo||'',
      comarca:i.com||'',
      edificacao:i.edif||'',
      regiao:i.reg||'',
      fiscal:i.fiscal||'',
      status:i.st||'',
      protocolo:i.protocolo||'',
      updated_at:new Date().toISOString(),
      payload:payloadLimpo
    };
  },
  normalizeUser:function(u){
    return {
      id:u.id,
      nome:u.nome||'',
      mat:u.mat||'',
      pin:u.pin||'',
      reg:u.reg||'',
      cargo:u.cargo||'',
      polo:u.polo||'',
      ativo:!!u.ativo,
      updated_at:u.updated_at||new Date().toISOString()
    };
  },
  mergeRemoteInspections:function(rows){
    if(!Array.isArray(rows))return;
    var deleted=this.deletedInsps;
    var localById={};
    S.insp.forEach(function(i){localById[i.id]=i;});

    /* Coleta IDs que precisam de merge para pre-carregar fotos do IDB */
    var idsParaMerge=[];
    rows.forEach(function(row){
      if(!row||!row.id||!row.payload)return;
      if(deleted.some(function(e){return e===row.id||(e&&e.id===row.id);}))return;
      var local=localById[row.id];
      var remoteTs=Date.parse((row.payload&&row.payload.updated_at)||row.updated_at||0)||0;
      var localTs=local&&Date.parse(local.updated_at||local.dt||0)||0;
      if(local&&remoteTs>=localTs)idsParaMerge.push(row.id);
    });

    /* Pre-carrega fotos do IDB para TODOS os itens que serao mesclados,
       garantindo que nenhuma foto seja perdida mesmo apos svLocal ter zerado
       os arrays em memoria. */
    var preload=idsParaMerge.map(function(id){
      var local=localById[id];if(!local)return Promise.resolve();
      return PhotoStore.loadForInsp(local).catch(function(){});
    });

    Promise.all(preload).then(function(){
      rows.forEach(function(row){
        if(!row||!row.id||!row.payload)return;
        /* Verifica blacklist no formato novo {id,_t} ou legado string */
        if(deleted.some(function(e){return e===row.id||(e&&e.id===row.id);}))return;
        var remote=row.payload;
        remote.id=row.id;
        var local=localById[row.id];
        var localTs=local&&Date.parse(local.updated_at||local.dt||0)||0;
        var remoteTs=Date.parse(remote.updated_at||row.updated_at||0)||0;
        if(!local){
          /* Nova inspeção vinda do Supabase: salva thumbs do payload no IDB local */
          if(remote._fotosSync){
            Object.keys(remote.itens||{}).forEach(function(k){
              var fotos=remote.itens[k].fotos||[];
              if(fotos.length)PhotoStore.put(remote.id+'::'+k,fotos);
            });
            /* Thumbs de subestação */
            if(remote.sub){
              PhotoStore.putSubAll(remote.id,remote.sub).catch(function(){});
            }
          }
          S.insp.unshift(remote);
        }else if(remoteTs>=localTs){
          /* Preserva fotos locais (alta res) — carregadas do IDB acima */
          var _fotosLocais={};
          Object.keys(local.itens||{}).forEach(function(k){
            if((local.itens[k].fotos||[]).length)_fotosLocais[k]=local.itens[k].fotos;
          });
          /* Se remoto traz thumbs novas e local não tem fotos: absorve */
          var _fotosRemotasParaIDB={};
          if(remote._fotosSync){
            Object.keys(remote.itens||{}).forEach(function(k){
              var rf=remote.itens[k]&&remote.itens[k].fotos||[];
              if(rf.length&&!_fotosLocais[k])_fotosRemotasParaIDB[k]=rf;
            });
          }
          /* v75 PROTEÇÃO CRÍTICA: nunca rebaixar st de finalizada→em_andamento via sync.
             O Supabase pode ter versão mais antiga (push não completou, push offline).
             A finalização local É a verdade — o servidor confirma depois, nunca antes. */
          var _stLocal=local.st;
          var _protLocal=local.protocolo;
          var _finTimestamp=local._finalizadoEm;
          Object.keys(remote).forEach(function(k){local[k]=remote[k];});
          if(_stLocal==='finalizada'){
            local.st='finalizada';
            if(_protLocal)local.protocolo=_protLocal;
            if(_finTimestamp)local._finalizadoEm=_finTimestamp;
          }
          /* Restaura fotos locais (têm prioridade sobre thumbs) */
          Object.keys(_fotosLocais).forEach(function(k){
            if(local.itens&&local.itens[k])local.itens[k].fotos=_fotosLocais[k];
          });
          /* Re-persiste fotos locais no IDB */
          Object.keys(_fotosLocais).forEach(function(k){
            PhotoStore.put(local.id+'::'+k,_fotosLocais[k]);
          });
          /* Persiste thumbs remotas quando local não tinha fotos */
          Object.keys(_fotosRemotasParaIDB).forEach(function(k){
            if(local.itens&&local.itens[k])local.itens[k].fotos=_fotosRemotasParaIDB[k];
            PhotoStore.put(local.id+'::'+k,_fotosRemotasParaIDB[k]);
          });
        }
      });
    }).catch(function(e){console.warn('[merge] falhou preload fotos:',e);});
  },
  mergeRemoteUsers:function(rows){
    if(!Array.isArray(rows)||!rows.length)return;
    /* Nunca apaga os usuários padrão (u1-u15).
       Apenas atualiza existentes se o dado remoto for mais recente.
       Garante que PINs só mudam quando alterados pelo administrador. */
    rows.forEach(function(r){
      if(!r||!r.id)return;
      var idx=US.findIndex(function(u){return u.id===r.id;});
      var obj={id:r.id,nome:r.nome,mat:r.mat||'',pin:r.pin||'',reg:r.reg||'',cargo:r.cargo||'Fiscal',polo:r.polo||'',ativo:r.ativo!==false,updated_at:r.updated_at||''};
      if(idx>=0){
        /* Só sobrescreve se o remoto for mais recente que o local */
        var localTs=Date.parse(US[idx].updated_at||0)||0;
        var remoteTs=Date.parse(r.updated_at||0)||0;
        if(remoteTs>=localTs){US[idx]=obj;}
      } else {
        US.push(obj);
      }
    });
  },
  pullAll:async function(){
    if(!this.ready||!navigator.onLine)return;
    if(!S.sessao)return;
    try{
      /* Envia APENAS deleções de usuários antes de buscar.
         NUNCA faz upsert de dados (pin/nome/etc.) aqui: neste ponto o US
         ainda não foi reconciliado com o servidor e pode conter pins vazios
         vindos do localStorage antigo. O upsert completo ocorre APÓS o pull
         (schedulePush), quando mergeRemoteUsers já aplicou o estado correto. */
      if(this.deletedUsers.length&&!this.busy&&SB){
        try{
          var _preDel=await SB.from('app_users').delete().in('id',this.deletedUsers);
          if(!_preDel.error){this.deletedUsers=[];this.saveState();}
        }catch(e){console.warn('pre-pull delete users falhou',e);}
      }
      var _sess=S.sessao;
      var _isGlob=_sess&&(_sess.tipo==='admin'||_sess.tipo==='coordenador');
      var _reg=(!_isGlob&&_sess&&_sess.reg)?_sess.reg:null;

      /* ── Via Edge Function (preferencial: sem overhead PostgREST, sem CORS issue) ── */
      if(this.useEdge){
        var edgeUrl=EDGE_SYNC_URL+'/pull'+(_reg?'?reg='+encodeURIComponent(_reg):'');
        var _hPull={'Content-Type':'application/json'};if(SYNC_SECRET)_hPull['x-sync-secret']=SYNC_SECRET;
        var resp=await fetch(edgeUrl,{method:'GET',headers:_hPull});
        if(!resp.ok)throw new Error('Edge pull HTTP '+resp.status);
        var d=await resp.json();
        if(!d.ok)throw new Error(d.error||'Edge pull erro');
        if(Array.isArray(d.users)&&d.users.length)this.mergeRemoteUsers(d.users);
        if(Array.isArray(d.inspections)){
          this.mergeRemoteInspections(d.inspections);
          var remoteIds=d.inspections.map(function(r){return r.id;});
          var _pendDel=Sync.deletedInsps||[];
          S.insp=S.insp.filter(function(i){
            if(_pendDel.some(function(e){return e===i.id||(e&&e.id===i.id);}))return false;
            if(i.st==='em_andamento'&&remoteIds.indexOf(i.id)===-1)return true;
            /* v77-fix: nunca descartar finalizada não confirmada pelo servidor —
               protege contra race condition pull-antes-push */
            if(i.st==='finalizada'&&!i.synced_at&&remoteIds.indexOf(i.id)===-1)return true;
            return remoteIds.indexOf(i.id)!==-1;
          });
        }
        DB.svLocal();
        return;
      }

      /* ── Fallback SDK direto ── */
      var ur=await SB.from('app_users').select('*').order('nome');
      if(!ur.error&&Array.isArray(ur.data)&&ur.data.length)this.mergeRemoteUsers(ur.data);
      /* Busca por região: fiscal vê só sua região; admin/coord veem tudo */
      var _qInsp=SB.from('inspections').select('id,payload,updated_at').order('updated_at',{ascending:false}).limit(500);
      if(_reg)_qInsp=_qInsp.eq('regiao',_reg);
      var ir=await _qInsp;
      if(!ir.error&&Array.isArray(ir.data)){
        this.mergeRemoteInspections(ir.data);
        var remoteIds=ir.data.map(function(r){return r.id;});
        var _pendDel=Sync.deletedInsps||[];
        S.insp=S.insp.filter(function(i){
          if(_pendDel.some(function(e){return e===i.id||(e&&e.id===i.id);}))return false;
          /* Mantém rascunho LOCAL (nunca subiu ao Supabase).
             Se o item JÁ estava no Supabase e foi deletado por qualquer
             usuário, remove localmente independente do status. */
          if(i.st==='em_andamento'&&remoteIds.indexOf(i.id)===-1)return true;
          /* v77-fix: nunca descartar finalizada não confirmada pelo servidor —
             protege contra race condition pull-antes-push */
          if(i.st==='finalizada'&&!i.synced_at&&remoteIds.indexOf(i.id)===-1)return true;
          return remoteIds.indexOf(i.id)!==-1;
        });
      }
      DB.svLocal();
    }catch(e){console.warn('Pull falhou',e);}
  },
  pushUsers:async function(){
    /* v77-fix CORS: quando useEdge=true roteia pela Edge Function (mesmo caminho do pushInspections).
       Chamada direta ao PostgREST era bloqueada por CORS do GitHub Pages. */
    if(this.useEdge){
      var payload=US.map(this.normalizeUser.bind(this));
      var delUsers=this.deletedUsers.slice();
      if(!payload.length&&!delUsers.length)return;
      var _h={'Content-Type':'application/json'};
      if(SYNC_SECRET)_h['x-sync-secret']=SYNC_SECRET;
      var resp=await fetch(EDGE_SYNC_URL+'/push',{
        method:'POST',
        headers:_h,
        body:JSON.stringify({inspections:[],deleteInsps:[],users:payload,deleteUsers:delUsers})
      });
      if(!resp.ok)throw new Error('Edge push users HTTP '+resp.status);
      var d=await resp.json();
      if(!d.ok)throw new Error(d.error||'Edge push users erro');
      this.deletedUsers=[];this.saveState();
      return;
    }
    /* Fallback: SDK direto (quando Edge Function não está configurada) */
    if(!SB)return;
    var payload=US.map(this.normalizeUser.bind(this));
    if(payload.length){
      var up=await SB.from('app_users').upsert(payload,{onConflict:'id'});
      if(up.error)throw up.error;
    }
    if(this.deletedUsers.length){
      var dl=await SB.from('app_users').delete().in('id',this.deletedUsers);
      if(dl.error)throw dl.error;
      this.deletedUsers=[];this.saveState();
    }
  },
  pushInspections:async function(){
    var _idsParaDel=this.deletedInsps.map(function(e){return typeof e==='string'?e:e.id;});
    var cutoff=new Date(Date.now()-48*3600*1000).toISOString();
    var toSync=S.insp.filter(function(i){
      if(i.st==='em_andamento')return true;
      if(!i.updated_at)return true;
      /* v70-fix Bug3: inspeções finalizadas nunca confirmadas pelo servidor sempre entram no push */
      if(i.st==='finalizada'&&!i.synced_at){console.warn('[Sync] Inspeção finalizada sem synced_at incluída no push:',i.id);return true;}
      return i.updated_at>=cutoff;
    });

    /* ── Via Edge Function (preferencial: service_role, sem timeout PostgREST) ── */
    if(this.useEdge){
      if(!toSync.length&&!_idsParaDel.length)return;
      /* Comprime fotos antes de enviar (thumbs 480px/0.45q ~15-25 KB cada) */
      Tt('\u2601\ufe0f Sync: comprimindo fotos...');
      var rows=await Promise.all(toSync.map(this.normalizarInspComFotos.bind(this)));
      var _hPush={'Content-Type':'application/json'};if(SYNC_SECRET)_hPush['x-sync-secret']=SYNC_SECRET;
      var resp=await fetch(EDGE_SYNC_URL+'/push',{
        method:'POST',
        headers:_hPush,
        body:JSON.stringify({inspections:rows,deleteInsps:_idsParaDel,users:US.map(Sync.normalizeUser.bind(Sync)),deleteUsers:Sync.deletedUsers.slice()})
      });
      if(!resp.ok)throw new Error('Edge push HTTP '+resp.status);
      var d=await resp.json();
      if(!d.ok)throw new Error(d.error||'Edge push erro');
      /* v70-fix Bug1: limpa filas de deleção após push Edge bem-sucedido */
      this.deletedUsers=[];
      /* ── Marca localmente as inspeções confirmadas pelo servidor ── */
      var _nowEdge=new Date().toISOString();
      toSync.forEach(function(i){
        i.synced_at=_nowEdge;
        i.sync_version=(i.sync_version||0)+1;
      });
      this.saveState();
      return;
    }

    /* ── Fallback SDK direto ── */
    /* Deleta PRIMEIRO: garante que itens removidos não sejam re-publicados */
    if(this.deletedInsps.length){
      /* Lotes de 50 para o delete */
      var DEL_LOTE=50;
      for(var di=0;di<_idsParaDel.length;di+=DEL_LOTE){
        var dlLote=_idsParaDel.slice(di,di+DEL_LOTE);
        var dl=await SB.from('inspections').delete().in('id',dlLote);
        if(dl.error)throw dl.error;
      }
      /* NÃO zeramos deletedInsps — blacklist permanente contra ressurreição */
      this.saveState();
    }
    if(!toSync.length)return;
    /* Usa RPC upsert_inspections com statement_timeout=0, lotes de 5 */
    var UPSERT_LOTE=5;
    for(var off=0;off<toSync.length;off+=UPSERT_LOTE){
      var lote=toSync.slice(off,off+UPSERT_LOTE);
      var rows=await Promise.all(lote.map(this.normalizarInspComFotos.bind(this)));
      var rpc=await SB.rpc('upsert_inspections',{rows:rows});
      if(rpc.error)throw rpc.error;
      if(rpc.data&&rpc.data.ok===false)throw new Error(rpc.data.error||'upsert_inspections falhou');
      /* ── Marca localmente o lote confirmado pelo servidor ── */
      var _nowRpc=new Date().toISOString();
      lote.forEach(function(i){
        i.synced_at=_nowRpc;
        i.sync_version=(i.sync_version||0)+1;
      });
      if(off+UPSERT_LOTE<toSync.length){
        await new Promise(function(r){setTimeout(r,300);});
      }
    }
  },
  pushAll:async function(){
    if(!this.ready||!navigator.onLine||this.busy)return;
    this.busy=true;
    try{
      await this.pushUsers();
      await this.pushInspections();
      try{localStorage.removeItem('_pendingPush');}catch(e){}
      var d=el('dot');
      if(d&&navigator.onLine){d.style.background='#22c55e';d.textContent='Sync OK';setTimeout(function(){updNet();},1200);}
    }catch(e){
      console.warn('Push Supabase falhou',e);
      var d=el('dot');
      if(d&&navigator.onLine){d.style.background='#ef4444';d.textContent='Erro Sync';}
    }finally{this.busy=false;}
  }
};


