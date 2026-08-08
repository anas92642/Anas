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
  let uploads = [];      // {id, fileName, fileType, dataUrl, status, uploadedAt}
  let chatThreads = {};  // phone -> {name, messages:[{from:'user'|'admin', text, time, read}]}
  let erpCounter = 20000 + Math.floor(Math.random() * 70000);
  let uploadIdCounter = 1;
  let pendingPhoto = null;
  let currentUser = null;
  let currentRole = null;    // 'admin' | 'user'
  let siteAnnouncement = '';
  let currentLang = 'ur';
  let openThreadPhone = null;

  function collectState(){
    return { ADMIN, users, uploads, chatThreads, erpCounter, uploadIdCounter, siteAnnouncement, currentLang };
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
    chatThreads = data.chatThreads || {};
    erpCounter = data.erpCounter || erpCounter;
    uploadIdCounter = data.uploadIdCounter || uploadIdCounter;
    siteAnnouncement = data.siteAnnouncement || '';
    currentLang = data.currentLang || 'ur';
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
    if(saved.role === 'user'){
      const found = users.find(u => u.phone === saved.phone);
      if(found && !found.blocked){
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
      btnRegister: 'Register', btnLogin: 'Login',
      lblName: 'Naam (Name)', phName: 'e.g. Ahmed Raza',
      lblPhone: 'Phone Number', phPhone: 'e.g. 03001234567', phLoginPhone: 'Apna registered phone number',
      lblPassword: 'Password', phPassword: '••••••••',
      photoWord: 'Photo', btnUploadPic: 'Upload Picture',
      btnRegisterGo: 'Register & Continue', noAccount: 'Account nahi hai?',
      btnAdminLogin: 'Login as Admin', waChat: 'WhatsApp par baat karain',
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
    },
    en: {
      brand: 'SECURE <b>ANAS TECHNICAL WORLD</b> // PORTAL',
      portalSub: 'Choose your role — Admin or User. Login or register from one box below.',
      accessTitle: 'Access Card', accessSub: 'Select your role below',
      tabUser: 'User', tabAdmin: 'Admin',
      btnRegister: 'Register', btnLogin: 'Login',
      lblName: 'Name', phName: 'e.g. Ahmed Raza',
      lblPhone: 'Phone Number', phPhone: 'e.g. 03001234567', phLoginPhone: 'Your registered phone number',
      lblPassword: 'Password', phPassword: '••••••••',
      photoWord: 'Photo', btnUploadPic: 'Upload Picture',
      btnRegisterGo: 'Register & Continue', noAccount: "Don't have an account?",
      btnAdminLogin: 'Login as Admin', waChat: 'Chat on WhatsApp',
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
    document.getElementById('register-error').textContent = '';
    document.getElementById('login-error').textContent = '';
    if(which === 'register'){
      regForm.style.display = 'block'; logForm.style.display = 'none';
      tabR.classList.add('active'); tabL.classList.remove('active');
    } else {
      regForm.style.display = 'none'; logForm.style.display = 'block';
      tabL.classList.add('active'); tabR.classList.remove('active');
    }
  }

  function previewPhoto(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      pendingPhoto = ev.target.result;
      document.getElementById('reg-photo-preview').innerHTML = `<img src="${ev.target.result}" alt="preview">`;
    };
    reader.readAsDataURL(file);
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

    const newUser = { serial: users.length + 1, erp: String(erpCounter++), name, phone, password, photo: pendingPhoto, blocked:false };
    users.push(newUser);
    chatThreads[phone] = chatThreads[phone] || { name, messages: [] };
    saveState();

    document.getElementById('reg-name').value = '';
    document.getElementById('reg-phone').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-photo-preview').innerHTML = t('photoWord');
    pendingPhoto = null;

    beginLogin('user', newUser);
  }

  function userLogin(){
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    err.textContent = '';
    const found = users.find(u => u.phone === phone);
    if(!found){ err.textContent = currentLang==='ur' ? 'Ye phone number registered nahi. Pehle register karain.' : 'This phone number is not registered. Please register first.'; return; }
    if(found.password !== password){ err.textContent = currentLang==='ur' ? 'Password ghalat hai.' : 'Incorrect password.'; return; }
    if(found.blocked){ err.textContent = (currentLang==='ur' ? 'Ye account block kar diya gaya hai. Admin se rabta karain: ' : 'This account has been blocked. Contact Admin: ') + '+923074499097'; return; }
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
      document.getElementById('assistant-widget').classList.add('show');
      if(role === 'admin') renderAdminWelcome();
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

    renderCommunityUploads();
    renderUserChatLog();
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
    renderAdminUploads();
    renderThreadList();
    document.getElementById('portal-whatsapp').href = 'https://wa.me/' + WHATSAPP_NUMBER;
    showScreen('screen-welcome-admin');
  }

  function logout(){
    currentUser = null;
    currentRole = null;
    openThreadPhone = null;
    saveSession();
    document.getElementById('login-phone').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('assistant-widget').classList.remove('show');
    document.getElementById('assistant-panel').classList.remove('open');
    document.getElementById('chat-panel').classList.remove('open');
    stopListening();
    switchUserTab('register');
    switchRoleTab('user');
    showScreen('screen-portal');
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
    area.innerHTML = `<div class="user-grid">` + users.map(u => `
      <div class="user-row ${u.blocked ? 'blocked' : ''}">
        <div class="serial">#${String(u.serial).padStart(3,'0')}</div>
        <div class="ph">${u.photo ? `<img src="${u.photo}">` : initials(u.name)}</div>
        <div class="info">
          <div class="n">${escapeHtml(u.name)} <span class="presence-dot ${onlinePhones.has(u.phone) ? 'is-online' : 'is-offline'}" title="${onlinePhones.has(u.phone) ? 'Online' : 'Offline'}"></span></div>
          <div class="p">${escapeHtml(u.phone)}</div>
          <div class="e">ERP ${u.erp}</div>
          ${u.blocked ? `<div class="badge-blocked">● ${currentLang==='ur'?'Blocked':'Blocked'}</div>` : ''}
        </div>
        <div class="actions">
          ${u.blocked
            ? `<button class="btn-outline-green" onclick="toggleBlock('${u.phone}')">${currentLang==='ur'?'Unblock':'Unblock'}</button>`
            : `<button class="btn-outline-danger" onclick="toggleBlock('${u.phone}')">${currentLang==='ur'?'Block':'Block'}</button>`}
          <button class="btn-outline-green" onclick="openThreadFor('${u.phone}')">💬 Chat</button>
          <button class="btn-outline-amber" onclick="adminResetUserPassword('${u.phone}')">🔑 Password</button>
          <button class="btn-outline-green" onclick="viewUserProfile('${u.phone}')">👤 Profile</button>
        </div>
      </div>
    `).join('') + `</div>`;
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
    renderUsersList();
  }

  // =================================================================
  // UPLOADS — ADMIN ONLY. Users can only view + download published files.
  // =================================================================
  function handleAdminUpload(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const item = {
        id: uploadIdCounter++,
        fileName: file.name,
        fileType: file.type,
        dataUrl: ev.target.result,
        status: 'pending',
        uploadedAt: new Date().toLocaleString()
      };
      uploads.push(item);
      saveState();
      renderAdminUploads();
      renderCommunityUploads();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function statusBadge(status){
    if(status === 'published') return `<span class="badge-status badge-published">Published</span>`;
    if(status === 'unpublished') return `<span class="badge-status badge-unpublished">Unpublished</span>`;
    return `<span class="badge-status badge-pending">Pending</span>`;
  }

  function uploadThumb(u){
    if(u.fileType && u.fileType.startsWith('image/')){
      return `<img src="${u.dataUrl}">`;
    }
    return escapeHtml(u.fileName);
  }

  function renderCommunityUploads(){
    const pub = uploads.filter(u => u.status === 'published');
    document.getElementById('community-count').textContent = pub.length + ' files';
    const area = document.getElementById('community-area');
    if(pub.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak Admin ne koi file publish nahi ki.' : 'Admin has not published any files yet.'}</div>`;
      return;
    }
    area.innerHTML = `<div class="upload-grid">` + pub.map((u,i) => `
      <div class="upload-card" style="animation-delay:${i*0.08}s">
        <div class="upload-thumb" onclick="openFilePreview(${u.id})" style="cursor:pointer;">${uploadThumb(u)}</div>
        <div class="upload-name">${escapeHtml(u.fileName)}</div>
        <div class="upload-owner">${currentLang==='ur' ? 'Admin ki taraf se' : 'From Admin'}</div>
      </div>
    `).join('') + `</div>`;
  }

  function renderAdminUploads(){
    document.getElementById('uploads-count-label').textContent = uploads.length + ' records';
    const area = document.getElementById('admin-uploads-area');
    if(uploads.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi tak koi upload nahi hua.' : 'No uploads yet.'}</div>`;
      return;
    }
    area.innerHTML = `<div class="upload-grid">` + uploads.map((u,i) => `
      <div class="upload-card" style="animation-delay:${i*0.05}s">
        <div class="upload-thumb" onclick="openFilePreview(${u.id})" style="cursor:pointer;">${uploadThumb(u)}</div>
        <div class="upload-name">${escapeHtml(u.fileName)}</div>
        ${statusBadge(u.status)}
        <div class="upload-actions">
          ${u.status !== 'published' ? `<button class="btn-outline-green" onclick="setUploadStatus(${u.id}, 'published')">Publish</button>` : ''}
          ${u.status === 'published' ? `<button class="btn-outline-amber" onclick="setUploadStatus(${u.id}, 'unpublished')">Unpublish</button>` : ''}
          <button class="btn-outline-danger" onclick="deleteUpload(${u.id})">Delete</button>
        </div>
      </div>
    `).join('') + `</div>`;
    document.getElementById('stat-uploads').textContent = uploads.length;
  }

  function setUploadStatus(id, status){
    const u = uploads.find(x => x.id === id);
    if(!u) return;
    u.status = status;
    saveState();
    renderAdminUploads();
    renderCommunityUploads();
  }

  function deleteUpload(id){
    uploads = uploads.filter(x => x.id !== id);
    saveState();
    renderAdminUploads();
    renderCommunityUploads();
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
    dl.download = u.fileName;
    document.getElementById('file-modal').classList.add('show');
  }

  function closeModal(){
    document.getElementById('file-modal').classList.remove('show');
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
    input.value = '';
    renderAdminChatLog();
    renderThreadList();
  }

  // Poll for changes every 2.5s so an open chat feels "live" within this
  // browser (e.g. two tabs open — one as admin, one as user).
  setInterval(() => {
    if(!currentRole) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    try{
      const data = JSON.parse(raw);
      chatThreads = data.chatThreads || chatThreads;
      uploads = data.uploads || uploads;
      users = data.users || users;
    }catch(e){}
    if(currentRole === 'user' && document.getElementById('chat-panel').classList.contains('open')) renderUserChatLog();
    if(currentRole === 'user'){
      const thread = currentUser && chatThreads[currentUser.phone];
      if(thread && thread.messages.some(m => m.from==='admin' && !m.read)) document.getElementById('chat-badge').classList.add('show');
    }
    if(currentRole === 'admin'){
      renderThreadList();
      if(openThreadPhone) renderAdminChatLog();
      document.getElementById('stat-unread').textContent = countUnread();
    }
  }, 2500);

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
      else {
        const isRegister = document.getElementById('register-form').style.display !== 'none';
        isRegister ? registerUser() : userLogin();
      }
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
        document.getElementById('uploads-section').scrollIntoView({behavior:'smooth'});
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
