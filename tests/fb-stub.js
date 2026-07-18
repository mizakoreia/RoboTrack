/* Firebase compat stub — Firestore + Auth em memória, com onSnapshot reativo.
   Suficiente pra exercitar os módulos reais do RoboTrack (MVC). */
(function(){
  const store = new Map();        // path -> data object (docs)
  const colListeners = new Map(); // colPath -> Set(cb)
  const docListeners = new Map(); // docPath -> Set(cb)
  window.__fs = { store, log: [] };

  function now(){ return Date.now(); }
  const FieldValue = {
    serverTimestamp: () => ({ __sentinel: 'ts', toDate: () => new Date() }),
    delete: () => ({ __sentinel: 'del' })
  };
  function applyData(target, data){
    const out = Object.assign({}, target);
    for (const k in data){
      const v = data[k];
      if (v && v.__sentinel === 'del') delete out[k];
      else if (v && v.__sentinel === 'ts') out[k] = { toDate: () => new Date(), __ts:true };
      else out[k] = v;
    }
    return out;
  }
  function colOf(path){ return path.substring(0, path.lastIndexOf('/')); }
  function idOf(path){ return path.substring(path.lastIndexOf('/')+1); }
  function fireDoc(path){
    (docListeners.get(path)||[]).forEach(cb => cb(makeSnap(path)));
    const c = colOf(path);
    (colListeners.get(c)||[]).forEach(cb => cb(makeColSnap(c)));
  }
  function makeSnap(path){
    const exists = store.has(path);
    return { exists, id: idOf(path), data: () => exists ? Object.assign({}, store.get(path)) : undefined };
  }
  function makeColSnap(colPath, orderBy, limit){
    let entries = [...store.keys()].filter(p => colOf(p) === colPath)
      .map(p => ({ id: idOf(p), data: () => Object.assign({}, store.get(p)) }));
    if (orderBy) entries.sort((a,b)=> (a.data()[orderBy]??0) - (b.data()[orderBy]??0));
    if (limit) entries = entries.slice(0, limit);
    return { empty: entries.length===0, docs: entries, forEach: f=>entries.forEach(f) };
  }

  function docRef(path){
    return {
      _path: path,
      collection(sub){ return colRef(path + '/' + sub); },
      set(data, opts){
        const prev = (opts && opts.merge && store.has(path)) ? store.get(path) : {};
        store.set(path, applyData(prev, data));
        window.__fs.log.push(['set', path]);
        fireDoc(path); return Promise.resolve();
      },
      update(data){
        if(!store.has(path)) store.set(path, {});
        store.set(path, applyData(store.get(path), data));
        window.__fs.log.push(['update', path]);
        fireDoc(path); return Promise.resolve();
      },
      delete(){ store.delete(path); window.__fs.log.push(['delete', path]); fireDoc(path); return Promise.resolve(); },
      get(){ return Promise.resolve(makeSnap(path)); },
      onSnapshot(cb, err){
        if(!docListeners.has(path)) docListeners.set(path, new Set());
        docListeners.get(path).add(cb);
        Promise.resolve().then(()=>cb(makeSnap(path)));
        return ()=>docListeners.get(path).delete(cb);
      }
    };
  }
  function colRef(path, _order, _limit){
    return {
      _path: path, _order, _limit,
      doc(id){ return docRef(path + '/' + (id || ('auto_'+Math.random().toString(36).slice(2)))); },
      add(data){ const r = this.doc(); return r.set(data).then(()=>r); },
      orderBy(f){ return colRef(path, f, _limit); },
      limit(n){ return colRef(path, _order, n); },
      get(){ return Promise.resolve(makeColSnap(path, _order, _limit)); },
      onSnapshot(cb, err){
        if(!colListeners.has(path)) colListeners.set(path, new Set());
        colListeners.get(path).add(cb);
        Promise.resolve().then(()=>cb(makeColSnap(path, _order, _limit)));
        return ()=>colListeners.get(path).delete(cb);
      }
    };
  }

  function makeDb(){
    const db = { collection(p){ return colRef(p); },
      enablePersistence(){ return Promise.resolve(); },
      batch(){ const ops=[]; return {
        set(ref,d,o){ ops.push(()=>ref.set(d,o)); return this; },
        update(ref,d){ ops.push(()=>ref.update(d)); return this; },
        delete(ref){ ops.push(()=>ref.delete()); return this; },
        commit(){ return Promise.all(ops.map(f=>f())); }
      };}
    };
    return db;
  }

  let authCb = null; let currentUser = null;
  const auth = {
    get currentUser(){ return currentUser; },
    onAuthStateChanged(cb){ authCb = cb; Promise.resolve().then(()=>cb(currentUser)); return ()=>{}; },
    signInWithEmailAndPassword(email){ currentUser = { uid:'uid_'+email.replace(/\W/g,''), email, displayName:null }; if(authCb) authCb(currentUser); return Promise.resolve({user:currentUser}); },
    createUserWithEmailAndPassword(email){ currentUser = { uid:'uid_'+email.replace(/\W/g,''), email, displayName:null, updateProfile(p){ this.displayName=p.displayName; return Promise.resolve(); } }; if(authCb) authCb(currentUser); return Promise.resolve({user:currentUser}); },
    signInWithPopup(){ return Promise.resolve({user:currentUser}); },
    signOut(){ currentUser=null; if(authCb) authCb(null); return Promise.resolve(); }
  };
  // helper de teste: força login com uid/email/nome específicos
  window.__login = (uid,email,displayName)=>{ currentUser={uid,email,displayName:displayName||null}; if(authCb) authCb(currentUser); };

  const firestore = () => makeDb();
  firestore.FieldValue = FieldValue;
  window.firebase = {
    initializeApp(){ return {}; },
    firestore, auth: () => auth
  };
  window.firebase.auth.GoogleAuthProvider = function(){};
})();
