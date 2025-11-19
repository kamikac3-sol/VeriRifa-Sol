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
const NETWORK = 'testnet';

// ===== ESTADO GLOBAL =====
let appState = {
    isConnected: false,
    isAdmin: false,
    currentWallet: null,
    raffles: [],
    winners: [],
    currentRaffle: null,
    selectedNumbers: [],
    currentPage: 1
};

// ===== INICIALIZACIÓN PRINCIPAL =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando VeriRifa-Sol...');
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('1. Inicializando Firebase...');
        await initializeFirebase();
        
        console.log('2. Configurando event listeners...');
        setupAllEventListeners();
        
        console.log('3. Conectando a blockchain...');
        await initializeBlockchain();
        
        console.log('4. Cargando datos iniciales...');
        await loadInitialData();
        
        console.log('✅ VeriRifa-Sol inicializada correctamente');
        showUserAlert('✅ VeriRifa-Sol cargada correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error crítico en inicialización:', error);
        showUserAlert('❌ Error al cargar la aplicación: ' + error.message, 'error');
    }
}

// ===== FIREBASE =====
async function initializeFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        window.db = firebase.firestore();
        console.log('✅ Firebase configurado');
    } catch (error) {
        console.error('❌ Error en Firebase:', error);
        showUserAlert('⚠️ Firebase no disponible - modo offline activado', 'warning');
    }
}

// ===== BLOCKCHAIN =====
async function initializeBlockchain() {
    try {
        window.connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl(NETWORK),
            'confirmed'
        );
        
        const version = await connection.getVersion();
        console.log('✅ Conectado a Solana Testnet:', version);
        
        updateConnectionStatus('connected', `Versión: ${version['solana-core']}`);
        return true;
    } catch (error) {
        console.error('❌ Error conectando a blockchain:', error);
        updateConnectionStatus('error', 'No se pudo conectar');
        return false;
    }
}

// ===== CONEXIÓN DE WALLET - CORREGIDA =====
async function connectWallet(walletType) {
    console.log(`🔗 Intentando conectar ${walletType}...`);
    
    try {
        let provider;
        
        // Detectar el proveedor correctamente
        if (walletType === 'phantom') {
            provider = window.solana || window.phantom?.solana;
            if (!provider) {
                throw new Error('Phantom no detectada. ¿Está instalada?');
            }
        } else if (walletType === 'solflare') {
            provider = window.solflare;
            if (!provider) {
                throw new Error('Solflare no detectada. ¿Está instalada?');
            }
        } else {
            throw new Error('Wallet no soportada');
        }

        console.log('📱 Proveedor detectado:', provider);

        // Verificar si ya está conectada
        if (provider.isConnected) {
            console.log('✅ Wallet ya está conectada');
        } else {
            console.log('🔄 Solicitando conexión...');
            
            // Método más robusto para conectar
            try {
                // Para Phantom
                if (walletType === 'phantom') {
                    await provider.connect({ onlyIfTrusted: false });
                } 
                // Para Solflare
                else if (walletType === 'solflare') {
                    await provider.connect();
                }
                
                console.log('✅ Conexión solicitada');
            } catch (connectError) {
                console.error('❌ Error en conexión:', connectError);
                
                if (connectError.message.includes('User rejected') || 
                    connectError.message.includes('not authorized')) {
                    throw new Error('Usuario canceló la conexión');
                }
                throw connectError;
            }
        }

        // Esperar a que la wallet esté disponible
        if (!provider.publicKey) {
            console.log('⏳ Esperando clave pública...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!provider.publicKey) {
                throw new Error('No se pudo obtener la clave pública de la wallet');
            }
        }

        const publicKey = provider.publicKey;
        console.log('✅ Wallet conectada:', publicKey.toString());

        // Obtener balance
        let balanceInSOL = 0;
        try {
            const balance = await connection.getBalance(publicKey);
            balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;
            console.log('💰 Balance:', balanceInSOL, 'SOL');
        } catch (balanceError) {
            console.warn('⚠️ No se pudo obtener el balance:', balanceError);
        }

        // Actualizar estado
        appState.currentWallet = {
            publicKey: publicKey.toString(),
            provider: provider,
            balance: balanceInSOL
        };

        // Verificar admin y actualizar UI
        checkAdminStatus();
        updateWalletDisplay();
        
        // Cerrar modal
        const walletModal = document.getElementById('wallet-modal');
        if (walletModal) walletModal.classList.remove('active');
        
        showUserAlert(`✅ ${walletType} conectada correctamente`, 'success');
        return true;

    } catch (error) {
        console.error(`❌ Error conectando ${walletType}:`, error);
        
        let errorMessage = 'Error conectando wallet';
        
        if (error.message.includes('User rejected') || 
            error.message.includes('Usuario canceló') ||
            error.message.includes('not authorized')) {
            errorMessage = 'Cancelaste la conexión de la wallet';
        } else if (error.message.includes('not detected') || 
                  error.message.includes('no detectada')) {
            errorMessage = `${walletType} no está instalada. Instálala desde ${walletType === 'phantom' ? 'phantom.app' : 'solflare.com'}`;
        } else if (error.message.includes('clave pública')) {
            errorMessage = 'No se pudo conectar con la wallet. Intenta de nuevo.';
        } else {
            errorMessage = `Error: ${error.message}`;
        }
        
        showUserAlert(`❌ ${errorMessage}`, 'error');
        return false;
    }
}

// ===== VERIFICACIÓN DE ADMIN MEJORADA =====
function checkAdminStatus() {
    if (!appState.currentWallet) {
        appState.isAdmin = false;
        return;
    }
    
    const currentWallet = appState.currentWallet.publicKey.toLowerCase().trim();
    const adminWallet = ADMIN_WALLET_ADDRESS.toLowerCase().trim();
    
    // Comparación exacta
    appState.isAdmin = (currentWallet === adminWallet);
    
    console.log('🔐 Verificación Admin:');
    console.log(' - Wallet actual:', currentWallet);
    console.log(' - Wallet admin:', adminWallet);
    console.log(' - Es admin?:', appState.isAdmin);

    // Actualizar UI
    const adminMenuItem = document.getElementById('admin-menu-item');
    
    if (appState.isAdmin) {
        if (adminMenuItem) adminMenuItem.classList.add('visible');
        showUserAlert('✅ Modo verificador activado', 'success');
        updateAdminWalletBalance();
    } else {
        if (adminMenuItem) adminMenuItem.classList.remove('visible');
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) adminPanel.classList.remove('active');
        showUserAlert('✅ Modo usuario normal activado', 'success');
    }
    
    // Re-renderizar sorteos para mostrar botones correctos
    renderRaffles();
}

function updateAdminWalletBalance() {
    if (!appState.isAdmin || !appState.currentWallet?.publicKey) return;
    
    try {
        const publicKey = new solanaWeb3.PublicKey(appState.currentWallet.publicKey);
        connection.getBalance(publicKey).then(balance => {
            const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;
            const balanceElement = document.getElementById('admin-wallet-balance');
            if (balanceElement) {
                balanceElement.textContent = `Balance: ${balanceInSOL.toFixed(4)} SOL`;
            }
        });
    } catch (error) {
        console.error('Error actualizando balance admin:', error);
    }
}

function updateWalletDisplay() {
    if (!appState.currentWallet) return;
    
    const { publicKey, balance } = appState.currentWallet;
    const shortAddress = `${publicKey.substring(0, 6)}...${publicKey.substring(publicKey.length - 4)}`;
    
    // Actualizar elementos de UI
    const elements = {
        'connected-wallet-address': shortAddress,
        'wallet-balance': `${balance.toFixed(4)} SOL`,
        'network-indicator': '🟢 Solana Testnet'
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
            element.style.display = 'block';
        }
    });
    
    // Actualizar botón de conexión
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
        connectBtn.innerHTML = '<span>✅ Conectado</span>';
        connectBtn.className = 'btn btn-success';
    }
    
    // Mostrar botones adicionales
    const additionalButtons = ['disconnect-wallet-btn', 'winner-info-btn'];
    additionalButtons.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'block';
    });
    
    // Actualizar estado de conexión
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.innerHTML = '<strong>Estado Wallet:</strong> ✅ Conectada';
    }
}

function disconnectWallet() {
    console.log('🔌 Desconectando wallet...');
    
    if (appState.currentWallet?.provider) {
        try {
            appState.currentWallet.provider.disconnect();
        } catch (error) {
            console.log('Wallet ya desconectada o no soporta disconnect');
        }
    }
    
    // Resetear estado
    appState.currentWallet = null;
    appState.isAdmin = false;
    appState.isConnected = false;
    
    // Resetear UI
    const elementsToHide = [
        'connected-wallet-address',
        'wallet-balance', 
        'disconnect-wallet-btn',
        'winner-info-btn'
    ];
    
    elementsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    // Resetear botón principal
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
        connectBtn.innerHTML = '<span>👛 Conectar Wallet</span>';
        connectBtn.className = 'btn';
    }
    
    // Resetear indicadores
    const networkIndicator = document.getElementById('network-indicator');
    if (networkIndicator) {
        networkIndicator.textContent = '🔴 Desconectado';
        networkIndicator.style.background = 'rgba(153, 69, 255, 0.2)';
    }
    
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.innerHTML = '<strong>Estado Wallet:</strong> Desconectado';
    }
    
    // Ocultar panel admin
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.classList.remove('active');
    
    // Re-renderizar sorteos
    renderRaffles();
    
    showUserAlert('🔌 Wallet desconectada', 'info');
}

// ===== FUNCIONES DE DATOS (MANTENIDAS) =====
async function loadInitialData() {
    showSkeletonLoaders();
    
    try {
        await Promise.all([
            loadRaffles(),
            loadWinners()
        ]);
        
        renderRaffles();
        renderWinnersArchive();
        hideSkeletonLoaders();
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        hideSkeletonLoaders();
        showUserAlert('Error cargando datos', 'error');
    }
}

async function loadRaffles() {
    if (!window.db) {
        console.log('Firebase no disponible - usando datos de ejemplo');
        createSampleRaffles();
        return;
    }

    try {
        const snapshot = await db.collection('raffles').get();
        appState.raffles = [];
        
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const raffleData = doc.data();
                raffleData.id = doc.id;
                
                // Asegurar campos requeridos
                if (!raffleData.soldNumbers) raffleData.soldNumbers = [];
                if (!raffleData.numberOwners) raffleData.numberOwners = {};
                if (raffleData.completed === undefined) raffleData.completed = false;
                if (raffleData.prizeClaimed === undefined) raffleData.prizeClaimed = false;
                if (!raffleData.shippingStatus) raffleData.shippingStatus = 'pending';
                
                appState.raffles.push(raffleData);
            });
            console.log(`✅ ${appState.raffles.length} sorteos cargados desde Firebase`);
        } else {
            console.log('📝 No hay sorteos en Firebase');
            createSampleRaffles();
        }
    } catch (error) {
        console.error('❌ Error cargando sorteos:', error);
        createSampleRaffles();
    }
}

function createSampleRaffles() {
    appState.raffles = [
        {
            id: 'sample_1',
            name: 'PlayStation 5 Edición Especial',
            description: 'Sorteo de una PlayStation 5 nueva en caja',
            price: 0.1,
            totalNumbers: 50,
            image: '🎮',
            prize: 'PlayStation 5',
            soldNumbers: [1, 2, 3, 4, 5, 10, 15, 20],
            numberOwners: {},
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        },
        {
            id: 'sample_2', 
            name: 'iPhone 15 Pro Max',
            description: 'Último modelo de iPhone con 512GB',
            price: 0.2,
            totalNumbers: 30,
            image: '📱',
            prize: 'iPhone 15 Pro Max',
            soldNumbers: [1, 5, 10, 15],
            numberOwners: {},
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        }
    ];
}

// ===== RENDERIZADO DE SORTEOS - CORREGIDO =====
function renderRaffles() {
    const container = document.getElementById('raffles-container');
    if (!container) return;
    
    const activeRaffles = appState.raffles.filter(raffle => !raffle.completed);
    
    if (activeRaffles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 3rem;">
                <h3>📝 No hay sorteos activos</h3>
                <p>Los sorteos aparecerán aquí pronto</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeRaffles.map(raffle => createRaffleCard(raffle)).join('');
    attachRaffleEventListeners();
}

function createRaffleCard(raffle) {
    const sold = raffle.soldNumbers?.length || 0;
    const total = raffle.totalNumbers || 100;
    const progress = total > 0 ? (sold / total) * 100 : 0;
    const isUserWinner = raffle.winner && appState.currentWallet?.publicKey === raffle.winner.wallet;
    
    const actionButton = createRaffleActionButton(raffle, sold, total, isUserWinner);
    const imageContent = raffle.image?.startsWith('http') 
        ? `<img src="${raffle.image}" alt="${raffle.name}" onerror="this.parentElement.innerHTML='🎁'">`
        : `<div style="font-size: 3rem;">${raffle.image || '🎁'}</div>`;
    
    return `
        <div class="raffle-card">
            <div class="raffle-image">${imageContent}</div>
            <div class="raffle-content">
                <h3 class="raffle-title">${raffle.name}</h3>
                <div class="raffle-price">${raffle.price || 0.1} SOL por número</div>
                <div class="raffle-info">
                    <span>🎯 ${raffle.prize || raffle.name}</span>
                    <span>🔢 ${sold}/${total} números</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${progress}%"></div>
                </div>
                <div class="raffle-info">
                    <span>🏆 ${raffle.winner ? 'Ganador seleccionado' : 'En progreso'}</span>
                    <span>${sold >= total ? '🔒 Completo' : '🟢 Disponible'}</span>
                </div>
                <div>
                    ${actionButton}
                </div>
            </div>
        </div>
    `;
}

// CORRECCIÓN CRÍTICA: Lógica de botones mejorada
function createRaffleActionButton(raffle, sold, total, isUserWinner) {
    console.log(`🎯 Renderizando botón para: ${raffle.name}`);
    console.log(`   - Es admin?: ${appState.isAdmin}`);
    console.log(`   - Vendidos: ${sold}/${total}`);
    
    // Si hay ganador
    if (raffle.winner) {
        if (isUserWinner) {
            if (raffle.prizeClaimed) {
                const status = getShippingStatus(raffle.shippingStatus);
                return `<button class="btn" style="width: 100%; background: ${status.color};" disabled>${status.icon} ${status.text}</button>`;
            } else {
                return `<button class="btn btn-success claim-btn" data-raffle="${raffle.id}" style="width: 100%;">🎉 Reclamar Premio</button>`;
            }
        } else {
            return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>❌ No Ganaste</button>`;
        }
    } 
    // Si está seleccionando ganador
    else if (raffle.isSelectingWinner) {
        return `<button class="btn" style="width: 100%; background: var(--warning);" disabled>⏳ Seleccionando...</button>`;
    } 
    // Si no hay ganador - CORRECCIÓN PRINCIPAL AQUÍ
    else {
        if (appState.isAdmin) {
            // Admin ve "Seleccionar Ganador" solo cuando están todos vendidos
            if (sold >= total) {
                return `<button class="btn btn-warning select-winner-btn" data-raffle="${raffle.id}" style="width: 100%;">🎰 Seleccionar Ganador</button>`;
            } else {
                // Admin ve "Esperando" cuando faltan números
                const remaining = total - sold;
                return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>⏳ Esperando (${remaining} restantes)</button>`;
            }
        } else {
            // Usuario normal ve "Participar" cuando hay números disponibles
            if (sold >= total) {
                return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>🔒 Todos vendidos</button>`;
            } else {
                return `<button class="btn participate-btn" data-raffle="${raffle.id}" style="width: 100%;">🎫 Participar (${raffle.price} SOL)</button>`;
            }
        }
    }
}

function getShippingStatus(status) {
    const statuses = {
        pending: { text: 'Pendiente', color: 'var(--warning)', icon: '⏳' },
        claimed: { text: 'Reclamado', color: 'var(--info)', icon: '📦' },
        shipped: { text: 'Enviado', color: 'var(--primary)', icon: '🚚' },
        delivered: { text: 'Entregado', color: 'var(--success)', icon: '✅' }
    };
    return statuses[status] || statuses.pending;
}

function attachRaffleEventListeners() {
    // Botones de participación
    document.querySelectorAll('.participate-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!appState.currentWallet) {
                showUserAlert('🔗 Conecta tu wallet primero', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            const raffleId = e.target.getAttribute('data-raffle');
            console.log('🎫 Participando en sorteo:', raffleId);
            openNumberSelection(raffleId);
        });
    });
    
    // Botones de selección de ganador (admin)
    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!appState.isAdmin) {
                showUserAlert('❌ Solo el administrador puede seleccionar ganadores', 'error');
                return;
            }
            const raffleId = e.target.getAttribute('data-raffle');
            console.log('🎰 Seleccionando ganador para:', raffleId);
            selectWinner(raffleId);
        });
    });
    
    // Botones de reclamar premio
    document.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const raffleId = e.target.getAttribute('data-raffle');
            console.log('🎉 Reclamando premio para:', raffleId);
            openClaimModal(raffleId);
        });
    });
}

// ===== FUNCIONES RESTANTES (MANTENIDAS) =====
function showSkeletonLoaders() {
    const containers = {
        'raffles-container': `
            <div class="skeleton-raffle"></div>
            <div class="skeleton-raffle"></div>
            <div class="skeleton-raffle"></div>
        `,
        'winners-container': `
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
        `
    };
    
    Object.keys(containers).forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = containers[id];
    });
}

function hideSkeletonLoaders() {
    // Se ocultan automáticamente al renderizar contenido real
}

function renderWinnersArchive() {
    const container = document.getElementById('winners-container');
    if (!container) return;
    
    if (appState.winners.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 2rem;">
                <h3>📝 Aún no hay ganadores</h3>
                <p>Los ganadores aparecerán aquí después de cada sorteo</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.winners.map(winner => `
        <div class="winner-card">
            <div class="winner-header">
                <div class="winner-prize">${winner.prize}</div>
                <div class="winner-date">${new Date(winner.winnerDate).toLocaleDateString('es-ES')}</div>
            </div>
            <div class="winner-details">
                <div><strong>Sorteo:</strong> ${winner.raffleName}</div>
                <div><strong>Número ganador:</strong> ${winner.winningNumber}</div>
                <div><strong>Wallet:</strong> <span class="winner-wallet">${winner.winnerWallet.substring(0, 8)}...${winner.winnerWallet.substring(winner.winnerWallet.length - 4)}</span></div>
                ${winner.winnerInfo ? `<div><strong>Ganador:</strong> ${winner.winnerInfo.name}</div>` : ''}
            </div>
        </div>
    `).join('');
}

// ===== UTILITY FUNCTIONS =====
function showUserAlert(message, type = 'info', duration = 5000) {
    const alert = document.getElementById('user-alert');
    const icon = document.getElementById('alert-icon');
    const msg = document.getElementById('alert-message');
    
    if (!alert || !icon || !msg) return;
    
    alert.className = `user-alert ${type}`;
    icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    msg.textContent = message;
    alert.style.display = 'block';
    
    if (duration > 0) {
        setTimeout(() => {
            alert.style.display = 'none';
        }, duration);
    }
}

function hideUserAlert() {
    const alert = document.getElementById('user-alert');
    if (alert) alert.style.display = 'none';
}

function updateConnectionStatus(status, message) {
    const statusElement = document.getElementById('real-connection-status');
    if (!statusElement) return;
    
    switch(status) {
        case 'connected':
            statusElement.innerHTML = `<strong>Estado Blockchain:</strong> ✅ Conectado a Solana Testnet<br><small>${message}</small>`;
            break;
        case 'error':
            statusElement.innerHTML = `<strong>Estado Blockchain:</strong> ❌ Error de conexión`;
            break;
        default:
            statusElement.innerHTML = `<strong>Estado Blockchain:</strong> Conectando...`;
    }
}

// ===== EVENT LISTENERS SETUP =====
function setupAllEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Wallet Modal
    safeAddListener('connect-wallet-btn', 'click', () => {
        document.getElementById('wallet-modal').classList.add('active');
    });
    
    safeAddListener('close-wallet-modal', 'click', () => {
        document.getElementById('wallet-modal').classList.remove('active');
    });
    
    safeAddListener('connect-phantom-real', 'click', () => connectWallet('phantom'));
    safeAddListener('connect-solflare-real', 'click', () => connectWallet('solflare'));
    safeAddListener('disconnect-wallet-btn', 'click', disconnectWallet);
    
    // Admin Panel
    safeAddListener('admin-panel-link', 'click', (e) => {
        e.preventDefault();
        if (appState.isAdmin) {
            document.getElementById('admin-panel').classList.add('active');
        } else {
            showUserAlert('❌ Solo administradores', 'error');
        }
    });
    
    safeAddListener('close-admin-panel', 'click', () => {
        document.getElementById('admin-panel').classList.remove('active');
    });
    
    // FAQ Toggles
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
    
    // Close Alerts
    safeAddListener('close-alert', 'click', hideUserAlert);
    
    console.log('✅ Todos los event listeners configurados');
}

function safeAddListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
        console.log(`✅ Listener agregado: ${id}`);
    } else {
        console.warn(`⚠️ Elemento no encontrado: ${id}`);
    }
}

// ===== FUNCIONES DE EMERGENCIA =====
function forceUserMode() {
    console.log('🔧 Forzando modo usuario...');
    appState.isAdmin = false;
    
    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem) adminMenuItem.classList.remove('visible');
    
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.classList.remove('active');
    
    renderRaffles();
    showUserAlert('🔧 Modo usuario activado forzadamente', 'info');
}

function diagnoseConnection() {
    console.log('🔍 Diagnóstico de conexión:');
    console.log(' - Phantom disponible:', !!window.solana);
    console.log(' - Solflare disponible:', !!window.solflare);
    console.log(' - Wallet conectada:', appState.currentWallet?.publicKey);
    console.log(' - Es admin?:', appState.isAdmin);
}

// Agregar botón de diagnóstico
setTimeout(() => {
    const diagnosticBtn = document.createElement('button');
    diagnosticBtn.textContent = '🔧 Diagnóstico';
    diagnosticBtn.className = 'btn btn-info btn-small';
    diagnosticBtn.style.position = 'fixed';
    diagnosticBtn.style.bottom = '10px';
    diagnosticBtn.style.right = '10px';
    diagnosticBtn.style.zIndex = '10000';
    
    diagnosticBtn.addEventListener('click', function() {
        diagnoseConnection();
        showUserAlert('🔍 Diagnóstico ejecutado - mira la consola', 'info');
    });
    
    document.body.appendChild(diagnosticBtn);
}, 2000);

console.log('🎯 VeriRifa-Sol - Script cargado y listo');
