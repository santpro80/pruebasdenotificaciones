const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// 1. Notificar al VENDEDOR cuando entra un pedido nuevo
exports.notificarVendedor = functions.firestore
    .document('pedidos/{pedidoId}')
    .onCreate(async (snapshot, context) => {
        const pedido = snapshot.data();
        
        // Buscamos el token del vendedor en la base de datos
        const vendedorDoc = await admin.firestore().collection('usuarios').doc('vendedor').get();
        const tokenVendedor = vendedorDoc.data()?.token;

        if (!tokenVendedor) {
            console.log("No se encontró token para el vendedor.");
            return;
        }

        const payload = {
            notification: {
                title: '¡Nueva Venta! 💰',
                body: `Alguien quiere comprar: ${pedido.producto}`,
            },
            webpush: {
                fcm_options: {
                    link: 'https://santpro80.github.io/pruebasdenotificaciones/'
                },
                notification: {
                    icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png'
                }
            },
            token: tokenVendedor
        };

        // Enviar la notificación
        return admin.messaging().send(payload);
    });

// 2. Notificar al COMPRADOR cuando le aprueban el pedido
exports.notificarComprador = functions.firestore
    .document('pedidos/{pedidoId}')
    .onUpdate(async (change, context) => {
        const nuevoDato = change.after.data();
        const datoAnterior = change.before.data();

        // Solo si el estado cambió a 'aprobado'
        if (nuevoDato.estado === 'aprobado' && datoAnterior.estado !== 'aprobado') {
            
            // Buscamos el token del comprador
            const compradorDoc = await admin.firestore().collection('usuarios').doc('comprador').get();
            const tokenComprador = compradorDoc.data()?.token;

            if (!tokenComprador) {
                console.log("No se encontró token para el comprador.");
                return;
            }

            const payload = {
                notification: {
                    title: '¡Pedido Aprobado! ✅',
                    body: `El vendedor aprobó tu compra de ${nuevoDato.producto}.`,
                },
                webpush: {
                    fcm_options: {
                        link: 'https://santpro80.github.io/pruebasdenotificaciones/'
                    },
                    notification: {
                        icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041888.png'
                    }
                },
                token: tokenComprador
            };

            return admin.messaging().send(payload);
        }
    });
