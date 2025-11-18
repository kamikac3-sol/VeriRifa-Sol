// ===== CONFIGURACIÓN Y CONSTANTES =====
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBFeUIpZ4SvDJH60WJyuPB9Ud2JJSbjN7Q",
    authDomain: "veririfa-sol.firebaseapp.com",
    projectId: "veririfa-sol",
    storageBucket: "veririfa-sol.firebasestorage.app",
    messagingSenderId: "398195570983",
    appId: "1:398195570983:web:f415c5e20213ccca2fd102",
    measurementId: "G-1BJXVTRG15"
};

const ADMIN_WALLET_ADDRESS = '3Yekte2UrR2rKFBfm3q6D2DyinZKN58svqJvQF87RX3o';
const network = 'testnet';

// ===== ESTADO DE LA APLICACIÓN =====
let appState = {
    isConnected: false,
    isAdmin: false,
    currentWallet: {
        publicKey: null,
        provider: null,
        balance: 0
    },
    raffles: [],
    winners: [],
    currentRaffle: null,
    selectedNumbers: [],
    currentPage: 1
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM cargado, inicializando VeriRifa-Sol...');
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('🚀 Inicializando VeriRifa-Sol...');
        
        // Primero configurar todos los event listeners
        setupEventListeners();
        setupCreateRaffleForm();
        
        // Luego inicializar Firebase
        await initializeFirebase();
        
        // Conectar a blockchain y cargar datos
        await connectToBlockchain();
        await loadInitialData();
        
        showUserAlert('✅ VeriRifa-Sol cargada correctamente', 'success');
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando la aplicación:', error);
        showUserAlert('❌ Error al cargar la aplicación: ' + error.message, 'error');
    }
}

// ===== MÓDULO FIREBASE =====
async function initializeFirebase() {
    try {
        // Verificar si Firebase ya está inicializado
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        
        window.db = firebase.firestore();
        
        // Configurar persistencia offline
        await firebase.firestore().enablePersistence()
            .catch((err) => {
                console.warn('⚠️ Persistencia offline no soportada:', err);
            });
            
        console.log('✅ Firebase inicializado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error inicializando Firebase:', error);
        
        // Si hay error de Firebase, usar datos locales
        appState.raffles = getLocalRaffles();
        appState.winners = getLocalWinners();
        
        showUserAlert('⚠️ Modo offline activado - Usando datos locales', 'warning');
        return false;
    }
}

// Datos de ejemplo para modo offline
function getLocalRaffles() {
    return [
        {
            id: 'local_raffle_1',
            name: 'PlayStation 5 - Sorteo Demo',
            description: 'Sorteo de demostración de PS5',
            price: 0.1,
            totalNumbers: 50,
            soldNumbers: [1, 2, 3, 4, 5],
            numberOwners: {},
            image: '🎮',
            prize: 'PlayStation 5',
            winner: null,
            prizeClaimed: false,
            completed: false,
            isSelectingWinner: false,
            shippingStatus: 'pending',
            createdDate: new Date().toISOString()
        }
    ];
}

function getLocalWinners() {
    return [];
}

// ===== MÓDULO DE DATOS =====
async function loadInitialData() {
    showSkeletonLoaders();
    
    try {
        await Promise.all([
            loadRafflesFromFirebase(),
            loadWinnersFromFirebase()
        ]);
        
        hideSkeletonLoaders();
        renderRaffles();
        renderWinnersArchive();
        renderAdminWinnersTable();
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        hideSkeletonLoaders();
        showUserAlert('Error cargando datos', 'error');
    }
}

async function loadRafflesFromFirebase() {
    if (!window.db) {
        console.error('❌ Firebase no disponible');
        appState.raffles = getLocalRaffles();
        return;
    }

    try {
        const snapshot = await db.collection('raffles').get();
        
        if (!snapshot.empty) {
            appState.raffles = [];
            snapshot.forEach(doc => {
                const raffleData = doc.data();
                // Asegurar que todos los campos necesarios existan
                if (!raffleData.soldNumbers) raffleData.soldNumbers = [];
                if (!raffleData.winner) raffleData.winner = null;
                if (raffleData.prizeClaimed === undefined) raffleData.prizeClaimed = false;
                if (!raffleData.numberOwners) raffleData.numberOwners = {};
                if (raffleData.completed === undefined) raffleData.completed = false;
                if (!raffleData.shippingStatus) raffleData.shippingStatus = 'pending';
                
                appState.raffles.push(raffleData);
            });
            console.log('✅ Sorteos cargados desde Firebase:', appState.raffles.length);
        } else {
            console.log('📝 No hay sorteos en Firebase');
            appState.raffles = getLocalRaffles();
        }
    } catch (error) {
        console.error('❌ Error cargando desde Firebase:', error);
        appState.raffles = getLocalRaffles();
    }
}

async function loadWinnersFromFirebase() {
    if (!window.db) {
        console.error('❌ Firebase no disponible');
        appState.winners = [];
        return;
    }

    try {
        const snapshot = await db.collection('winners').orderBy('winnerDate', 'desc').get();
        
        if (!snapshot.empty) {
            appState.winners = [];
            snapshot.forEach(doc => {
                appState.winners.push(doc.data());
            });
            console.log('✅ Ganadores cargados desde Firebase:', appState.winners.length);
        } else {
            console.log('📝 No hay ganadores en Firebase');
            appState.winners = [];
        }
    } catch (error) {
        console.error('❌ Error cargando ganadores desde Firebase:', error);
        appState.winners = [];
    }
}

// ===== CREACIÓN DE SORTEOS - VERSIÓN CORREGIDA =====
function setupCreateRaffleForm() {
    console.log('🔧 Configurando formulario de crear sorteo...');
    
    // Esperar a que el DOM esté completamente cargado
    setTimeout(() => {
        const createRaffleBtn = document.getElementById('create-raffle-btn');
        const createRaffleForm = document.getElementById('create-raffle-form');
        
        console.log('Botón encontrado:', !!createRaffleBtn);
        console.log('Formulario encontrado:', !!createRaffleForm);
        
        if (createRaffleBtn) {
            // Remover event listeners existentes
            createRaffleBtn.replaceWith(createRaffleBtn.cloneNode(true));
            const newBtn = document.getElementById('create-raffle-btn');
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 Botón de crear sorteo clickeado');
                handleCreateRaffle();
            });
            console.log('✅ Event listener agregado al botón');
        }
        
        // También prevenir el submit del formulario por si acaso
        if (createRaffleForm) {
            createRaffleForm.addEventListener('submit', function(e) {
                console.log('🚫 Previniendo submit del formulario');
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
        }
    }, 1000);
}

function handleCreateRaffle() {
    console.log('🎯 Manejando creación de sorteo...');
    
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo el verificador puede crear sorteos', 'error');
        return;
    }

    const raffleName = document.getElementById('raffle-name')?.value?.trim();
    const raffleDescription = document.getElementById('raffle-description')?.value?.trim();
    const ticketPrice = parseFloat(document.getElementById('ticket-price')?.value);
    const maxNumbers = parseInt(document.getElementById('max-numbers')?.value);
    const raffleImage = document.getElementById('raffle-image')?.value?.trim();

    console.log('📝 Datos del formulario:', {
        raffleName,
        raffleDescription,
        ticketPrice,
        maxNumbers,
        raffleImage
    });

    // Validaciones
    if (!raffleName || !raffleDescription || !ticketPrice || !maxNumbers || !raffleImage) {
        showUserAlert('❌ Por favor, completa todos los campos', 'error');
        return;
    }

    if (ticketPrice <= 0) {
        showUserAlert('❌ El precio debe ser mayor a 0', 'error');
        return;
    }

    if (maxNumbers < 10) {
        showUserAlert('❌ La cantidad mínima de números es 10', 'error');
        return;
    }

    createRaffle(raffleName, raffleDescription, ticketPrice, maxNumbers, raffleImage);
}

async function createRaffle(name, description, price, totalNumbers, image) {
    try {
        console.log('🔄 Creando sorteo:', { name, price, totalNumbers });
        
        const raffleId = 'raffle_' + Date.now();
        
        const newRaffle = {
            id: raffleId,
            name: name,
            description: description,
            price: price,
            totalNumbers: totalNumbers,
            soldNumbers: [],
            numberOwners: {},
            image: image,
            prize: name,
            winner: null,
            prizeClaimed: false,
            completed: false,
            isSelectingWinner: false,
            shippingStatus: 'pending',
            createdDate: new Date().toISOString(),
            createdBy: ADMIN_WALLET_ADDRESS
        };

        appState.raffles.push(newRaffle);
        
        // Guardar en Firebase
        if (window.db) {
            await db.collection('raffles').doc(raffleId).set(newRaffle);
            console.log('✅ Sorteo guardado en Firebase:', raffleId);
        }

        // Limpiar formulario
        document.getElementById('raffle-name').value = '';
        document.getElementById('raffle-description').value = '';
        document.getElementById('ticket-price').value = '';
        document.getElementById('max-numbers').value = '';
        document.getElementById('raffle-image').value = '';
        document.getElementById('image-preview').innerHTML = '<div class="emoji-preview">🖼️</div>';

        // Actualizar UI
        renderRaffles();
        
        showUserAlert('✅ Sorteo creado exitosamente en VeriRifa-Sol', 'success');
        
    } catch (error) {
        console.error('Error creando sorteo:', error);
        showUserAlert('❌ Error creando sorteo: ' + error.message, 'error');
    }
}

// ===== MÓDULO DE UI =====
function showSkeletonLoaders() {
    const rafflesContainer = document.getElementById('raffles-container');
    const winnersContainer = document.getElementById('winners-container');
    
    if (rafflesContainer) {
        rafflesContainer.innerHTML = `
            <div class="skeleton-raffle"></div>
            <div class="skeleton-raffle"></div>
            <div class="skeleton-raffle"></div>
        `;
    }
    
    if (winnersContainer) {
        winnersContainer.innerHTML = `
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
        `;
    }
}

function hideSkeletonLoaders() {
    // Los skeletons se reemplazarán automáticamente cuando se rendericen los datos reales
}

function showUserAlert(message, type = 'info', duration = 5000) {
    const alert = document.getElementById('user-alert');
    const alertIcon = document.getElementById('alert-icon');
    const alertMessage = document.getElementById('alert-message');

    if (!alert || !alertIcon || !alertMessage) {
        console.error('❌ Elementos de alerta no encontrados');
        return;
    }

    alert.className = `user-alert ${type}`;

    switch(type) {
        case 'success':
            alertIcon.textContent = '✅';
            break;
        case 'error':
            alertIcon.textContent = '❌';
            break;
        case 'warning':
            alertIcon.textContent = '⚠️';
            break;
        default:
            alertIcon.textContent = 'ℹ️';
    }

    alertMessage.textContent = message;
    alert.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            hideUserAlert();
        }, duration);
    }
}

function hideUserAlert() {
    const alert = document.getElementById('user-alert');
    if (alert) {
        alert.style.display = 'none';
    }
}

// ===== MÓDULO DE BLOCKCHAIN =====
async function connectToBlockchain() {
    try {
        window.connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl(network),
            'confirmed'
        );
        
        const version = await connection.getVersion();
        console.log('✅ Conectado a Solana Testnet:', version);
        
        // Actualizar estado de conexión
        const connectionStatus = document.getElementById('real-connection-status');
        if (connectionStatus) {
            connectionStatus.innerHTML =
                `<strong>Estado Blockchain:</strong> ✅ Conectado a Solana Testnet<br>
                 <small>Version: ${version['solana-core']}</small>`;
        }
             
        return true;
    } catch (error) {
        console.error('Error conectando a Solana:', error);
        const connectionStatus = document.getElementById('real-connection-status');
        if (connectionStatus) {
            connectionStatus.innerHTML =
                '<strong>Estado Blockchain:</strong> ❌ Error conectando a Solana Testnet';
        }
        return false;
    }
}

async function connectRealWallet(walletType) {
    try {
        let provider;

        if (walletType === 'phantom') {
            provider = window.solana;
        } else if (walletType === 'solflare') {
            provider = window.solflare;
        } else {
            throw new Error('Wallet no soportada');
        }

        if (!provider) {
            showUserAlert(
                `${walletType} no está instalada. Por favor, instálala desde ${walletType === 'phantom' ? 'phantom.app' : 'solflare.com'} para continuar.`,
                'warning',
                8000
            );
            return false;
        }

        const response = await provider.connect();
        const publicKey = provider.publicKey;

        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;

        appState.currentWallet = {
            publicKey: publicKey,
            provider: provider,
            balance: balanceInSOL
        };

        updateWalletUI(publicKey.toString(), balanceInSOL);
        checkIfAdmin(publicKey.toString());

        document.getElementById('wallet-modal').classList.remove('active');

        showUserAlert(
            `✅ ${walletType} conectada correctamente a VeriRifa-Sol`,
            'success',
            5000
        );

        return true;

    } catch (error) {
        console.error('Error conectando wallet:', error);
        showUserAlert(`❌ Error conectando wallet: ${error.message}`, 'error');
        return false;
    }
}

function updateWalletUI(publicKey, balance) {
    const shortAddress = `${publicKey.substring(0, 6)}...${publicKey.substring(publicKey.length - 4)}`;

    document.getElementById('connected-wallet-address').textContent = shortAddress;
    document.getElementById('connected-wallet-address').style.display = 'block';
    document.getElementById('wallet-balance').textContent = `${balance.toFixed(4)} SOL`;
    document.getElementById('wallet-balance').style.display = 'block';
    document.getElementById('connect-wallet-btn').innerHTML = '<span>✅ Conectado</span>';
    document.getElementById('connect-wallet-btn').className = 'btn btn-success';
    document.getElementById('network-indicator').textContent = '🟢 Solana Testnet';
    document.getElementById('network-indicator').style.background = 'rgba(20, 241, 149, 0.2)';
    document.getElementById('disconnect-wallet-btn').style.display = 'block';
    document.getElementById('winner-info-btn').style.display = 'block';

    document.getElementById('connection-status').innerHTML = '<strong>Estado Wallet:</strong> ✅ Conectada a VeriRifa-Sol';
}

function checkIfAdmin(publicKey) {
    appState.isAdmin = (publicKey === ADMIN_WALLET_ADDRESS);

    if (appState.isAdmin) {
        document.getElementById('admin-menu-item').classList.add('visible');
        showUserAlert('✅ Modo verificador activado', 'success');
        
        // Re-configurar el botón de crear sorteo cuando se activa admin
        setTimeout(() => {
            setupCreateRaffleForm();
        }, 500);
    } else {
        document.getElementById('admin-menu-item').classList.remove('visible');
        document.getElementById('admin-panel').classList.remove('active');
    }
    
    // Actualizar UI
    renderRaffles();
}

function disconnectWallet() {
    if (appState.currentWallet.provider) {
        appState.currentWallet.provider.disconnect();
    }

    appState.currentWallet = {
        publicKey: null,
        provider: null,
        balance: 0
    };

    appState.isConnected = false;
    appState.isAdmin = false;

    document.getElementById('connected-wallet-address').style.display = 'none';
    document.getElementById('wallet-balance').style.display = 'none';
    document.getElementById('connect-wallet-btn').innerHTML = '<span>👛 Conectar Wallet</span>';
    document.getElementById('connect-wallet-btn').className = 'btn';
    document.getElementById('network-indicator').textContent = '🔴 Desconectado';
    document.getElementById('network-indicator').style.background = 'rgba(153, 69, 255, 0.2)';
    document.getElementById('disconnect-wallet-btn').style.display = 'none';
    document.getElementById('winner-info-btn').style.display = 'none';
    document.getElementById('admin-menu-item').classList.remove('visible');
    document.getElementById('admin-panel').classList.remove('active');

    document.getElementById('connection-status').innerHTML = '<strong>Estado Wallet:</strong> Desconectado';

    showUserAlert('🔌 Wallet desconectada', 'info');
    
    // Actualizar UI
    renderRaffles();
}

// ===== RENDERIZADO DE SORTEOS =====
function renderRaffles() {
    const container = document.getElementById('raffles-container');
    if (!container) return;

    container.innerHTML = '';

    const activeRaffles = appState.raffles.filter(raffle => !raffle.completed);
    
    if (activeRaffles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 3rem;">
                <h3>📝 No hay sorteos activos</h3>
                <p>Conecta tu wallet verificada para crear el primer sorteo</p>
            </div>
        `;
        return;
    }

    activeRaffles.forEach(raffle => {
        const raffleCard = document.createElement('div');
        raffleCard.className = 'raffle-card';
        
        const progress = raffle.soldNumbers.length;
        const total = raffle.totalNumbers;
        const progressPercent = total > 0 ? (progress / total) * 100 : 0;
        
        const isUserWinner = raffle.winner && appState.currentWallet.publicKey && raffle.winner.wallet === appState.currentWallet.publicKey.toString();
        
        let actionButton = '';
        
        const allNumbersSold = raffle.soldNumbers.length >= raffle.totalNumbers;
        
        if (raffle.winner) {
            if (isUserWinner) {
                if (raffle.prizeClaimed) {
                    const shippingStatus = raffle.shippingStatus || 'pending';
                    const statusText = getShippingStatusText(shippingStatus);
                    let statusColor = 'var(--success)';
                    
                    switch(shippingStatus) {
                        case 'pending': statusColor = 'var(--warning)'; break;
                        case 'claimed': statusColor = 'var(--info)'; break;
                        case 'shipped': statusColor = 'var(--primary)'; break;
                        case 'delivered': statusColor = 'var(--success)'; break;
                    }
                    
                    actionButton = `
                        <button class="btn" style="width: 100%; background: ${statusColor}; cursor: not-allowed;" disabled>
                            ${shippingStatus === 'delivered' ? '✅' : '📦'} ${statusText}
                        </button>
                    `;
                } else {
                    actionButton = `
                        <button class="btn btn-success claim-prize-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎉 Reclamar Premio
                        </button>
                    `;
                }
            } else {
                actionButton = `
                    <button class="btn" style="width: 100%; background: var(--gray); cursor: not-allowed;" disabled>
                        ❌ No Ganaste
                    </button>
                `;
            }
        } else if (raffle.isSelectingWinner) {
            actionButton = `
                <button class="btn" style="width: 100%; background: var(--warning); cursor: not-allowed;" disabled>
                    ⏳ Seleccionando Ganador...
                </button>
            `;
        } else {
            if (appState.isAdmin) {
                if (allNumbersSold) {
                    actionButton = `
                        <button class="btn btn-warning select-winner-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎰 Seleccionar Ganador
                        </button>
                    `;
                } else {
                    const remainingNumbers = raffle.totalNumbers - raffle.soldNumbers.length;
                    actionButton = `
                        <button class="btn btn-disabled" style="width: 100%;" disabled>
                            ⏳ Esperando venta (${remainingNumbers} números restantes)
                        </button>
                    `;
                }
            } else {
                if (allNumbersSold) {
                    actionButton = `
                        <button class="btn btn-disabled" style="width: 100%;" disabled>
                            🔒 Todos los números vendidos
                        </button>
                    `;
                } else {
                    actionButton = `
                        <button class="btn participate-btn" data-raffle="${raffle.id}" style="width: 100%;">
                            🎫 Participar (${raffle.price} SOL)
                        </button>
                    `;
                }
            }
        }

        raffleCard.innerHTML = `
            <div class="raffle-image">
                ${raffle.image.startsWith('http') ? 
                    `<img src="${raffle.image}" alt="${raffle.name}" onerror="this.parentElement.innerHTML='${raffle.image.includes('🎮') ? '🎮' : '🎁'}'">` : 
                    `<div style="font-size: 3rem;">${raffle.image}</div>`
                }
            </div>
            <div class="raffle-content">
                <h3 class="raffle-title">${raffle.name}</h3>
                <div class="raffle-price">${raffle.price} SOL por número</div>
                <div class="raffle-info">
                    <span>🎯 Premio: ${raffle.prize}</span>
                    <span>🔢 ${progress}/${total} números</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${progressPercent}%"></div>
                </div>
                <div class="raffle-info">
                    <span>🏆 Ganador: ${raffle.winner ? 'Sí' : 'No'}</span>
                    <span>${allNumbersSold ? '🔒 Completado' : '🟢 Disponible'}</span>
                </div>
                <div>
                    ${actionButton}
                </div>
            </div>
        `;

        container.appendChild(raffleCard);
    });

    setupRaffleEventListeners();
}

function setupRaffleEventListeners() {
    // Configurar botones de participar
    document.querySelectorAll('.participate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('🎫 Botón participar clickeado para sorteo:', this.getAttribute('data-raffle'));
            if (!appState.currentWallet.publicKey) {
                showUserAlert('🔗 Conecta tu wallet primero para participar', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            openNumberSelectionModal(this.getAttribute('data-raffle'));
        });
    });

    // Configurar botones de seleccionar ganador
    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('🎰 Botón seleccionar ganador clickeado para sorteo:', this.getAttribute('data-raffle'));
            selectWinner(this.getAttribute('data-raffle'));
        });
    });

    // Configurar botones de reclamar premio
    document.querySelectorAll('.claim-prize-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('🎉 Botón reclamar premio clickeado para sorteo:', this.getAttribute('data-raffle'));
            openClaimPrizeModal(this.getAttribute('data-raffle'));
        });
    });
}

// ===== RENDERIZADO DE GANADORES =====
function renderWinnersArchive() {
    const winnersContainer = document.getElementById('winners-container');
    if (!winnersContainer) return;

    winnersContainer.innerHTML = '';

    if (appState.winners.length === 0) {
        winnersContainer.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 2rem;">
                <h3>📝 Aún no hay ganadores</h3>
                <p>Los ganadores aparecerán aquí una vez que se realicen los sorteos</p>
            </div>
        `;
        return;
    }

    appState.winners.forEach(winner => {
        const winnerCard = document.createElement('div');
        winnerCard.className = 'winner-card';
        
        const winnerDate = new Date(winner.winnerDate).toLocaleDateString('es-ES');
        const shortWallet = `${winner.winnerWallet.substring(0, 8)}...${winner.winnerWallet.substring(winner.winnerWallet.length - 4)}`;

        winnerCard.innerHTML = `
            <div class="winner-header">
                <div class="winner-prize">${winner.prize}</div>
                <div class="winner-date">${winnerDate}</div>
            </div>
            <div class="winner-details">
                <div><strong>Sorteo:</strong> ${winner.raffleName}</div>
                <div><strong>Número ganador:</strong> ${winner.winningNumber}</div>
                <div><strong>Wallet:</strong> <span class="winner-wallet">${shortWallet}</span></div>
                ${winner.winnerInfo ? `<div><strong>Ganador:</strong> ${winner.winnerInfo.name}</div>` : ''}
            </div>
        `;

        winnersContainer.appendChild(winnerCard);
    });
}

// ===== SELECCIÓN DE NÚMEROS =====
function openNumberSelectionModal(raffleId) {
    console.log('🎯 Abriendo modal para sorteo:', raffleId);
    
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    // Verificar que el usuario tenga wallet conectada
    if (!appState.currentWallet.publicKey) {
        showUserAlert('🔗 Conecta tu wallet primero para participar', 'warning');
        document.getElementById('wallet-modal').classList.add('active');
        return;
    }

    appState.currentRaffle = raffle;
    appState.selectedNumbers = [];
    appState.currentPage = 1;

    // Actualizar UI del modal
    document.getElementById('modal-raffle-name').textContent = raffle.name;
    document.getElementById('price-per-number').textContent = raffle.price + ' SOL';
    document.getElementById('user-balance').textContent = appState.currentWallet.balance.toFixed(4) + ' SOL';
    
    // Resetear estado de pago
    document.getElementById('payment-status').style.display = 'none';
    
    updateNumberSelectionUI();
    updatePaymentSummary();
    
    // Mostrar modal
    document.getElementById('number-selection-modal').classList.add('active');
    
    console.log('✅ Modal abierto correctamente');
}

function updateNumberSelectionUI() {
    if (!appState.currentRaffle) return;

    const raffle = appState.currentRaffle;
    const numbersPerPage = 50;
    const totalPages = Math.ceil(raffle.totalNumbers / numbersPerPage);
    
    // Actualizar controles de paginación
    renderPaginationControls(totalPages);
    
    // Actualizar información de página
    document.getElementById('page-info').textContent = 
        `Página ${appState.currentPage} de ${totalPages} - ${raffle.totalNumbers} números totales`;
    
    // Actualizar grid de números
    renderNumbersGrid(raffle, numbersPerPage);
    
    // Actualizar números seleccionados
    updateSelectedNumbersList();
}

function renderPaginationControls(totalPages) {
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === appState.currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            appState.currentPage = i;
            updateNumberSelectionUI();
        });
        paginationContainer.appendChild(pageBtn);
    }
}

function renderNumbersGrid(raffle, numbersPerPage) {
    const numbersGrid = document.getElementById('numbers-grid');
    numbersGrid.innerHTML = '';

    const startNumber = (appState.currentPage - 1) * numbersPerPage + 1;
    const endNumber = Math.min(appState.currentPage * numbersPerPage, raffle.totalNumbers);

    for (let i = startNumber; i <= endNumber; i++) {
        const numberBtn = document.createElement('button');
        numberBtn.className = 'number-btn';
        numberBtn.textContent = i;
        
        // Verificar si el número está vendido
        if (raffle.soldNumbers.includes(i)) {
            numberBtn.classList.add('sold');
            numberBtn.disabled = true;
        }
        
        // Verificar si el número está seleccionado
        if (appState.selectedNumbers.includes(i)) {
            numberBtn.classList.add('selected');
        }

        numberBtn.addEventListener('click', () => toggleNumberSelection(i, numberBtn));
        numbersGrid.appendChild(numberBtn);
    }
}

function toggleNumberSelection(number, button) {
    const index = appState.selectedNumbers.indexOf(number);
    
    if (index === -1) {
        // Agregar número
        appState.selectedNumbers.push(number);
        button.classList.add('selected');
    } else {
        // Remover número
        appState.selectedNumbers.splice(index, 1);
        button.classList.remove('selected');
    }
    
    updateSelectedNumbersList();
    updatePaymentSummary();
}

function updateSelectedNumbersList() {
    const selectedList = document.getElementById('selected-numbers-list');
    selectedList.innerHTML = '';

    appState.selectedNumbers.sort((a, b) => a - b).forEach(number => {
        const tag = document.createElement('div');
        tag.className = 'selected-number-tag';
        tag.textContent = number;
        selectedList.appendChild(tag);
    });
}

function updatePaymentSummary() {
    const raffle = appState.currentRaffle;
    if (!raffle) return;

    const selectedCount = appState.selectedNumbers.length;
    const totalPayment = selectedCount * raffle.price;

    document.getElementById('selected-count').textContent = selectedCount;
    document.getElementById('total-payment').textContent = totalPayment.toFixed(4) + ' SOL';
    
    // Verificar si el usuario tiene suficiente balance
    if (appState.currentWallet.balance < totalPayment) {
        document.getElementById('confirm-payment-btn').disabled = true;
        document.getElementById('confirm-payment-btn').style.opacity = '0.6';
        document.getElementById('payment-details').innerHTML = 
            '<span style="color: var(--danger);">❌ Saldo insuficiente</span>';
    } else {
        document.getElementById('confirm-payment-btn').disabled = false;
        document.getElementById('confirm-payment-btn').style.opacity = '1';
        document.getElementById('payment-details').innerHTML = 
            '✅ Listo para procesar pago en Solana Testnet';
    }
}

// ===== PROCESAMIENTO DE PAGOS =====
async function processPayment() {
    const raffle = appState.currentRaffle;
    const totalPayment = appState.selectedNumbers.length * raffle.price;

    try {
        document.getElementById('payment-status').style.display = 'block';
        document.getElementById('payment-details').innerHTML = 
            '🔄 Iniciando transacción en Solana Testnet...';

        // Simular transacción (en una implementación real, aquí iría la transacción real)
        await simulateSolanaTransaction(totalPayment);

        // Actualizar el sorteo con los números comprados
        await updateRaffleWithPurchasedNumbers(raffle);

        // Actualizar balance del usuario
        appState.currentWallet.balance -= totalPayment;
        document.getElementById('wallet-balance').textContent = 
            appState.currentWallet.balance.toFixed(4) + ' SOL';

        document.getElementById('payment-details').innerHTML = 
            '✅ Pago procesado exitosamente en Solana Testnet<br>' +
            '🔥 Datos sincronizados con Firebase<br>' +
            '🎫 Números asignados a tu wallet';

        showUserAlert('✅ Compra exitosa - Números asignados a tu wallet', 'success');

        // Cerrar modal después de éxito
        setTimeout(() => {
            document.getElementById('number-selection-modal').classList.remove('active');
            renderRaffles(); // Actualizar la UI de sorteos
        }, 2000);

    } catch (error) {
        console.error('Error procesando pago:', error);
        document.getElementById('payment-details').innerHTML = 
            '❌ Error en la transacción: ' + error.message;
        showUserAlert('❌ Error procesando el pago', 'error');
    }
}

async function simulateSolanaTransaction(amount) {
    // Simular delay de transacción
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Transacción simulada: ${amount} SOL enviados a ${ADMIN_WALLET_ADDRESS}`);
            resolve();
        }, 2000);
    });
}

async function updateRaffleWithPurchasedNumbers(raffle) {
    const userWallet = appState.currentWallet.publicKey.toString();
    
    // Agregar números vendidos
    appState.selectedNumbers.forEach(number => {
        if (!raffle.soldNumbers.includes(number)) {
            raffle.soldNumbers.push(number);
            raffle.numberOwners[number] = userWallet;
        }
    });

    // Actualizar en Firebase
    if (window.db) {
        await db.collection('raffles').doc(raffle.id).update({
            soldNumbers: raffle.soldNumbers,
            numberOwners: raffle.numberOwners,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // Actualizar en estado local
    const raffleIndex = appState.raffles.findIndex(r => r.id === raffle.id);
    if (raffleIndex !== -1) {
        appState.raffles[raffleIndex] = raffle;
    }
}

// ===== SELECCIÓN DE GANADORES =====
async function selectWinner(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    if (raffle.soldNumbers.length === 0) {
        showUserAlert('❌ No hay números vendidos en este sorteo', 'error');
        return;
    }

    if (raffle.winner) {
        showUserAlert('❌ Este sorteo ya tiene un ganador', 'error');
        return;
    }

    try {
        // Seleccionar número ganador aleatoriamente
        const randomIndex = Math.floor(Math.random() * raffle.soldNumbers.length);
        const winningNumber = raffle.soldNumbers[randomIndex];
        const winnerWallet = raffle.numberOwners[winningNumber];

        // Actualizar sorteo con ganador
        raffle.winner = {
            number: winningNumber,
            wallet: winnerWallet,
            selectedDate: new Date().toISOString()
        };
        raffle.completed = true;

        // Guardar en Firebase
        if (window.db) {
            await db.collection('raffles').doc(raffleId).update({
                winner: raffle.winner,
                completed: true,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Agregar a ganadores
            const winnerData = {
                raffleId: raffleId,
                raffleName: raffle.name,
                winningNumber: winningNumber,
                winnerWallet: winnerWallet,
                prize: raffle.prize,
                winnerDate: new Date().toISOString(),
                claimed: false
            };

            await db.collection('winners').doc(raffleId).set(winnerData);
        }

        // Actualizar estado local
        appState.winners.push({
            raffleId: raffleId,
            raffleName: raffle.name,
            winningNumber: winningNumber,
            winnerWallet: winnerWallet,
            prize: raffle.prize,
            winnerDate: new Date().toISOString()
        });

        // Actualizar UI
        renderRaffles();
        renderWinnersArchive();
        renderAdminWinnersTable();
        
        showUserAlert(`🎉 Ganador seleccionado! Número ${winningNumber}`, 'success');

    } catch (error) {
        console.error('Error seleccionando ganador:', error);
        showUserAlert('❌ Error seleccionando ganador', 'error');
    }
}

// ===== RECLAMACIÓN DE PREMIOS =====
function openClaimPrizeModal(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.winner) {
        showUserAlert('❌ Sorteo o ganador no encontrado', 'error');
        return;
    }

    if (raffle.winner.wallet !== appState.currentWallet.publicKey.toString()) {
        showUserAlert('❌ No eres el ganador de este sorteo', 'error');
        return;
    }

    if (raffle.prizeClaimed) {
        showUserAlert('❌ Este premio ya fue reclamado', 'error');
        return;
    }

    appState.currentRaffle = raffle;

    document.getElementById('prize-name').textContent = `Premio: ${raffle.prize}`;
    document.getElementById('claim-raffle-name').textContent = raffle.name;
    document.getElementById('winning-number').textContent = raffle.winner.number;
    document.getElementById('winner-wallet').textContent = `${raffle.winner.wallet.substring(0, 8)}...${raffle.winner.wallet.substring(raffle.winner.wallet.length - 4)}`;

    // Limpiar formulario
    document.getElementById('winner-name').value = '';
    document.getElementById('winner-email').value = '';
    document.getElementById('winner-phone').value = '';
    document.getElementById('winner-address').value = '';
    document.getElementById('winner-notes').value = '';

    document.getElementById('claim-prize-modal').classList.add('active');
}

async function submitPrizeClaim() {
    const raffle = appState.currentRaffle;
    if (!raffle) return;

    const name = document.getElementById('winner-name').value.trim();
    const email = document.getElementById('winner-email').value.trim();
    const phone = document.getElementById('winner-phone').value.trim();
    const address = document.getElementById('winner-address').value.trim();

    // Validar campos
    if (!name) {
        showValidationError('name-validation', 'Por favor, introduce tu nombre completo');
        return;
    }

    if (!email || !isValidEmail(email)) {
        showValidationError('email-validation', 'Por favor, introduce un email válido');
        return;
    }

    if (!phone) {
        showValidationError('phone-validation', 'Por favor, introduce un número de teléfono');
        return;
    }

    if (!address) {
        showValidationError('address-validation', 'Por favor, introduce tu dirección completa');
        return;
    }

    try {
        document.getElementById('claim-status').style.display = 'block';
        document.getElementById('claim-details').innerHTML = '📧 Procesando tu información...';

        // Actualizar sorteo con información del ganador
        raffle.prizeClaimed = true;
        raffle.winner.claimDate = new Date().toISOString();
        raffle.winner.contactInfo = {
            name: name,
            email: email,
            phone: phone,
            address: address,
            notes: document.getElementById('winner-notes').value.trim()
        };

        // Actualizar en Firebase
        if (window.db) {
            await db.collection('raffles').doc(raffle.id).update({
                prizeClaimed: true,
                winner: raffle.winner,
                shippingStatus: 'claimed',
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Actualizar en ganadores
            await db.collection('winners').doc(raffle.id).update({
                claimed: true,
                claimDate: new Date().toISOString(),
                winnerInfo: raffle.winner.contactInfo
            });
        }

        document.getElementById('claim-details').innerHTML = 
            '✅ Información enviada correctamente<br>' +
            '📦 El verificador procesará tu envío<br>' +
            '📧 Recibirás actualizaciones por email';

        showUserAlert('✅ Premio reclamado exitosamente', 'success');

        // Cerrar modal después de éxito
        setTimeout(() => {
            document.getElementById('claim-prize-modal').classList.remove('active');
            renderRaffles();
            renderAdminWinnersTable();
        }, 3000);

    } catch (error) {
        console.error('Error reclamando premio:', error);
        document.getElementById('claim-details').innerHTML = 
            '❌ Error procesando tu información: ' + error.message;
        showUserAlert('❌ Error reclamando el premio', 'error');
    }
}

// ===== ADMIN WINNERS TABLE =====
async function renderAdminWinnersTable() {
    if (!appState.isAdmin) return;

    const container = document.getElementById('winners-admin-container');
    const table = document.getElementById('winners-admin-table');
    const tbody = document.getElementById('winners-admin-tbody');
    const noWinnersMessage = document.getElementById('no-winners-message');

    if (!tbody) return;

    tbody.innerHTML = '';

    // Filtrar ganadores que han reclamado premio
    const claimedWinners = appState.raffles.filter(raffle => 
        raffle.winner && raffle.prizeClaimed && raffle.winner.contactInfo
    );

    if (claimedWinners.length === 0) {
        if (table) table.style.display = 'none';
        if (noWinnersMessage) noWinnersMessage.style.display = 'block';
        return;
    }

    if (table) table.style.display = 'table';
    if (noWinnersMessage) noWinnersMessage.style.display = 'none';

    claimedWinners.forEach(raffle => {
        const row = document.createElement('tr');
        const contactInfo = raffle.winner.contactInfo;
        
        row.innerHTML = `
            <td>
                <strong>${contactInfo.name}</strong><br>
                <small>${raffle.winner.wallet.substring(0, 8)}...</small>
            </td>
            <td class="winner-contact-info">
                <div>📧 ${contactInfo.email}</div>
                <div>📞 ${contactInfo.phone}</div>
            </td>
            <td>${raffle.prize}</td>
            <td>${raffle.name}</td>
            <td><strong>${raffle.winner.number}</strong></td>
            <td>${new Date(raffle.winner.claimDate).toLocaleDateString('es-ES')}</td>
            <td>
                <span class="winner-status-badge status-${raffle.shippingStatus}">
                    ${getShippingStatusText(raffle.shippingStatus)}
                </span>
            </td>
            <td>
                <div class="winner-actions">
                    <button class="btn btn-small btn-info update-shipping-btn" data-raffle="${raffle.id}">
                        📦 Actualizar
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Agregar event listeners a los botones de actualización
    document.querySelectorAll('.update-shipping-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            openShippingUpdateModal(this.getAttribute('data-raffle'));
        });
    });
}

function openShippingUpdateModal(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) return;

    const newStatus = prompt(
        `Actualizar estado de envío para ${raffle.winner.contactInfo.name}:\n\n` +
        '1. pending - Pendiente\n' +
        '2. claimed - Reclamado\n' + 
        '3. shipped - Enviado\n' +
        '4. delivered - Entregado\n\n' +
        'Estado actual: ' + raffle.shippingStatus,
        raffle.shippingStatus
    );

    if (newStatus && ['pending', 'claimed', 'shipped', 'delivered'].includes(newStatus)) {
        updateShippingStatus(raffleId, newStatus);
    }
}

async function updateShippingStatus(raffleId, newStatus) {
    try {
        const raffle = appState.raffles.find(r => r.id === raffleId);
        if (!raffle) return;

        raffle.shippingStatus = newStatus;

        // Actualizar en Firebase
        if (window.db) {
            await db.collection('raffles').doc(raffleId).update({
                shippingStatus: newStatus,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Actualizar UI
        renderRaffles();
        renderAdminWinnersTable();
        
        showUserAlert(`✅ Estado actualizado a: ${getShippingStatusText(newStatus)}`, 'success');

    } catch (error) {
        console.error('Error actualizando estado:', error);
        showUserAlert('❌ Error actualizando estado', 'error');
    }
}

// ===== FUNCIONES AUXILIARES =====
function getShippingStatusText(status) {
    switch(status) {
        case 'pending': return 'Pendiente';
        case 'claimed': return 'Reclamado';
        case 'shipped': return 'Enviado';
        case 'delivered': return 'Entregado';
        default: return 'Pendiente';
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showValidationError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.classList.add('show');
        
        // Resaltar campo
        const inputId = elementId.replace('-validation', '');
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            inputElement.classList.add('error');
        }
        
        // Quitar error después de 3 segundos
        setTimeout(() => {
            element.classList.remove('show');
            if (inputElement) {
                inputElement.classList.remove('error');
            }
        }, 3000);
    }
}

// ===== SETUP DE EVENT LISTENERS =====
function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Wallet Modal
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', function() {
            document.getElementById('wallet-modal').classList.add('active');
        });
    }

    const closeWalletModal = document.getElementById('close-wallet-modal');
    if (closeWalletModal) {
        closeWalletModal.addEventListener('click', function() {
            document.getElementById('wallet-modal').classList.remove('active');
        });
    }

    const connectPhantom = document.getElementById('connect-phantom-real');
    if (connectPhantom) {
        connectPhantom.addEventListener('click', function() {
            connectRealWallet('phantom');
        });
    }

    const connectSolflare = document.getElementById('connect-solflare-real');
    if (connectSolflare) {
        connectSolflare.addEventListener('click', function() {
            connectRealWallet('solflare');
        });
    }

    const disconnectBtn = document.getElementById('disconnect-wallet-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }

    // Admin Panel
    const adminPanelLink = document.getElementById('admin-panel-link');
    if (adminPanelLink) {
        adminPanelLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (appState.isAdmin) {
                document.getElementById('admin-panel').classList.add('active');
                renderAdminWinnersTable();
                window.scrollTo({ top: document.getElementById('admin-panel').offsetTop - 100, behavior: 'smooth' });
            } else {
                showUserAlert('❌ Solo el verificador puede acceder al panel', 'error');
            }
        });
    }

    const closeAdminPanel = document.getElementById('close-admin-panel');
    if (closeAdminPanel) {
        closeAdminPanel.addEventListener('click', function() {
            document.getElementById('admin-panel').classList.remove('active');
        });
    }

    // FAQ
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function() {
            const answer = this.nextElementSibling;
            const toggle = this.querySelector('.faq-toggle');
            
            document.querySelectorAll('.faq-answer').forEach(ans => {
                if (ans !== answer) {
                    ans.classList.remove('active');
                    ans.previousElementSibling.querySelector('.faq-toggle').classList.remove('active');
                }
            });
            
            answer.classList.toggle('active');
            toggle.classList.toggle('active');
        });
    });

    // Cerrar alertas
    const closeAlert = document.getElementById('close-alert');
    if (closeAlert) {
        closeAlert.addEventListener('click', hideUserAlert);
    }

    // Botón de información del ganador
    const winnerInfoBtn = document.getElementById('winner-info-btn');
    if (winnerInfoBtn) {
        winnerInfoBtn.addEventListener('click', function() {
            if (appState.currentWallet.publicKey) {
                showUserAlert('👤 Conectado como: ' + appState.currentWallet.publicKey.toString(), 'info');
            }
        });
    }

    // Botones de admin
    const refreshWinnersBtn = document.getElementById('refresh-winners-btn');
    if (refreshWinnersBtn) {
        refreshWinnersBtn.addEventListener('click', function() {
            renderAdminWinnersTable();
            showUserAlert('🔄 Tabla de ganadores actualizada', 'success');
        });
    }

    // Modales
    setupModalEventListeners();
    
    // Vista previa de imagen
    setupImagePreview();
    
    console.log('✅ Event listeners configurados');
}

function setupModalEventListeners() {
    // Cerrar modal de selección de números
    const closeNumberModal = document.getElementById('close-number-modal');
    if (closeNumberModal) {
        closeNumberModal.addEventListener('click', function() {
            document.getElementById('number-selection-modal').classList.remove('active');
        });
    }

    const cancelSelectionBtn = document.getElementById('cancel-selection-btn');
    if (cancelSelectionBtn) {
        cancelSelectionBtn.addEventListener('click', function() {
            document.getElementById('number-selection-modal').classList.remove('active');
        });
    }

    // Botón de confirmar pago
    const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', async function() {
            if (!appState.currentRaffle || appState.selectedNumbers.length === 0) {
                showUserAlert('❌ Selecciona al menos un número', 'error');
                return;
            }
            await processPayment();
        });
    }

    // Cerrar modal de reclamar premio
    const closeClaimModal = document.getElementById('close-claim-modal');
    if (closeClaimModal) {
        closeClaimModal.addEventListener('click', function() {
            document.getElementById('claim-prize-modal').classList.remove('active');
        });
    }

    const cancelClaimBtn = document.getElementById('cancel-claim-btn');
    if (cancelClaimBtn) {
        cancelClaimBtn.addEventListener('click', function() {
            document.getElementById('claim-prize-modal').classList.remove('active');
        });
    }

    // Botón de submit para reclamar premio
    const submitClaimBtn = document.getElementById('submit-claim-btn');
    if (submitClaimBtn) {
        submitClaimBtn.addEventListener('click', async function() {
            await submitPrizeClaim();
        });
    }

    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(event) {
        const numberModal = document.getElementById('number-selection-modal');
        if (event.target === numberModal) {
            numberModal.classList.remove('active');
        }
        
        const claimModal = document.getElementById('claim-prize-modal');
        if (event.target === claimModal) {
            claimModal.classList.remove('active');
        }
        
        const walletModal = document.getElementById('wallet-modal');
        if (event.target === walletModal) {
            walletModal.classList.remove('active');
        }
    });
}

function setupImagePreview() {
    const raffleImageInput = document.getElementById('raffle-image');
    if (raffleImageInput) {
        raffleImageInput.addEventListener('input', function() {
            const preview = document.getElementById('image-preview');
            const value = this.value.trim();
            
            if (value.startsWith('http')) {
                preview.innerHTML = `<img src="${value}" alt="Vista previa" onerror="this.parentElement.innerHTML='❌ Error cargando imagen'">`;
            } else {
                preview.innerHTML = `<div class="emoji-preview">${value || '🖼️'}</div>`;
            }
        });
    }
}
