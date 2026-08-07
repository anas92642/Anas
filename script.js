// App State Management
let users = JSON.parse(localStorage.getItem('sys_users')) || [
    { id: '1', name: 'Demo User', phone: '03001234567', blocked: false, pass: '123456' }
];
let chatMessages = JSON.parse(localStorage.getItem('sys_chats')) || {};
let activeChatUser = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    renderUsersList();
    renderChatThreads();
});

// Toast Notification
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// User Sign Up / Login
function handleAuth(e) {
    e.preventDefault();
    const name = document.getElementById('user-name').value;
    const phone = document.getElementById('user-phone').value;
    const pass = document.getElementById('user-password').value;

    let user = users.find(u => u.phone === phone);
    if (user) {
        if (user.blocked) {
            alert('Your account is blocked by the Admin!');
            return;
        }
        currentUser = user;
        showToast(`🟢 User logged in: ${user.name} (${user.phone})`);
    } else {
        user = { id: Date.now().toString(), name, phone, pass, blocked: false };
        users.push(user);
        currentUser = user;
        saveUsers();
        showToast(`🟢 New user registered: ${name} (${phone})`);
    }

    document.getElementById('user-status-display').innerText = `Logged in as: ${user.name}`;
    toggleAuthModal();
    renderUsersList();
    
    if (window.FirebaseSync) {
        window.FirebaseSync.syncUser(user);
    }
}

function saveUsers() {
    localStorage.setItem('sys_users', JSON.stringify(users));
}

function renderUsersList() {
    const list = document.getElementById('users-list');
    list.innerHTML = '';
    users.forEach(u => {
        const item = document.createElement('div');
        item.className = `user-card ${u.blocked ? 'blocked' : ''}`;
        item.innerHTML = `
            <div>
                <strong>${u.name}</strong> <small>(${u.phone})</small>
                <div><small>Status: ${u.blocked ? '🔴 Blocked' : '🟢 Active'}</small></div>
            </div>
            <div class="user-actions">
                <button onclick="toggleBlockUser('${u.id}')" class="${u.blocked ? 'btn-accent' : 'btn-danger'}">
                    ${u.blocked ? 'Unblock' : 'Block'}
                </button>
                <button onclick="resetPassword('${u.id}')" class="btn-primary">🔑 Pass</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function toggleBlockUser(id) {
    const u = users.find(x => x.id === id);
    if (u) {
        u.blocked = !u.blocked;
        saveUsers();
        renderUsersList();
        showToast(`User ${u.name} status updated: ${u.blocked ? 'Blocked' : 'Active'}`);
    }
}

function resetPassword(id) {
    const u = users.find(x => x.id === id);
    if (u) {
        const newPass = prompt(`Enter new password for ${u.name}:`);
        if (newPass) {
            u.pass = newPass;
            saveUsers();
            alert('Password updated successfully!');
        }
    }
}

// Support Chat Logic
function toggleUserChat() {
    document.getElementById('user-chat-window').classList.toggle('hidden');
}

function sendUserMessage() {
    const input = document.getElementById('user-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const sender = currentUser ? currentUser.phone : 'Guest';
    if (!chatMessages[sender]) chatMessages[sender] = [];
    
    chatMessages[sender].push({ sender: 'user', text: msg, time: new Date().toLocaleTimeString() });
    input.value = '';
    
    // AI Stand-In Response
    setTimeout(() => {
        chatMessages[sender].push({ sender: 'admin', text: '🤖 Auto-Support: Thanks for contacting us. An agent will be with you shortly.', time: new Date().toLocaleTimeString() });
        saveChats();
        renderUserMessages(sender);
        renderChatThreads();
    }, 1000);

    saveChats();
    renderUserMessages(sender);
    renderChatThreads();
}

function renderUserMessages(userKey) {
    const box = document.getElementById('user-chat-messages');
    box.innerHTML = '';
    (chatMessages[userKey] || []).forEach(m => {
        const div = document.createElement('div');
        div.className = `message ${m.sender === 'user' ? 'sent' : 'received'}`;
        div.innerText = m.text;
        box.appendChild(div);
    });
}

function renderChatThreads() {
    const threads = document.getElementById('chat-threads');
    threads.innerHTML = '';
    Object.keys(chatMessages).forEach(k => {
        const div = document.createElement('div');
        div.className = `thread-item ${activeChatUser === k ? 'active' : ''}`;
        div.innerText = `User: ${k}`;
        div.onclick = () => selectChatThread(k);
        threads.appendChild(div);
    });
}

function selectChatThread(k) {
    activeChatUser = k;
    renderChatThreads();
    const box = document.getElementById('chat-messages');
    box.innerHTML = '';
    (chatMessages[k] || []).forEach(m => {
        const div = document.createElement('div');
        div.className = `message ${m.sender === 'admin' ? 'sent' : 'received'}`;
        div.innerText = m.text;
        box.appendChild(div);
    });
}

function sendAdminMessage() {
    if (!activeChatUser) return alert('Select a chat thread first!');
    const input = document.getElementById('admin-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    chatMessages[activeChatUser].push({ sender: 'admin', text: msg, time: new Date().toLocaleTimeString() });
    input.value = '';
    saveChats();
    selectChatThread(activeChatUser);
}

function saveChats() {
    localStorage.setItem('sys_chats', JSON.stringify(chatMessages));
}

function toggleAuthModal() {
    document.getElementById('auth-modal').classList.toggle('hidden');
}
