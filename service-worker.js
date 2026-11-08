'use strict';
const CACHE='lernpoker-v14-offline';
const FILES=['./','./index.html','./manifest.webmanifest','./icon.svg','./quick-ui.css','./quick-ui.js','./multiway-engine.js','./raise-sizing.js','./mix-strategy.js','./recommendation-ui.js','./live-test.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(new URL('./',self.location).pathname))return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return response}).catch(()=>caches.match('./index.html'))))});
