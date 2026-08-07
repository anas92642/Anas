// Firebase Live Synchronization Module
window.FirebaseSync = {
    init: function(config) {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
            console.log("Firebase initialized successfully.");
        }
    },
    syncUser: function(userData) {
        if (firebase.apps.length) {
            firebase.database().ref('users/' + userData.id).set(userData);
        }
    }
};

function saveFirebaseConfig(e) {
    e.preventDefault();
    const config = {
        apiKey: document.getElementById('fb-apiKey').value,
        authDomain: document.getElementById('fb-authDomain').value,
        databaseURL: document.getElementById('fb-databaseURL').value,
        projectId: document.getElementById('fb-projectId').value,
    };
    localStorage.setItem('fb_config', JSON.stringify(config));
    window.FirebaseSync.init(config);
    alert('Firebase Configuration Saved & Connected!');
}
