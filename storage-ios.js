/* Copie locale de secours. localStorage reste la source des modules historiques. */
(function(){
 'use strict';
 const keys=[
  'ia_loto_expert_v1_draws','ia_loto_expert_v1_log','ia_loto_journal_v4',
  'ia_loto_v17_journal_v1','ia_loto_v18_additions_v1','ia_loto_v18_prospective_v1',
  'ia_loto_v24_prospectif_fixe_v1','ia_loto_v25_xbias_journal_v1'
 ];
 let database;
 const modified=new Set();
 function open(){
  if(!database){
   database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('IALotoV54_Vault',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('journals_and_archives');
    request.onblocked=()=>reject(Error('Ouverture IndexedDB bloquée.'));
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
     const db=request.result;
     db.onversionchange=()=>{db.close();database=null;};
     resolve(db);
    };
   }).catch(error=>{database=null;throw error;});
  }
  return database;
 }
 async function transaction(mode,run){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('journals_and_archives',mode);
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(tx.error);
   run(tx.objectStore('journals_and_archives'));
  });
 }
 function mirror(key,value){
  if(!keys.includes(key))return;
  modified.add(key);
  transaction('readwrite',store=>{
   if(value===null)store.delete(key);
   else store.put(value,key);
  }).catch(()=>setStatus('Copie IndexedDB indisponible. Tu peux exporter un fichier JSON.'));
 }
 function setStatus(message){
  const status=document.getElementById('localVaultStatus');
  if(status)status.textContent=message;
 }
 async function reconcile(){
  let restored=0;
  await transaction('readwrite',store=>{
   for(const key of keys){
    const request=store.get(key);
    request.onsuccess=()=>{
     try{
      const local=localStorage.getItem(key);
      if(local!==null){store.put(local,key);return;}
      if(modified.has(key)||typeof request.result!=='string')return;
      JSON.parse(request.result);
      localStorage.setItem(key,request.result);
      restored++;
     }catch(error){
      console.warn('Copie locale indisponible pour '+key,error);
     }
    };
   }
  });
  setStatus(restored?'Données locales récupérées. Rechargement des journaux…':'Copie IndexedDB contrôlée sur cet appareil.');
  if(restored)location.reload();
 }
 window.LotoVault={
  setItem(key,value){localStorage.setItem(key,value);mirror(key,String(value));},
  removeItem(key){localStorage.removeItem(key);mirror(key,null);}
 };
 document.addEventListener('DOMContentLoaded',()=>{
  reconcile().catch(()=>setStatus('Copie IndexedDB indisponible. Tu peux exporter un fichier JSON.'));
 });
})();
