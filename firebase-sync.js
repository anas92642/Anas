// =================================================================
// FIREBASE CLOUD SYNC (additive layer — loads AFTER script.js)
// Everything here is optional: if the admin hasn't pasted in a Firebase
// config yet, this file quietly does nothing and the site behaves exactly
// as before (local-only, per-browser). Once connected, it mirrors the
// site's data (users, uploads, chat, announcement, admin password) to
// Firestore in real time, and tracks online/offline presence with the
// Realtime Database — so every device sees the same live data.
//
// Setup: Admin panel → Settings → "Cloud Sync (Firebase)" card.
// =================================================================

const FB_CONFIG_KEY = 'atw_firebase_config';
const AI_STANDIN_KEY = 'atw_ai_standin_enabled';

// -----------------------------------------------------------------
// BUILT-IN CONFIG — fill this in ONCE with your Firebase project's
// values (Firebase console → Project settings → General → Your apps →
// SDK config) and every browser/device/network that opens this site
// will connect automatically. This is what fixes "only works on my
// computer" — previously the config only lived in the Admin Panel
// form, which saves to THAT browser's localStorage only, so no other
// visitor's browser ever had it. Firebase web apiKeys are meant to be
// public in client code (they are not secret) — access is controlled
// by your Firestore/Realtime Database security rules, not by hiding
// this key.
// -----------------------------------------------------------------
const DEFAULT_FB_CONFIG = {
  apiKey: "AIzaSyBN671_ZOD4wzzj6rQzgDoaDdaIYzDycRA",
  authDomain: "anas-tech-6ff0b.firebaseapp.com",
  projectId: "anas-tech-6ff0b",
  storageBucket: "anas-tech-6ff0b.firebasestorage.app",
  messagingSenderId: "926205065962",
  appId: "1:926205065962:web:1f0f4057ea941d0f02b593",
  databaseURL: "" // TODO: paste your Realtime Database URL here (see note below) — needed for online/offline presence to work
};
let fbApp = null, fbDb = null, fbRtdb = null, fbReady = false;
let fbUnsubUsers = null, fbUnsubUploads = null, fbUnsubMeta = null, fbUnsubPresence = null;
let fbChatUnsubs = {}; // phone -> unsubscribe fn
let fbKnownUserPhones = new Set(); // to detect genuinely NEW logins for the toast
let myPresenceRef = null;

function loadFirebaseConfig(){
  // 1) Prefer whatever this browser saved via the Admin Panel form
  //    (lets the admin override without editing code).
  try{
    const saved = JSON.parse(localStorage.getItem(FB_CONFIG_KEY) || 'null');
    if(saved && saved.apiKey && saved.projectId) return saved;
  }catch(e){ /* ignore */ }
  // 2) Fall back to the built-in config above, so EVERY browser/device
  //    connects the same way without needing the form filled in.
  if(DEFAULT_FB_CONFIG.apiKey && DEFAULT_FB_CONFIG.projectId) return DEFAULT_FB_CONFIG;
  return null;
}

function saveFirebaseConfig(){
  const cfg = {
    apiKey: document.getElementById('fb-apiKey').value.trim(),
    authDomain: document.getElementById('fb-authDomain').value.trim(),
    projectId: document.getElementById('fb-projectId').value.trim(),
    storageBucket: document.getElementById('fb-storageBucket').value.trim(),
    messagingSenderId: document.getElementById('fb-messagingSenderId').value.trim(),
    appId: document.getElementById('fb-appId').value.trim(),
    databaseURL: document.getElementById('fb-databaseURL').value.trim()
  };
  if(!cfg.apiKey || !cfg.projectId){
    document.getElementById('fb-status').textContent = 'Please fill in at least API Key and Project ID.';
    return;
  }
  localStorage.setItem(FB_CONFIG_KEY, JSON.stringify(cfg));
  document.getElementById('fb-status').textContent = 'Connecting...';
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
    // If a session was already restored (e.g. page refresh) before Firebase
    // finished connecting, re-establish this device's online presence now —
    // otherwise a refreshed admin/user would stay stuck showing "offline".
    if(currentRole === 'admin') setMyPresence('admin');
    else if(currentRole === 'user' && currentUser) setMyPresence(currentUser.phone);
  }catch(e){
    const statusEl = document.getElementById('fb-status');
    if(statusEl) statusEl.textContent = 'Connection failed: ' + e.message;
    showFbError('init', e);
  }
}

// -----------------------------------------------------------------
// REAL-TIME LISTENERS — pull cloud changes into the local arrays that
// script.js already renders with, so every existing render*() function
// keeps working unchanged.
// -----------------------------------------------------------------
function startCloudListeners(){
  if(!fbReady) return;

  // Users collection
  if(fbUnsubUsers) fbUnsubUsers();
  fbUnsubUsers = fbDb.collection('users').onSnapshot(snap => {
    const cloudUsers = [];
    snap.forEach(doc => cloudUsers.push(doc.data()));
    const isFirstLoad = fbKnownUserPhones.size === 0 && users.length === 0;
    cloudUsers.forEach(u => {
      if(currentRole === 'admin' && !isFirstLoad && !fbKnownUserPhones.has(u.phone)){
        showNewUserToast(u);
      }
      fbKnownUserPhones.add(u.phone);
    });
    users = cloudUsers.sort((a,b) => a.serial - b.serial);
    saveState();
    if(currentRole === 'admin' && document.getElementById('screen-welcome-admin').classList.contains('active')){
      document.getElementById('stat-total').textContent = users.length;
      document.getElementById('list-count').textContent = users.length + ' records';
      renderUsersList();
    }
  }, err => showFbError('users', err));

  // Uploads collection — this is what makes admin uploads show up on every
  // user's device, not just the admin's own browser.
  if(fbUnsubUploads) fbUnsubUploads();
  fbUnsubUploads = fbDb.collection('uploads').onSnapshot(snap => {
    const cloudUploads = [];
    snap.forEach(doc => cloudUploads.push(doc.data()));
    uploads = cloudUploads.sort((a,b) => a.id - b.id);
    saveState();
    if(currentRole === 'admin') renderAdminUploads();
    if(currentRole === 'user') renderCommunityUploads();
  }, err => showFbError('uploads', err));

  // Meta doc — announcement + admin password, shared site-wide
  if(fbUnsubMeta) fbUnsubMeta();
  fbUnsubMeta = fbDb.collection('meta').doc('site').onSnapshot(doc => {
    if(!doc.exists) return;
    const d = doc.data();
    if(typeof d.siteAnnouncement === 'string'){ siteAnnouncement = d.siteAnnouncement; applyAnnouncement(); }
    if(d.adminPassword){ ADMIN.password = d.adminPassword; }
    saveState();
  }, err => showFbError('meta', err));

  // Presence (Realtime Database) — who's online right now
  if(fbRtdb){
    if(fbUnsubPresence) fbUnsubPresence();
    const presenceRef = fbRtdb.ref('presence');
    const cb = snap => {
      onlinePhones = new Set();
      let onlineCount = 0, totalKnown = 0;
      snap.forEach(child => {
        totalKnown++;
        if(child.val() && child.val().online){ onlinePhones.add(child.key); onlineCount++; }
      });
      if(currentRole === 'admin'){
        const onlineEl = document.getElementById('stat-online');
        const offlineEl = document.getElementById('stat-offline');
        if(onlineEl) onlineEl.textContent = onlineCount;
        if(offlineEl) offlineEl.textContent = Math.max(users.length - onlineCount, 0);
        renderUsersList();
      }
      checkAdminOfflineForStandIn(snap);
    };
    presenceRef.on('value', cb);
    fbUnsubPresence = () => presenceRef.off('value', cb);
  }

  // If admin is viewing an open chat thread, make sure it's subscribed
  if(currentRole === 'admin' && openThreadPhone) subscribeToChat(openThreadPhone);
  if(currentRole === 'user' && currentUser) subscribeToChat(currentUser.phone);
}

// -----------------------------------------------------------------
// VISIBLE ERROR BANNER — cloud sync errors (e.g. Firestore permission
// denied because Security Rules aren't set, or the database was never
// created in the Firebase console) used to only show up in the browser
// DevTools console, which most people never open. Now they show as a
// clear on-page banner so the problem is obvious immediately.
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
  div.innerHTML = `<span>🟢 New user logged in: <b>${escapeHtml(u.name)}</b> (${escapeHtml(u.phone)})</span>`;
  const btn = document.createElement('button');
  btn.textContent = 'View Profile';
  btn.onclick = () => viewUserProfile(u.phone);
  div.appendChild(btn);
  area.prepend(div);
  setTimeout(() => div.remove(), 15000);
}

// -----------------------------------------------------------------
// PRESENCE — mark this device online, and let Firebase auto-flip it to
// offline the instant the tab closes/disconnects (onDisconnect).
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
// PUSH LOCAL CHANGES → CLOUD (wraps script.js's existing functions so
// nothing in script.js had to change — every local action also writes
// to Firestore when cloud sync is connected).
// -----------------------------------------------------------------
function fbSaveUser(u){ if(fbReady) fbDb.collection('users').doc(u.phone).set(u).catch(e=>console.warn(e)); }
function fbSaveUpload(u){ if(fbReady) fbDb.collection('uploads').doc(String(u.id)).set(u).catch(e=>console.warn(e)); }
function fbDeleteUpload(id){ if(fbReady) fbDb.collection('uploads').doc(String(id)).delete().catch(e=>console.warn(e)); }
function fbSaveMeta(){ if(fbReady) fbDb.collection('meta').doc('site').set({ siteAnnouncement, adminPassword: ADMIN.password }, {merge:true}).catch(e=>console.warn(e)); }

function subscribeToChat(phone){
  if(!fbReady || !phone || fbChatUnsubs[phone]) return;
  fbChatUnsubs[phone] = fbDb.collection('chats').doc(phone).collection('messages').orderBy('ts')
    .onSnapshot(snap => {
      const msgs = [];
      snap.forEach(doc => msgs.push(doc.data()));
      const name = (chatThreads[phone] && chatThreads[phone].name) || (users.find(u=>u.phone===phone)||{}).name || phone;
      chatThreads[phone] = { name, messages: msgs };
      saveState();
      if(currentRole === 'user' && currentUser && currentUser.phone === phone) renderUserChatLog();
      if(currentRole === 'admin'){ renderThreadList(); if(openThreadPhone === phone) renderAdminChatLog(); document.getElementById('stat-unread').textContent = countUnread(); }
    }, err => showFbError('chat', err));
}

function fbSendChatMessage(phone, msg){
  if(!fbReady) return;
  fbDb.collection('chats').doc(phone).collection('messages').add(Object.assign({}, msg, { ts: Date.now() })).catch(e=>console.warn(e));
}

// -----------------------------------------------------------------
// AI STAND-IN — when enabled and the admin's presence is offline, the
// assistant auto-replies to new user messages so the site is never
// "unmanned". Uses the existing Gemini key if the admin has set one,
// otherwise falls back to a helpful canned reply.
// -----------------------------------------------------------------
function toggleAiStandIn(){
  const on = document.getElementById('ai-standin-toggle').checked;
  localStorage.setItem(AI_STANDIN_KEY, on ? '1' : '0');
  document.getElementById('ai-standin-status').textContent = on
    ? 'AI stand-in is ON — it will answer users when you are offline.'
    : 'AI stand-in is OFF.';
}
(function restoreAiStandInToggle(){
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('ai-standin-toggle');
    if(el) el.checked = localStorage.getItem(AI_STANDIN_KEY) === '1';
  });
})();

let lastAdminOnline = true;
function checkAdminOfflineForStandIn(presenceSnap){
  const adminNode = presenceSnap.child('admin');
  lastAdminOnline = adminNode.exists() && adminNode.val() && adminNode.val().online;
}

async function maybeAiAutoReply(phone, userMessageText){
  if(localStorage.getItem(AI_STANDIN_KEY) !== '1') return;
  if(lastAdminOnline) return; // admin is here, let them answer
  let replyText;
  const key = localStorage.getItem('atw_gemini_key');
  if(key){
    try{
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{ parts:[{ text: 'You are a friendly support assistant for "Anas Technical World". Reply briefly (2-3 sentences) in the same language the user used (Roman Urdu or English) to this customer message: ' + userMessageText }]}]})
      });
      const data = await res.json();
      replyText = data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
    }catch(e){ console.warn('Gemini auto-reply failed', e); }
  }
  if(!replyText){
    replyText = currentLang==='ur'
      ? 'Assalam o Alaikum! Admin abhi offline hain, main AI Assistant aapki madad kar raha hoon. Aapka message note kar liya gaya hai, Admin online aatay hi aapko reply karain gay.'
      : "Hi! Admin is offline right now — I'm the AI Assistant standing in. Your message has been noted and Admin will reply as soon as they're back online.";
  }
  fbSendChatMessage(phone, { from:'ai', text: replyText, time: new Date().toLocaleTimeString(), read:true });
}

// -----------------------------------------------------------------
// WRAP script.js FUNCTIONS — additive hooks, called after the original
// logic runs, so local-only mode keeps working even if Firebase isn't
// configured.
// -----------------------------------------------------------------
function wrapForCloudSync(){
  const _registerUser = window.registerUser;
  window.registerUser = function(){
    const before = users.length;
    _registerUser();
    if(fbReady && users.length > before) fbSaveUser(users[users.length - 1]);
  };

  const _toggleBlock = window.toggleBlock;
  window.toggleBlock = function(phone){
    _toggleBlock(phone);
    const u = users.find(x => x.phone === phone);
    if(fbReady && u) fbSaveUser(u);
  };

  const _handleAdminUpload = window.handleAdminUpload;
  window.handleAdminUpload = function(e){
    const before = uploads.length;
    _handleAdminUpload(e);
    setTimeout(() => { if(fbReady && uploads.length > before) fbSaveUpload(uploads[uploads.length - 1]); }, 300);
  };
  const _setUploadStatus = window.setUploadStatus;
  window.setUploadStatus = function(id, status){
    _setUploadStatus(id, status);
    const u = uploads.find(x => x.id === id);
    if(fbReady && u) fbSaveUpload(u);
  };
  const _deleteUpload = window.deleteUpload;
  window.deleteUpload = function(id){
    _deleteUpload(id);
    if(fbReady) fbDeleteUpload(id);
  };

  const _changeAdminPassword = window.changeAdminPassword;
  window.changeAdminPassword = function(){
    const before = ADMIN.password;
    _changeAdminPassword();
    if(fbReady && ADMIN.password !== before) fbSaveMeta();
  };
  const _saveAnnouncement = window.saveAnnouncement;
  window.saveAnnouncement = function(){ _saveAnnouncement(); if(fbReady) fbSaveMeta(); };
  const _clearAnnouncement = window.clearAnnouncement;
  window.clearAnnouncement = function(){ _clearAnnouncement(); if(fbReady) fbSaveMeta(); };

  const _userSendMessage = window.userSendMessage;
  window.userSendMessage = function(){
    const input = document.getElementById('user-chat-input');
    const val = input.value.trim();
    if(!val || !currentUser) return;
    if(fbReady){
      fbSendChatMessage(currentUser.phone, { from:'user', text: val, time: new Date().toLocaleTimeString(), read:false });
      input.value = '';
      maybeAiAutoReply(currentUser.phone, val);
    } else {
      _userSendMessage();
    }
  };
  const _adminSendMessage = window.adminSendMessage;
  window.adminSendMessage = function(){
    const input = document.getElementById('admin-chat-input');
    const val = input.value.trim();
    if(!val || !openThreadPhone) return;
    if(fbReady){
      fbSendChatMessage(openThreadPhone, { from:'admin', text: val, time: new Date().toLocaleTimeString(), read:true });
      input.value = '';
    } else {
      _adminSendMessage();
    }
  };

  const _openThreadFor = window.openThreadFor;
  window.openThreadFor = function(phone){ _openThreadFor(phone); if(fbReady) subscribeToChat(phone); };

  const _beginLogin = window.beginLogin;
  window.beginLogin = function(role, user){
    _beginLogin(role, user);
    if(fbReady){
      setMyPresence(role === 'admin' ? 'admin' : user.phone);
      if(role === 'user') subscribeToChat(user.phone);
    }
  };
  const _logout = window.logout;
  window.logout = function(){ clearMyPresence(); _logout(); };
}

document.addEventListener('DOMContentLoaded', () => {
  wrapForCloudSync();
  const cfg = loadFirebaseConfig();
  if(cfg){
    fillFirebaseConfigForm(cfg);
    initFirebase();
  }
});
