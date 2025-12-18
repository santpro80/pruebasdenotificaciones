const firebaseConfig = {
  apiKey: "AIzaSyBI9wyQgO_dyR2orKWf-nCUrTSgtGRYlTE",
  authDomain: "pruebasdenotificaciones.firebaseapp.com",
  projectId: "pruebasdenotificaciones",
  storageBucket: "pruebasdenotificaciones.firebasestorage.app",
  messagingSenderId: "485180408072",
  appId: "1:485180408072:web:8641530e583236ead82cbd",
  measurementId: "G-SQRXFH23ZG"
};

const VAPID_KEY = "BO1LcpIOKR6MdxwwH5nPZf5r1bJgiYu0FHX-rMYsAg1YfxkW8UxcYJPVT5EZr4v-0-dUOsIaRTX0mSynBLZV3Js";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const messaging = firebase.messaging();

let rolUsuario = '';

function iniciarApp(rol) {
    rolUsuario = rol;
    document.getElementById('login-screen').classList.add('hidden');
    
    if (rol === 'comprador') {
        document.getElementById('comprador-screen').classList.remove('hidden');
    } else {
        document.getElementById('vendedor-screen').classList.remove('hidden');
        escucharPedidos(); 
    }

    
    Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
            console.log('Permiso concedido');
            obtenerToken();
        }
    });
}

function obtenerToken() {
    messaging.getToken({ vapidKey: VAPID_KEY }).then((currentToken) => {
        if (currentToken) {
            console.log('Token:', currentToken);
            document.getElementById('token-text').innerText = currentToken;
            
            
            db.collection('usuarios').doc(rolUsuario).set({
                token: currentToken,
                fecha: new Date()
            });
        } else {
            console.log('No se pudo obtener token.');
        }
    }).catch((err) => {
        console.log('Error al obtener token: ', err);
    });
}

function hacerPedido() {
    db.collection('pedidos').add({
        producto: 'Zapatillas Running',
        comprador: 'Usuario Demo',
        estado: 'pendiente',
        fecha: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('Pedido enviado al vendedor!');
        document.getElementById('estado-pedido').innerHTML = '<p>⏳ Esperando aprobación...</p>';
        escucharMisPedidos(); 
    });
}

function escucharMisPedidos() {
    db.collection('pedidos').orderBy('fecha', 'desc').limit(1)
      .onSnapshot((snapshot) => {
          snapshot.forEach(doc => {
              const data = doc.data();
              if (data.estado === 'aprobado') {
                  document.getElementById('estado-pedido').innerHTML = '<p style="color:green">✅ ¡Tu pedido fue APROBADO!</p>';
                  alert('¡Tu pedido fue aprobado!');
              }
          });
      });
}

function escucharPedidos() {
    db.collection('pedidos').where('estado', '==', 'pendiente')
      .onSnapshot((snapshot) => {
          const lista = document.getElementById('lista-pedidos');
          lista.innerHTML = '';
          
          if(snapshot.empty) { lista.innerHTML = 'No hay pedidos pendientes.'; }

          snapshot.forEach(doc => {
              const data = doc.data();
              const div = document.createElement('div');
              div.className = 'card';
              div.innerHTML = `
                <p><strong>${data.producto}</strong> - Cliente: ${data.comprador}</p>
                <button class="btn btn-approve" onclick="aprobar('${doc.id}')">Aprobar Pedido</button>
              `;
              lista.appendChild(div);
          });
      });
}

function aprobar(id) {
    db.collection('pedidos').doc(id).update({
        estado: 'aprobado'
    });
}

messaging.onMessage((payload) => {
    console.log('Mensaje recibido: ', payload);
    alert(`🔔 NOTIFICACIÓN: ${payload.notification.title}\n${payload.notification.body}`);
});
