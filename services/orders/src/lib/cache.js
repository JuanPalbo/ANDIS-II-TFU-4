class Cache {
  constructor() {
    // Mapa para guardar los datos en caché
    this.store = new Map(); // clave -> { value, expiresAt }
  }

  now() {
    return Date.now();
  }

  // Retorna el valor si existe y no expiró, o null
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= this.now()) {
      this.store.delete(key); // expira solo al leer
      return null;
    }
    return entry.value;
  }

  // Guarda el valor con TTL en ms
  set(key, value, ttlMs) {
    const expiresAt = ttlMs ? (this.now() + Number(ttlMs)) : 0;
    this.store.set(key, { value, expiresAt });
  }
}

module.exports = {
  Cache,
};
