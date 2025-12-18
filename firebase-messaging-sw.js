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
    icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png', // Icono grande
    badge: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png', // Icono pequeño (barra de estado)
    vibrate: [200, 100, 200, 100, 200], // Patrón de vibración: vibra-pausa-vibra...
    tag: 'renotify', // Etiqueta para agrupar
    renotify: true, // ¡Importante! Hace que vibre de nuevo aunque ya tengas una notificación
    data: {
      url: '/pruebasdenotificaciones/' // La dirección de tu app para abrirla
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Evento para abrir la app cuando tocas la notificación
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si la app ya está abierta, la enfoca
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('pruebasdenotificaciones') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no, abre una nueva ventana
      if (clients.openWindow) {
        return clients.openWindow('/pruebasdenotificaciones/');
      }
    })
  );
});
