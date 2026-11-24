const CACHE='ia-loto-v53-unique-4';
const HISTORY_CACHE='ia-loto-v53-historiques';
const HISTORIES=[
 './automatisation/donnees/loto.json',
 './automatisation/donnees/euromillions.json'
].map(path=>new URL(path,self.registration.scope).href);
const ASSETS=["./", "./index.html", "./app.js", "./data.js", "./ev.js", "./protocole12.js", "./science10.js", "./science11.js", "./v13.js", "./v14.js", "./v15.js", "./v16.js", "./v1610.js", "./v1611.js", "./v1612.js", "./v1613.js", "./v1614.js", "./v1615.js", "./v1616.js", "./v163.js", "./v164.js", "./v165.js", "./v166.js", "./v167.js", "./v168.js", "./v169.js", "./v17.js", "./v18.js", "./v19.js", "./v20.js", "./v21.js", "./v22.js", "./v23.js", "./v24.js", "./xbias25.js", "./manifest.webmanifest", "./github_status.js", "./euromillions-chauds_VERIFIE.html"];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS);
  const histories=await caches.open(HISTORY_CACHE);
  await Promise.allSettled(HISTORIES.map(url=>histories.add(new Request(url,{cache:'reload'}))));
  await self.skipWaiting();
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('ia-loto-v53-unique-')&&key!==CACHE)
   .map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
 const isHistory=HISTORIES.includes(request.url);
 event.respondWith((async()=>{
  const cacheName=isHistory?HISTORY_CACHE:CACHE;
  try{
   const response=await fetch(request);
   if(response.ok){
    const copy=response.clone();
    try{await (await caches.open(cacheName)).put(request,copy);}catch{}
    return response;
   }
   if(!isHistory&&response.status<500)return response;
  }catch{}
  try{
   const cached=await (await caches.open(cacheName)).match(request,{ignoreSearch:true});
   if(cached)return cached;
  }catch{}
  return Response.error();
 })());
});
