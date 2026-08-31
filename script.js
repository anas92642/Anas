// =================================================================
  // STATE + PERSISTENCE (localStorage — persists on this browser/device
  // across page reloads and file updates, since it is tied to the site
  // origin, not to the HTML file's contents)
  // =================================================================
  const STORAGE_KEY = 'atw_site_state_v1';
  const AUTO_BACKUP_KEY = 'atw_auto_backup_v1';
  const SESSION_KEY = 'atw_session_v1'; // keeps the user logged in across page refresh / tab reload
  const WHATSAPP_NUMBER = '923074499097';

let ADMIN = { name: "Anas Ishaq", password: "Anas007", erp: "92642" };
  let users = [];        // {serial, erp, name, phone, password, photo, blocked}
  let uploads = [];      // {id, fileName, fileType, dataUrl, status, uploadedAt, premium}
  let links = [];        // {id, name, url, addedAt, premium}
  let chatThreads = {};  // phone -> {name, messages:[{from:'user'|'admin', text, time, read}]}
  // Premium unlock requests — a user pays the fee, uploads a payment
  // screenshot, and Admin Accepts/Rejects it. {id, itemKind:'upload'|'link',
  // itemId, itemName, userPhone, userName, screenshot(dataUrl), status:
  // 'pending'|'approved'|'rejected', requestedAt}
  let premiumRequests = [];
  // Default premium fee is now just a fallback — the real, editable values
  // live in paymentSettings below (Admin → Settings → Payment Method).
  const PREMIUM_FEE_DEFAULT = 100;
  function getPaymentConfig(){
    return {
      method: localStorage.getItem('atw_payment_method') || 'JazzCash',
      number: localStorage.getItem('atw_payment_number') || '03074499097',
      name: localStorage.getItem('atw_payment_name') || 'Muhammad Anas Ishaq',
      fee: Number(localStorage.getItem('atw_payment_fee')) || PREMIUM_FEE_DEFAULT
    };
  }
  // kept as a getter-like reference so existing code that reads
  // PREMIUM_FEE still works, but always reflects the latest saved fee.
  Object.defineProperty(window, 'PREMIUM_FEE', { get: () => getPaymentConfig().fee });

  function initPaymentSettings(){
    const cfg = getPaymentConfig();
    const methodEl = document.getElementById('payment-method-input');
    const numEl = document.getElementById('payment-number-input');
    const nameEl = document.getElementById('payment-name-input');
    const feeEl = document.getElementById('payment-fee-input');
    if(methodEl) methodEl.value = cfg.method;
    if(numEl) numEl.value = cfg.number;
    if(nameEl) nameEl.value = cfg.name;
    if(feeEl) feeEl.value = cfg.fee;
    const statusEl = document.getElementById('payment-settings-status');
    if(statusEl) statusEl.textContent = currentLang==='ur'
      ? `Filhaal: ${cfg.method} · ${cfg.number} · ${cfg.name} · Rs ${cfg.fee}`
      : `Currently: ${cfg.method} · ${cfg.number} · ${cfg.name} · Rs ${cfg.fee}`;
  }

  function savePaymentSettings(){
    const method = (document.getElementById('payment-method-input').value || 'JazzCash').trim();
    const number = (document.getElementById('payment-number-input').value || '').trim();
    const name = (document.getElementById('payment-name-input').value || '').trim();
    const fee = Number(document.getElementById('payment-fee-input').value) || PREMIUM_FEE_DEFAULT;
    localStorage.setItem('atw_payment_method', method);
    localStorage.setItem('atw_payment_number', number);
    localStorage.setItem('atw_payment_name', name);
    localStorage.setItem('atw_payment_fee', String(fee));
    if(window.fbSavePaymentSettings) window.fbSavePaymentSettings({ method, number, name, fee });
    initPaymentSettings();
  }
  let erpCounter = 20000 + Math.floor(Math.random() * 70000);
  let uploadIdCounter = 1;
  let linkIdCounter = 1;
  let premiumReqIdCounter = 1;
  let pendingPhoto = null;
  let currentUser = null;
  let currentRole = null;    // 'admin' | 'user'
  let siteAnnouncement = '';
  let currentLang = 'ur';
  let openThreadPhone = null;
  let broadcastNotifications = []; // site-wide notifications (new publish, new link, announcement)
  let adminNotifications = [];     // admin-only feed (new registration requests, new messages)

function collectState(){
    return { ADMIN, users, uploads, links, chatThreads, premiumRequests, erpCounter, uploadIdCounter, linkIdCounter, premiumReqIdCounter, siteAnnouncement, currentLang, broadcastNotifications, adminNotifications };
  }

  function saveState(){
    try{
      const snapshot = localStorage.getItem(STORAGE_KEY);
      if(snapshot) localStorage.setItem(AUTO_BACKUP_KEY, snapshot);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    }catch(e){ console.warn('Save failed', e); }
  }

function applyState(data){
    if(!data) return;
    ADMIN = data.ADMIN || ADMIN;
    users = data.users || [];
    uploads = data.uploads || [];
    links = data.links || [];
    chatThreads = data.chatThreads || {};
    premiumRequests = data.premiumRequests || [];
    erpCounter = data.erpCounter || erpCounter;
    uploadIdCounter = data.uploadIdCounter || uploadIdCounter;
    linkIdCounter = data.linkIdCounter || linkIdCounter;
    premiumReqIdCounter = data.premiumReqIdCounter || premiumReqIdCounter;
    siteAnnouncement = data.siteAnnouncement || '';
    currentLang = data.currentLang || 'ur';
    broadcastNotifications = data.broadcastNotifications || [];
    adminNotifications = data.adminNotifications || [];
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) applyState(JSON.parse(raw));
    }catch(e){ console.warn('Load failed', e); }
  }

  // -----------------------------------------------------------------
  // SESSION PERSISTENCE — remembers who is logged in (admin / which
  // user) across a page refresh or a mobile browser silently reloading
  // an inactive tab. Without this, every refresh dropped the user back
  // to the login screen because currentUser/currentRole only lived in
  // memory.
  // -----------------------------------------------------------------
  function saveSession(){
    try{
      if(currentRole === 'admin'){
        localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'admin' }));
      } else if(currentRole === 'moderator' && currentUser){
        localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'moderator', phone: currentUser.phone }));
      } else if(currentRole === 'user' && currentUser){
        localStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'user', phone: currentUser.phone }));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }catch(e){ console.warn('Session save failed', e); }
  }

  function restoreSession(){
    let saved = null;
    try{ saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }catch(e){ saved = null; }
    if(!saved || !saved.role) return false;
    if(saved.role === 'admin'){
      beginLogin('admin', null);
      return true;
    }
if(saved.role === 'moderator'){
      const found = users.find(u => u.phone === saved.phone);
      if(found && found.role === 'moderator' && !found.blocked && found.approved !== false){
        beginLogin('moderator', found);
        return true;
      }
    }
    if(saved.role === 'user'){
      const found = users.find(u => u.phone === saved.phone);
      if(found && !found.blocked && found.approved !== false){
        beginLogin('user', found);
        return true;
      }
    }
    // couldn't restore (e.g. account deleted/blocked) — clear the stale session
    localStorage.removeItem(SESSION_KEY);
    return false;
  }

  function exportBackup(){
    const blob = new Blob([JSON.stringify(collectState(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anas-technical-world-backup-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    document.getElementById('backup-msg').textContent = t('backupDone');
  }

  function importBackup(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      try{
        const data = JSON.parse(ev.target.result);
        if(!confirm(t('confirmRestore'))) return;
        applyState(data);
        saveState();
        renderAdminWelcome();
        applyAnnouncement();
        document.getElementById('backup-msg').textContent = t('restoreDone');
      }catch(err){
        document.getElementById('backup-msg').textContent = t('restoreFail');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function restoreAutoBackup(){
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if(!raw){ document.getElementById('backup-msg').textContent = t('noAutoBackup'); return; }
    if(!confirm(t('confirmRestore'))) return;
    applyState(JSON.parse(raw));
    saveState();
    renderAdminWelcome();
    applyAnnouncement();
    document.getElementById('backup-msg').textContent = t('restoreDone');
  }

  // =================================================================
  // TRANSLATIONS
  // =================================================================
  const translations = {
    ur: {
      brand: 'SECURE <b>ANAS TECHNICAL WORLD</b> // PORTAL',
      portalSub: 'Apna role chunain — Admin ya User. Neeche ek hi box se login ya register karain.',
      accessTitle: 'Access Card', accessSub: 'Neeche apna role select karain',
      tabUser: 'User', tabAdmin: 'Admin',
btnRegister: 'Register', btnLogin: 'Login', btnLoginGo: 'Login',
      lblName: 'Naam (Name)', phName: 'e.g. Ahmed Raza',
      lblPhone: 'Phone Number', phPhone: 'e.g. 03001234567', phLoginPhone: 'Apna registered phone number',
      lblPassword: 'Password', phPassword: '••••••••',
      photoWord: 'Photo', btnUploadPic: 'Upload Picture',
      orDivider: 'ya agar account hai',
      btnRegisterGo: 'Register & Continue', noAccount: 'Account nahi hai?',
      btnAdminLogin: 'Login as Admin', waChat: 'WhatsApp par baat karain',
      pendingApproval: 'Aapka account abhi pending hai — Admin approval ke baad aap login kar sakengay.',
      btnApprove: 'Approve', btnReject: 'Reject', pendingBadge: 'Pending Approval',
      pendingStatus: 'Pending Approval', approvedStatus: 'Approved',
      authenticating: '// authenticating',
      registeredUser: 'Registered User', btnLogout: 'Logout',
      welcomeBrand: 'Welcome to Anas Technical World', welcomeSubtext: 'Aapka digital access card taiyar hai.',
      adminUpdates: '// Admin Updates', adminUpdatesNote: 'Ye files sirf Admin upload karta hai — aap yahan sirf dekh aur download kar saktay hain.',
      waAdminChat: 'Admin se WhatsApp par baat karain', supportLine: 'Support ke liye Admin se rabta karain:',
      accessGranted: '// Access Granted', welcomeBackAdmin: 'Welcome back, Anas',
      adminSubtext: 'Yahan sab registered users, uploads aur chat ka record hai.',
      totalUsers: 'Total Users', totalUploads: 'Total Uploads', unreadMsgs: 'Unread Messages',
      usersLog: '// System_Users.log', uploadsLog: '// Uploads_Control.log (Admin only)',
      adminUploadNote: 'Jo bhi file yahan upload karain, wo publish karne ke baad users ki side par show hogi.',
      btnUploadFile: '+ Upload File',
      linksLog: '// Links_Control.log (Admin only)', adminLinksNote: 'Yahan koi bhi link (URL) add karain — ek khud-ba-khud icon ban jayega aur users ko aapka link dikhega. Har link par uska naam neeche likha hota hai.',
      linkNamePh: 'Link ka naam (e.g. YouTube, Website)', linkUrlPh: 'https://...', btnAddLink: '+ Add Link',
      linksTitle: '// Admin Links',
      editProfile: '// Edit Profile', btnSaveProfile: 'Save Profile',
      liveChatLog: '// Live Chat', chatDeviceNote: 'Note: ye chat isi browser/device par save hoti hai (koi backend server nahi hai). Alag device se real live chat ke liye backend (jaise Firebase) chahiye hoga.',
      settingsLog: '// Settings', changePw: 'Change Admin Password', curPw: 'Current Password', newPw: 'New Password', confirmPw: 'Confirm New Password',
      btnUpdatePw: 'Update Password', siteAnn: 'Site Announcement', annLabel: 'Message (portal page par sab ko dikhegi)',
      annPh: 'e.g. System maintenance at 10 PM', btnSaveAnn: 'Save Announcement', btnClearAnn: 'Clear Announcement',
      aiCmdTitle: '// Quick Site Commands', aiCmdNote: 'Ye rule-based command box hai — site ko turant control karta hai. Try karain: "block Ahmed", "publish invoice", "delete photo1", "announcement lagao: naya update aa gaya", "accent green karo".',
      cmdPh: 'Command likhain...', btnRun: 'Run', ready: 'Ready.',
      geminiTitle: '// Gemini AI Assistant', geminiNote: 'Apni Google Gemini API key daal kar admin website update karne, content likhwane ya ideas lene ke liye AI se madad le sakta hai. Key sirf isi browser mein (local) save hoti hai aur seedha Google ko jaati hai.',
      geminiKeyPh: 'Gemini API Key (AIza...)', geminiPromptPh: 'e.g. Eid sale ke liye ek announcement likho',
      geminiReady: 'Gemini se pochne ke liye upar apni API key daalain.', btnAsk: 'Ask',
      btnRunGeminiAsCmd: 'Is jawab ko site command ki tarha chalayen',
      backupTitle: '// Backup & Restore', backupNote: 'Update karne se pehle backup download kar lain. Agar update ke doran koi error aa jaye, to backup file wapas import kar ke sab data restore ho jayega.',
      btnExportBackup: '⬇ Download Backup', btnImportBackup: '⬆ Restore From Backup', btnAutoRestore: '↺ Restore Last Auto-Backup',
      adminContact: 'Admin Contact:',
      btnDownload: 'Download', btnClose: 'Close',
      assistantTitle: 'Rehbar Assistant', assistantHint: 'Mic dabain aur bolain — jaise "logout karo", "dashboard".',
      chatWithAdmin: 'Admin Se Chat', typeMsg: 'Message likhain...', btnSend: 'Send',
      backupDone: 'Backup download ho gaya.', confirmRestore: 'Ye purana data wapas load kar dega — jari rakhain?',
      restoreDone: 'Data restore ho gaya.', restoreFail: 'File parhi nahi ja saki — sahi backup file chunain.',
      noAutoBackup: 'Abhi tak koi auto-backup mojood nahi.',
      notifTitle: '// Notifications',
      browserNotifTitle: '// Browser Notifications',
      browserNotifNote: 'Ye ON karne par, jab bhi koi nayi registration request aaye ya koi user aapko message bheje, to aapko is browser ki taraf se ek direct notification milegi — chahe tab khula na bhi ho. (Chrome/Edge apni taraf se ek baar permission pop-up dikhayega, use "Allow" karain.)',
      browserNotifToggleLabel: 'Enable browser notifications',
    },
    en: {
      brand: 'SECURE <b>ANAS TECHNICAL WORLD</b> // PORTAL',
      portalSub: 'Choose your role — Admin or User. Login or register from one box below.',
      accessTitle: 'Access Card', accessSub: 'Select your role below',
      tabUser: 'User', tabAdmin: 'Admin',
btnRegister: 'Register', btnLogin: 'Login', btnLoginGo: 'Login',
      lblName: 'Name', phName: 'e.g. Ahmed Raza',
      lblPhone: 'Phone Number', phPhone: 'e.g. 03001234567', phLoginPhone: 'Your registered phone number',
      lblPassword: 'Password', phPassword: '••••••••',
      photoWord: 'Photo', btnUploadPic: 'Upload Picture',
      orDivider: 'or if you already have an account',
      btnRegisterGo: 'Register & Continue', noAccount: "Don't have an account?",
      btnAdminLogin: 'Login as Admin', waChat: 'Chat on WhatsApp',
      pendingApproval: 'Your account is pending — you can log in after the Admin approves it.',
      btnApprove: 'Approve', btnReject: 'Reject', pendingBadge: 'Pending Approval',
      pendingStatus: 'Pending Approval', approvedStatus: 'Approved',
      authenticating: '// authenticating',
      registeredUser: 'Registered User', btnLogout: 'Logout',
      welcomeBrand: 'Welcome to Anas Technical World', welcomeSubtext: 'Your digital access card is ready.',
      adminUpdates: '// Admin Updates', adminUpdatesNote: 'Only the Admin uploads these files — you can view and download them here.',
      waAdminChat: 'Chat with Admin on WhatsApp', supportLine: 'For support, contact the Admin:',
      accessGranted: '// Access Granted', welcomeBackAdmin: 'Welcome back, Anas',
      adminSubtext: 'Here is the record of all registered users, uploads and chats.',
      totalUsers: 'Total Users', totalUploads: 'Total Uploads', unreadMsgs: 'Unread Messages',
      usersLog: '// System_Users.log', uploadsLog: '// Uploads_Control.log (Admin only)',
      adminUploadNote: 'Any file uploaded here will show on the user side once published.',
      btnUploadFile: '+ Upload File',
      linksLog: '// Links_Control.log (Admin only)', adminLinksNote: 'Add any link (URL) here — an icon is generated automatically and users will see your link. Each link has its name shown underneath.',
      linkNamePh: 'Link name (e.g. YouTube, Website)', linkUrlPh: 'https://...', btnAddLink: '+ Add Link',
      linksTitle: '// Admin Links',
      editProfile: '// Edit Profile', btnSaveProfile: 'Save Profile',
      liveChatLog: '// Live Chat', chatDeviceNote: 'Note: this chat is saved on this browser/device only (no backend server). Real live chat across different devices needs a backend (e.g. Firebase).',
      settingsLog: '// Settings', changePw: 'Change Admin Password', curPw: 'Current Password', newPw: 'New Password', confirmPw: 'Confirm New Password',
      btnUpdatePw: 'Update Password', siteAnn: 'Site Announcement', annLabel: 'Message (shown to everyone on the portal page)',
      annPh: 'e.g. System maintenance at 10 PM', btnSaveAnn: 'Save Announcement', btnClearAnn: 'Clear Announcement',
      aiCmdTitle: '// Quick Site Commands', aiCmdNote: 'A rule-based command box — controls the site instantly. Try: "block Ahmed", "publish invoice", "delete photo1", "announcement: new update is live", "accent green".',
      cmdPh: 'Type a command...', btnRun: 'Run', ready: 'Ready.',
      geminiTitle: '// Gemini AI Assistant', geminiNote: 'Add your Google Gemini API key to get AI help writing content, ideas, or updates for the site. The key is saved only in this browser and goes straight to Google.',
      geminiKeyPh: 'Gemini API Key (AIza...)', geminiPromptPh: 'e.g. Write an Eid sale announcement',
      geminiReady: 'Enter your API key above to ask Gemini.', btnAsk: 'Ask',
      btnRunGeminiAsCmd: 'Run this reply as a site command',
      backupTitle: '// Backup & Restore', backupNote: 'Download a backup before making updates. If an update causes errors, import the backup file to restore everything.',
      btnExportBackup: '⬇ Download Backup', btnImportBackup: '⬆ Restore From Backup', btnAutoRestore: '↺ Restore Last Auto-Backup',
      adminContact: 'Admin Contact:',
      btnDownload: 'Download', btnClose: 'Close',
      assistantTitle: 'Guide Assistant', assistantHint: 'Press the mic and speak — e.g. "logout", "dashboard".',
      chatWithAdmin: 'Chat With Admin', typeMsg: 'Type a message...', btnSend: 'Send',
      backupDone: 'Backup downloaded.', confirmRestore: 'This will load the old data back — continue?',
      restoreDone: 'Data restored.', restoreFail: 'Could not read the file — pick a valid backup file.',
      noAutoBackup: 'No auto-backup exists yet.',
      notifTitle: '// Notifications',
      browserNotifTitle: '// Browser Notifications',
      browserNotifNote: 'When enabled, you\'ll get a direct browser notification whenever a new registration request comes in or a user sends you a message — even if the tab isn\'t open. (Chrome/Edge will show a one-time permission pop-up — choose "Allow".)',
      browserNotifToggleLabel: 'Enable browser notifications',
    }
  };
  function t(key){ return (translations[currentLang] && translations[currentLang][key]) || key; }

  function setLanguage(lang){
    currentLang = lang;
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
    document.getElementById('lang-btn-ur').classList.toggle('active', lang === 'ur');
    document.getElementById('lang-btn-en').classList.toggle('active', lang === 'en');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      el.setAttribute('placeholder', t(key));
    });
    saveState();
    // re-render dynamic content that embeds translated strings
    if(document.getElementById('screen-welcome-admin').classList.contains('active')) renderAdminWelcome();
    if(document.getElementById('screen-welcome-user').classList.contains('active')) renderCommunityUploads();
  }

  // =================================================================
  // SCREENS / TABS
  // =================================================================
  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function switchRoleTab(which){
    const paneUser = document.getElementById('pane-user');
    const paneAdmin = document.getElementById('pane-admin');
    document.getElementById('role-tab-user').classList.toggle('active', which === 'user');
    document.getElementById('role-tab-admin').classList.toggle('active', which === 'admin');
    paneUser.style.display = which === 'user' ? 'block' : 'none';
    paneAdmin.style.display = which === 'admin' ? 'block' : 'none';
  }

function switchUserTab(which){
    const regForm = document.getElementById('register-form');
    const logForm = document.getElementById('login-form');
    const tabR = document.getElementById('tab-register');
    const tabL = document.getElementById('tab-login');
    const regErr = document.getElementById('register-error');
    const regOk = document.getElementById('register-success');
    const logErr = document.getElementById('login-error');
    if(regErr) regErr.textContent = '';
    if(regOk) regOk.textContent = '';
    if(logErr) logErr.textContent = '';
    if(which === 'register'){
      if(regForm) regForm.style.display = 'block';
      if(logForm) logForm.style.display = 'none';
      if(tabR) tabR.classList.add('active');
      if(tabL) tabL.classList.remove('active');
    } else {
      if(regForm) regForm.style.display = 'none';
      if(logForm) logForm.style.display = 'block';
      if(tabL) tabL.classList.add('active');
      if(tabR) tabR.classList.remove('active');
    }
  }

  function previewPhoto(e){
    const file = e.target.files[0];
    if(!file) return;
    compressImageFile(file, 700, 0.72).then(function(dataUrl){
      pendingPhoto = dataUrl;
      document.getElementById('reg-photo-preview').innerHTML = `<img src="${dataUrl}" alt="preview">`;
    });
  }

  function initials(name){
    return name.trim().split(/\s+/).map(w => w[0]).join('').substring(0,2).toUpperCase();
  }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // =================================================================
  // IMAGE COMPRESSION — large uncompressed photos (multi-MB from modern
  // phone cameras) are the #1 cause of: (a) uploads that "look" saved
  // but silently fail to sync to the cloud (Firestore rejects documents
  // over 1MB), and (b) a bloated localStorage / slow re-renders that
  // feel laggy. Resizing + re-encoding as JPEG before storing fixes
  // both at the source.
  // =================================================================
  function compressImageFile(file, maxDim, quality){
    return new Promise(function(resolve, reject){
      const reader = new FileReader();
      reader.onload = function(ev){
        const img = new Image();
        img.onload = function(){
          let w = img.width, h = img.height;
          if(w > maxDim || h > maxDim){
            if(w > h){ h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try{ resolve(canvas.toDataURL('image/jpeg', quality)); }
          catch(e){ resolve(ev.target.result); } // fallback: original (e.g. tainted canvas)
        };
        img.onerror = function(){ resolve(ev.target.result); }; // fallback: not a decodable image
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // =================================================================
  // REGISTRATION / LOGIN
  // =================================================================
  function registerUser(){
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const err = document.getElementById('register-error');
    err.textContent = '';
    if(!name || !phone || !password){ err.textContent = currentLang==='ur' ? 'Naam, phone number aur password zaroori hain.' : 'Name, phone number and password are required.'; return; }
    if(password.length < 4){ err.textContent = currentLang==='ur' ? 'Password kam az kam 4 characters ka ho.' : 'Password must be at least 4 characters.'; return; }
    if(users.some(u => u.phone === phone)){ err.textContent = currentLang==='ur' ? 'Ye phone number pehle se registered hai. Login karain.' : 'This phone number is already registered. Please login.'; return; }

const newUser = { serial: users.length + 1, erp: String(erpCounter++), name, phone, password, photo: pendingPhoto, blocked:false, approved:false, role:'user' };
    users.push(newUser);
    chatThreads[phone] = chatThreads[phone] || { name, messages: [] };
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(newUser);

    // Notify Admin immediately — both inside the website (bell/log) and
    // by email — whenever anyone joins/registers, regardless of whether
    // Cloud Sync (Firebase) is connected.
    pushAdminNotification(
      'Nayi registration request: "' + name + '" (' + phone + ') — approval ka intezar hai.',
      'New registration request: "' + name + '" (' + phone + ') — awaiting approval.'
    );
    fireBrowserNotification(
      currentLang==='ur' ? 'Nayi Registration Request' : 'New Registration Request',
      name + ' — ' + phone
    );
    sendEmailNotification(
      'New user joined — Anas Technical World',
      'A new user has registered on the website.\n\nName: ' + name + '\nPhone: ' + phone + '\n\nLog in to the Admin dashboard to accept or reject this request.'
    );

    document.getElementById('reg-name').value = '';
    document.getElementById('reg-phone').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-photo-preview').innerHTML = t('photoWord');
    pendingPhoto = null;

    // New accounts are NOT auto-logged-in — they await Admin approval.
    const okEl = document.getElementById('register-success');
    if(okEl) okEl.textContent = t('pendingApproval');
    switchUserTab('login');
    const loginPhoneEl = document.getElementById('login-phone');
    if(loginPhoneEl) loginPhoneEl.value = phone;
  }

function userLogin(){
    const phoneInput = document.getElementById('login-phone');
    const passwordInput = document.getElementById('login-password');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const err = document.getElementById('login-error');
    err.textContent = '';
    const found = users.find(u => u.phone === phone);
    if(!found){ err.textContent = currentLang==='ur' ? 'Ye phone number registered nahi. Pehle register karain.' : 'This phone number is not registered. Please register first.'; return; }
    if(found.password !== password){ err.textContent = currentLang==='ur' ? 'Password ghalat hai.' : 'Incorrect password.'; return; }
    if(found.blocked){ err.textContent = (currentLang==='ur' ? 'Ye account block kar diya gaya hai. Admin se rabta karain: ' : 'This account has been blocked. Contact Admin: ') + '+923074499097'; return; }
    if(found.approved === false){ err.textContent = t('pendingApproval'); return; }
    if(found.role === 'moderator'){ beginLogin('moderator', found); return; }
    beginLogin('user', found);
  }

  function adminLogin(){
    const pass = document.getElementById('admin-password').value;
    const err = document.getElementById('admin-error');
    err.textContent = '';
    if(pass !== ADMIN.password){ err.textContent = currentLang==='ur' ? 'Ghalat password. Dubara koshish karain.' : 'Incorrect password. Please try again.'; return; }
    document.getElementById('admin-password').value = '';
    beginLogin('admin', null);
  }

  // =================================================================
  // BOOT-SEQUENCE LOADING ANIMATION
  // =================================================================
  function bootLines(role){
    if(role === 'admin'){
      return [
        { t: '> connecting to secure channel', ok: false },
        { t: '> verifying admin key', ok: false },
        { t: '> loading system users', ok: false },
        { t: '> access granted ✓', ok: true }
      ];
    }
    return [
      { t: '> connecting to secure channel', ok: false },
      { t: '> verifying credentials', ok: false },
      { t: '> access granted ✓', ok: true }
    ];
  }

  function beginLogin(role, user){
    currentRole = role;
    currentUser = user;
    saveSession();
    showScreen('screen-loading');

    const container = document.getElementById('boot-lines');
    container.innerHTML = '';
    const fill = document.querySelector('.progress-fill');
    fill.style.animation = 'none';
    void fill.offsetWidth;
    fill.style.animation = '';

    const lines = bootLines(role);
    const stepDelay = 1000 / (lines.length + 1);
    lines.forEach((line, i) => {
      setTimeout(() => {
        const div = document.createElement('div');
        div.textContent = line.t;
        if(line.ok) div.classList.add('ok');
        container.appendChild(div);
      }, stepDelay * (i + 1));
    });

    setTimeout(() => {
      if(role === 'admin') renderAdminWelcome();
      else if(role === 'moderator') renderModeratorWelcome(user);
      else renderUserWelcome(user);
    }, 1050);
  }

  function renderUserWelcome(u){
    document.getElementById('wu-name-mini').textContent = u.name;
    document.getElementById('wu-avatar-mini').innerHTML = u.photo ? `<img src="${u.photo}">` : initials(u.name);

    const photoBlock = u.photo ? `<img src="${u.photo}" alt="${u.name}">` : initials(u.name);
    document.getElementById('wu-idcard').innerHTML = `
      <div class="cardscan"></div>
      <div class="head">Secure Access Card</div>
      <div class="photo">${photoBlock}</div>
      <div class="name">${escapeHtml(u.name)}</div>
      <div class="role2">${t('registeredUser')}</div>
      <div class="divider"></div>
      <div class="rows">
        <div class="row"><span>Serial</span><span>#${String(u.serial).padStart(3,'0')}</span></div>
        <div class="row"><span>ERP Code</span><span class="erp">${u.erp}</span></div>
        <div class="row"><span>Phone</span><span>${escapeHtml(u.phone)}</span></div>
      </div>
      <div class="barcode"></div>
      <div class="statusline"><span class="dot"></span> Verified</div>
    `;
    const card = document.getElementById('wu-idcard');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    const circle = document.getElementById('welcome-circle-block');
    circle.style.animation = 'none'; void circle.offsetWidth; circle.style.animation = '';

document.getElementById('portal-whatsapp').href = 'https://wa.me/' + WHATSAPP_NUMBER;
    document.getElementById('user-whatsapp').href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Assalam o Alaikum, mera naam ' + u.name + ' hai.');

    // populate edit-profile form
    document.getElementById('profile-name-input').value = u.name;
    document.getElementById('profile-photo-preview').innerHTML = u.photo ? `<img src="${u.photo}">` : '👤';
    document.getElementById('profile-success').textContent = '';

    renderCommunityUploads();
    renderUserLinks();
    renderUserChatLog();
    renderNotifBell();
    showScreen('screen-welcome-user');
  }

  function renderAdminWelcome(){
    document.getElementById('admin-name-label').textContent = ADMIN.name;
    document.getElementById('admin-role-label').textContent = (currentLang==='ur' ? 'Administrator · ERP ' : 'Administrator · ERP ') + ADMIN.erp;
    document.getElementById('stat-total').textContent = users.length;
    document.getElementById('stat-uploads').textContent = uploads.length;
document.getElementById('stat-unread').textContent = countUnread();
    document.getElementById('list-count').textContent = users.length + ' ' + (currentLang==='ur' ? 'records' : 'records');
    renderUsersList();
    renderAdminContent();
    renderModSubmissionsForAdmin();
    renderPremiumRequests();
    renderThreadList();
    renderNotifBell();
    const notifToggle = document.getElementById('browser-notif-toggle');
    if(notifToggle) notifToggle.checked = isBrowserNotifEnabled();
    document.getElementById('portal-whatsapp').href = 'https://wa.me/' + WHATSAPP_NUMBER;
    showScreen('screen-welcome-admin');
  }

function logout(){
    currentUser = null;
    currentRole = null;
    openThreadPhone = null;
    saveSession();
    if(document.getElementById('reg-name')) document.getElementById('reg-name').value = '';
    if(document.getElementById('reg-phone')) document.getElementById('reg-phone').value = '';
    if(document.getElementById('reg-password')) document.getElementById('reg-password').value = '';
    if(document.getElementById('admin-password')) document.getElementById('admin-password').value = '';
    if(document.getElementById('chat-panel')) document.getElementById('chat-panel').classList.remove('open');
    try{ stopListening(); }catch(e){}
    switchRoleTab('user');
    showScreen('screen-portal');
  }

  // =================================================================
  // MODERATOR — a normal registered user that Admin has promoted.
  // A moderator logs in through the exact same "User → Login" form as
  // everyone else; the site detects u.role === 'moderator' and routes
  // them here instead of the normal user screen. This panel shows
  // ONLY pending registration requests with Accept/Reject — nothing
  // else (no passwords, no uploads, no chat, no settings). As soon as
  // a request is approved/rejected it disappears immediately, both
  // here and from the Admin's own list.
  // =================================================================
  function renderModeratorWelcome(u){
    const nameEl = document.getElementById('mod-name-label');
    if(nameEl) nameEl.textContent = u.name;
    renderModeratorRequests();
    renderCommunityUploads();   // mirrors user's "Admin Updates"
    renderUserLinks();          // mirrors user's "Admin Links"
    renderModOwnSubmissions();  // moderator's own submitted uploads/links
    showScreen('screen-welcome-moderator');
  }

  function renderModeratorRequests(){
    const area = document.getElementById('moderator-requests-area');
    if(!area) return;
    const pending = users.filter(u => u.approved === false);
    const countEl = document.getElementById('moderator-count-label');
    if(countEl) countEl.textContent = pending.length + (currentLang==='ur' ? ' requests' : ' requests');
    if(pending.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi koi nayi registration request nahi hai.' : 'No new registration requests right now.'}</div>`;
      return;
    }
    area.innerHTML = pending.map(u => `
      <div class="moderator-request-row">
        <div class="ph">${u.photo ? `<img src="${u.photo}">` : initials(u.name)}</div>
        <div class="info">
          <div class="n">${escapeHtml(u.name)}</div>
          <div class="p">${escapeHtml(u.phone)}</div>
          <div class="e">ERP ${u.erp}</div>
        </div>
        <div class="actions">
          <button class="btn-outline-green" onclick="approveUser('${u.phone}')">✓ ${currentLang==='ur' ? 'Accept' : 'Accept'}</button>
          <button class="btn-outline-danger" onclick="rejectUser('${u.phone}')">✕ ${currentLang==='ur' ? 'Reject' : 'Reject'}</button>
        </div>
      </div>
    `).join('');
  }

  // Admin promotes/demotes a registered (approved) user to Moderator.
  // Only Admin can do this — the button only exists inside the Admin
  // users list, never on the moderator's own screen.
  function toggleModerator(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    const makingModerator = u.role !== 'moderator';
    if(makingModerator){
      if(!confirm(currentLang==='ur'
        ? ('"' + u.name + '" ko Moderator banayein? Ye ab apne login se sirf registration requests accept/reject kar sakega.')
        : ('Make "' + u.name + '" a Moderator? They will be able to log in and only accept/reject registration requests.'))) return;
    }
    u.role = makingModerator ? 'moderator' : 'user';
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(u);
    renderUsersList();
  }

  // =================================================================
  // ADMIN: USERS LIST + BLOCK/UNBLOCK
  // =================================================================
  function renderUsersList(){
    const area = document.getElementById('user-list-area');
    if(users.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak koi user register nahi hua.' : 'No users have registered yet.'}</div>`;
      return;
    }
area.innerHTML = `<div class="user-grid">` + users.map(u => {
      const isPending = u.approved === false;
      const statusBadge = isPending
        ? `<div class="badge-pending">● ${t('pendingBadge')}</div>`
        : (u.blocked ? `<div class="badge-blocked">● ${currentLang==='ur'?'Blocked':'Blocked'}</div>` : `<div class="badge-approved">● ${t('approvedStatus')}</div>`);
      const moderatorBadge = u.role === 'moderator' ? `<div class="badge-approved" style="color:var(--amber);">🛡 Moderator</div>` : '';
      const approveBtns = isPending
        ? `<button class="btn-outline-green" onclick="approveUser('${u.phone}')">✓ ${t('btnApprove')}</button>
           <button class="btn-outline-danger" onclick="rejectUser('${u.phone}')">✕ ${t('btnReject')}</button>`
        : '';
      const moderatorBtn = !isPending
        ? `<button class="btn-outline-amber" onclick="toggleModerator('${u.phone}')">${u.role==='moderator' ? (currentLang==='ur'?'🛡 Moderator Hatayen':'🛡 Remove Moderator') : (currentLang==='ur'?'🛡 Moderator Banayen':'🛡 Make Moderator')}</button>`
        : '';
      return `
      <div class="user-row ${u.blocked ? 'blocked' : ''} ${isPending ? 'pending' : ''}">
        <div class="serial">#${String(u.serial).padStart(3,'0')}</div>
        <div class="ph">${u.photo ? `<img src="${u.photo}">` : initials(u.name)}</div>
        <div class="info">
          <div class="n">${escapeHtml(u.name)} <span class="presence-dot ${onlinePhones.has(u.phone) ? 'is-online' : 'is-offline'}" title="${onlinePhones.has(u.phone) ? 'Online' : 'Offline'}"></span></div>
          <div class="p">${escapeHtml(u.phone)}</div>
          <div class="e">ERP ${u.erp}</div>
          ${statusBadge}
          ${moderatorBadge}
        </div>
        <div class="actions">
          ${approveBtns}
          ${u.blocked && !isPending
            ? `<button class="btn-outline-green" onclick="toggleBlock('${u.phone}')">${currentLang==='ur'?'Unblock':'Unblock'}</button>`
            : (!isPending ? `<button class="btn-outline-danger" onclick="toggleBlock('${u.phone}')">${currentLang==='ur'?'Block':'Block'}</button>` : '')}
          ${moderatorBtn}
          <button class="btn-outline-green" onclick="openThreadFor('${u.phone}')">💬 Chat</button>
          <button class="btn-outline-amber" onclick="adminResetUserPassword('${u.phone}')">🔑 Password</button>
          <button class="btn-outline-green" onclick="viewUserPassword('${u.phone}')">👁 View Password</button>
          <button class="btn-outline-green" onclick="viewUserProfile('${u.phone}')">👤 Profile</button>
          <button class="btn-outline-danger" onclick="deleteUser('${u.phone}')">🗑 Delete</button>
        </div>
      </div>
    `;
    }).join('') + `</div>`;
  }

  // Tracks which users' phones are currently online — populated by
  // firebase-sync.js (presence system). Empty set = cloud sync not
  // connected, so nobody shows as "online" (this browser can't know).
  var onlinePhones = new Set();

  function adminResetUserPassword(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    const label = currentLang==='ur' ? ('"' + u.name + '" ke liye naya password likhain (kam az kam 4 characters):') : ('Enter a new password for "' + u.name + '" (min 4 characters):');
    const val = prompt(label);
    if(val === null) return;
    if(val.length < 4){ alert(currentLang==='ur' ? 'Password kam az kam 4 characters ka ho.' : 'Password must be at least 4 characters.'); return; }
    u.password = val;
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(u);
    alert(currentLang==='ur' ? (u.name + ' ka password update ho gaya.') : (u.name + "'s password has been updated."));
  }

  function viewUserProfile(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    document.getElementById('modal-title').textContent = u.name;
    document.getElementById('modal-preview').innerHTML = u.photo ? `<img src="${u.photo}">` : `<div style="padding:30px; text-align:center; font-size:40px;">${initials(u.name)}</div>`;
    document.getElementById('modal-owner').textContent = 'Phone: ' + u.phone + '  •  ERP: ' + u.erp;
    document.getElementById('modal-status').textContent = (u.blocked ? 'Blocked' : 'Active') + '  •  ' + (onlinePhones.has(u.phone) ? 'Online now' : 'Offline');
    const dl = document.getElementById('modal-download');
    dl.style.display = 'none';
    document.getElementById('file-modal').classList.add('show');
  }

function toggleBlock(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    u.blocked = !u.blocked;
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(u);
    renderUsersList();
  }

  // Admin approves a pending registration request — this was previously
  // missing entirely, which is why the "Approve" button did nothing.
  function approveUser(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    u.approved = true;
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(u);
    pushUserNotification(phone,
      'Aapki registration request Admin ne approve kar di hai — ab aap login kar saktay hain!',
      'Your registration request has been approved by the Admin — you can now log in!');
    renderUsersList();
    renderModeratorRequests();
    const statEl = document.getElementById('stat-total');
    if(statEl) statEl.textContent = users.length;
  }

  // Admin rejects (deletes) a pending registration request — also missing.
  function rejectUser(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    const label = currentLang==='ur'
      ? ('Pakka "' + u.name + '" ki registration request reject kar dain? Ye account hamesha ke liye remove ho jayega.')
      : ('Really reject "' + u.name + '"\'s registration request? This account will be permanently removed.');
    if(!confirm(label)) return;
    users = users.filter(x => x.phone !== phone);
    delete chatThreads[phone];
    saveState();
    if(window.fbDeleteUser) window.fbDeleteUser(phone);
    renderUsersList();
    renderModeratorRequests();
    renderThreadList();
    const statEl = document.getElementById('stat-total');
    if(statEl) statEl.textContent = users.length;
    const listCountEl = document.getElementById('list-count');
    if(listCountEl) listCountEl.textContent = users.length + ' ' + (currentLang==='ur' ? 'records' : 'records');
  }

  // =================================================================
  // NOTIFICATIONS
  //  - broadcastNotifications: site-wide (new publish, new link, announcement)
  //  - per-user u.notifications: personal (e.g. "your account was approved")
  //  - adminNotifications: admin-only feed (new registration, new messages)
  // =================================================================
  function pushBroadcastNotification(textUr, textEn){
    broadcastNotifications.unshift({ id: Date.now() + Math.random(), textUr, textEn, time: new Date().toLocaleString(), ts: Date.now() });
    broadcastNotifications = broadcastNotifications.slice(0, 30);
    saveState();
    if(window.fbSaveMeta) window.fbSaveMeta();
    renderNotifBell();
  }

  function pushUserNotification(phone, textUr, textEn){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    u.notifications = u.notifications || [];
    u.notifications.unshift({ id: Date.now() + Math.random(), textUr, textEn, time: new Date().toLocaleString(), ts: Date.now(), read:false });
    u.notifications = u.notifications.slice(0, 30);
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(u);
    if(currentRole === 'user' && currentUser && currentUser.phone === phone) renderNotifBell();
  }

  function pushAdminNotification(textUr, textEn){
    adminNotifications.unshift({ id: Date.now() + Math.random(), textUr, textEn, time: new Date().toLocaleString(), ts: Date.now(), read:false });
    adminNotifications = adminNotifications.slice(0, 30);
    saveState();
    if(currentRole === 'admin') renderNotifBell();
  }

  // =================================================================
  // EMAIL NOTIFICATIONS (EmailJS) — sends a real email to
  // anas92642@gmail.com whenever a new user joins/registers, or when
  // someone uploads a premium payment screenshot. Uses the admin's own
  // free EmailJS account (Service ID / Template ID / Public Key saved
  // in Settings → Email Notifications), same pattern as the Gemini key.
  // Silently does nothing if not configured yet.
  // =================================================================
  const ADMIN_NOTIFY_EMAIL = 'anas92642@gmail.com';

  function getEmailJsConfig(){
    return {
      serviceId: localStorage.getItem('atw_emailjs_service') || '',
      templateId: localStorage.getItem('atw_emailjs_template') || '',
      publicKey: localStorage.getItem('atw_emailjs_publickey') || ''
    };
  }

  function initEmailJs(){
    const cfg = getEmailJsConfig();
    const statusEl = document.getElementById('emailjs-status');
    const svcEl = document.getElementById('emailjs-service-input');
    const tplEl = document.getElementById('emailjs-template-input');
    const keyEl = document.getElementById('emailjs-publickey-input');
    if(svcEl) svcEl.value = cfg.serviceId;
    if(tplEl) tplEl.value = cfg.templateId;
    if(keyEl) keyEl.value = cfg.publicKey;
    if(cfg.serviceId && cfg.templateId && cfg.publicKey){
      try{ if(window.emailjs) window.emailjs.init({ publicKey: cfg.publicKey }); }catch(e){ /* ignore */ }
      if(statusEl) statusEl.textContent = currentLang==='ur' ? '✅ Email notifications ON hain.' : '✅ Email notifications are ON.';
    } else if(statusEl){
      statusEl.textContent = currentLang==='ur' ? 'Abhi connect nahi — email notifications OFF hain.' : 'Not connected — email notifications OFF.';
    }
  }

  function saveEmailJsConfig(){
    const svc = (document.getElementById('emailjs-service-input').value || '').trim();
    const tpl = (document.getElementById('emailjs-template-input').value || '').trim();
    const key = (document.getElementById('emailjs-publickey-input').value || '').trim();
    localStorage.setItem('atw_emailjs_service', svc);
    localStorage.setItem('atw_emailjs_template', tpl);
    localStorage.setItem('atw_emailjs_publickey', key);
    initEmailJs();
  }

  // Fires an email via EmailJS. `params` should include at minimum
  // to_email, subject, message (map these to your EmailJS template's
  // variables). Never throws — this must never break the site if the
  // key is missing/wrong or the network fails.
  function sendEmailNotification(subject, message){
    const cfg = getEmailJsConfig();
    if(!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !window.emailjs) return;
    try{
      window.emailjs.send(cfg.serviceId, cfg.templateId, {
        to_email: ADMIN_NOTIFY_EMAIL,
        subject: subject,
        message: message,
        site_name: 'Anas Technical World'
      }).catch(function(err){ console.warn('EmailJS send failed', err); });
    }catch(e){ console.warn('EmailJS send failed', e); }
  }

  function sendTestEmailNotification(){
    const statusEl = document.getElementById('emailjs-status');
    const cfg = getEmailJsConfig();
    if(!cfg.serviceId || !cfg.templateId || !cfg.publicKey){
      if(statusEl) statusEl.textContent = currentLang==='ur' ? 'Pehle Service ID, Template ID aur Public Key save karain.' : 'Please save Service ID, Template ID and Public Key first.';
      return;
    }
    sendEmailNotification('Test Notification — Anas Technical World', 'Ye ek test email hai. Agar aapko ye mil gayi hai to email notifications sahi kaam kar rahi hain.');
    if(statusEl) statusEl.textContent = currentLang==='ur' ? '📧 Test email bhej di gayi — apna inbox check karain.' : '📧 Test email sent — check your inbox.';
  }


  function combinedNotifList(){
    if(currentRole === 'admin'){
      return adminNotifications.slice();
    }
    if(currentRole === 'user' && currentUser){
      const u = users.find(x => x.phone === currentUser.phone) || currentUser;
      const personal = (u.notifications || []).map(n => Object.assign({}, n, { personal:true }));
      const seenAt = u.lastSeenBroadcastAt || 0;
      const bcast = broadcastNotifications.map(n => Object.assign({}, n, { personal:false, read: n.ts <= seenAt }));
      return personal.concat(bcast).sort((a,b) => b.ts - a.ts);
    }
    return [];
  }

  function unreadNotifCount(){
    return combinedNotifList().filter(n => !n.read).length;
  }

  function renderNotifBell(){
    const badge = document.getElementById('notif-badge');
    const count = unreadNotifCount();
    if(badge){
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    const list = document.getElementById('notif-list');
    if(!list) return;
    const items = combinedNotifList();
    if(items.length === 0){
      list.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak koi notification nahi.' : 'No notifications yet.'}</div>`;
      return;
    }
    list.innerHTML = items.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-text">${escapeHtml(currentLang==='ur' ? n.textUr : n.textEn)}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    `).join('');
  }

  function toggleNotifPanel(){
    const panel = document.getElementById('notif-panel');
    if(!panel) return;
    const opening = !panel.classList.contains('show');
    panel.classList.toggle('show');
    if(opening){
      if(currentRole === 'admin'){
        adminNotifications.forEach(n => n.read = true);
        saveState();
      } else if(currentRole === 'user' && currentUser){
        const u = users.find(x => x.phone === currentUser.phone);
        if(u){
          (u.notifications || []).forEach(n => n.read = true);
          u.lastSeenBroadcastAt = Date.now();
          saveState();
          if(window.fbSaveUser) window.fbSaveUser(u);
        }
      }
      renderNotifBell();
    }
  }

  document.addEventListener('click', function(e){
    const panel = document.getElementById('notif-panel');
    const bell = document.getElementById('notif-bell-btn');
    if(!panel || !panel.classList.contains('show')) return;
    if(panel.contains(e.target) || (bell && bell.contains(e.target))) return;
    panel.classList.remove('show');
  });

  // =================================================================
  // BROWSER (OS-level) NOTIFICATIONS — mainly for Admin, so new
  // registration requests / user messages can be noticed even if the
  // Admin isn't actively looking at the tab.
  // =================================================================
  function isBrowserNotifEnabled(){
    return localStorage.getItem('atw_browser_notif') === '1' && ('Notification' in window) && Notification.permission === 'granted';
  }

  function fireBrowserNotification(title, body){
    if(!isBrowserNotifEnabled()) return;
    try{ new Notification(title, { body, icon: 'assets/hero-arms-crossed.png' }); }catch(e){ /* ignore */ }
  }

  function toggleBrowserNotifications(){
    const el = document.getElementById('browser-notif-toggle');
    const statusEl = document.getElementById('browser-notif-status');
    if(!el) return;
    if(el.checked){
      if(!('Notification' in window)){
        if(statusEl) statusEl.textContent = currentLang==='ur' ? 'Ye browser notifications support nahi karta.' : 'This browser does not support notifications.';
        el.checked = false;
        return;
      }
      Notification.requestPermission().then(function(perm){
        if(perm === 'granted'){
          localStorage.setItem('atw_browser_notif', '1');
          if(statusEl) statusEl.textContent = currentLang==='ur' ? '✅ Browser notifications ON hain.' : '✅ Browser notifications are ON.';
        } else {
          localStorage.setItem('atw_browser_notif', '0');
          el.checked = false;
          if(statusEl) statusEl.textContent = currentLang==='ur' ? 'Permission nahi mili — browser settings mein site ko allow karain.' : 'Permission denied — allow notifications for this site in your browser settings.';
        }
      });
    } else {
      localStorage.setItem('atw_browser_notif', '0');
      if(statusEl) statusEl.textContent = currentLang==='ur' ? 'Browser notifications OFF hain.' : 'Browser notifications are OFF.';
    }
  }

  // Admin can see the password any user set at registration
  function viewUserPassword(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    alert(currentLang==='ur'
      ? ('User: ' + u.name + '\nPhone: ' + u.phone + '\nPassword: "' + u.password + '"')
      : ('User: ' + u.name + '\nPhone: ' + u.phone + '\nPassword: "' + u.password + '"'));
  }

  // Admin can delete any user account
  function deleteUser(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    if(!confirm(currentLang==='ur'
      ? ('Pakka delete karain "' + u.name + '" ko? Ye hamesha ke liye remove ho jayega.')
      : ('Really delete "' + u.name + '"? This cannot be undone.'))) return;
    users = users.filter(x => x.phone !== phone);
    delete chatThreads[phone];
    saveState();
    if(window.fbDeleteUser) window.fbDeleteUser(phone);
    renderUsersList();
    renderThreadList();
    document.getElementById('stat-total').textContent = users.length;
    document.getElementById('list-count').textContent = users.length + ' ' + (currentLang==='ur' ? 'records' : 'records');
  }

  // =================================================================
  // UPLOADS — ADMIN ONLY. Users can only view + download published files.
  // =================================================================
  // Cloud sync (Firestore) rejects any document over ~1MB — this is the
  // real reason uploads used to "look" successful in the admin panel but
  // then vanish / never actually appear as published for users on other
  // devices. Images get auto-compressed below; other file types get a
  // clear upfront size check instead of a silent failure later.
  const MAX_NON_IMAGE_UPLOAD_BYTES = 700 * 1024;

  // Shared brand watermark shown on every auto-generated icon (AI logo
  // or the plain letter-tile fallback) so "Anas Technical World" stays
  // visible on the icon itself, regardless of what name was given.
  function brandMarkHTML(){
    return `<span class="brand-mark">ATW</span>`;
  }

  // Turns any plain URL typed inside a name/description field into a
  // real clickable link. Escapes everything first (so no HTML/script
  // injection), then re-linkifies the URL-looking parts only.
  function linkifyText(str){
    const escaped = escapeHtml(str || '');
    return escaped.replace(/((https?:\/\/|www\.)[^\s<]+)/gi, function(match){
      let href = match;
      if(!/^https?:\/\//i.test(href)) href = 'https://' + href;
      return `<a href="${href}" target="_blank" rel="noopener">${match}</a>`;
    });
  }

  // Optional custom icon picture attached to an upload/link before it's
  // submitted. Stashed directly on the <input type=file> element (same
  // pattern as previewProfilePhoto) so the submit function can read it.
  function previewCustomLogo(e, statusElId){
    const file = e.target.files[0];
    if(!file) return;
    compressImageFile(file, 300, 0.85).then(function(dataUrl){
      e.target._customLogo = dataUrl;
      const statusEl = statusElId ? document.getElementById(statusElId) : null;
      if(statusEl) statusEl.textContent = currentLang==='ur' ? '✓ Picture select ho gayi.' : '✓ Picture selected.';
    });
  }

  function clearCustomLogo(inputId, statusElId){
    const input = document.getElementById(inputId);
    if(input){ input.value = ''; input._customLogo = null; }
    const statusEl = statusElId ? document.getElementById(statusElId) : null;
    if(statusEl) statusEl.textContent = '';
  }

  // If nobody attached a picture, ask Gemini (using the admin's saved
  // key — the same one used for the AI link description) to generate a
  // simple branded icon from the item's name. Optional and best-effort:
  // with no key saved, or if the request fails, the auto letter-tile
  // icon (which already carries the "ATW" watermark) is left as-is.
  function generateAILogoForItem(item, kind){
    const key = localStorage.getItem('atw_gemini_key') || '';
    if(!key) return;
    const prompt = 'Design a simple, modern, flat, square app-icon logo for something named "' + item.name +
      '". Bold single accent colour, minimal shapes, no photorealism, no readable text except a tiny "Anas Technical World" watermark tucked in a corner.';
    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })
    .then(r => r.json())
    .then(data => {
      const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      const imgPart = parts && parts.find(p => p.inlineData && p.inlineData.data);
      if(!imgPart) return;
      const dataUrl = 'data:' + (imgPart.inlineData.mimeType || 'image/png') + ';base64,' + imgPart.inlineData.data;
      const list = kind === 'upload' ? uploads : links;
      const target = list.find(x => x.id === item.id);
      if(!target) return;
      target.logo = dataUrl;
      saveState();
      if(kind === 'upload' && window.fbSaveUpload) window.fbSaveUpload(target);
      if(kind === 'link' && window.fbSaveLink) window.fbSaveLink(target);
      renderAdminUploads(); renderCommunityUploads();
      renderAdminLinks(); renderUserLinks();
      renderModSubmissionsForAdmin();
      renderModOwnSubmissions();
    })
    .catch(() => { /* AI logo is optional — the ATW-branded letter-tile stays as the icon */ });
  }

  function finishAdminUpload(displayName, fileType, dataUrl, downloadName, extra){
    extra = extra || {};
    const item = {
      id: uploadIdCounter++,
      fileName: displayName,
      downloadName: downloadName || displayName,
      fileType: fileType,
      dataUrl: dataUrl,
      description: extra.description || '',
      logo: extra.logo || null,
      uploadedBy: extra.uploadedBy || 'admin',
      submittedByPhone: extra.submittedByPhone || null,
      submittedByName: extra.submittedByName || null,
      status: extra.status || 'pending',
      premium: !!extra.premium,
      price: extra.premium ? (Number(extra.price) > 0 ? Number(extra.price) : PREMIUM_FEE) : null,
      uploadedAt: new Date().toLocaleString()
    };
    uploads.push(item);
    saveState();
    if(window.fbSaveUpload) window.fbSaveUpload(item);
    // If it isn't already an image file and nobody attached a custom
    // picture, try to auto-generate a branded logo for it.
    if(!item.logo && !(fileType && fileType.startsWith('image/'))){
      generateAILogoForItem(item, 'upload');
    }
    renderAdminUploads();
    renderCommunityUploads();
    if(item.uploadedBy === 'moderator'){
      pushAdminNotification(
        'Moderator "' + (item.submittedByName||'') + '" ne ek nayi file bheji hai approval ke liye: "' + item.fileName + '"',
        'Moderator "' + (item.submittedByName||'') + '" submitted a new file for approval: "' + item.fileName + '"'
      );
    }
    renderModSubmissionsForAdmin();
    renderModOwnSubmissions();
  }

  // Admin must type a name/meaning for the upload FIRST (in
  // #admin-upload-name-input) — that name is what shows under the
  // app-icon tile everywhere on the site. The original file name is
  // kept only for the download link, so the file still opens correctly.
  function handleAdminUpload(e){
    submitUploadFromInputs(e, {
      nameId: 'admin-upload-name-input',
      descId: 'admin-upload-desc-input',
      picId: 'admin-upload-pic-input',
      picStatusId: 'admin-upload-pic-status',
      premiumId: 'admin-upload-premium-input',
      priceId: 'admin-upload-price-input',
      uploadedBy: 'admin'
    });
  }

  // Moderator's own upload — identical flow, but always lands in
  // "awaiting_approval" so it only appears on the site once Admin
  // reviews and approves it.
  function handleModeratorUpload(e){
    submitUploadFromInputs(e, {
      nameId: 'mod-upload-name-input',
      descId: 'mod-upload-desc-input',
      picId: 'mod-upload-pic-input',
      picStatusId: 'mod-upload-pic-status',
      premiumId: 'mod-upload-premium-input',
      priceId: 'mod-upload-price-input',
      uploadedBy: 'moderator'
    });
  }

  function submitUploadFromInputs(e, cfg){
    const nameInput = document.getElementById(cfg.nameId);
    const descInput = document.getElementById(cfg.descId);
    const picInput = document.getElementById(cfg.picId);
    const premiumInput = cfg.premiumId ? document.getElementById(cfg.premiumId) : null;
    const priceInput = cfg.priceId ? document.getElementById(cfg.priceId) : null;
    const displayName = nameInput ? nameInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';
    const customLogo = picInput ? picInput._customLogo : null;
    const isPremium = premiumInput ? !!premiumInput.checked : false;
    const price = priceInput ? Number(priceInput.value) : PREMIUM_FEE;
    const file = e.target.files[0];
    if(!file) return;
    e.target.value = '';

    if(!displayName){
      alert(currentLang==='ur'
        ? 'Pehle upload ka naam / matlab likhain (upar wale box mein), phir file select karain.'
        : 'Please type a name for this upload (in the box above) before choosing the file.');
      return;
    }

    const isModerator = cfg.uploadedBy === 'moderator';
    const extra = {
      description: description,
      logo: customLogo || null,
      uploadedBy: cfg.uploadedBy,
      submittedByPhone: isModerator && currentUser ? currentUser.phone : null,
      submittedByName: isModerator && currentUser ? currentUser.name : null,
      status: isModerator ? 'awaiting_approval' : 'pending',
      premium: isPremium,
      price: price
    };

    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
    const downloadName = displayName.replace(/\.[a-zA-Z0-9]+$/, '') + ext;

    function reset(){
      if(nameInput) nameInput.value = '';
      if(descInput) descInput.value = '';
      if(premiumInput) premiumInput.checked = false;
      if(priceInput) priceInput.value = 100;
      clearCustomLogo(cfg.picId, cfg.picStatusId);
    }

    if(file.type && file.type.startsWith('image/')){
      compressImageFile(file, 1400, 0.75).then(function(dataUrl){
        finishAdminUpload(displayName, file.type, dataUrl, downloadName, extra);
        reset();
      });
      return;
    }

    if(file.size > MAX_NON_IMAGE_UPLOAD_BYTES){
      alert(currentLang==='ur'
        ? ('Ye file bohat bari hai (' + Math.round(file.size/1024) + ' KB). Cloud sync ke liye files 700 KB se chotay honi chahiyain, warna upload cloud par save nahi hogi. Chota version upload karain ya "Admin Links" mein iska link add karain.')
        : ('This file is too large (' + Math.round(file.size/1024) + ' KB). Files must be under 700 KB to sync to the cloud, otherwise the upload will silently fail to save. Please upload a smaller version, or add a link to it under "Admin Links" instead.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = function(ev){
      finishAdminUpload(displayName, file.type, ev.target.result, downloadName, extra);
      reset();
    };
    reader.readAsDataURL(file);
  }

  // Admin edits a name/description already uploaded (either their own,
  // or a moderator's submission after it's been approved).
  function editUpload(id){
    const u = uploads.find(x => x.id === id);
    if(!u) return;
    const newName = prompt(currentLang==='ur' ? 'Naya naam:' : 'New name:', u.fileName);
    if(newName === null) return;
    const newDesc = prompt(currentLang==='ur' ? 'Nayi description (khali chor saktay hain):' : 'New description (can be left blank):', u.description || '');
    if(newDesc === null) return;
    u.fileName = newName.trim() || u.fileName;
    u.description = newDesc.trim();
    saveState();
    if(window.fbSaveUpload) window.fbSaveUpload(u);
    renderAdminUploads();
    renderCommunityUploads();
    renderModOwnSubmissions();
  }

  function statusBadge(status){
    if(status === 'published') return `<span class="badge-status badge-published">Published</span>`;
    if(status === 'unpublished') return `<span class="badge-status badge-unpublished">Unpublished</span>`;
    if(status === 'awaiting_approval') return `<span class="badge-status badge-awaiting">Awaiting Approval</span>`;
    return `<span class="badge-status badge-pending">Pending</span>`;
  }

  function uploadThumb(u){
    if(u.fileType && u.fileType.startsWith('image/')){
      return `<img src="${u.dataUrl}">`;
    }
    return escapeHtml(u.fileName);
  }

  // Renders every upload as an "app icon" tile (rounded icon + name
  // underneath, like a phone home-screen), the same visual language as
  // the link tiles below. A custom/AI logo (u.logo) always wins; then a
  // real image file; then the branded letter-tile fallback.
  function uploadIconHTML(u){
    const lock = u.premium ? `<span class="lock-corner" title="Premium">🔒</span>` : '';
    if(u.logo){
      return `<div class="app-icon">${lock}<img src="${u.logo}">${brandMarkHTML()}</div>`;
    }
    if(u.fileType && u.fileType.startsWith('image/')){
      return `<div class="app-icon">${lock}<img src="${u.dataUrl}"></div>`;
    }
    const letter = (u.fileName || '?').trim().charAt(0).toUpperCase() || '?';
    const seed = String(u.fileName || '');
    const color = '#' + Array.from(seed).reduce((acc,ch)=>(acc*31 + ch.charCodeAt(0))%16777215, 7).toString(16).padStart(6,'0');
    return `<div class="app-icon" style="background:linear-gradient(140deg, ${color}, ${color}88);">${lock}<span class="app-icon-fallback">${escapeHtml(letter)}</span>${brandMarkHTML()}</div>`;
  }

  // Small "🔒 Premium" caption shown under a premium item's name/tile,
  // so it's clear at a glance that it needs Admin's approval to open.
  function premiumTagHTML(item){
    if(!item.premium) return '';
    const priceTxt = item.price ? (' — Rs ' + item.price) : '';
    return `<div class="premium-tag">🔒 ${currentLang==='ur' ? 'پریمیم' : 'Premium'}${priceTxt}</div>`;
  }

  // Auto-generate an icon for a link: a custom/AI logo (link.logo) wins
  // first, then the site's favicon, then the branded letter-tile.
  function linkIconHTML(link){
    const lock = link.premium ? `<span class="lock-corner" title="Premium">🔒</span>` : '';
    if(link.logo){
      return `<div class="link-icon">${lock}<img src="${link.logo}" style="width:100%;height:100%;object-fit:cover;">${brandMarkHTML()}</div>`;
    }
    let host = '';
    try{ host = new URL(link.url).hostname; }catch(e){ host = link.url; }
    const letter = (link.name || '?').trim().charAt(0).toUpperCase() || '?';
    const color = '#' + Array.from(link.name).reduce((acc,ch)=>(acc*31 + ch.charCodeAt(0))%16777215, 7).toString(16).padStart(6,'0');
    return `
      <div class="link-icon" style="background:linear-gradient(140deg, ${color}, ${color}88);">
        ${lock}
        <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <span class="link-icon-fallback" style="display:none;">${escapeHtml(letter)}</span>
        ${brandMarkHTML()}
      </div>`;
  }

  // -----------------------------------------------------------------
  // UNIFIED CONTENT — uploads and links used to render as two separately
  // labelled sections ("Admin Updates" / "Admin Links"). They now render
  // together as ONE combined feed of icon tiles, in the order Admin
  // added them — no "this is a file" / "this is a link" grouping.
  // -----------------------------------------------------------------
  function buildAdminContentList(){
    const up = uploads.filter(u => u.status !== 'awaiting_approval').map(u => Object.assign({ _kind:'upload' }, u));
    const lk = links.filter(l => l.status !== 'awaiting_approval').map(l => Object.assign({ _kind:'link' }, l));
    return up.concat(lk);
  }
  function buildPublicContentList(){
    const up = uploads.filter(u => u.status === 'published').map(u => Object.assign({ _kind:'upload' }, u));
    const lk = links.filter(l => l.status !== 'awaiting_approval').map(l => Object.assign({ _kind:'link' }, l));
    return up.concat(lk);
  }

  function adminContentTileHTML(item, i){
    if(item._kind === 'upload'){
      return `
      <div class="app-tile" style="animation-delay:${i*0.05}s">
        <div class="app-icon-wrap" onclick="openFilePreview(${item.id})">${uploadIconHTML(item)}</div>
        <div class="app-tile-name">${escapeHtml(item.fileName)}</div>
        ${item.description ? `<div class="link-desc">${linkifyText(item.description)}</div>` : ''}
        ${premiumTagHTML(item)}
        ${statusBadge(item.status)}
        ${item.uploadedBy === 'moderator' ? `<div class="badge-status badge-awaiting" style="margin-top:2px;">🛡 ${escapeHtml(item.submittedByName||'Moderator')}</div>` : ''}
        <div class="app-tile-actions">
          ${item.status !== 'published' ? `<button class="btn-outline-green" onclick="setUploadStatus(${item.id}, 'published')">Publish</button>` : ''}
          ${item.status === 'published' ? `<button class="btn-outline-amber" onclick="setUploadStatus(${item.id}, 'unpublished')">Unpublish</button>` : ''}
          <button class="btn-outline-amber" onclick="togglePremium('upload', ${item.id})">${item.premium ? '🔓' : '🔒'} Premium</button>
          ${item.premium ? `<button class="btn-outline-amber" onclick="editPremiumPrice('upload', ${item.id})">💰 Rs ${item.price||PREMIUM_FEE}</button>` : ''}
          <button class="btn-outline-amber" onclick="editUpload(${item.id})">Edit</button>
          <button class="btn-outline-danger" onclick="deleteUpload(${item.id})">Delete</button>
        </div>
      </div>`;
    }
    return `
      <div class="link-card" style="animation-delay:${i*0.05}s">
        ${linkIconHTML(item)}
        <div class="link-name">${escapeHtml(item.name)}</div>
        <div class="link-url">${escapeHtml(item.url)}</div>
        ${item.description ? `<div class="link-desc">${linkifyText(item.description)}</div>` : ''}
        ${premiumTagHTML(item)}
        ${item.uploadedBy === 'moderator' ? `<div class="badge-status badge-awaiting">🛡 ${escapeHtml(item.submittedByName||'Moderator')}</div>` : ''}
        <div class="app-tile-actions">
          <a class="btn-outline-green" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open</a>
          <button class="btn-outline-amber" onclick="togglePremium('link', ${item.id})">${item.premium ? '🔓' : '🔒'} Premium</button>
          ${item.premium ? `<button class="btn-outline-amber" onclick="editPremiumPrice('link', ${item.id})">💰 Rs ${item.price||PREMIUM_FEE}</button>` : ''}
          <button class="btn-outline-amber" onclick="editLink(${item.id})">Edit</button>
          <button class="btn-outline-danger" onclick="deleteLink(${item.id})">Delete</button>
        </div>
      </div>`;
  }

  // Admin's own management list — one combined grid for uploads + links
  // (excludes moderator submissions still awaiting approval — those
  // live in the separate approval section).
  function renderAdminContent(){
    const all = buildAdminContentList();
    const countEl = document.getElementById('content-count-label');
    if(countEl) countEl.textContent = all.length + ' records';
    const area = document.getElementById('admin-content-area');
    if(area){
      if(all.length === 0){
        area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak koi content nahi hai.' : 'No content yet.'}</div>`;
      } else {
        area.innerHTML = `<div class="app-tile-grid">` + all.map((item,i) => adminContentTileHTML(item,i)).join('') + `</div>`;
      }
    }
    const su = document.getElementById('stat-uploads');
    if(su) su.textContent = uploads.filter(u => u.status !== 'awaiting_approval').length;
  }
  // Kept as separate names because firebase-sync.js and several call
  // sites in this file call them individually — both now just draw the
  // same combined grid.
  function renderAdminUploads(){ renderAdminContent(); }
  function renderAdminLinks(){ renderAdminContent(); }

  // Writes the combined published-content feed (files + links, all in
  // one place, in upload order) into every screen that shows it (User's
  // "Admin Content" AND Moderator's mirrored version). Premium items
  // carry a small 🔒 lock — tapping one that isn't unlocked yet opens
  // the payment/approval flow instead of the item itself.
  function renderUnifiedUserContent(){
    const all = buildPublicContentList();
    [
      { countEl:'community-count', areaEl:'community-area' },
      { countEl:'mod-community-count', areaEl:'mod-community-area' }
    ].forEach(function(t){
      const area = document.getElementById(t.areaEl);
      if(!area) return;
      const countEl = document.getElementById(t.countEl);
      if(countEl) countEl.textContent = all.length + (currentLang==='ur' ? ' items' : ' items');
      if(all.length === 0){
        area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak Admin ne kuch publish nahi kiya.' : 'Admin has not published anything yet.'}</div>`;
        return;
      }
      area.innerHTML = `<div class="app-tile-grid">` + all.map((item,i) => {
        if(item._kind === 'upload'){
          return `
          <div class="app-tile" style="animation-delay:${i*0.08}s">
            <div class="app-icon-wrap" onclick="handleContentClick('upload', ${item.id})">${uploadIconHTML(item)}</div>
            <div class="app-tile-name" onclick="handleContentClick('upload', ${item.id})">${escapeHtml(item.fileName)}</div>
            ${premiumTagHTML(item)}
          </div>`;
        }
        return `
          <div class="link-card">
            <div class="link-main" style="cursor:pointer;" onclick="handleContentClick('link', ${item.id})">
              ${linkIconHTML(item)}
              <div class="link-name">${escapeHtml(item.name)}</div>
              ${premiumTagHTML(item)}
            </div>
          </div>`;
      }).join('') + `</div>`;
    });
  }
  // Kept as separate names for the same reason as renderAdminUploads /
  // renderAdminLinks above (firebase-sync.js + existing call sites).
  function renderCommunityUploads(){ renderUnifiedUserContent(); }
  function renderUserLinks(){ renderUnifiedUserContent(); }

  // Admin flips an item's premium flag on/off directly from its tile.
  function togglePremium(kind, id){
    const list = kind === 'upload' ? uploads : links;
    const item = list.find(x => x.id === id);
    if(!item) return;
    item.premium = !item.premium;
    if(item.premium){
      const entered = prompt(currentLang==='ur' ? 'Is item ki price (Rs) likhain:' : 'Enter the price (Rs) for this item:', item.price || PREMIUM_FEE);
      const n = Number(entered);
      item.price = (entered !== null && n > 0) ? n : (item.price || PREMIUM_FEE);
    } else {
      item.price = null;
    }
    saveState();
    if(kind === 'upload' && window.fbSaveUpload) window.fbSaveUpload(item);
    if(kind === 'link' && window.fbSaveLink) window.fbSaveLink(item);
    renderAdminContent();
    renderUnifiedUserContent();
  }

  // Admin can change a premium item's price anytime.
  function editPremiumPrice(kind, id){
    const list = kind === 'upload' ? uploads : links;
    const item = list.find(x => x.id === id);
    if(!item || !item.premium) return;
    const entered = prompt(currentLang==='ur' ? 'Nayi price (Rs) likhain:' : 'Enter new price (Rs):', item.price || PREMIUM_FEE);
    const n = Number(entered);
    if(entered === null || !(n > 0)) return;
    item.price = n;
    saveState();
    if(kind === 'upload' && window.fbSaveUpload) window.fbSaveUpload(item);
    if(kind === 'link' && window.fbSaveLink) window.fbSaveLink(item);
    renderAdminContent();
    renderUnifiedUserContent();
  }

  // -----------------------------------------------------------------
  // PREMIUM UNLOCK FLOW — tapping a locked item (as a normal user or
  // moderator; Admin always bypasses the lock) opens a payment modal
  // with the JazzCash number + fee, a screenshot-upload button, and
  // shows the live status of that user's request for that exact item.
  // -----------------------------------------------------------------
  let premiumModalTarget = null; // { kind:'upload'|'link', id }
  let premiumScreenshotData = null;

  function handleContentClick(kind, id){
    const item = kind === 'upload' ? uploads.find(x => x.id === id) : links.find(x => x.id === id);
    if(!item) return;
    if(!item.premium || currentRole === 'admin' || hasPremiumApproved(kind, id)){
      openContentDetailModal(kind, id);
      return;
    }
    openPremiumModal(kind, id);
  }

  // -----------------------------------------------------------------
  // CONTENT DETAIL MODAL — the list/grid only ever shows an item's
  // NAME. Tapping it opens this small modal which reveals the
  // description (if Admin wrote one) plus an "Open" button that does
  // the actual navigation/file-preview. Items with no description just
  // show the name + Open button.
  // -----------------------------------------------------------------
  function openContentDetailModal(kind, id){
    const item = kind === 'upload' ? uploads.find(x => x.id === id) : links.find(x => x.id === id);
    if(!item) return;
    const nameEl = document.getElementById('content-detail-name');
    const descEl = document.getElementById('content-detail-desc');
    const openBtn = document.getElementById('content-detail-open-btn');
    if(nameEl) nameEl.textContent = kind === 'upload' ? item.fileName : item.name;
    if(descEl){
      descEl.innerHTML = item.description
        ? linkifyText(item.description)
        : `<span class="empty-note" style="padding:0;">${currentLang==='ur' ? 'Koi description nahi.' : 'No description added.'}</span>`;
    }
    if(openBtn){
      openBtn.onclick = function(){
        closeContentDetailModal();
        if(kind === 'upload') openFilePreview(id);
        else window.open(item.url, '_blank', 'noopener');
      };
    }
    const modal = document.getElementById('content-detail-modal');
    if(modal) modal.classList.add('show');
  }

  function closeContentDetailModal(){
    const modal = document.getElementById('content-detail-modal');
    if(modal) modal.classList.remove('show');
  }

  function hasPremiumApproved(kind, id){
    if(!currentUser) return false;
    return premiumRequests.some(r => r.itemKind === kind && r.itemId === id && r.userPhone === currentUser.phone && r.status === 'approved');
  }

  function getLatestPremiumRequest(kind, id){
    if(!currentUser) return null;
    const mine = premiumRequests.filter(r => r.itemKind === kind && r.itemId === id && r.userPhone === currentUser.phone);
    return mine.length ? mine[mine.length - 1] : null;
  }

  function premiumInstructionsHTML(existing, item){
    const paymentCfg = getPaymentConfig();
    const fee = (item && item.price) ? item.price : paymentCfg.fee;
    const rejectedNote = existing && existing.status === 'rejected'
      ? (currentLang==='ur'
          ? `<p style="color:var(--danger); margin-bottom:8px;">Aap ki pichli request reject ho gayi thi — sahi screenshot ke sath dobara try karain.</p>`
          : `<p style="color:var(--danger); margin-bottom:8px;">Your previous request was rejected — please try again with the correct screenshot.</p>`)
      : '';
    const descBlock = (item && item.description)
      ? `<div class="content-detail-desc" style="margin-bottom:10px;">${linkifyText(item.description)}</div>`
      : '';
    return `
      ${descBlock}
      ${rejectedNote}
      <p>${currentLang==='ur'
        ? 'Ye chez premium hai, iski fee <b>Rs ' + fee + '</b> hai.'
        : 'This item is premium — the fee is <b>Rs ' + fee + '</b>.'}</p>
      <div class="jazzcash-box">
        <div>${paymentCfg.method}: <b>${paymentCfg.number}</b></div>
        <div>${currentLang==='ur' ? 'Naam' : 'Name'}: <b>${paymentCfg.name}</b></div>
      </div>
      <p>${currentLang==='ur'
        ? 'Rs ' + fee + ' is number par bhejne ke baad, neeche apna payment screenshot upload karain.'
        : 'After sending Rs ' + fee + ' to this number, upload your payment screenshot below.'}</p>
    `;
  }

  function openPremiumModal(kind, id){
    const item = kind === 'upload' ? uploads.find(x => x.id === id) : links.find(x => x.id === id);
    if(!item || !currentUser) return;
    premiumModalTarget = { kind, id };
    premiumScreenshotData = null;
    const nameEl = document.getElementById('premium-modal-item-name');
    if(nameEl) nameEl.textContent = kind === 'upload' ? item.fileName : item.name;
    const shotStatus = document.getElementById('premium-screenshot-status');
    if(shotStatus) shotStatus.textContent = '';
    const shotInput = document.getElementById('premium-screenshot-input');
    if(shotInput) shotInput.value = '';
    const existing = getLatestPremiumRequest(kind, id);
    const bodyEl = document.getElementById('premium-modal-body');
    const formEl = document.getElementById('premium-modal-form');
    const submitBtn = document.getElementById('premium-submit-btn');
    if(existing && existing.status === 'pending'){
      bodyEl.innerHTML = currentLang==='ur'
        ? `<p>Aap ka payment screenshot Admin ko bhej diya gaya hai — manzoori ka intezar karain. Manzoor hotay hi ye khud khul jayega.</p>`
        : `<p>Your payment screenshot has been sent to Admin — waiting for approval. It will open automatically once approved.</p>`;
      if(formEl) formEl.style.display = 'none';
      if(submitBtn) submitBtn.style.display = 'none';
    } else {
      bodyEl.innerHTML = premiumInstructionsHTML(existing, item);
      if(formEl) formEl.style.display = '';
      if(submitBtn) submitBtn.style.display = '';
    }
    document.getElementById('premium-modal').classList.add('show');
  }

  function closePremiumModal(){
    document.getElementById('premium-modal').classList.remove('show');
    premiumModalTarget = null;
  }

  function previewPremiumScreenshot(e){
    const file = e.target.files[0];
    if(!file) return;
    compressImageFile(file, 900, 0.8).then(function(dataUrl){
      premiumScreenshotData = dataUrl;
      const el = document.getElementById('premium-screenshot-status');
      if(el) el.textContent = currentLang==='ur' ? '✓ Screenshot select ho gaya.' : '✓ Screenshot selected.';
    });
  }

  function submitPremiumScreenshot(){
    if(!premiumModalTarget || !currentUser) return;
    if(!premiumScreenshotData){
      alert(currentLang==='ur' ? 'Pehle payment ka screenshot upload karain.' : 'Please upload the payment screenshot first.');
      return;
    }
    const { kind, id } = premiumModalTarget;
    const item = kind === 'upload' ? uploads.find(x => x.id === id) : links.find(x => x.id === id);
    if(!item) return;
    const req = {
      id: premiumReqIdCounter++,
      itemKind: kind,
      itemId: id,
      itemName: kind === 'upload' ? item.fileName : item.name,
      userPhone: currentUser.phone,
      userName: currentUser.name,
      screenshot: premiumScreenshotData,
      status: 'pending',
      requestedAt: new Date().toLocaleString()
    };
    premiumRequests.push(req);
    saveState();
    if(window.fbSavePremiumRequest) window.fbSavePremiumRequest(req);
    pushAdminNotification(
      '"' + req.userName + '" ne "' + req.itemName + '" ke liye premium payment screenshot bheja hai — approval chahiye.',
      '"' + req.userName + '" sent a premium payment screenshot for "' + req.itemName + '" — needs approval.'
    );
    fireBrowserNotification(
      currentLang==='ur' ? 'Nayi Premium Payment Request' : 'New Premium Payment Request',
      req.userName + ' — ' + req.itemName
    );
    sendEmailNotification(
      'Premium payment screenshot received — Anas Technical World',
      'A user uploaded a payment screenshot for a premium item.\n\nUser: ' + req.userName + ' (' + req.userPhone + ')\nItem: ' + req.itemName + '\nFee: Rs ' + (item.price || PREMIUM_FEE) + '\n\nLog in to the Admin dashboard → Premium_Requests.log to view the screenshot and Accept/Reject.'
    );
    renderPremiumRequests();
    closePremiumModal();
    alert(currentLang==='ur' ? 'Screenshot bhej diya gaya — Admin ki approval ka intezar karain.' : 'Screenshot sent — waiting for Admin approval.');
  }

  // Admin's queue of pending premium requests, each with the payment
  // screenshot + Accept/Reject.
  function renderPremiumRequests(){
    const area = document.getElementById('premium-requests-area');
    if(!area) return;
    const pending = premiumRequests.filter(r => r.status === 'pending');
    const countEl = document.getElementById('premium-requests-count-label');
    if(countEl) countEl.textContent = pending.length + ' pending';
    if(pending.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi koi premium request nahi hai.' : 'No premium requests right now.'}</div>`;
      return;
    }
    area.innerHTML = pending.map(r => `
      <div class="moderator-request-row" style="align-items:flex-start;">
        <div class="premium-req-shot" onclick="viewPremiumScreenshot(${r.id})"><img src="${r.screenshot}"></div>
        <div class="info">
          <div class="n">${escapeHtml(r.itemName)} <span class="badge-status badge-awaiting">🔒 Premium</span></div>
          <div class="p">${escapeHtml(r.userName)} · ${escapeHtml(r.userPhone)}</div>
          <div class="e">${escapeHtml(r.requestedAt)}</div>
        </div>
        <div class="actions">
          <button class="btn-outline-green" onclick="approvePremiumRequest(${r.id})">Accept</button>
          <button class="btn-outline-danger" onclick="rejectPremiumRequest(${r.id})">Reject</button>
        </div>
      </div>
    `).join('');
  }

  function viewPremiumScreenshot(id){
    const r = premiumRequests.find(x => x.id === id);
    if(!r) return;
    document.getElementById('modal-title').textContent = (currentLang==='ur' ? 'Payment Screenshot: ' : 'Payment Screenshot: ') + r.itemName;
    document.getElementById('modal-preview').innerHTML = `<img src="${r.screenshot}">`;
    document.getElementById('modal-owner').textContent = r.userName + ' · ' + r.userPhone;
    document.getElementById('modal-status').textContent = 'Status: ' + r.status;
    const dl = document.getElementById('modal-download');
    dl.style.display = 'none';
    document.getElementById('file-modal').classList.add('show');
  }

  function approvePremiumRequest(id){
    const r = premiumRequests.find(x => x.id === id);
    if(!r) return;
    r.status = 'approved';
    saveState();
    if(window.fbSavePremiumRequest) window.fbSavePremiumRequest(r);
    pushUserNotification(r.userPhone,
      '"' + r.itemName + '" ki premium request manzoor ho gayi hai — ab aap ise khol saktay hain.',
      'Your premium request for "' + r.itemName + '" has been approved — you can now open it.'
    );
    renderPremiumRequests();
  }

  function rejectPremiumRequest(id){
    const r = premiumRequests.find(x => x.id === id);
    if(!r) return;
    r.status = 'rejected';
    saveState();
    if(window.fbSavePremiumRequest) window.fbSavePremiumRequest(r);
    pushUserNotification(r.userPhone,
      '"' + r.itemName + '" ki premium request reject ho gayi hai — sahi screenshot ke sath dobara try karain.',
      'Your premium request for "' + r.itemName + '" was rejected — please try again with the correct screenshot.'
    );
    renderPremiumRequests();
  }

  function setUploadStatus(id, status){
    const u = uploads.find(x => x.id === id);
    if(!u) return;
    const wasPublished = u.status === 'published';
    u.status = status;
    saveState();
    if(window.fbSaveUpload) window.fbSaveUpload(u);
    if(status === 'published' && !wasPublished){
      pushBroadcastNotification(
        'Admin ne ek nayi file publish ki hai: "' + u.fileName + '"',
        'Admin published a new file: "' + u.fileName + '"'
      );
    }
    renderAdminUploads();
    renderCommunityUploads();
    renderModOwnSubmissions();
  }

  function deleteUpload(id){
    uploads = uploads.filter(x => x.id !== id);
    saveState();
    if(window.fbDeleteUpload) window.fbDeleteUpload(id);
    renderAdminUploads();
    renderCommunityUploads();
    renderModOwnSubmissions();
  }

  function openFilePreview(id){
    const u = uploads.find(x => x.id === id);
    if(!u) return;
    document.getElementById('modal-title').textContent = u.fileName;
    const prev = document.getElementById('modal-preview');
    prev.innerHTML = (u.fileType && u.fileType.startsWith('image/')) ? `<img src="${u.dataUrl}">` : `<div style="padding:30px; font-family:var(--font-m); color:var(--dim); text-align:center;">${currentLang==='ur' ? 'Preview available nahi — download karain.' : 'Preview not available — please download.'}</div>`;
    document.getElementById('modal-owner').textContent = (currentLang==='ur'?'Admin ki taraf se':'From Admin');
    document.getElementById('modal-status').textContent = 'Status: ' + u.status;
    const dl = document.getElementById('modal-download');
    dl.style.display = '';
    dl.href = u.dataUrl;
    dl.download = u.downloadName || u.fileName;
    document.getElementById('file-modal').classList.add('show');
  }

function closeModal(){
    document.getElementById('file-modal').classList.remove('show');
  }

  // =================================================================
  // LINKS — Admin adds links directly (go live immediately); a
  // Moderator adding a link lands in "awaiting_approval" instead, and
  // only becomes visible once Admin approves it.
  // =================================================================
  function addAdminLink(){
    submitLinkFromInputs({
      nameId: 'link-name-input', urlId: 'link-url-input', descId: 'link-desc-input',
      picId: 'link-pic-input', picStatusId: 'link-pic-status', premiumId: 'link-premium-input', priceId: 'link-price-input', uploadedBy: 'admin'
    });
  }

  function submitModeratorLink(){
    submitLinkFromInputs({
      nameId: 'mod-link-name-input', urlId: 'mod-link-url-input', descId: 'mod-link-desc-input',
      picId: 'mod-link-pic-input', picStatusId: 'mod-link-pic-status', premiumId: 'mod-link-premium-input', priceId: 'mod-link-price-input', uploadedBy: 'moderator'
    });
  }

  function submitLinkFromInputs(cfg){
    const nameEl = document.getElementById(cfg.nameId);
    const urlEl = document.getElementById(cfg.urlId);
    const descEl = document.getElementById(cfg.descId);
    const picEl = document.getElementById(cfg.picId);
    const premiumEl = cfg.premiumId ? document.getElementById(cfg.premiumId) : null;
    const priceEl = cfg.priceId ? document.getElementById(cfg.priceId) : null;
    const name = nameEl ? nameEl.value.trim() : '';
    const url = urlEl ? urlEl.value.trim() : '';
    const description = descEl ? descEl.value.trim() : '';
    const customLogo = picEl ? picEl._customLogo : null;
    const isPremium = premiumEl ? !!premiumEl.checked : false;
    const price = priceEl ? Number(priceEl.value) : PREMIUM_FEE;
    if(!name || !url){
      alert(currentLang==='ur' ? 'Link ka naam aur URL dono zaroori hain.' : 'Link name and URL are both required.');
      return;
    }
    let cleaned = url;
    if(!/^https?:\/\//i.test(cleaned)) cleaned = 'https://' + cleaned;
    const isModerator = cfg.uploadedBy === 'moderator';
    const item = {
      id: linkIdCounter++, name, url: cleaned, addedAt: new Date().toLocaleString(),
      description: description, logo: customLogo || null,
      uploadedBy: cfg.uploadedBy,
      submittedByPhone: isModerator && currentUser ? currentUser.phone : null,
      submittedByName: isModerator && currentUser ? currentUser.name : null,
      status: isModerator ? 'awaiting_approval' : 'approved',
      premium: isPremium,
      price: isPremium ? (price > 0 ? price : PREMIUM_FEE) : null
    };
    links.push(item);
    saveState();
    if(window.fbSaveLink) window.fbSaveLink(item);
    if(!isModerator){
      pushBroadcastNotification(
        'Admin ne ek naya link add kiya hai: "' + name + '"',
        'Admin added a new link: "' + name + '"'
      );
    } else {
      pushAdminNotification(
        'Moderator "' + item.submittedByName + '" ne ek naya link bheja hai approval ke liye: "' + name + '"',
        'Moderator "' + item.submittedByName + '" submitted a new link for approval: "' + name + '"'
      );
    }
    if(nameEl) nameEl.value = '';
    if(urlEl) urlEl.value = '';
    if(descEl) descEl.value = '';
    if(premiumEl) premiumEl.checked = false;
    if(priceEl) priceEl.value = 100;
    clearCustomLogo(cfg.picId, cfg.picStatusId);
    renderAdminLinks();
    renderUserLinks();
    renderModSubmissionsForAdmin();
    renderModOwnSubmissions();
    if(!description) generateLinkAIDescription(item);
    if(!customLogo) generateAILogoForItem(item, 'link');
  }

  // Auto-writes a one-line "meaning" for a link using the admin's saved
  // Gemini key (same key used by the Gemini AI panel). If no key is set
  // yet, this quietly does nothing — the link still works fine without
  // a description, the admin just won't get the AI blurb. Only runs
  // when nobody already typed their own description.
  function generateLinkAIDescription(item){
    const key = localStorage.getItem('atw_gemini_key') || '';
    if(!key) return;
    const prompt = 'In under 12 words, in Roman Urdu, say what this website/link is for. Name: "' + item.name + '". URL: ' + item.url + '. Reply with ONLY the short description, nothing else.';
    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })
    .then(r => r.json())
    .then(data => {
      const reply = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text;
      if(!reply) return;
      const target = links.find(l => l.id === item.id);
      if(!target || target.description) return;
      target.description = reply.trim().replace(/^["']|["']$/g, '');
      saveState();
      if(window.fbSaveLink) window.fbSaveLink(target);
      renderAdminLinks();
      renderUserLinks();
      renderModSubmissionsForAdmin();
      renderModOwnSubmissions();
    })
    .catch(() => { /* AI description is optional — fail silently */ });
  }

  function deleteLink(id){
    links = links.filter(x => x.id !== id);
    saveState();
    if(window.fbDeleteLink) window.fbDeleteLink(id);
    renderAdminLinks();
    renderUserLinks();
    renderModSubmissionsForAdmin();
    renderModOwnSubmissions();
  }

  // Admin edits a link's name/url/description.
  function editLink(id){
    const l = links.find(x => x.id === id);
    if(!l) return;
    const newName = prompt(currentLang==='ur' ? 'Naya naam:' : 'New name:', l.name);
    if(newName === null) return;
    const newUrl = prompt(currentLang==='ur' ? 'Naya URL:' : 'New URL:', l.url);
    if(newUrl === null) return;
    const newDesc = prompt(currentLang==='ur' ? 'Nayi description (khali chor saktay hain):' : 'New description (can be left blank):', l.description || '');
    if(newDesc === null) return;
    l.name = newName.trim() || l.name;
    let cleaned = newUrl.trim();
    if(cleaned){
      if(!/^https?:\/\//i.test(cleaned)) cleaned = 'https://' + cleaned;
      l.url = cleaned;
    }
    l.description = newDesc.trim();
    saveState();
    if(window.fbSaveLink) window.fbSaveLink(l);
    renderAdminLinks();
    renderUserLinks();
    renderModOwnSubmissions();
  }

  // =================================================================
  // MODERATOR SUBMISSIONS — uploads/links a Moderator adds always land
  // here first ("awaiting_approval"). Admin can Approve (upload joins
  // the normal admin uploads list as "pending", ready to Publish; a
  // link becomes "approved" and goes live immediately) or Reject
  // (deleted outright).
  // =================================================================
  function renderModSubmissionsForAdmin(){
    const area = document.getElementById('mod-submissions-area');
    if(!area) return;
    const pendingUploads = uploads.filter(u => u.status === 'awaiting_approval');
    const pendingLinks = links.filter(l => l.status === 'awaiting_approval');
    const total = pendingUploads.length + pendingLinks.length;
    const countEl = document.getElementById('mod-submissions-count-label');
    if(countEl) countEl.textContent = total + ' pending';
    if(total === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi koi moderator submission pending nahi hai.' : 'No moderator submissions pending right now.'}</div>`;
      return;
    }
    area.innerHTML = `<div class="app-tile-grid">` +
      pendingUploads.map((u,i) => `
        <div class="app-tile" style="animation-delay:${i*0.05}s">
          <div class="app-icon-wrap" onclick="openFilePreview(${u.id})">${uploadIconHTML(u)}</div>
          <div class="app-tile-name">${escapeHtml(u.fileName)}</div>
          ${u.description ? `<div class="link-desc">${linkifyText(u.description)}</div>` : ''}
          <div class="badge-status badge-awaiting">🛡 ${escapeHtml(u.submittedByName||'Moderator')}</div>
          <div class="app-tile-actions">
            <button class="btn-outline-green" onclick="approveModeratorSubmission('upload', ${u.id})">Approve</button>
            <button class="btn-outline-danger" onclick="rejectModeratorSubmission('upload', ${u.id})">Reject</button>
          </div>
        </div>
      `).join('') +
      pendingLinks.map((l,i) => `
        <div class="app-tile" style="animation-delay:${i*0.05}s">
          ${linkIconHTML(l)}
          <div class="app-tile-name">${escapeHtml(l.name)}</div>
          ${l.description ? `<div class="link-desc">${linkifyText(l.description)}</div>` : ''}
          <div class="badge-status badge-awaiting">🛡 ${escapeHtml(l.submittedByName||'Moderator')}</div>
          <div class="app-tile-actions">
            <button class="btn-outline-green" onclick="approveModeratorSubmission('link', ${l.id})">Approve</button>
            <button class="btn-outline-danger" onclick="rejectModeratorSubmission('link', ${l.id})">Reject</button>
          </div>
        </div>
      `).join('') +
    `</div>`;
  }

  function approveModeratorSubmission(kind, id){
    if(kind === 'upload'){
      const u = uploads.find(x => x.id === id);
      if(!u) return;
      u.status = 'pending'; // now behaves like any admin upload — Admin still clicks Publish
      saveState();
      if(window.fbSaveUpload) window.fbSaveUpload(u);
      if(u.submittedByPhone) pushUserNotification(u.submittedByPhone,
        'Aapki file "' + u.fileName + '" Admin ne approve kar li hai.',
        'Your file "' + u.fileName + '" was approved by Admin.');
    } else {
      const l = links.find(x => x.id === id);
      if(!l) return;
      l.status = 'approved';
      saveState();
      if(window.fbSaveLink) window.fbSaveLink(l);
      pushBroadcastNotification(
        'Admin ne ek naya link add kiya hai: "' + l.name + '"',
        'Admin added a new link: "' + l.name + '"'
      );
      if(l.submittedByPhone) pushUserNotification(l.submittedByPhone,
        'Aapka link "' + l.name + '" Admin ne approve kar liya hai.',
        'Your link "' + l.name + '" was approved by Admin.');
    }
    renderAdminUploads(); renderCommunityUploads();
    renderAdminLinks(); renderUserLinks();
    renderModSubmissionsForAdmin();
    renderModOwnSubmissions();
  }

  function rejectModeratorSubmission(kind, id){
    if(!confirm(currentLang==='ur' ? 'Ye submission reject/delete kar dain?' : 'Reject and delete this submission?')) return;
    if(kind === 'upload'){
      const u = uploads.find(x => x.id === id);
      if(u && u.submittedByPhone) pushUserNotification(u.submittedByPhone,
        'Aapki file "' + u.fileName + '" reject kar di gayi hai.',
        'Your file "' + u.fileName + '" was rejected.');
      uploads = uploads.filter(x => x.id !== id);
      if(window.fbDeleteUpload) window.fbDeleteUpload(id);
    } else {
      const l = links.find(x => x.id === id);
      if(l && l.submittedByPhone) pushUserNotification(l.submittedByPhone,
        'Aapka link "' + l.name + '" reject kar diya gaya hai.',
        'Your link "' + l.name + '" was rejected.');
      links = links.filter(x => x.id !== id);
      if(window.fbDeleteLink) window.fbDeleteLink(id);
    }
    saveState();
    renderAdminUploads(); renderCommunityUploads();
    renderAdminLinks(); renderUserLinks();
    renderModSubmissionsForAdmin();
    renderModOwnSubmissions();
  }

  // A moderator's own view of everything they've personally submitted,
  // with its current status (Awaiting Approval / Pending / Published /
  // Approved), shown at the bottom of their upload/link form.
  function renderModOwnSubmissions(){
    const area = document.getElementById('mod-own-submissions-area');
    if(!area || !currentUser) return;
    const myUploads = uploads.filter(u => u.uploadedBy === 'moderator' && u.submittedByPhone === currentUser.phone);
    const myLinks = links.filter(l => l.uploadedBy === 'moderator' && l.submittedByPhone === currentUser.phone);
    if(myUploads.length === 0 && myLinks.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Aapne abhi tak kuch submit nahi kiya.' : 'You have not submitted anything yet.'}</div>`;
      return;
    }
    area.innerHTML = `<div class="list-header"><h3>// My Submissions</h3></div><div class="app-tile-grid">` +
      myUploads.map((u,i) => `
        <div class="app-tile" style="animation-delay:${i*0.05}s">
          ${uploadIconHTML(u)}
          <div class="app-tile-name">${escapeHtml(u.fileName)}</div>
          ${statusBadge(u.status)}
        </div>
      `).join('') +
      myLinks.map((l,i) => `
        <div class="app-tile" style="animation-delay:${i*0.05}s">
          ${linkIconHTML(l)}
          <div class="app-tile-name">${escapeHtml(l.name)}</div>
          ${statusBadge(l.status === 'approved' ? 'published' : l.status)}
        </div>
      `).join('') +
    `</div>`;
  }

  // =================================================================
  // USER: EDIT PROFILE (change name + profile picture)
  // =================================================================
  function previewProfilePhoto(e){
    const file = e.target.files[0];
    if(!file) return;
    compressImageFile(file, 700, 0.72).then(function(dataUrl){
      const prev = document.getElementById('profile-photo-preview');
      prev.innerHTML = `<img src="${dataUrl}" alt="preview">`;
      prev._newPhoto = dataUrl;
    });
  }

  function saveProfile(){
    if(!currentUser) return;
    const name = document.getElementById('profile-name-input').value.trim();
    const prev = document.getElementById('profile-photo-preview');
    const newPhoto = prev && prev._newPhoto ? prev._newPhoto : currentUser.photo;
    if(!name){ document.getElementById('profile-success').className = 'success-msg'; document.getElementById('profile-success').textContent = currentLang==='ur' ? 'Naam khali nahi ho sakta.' : 'Name cannot be empty.'; return; }

    const u = users.find(x => x.phone === currentUser.phone);
    if(u){
      u.name = name;
      u.photo = newPhoto;
      currentUser = u;
      saveState();
      if(window.fbSaveUser) window.fbSaveUser(u);
      if(chatThreads[u.phone]) chatThreads[u.phone].name = name;
      renderUserWelcome(u);
      const ok = document.getElementById('profile-success');
      ok.className = 'success-msg';
      ok.textContent = currentLang==='ur' ? 'Profile update ho gaya.' : 'Profile updated.';
    }
  }

  // =================================================================
  // ADMIN: SETTINGS (password + announcement)
  // =================================================================
  function changeAdminPassword(){
    const cur = document.getElementById('pw-current').value;
    const nw = document.getElementById('pw-new').value;
    const cf = document.getElementById('pw-confirm').value;
    const err = document.getElementById('pw-error');
    const ok = document.getElementById('pw-success');
    err.textContent = ''; ok.textContent = '';

    if(cur !== ADMIN.password){ err.textContent = currentLang==='ur' ? 'Current password ghalat hai.' : 'Current password is incorrect.'; return; }
    if(!nw || nw.length < 4){ err.textContent = currentLang==='ur' ? 'Naya password kam az kam 4 characters ka ho.' : 'New password must be at least 4 characters.'; return; }
    if(nw !== cf){ err.textContent = currentLang==='ur' ? 'Naya password aur confirm password match nahi kartay.' : 'New password and confirmation do not match.'; return; }

    ADMIN.password = nw;
    saveState();
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    document.getElementById('pw-confirm').value = '';
    ok.textContent = currentLang==='ur' ? 'Password successfully update ho gaya.' : 'Password updated successfully.';
  }

  function saveAnnouncement(){
    const val = document.getElementById('announcement-input').value.trim();
    siteAnnouncement = val;
    saveState();
    applyAnnouncement();
    if(val){
      pushBroadcastNotification(
        'Naya announcement: ' + val,
        'New announcement: ' + val
      );
    }
    document.getElementById('ann-success').textContent = currentLang==='ur' ? 'Announcement save ho gaya.' : 'Announcement saved.';
  }
  function clearAnnouncement(){
    siteAnnouncement = '';
    document.getElementById('announcement-input').value = '';
    saveState();
    applyAnnouncement();
    document.getElementById('ann-success').textContent = currentLang==='ur' ? 'Announcement clear ho gaya.' : 'Announcement cleared.';
  }
  function applyAnnouncement(){
    const el = document.getElementById('portal-announcement');
    if(siteAnnouncement){
      el.textContent = siteAnnouncement;
      el.classList.add('show');
    } else {
      el.textContent = '';
      el.classList.remove('show');
    }
    const input = document.getElementById('announcement-input');
    if(input) input.value = siteAnnouncement;
  }

  // =================================================================
  // LIVE CHAT (localStorage-backed — same browser/device only, see note)
  // =================================================================
  function countUnread(){
    let n = 0;
    Object.values(chatThreads).forEach(th => th.messages.forEach(m => { if(m.from === 'user' && !m.read) n++; }));
    return n;
  }

  function toggleChatPanel(){
    const panel = document.getElementById('chat-panel');
    panel.classList.toggle('open');
    if(panel.classList.contains('open')) renderUserChatLog();
  }

  function renderUserChatLog(){
    if(!currentUser) return;
    const thread = chatThreads[currentUser.phone] || { name: currentUser.name, messages: [] };
    chatThreads[currentUser.phone] = thread;
    thread.messages.forEach(m => { if(m.from === 'admin') m.read = true; });
    const log = document.getElementById('user-chat-log');
    log.innerHTML = thread.messages.map(m => `
      <div class="chat-bubble ${m.from === 'user' ? 'me' : 'them'} ${m.from === 'ai' ? 'ai' : ''}">${m.from === 'ai' ? '🤖 ' : ''}${escapeHtml(m.text)}<span class="t">${m.time}</span></div>
    `).join('') || `<div class="empty-note" style="padding:16px;">${currentLang==='ur' ? 'Admin ko message bhejain.' : 'Send a message to Admin.'}</div>`;
    log.scrollTop = log.scrollHeight;
    document.getElementById('chat-badge').classList.remove('show');
  }

  function userSendMessage(){
    if(!currentUser) return;
    const input = document.getElementById('user-chat-input');
    const val = input.value.trim();
    if(!val) return;
    const thread = chatThreads[currentUser.phone] || { name: currentUser.name, messages: [] };
    thread.messages.push({ from:'user', text: val, time: new Date().toLocaleTimeString(), read:false });
    chatThreads[currentUser.phone] = thread;
    saveState();
    input.value = '';
    renderUserChatLog();
  }

  function renderThreadList(){
    const area = document.getElementById('admin-thread-list');
    const phones = Object.keys(chatThreads).filter(p => chatThreads[p].messages.length > 0 || users.some(u=>u.phone===p));
    document.getElementById('chat-count-label').textContent = phones.length + ' conversations';
    if(phones.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak koi chat shuru nahi hui.' : 'No conversations yet.'}</div>`;
      return;
    }
    area.innerHTML = phones.map(p => {
      const th = chatThreads[p];
      const unread = th.messages.filter(m => m.from==='user' && !m.read).length;
      return `<div class="thread-row ${openThreadPhone===p?'active':''}" onclick="openThreadFor('${p}')">
        <div><div class="tn">${escapeHtml(th.name||p)}</div><div class="tp">${escapeHtml(p)}</div></div>
        ${unread>0 ? `<span class="unread">${unread}</span>` : ''}
      </div>`;
    }).join('');
  }

  function openThreadFor(phone){
    openThreadPhone = phone;
    document.getElementById('users-section').scrollIntoView({behavior:'smooth'});
    document.getElementById('admin-chat-box').style.display = 'flex';
    document.getElementById('admin-chat-box').style.flexDirection = 'column';
    const th = chatThreads[phone] || { name: (users.find(u=>u.phone===phone)||{}).name || phone, messages: [] };
    chatThreads[phone] = th;
    document.getElementById('admin-chat-with').textContent = (th.name || phone) + ' — ' + phone;
    th.messages.forEach(m => { if(m.from === 'user') m.read = true; });
    saveState();
    renderThreadList();
    renderAdminChatLog();
    document.getElementById('stat-unread').textContent = countUnread();
  }

  function renderAdminChatLog(){
    if(!openThreadPhone) return;
    const th = chatThreads[openThreadPhone];
    const log = document.getElementById('admin-chat-log');
    log.innerHTML = th.messages.map(m => `
      <div class="chat-bubble ${m.from === 'admin' ? 'me' : 'them'} ${m.from === 'ai' ? 'ai' : ''}">${m.from === 'ai' ? '🤖 ' : ''}${escapeHtml(m.text)}<span class="t">${m.time}</span></div>
    `).join('') || `<div class="empty-note" style="padding:16px;">${currentLang==='ur' ? 'Koi message nahi.' : 'No messages.'}</div>`;
    log.scrollTop = log.scrollHeight;
  }

  function adminSendMessage(){
    if(!openThreadPhone) return;
    const input = document.getElementById('admin-chat-input');
    const val = input.value.trim();
    if(!val) return;
    const th = chatThreads[openThreadPhone];
    th.messages.push({ from:'admin', text: val, time: new Date().toLocaleTimeString(), read:true });
    saveState();
    pushUserNotification(openThreadPhone,
      'Admin ne aapko ek naya message bheja hai.',
      'Admin has sent you a new message.');
    input.value = '';
    renderAdminChatLog();
    renderThreadList();
  }

  // Keep a chat feels "live" across two tabs of the SAME browser (e.g.
  // one tab as admin, one as user) — without Firebase, this is the only
  // way for one tab to notice another tab's changes.
  //
  // This used to be a setInterval() re-parsing the ENTIRE app state
  // (including every user's photo and every uploaded file's base64 data)
  // from localStorage every 2.5 seconds, on every logged-in session —
  // a major, constant source of the "site feels laggy" problem, since
  // that JSON blob only grows as more users/uploads are added.
  //
  // The 'storage' event fires natively (and instantly) in other tabs the
  // moment localStorage actually changes, so we don't need to poll at
  // all — this is both lighter AND more responsive.
  window.addEventListener('storage', function(e){
    if(e.key !== STORAGE_KEY || !e.newValue || !currentRole) return;
    let data;
    try{ data = JSON.parse(e.newValue); }catch(err){ return; }
    chatThreads = data.chatThreads || chatThreads;
    uploads = data.uploads || uploads;
    users = data.users || users;
    broadcastNotifications = data.broadcastNotifications || broadcastNotifications;
    adminNotifications = data.adminNotifications || adminNotifications;

    if(currentRole === 'user' && document.getElementById('chat-panel').classList.contains('open')) renderUserChatLog();
    if(currentRole === 'user'){
      const thread = currentUser && chatThreads[currentUser.phone];
      if(thread && thread.messages.some(m => m.from==='admin' && !m.read)) document.getElementById('chat-badge').classList.add('show');
      renderNotifBell();
    }
    if(currentRole === 'admin'){
      renderThreadList();
      if(openThreadPhone) renderAdminChatLog();
      document.getElementById('stat-unread').textContent = countUnread();
      renderNotifBell();
    }
  });

  // =================================================================
  // GEMINI AI ASSISTANT (admin only — calls Google's Gemini API directly
  // from the browser using an API key the admin supplies and stores
  // locally). For production use, proxy this through your own backend
  // so the API key is never exposed in client-side code.
  // =================================================================
  let lastGeminiReply = '';

  function askGemini(){
    const keyInput = document.getElementById('gemini-key-input');
    const key = keyInput.value.trim() || localStorage.getItem('atw_gemini_key') || '';
    const promptInput = document.getElementById('gemini-prompt-input');
    const prompt = promptInput.value.trim();
    const out = document.getElementById('gemini-log-out');
    if(!key){ out.textContent = currentLang==='ur' ? 'Pehle apni Gemini API key daalain.' : 'Please enter your Gemini API key first.'; return; }
    if(!prompt){ out.textContent = currentLang==='ur' ? 'Sawal ya command likhain.' : 'Type a question or command.'; return; }
    localStorage.setItem('atw_gemini_key', key);
    out.textContent = currentLang==='ur' ? 'Gemini se jawab aa raha hai...' : 'Waiting for Gemini...';

    const systemPrompt = "You are an assistant helping the admin of a small website called 'Anas Technical World' (an Urdu/English bilingual portal). Reply concisely in the same language as the prompt (Roman Urdu, Urdu script, or English). If the admin's request looks like a site action (block/unblock a user, publish/unpublish/delete a file, set an announcement, change accent color), restate it as ONE line in this exact format so it can be run as a command: block <name> | unblock <name> | publish <filename> | unpublish <filename> | delete <filename> | announcement lagao: <message> | accent green|blue|amber karo — otherwise just answer normally.";

    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\\n\\nAdmin: ' + prompt }] }] })
    })
    .then(r => r.json())
    .then(data => {
      if(data.error){ out.textContent = 'Gemini error: ' + data.error.message; return; }
      const reply = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) || (currentLang==='ur' ? 'Koi jawab nahi mila.' : 'No reply received.');
      lastGeminiReply = reply.trim();
      out.textContent = lastGeminiReply;
    })
    .catch(err => {
      out.textContent = (currentLang==='ur' ? 'Gemini se rabta nahi ho saka: ' : 'Could not reach Gemini: ') + err.message;
    });
  }

  function runGeminiReplyAsCommand(){
    const out = document.getElementById('gemini-log-out');
    if(!lastGeminiReply){ out.textContent = currentLang==='ur' ? 'Pehle Gemini se koi jawab lein.' : 'Ask Gemini something first.'; return; }
    const originalSpeak = speak;
    window.speak = function(msg){ out.textContent = msg; };
    handleCommand(lastGeminiReply);
    window.speak = originalSpeak;
  }

  // =================================================================
  // TYPEWRITER HEADING
  // =================================================================
  function typeText(el, text, speed){
    el.innerHTML = '';
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.innerHTML = '&nbsp;';
    function step(){
      if(i <= text.length){
        el.textContent = text.slice(0, i);
        el.appendChild(cursor);
        i++;
        setTimeout(step, speed);
      }
    }
    step();
  }

  window.addEventListener('DOMContentLoaded', () => {
    loadState();
    setLanguage(currentLang);
    applyAnnouncement();
    document.getElementById('portal-whatsapp').href = 'https://wa.me/' + WHATSAPP_NUMBER;
    const savedKey = localStorage.getItem('atw_gemini_key');
    if(savedKey) document.getElementById('gemini-key-input').value = savedKey;
    initEmailJs();
    initPaymentSettings();

    // If this browser had an active session (admin or a logged-in user),
    // resume it instead of showing the login/register portal again.
    const resumed = restoreSession();
    if(!resumed){
      typeText(document.getElementById('typewriter-heading'), currentLang==='ur' ? 'Anas Technical World mein khush aamdeed' : 'Welcome to Anas Technical World', 40);
    }
  });

  // Enter-key submits
document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    const activeScreen = document.querySelector('.screen.active').id;
    if(activeScreen === 'screen-portal'){
      if(document.getElementById('pane-admin').style.display !== 'none') adminLogin();
      else registerUser();
    }
    if(document.activeElement && document.activeElement.id === 'ai-command-input') runAiCommandFromBox();
    if(document.activeElement && document.activeElement.id === 'user-chat-input') userSendMessage();
    if(document.activeElement && document.activeElement.id === 'admin-chat-input') adminSendMessage();
  });

  // =================================================================
  // AI / VOICE COMMAND ASSISTANT
  // Rule-based command interpreter + Web Speech API (browser dependent).
  // Works for both admin and user after login.
  // =================================================================
  let recognition = null;
  let isListening = false;
  let keepConversationGoing = false; // true while assistant should auto re-listen after each reply
  let restartTimer = null;

  function getSpeechRecognitionClass(){
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  // file:// pages cannot get mic access in Chrome/Edge — must be served over
  // http(s) (a real host, or "Live Server" / `python -m http.server` locally).
  function isMicCapableContext(){
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  function toggleListening(){
    const panel = document.getElementById('assistant-panel');
    panel.classList.add('open');

    const SR = getSpeechRecognitionClass();
    if(!SR){
      logToAssistant('a', currentLang==='ur' ? 'Ye browser voice recognition support nahi karta. Chrome/Edge try karain, ya neeche type kar ke command dein.' : 'This browser does not support voice recognition. Try Chrome/Edge, or type your command below.');
      addTypeFallback();
      return;
    }
    if(!isMicCapableContext()){
      logToAssistant('a', currentLang==='ur'
        ? 'Mic sirf https:// website ya localhost par kaam karta hai — file ko seedha double-click kar ke kholne par browser mic band kar deta hai. Site ko host karain (ya localhost par chalain), phir mic kaam karega. Abhi ke liye neeche type kar ke command dein.'
        : "The mic only works when this page is served over https:// or localhost — opening the file directly (file://) makes Chrome/Edge block microphone access. Host the site (or run it on localhost), then the mic will work. For now, type your command below.");
      addTypeFallback();
      return;
    }

    if(isListening){
      keepConversationGoing = false;
      stopListening();
      return;
    }

    keepConversationGoing = true;
    startRecognitionCycle();
  }

  function startRecognitionCycle(){
    const SR = getSpeechRecognitionClass();
    recognition = new SR();
    recognition.lang = currentLang === 'ur' ? 'ur-PK' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isListening = true;
      document.getElementById('mic-btn').classList.add('listening');
      logToAssistant('a', currentLang==='ur' ? 'Sun raha hoon... bolain.' : 'Listening... speak now.');
    };
    recognition.onerror = (e) => {
      keepConversationGoing = false;
      if(e.error === 'not-allowed' || e.error === 'service-not-allowed'){
        logToAssistant('a', currentLang==='ur' ? 'Mic ki permission block hai. Browser address bar ke pas 🔒/mic icon par click karke mic ko "Allow" karain, phir dobara try karain.' : 'Microphone permission is blocked. Click the 🔒/mic icon in the address bar, allow the microphone, then try again.');
      } else if(e.error === 'no-speech'){
        logToAssistant('a', currentLang==='ur' ? 'Kuch suna nahi. Dubara bolain.' : "Didn't catch anything. Try speaking again.");
        keepConversationGoing = true;
      } else {
        logToAssistant('a', (currentLang==='ur' ? 'Awaz samajh nahi aayi (' : 'Could not understand (') + e.error + '). ' + (currentLang==='ur' ? 'Dubara koshish karain.' : 'Try again.'));
      }
      stopListening();
    };
    recognition.onend = () => {
      isListening = false;
      document.getElementById('mic-btn').classList.remove('listening');
      // If the assistant is meant to stay "on", automatically start listening
      // again after a short pause — creates a real back-and-forth conversation
      // instead of stopping after one sentence.
      if(keepConversationGoing){
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => { if(keepConversationGoing) startRecognitionCycle(); }, 500);
      }
    };
    recognition.onresult = (event) => {
      const said = event.results[0][0].transcript;
      logToAssistant('u', said);
      handleCommand(said);
    };

    try{ recognition.start(); } catch(err){ logToAssistant('a', currentLang==='ur' ? 'Mic start nahi ho saka.' : 'Could not start the mic.'); }
  }

  function stopListening(){
    isListening = false;
    keepConversationGoing = false;
    clearTimeout(restartTimer);
    document.getElementById('mic-btn').classList.remove('listening');
    if(recognition){ try{ recognition.stop(); }catch(e){} }
  }

  let typeFallbackAdded = false;
  function addTypeFallback(){
    if(typeFallbackAdded) return;
    typeFallbackAdded = true;
    const panel = document.getElementById('assistant-panel');
    const row = document.createElement('div');
    row.className = 'ai-input-row';
    row.innerHTML = `<input type="text" id="assistant-type-input" placeholder="${currentLang==='ur'?'Command type karain...':'Type a command...'}"><button onclick="submitTypedCommand()">${currentLang==='ur'?'Send':'Send'}</button>`;
    panel.appendChild(row);
  }
  function submitTypedCommand(){
    const inp = document.getElementById('assistant-type-input');
    const val = inp.value.trim();
    if(!val) return;
    logToAssistant('u', val);
    handleCommand(val);
    inp.value = '';
  }

  function logToAssistant(who, text){
    const log = document.getElementById('assistant-log');
    const div = document.createElement('div');
    div.className = who === 'u' ? 'u' : 'a';
    div.textContent = (who === 'u' ? '🗣 ' : '🤖 ') + text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function speak(text){
    logToAssistant('a', text);
    if(!('speechSynthesis' in window)) return;
    try{
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = currentLang === 'ur' ? 'ur-PK' : 'en-US';
      const voices = speechSynthesis.getVoices();
      const vc = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(currentLang));
      if(vc) utter.voice = vc;
      speechSynthesis.speak(utter);
    }catch(e){}
  }

  // Main command router — used by both voice + typed + Gemini command box
  function handleCommand(raw){
    const text = raw.trim();
    const low = text.toLowerCase();

    // Stop the always-listening conversation loop
    if(low.includes('stop listening') || low.includes('band karo') || low.includes('chup ho') || low.includes('rukjao') || low.includes('ruk jao')){
      keepConversationGoing = false;
      speak(currentLang==='ur' ? 'Theek hai, mic band kar raha hoon.' : 'Okay, turning the mic off.');
      setTimeout(stopListening, 300);
      return;
    }

    if(low.includes('logout') || text.includes('لاگ آؤٹ')){
      speak(currentLang==='ur' ? 'Aap logout ho rahe hain.' : 'Logging you out.');
      keepConversationGoing = false;
      setTimeout(logout, 600);
      return;
    }
    if(low.includes('dashboard') || low.includes('home') || low.includes('wapas')){
      window.scrollTo({top:0, behavior:'smooth'});
      speak(currentLang==='ur' ? 'Dashboard par wapas le aya hoon.' : 'Back at the dashboard.');
      return;
    }

    // Generic "open X" / "click X" — works anywhere on the site (admin or
    // user side), and can open/click anything currently on screen: menu
    // items, uploaded files/links, buttons, section headings, etc.
    if(low.startsWith('open ') || low.startsWith('click ') || low.includes('kholo') || low.includes('khol do') || text.includes('کھولو') || text.includes('کلک')){
      let fragment = low;
      ['open ', 'click '].forEach(k => { if(fragment.startsWith(k)) fragment = fragment.slice(k.length); });
      fragment = fragment.replace(/\bkholo\b|\bkhol do\b|\bko\b|\bkholain\b|\bpar click karo\b|\bclick karo\b/g, '').trim();
      if(fragment && clickElementByText(fragment)){
        speak(currentLang==='ur' ? `"${fragment}" khol raha hoon.` : `Opening "${fragment}".`);
        return;
      } else if(fragment){
        speak(currentLang==='ur' ? `Mujhe "${fragment}" naam ki cheez screen par nahi mili.` : `I couldn't find anything on screen called "${fragment}".`);
        return;
      }
    }

    if(currentRole === 'admin'){
      if(low.includes('users') && !low.includes('block') && !low.includes('unblock')){
        document.getElementById('users-section').scrollIntoView({behavior:'smooth'});
        speak(currentLang==='ur' ? 'Users list dikha raha hoon.' : 'Showing the users list.');
        return;
      }
      if(low.includes('uploads') && !low.includes('publish') && !low.includes('delete')){
        document.getElementById('content-section').scrollIntoView({behavior:'smooth'});
        speak(currentLang==='ur' ? 'Uploads list dikha raha hoon.' : 'Showing the uploads list.');
        return;
      }
      if(low.includes('password')){
        document.getElementById('settings-section').scrollIntoView({behavior:'smooth'});
        speak(currentLang==='ur' ? 'Password change form khol diya.' : 'Opened the password change form.');
        return;
      }
      if(low.includes('unblock')){
        const name = extractAfterKeyword(low, 'unblock');
        const u = findUserByName(name);
        if(u){ u.blocked = false; saveState(); renderUsersList(); speak(u.name + (currentLang==='ur'?' ko unblock kar diya gaya.':' has been unblocked.')); }
        else speak(currentLang==='ur' ? 'Mujhe ye user nahi mila.' : "Couldn't find that user.");
        return;
      }
      if(low.includes('block')){
        const name = extractAfterKeyword(low, 'block');
        const u = findUserByName(name);
        if(u){ u.blocked = true; saveState(); renderUsersList(); speak(u.name + (currentLang==='ur'?' ko block kar diya gaya.':' has been blocked.')); }
        else speak(currentLang==='ur' ? 'Mujhe ye user nahi mila.' : "Couldn't find that user.");
        return;
      }
      if(low.includes('unpublish')){
        const name = extractAfterKeyword(low, 'unpublish');
        const up = findUploadByName(name);
        if(up){ setUploadStatus(up.id, 'unpublished'); speak(up.fileName + (currentLang==='ur'?' unpublish kar diya gaya.':' has been unpublished.')); }
        else speak(currentLang==='ur' ? 'Mujhe ye file nahi mili.' : "Couldn't find that file.");
        return;
      }
      if(low.includes('publish')){
        const name = extractAfterKeyword(low, 'publish');
        const up = findUploadByName(name);
        if(up){ setUploadStatus(up.id, 'published'); speak(up.fileName + (currentLang==='ur'?' publish kar diya gaya.':' has been published.')); }
        else speak(currentLang==='ur' ? 'Mujhe ye file nahi mili.' : "Couldn't find that file.");
        return;
      }
      if(low.includes('delete')){
        const name = extractAfterKeyword(low, 'delete');
        const up = findUploadByName(name);
        if(up){ deleteUpload(up.id); speak(up.fileName + (currentLang==='ur'?' delete kar diya gaya.':' has been deleted.')); }
        else speak(currentLang==='ur' ? 'Mujhe ye file nahi mili.' : "Couldn't find that file.");
        return;
      }
      if(low.includes('announcement') || text.includes('اعلان')){
        const idx = text.indexOf(':');
        if(idx > -1){
          siteAnnouncement = text.substring(idx+1).trim();
          saveState();
          applyAnnouncement();
          speak(currentLang==='ur' ? 'Announcement laga diya gaya.' : 'Announcement has been set.');
        } else {
          speak(currentLang==='ur' ? 'Announcement ke liye colon ke baad message likhain, jaise: announcement lagao: naya update aa gaya' : 'Add a colon then the message, e.g: announcement: new update is live');
        }
        return;
      }
      if(low.includes('accent') || low.includes('color') || low.includes('theme')){
        if(low.includes('green') || low.includes('sabz') || text.includes('سبز')){
          document.documentElement.style.setProperty('--cyan', '#3dff9a');
          document.documentElement.style.setProperty('--cyan-dim', '#0fa36c');
          speak(currentLang==='ur' ? 'Accent color green kar diya gaya.' : 'Accent color set to green.');
        } else if(low.includes('blue') || low.includes('neela') || low.includes('cyan') || text.includes('نیلا')){
          document.documentElement.style.setProperty('--cyan', '#3df3ff');
          document.documentElement.style.setProperty('--cyan-dim', '#0f8fa3');
          speak(currentLang==='ur' ? 'Accent color blue kar diya gaya.' : 'Accent color set to blue.');
        } else if(low.includes('amber') || low.includes('gold') || low.includes('peela') || text.includes('پیلا')){
          document.documentElement.style.setProperty('--cyan', '#ffbe3d');
          document.documentElement.style.setProperty('--cyan-dim', '#c98f10');
          speak(currentLang==='ur' ? 'Accent color amber kar diya gaya.' : 'Accent color set to amber.');
        } else {
          speak(currentLang==='ur' ? 'Rang batain — jaise "accent green karo" ya "accent blue karo".' : 'Name a color — e.g. "accent green" or "accent blue".');
        }
        return;
      }
    }

    // General conversation — small talk / greetings, so the assistant can
    // chat even when it's not a site command.
    const chit = chitChatReply(low, text);
    if(chit){ speak(chit); return; }

    speak(currentLang==='ur' ? 'Maaf kijiye, ye command samajh nahi aayi. Dobara kahiye ya type kar ke likhain.' : "Sorry, I didn't understand that command. Try again or type it out.");
  }

  // Finds a clickable/visible element on the CURRENT screen whose text
  // matches the spoken fragment, and clicks it — this is how voice commands
  // like "open uploads" or "click publish" actually control the page.
  function clickElementByText(fragment){
    fragment = fragment.trim().toLowerCase();
    if(!fragment) return false;
    const activeScreen = document.querySelector('.screen.active') || document;
    const candidates = activeScreen.querySelectorAll('button, a, [onclick], input[type="submit"], input[type="button"], .tab, .nav-item, [role="button"], summary, h1, h2, h3, .section-title');
    let best = null, bestScore = 0;
    candidates.forEach(el => {
      if(el.offsetParent === null) return; // skip hidden elements
      const label = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().toLowerCase();
      if(!label) return;
      if(label === fragment){ best = el; bestScore = 100; }
      else if((label.includes(fragment) || fragment.includes(label)) && bestScore < 50){ best = el; bestScore = 50; }
    });
    if(!best) return false;
    if(typeof best.click === 'function') best.click();
    else best.scrollIntoView({behavior:'smooth', block:'center'});
    if(best.scrollIntoView && bestScore < 100) best.scrollIntoView({behavior:'smooth', block:'center'});
    return true;
  }

  // Lightweight small-talk so the assistant can hold a normal conversation,
  // not just fire commands. Extend this list any time.
  function chitChatReply(low, original){
    const has = (...words) => words.some(w => low.includes(w));
    if(has('kaisay ho', 'kesay ho', 'kia hal', 'kya hal', 'how are you', 'kya haal hai')){
      return currentLang==='ur' ? 'Main bilkul theek hoon, shukriya! Aap batain, main aapki kya madad kar sakta hoon?' : "I'm doing great, thanks for asking! How can I help you?";
    }
    if(has('assalam', 'salam', 'hello', 'hi ', 'hey')){
      return currentLang==='ur' ? 'Walaikum Assalam! Main aapka voice assistant hoon — koi bhi command bolain ya baat karain.' : 'Hello! I\'m your voice assistant — give me a command or just chat.';
    }
    if(has('shukriya', 'thank you', 'thanks')){
      return currentLang==='ur' ? 'Koi baat nahi, hamesha hazir hoon!' : "You're welcome, always here to help!";
    }
    if(has('naam kya', 'aapka naam', 'your name', 'who are you', 'kaun ho')){
      return currentLang==='ur' ? 'Main Anas Technical World ka AI voice assistant hoon.' : "I'm the Anas Technical World AI voice assistant.";
    }
    if(has('help', 'madad', 'kya kar sakty', 'kya kar sakte')){
      return currentLang==='ur'
        ? 'Main site control kar sakta hoon — jaise "open uploads", "block Ahmed", "publish file", "logout" — ya bas mujhse baat kar sakte hain.'
        : 'I can control the site — like "open uploads", "block Ahmed", "publish file", "logout" — or you can just chat with me.';
    }
    return null;
  }

  function extractAfterKeyword(low, keyword){
    const idx = low.indexOf(keyword);
    if(idx === -1) return '';
    return low.substring(idx + keyword.length).trim();
  }
  function findUserByName(fragment){
    if(!fragment) return null;
    return users.find(u => u.name.toLowerCase().includes(fragment) || fragment.includes(u.name.toLowerCase()));
  }
  function findUploadByName(fragment){
    if(!fragment) return null;
    return uploads.find(u => u.fileName.toLowerCase().includes(fragment) || fragment.includes(u.fileName.toLowerCase().replace(/\.[^.]+$/, '')));
  }

  // Admin's typed quick-command box (also routes through handleCommand)
  function runAiCommandFromBox(){
    const input = document.getElementById('ai-command-input');
    const val = input.value.trim();
    if(!val) return;
    const out = document.getElementById('ai-log-out');
    out.textContent = (currentLang==='ur' ? 'Process ho raha hai: "' : 'Processing: "') + val + '"...';
    const originalSpeak = speak;
    window.speak = function(msg){ out.textContent = msg; };
    handleCommand(val);
    window.speak = originalSpeak;
    input.value = '';
  }
