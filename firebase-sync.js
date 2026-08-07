// =================================================================
// FIREBASE CLOUD SYNC (additive layer — loads AFTER script.js)

// -----------------------------------------------------------------
// BUILT-IN CONFIG
// -----------------------------------------------------------------
const DEFAULT_FB_CONFIG = {
  apiKey: "AIzaSyBN671_ZOD4wzzj6rQzgDoaDdaIYzDycRA",
  authDomain: "anas-tech-6ff0b.firebaseapp.com",
  projectId: "anas-tech-6ff0b",
  storageBucket: "anas-tech-6ff0b.firebasestorage.app",
  messagingSenderId: "926205065962",
  appId: "1:926205065962:web:1f0f4057ea941d0f02b593",
  databaseURL: "https://anas-tech-6ff0b-default-rtdb.firebaseio.com"
};

const FB_CONFIG_KEY = 'atw_firebase_config';
let fbApp = null, fbDb = null, fbRtdb = null, fbReady = false;
let fbUnsubUsers = null, fbUnsubUploads = null, fbUnsubMeta = null, fbUnsubPresence = null;
let fbChatUnsubs = {}; 
let fbKnownUserPhones = new Set();
let myPresenceRef = null;

function loadFirebaseConfig(){
  try {
    const saved = JSON.parse(localStorage.getItem(FB_CONFIG_KEY) || 'null');
    if(saved && saved.apiKey && saved.projectId) return saved;
  } catch(e){ /* ignore */ }
  if(DEFAULT_FB_CONFIG.apiKey && DEFAULT_FB_CONFIG.projectId) return DEFAULT_FB_CONFIG;
  return null;
}

function saveFirebaseConfig(){
  const cfg = {
    apiKey: document.getElementById('fb-apiKey')?.value.trim(),
    authDomain: document.getElementById('fb-authDomain')?.value.trim(),
    projectId: document.getElementById('fb-projectId')?.value.trim(),
    storageBucket: document.getElementById('fb-storageBucket')?.value.trim(),
    messagingSenderId: document.getElementById('fb-messagingSenderId')?.value.trim(),
    appId: document.getElementById('fb-appId')?.value.trim(),
    databaseURL: document.getElementById('fb-databaseURL')?.value.trim()
  };
  if(!cfg.apiKey || !cfg.projectId){
    const el = document.getElementById('fb-status');
    if(el) el.textContent = 'Please fill in at least API Key and Project ID.';
    return;
  }
  localStorage.setItem(FB_CONFIG_KEY, JSON.stringify(cfg));
  const el = document.getElementById('fb-status');
  if(el) el.textContent = 'Connecting...';
  initFirebase();
}

function fillFirebaseConfigForm(cfg){
  ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','databaseURL'].forEach(k => {
    const el = document.getElementById('fb-' + k);
    if(el && cfg[k]) el.value = cfg[k];
  });
}

function initFirebase(){
  const cfg = loadFirebaseConfig();
  if(!cfg || typeof firebase === 'undefined') return;
  try{
    fbApp = firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(cfg);
    fbDb = firebase.firestore();
    if(cfg.databaseURL) fbRtdb = firebase.database();
    fbReady = true;
    const statusEl = document.getElementById('fb-status');
    if(statusEl) statusEl.textContent = '✅ Connected — data now syncs live across every device.';
    startCloudListeners();
    
    if(typeof currentRole !== 'undefined'){
      if(currentRole === 'admin') setMyPresence('admin');
      else if(currentRole === 'user' && typeof currentUser !== 'undefined' && currentUser) setMyPresence(currentUser.phone);
    }
  }catch(e){
    const statusEl = document.getElementById('fb-status');
    if(statusEl) statusEl.textContent = 'Connection failed: ' + e.message;
    showFbError('init', e);
  }
}

// -----------------------------------------------------------------
// REAL-TIME LISTENERS
// -----------------------------------------------------------------
function startCloudListeners(){
  if(!fbReady) return;

  // Users collection
  if(fbUnsubUsers) fbUnsubUsers();
  fbUnsubUsers = fbDb.collection('users').onSnapshot(snap => {
    const cloudUsers = [];
    snap.forEach(doc => cloudUsers.push(doc.data()));
    const isFirstLoad = fbKnownUserPhones.size === 0 && (typeof users !== 'undefined' && users.length === 0);
    cloudUsers.forEach(u => {
      if(typeof currentRole !== 'undefined' && currentRole === 'admin' && !isFirstLoad && !fbKnownUserPhones.has(u.phone)){
        showNewUserToast(u);
      }
      fbKnownUserPhones.add(u.phone);
    });
    if(typeof users !== 'undefined') {
      users = cloudUsers.sort((a,b) => (a.serial || 0) - (b.serial || 0));
    }
    if(typeof saveState === 'function') saveState();
    if(typeof currentRole !== 'undefined' && currentRole === 'admin'){
      const screen = document.getElementById('screen-welcome-admin');
      if(screen && screen.classList.contains('active')){
        const st = document.getElementById('stat-total');
        const lc = document.getElementById('list-count');
        if(st) st.textContent = cloudUsers.length;
        if(lc) lc.textContent = cloudUsers.length + ' records';
        if(typeof renderUsersList === 'function') renderUsersList();
      }
    }
  }, err => showFbError('users', err));

  // Uploads collection
  if(fbUnsubUploads) fbUnsubUploads();
  fbUnsubUploads = fbDb.collection('uploads').onSnapshot(snap => {
    const cloudUploads = [];
    snap.forEach(doc => cloudUploads.push(doc.data()));
    if(typeof uploads !== 'undefined'){
      uploads = cloudUploads.sort((a,b) => a.id - b.id);
    }
    if(typeof saveState === 'function') saveState();
    if(typeof currentRole !== 'undefined'){
      if(currentRole === 'admin' && typeof renderAdminUploads === 'function') renderAdminUploads();
      if(currentRole === 'user' && typeof renderCommunityUploads === 'function') renderCommunityUploads();
    }
  }, err => showFbError('uploads', err));

  // Meta doc
  if(fbUnsubMeta) fbUnsubMeta();
  fbUnsubMeta = fbDb.collection('meta').doc('site').onSnapshot(doc => {
    if(!doc.exists) return;
    const d = doc.data();
    if(typeof d.siteAnnouncement === 'string' && typeof siteAnnouncement !== 'undefined'){ 
      siteAnnouncement = d.siteAnnouncement; 
      if(typeof applyAnnouncement === 'function') applyAnnouncement(); 
    }
    if(d.adminPassword && typeof ADMIN !== 'undefined'){ ADMIN.password = d.adminPassword; }
    if(typeof saveState === 'function') saveState();
  }, err => showFbError('meta', err));

  // Presence
  if(fbRtdb){
    if(fbUnsubPresence) fbUnsubPresence();
    const presenceRef = fbRtdb.ref('presence');
    const cb = snap => {
      if(typeof onlinePhones !== 'undefined') onlinePhones = new Set();
      let onlineCount = 0;
      snap.forEach(child => {
        if(child.val() && child.val().online){ 
          if(typeof onlinePhones !== 'undefined') onlinePhones.add(child.key); 
          onlineCount++; 
        }
      });
      if(typeof currentRole !== 'undefined' && currentRole === 'admin'){
        const onlineEl = document.getElementById('stat-online');
        const offlineEl = document.getElementById('stat-offline');
        const uLen = typeof users !== 'undefined' ? users.length : 0;
        if(onlineEl) onlineEl.textContent = onlineCount;
        if(offlineEl) offlineEl.textContent = Math.max(uLen - onlineCount, 0);
        if(typeof renderUsersList === 'function') renderUsersList();
      }
    };
    presenceRef.on('value', cb);
    fbUnsubPresence = () => presenceRef.off('value', cb);
  }

  if(typeof currentRole !== 'undefined'){
    if(currentRole === 'admin' && typeof openThreadPhone !== 'undefined' && openThreadPhone) subscribeToChat(openThreadPhone);
    if(currentRole === 'user' && typeof currentUser !== 'undefined' && currentUser) subscribeToChat(currentUser.phone);
  }
}

// -----------------------------------------------------------------
// VISIBLE ERROR BANNER
// -----------------------------------------------------------------
function showFbError(context, err){
  console.warn(context, err);
  let banner = document.getElementById('fb-error-banner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'fb-error-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;font-family:sans-serif;font-size:14px;padding:10px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3);';
    document.body.prepend(banner);
  }
  const code = (err && err.code) || 'unknown';
  let hint = 'Cloud sync error (' + context + '): ' + code + '.';
  if(code === 'permission-denied'){
    hint += ' Firestore Security Rules data ko block kar rahi hain — Firebase Console → Firestore Database → Rules mein jaake read/write allow karain.';
  } else if(code === 'unavailable' || code === 'not-found'){
    hint += ' Firestore Database shayad Firebase Console mein abhi banaya hi nahi gaya — Console → Firestore Database → Create database.';
  }
  banner.textContent = '⚠️ ' + hint;
  banner.style.display = 'block';
  const closeBtn = document.createElement('span');
  closeBtn.textContent = ' ✕';
  closeBtn.style.cssText = 'cursor:pointer;float:right;font-weight:bold;';
  closeBtn.onclick = () => { banner.style.display = 'none'; };
  banner.appendChild(closeBtn);
}

function showNewUserToast(u){
  const area = document.getElementById('new-user-toast-area');
  if(!area) return;
  const div = document.createElement('div');
  div.className = 'new-user-toast';
  const safeName = typeof escapeHtml === 'function' ? escapeHtml(u.name) : u.name;
  const safePhone = typeof escapeHtml === 'function' ? escapeHtml(u.phone) : u.phone;
  div.innerHTML = `<span>🟢 New user logged in: <b>${safeName}</b> (${safePhone})</span>`;
  const btn = document.createElement('button');
  btn.textContent = 'View Profile';
  btn.onclick = () => { if(typeof viewUserProfile === 'function') viewUserProfile(u.phone); };
  div.appendChild(btn);
  area.prepend(div);
  setTimeout(() => div.remove(), 15000);
}

// -----------------------------------------------------------------
// PRESENCE
// -----------------------------------------------------------------
function setMyPresence(id){
  if(!fbRtdb || !id) return;
  myPresenceRef = fbRtdb.ref('presence/' + id);
  fbRtdb.ref('.info/connected').on('value', snap => {
    if(snap.val() === true){
      myPresenceRef.onDisconnect().set({ online:false, lastSeen: Date.now() });
      myPresenceRef.set({ online:true, lastSeen: Date.now() });
    }
  });
}

function clearMyPresence(){
  if(myPresenceRef){ myPresenceRef.set({ online:false, lastSeen: Date.now() }); }
  myPresenceRef = null;
}
window.addEventListener('beforeunload', clearMyPresence);

// -----------------------------------------------------------------
// PUSH LOCAL CHANGES TO CLOUD
// -----------------------------------------------------------------
function fbSaveUser(u){ if(fbReady) fbDb.collection('users').doc(u.phone).set(u).catch(e=>console.warn(e)); }
function fbDeleteUser(phone){ if(fbReady) fbDb.collection('users').doc(phone).delete().catch(e=>console.warn(e)); }
function fbSaveUpload(u){ if(fbReady) fbDb.collection('uploads').doc(String(u.id)).set(u).catch(e=>console.warn(e)); }
function fbDeleteUpload(id){ if(fbReady) fbDb.collection('uploads').doc(String(id)).delete().catch(e=>console.warn(e)); }
function fbSaveMeta(){ if(fbReady && typeof siteAnnouncement !== 'undefined' && typeof ADMIN !== 'undefined') fbDb.collection('meta').doc('site').set({ siteAnnouncement, adminPassword: ADMIN.password }, {merge:true}).catch(e=>console.warn(e)); }

function subscribeToChat(phone){
  if(!fbReady || !phone || fbChatUnsubs[phone]) return;
  fbChatUnsubs[phone] = fbDb.collection('chats').doc(phone).collection('messages').orderBy('ts')
    .onSnapshot(snap => {
      const msgs = [];
      snap.forEach(doc => msgs.push(doc.data()));
      let name = phone;
      if(typeof chatThreads !== 'undefined' && chatThreads[phone] && chatThreads[phone].name) name = chatThreads[phone].name;
      else if(typeof users !== 'undefined'){
        const found = users.find(u=>u.phone===phone);
        if(found && found.name) name = found.name;
      }
      if(typeof chatThreads !== 'undefined') chatThreads[phone] = { name, messages: msgs };
      if(typeof saveState === 'function') saveState();
      if(typeof currentRole !== 'undefined'){
        if(currentRole === 'user' && typeof currentUser !== 'undefined' && currentUser && currentUser.phone === phone && typeof renderUserChatLog === 'function') renderUserChatLog();
        if(currentRole === 'admin'){ 
          if(typeof renderThreadList === 'function') renderThreadList(); 
          if(typeof openThreadPhone !== 'undefined' && openThreadPhone === phone && typeof renderAdminChatLog === 'function') renderAdminChatLog(); 
          const unreadEl = document.getElementById('stat-unread');
          if(unreadEl && typeof countUnread === 'function') unreadEl.textContent = countUnread(); 
        }
      }
    }, err => showFbError('chat', err));
}

function fbSendChatMessage(phone, msg){
  if(!fbReady) return;
  fbDb.collection('chats').doc(phone).collection('messages').add(Object.assign({}, msg, { ts: Date.now() })).catch(e=>console.warn(e));
}

// -----------------------------------------------------------------
// WRAP script.js FUNCTIONS
// -----------------------------------------------------------------
function wrapForCloudSync(){
  if(window.registerUser){
    const _registerUser = window.registerUser;
    window.registerUser = function(){
      const before = typeof users !== 'undefined' ? users.length : 0;
      _registerUser();
      if(fbReady && typeof users !== 'undefined' && users.length > before) fbSaveUser(users[users.length - 1]);
    };
  }

  if(window.toggleBlock){
    const _toggleBlock = window.toggleBlock;
    window.toggleBlock = function(phone){
      _toggleBlock(phone);
      if(fbReady && typeof users !== 'undefined'){
        const u = users.find(x => x.phone === phone);
        if(u) fbSaveUser(u);
      }
    };
  }

  if(window.handleAdminUpload){
    const _handleAdminUpload = window.handleAdminUpload;
    window.handleAdminUpload = function(e){
      const before = typeof uploads !== 'undefined' ? uploads.length : 0;
      _handleAdminUpload(e);
      setTimeout(() => { if(fbReady && typeof uploads !== 'undefined' && uploads.length > before) fbSaveUpload(uploads[uploads.length - 1]); }, 300);
    };
  }

  if(window.setUploadStatus){
    const _setUploadStatus = window.setUploadStatus;
    window.setUploadStatus = function(id, status){
      _setUploadStatus(id, status);
      if(fbReady && typeof uploads !== 'undefined'){
        const u = uploads.find(x => x.id === id);
        if(u) fbSaveUpload(u);
      }
    };
  }

  if(window.deleteUpload){
    const _deleteUpload = window.deleteUpload;
    window.deleteUpload = function(id){
      _deleteUpload(id);
      if(fbReady) fbDeleteUpload(id);
    };
  }

  if(window.changeAdminPassword){
    const _changeAdminPassword = window.changeAdminPassword;
    window.changeAdminPassword = function(){
      const before = typeof ADMIN !== 'undefined' ? ADMIN.password : '';
      _changeAdminPassword();
      if(fbReady && typeof ADMIN !== 'undefined' && ADMIN.password !== before) fbSaveMeta();
    };
  }

  if(window.saveAnnouncement){
    const _saveAnnouncement = window.saveAnnouncement;
    window.saveAnnouncement = function(){ _saveAnnouncement(); if(fbReady) fbSaveMeta(); };
  }

  if(window.clearAnnouncement){
    const _clearAnnouncement = window.clearAnnouncement;
    window.clearAnnouncement = function(){ _clearAnnouncement(); if(fbReady) fbSaveMeta(); };
  }

  if(window.userSendMessage){
    const _userSendMessage = window.userSendMessage;
    window.userSendMessage = function(){
      const input = document.getElementById('user-chat-input');
      const val = input ? input.value.trim() : '';
      if(!val || typeof currentUser === 'undefined' || !currentUser) return;
      if(fbReady){
        fbSendChatMessage(currentUser.phone, { from:'user', text: val, time: new Date().toLocaleTimeString(), read:false });
        if(input) input.value = '';
      } else {
        _userSendMessage();
      }
    };
  }

  if(window.adminSendMessage){
    const _adminSendMessage = window.adminSendMessage;
    window.adminSendMessage = function(){
      const input = document.getElementById('admin-chat-input');
      const val = input ? input.value.trim() : '';
      if(!val || typeof openThreadPhone === 'undefined' || !openThreadPhone) return;
      if(fbReady){
        fbSendChatMessage(openThreadPhone, { from:'admin', text: val, time: new Date().toLocaleTimeString(), read:true });
        if(input) input.value = '';
      } else {
        _adminSendMessage();
      }
    };
  }

  if(window.openThreadFor){
    const _openThreadFor = window.openThreadFor;
    window.openThreadFor = function(phone){ _openThreadFor(phone); if(fbReady) subscribeToChat(phone); };
  }

  if(window.beginLogin){
    const _beginLogin = window.beginLogin;
    window.beginLogin = function(role, user){
      _beginLogin(role, user);
      if(fbReady){
        setMyPresence(role === 'admin' ? 'admin' : user.phone);
        if(role === 'user') subscribeToChat(user.phone);
      }
    };
  }

  if(window.logout){
    const _logout = window.logout;
    window.logout = function(){ clearMyPresence(); _logout(); };
  }
}

// -----------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------
function startAppSync(){
  wrapForCloudSync();
  const cfg = loadFirebaseConfig();
  if(cfg){
    fillFirebaseConfigForm(cfg);
    initFirebase();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppSync);
} else {
  startAppSync();
}