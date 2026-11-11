/* Хранилище на IndexedDB (карточки + ключ-значение). Если IndexedDB недоступна, работает в памяти. */
const DB = (function () {
  'use strict';
  let db = null;
  let memory = false;
  const mem = { cards: new Map(), kv: new Map() };

  function open() {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open('kanji-sakura', 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('cards')) d.createObjectStore('cards', { keyPath: 'ch' });
          if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        };
        req.onsuccess = () => { db = req.result; resolve(true); };
        req.onerror = () => { memory = true; resolve(false); };
        req.onblocked = () => { memory = true; resolve(false); };
      } catch (e) { memory = true; resolve(false); }
    });
  }

  function run(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      let result;
      const r = fn(os);
      if (r) r.onsuccess = () => { result = r.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return {
    open,
    isMemory: () => memory,
    async allCards() {
      if (memory) return Array.from(mem.cards.values());
      return run('cards', 'readonly', os => os.getAll());
    },
    async putCard(card) {
      if (memory) { mem.cards.set(card.ch, card); return; }
      return run('cards', 'readwrite', os => os.put(card));
    },
    async putCards(cards) {
      if (memory) { cards.forEach(c => mem.cards.set(c.ch, c)); return; }
      return new Promise((resolve, reject) => {
        const tx = db.transaction('cards', 'readwrite');
        const os = tx.objectStore('cards');
        cards.forEach(c => os.put(c));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    async deleteCard(ch) {
      if (memory) { mem.cards.delete(ch); return; }
      return run('cards', 'readwrite', os => os.delete(ch));
    },
    async kvGet(key) {
      if (memory) return mem.kv.get(key);
      return run('kv', 'readonly', os => os.get(key));
    },
    async kvSet(key, value) {
      if (memory) { mem.kv.set(key, value); return; }
      return run('kv', 'readwrite', os => os.put(value, key));
    },
    async clearAll() {
      if (memory) { mem.cards.clear(); mem.kv.clear(); return; }
      await run('cards', 'readwrite', os => os.clear());
      await run('kv', 'readwrite', os => os.clear());
    }
  };
})();
