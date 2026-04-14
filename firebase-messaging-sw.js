importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBI9wyQgO_dyR2orKWf-nCUrTSgtGRYlTE",
  authDomain: "pruebasdenotificaciones.firebaseapp.com",
  projectId: "pruebasdenotificaciones",
  storageBucket: "pruebasdenotificaciones.firebasestorage.app",
  messagingSenderId: "485180408072",
  appId: "1:485180408072:web:8641530e583236ead82cbd",
  measurementId: "G-SQRXFH23ZG"
};


firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Notificación en background:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png', 
    badge: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png', 
    vibrate: [200, 100, 200, 100, 200], 
    tag: 'renotify', 
    renotify: true, 
    data: {
      url: '/pruebasdenotificaciones/' 
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('pruebasdenotificaciones') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/pruebasdenotificaciones/');
      }
    })
  );
});
