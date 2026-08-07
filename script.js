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

    const newUser = { serial: users.length + 1, erp: String(erpCounter++), name, phone, password, photo: pendingPhoto, blocked:false, approved: false };
    users.push(newUser);
    chatThreads[phone] = chatThreads[phone] || { name, messages: [] };
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(newUser);

    document.getElementById('reg-name').value = '';
    document.getElementById('reg-phone').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-photo-preview').innerHTML = t('photoWord');
    pendingPhoto = null;
    
    err.textContent = currentLang === 'ur' ? 'Registration kamyab! Admin ki approval ke baad aap login kar sakain gay.' : 'Registration successful! You can log in after the admin approves your account.';
    switchUserTab('login');
  }

  function userLogin(){
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    err.textContent = '';
    const found = users.find(u => u.phone === phone);
    if(!found){ err.textContent = currentLang==='ur' ? 'Ye phone number registered nahi. Pehle register karain.' : 'This phone number is not registered. Please register first.'; return; }
    if(!found.approved){ err.textContent = currentLang==='ur' ? 'Aapka account abhi tak approve nahi hua. Admin se rabta karain.' : 'Your account is not yet approved. Please contact the admin.'; return; }
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
    renderOnlineUsersList();
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
          ${!u.approved ? `<div class="badge-pending">● ${currentLang==='ur'?'Pending Approval':'Pending Approval'}</div>` : ''}
          ${u.blocked ? `<div class="badge-blocked">● ${currentLang==='ur'?'Blocked':'Blocked'}</div>` : ''}
        </div>
        <div class="actions">
          ${!u.approved
            ? `<button class="btn-outline-green" onclick="approveUser('${u.phone}')">${currentLang==='ur'?'Approve':'Approve'}</button>
               <button class="btn-outline-danger" onclick="rejectUser('${u.phone}')">${currentLang==='ur'?'Reject':'Reject'}</button>`
            : `${u.blocked
                ? `<button class="btn-outline-green" onclick="toggleBlock('${u.phone}')">${currentLang==='ur'?'Unblock':'Unblock'}</button>`
                : `<button class="btn-outline-danger" onclick="toggleBlock('${u.phone}')">${currentLang==='ur'?'Block':'Block'}</button>`
              }
              <button class="btn-outline-green" onclick="openThreadFor('${u.phone}')">💬 Chat</button>`
          }
          <button class="btn-outline-amber" onclick="adminResetUserPassword('${u.phone}')">🔑 Password</button>
          <button class="btn-outline-green" onclick="viewUserProfile('${u.phone}')">👤 Profile</button>
          <button class="btn-outline-danger" onclick="deleteUser('${u.phone}')">Delete</button>
        </div>
      </div>
    `).join('') + `</div>`;
  }

  function renderOnlineUsersList(){
    const onlineUsers = users.filter(u => onlinePhones.has(u.phone));
    const area = document.getElementById('online-user-list-area');
    const countLabel = document.getElementById('online-list-count');

    if (countLabel) {
      countLabel.textContent = onlineUsers.length + ' ' + (currentLang === 'ur' ? 'online' : 'online');
    }

    if(onlineUsers.length === 0){
      area.innerHTML = `<div class="empty-note">${currentLang==='ur' ? 'Abhi koi user online nahi hai.' : 'No users are online right now.'}</div>`;
      return;
    }
    area.innerHTML = `<div class="user-grid">` + onlineUsers.map(u => `
      <div class="user-row">
        <div class="serial">#${String(u.serial).padStart(3,'0')}</div>
        <div class="ph">${u.photo ? `<img src="${u.photo}">` : initials(u.name)}</div>
        <div class="info">
          <div class="n">${escapeHtml(u.name)} <span class="presence-dot is-online" title="Online"></span></div>
          <div class="p">${escapeHtml(u.phone)}</div>
          <div class="e">ERP ${u.erp}</div>
        </div>
        <div class="actions">
          <button class="btn-outline-green" onclick="openThreadFor('${u.phone}')">💬 Chat</button>
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
    if(window.fbSaveUser) window.fbSaveUser(u);
    renderUsersList();
  }

  function approveUser(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    u.approved = true;
    saveState();
    if(window.fbSaveUser) window.fbSaveUser(u);
    renderUsersList();
  }

  function rejectUser(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    if(!confirm((currentLang==='ur'?'Kya aap user "' : 'Are you sure you want to reject and delete user "') + u.name + '"?')) return;
    users = users.filter(x => x.phone !== phone);
    delete chatThreads[phone];
    saveState();
    if(window.fbDeleteUser) window.fbDeleteUser(phone);
    renderUsersList();
  }

  function deleteUser(phone){
    const u = users.find(x => x.phone === phone);
    if(!u) return;
    if(!confirm((currentLang==='ur'?'Kya aap waqai user "' : 'Are you sure you want to permanently delete user "') + u.name + '"? This action cannot be undone.')) return;
    users = users.filter(x => x.phone !== phone);
    delete chatThreads[phone];
    saveState();
    if(window.fbDeleteUser) window.fbDeleteUser(phone);
    renderUsersList();
  }

  // =================================================================
  // UPLOADS — ADMIN ONLY. Users can only view + download published files.
  // =================================================================
  function handleAdminUpload(e){
    const file = e.target.files[0];
    if(!file) return;

    const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const displayName = prompt(currentLang === 'ur' ? 'File ke liye ek naam likhain:' : 'Enter a name for this file:', defaultName);

    if (!displayName || !displayName.trim()) {
        e.target.value = ''; // Reset file input to allow re-selecting same file
        return; // Abort if user cancels or enters an empty name
    }

    const reader = new FileReader();
    reader.onload = function(ev){
      const item = {
        id: uploadIdCounter++,
        fileName: displayName.trim(),
        fileType: file.type,
        type: 'file', // Differentiate between file and link
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

  function addAdminLink(){
    const url = prompt(currentLang === 'ur' ? 'Link ka URL paste karain:' : 'Paste the link URL:');
    if(!url || !url.trim()) return;
    let validUrl;
    try {
      validUrl = new URL(url.startsWith('http') ? url : 'https://' + url);
    } catch(e) {
      alert(currentLang === 'ur' ? 'URL theek nahi hai.' : 'Invalid URL.');
      return;
    }

    const title = prompt(currentLang === 'ur' ? 'Link ke liye ek title likhain:' : 'Enter a title for the link:', validUrl.hostname);
    if(!title || !title.trim()) return;

    const item = {
      id: uploadIdCounter++,
      type: 'link', // Differentiate between file and link
      url: validUrl.href,
      fileName: title, // Use fileName for title to keep structure consistent
      iconUrl: `https://www.google.com/s2/favicons?sz=64&domain_url=${validUrl.hostname}`,
      status: 'pending',
      uploadedAt: new Date().toLocaleString()
    };
    uploads.push(item);
    saveState();
    renderAdminUploads();
    renderCommunityUploads();
  }

  function statusBadge(status){
    if(status === 'published') return `<span class="badge-status badge-published">Published</span>`;
    if(status === 'unpublished') return `<span class="badge-status badge-unpublished">Unpublished</span>`;
    return `<span class="badge-status badge-pending">Pending</span>`;
  }

  function uploadThumb(u){
    if(u.type === 'link'){
      // The 'AI' generated icon is the website's favicon, with a fallback.
      return `<img src="${u.iconUrl}" onerror="this.onerror=null;this.src='assets/link-icon.png';">`;
    }
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
      <div class="upload-card" style="animation-delay:${i*0.08}s" onclick="${u.type === 'link' ? `window.open('${u.url}', '_blank')` : `openFilePreview(${u.id})`}">
        <div class="upload-thumb" style="cursor:pointer;">${uploadThumb(u)}</div>
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
      <div class="upload-card" style="animation-delay:${i*0.05}s" onclick="${u.type === 'link' ? `window.open('${u.url}', '_blank')` : `openFilePreview(${u.id})`}">
        <div class="upload-thumb" style="cursor:pointer;">${uploadThumb(u)}</div>
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
    if(!u || u.type === 'link') return;
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

  function openLinkPreview(id){
    const u = uploads.find(x => x.id === id);
    if(!u || u.type !== 'link') return;
    document.getElementById('link-modal-title').textContent = u.fileName;
    const iframe = document.getElementById('link-iframe');
    // Using a proxy to bypass 'X-Frame-Options' header if possible
    iframe.src = u.url;
    document.getElementById('link-modal').classList.add('show');
  }

  function closeLinkModal(){
    document.getElementById('link-iframe').src = 'about:blank'; // Clear content
    document.getElementById('link-modal').classList.remove('show');
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
    thread.messages.push({ from:'user', text: val, time: new Date().toLocaleTimeString(), read:false, ts: Date.now() });
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
    document.getElementById('chat-section').scrollIntoView({behavior:'smooth'});
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
      <div class="chat-bubble ${m.from === 'admin' ? 'me' : 'them'} ${m.from === 'ai' ? 'ai' : ''}">
        ${m.from === 'ai' ? '🤖 ' : ''}${escapeHtml(m.text)}<span class="t">${m.time}</span>
        <button class="delete-msg-btn" onclick="deleteChatMessage('${openThreadPhone}', '${m.ts}')" title="Delete Message">✕</button>
      </div>
    `).join('') || `<div class="empty-note" style="padding:16px;">${currentLang==='ur' ? 'Koi message nahi.' : 'No messages.'}</div>`;
    log.scrollTop = log.scrollHeight;
  }

  function adminSendMessage(){
    if(!openThreadPhone) return;
    const input = document.getElementById('admin-chat-input');
    const val = input.value.trim();
    if(!val) return;
    const th = chatThreads[openThreadPhone];
    th.messages.push({ from:'admin', text: val, time: new Date().toLocaleTimeString(), read:true, ts: Date.now() });
    saveState();
    input.value = '';
    renderAdminChatLog();
    renderThreadList();
  }

  // Poll for changes every 2.5s so an open chat feels "live" within this
  function deleteChatMessage(phone, timestamp) {
    if (!confirm(currentLang === 'ur' ? 'Kya aap waqai is message ko delete karna chahte hain?' : 'Are you sure you want to delete this message?')) return;
    
    const thread = chatThreads[phone];
    if (thread) {
      thread.messages = thread.messages.filter(m => String(m.ts) !== String(timestamp));
      saveState();
      if (window.fbSaveChatThread) window.fbSaveChatThread(phone, thread);
      renderAdminChatLog();
      renderThreadList();
    }
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
      renderOnlineUsersList();
      document.getElementById('stat-unread').textContent = countUnread();
    }
  }, 2500);

  // =================================================================
  // TYPEWRITER HEADING
  // =================================================================
  function typeText(el, text, speed){
    // Ensure the element exists before proceeding
    if (!el) {
      console.error("Typewriter target element not found.");
      return;
    }
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
  });
