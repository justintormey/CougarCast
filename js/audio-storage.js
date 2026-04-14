// Audio Storage — IndexedDB wrapper for music cue blobs
// localStorage can't handle audio files (5MB limit, no binary support).
// IndexedDB stores Blobs natively and is independent of the game state localStorage.

const DB_NAME = 'ainnouncr_audio';
const DB_VERSION = 1;
const STORE = 'cues';

export class AudioStorage {
  constructor() {
    this._db = null;
  }

  async _getDb() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE);
      };
      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Save a Blob under a string key
  async save(key, blob) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // Load a Blob by key; returns null if not found
  async load(key) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // Remove a Blob by key
  async remove(key) {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // Return all stored keys
  async getAllKeys() {
    const db = await this._getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Check if a key has a stored blob
  async has(key) {
    const blob = await this.load(key);
    return blob !== null;
  }
}

// Key helpers — consistent naming convention
export const CUE_KEYS = {
  goalHorn: () => 'goal-horn',
  timeout: () => 'timeout',
  walkup: (team, number) => `walkup-${team}-${number}`,
};
