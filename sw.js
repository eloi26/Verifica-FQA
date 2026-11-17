/* Verifica FQA — guarda a app no dispositivo (abre depressa e funciona sem internet).
   Abre sempre a versão guardada e vai ver, em segundo plano, se há uma versão nova;
   se houver, guarda-a e avisa a app, que mostra «Atualizar».
   Não é preciso mexer neste ficheiro quando se atualiza o index.html. */
const CACHE = "fqa-pwa-v1";
const SCOPE = self.registration.scope;
const INDEX = new URL("index.html", SCOPE).href;
const PRE = ["index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon.png"]
  .map(p => new URL(p, SCOPE).href);

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PRE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const assinatura = r => [r.headers.get("etag"), r.headers.get("last-modified"), r.headers.get("content-length")].join("|");

function avisar(){
  self.clients.matchAll({ type: "window" }).then(cs => cs.forEach(c => c.postMessage({ type: "fqa-nova-versao" })));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;   // Supabase, fontes, etc.: direto à rede
  const nav = req.mode === "navigate";
  const alvo = nav ? INDEX : req.url;
  const eIndex = nav || url.href === INDEX;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(alvo, { ignoreSearch: true });
    const rede = fetch(alvo, { cache: "no-cache" }).then(async res => {
      if(res && res.ok){
        if(!guardado){ await cache.put(alvo, res.clone()); }
        else if(assinatura(guardado) !== assinatura(res)){ await cache.put(alvo, res.clone()); if(eIndex) avisar(); }
      }
      return res;
    }).catch(() => null);
    if(guardado){ e.waitUntil(rede); return guardado; }
    return (await rede) || Response.error();
  })());
});
