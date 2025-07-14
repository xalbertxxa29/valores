/*
  app.js
  Lógica principal para el sistema de seguimiento de ofrecimientos.
  Versión 3: Mejoras de diseño responsivo para móviles.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- VERIFICACIÓN INICIAL ---
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        console.error("Error: Firebase no está cargado o firebase-config.js falta.");
        alert("Error de configuración. Revisa la consola para más detalles.");
        return;
    }

    // --- INICIALIZACIÓN Y AUTENTICACIÓN DE FIREBASE ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfo = document.getElementById('user-info');
    
    const addClientForm = document.getElementById('add-client-form');
    const clientNameInput = document.getElementById('client-name-input');
    const clientRucInput = document.getElementById('client-ruc-input');
    const clientsContainer = document.getElementById('clients-container');
    const noClientsMessage = document.getElementById('no-clients-message');
    
    let currentUserId = null;
    let clientsListener = null;

    // --- MANEJO DEL ESTADO DE AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            loginView.classList.add('hidden');
            appView.classList.remove('hidden');
            // Ajuste para mostrar ID de forma más corta en móviles
            const userIdHtml = `<span class="hidden sm:inline">Asesor ID:</span> ${user.uid.substring(0, 6)}...`;
            userInfo.innerHTML = userIdHtml;
            loadClients();
        } else {
            currentUserId = null;
            loginView.classList.remove('hidden');
            appView.classList.add('hidden');
            userInfo.textContent = '';
            if (clientsListener) clientsListener();
            clientsContainer.innerHTML = '';
        }
    });

    loginButton.addEventListener('click', () => {
        auth.signInAnonymously().catch(error => {
            console.error("Error en el inicio de sesión anónimo:", error);
        });
    });

    logoutButton.addEventListener('click', () => {
        auth.signOut();
    });

    // --- LÓGICA DE CLIENTES ---

    function loadClients() {
        if (!currentUserId) return;
        const clientsCollection = db.collection('users').doc(currentUserId).collection('clients');
        
        clientsListener = clientsCollection.orderBy("createdAt", "desc").onSnapshot(snapshot => {
            clientsContainer.innerHTML = '';
            noClientsMessage.classList.toggle('hidden', !snapshot.empty);
            snapshot.forEach(doc => {
                const client = { id: doc.id, ...doc.data() };
                const clientCard = createClientCard(client);
                clientsContainer.appendChild(clientCard);
            });
        }, error => {
            console.error("Error al cargar clientes:", error);
        });
    }

    addClientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clientName = clientNameInput.value.trim();
        const clientRuc = clientRucInput.value.trim();
        
        const checkedOfferings = document.querySelectorAll('.valor-agregado-checkbox:checked');
        const newOfferings = Array.from(checkedOfferings).map(checkbox => {
            return {
                name: checkbox.value,
                status: 'Ofrecido',
                progress: 0
            };
        });

        if (clientName && clientRuc && currentUserId) {
            db.collection('users').doc(currentUserId).collection('clients').add({
                name: clientName,
                ruc: clientRuc,
                offerings: newOfferings,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                addClientForm.reset();
            }).catch(error => {
                console.error("Error al añadir cliente:", error);
            });
        }
    });

    // --- LÓGICA DE VISUALIZACIÓN ---

    function createClientCard(client) {
        const card = document.createElement('div');
        // Padding responsivo: p-4 en pantallas pequeñas, p-6 en medianas y grandes
        card.className = 'bg-white p-4 sm:p-6 rounded-xl shadow-lg flex flex-col gap-4 fade-in';
        card.dataset.clientId = client.id;

        const totalOfferings = client.offerings.length;
        const completedOfferings = client.offerings.filter(o => o.status === 'Completado').length;
        const overallProgress = totalOfferings > 0 ? Math.round((completedOfferings / totalOfferings) * 100) : 0;

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-grow pr-4">
                    <h3 class="text-lg font-bold text-gray-900 break-words">${client.name}</h3>
                    <p class="text-sm text-gray-500">RUC: ${client.ruc || 'No especificado'}</p>
                </div>
                <button class="delete-client-btn text-gray-400 hover:text-red-600 transition flex-shrink-0" title="Eliminar Cliente">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
            <div>
                <div class="flex justify-between text-sm font-medium mb-1">
                    <span>Progreso General</span>
                    <span class="text-indigo-600">${overallProgress}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${overallProgress}%"></div>
                </div>
            </div>
            <div class="border-t border-gray-200 pt-4">
                <h4 class="font-semibold mb-3">Ofrecimientos</h4>
                <div class="offerings-list space-y-3">
                    ${client.offerings.map((offering, index) => createOfferingItem(offering, index)).join('') || '<p class="text-xs text-gray-500">No se ofrecieron valores agregados.</p>'}
                </div>
            </div>
        `;

        card.querySelector('.delete-client-btn').addEventListener('click', () => {
            if (confirm(`¿Estás seguro de que quieres eliminar al cliente "${client.name}"?`)) {
                deleteClient(client.id);
            }
        });

        return card;
    }
    
    function createOfferingItem(offering, index) {
        const progress = offering.progress || 0;
        
        const statusColors = {
            'Ofrecido': 'bg-gray-200 text-gray-800',
            'En Progreso': 'bg-blue-200 text-blue-800',
            'Completado': 'bg-green-200 text-green-800',
            'Cancelado': 'bg-red-200 text-red-800'
        };
        const colorClass = statusColors[offering.status] || 'bg-gray-200';

        return `
            <div class="offering-item text-sm" data-index="${index}">
                <div class="flex justify-between items-center mb-1">
                    <p class="font-medium break-words">${offering.name}</p>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass} whitespace-nowrap">
                        ${offering.status}
                    </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${progress}%" title="${progress}% completado"></div>
                </div>
            </div>
        `;
    }

    function deleteClient(clientId) {
        db.collection('users').doc(currentUserId).collection('clients').doc(clientId).delete()
            .catch(error => console.error("Error al eliminar cliente:", error));
    }
});