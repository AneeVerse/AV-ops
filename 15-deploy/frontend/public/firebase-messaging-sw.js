importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyC9R-m3tyhMMwxQbJJ9-bYzFjn6UN1zeu4",
    authDomain: "storx-network.firebaseapp.com",
    projectId: "storx-network",
    storageBucket: "storx-network.firebasestorage.app",
    messagingSenderId: "220941885214",
    appId: "1:220941885214:web:82889b14327943b49bb30f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/Logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
