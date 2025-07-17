document.addEventListener("DOMContentLoaded", () => {
    // PWA Service Worker Registration
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js")
                .then((reg) => console.log("Service Worker: Registrado"))
                .catch((err) => console.log(`Service Worker: Error: ${err}`));
        });
    }

    // Firebase Initialization
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        console.error("Firebase no está cargado o la configuración falta.");
        alert("Error de configuración de Firebase.");
        return;
    }
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- REFERENCIAS AL DOM (ACTUALIZADAS) ---
    const loginView = document.getElementById("login-view");
    const appView = document.getElementById("app-view");
    const loginButton = document.getElementById("login-button");
    const logoutButton = document.getElementById("logout-button");
    const userInfo = document.getElementById("user-info");

    // Vistas principales
    const homeView = document.getElementById("home-view");
    const listView = document.getElementById("list-view");

    // Elementos de la vista de inicio
    const addClientForm = document.getElementById("add-client-form");
    const clientNameInput = document.getElementById("client-name-input");
    const clientRucInput = document.getElementById("client-ruc-input");
    const offeringsContainer = document.getElementById("offerings-container");
    const goToPendingBtn = document.getElementById("go-to-pending-btn");
    const goToWonBtn = document.getElementById("go-to-won-btn");

    // Elementos de la vista de listas
    const listTitle = document.getElementById("list-title");
    const backToHomeBtn = document.getElementById("back-to-home-btn");
    const clientsContainer = document.getElementById("clients-container");
    const noClientsMessage = document.getElementById("no-clients-message");

    // Modals y Overlays
    const loadingOverlay = document.getElementById("loading-overlay");
    const successModal = document.getElementById("success-modal");
    const successMessage = document.getElementById("success-message");
    const successOkBtn = document.getElementById("success-ok-btn");
    const confirmationModal = document.getElementById("confirmation-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalConfirmBtn = document.getElementById("modal-confirm-btn");
    const modalCancelBtn = document.getElementById("modal-cancel-btn");

    // App State
    let currentUserId = null;
    let clientsListener = null;
    let currentListType = "pending";
    let resolveConfirmation;

    const availableOfferings = {
        "Valores Agregados": ["Plan de Responsabilidad Social", "Auditoría Interna", "Reporte de Criminalidad"],
        "Valores Agregados con Tecnología": ["LiderControl", "SmartPanics", "Integración de plataformas GPS", "Pulsadores de pánico", "Configuración de analítica", "Ciberseguridad"]
    };

    // --- LÓGICA DE NAVEGACIÓN ---
    function showView(viewName) {
        homeView.classList.toggle('hidden', viewName !== 'home');
        listView.classList.toggle('hidden', viewName !== 'list');
    }

    goToPendingBtn.addEventListener('click', () => {
        currentListType = "pending";
        listTitle.textContent = "Solicitudes Pendientes";
        showView('list');
        loadClients();
    });

    goToWonBtn.addEventListener('click', () => {
        currentListType = "won";
        listTitle.textContent = "Clientes Ganados";
        showView('list');
        loadClients();
    });

    backToHomeBtn.addEventListener('click', () => {
        if (clientsListener) {
            clientsListener(); // Detiene la escucha de datos para ahorrar recursos
            clientsListener = null;
        }
        showView('home');
    });

    // --- LÓGICA DE MODALES Y OVERLAYS ---
    const showLoading = (show) => loadingOverlay.classList.toggle("hidden", !show);
    const showSuccessModal = (message) => {
        successMessage.textContent = message;
        successModal.classList.remove("hidden");
    };
    successOkBtn.addEventListener("click", () => successModal.classList.add("hidden"));
    
    const showConfirmationModal = (title, message) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmationModal.classList.remove("hidden");
        return new Promise((resolve) => { resolveConfirmation = resolve; });
    };
    modalConfirmBtn.addEventListener("click", () => {
        confirmationModal.classList.add("hidden");
        if (resolveConfirmation) resolveConfirmation(true);
    });
    modalCancelBtn.addEventListener("click", () => {
        confirmationModal.classList.add("hidden");
        if (resolveConfirmation) resolveConfirmation(false);
    });

    // --- LÓGICA DE AUTENTICACIÓN ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserId = user.uid;
            loginView.classList.add("hidden");
            appView.classList.remove("hidden");
            userInfo.innerHTML = `<span class="hidden sm:inline">Asesor ID:</span> ${user.uid.substring(0, 6)}...`;
            initializeForm();
            showView('home'); // Siempre empezar en la vista de inicio
        } else {
            currentUserId = null;
            loginView.classList.remove("hidden");
            appView.classList.add("hidden");
            if (clientsListener) clientsListener();
        }
    });

    loginButton.addEventListener("click", () => auth.signInAnonymously().catch(console.error));
    logoutButton.addEventListener("click", () => {
        auth.signOut();
        showView('home'); // Al cerrar sesión, volver a la vista de inicio (que estará oculta)
    });

    // --- LÓGICA PRINCIPAL DE DATOS ---
    function loadClients() {
        if (!currentUserId) return;
        if (clientsListener) clientsListener();

        const statusFilter = currentListType === "pending" ? "Ofrecido" : "Ganado";
        let query = db.collection("users").doc(currentUserId).collection("clients")
            .where("clientStatus", "==", statusFilter)
            .orderBy("createdAt", "desc");

        clientsListener = query.onSnapshot((snapshot) => {
            clientsContainer.innerHTML = "";
            const noClientsText = noClientsMessage.querySelector('p');
            
            if (snapshot.empty) {
                noClientsText.textContent = currentListType === 'pending' 
                    ? 'No hay solicitudes pendientes.' 
                    : 'Aún no hay clientes ganados.';
                noClientsMessage.classList.remove('hidden');
            } else {
                noClientsMessage.classList.add('hidden');
            }

            let delay = 0;
            snapshot.forEach((doc) => {
                const client = { id: doc.id, ...doc.data() };
                const clientCard = createClientCard(client);
                clientCard.style.animationDelay = `${delay}ms`;
                clientsContainer.appendChild(clientCard);
                delay += 100;
            });
        }, (error) => {
            console.error("Error al cargar clientes:", error);
            noClientsMessage.querySelector('p').textContent = "Error al cargar datos. ¿Creaste el índice en Firebase?";
            noClientsMessage.classList.remove("hidden");
        });
    }

    addClientForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        showLoading(true);

        const clientName = clientNameInput.value.trim();
        const clientRuc = clientRucInput.value.trim();
        const checkedOfferings = offeringsContainer.querySelectorAll(".valor-agregado-checkbox:checked");
        
        const newOfferings = Array.from(checkedOfferings).map(checkbox => {
            const details = checkbox.closest('.offering-item-wrapper').querySelector('.offering-details');
            const quantity = details.querySelector(".offering-quantity").value || 0;
            const frequency = details.querySelector(".offering-frequency").value || 0;
            const cost = details.querySelector(".offering-cost").value || 0;
            return {
                name: checkbox.value, status: 'Ofrecido', progress: 0,
                quantity: parseInt(quantity), frequency: parseInt(frequency),
                cost: parseFloat(cost), total: (parseFloat(cost) * parseInt(quantity)) * parseInt(frequency)
            };
        });

        if (!clientName || !clientRuc) {
            showLoading(false);
            return;
        }

        try {
            await db.collection("users").doc(currentUserId).collection("clients").add({
                name: clientName, ruc: clientRuc,
                clientStatus: "Ofrecido", offerings: newOfferings,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            addClientForm.reset();
            offeringsContainer.querySelectorAll(".offering-details").forEach(d => d.classList.add("hidden"));
            showSuccessModal("Cliente agregado a Solicitudes Pendientes.");
        } catch (error) {
            console.error("Error al añadir cliente:", error);
            showConfirmationModal("Error", "No se pudo agregar el cliente.");
        } finally {
            showLoading(false);
        }
    });

    function createClientCard(client) {
        const card = document.createElement("div");
        card.className = "glass-card p-4 sm:p-6 flex flex-col gap-4 card-enter-animation";
        card.dataset.clientId = client.id;
        
        const isPending = client.clientStatus === 'Ofrecido';
        const progress = client.offerings.length > 0 ? Math.round((client.offerings.filter(o => o.status === 'Completado').length / client.offerings.length) * 100) : 0;
        
        const progressHTML = !isPending ? `
            <div>
                <div class="flex justify-between text-sm font-medium mb-1 text-slate-300">
                    <span>Progreso General</span>
                    <span class="text-cyan-400">${progress}%</span>
                </div>
                <div class="w-full bg-slate-700 rounded-full h-2.5">
                    <div class="bg-cyan-500 h-2.5 rounded-full" style="width: ${progress}%"></div>
                </div>
            </div>` : '';
            
        const actionButtonHTML = isPending ? `<button class="btn-primary mark-as-won-btn mt-4 w-full">Marcar como Ganado</button>` : '';

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-grow pr-4">
                    <h3 class="text-lg font-bold text-white break-words">${client.name}</h3>
                    <p class="text-sm text-slate-400">RUC: ${client.ruc || "N/A"}</p>
                </div>
                <button class="delete-client-btn text-slate-400 hover:text-red-500 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
            </div>
            ${progressHTML}
            <div class="border-t border-slate-700 pt-4">
                <h4 class="font-semibold mb-3 text-white">Ofrecimientos</h4>
                <div class="offerings-list space-y-3">
                    ${client.offerings.map(createOfferingItem).join('') || '<p class="text-xs text-slate-500">Sin ofrecimientos.</p>'}
                </div>
            </div>
            ${actionButtonHTML}`;

        card.querySelector(".delete-client-btn").addEventListener("click", () => deleteClient(client.id, client.name));
        if (isPending) {
            card.querySelector(".mark-as-won-btn").addEventListener("click", () => markClientAsWon(client.id));
        }

        return card;
    }

    function createOfferingItem(offering) {
        return `
            <div class="offering-display-item">
                <div class="flex justify-between items-center mb-2">
                    <p class="font-bold break-words">${offering.name}</p>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-300 text-slate-800">${offering.status}</span>
                </div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span>Cantidad: <strong>${offering.quantity} und.</strong></span>
                    <span>Frecuencia: <strong>${offering.frequency} meses</strong></span>
                    <span>Costo Mensual: <strong>S/ ${Number(offering.cost || 0).toFixed(2)}</strong></span>
                    <span>Total: <strong class="text-cyan-400">S/ ${Number(offering.total || 0).toFixed(2)}</strong></span>
                </div>
            </div>`;
    }
    
    async function markClientAsWon(clientId) {
        showLoading(true);
        try {
            const clientRef = db.collection("users").doc(currentUserId).collection("clients").doc(clientId);
            await clientRef.update({ clientStatus: "Ganado" });
        } catch (error) { console.error("Error al marcar como ganado:", error); } 
        finally { showLoading(false); }
    }

    async function deleteClient(clientId, clientName) {
        const confirmed = await showConfirmationModal("Eliminar Cliente",`¿Seguro que quieres eliminar a "${clientName}"?`);
        if (confirmed) {
            showLoading(true);
            try {
                await db.collection("users").doc(currentUserId).collection("clients").doc(clientId).delete();
            } catch (error) { console.error("Error al eliminar:", error); } 
            finally { showLoading(false); }
        }
    }

    // Form Initialization and Helpers
    function initializeForm() {
        offeringsContainer.innerHTML = Object.entries(availableOfferings).map(([category, items]) => `
            <div class="space-y-3">
                <h3 class="text-md font-semibold text-white">${category}</h3>
                ${items.map(item => createFormOfferingItem(item)).join('')}
            </div>`).join('');
    }

    function createFormOfferingItem(name) {
        return `
            <div class="offering-item-wrapper">
                <label class="inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="form-checkbox valor-agregado-checkbox" value="${name}">
                    <span class="ml-2 text-slate-300">${name}</span>
                </label>
                <div class="offering-details hidden mt-2 ml-6 p-3 bg-slate-800/50 rounded-lg space-y-2">
                    <input type="number" placeholder="Cantidad" class="form-input-sm offering-quantity" min="1" step="1">
                    <select class="form-input-sm offering-frequency"><option value="6">6 meses</option><option value="12">12 meses</option><option value="18">18 meses</option><option value="24">24 meses</option><option value="36">36 meses</option></select>
                    <input type="number" placeholder="Costo Mensual S/." class="form-input-sm offering-cost" min="0" step="0.01">
                    <input type="text" placeholder="Total" class="form-input-sm bg-slate-700/80 offering-total" readonly>
                </div>
            </div>`;
    }

    offeringsContainer.addEventListener('input', (e) => {
        if (e.target.matches('.offering-quantity, .offering-frequency, .offering-cost')) {
            calculateTotal(e.target.closest('.offering-details'));
        }
    });

    offeringsContainer.addEventListener('change', (e) => {
        if (e.target.matches('.valor-agregado-checkbox')) {
            const details = e.target.closest('.offering-item-wrapper').querySelector('.offering-details');
            details.classList.toggle('hidden', !e.target.checked);
        }
    });

    function calculateTotal(detailsContainer) {
        const quantity = parseFloat(detailsContainer.querySelector('.offering-quantity').value) || 0;
        const frequency = parseFloat(detailsContainer.querySelector('.offering-frequency').value) || 0;
        const cost = parseFloat(detailsContainer.querySelector('.offering-cost').value) || 0;
        const totalField = detailsContainer.querySelector('.offering-total');
        totalField.value = `S/ ${((cost * quantity) * frequency).toFixed(2)}`;
    }
});
