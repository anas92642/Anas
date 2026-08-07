// =================================================================
// FIREBASE CLOUD SYNC & VOICE ASSISTANT (Updated & Fixed Version)
// =================================================================

const FB_CONFIG_KEY = 'atw_firebase_config';
const AI_STANDIN_KEY = 'atw_ai_standin_enabled';

const DEFAULT_FB_CONFIG = {
  apiKey: "AIzaSyBN671_ZOD4wzzj6rQzgDoaDdaIYzDycRA",
  authDomain: "anas-tech-6ff0b.firebaseapp.com",
  projectId: "anas-tech-6ff0b",
  storageBucket: "anas-tech-6ff0b.firebasestorage.app",
  messagingSenderId: "926205065962",
  appId: "1:926205065962:web:1f0f4057ea941d0f02b593",
  databaseURL: "https://anas-tech-6ff0b-default-rtdb.firebaseio.com"
};

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

function initFirebase(){
  const cfg = loadFirebaseConfig();
  if(!cfg || typeof firebase === 'undefined') return;
  try{
    fbApp = firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(cfg);
    fbDb = firebase.firestore();
    if(cfg.databaseURL) fbRtdb = firebase.database();
    fbReady = true;
    const statusEl = document.getElementById('fb-status');
    if(statusEl) statusEl.textContent = '✅ Connected — Data syncing live.';
    startCloudListeners();
    
    if(typeof currentRole !== 'undefined'){
      if(currentRole === 'admin') setMyPresence('admin');
      else if(currentRole === 'user' && typeof currentUser !== 'undefined' && currentUser) setMyPresence(currentUser.phone);
    }
  }catch(e){
    showFbError('init', e);
  }
}

// -----------------------------------------------------------------
// REAL-TIME LISTENERS
// -----------------------------------------------------------------
function startCloudListeners(){
  if(!fbReady) return;

  // Realtime Sync Users
  if(fbUnsubUsers) fbUnsubUsers();
  fbUnsubUsers = fbDb.collection('users').onSnapshot(snap => {
    const cloudUsers = [];
    snap.forEach(doc => {
      const data = doc.data();
      if(data && data.phone) cloudUsers.push(data);
    });
    
    if(typeof users !== 'undefined') {
      users = cloudUsers;
    }
    
    if(typeof saveState === 'function') saveState();
    
    // Refresh Admin Panel
    if(typeof currentRole !== 'undefined' && currentRole === 'admin'){
      const st = document.getElementById('stat-total');
      const lc = document.getElementById('list-count');
      if(st) st.textContent = cloudUsers.length;
      if(lc) lc.textContent = cloudUsers.length + ' records';
      if(typeof renderUsersList === 'function') renderUsersList();
    }
  }, err => showFbError('users', err));

  // Sync Chats globally for admin
  if(typeof currentRole !== 'undefined' && currentRole === 'admin'){
    fbDb.collection('chats').onSnapshot(snap => {
      snap.forEach(doc => {
        subscribeToChat(doc.id);
      });
    });
  }

  // Uploads Collection Sync
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

  // Chat Subscription Helper
  if(typeof currentRole !== 'undefined'){
    if(currentRole === 'admin' && typeof openThreadPhone !== 'undefined' && openThreadPhone) subscribeToChat(openThreadPhone);
    if(currentRole === 'user' && typeof currentUser !== 'undefined' && currentUser) subscribeToChat(currentUser.phone);
  }
}

function subscribeToChat(phone){
  if(!fbReady || !phone || fbChatUnsubs[phone]) return;
  fbChatUnsubs[phone] = fbDb.collection('chats').doc(phone).collection('messages').orderBy('ts', 'asc')
    .onSnapshot(snap => {
      const msgs = [];
      snap.forEach(doc => msgs.push(doc.data()));
      let name = phone;
      if(typeof users !== 'undefined'){
        const found = users.find(u => u.phone === phone);
        if(found && found.name) name = found.name;
      }
      if(typeof chatThreads !== 'undefined') chatThreads[phone] = { name, messages: msgs };
      if(typeof saveState === 'function') saveState();
      
      if(typeof currentRole !== 'undefined'){
        if(currentRole === 'user' && typeof currentUser !== 'undefined' && currentUser && currentUser.phone === phone){
          if(typeof renderUserChatLog === 'function') renderUserChatLog();
        }
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
  if(!fbReady || !phone) return;
  const msgData = Object.assign({}, msg, { ts: Date.now() });
  fbDb.collection('chats').doc(phone).set({ lastUpdated: Date.now() }, { merge: true });
  fbDb.collection('chats').doc(phone).collection('messages').add(msgData).catch(e => console.warn(e));
}

function fbSaveUser(u){ 
  if(fbReady && u && u.phone) {
    fbDb.collection('users').doc(u.phone).set(u, { merge: true }).catch(e => console.warn(e)); 
  }
}

// -----------------------------------------------------------------
// VOICE ASSISTANT VOICE COMMAND HANDLER
// -----------------------------------------------------------------
function handleVoiceCommand(transcript) {
  const text = transcript.toLowerCase().trim();
  console.log("Voice Command Received:", text);

  // Command Matching
  if (text.includes("home") || text.includes("main page")) {
    if (typeof showScreen === 'function') showScreen('screen-welcome-user');
  } else if (text.includes("admin") || text.includes("admin panel")) {
    if (typeof showScreen === 'function') showScreen('screen-welcome-admin');
  } else if (text.includes("chat") || text.includes("message")) {
    if (typeof openChat === 'function') openChat();
  } else if (text.includes("logout") || text.includes("sign out")) {
    if (typeof logout === 'function') logout();
  } else if (text.includes("upload") || text.includes("files")) {
    if (typeof showScreen === 'function') showScreen('screen-community-uploads');
  } else if (text.startsWith("search ")) {
    const query = text.replace("search ", "").trim();
    const searchInput = document.getElementById('user-search-input') || document.getElementById('admin-search-input');
    if (searchInput) {
      searchInput.value = query;
      searchInput.dispatchEvent(new Event('input'));
    }
  } else {
    // Speak / Fallback Feedback
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance("Command not recognized: " + transcript);
      window.speechSynthesis.speak(utterance);
    }
  }
}

// Global Voice Assistant Speech Recognition Initializer
function setupVoiceAssistant() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech Recognition API not supported in this browser.");
    return;
  }
  
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    handleVoiceCommand(transcript);
  };

  recognition.onerror = function(event) {
    console.error("Voice Assistant Error:", event.error);
  };

  window.startVoiceAssistant = function() {
    try {
      recognition.start();
    } catch(e) {
      console.warn("Voice assistant already active or failed to start:", e);
    }
  };
}

// -----------------------------------------------------------------
// WRAP SCRIPT.JS FUNCTIONS FOR SYNC & VOICE BINDING
// -----------------------------------------------------------------
function wrapForCloudSync(){
  if(window.registerUser){
    const _registerUser = window.registerUser;
    window.registerUser = function(){
      _registerUser();
      if(typeof users !== 'undefined' && users.length > 0){
        const latestUser = users[users.length - 1];
        fbSaveUser(latestUser);
      }
    };
  }

  if(window.userSendMessage){
    const _userSendMessage = window.userSendMessage;
    window.userSendMessage = function(){
      const input = document.getElementById('user-chat-input');
      const val = input ? input.value.trim() : '';
      if(!val || typeof currentUser === 'undefined' || !currentUser) return;
      if(fbReady){
        fbSendChatMessage(currentUser.phone, { from: 'user', text: val, time: new Date().toLocaleTimeString(), read: false });
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
        fbSendChatMessage(openThreadPhone, { from: 'admin', text: val, time: new Date().toLocaleTimeString(), read: true });
        if(input) input.value = '';
      } else {
        _adminSendMessage();
      }
    };
  }
}

function showFbError(context, err){
  console.warn(context, err);
}

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

function startAppSync(){
  wrapForCloudSync();
  initFirebase();
  setupVoiceAssistant();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppSync);
} else {
  startAppSync();
}
