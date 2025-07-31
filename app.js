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
        alert("Error crítico: La configuración de Firebase no está disponible.");
        return;
    }
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- GLOBAL APP STATE ---
    let currentUserId = null;
    let clientsListener = null;

    const VIGILANCIA_CATEGORY = 'Valores Agregados Vigilancia';
    const TECNOLOGIA_CATEGORY = 'Valores Agregados con Tecnología';
    
    // Lista de ofrecimientos ahora está definida directamente en el código
    const availableOfferings = [
        { name: 'Plan de Responsabilidad Social', category: VIGILANCIA_CATEGORY },
        { name: 'Auditoría Interna', category: VIGILANCIA_CATEGORY },
        { name: 'Reporte de Criminalidad', category: VIGILANCIA_CATEGORY },
        { name: 'LiderControl', category: TECNOLOGIA_CATEGORY },
        { name: 'SmartPanics', category: TECNOLOGIA_CATEGORY },
        { name: 'Integración de plataformas GPS', category: TECNOLOGIA_CATEGORY },
        { name: 'Pulsadores de pánico', category: TECNOLOGIA_CATEGORY },
        { name: 'Configuración de analítica', category: TECNOLOGIA_CATEGORY },
        { name: 'Ciberseguridad', category: TECNOLOGIA_CATEGORY }
    ];
    

    // =================================================================================
    // --- MODULE: UI (Manejo de la Interfaz de Usuario) ---
    // =================================================================================
    const UI = (() => {
        const elements = {
            authView: document.getElementById("auth-view"),
            loginContainer: document.getElementById("login-container"),
            registerContainer: document.getElementById("register-container"),
            loginForm: document.getElementById("login-form"),
            registerForm: document.getElementById("register-form"),
            goToRegisterBtn: document.getElementById("go-to-register"),
            goToLoginBtn: document.getElementById("go-to-login"),
            appView: document.getElementById("app-view"),
            userInfo: document.getElementById("user-info"),
            logoutButton: document.getElementById("logout-button"),
            homeView: document.getElementById("home-view"),
            listView: document.getElementById("list-view"),
            addClientForm: document.getElementById("add-client-form"),
            clientNameInput: document.getElementById("client-name-input"),
            clientRucInput: document.getElementById("client-ruc-input"),
            vigilanciaOfferingsContainer: document.getElementById("vigilancia-offerings-container"),
            tecnologiaOfferingsContainer: document.getElementById("tecnologia-offerings-container"),
            addVigilanciaRowBtn: document.getElementById("add-vigilancia-row-btn"),
            addTecnologiaRowBtn: document.getElementById("add-tecnologia-row-btn"),
            goToPendingBtn: document.getElementById("go-to-pending-btn"),
            goToWonBtn: document.getElementById("go-to-won-btn"),
            listTitle: document.getElementById("list-title"),
            backToHomeBtn: document.getElementById("back-to-home-btn"),
            clientsContainer: document.getElementById("clients-container"),
            noClientsMessage: document.getElementById("no-clients-message"),
            loadingOverlay: document.getElementById("loading-overlay"),
            successModal: document.getElementById("success-modal"),
            successMessage: document.getElementById("success-message"),
            successOkBtn: document.getElementById("success-ok-btn"),
            confirmationModal: document.getElementById("confirmation-modal"),
            modalTitle: document.getElementById("modal-title"),
            modalMessage: document.getElementById("modal-message"),
            modalConfirmBtn: document.getElementById("modal-confirm-btn"),
            modalCancelBtn: document.getElementById("modal-cancel-btn"),
            editClientModal: document.getElementById("edit-client-modal"),
            editClientForm: document.getElementById("edit-client-form"),
            editClientId: document.getElementById("edit-client-id"),
            editClientNameInput: document.getElementById("edit-client-name-input"),
            editClientRucInput: document.getElementById("edit-client-ruc-input"),
            editVigilanciaOfferingsContainer: document.getElementById("edit-vigilancia-offerings-container"),
            editTecnologiaOfferingsContainer: document.getElementById("edit-tecnologia-offerings-container"),
            editAddVigilanciaRowBtn: document.getElementById("edit-add-vigilancia-row-btn"),
            editAddTecnologiaRowBtn: document.getElementById("edit-add-tecnologia-row-btn"),
            closeEditModalBtn: document.getElementById("close-edit-modal-btn"),
            cancelEditBtn: document.getElementById("cancel-edit-btn")
        };

        let resolveConfirmation;

        const showLoading = (show) => elements.loadingOverlay.classList.toggle("hidden", !show);
        const showSuccessModal = (message) => {
            elements.successMessage.textContent = message;
            elements.successModal.classList.remove("hidden");
        };
        const showConfirmationModal = (title, message) => {
            elements.modalTitle.textContent = title;
            elements.modalMessage.textContent = message;
            elements.confirmationModal.classList.remove("hidden");
            return new Promise((resolve) => { resolveConfirmation = resolve; });
        };

        elements.successOkBtn.addEventListener("click", () => elements.successModal.classList.add("hidden"));
        elements.modalConfirmBtn.addEventListener("click", () => {
            elements.confirmationModal.classList.add("hidden");
            if (resolveConfirmation) resolveConfirmation(true);
        });
        elements.modalCancelBtn.addEventListener("click", () => {
            elements.confirmationModal.classList.add("hidden");
            if (resolveConfirmation) resolveConfirmation(false);
        });

        const getAuthErrorMessage = (errorCode) => {
            switch (errorCode) {
                case 'auth/wrong-password': return 'La contraseña es incorrecta.';
                case 'auth/user-not-found': return 'No se encontró ningún usuario con este correo.';
                case 'auth/invalid-email': return 'El formato del correo no es válido.';
                case 'auth/email-already-in-use': return 'Este correo ya está registrado.';
                case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
                default: return 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';
            }
        };

        const createOfferingRow = (category, offeringData = {}) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'offering-row p-3 bg-slate-800/50 rounded-lg space-y-3 relative';
            
            const optionsForCategory = availableOfferings.filter(o => o.category === category);
            
            const selectOptions = optionsForCategory.map(o => 
                `<option value="${o.name}" ${o.name === offeringData.name ? 'selected' : ''}>${o.name}</option>`
            ).join('');

            wrapper.innerHTML = `
                <button type="button" class="remove-offering-row-btn absolute top-2 right-2"><i class="fas fa-trash-alt"></i></button>
                <select class="form-select-sm offering-name"><option value="">Seleccionar...</option>${selectOptions}</select>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input type="number" placeholder="Cantidad" class="form-input-sm offering-quantity" min="1" step="1" value="${offeringData.quantity || 1}">
                    <select class="form-select-sm offering-frequency">
                        <option value="6" ${offeringData.frequency == 6 ? 'selected' : ''}>6 meses</option>
                        <option value="12" ${offeringData.frequency == 12 ? 'selected' : ''}>12 meses</option>
                        <option value="18" ${offeringData.frequency == 18 ? 'selected' : ''}>18 meses</option>
                        <option value="24" ${offeringData.frequency == 24 ? 'selected' : ''}>24 meses</option>
                        <option value="36" ${offeringData.frequency == 36 ? 'selected' : ''}>36 meses</option>
                    </select>
                    <input type="number" placeholder="Costo Mensual S/." class="form-input-sm offering-cost" min="0" step="0.01" value="${offeringData.cost || ''}">
                    <input type="text" placeholder="Total" class="form-input-sm bg-slate-700/80 offering-total" readonly value="S/ ${offeringData.total?.toFixed(2) || '0.00'}">
                </div>
                <input type="hidden" class="offering-category" value="${category}">
            `;
            
            const calculateTotal = (container) => {
                const quantity = parseFloat(container.querySelector('.offering-quantity').value) || 0;
                const frequency = parseFloat(container.querySelector('.offering-frequency').value) || 0;
                const cost = parseFloat(container.querySelector('.offering-cost').value) || 0;
                container.querySelector('.offering-total').value = `S/ ${((cost * quantity) * frequency).toFixed(2)}`;
            };

            wrapper.addEventListener('input', e => {
                if (e.target.matches('.offering-quantity, .offering-frequency, .offering-cost')) {
                    calculateTotal(wrapper);
                }
            });
            wrapper.querySelector('.remove-offering-row-btn').addEventListener('click', () => wrapper.remove());
            
            return wrapper;
        };

        return { elements, showLoading, showSuccessModal, showConfirmationModal, getAuthErrorMessage, createOfferingRow };
    })();

    // =================================================================================
    // --- MODULE: FIRESTORE (Interacciones con la Base de Datos) ---
    // =================================================================================
    const FirestoreService = (() => {
        // fetchOfferings fue eliminado ya que los datos ahora son estáticos.

        const getClients = (userId, statusFilter, callback) => {
            const query = db.collection("users").doc(userId).collection("clients")
                .where("clientStatus", "==", statusFilter)
                .orderBy("createdAt", "desc");

            return query.onSnapshot(callback, error => {
                console.error("Error al cargar clientes:", error);
                const noClientsText = UI.elements.noClientsMessage.querySelector('p');
                noClientsText.textContent = "Error al cargar datos. Verifica tu conexión y los permisos de Firestore.";
                UI.elements.noClientsMessage.classList.remove("hidden");
            });
        };

        const addClient = (userId, clientData) => {
            return db.collection("users").doc(userId).collection("clients").add(clientData);
        };

        const getClient = (userId, clientId) => {
            return db.collection("users").doc(userId).collection("clients").doc(clientId).get();
        };

        const updateClient = (userId, clientId, clientData) => {
            return db.collection("users").doc(userId).collection("clients").doc(clientId).update(clientData);
        };

        const deleteClient = (userId, clientId) => {
            return db.collection("users").doc(userId).collection("clients").doc(clientId).delete();
        };
        
        const markClientAsWon = (userId, clientId) => {
            const clientRef = db.collection("users").doc(userId).collection("clients").doc(clientId);
            return clientRef.update({ clientStatus: "Ganado" });
        };

        return { getClients, addClient, getClient, updateClient, deleteClient, markClientAsWon };
    })();

    // =================================================================================
    // --- MODULE: AUTH (Manejo de Autenticación) ---
    // =================================================================================
    const AuthService = (() => {
        const { elements, showLoading, showSuccessModal, showConfirmationModal, getAuthErrorMessage } = UI;
        
        const init = () => {
            elements.goToRegisterBtn.addEventListener('click', () => {
                elements.loginContainer.classList.add('hidden');
                elements.registerContainer.classList.remove('hidden');
            });

            elements.goToLoginBtn.addEventListener('click', () => {
                elements.registerContainer.classList.add('hidden');
                elements.loginContainer.classList.remove('hidden');
            });

            elements.loginForm.addEventListener('submit', handleLogin);
            elements.registerForm.addEventListener('submit', handleRegister);
            elements.logoutButton.addEventListener("click", () => auth.signOut());

            auth.onAuthStateChanged(handleAuthStateChange);
        };
        
        const handleLogin = (e) => {
            e.preventDefault();
            showLoading(true);
            const email = elements.loginForm['login-email'].value;
            const password = elements.loginForm['login-password'].value;
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => showConfirmationModal("Error de Inicio de Sesión", getAuthErrorMessage(error.code)))
                .finally(() => showLoading(false));
        };

        const handleRegister = (e) => {
            e.preventDefault();
            const email = elements.registerForm['register-email'].value;
            const password = elements.registerForm['register-password'].value;

            if (!email.endsWith('@liderman.com.pe')) {
                showConfirmationModal("Registro No Permitido", "Solo se permite el registro con un correo corporativo (@liderman.com.pe).");
                return;
            }

            showLoading(true);
            auth.createUserWithEmailAndPassword(email, password)
                .then(() => {
                    showSuccessModal("¡Usuario registrado con éxito! Ahora puedes iniciar sesión.");
                    elements.registerForm.reset();
                    elements.goToLoginBtn.click();
                })
                .catch(error => showConfirmationModal("Error de Registro", getAuthErrorMessage(error.code)))
                .finally(() => showLoading(false));
        };
        
        const handleAuthStateChange = (user) => {
            if (user) {
                currentUserId = user.uid;
                elements.authView.classList.add("hidden");
                elements.appView.classList.remove("hidden");
                elements.userInfo.textContent = user.email;
                
                // Ya no se cargan ofrecimientos desde Firestore, se usan los estáticos.
                
                App.showView('home');
                App.initializeForms();

            } else {
                currentUserId = null;
                elements.authView.classList.remove("hidden");
                elements.appView.classList.add("hidden");
                if (clientsListener) clientsListener();
            }
        };

        return { init };
    })();

    // =================================================================================
    // --- MAIN APP LOGIC ---
    // =================================================================================
    const App = (() => {
        const { elements, showLoading, showSuccessModal, showConfirmationModal, createOfferingRow } = UI;
        let currentListType = "pending";

        const init = () => {
            AuthService.init();
            setupEventListeners();
        };
        
        const showView = (viewName) => {
            elements.homeView.classList.toggle('hidden', viewName !== 'home');
            elements.listView.classList.toggle('hidden', viewName !== 'list');
        };
        
        const initializeForms = () => {
            elements.vigilanciaOfferingsContainer.innerHTML = '';
            elements.tecnologiaOfferingsContainer.innerHTML = '';
            elements.editVigilanciaOfferingsContainer.innerHTML = '';
            elements.editTecnologiaOfferingsContainer.innerHTML = '';
        };
        
        const setupEventListeners = () => {
            elements.goToPendingBtn.addEventListener('click', () => navigateToList('pending'));
            elements.goToWonBtn.addEventListener('click', () => navigateToList('won'));
            elements.backToHomeBtn.addEventListener('click', navigateToHome);
            
            elements.addClientForm.addEventListener('submit', handleAddClient);
            elements.addVigilanciaRowBtn.addEventListener('click', () => {
                elements.vigilanciaOfferingsContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
            });
            elements.addTecnologiaRowBtn.addEventListener('click', () => {
                elements.tecnologiaOfferingsContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
            });
            
            elements.clientsContainer.addEventListener('click', handleClientCardActions);

            elements.editClientForm.addEventListener('submit', handleUpdateClient);
            elements.editAddVigilanciaRowBtn.addEventListener('click', () => {
                elements.editVigilanciaOfferingsContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY));
            });
            elements.editAddTecnologiaRowBtn.addEventListener('click', () => {
                elements.editTecnologiaOfferingsContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY));
            });
            elements.closeEditModalBtn.addEventListener('click', closeEditModal);
            elements.cancelEditBtn.addEventListener('click', closeEditModal);
        };
        
        const navigateToList = (type) => {
            currentListType = type;
            elements.listTitle.textContent = type === "pending" ? "Solicitudes Pendientes" : "Clientes Ganados";
            showView('list');
            loadClients();
        };

        const navigateToHome = () => {
            if (clientsListener) {
                clientsListener();
                clientsListener = null;
            }
            showView('home');
        };

        const loadClients = () => {
            if (!currentUserId) return;
            if (clientsListener) clientsListener();

            const statusFilter = currentListType === "pending" ? "Ofrecido" : "Ganado";
            
            clientsListener = FirestoreService.getClients(currentUserId, statusFilter, (snapshot) => {
                elements.clientsContainer.innerHTML = "";
                const noClientsText = elements.noClientsMessage.querySelector('p');

                if (snapshot.empty) {
                    noClientsText.textContent = currentListType === 'pending' ? 'No hay solicitudes pendientes.' : 'Aún no hay clientes ganados.';
                    elements.noClientsMessage.classList.remove('hidden');
                } else {
                    elements.noClientsMessage.classList.add('hidden');
                }

                let delay = 0;
                snapshot.forEach((doc) => {
                    const client = { id: doc.id, ...doc.data() };
                    const clientCard = createClientCard(client);
                    clientCard.style.animationDelay = `${delay}ms`;
                    elements.clientsContainer.appendChild(clientCard);
                    delay += 100;
                });
            });
        };

        const getOfferingsFromForm = (container) => {
            return Array.from(container.querySelectorAll('.offering-row')).map(row => {
                const quantity = parseInt(row.querySelector('.offering-quantity').value) || 0;
                const frequency = parseInt(row.querySelector('.offering-frequency').value) || 0;
                const cost = parseFloat(row.querySelector('.offering-cost').value) || 0;
                return {
                    name: row.querySelector('.offering-name').value,
                    category: row.querySelector('.offering-category').value,
                    status: 'Ofrecido',
                    progress: 0,
                    quantity,
                    frequency,
                    cost,
                    total: (cost * quantity) * frequency
                };
            }).filter(offer => offer.name);
        };

        const handleAddClient = async (e) => {
            e.preventDefault();
            const clientName = elements.clientNameInput.value.trim();
            const clientRuc = elements.clientRucInput.value.trim();
            if (!clientName || !clientRuc) {
                showConfirmationModal("Datos Incompletos", "Por favor, complete el nombre y RUC del cliente.");
                return;
            }

            showLoading(true);
            const vigilanciaOfferings = getOfferingsFromForm(elements.vigilanciaOfferingsContainer);
            const tecnologiaOfferings = getOfferingsFromForm(elements.tecnologiaOfferingsContainer);
            const allOfferings = [...vigilanciaOfferings, ...tecnologiaOfferings];

            try {
                await FirestoreService.addClient(currentUserId, {
                    name: clientName,
                    ruc: clientRuc,
                    clientStatus: "Ofrecido",
                    offerings: allOfferings,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    creadoPor: auth.currentUser.email
                });
                elements.addClientForm.reset();
                initializeForms();
                showSuccessModal("Cliente agregado a Solicitudes Pendientes.");
            } catch (error) {
                console.error("Error al añadir cliente:", error);
                showConfirmationModal("Error", "No se pudo agregar el cliente. Inténtelo de nuevo.");
            } finally {
                showLoading(false);
            }
        };

        const handleClientCardActions = (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const card = e.target.closest('.client-card');
            const clientId = card.dataset.clientId;

            if(button.classList.contains('delete-client-btn')) {
                const clientName = card.querySelector('h3').textContent;
                handleDeleteClient(clientId, clientName);
            } else if (button.classList.contains('mark-as-won-btn')) {
                handleMarkAsWon(clientId);
            } else if (button.classList.contains('edit-client-btn')) {
                handleOpenEditModal(clientId);
            }
        };

        const handleDeleteClient = async (clientId, clientName) => {
            const confirmed = await showConfirmationModal("Eliminar Cliente", `¿Seguro que quieres eliminar a "${clientName}"? Esta acción es irreversible.`);
            if (confirmed) {
                showLoading(true);
                try {
                    await FirestoreService.deleteClient(currentUserId, clientId);
                    showSuccessModal(`Cliente "${clientName}" eliminado correctamente.`);
                } catch (error) {
                    console.error("Error al eliminar:", error);
                    showConfirmationModal("Error", "No se pudo eliminar el cliente. Inténtelo de nuevo.");
                } finally {
                    showLoading(false);
                }
            }
        };

        const handleMarkAsWon = async (clientId) => {
            showLoading(true);
            try {
                await FirestoreService.markClientAsWon(currentUserId, clientId);
                showSuccessModal("¡Cliente marcado como Ganado!");
            } catch (error) {
                console.error("Error al marcar como ganado:", error);
                showConfirmationModal("Error", "No se pudo actualizar el estado del cliente.");
            } finally {
                showLoading(false);
            }
        };

        const handleOpenEditModal = async (clientId) => {
            showLoading(true);
            try {
                const doc = await FirestoreService.getClient(currentUserId, clientId);
                if (!doc.exists) throw new Error("Client not found");
                
                const clientData = doc.data();
                elements.editClientId.value = clientId;
                elements.editClientNameInput.value = clientData.name;
                elements.editClientRucInput.value = clientData.ruc;
                
                initializeForms();

                if(clientData.offerings && clientData.offerings.length > 0) {
                    clientData.offerings.forEach(offer => {
                        if (offer.category === VIGILANCIA_CATEGORY) {
                            elements.editVigilanciaOfferingsContainer.appendChild(createOfferingRow(VIGILANCIA_CATEGORY, offer));
                        } else if (offer.category === TECNOLOGIA_CATEGORY) {
                            elements.editTecnologiaOfferingsContainer.appendChild(createOfferingRow(TECNOLOGIA_CATEGORY, offer));
                        }
                    });
                }
                elements.editClientModal.classList.remove('hidden');
            } catch (error) {
                console.error("Error opening edit modal:", error);
                showConfirmationModal("Error", "No se pudieron cargar los datos del cliente para editar.");
            } finally {
                showLoading(false);
            }
        };
        
        const closeEditModal = () => {
            elements.editClientModal.classList.add('hidden');
            elements.editClientForm.reset();
        };

        const handleUpdateClient = async (e) => {
            e.preventDefault();
            const clientId = elements.editClientId.value;
            const vigilanciaOfferings = getOfferingsFromForm(elements.editVigilanciaOfferingsContainer);
            const tecnologiaOfferings = getOfferingsFromForm(elements.editTecnologiaOfferingsContainer);
            const allOfferings = [...vigilanciaOfferings, ...tecnologiaOfferings];

            const updatedData = {
                name: elements.editClientNameInput.value.trim(),
                ruc: elements.editClientRucInput.value.trim(),
                offerings: allOfferings
            };

            if(!updatedData.name || !updatedData.ruc){
                showConfirmationModal("Datos Incompletos", "El nombre y RUC no pueden estar vacíos.");
                return;
            }

            showLoading(true);
            try {
                await FirestoreService.updateClient(currentUserId, clientId, updatedData);
                closeEditModal();
                showSuccessModal("Cliente actualizado correctamente.");
            } catch (error) {
                console.error("Error al actualizar cliente:", error);
                showConfirmationModal("Error", "No se pudo guardar los cambios. Inténtelo de nuevo.");
            } finally {
                showLoading(false);
            }
        };

        const createClientCard = (client) => {
            const card = document.createElement("div");
            card.className = "glass-card p-4 sm:p-6 flex flex-col gap-4 card-enter-animation client-card";
            card.dataset.clientId = client.id;

            const isPending = client.clientStatus === 'Ofrecido';
            
            const actionButtonsHTML = isPending ? `
                <div class="flex flex-col sm:flex-row gap-2 mt-4">
                    <button class="btn-primary mark-as-won-btn flex-1">Marcar como Ganado</button>
                    <button class="btn-secondary edit-client-btn flex-1">Editar</button>
                </div>
                ` : `<div class="flex gap-2 mt-4"><button class="btn-secondary edit-client-btn w-full">Ver/Editar</button></div>`;

            const offeringsByCat = (client.offerings || []).reduce((acc, offer) => {
                const cat = offer.category || 'General';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(offer);
                return acc;
            }, {});

            const offeringsHTML = Object.keys(offeringsByCat).length > 0
                ? Object.entries(offeringsByCat).map(([category, offers]) => `
                    <div class="mt-2">
                        <h5 class="text-sm font-semibold text-slate-300 mb-2">${category}</h5>
                        <div class="space-y-2">
                            ${offers.map(createOfferingDisplayItem).join('')}
                        </div>
                    </div>
                `).join('')
                : '<p class="text-xs text-slate-500">Sin ofrecimientos registrados.</p>';

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-grow pr-4">
                        <h3 class="text-lg font-bold text-white break-words">${client.name}</h3>
                        <p class="text-sm text-slate-400">RUC: ${client.ruc || "N/A"}</p>
                    </div>
                    <button class="delete-client-btn text-slate-400 hover:text-red-500 transition">
                         <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="border-t border-slate-700 pt-3">
                    <h4 class="font-semibold mb-1 text-white">Ofrecimientos</h4>
                    ${offeringsHTML}
                </div>
                ${actionButtonsHTML}`;
            
            return card;
        };

        const createOfferingDisplayItem = (offering) => {
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
                        <span>Total: <strong class="total-amount">S/ ${Number(offering.total || 0).toFixed(2)}</strong></span>
                    </div>
                </div>`;
        };

        return { init, showView, initializeForms };
    })();

    App.init();
});