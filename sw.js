const CACHE='ia-loto-v25-xbias-v1';
const ASSETS=["./", "./index.html", "./app.js", "./data.js", "./ev.js", "./protocole12.js", "./science10.js", "./science11.js", "./v13.js", "./v14.js", "./v15.js", "./v16.js", "./v1610.js", "./v1611.js", "./v1612.js", "./v1613.js", "./v1614.js", "./v1615.js", "./v1616.js", "./v163.js", "./v164.js", "./v165.js", "./v166.js", "./v167.js", "./v168.js", "./v169.js", "./v17.js", "./v18.js", "./v19.js", "./v20.js", "./v21.js", "./v22.js", "./v23.js", "./v24.js", "./xbias25.js", "./manifest.webmanifest"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ia-loto-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 const isDocument=e.request.mode==='navigate';
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(async()=>{const cached=await caches.match(e.request,{ignoreSearch:true});if(cached)return cached;if(isDocument)return await caches.match('./index.html');return Response.error()}));
});
