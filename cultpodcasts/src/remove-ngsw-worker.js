/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// tslint:disable:no-console

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());

  if (
    self.registration.active?.scriptURL.endsWith("ngsw-worker.js") ||
    self.registration.installing?.scriptURL.endsWith("ngsw-worker.js") ||
    self.registration.waiting?.scriptURL.endsWith("ngsw-worker.js")) {

    event.waitUntil(self.registration.unregister().then(() => {
      console.log('NGSW Safety Worker - unregistered old service worker');
    }));
  }
  event.waitUntil(caches.keys().then(cacheNames => {
    const ngswCacheNames = cacheNames.filter(name => /^ngsw:/.test(name));
    return Promise.all(ngswCacheNames.map(name => caches.delete(name)));
  }));
});
