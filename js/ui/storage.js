/**
 * Accès protégé au stockage du navigateur (localStorage).
 * Certains navigateurs (navigation privée, réglages d'établissement) interdisent ce stockage :
 * le simple fait d'y accéder lève alors une erreur. Ici, rien ne lève jamais d'erreur :
 * - lecture impossible  -> valeur absente (null)
 * - écriture impossible -> false (stockage interdit ou plein), l'application prévient l'utilisateur.
 */
(function () {
  let store = null;
  try {
    store = window.localStorage;
    const probe = '__3dfacile_test__';
    store.setItem(probe, '1');
    store.removeItem(probe);
  } catch (e) {
    store = null;
  }

  window.safeStorage = {
    /** Vrai si le navigateur autorise le stockage local. */
    available: !!store,
    getItem(key) {
      try { return store ? store.getItem(key) : null; } catch (e) { return null; }
    },
    /** Renvoie false si l'écriture a échoué (stockage interdit ou plein). */
    setItem(key, value) {
      try { if (!store) return false; store.setItem(key, String(value)); return true; } catch (e) { return false; }
    },
    removeItem(key) {
      try { if (store) store.removeItem(key); } catch (e) { /* rien à faire */ }
    },
    keys() {
      try { return store ? Object.keys(store) : []; } catch (e) { return []; }
    }
  };
})();
