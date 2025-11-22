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
    currentPage: 1,
    firebaseAvailable: false
};

// ===== DIAGNÓSTICO INICIAL =====
function runDiagnostics() {
    console.log('🔍 DIAGNÓSTICO INICIAL:');
    console.log('✅ Firebase disponible:', typeof firebase !== 'undefined');
    console.log('✅ Solana Web3 disponible:', typeof solanaWeb3 !== 'undefined');
    console.log('✅ Phantom disponible:', typeof window.solana !== 'undefined');
    console.log('✅ Solflare disponible:', typeof window.solflare !== 'undefined');
    
    if (typeof firebase !== 'undefined') {
        console.log('✅ Firebase apps:', firebase.apps.length);
    }
}

// ===== INICIALIZACIÓN PRINCIPAL =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando VeriRifa-Sol...');
    runDiagnostics();
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('1. Inicializando Firebase...');
        const firebaseOK = await initializeFirebase();
        
        console.log('2. Configurando event listeners...');
        setupAllEventListeners();
        
        console.log('3. Conectando a blockchain...');
        await initializeBlockchain();
        
        console.log('4. Cargando datos iniciales...');
        await loadInitialData();
        
        if (firebaseOK) {
            showUserAlert('✅ VeriRifa-Sol cargada con Firebase', 'success');
        } else {
            showUserAlert('⚠️ VeriRifa-Sol en modo local (sin Firebase)', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        showUserAlert('❌ Error al cargar la aplicación', 'error');
    }
}

// ===== FIREBASE SIMPLIFICADO =====
async function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.log('❌ Firebase no está disponible en esta página');
            appState.firebaseAvailable = false;
            return false;
        }

        // Inicializar Firebase solo si no está inicializado
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
            console.log('🔥 Firebase inicializado');
        }

        window.db = firebase.firestore();
        
        // Probar la conexión con una operación simple
        const testDoc = await db.collection('test').doc('connection').get();
        console.log('✅ Firebase conectado correctamente');
        
        appState.firebaseAvailable = true;
        return true;
        
    } catch (error) {
        console.error('❌ Error de Firebase:', error);
        appState.firebaseAvailable = false;
        
        // Crear una simulación de Firebase para que la app funcione
        window.db = {
            collection: (name) => ({
                doc: (id) => ({
                    set: (data) => {
                        console.log('📝 [SIMULACIÓN] Guardando en Firebase:', { collection: name, id, data });
                        return Promise.resolve();
                    },
                    update: (data) => {
                        console.log('📝 [SIMULACIÓN] Actualizando en Firebase:', { collection: name, id, data });
                        return Promise.resolve();
                    },
                    get: () => Promise.resolve({ exists: false })
                }),
                get: () => Promise.resolve({ empty: true, forEach: (fn) => {} }),
                where: () => ({ 
                    orderBy: () => ({ 
                        get: () => Promise.resolve({ empty: true, forEach: (fn) => {} }) 
                    }) 
                })
            })
        };
        
        return false;
    }
}

// ===== FUNCIONES FIREBASE MEJORADAS =====
async function saveRaffleToFirebase(raffle) {
    if (!appState.firebaseAvailable) {
        console.log('📝 [MODO LOCAL] Sorteo creado localmente:', raffle.id);
        return true; // En modo local, siempre "éxito"
    }

    try {
        console.log('🔥 Intentando guardar en Firebase...');
        await db.collection('raffles').doc(raffle.id).set(raffle);
        console.log('✅ Sorteo guardado en Firebase:', raffle.id);
        return true;
    } catch (error) {
        console.error('❌ Error guardando en Firebase:', error);
        return false;
    }
}

async function updateRaffleInFirebase(raffleId, updates) {
    if (!appState.firebaseAvailable) {
        console.log('📝 [MODO LOCAL] Sorteo actualizado localmente:', raffleId);
        return true;
    }

    try {
        await db.collection('raffles').doc(raffleId).update(updates);
        console.log('✅ Sorteo actualizado en Firebase:', raffleId);
        return true;
    } catch (error) {
        console.error('❌ Error actualizando en Firebase:', error);
        return false;
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
        console.log('✅ Conectado a Solana Testnet');
        
        updateConnectionStatus('connected', `Versión: ${version['solana-core']}`);
        return true;
    } catch (error) {
        console.error('❌ Error conectando a blockchain:', error);
        updateConnectionStatus('error', 'No se pudo conectar');
        return false;
    }
}

function updateConnectionStatus(status, message) {
    const statusElement = document.getElementById('real-connection-status');
    if (!statusElement) return;
    
    statusElement.innerHTML = status === 'connected' 
        ? `<strong>Estado Blockchain:</strong> ✅ Conectado a Solana Testnet`
        : `<strong>Estado Blockchain:</strong> ❌ Error de conexión`;
}

// ===== WALLET CONNECTION MEJORADA =====
async function connectWallet(walletType) {
    console.log(`🔗 Conectando ${walletType}...`);
    
    try {
        let provider;
        if (walletType === 'phantom') {
            provider = window.solana;
        } else if (walletType === 'solflare') {
            provider = window.solflare;
        }

        if (!provider) {
            throw new Error(`${walletType} no detectada`);
        }

        // Conectar wallet
        if (!provider.isConnected) {
            await provider.connect();
        }

        const publicKey = provider.publicKey;
        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;

        appState.currentWallet = {
            publicKey: publicKey.toString(),
            provider: provider,
            balance: balanceInSOL
        };

        updateWalletDisplay();
        checkAdminStatus();
        
        // Cerrar modal
        document.getElementById('wallet-modal').classList.remove('active');
        
        showUserAlert(`✅ ${walletType} conectada`, 'success');
        return true;

    } catch (error) {
        console.error(`❌ Error conectando ${walletType}:`, error);
        showUserAlert(`❌ Error conectando ${walletType}`, 'error');
        return false;
    }
}

function updateWalletDisplay() {
    if (!appState.currentWallet) return;
    
    const { publicKey, balance } = appState.currentWallet;
    const shortAddress = `${publicKey.substring(0, 6)}...${publicKey.substring(publicKey.length - 4)}`;
    
    // Actualizar UI
    document.getElementById('connected-wallet-address').textContent = shortAddress;
    document.getElementById('connected-wallet-address').style.display = 'block';
    
    document.getElementById('wallet-balance').textContent = `${balance.toFixed(4)} SOL`;
    document.getElementById('wallet-balance').style.display = 'block';
    
    document.getElementById('connect-wallet-btn').innerHTML = '✅ Conectado';
    document.getElementById('network-indicator').textContent = '🟢 Solana Testnet';
    
    document.getElementById('disconnect-wallet-btn').style.display = 'block';
    document.getElementById('winner-info-btn').style.display = 'block';
}

function checkAdminStatus() {
    if (!appState.currentWallet) {
        appState.isAdmin = false;
        hideAdminMenu();
        return;
    }
    
    appState.isAdmin = (appState.currentWallet.publicKey === ADMIN_WALLET_ADDRESS);
    const adminMenuItem = document.getElementById('admin-menu-item');
    
    if (adminMenuItem) {
        if (appState.isAdmin) {
            adminMenuItem.classList.add('visible');
            showUserAlert('✅ Modo administrador activado', 'success');
        } else {
            adminMenuItem.classList.remove('visible');
        }
    }
}

function showAdminMenu() {
    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem) adminMenuItem.classList.add('visible');
}

function hideAdminMenu() {
    const adminMenuItem = document.getElementById('admin-menu-item');
    const adminPanel = document.getElementById('admin-panel');
    
    if (adminMenuItem) adminMenuItem.classList.remove('visible');
    if (adminPanel) adminPanel.classList.remove('active');
}

function disconnectWallet() {
    if (appState.currentWallet?.provider) {
        try {
            appState.currentWallet.provider.disconnect();
        } catch (error) {
            console.log('Wallet ya desconectada');
        }
    }
    
    // Resetear estado
    appState.currentWallet = null;
    appState.isAdmin = false;
    
    // Resetear UI
    document.getElementById('connected-wallet-address').style.display = 'none';
    document.getElementById('wallet-balance').style.display = 'none';
    document.getElementById('disconnect-wallet-btn').style.display = 'none';
    document.getElementById('winner-info-btn').style.display = 'none';
    
    document.getElementById('connect-wallet-btn').innerHTML = '<span>👛 Conectar Wallet</span>';
    document.getElementById('network-indicator').textContent = '🔴 Desconectado';
    
    hideAdminMenu();
    showUserAlert('🔌 Wallet desconectada', 'info');
}

// ===== GESTIÓN DE DATOS =====
async function loadInitialData() {
    showSkeletonLoaders();
    
    try {
        await loadRaffles();
        await loadWinners();
        
        renderRaffles();
        renderWinnersArchive();
        hideSkeletonLoaders();
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        hideSkeletonLoaders();
    }
}

async function loadRaffles() {
    if (!appState.firebaseAvailable) {
        console.log('📝 Usando datos de ejemplo (modo local)');
        createSampleRaffles();
        return;
    }

    try {
        const snapshot = await db.collection('raffles')
            .where('completed', '==', false)
            .orderBy('createdAt', 'desc')
            .get();
            
        appState.raffles = [];
        
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const raffle = { id: doc.id, ...doc.data() };
                appState.raffles.push(raffle);
            });
            console.log(`✅ ${appState.raffles.length} sorteos cargados`);
        } else {
            createSampleRaffles();
        }
    } catch (error) {
        console.error('Error cargando sorteos:', error);
        createSampleRaffles();
    }
}

function createSampleRaffles() {
    appState.raffles = [
        {
            id: 'sample_1',
            name: 'PlayStation 5',
            description: 'Sorteo de PS5 nueva',
            price: 0.1,
            totalNumbers: 50,
            image: '🎮',
            prize: 'PlayStation 5',
            soldNumbers: [1, 2, 3, 4, 5],
            numberOwners: {},
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        }
    ];
}

async function loadWinners() {
    if (!appState.firebaseAvailable) {
        appState.winners = [];
        return;
    }

    try {
        const snapshot = await db.collection('winners').orderBy('winnerDate', 'desc').get();
        appState.winners = [];
        
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                appState.winners.push({ id: doc.id, ...doc.data() });
            });
        }
    } catch (error) {
        console.error('Error cargando ganadores:', error);
        appState.winners = [];
    }
}

// ===== UI RENDERING =====
function showSkeletonLoaders() {
    const containers = {
        'raffles-container': `
            <div class="skeleton-raffle"></div>
            <div class="skeleton-raffle"></div>
        `,
        'winners-container': `
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
        `
    };
    
    Object.keys(containers).forEach(id => {
        const container = document.getElementById(id);
        if (container) container.innerHTML = containers[id];
    });
}

function hideSkeletonLoaders() {
    // Se ocultan al renderizar contenido
}

function renderRaffles() {
    const container = document.getElementById('raffles-container');
    if (!container) return;
    
    if (appState.raffles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 3rem;">
                <h3>📝 No hay sorteos activos</h3>
                <p>Crea el primer sorteo desde el panel de administración</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.raffles.map(raffle => `
        <div class="raffle-card">
            <div class="raffle-image">
                <div style="font-size: 3rem;">${raffle.image || '🎁'}</div>
            </div>
            <div class="raffle-content">
                <h3 class="raffle-title">${raffle.name}</h3>
                <div class="raffle-price">${raffle.price} SOL por número</div>
                <div class="raffle-info">
                    <span>🎯 ${raffle.prize}</span>
                    <span>🔢 ${raffle.soldNumbers?.length || 0}/${raffle.totalNumbers} números</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${((raffle.soldNumbers?.length || 0) / raffle.totalNumbers) * 100}%"></div>
                </div>
                ${createRaffleActionButton(raffle)}
            </div>
        </div>
    `).join('');
    
    attachRaffleEventListeners();
}

function createRaffleActionButton(raffle) {
    const sold = raffle.soldNumbers?.length || 0;
    const total = raffle.totalNumbers;
    
    if (raffle.winner) {
        const isUserWinner = appState.currentWallet && raffle.winner.wallet === appState.currentWallet.publicKey;
        if (isUserWinner) {
            return `<button class="btn btn-success claim-btn" data-raffle="${raffle.id}" style="width: 100%;">🎉 Reclamar Premio</button>`;
        } else {
            return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>❌ No Ganaste</button>`;
        }
    } else {
        if (appState.isAdmin) {
            if (sold >= total) {
                return `<button class="btn btn-warning select-winner-btn" data-raffle="${raffle.id}" style="width: 100%;">🎰 Seleccionar Ganador</button>`;
            } else {
                return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>⏳ Esperando (${total - sold} restantes)</button>`;
            }
        } else {
            if (sold >= total) {
                return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>🔒 Todos vendidos</button>`;
            } else {
                return `<button class="btn participate-btn" data-raffle="${raffle.id}" style="width: 100%;">🎫 Participar (${raffle.price} SOL)</button>`;
            }
        }
    }
}

function attachRaffleEventListeners() {
    document.querySelectorAll('.participate-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!appState.currentWallet) {
                showUserAlert('🔗 Conecta tu wallet primero', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            openNumberSelection(e.target.getAttribute('data-raffle'));
        });
    });
    
    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectWinner(e.target.getAttribute('data-raffle'));
        });
    });
    
    document.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openClaimModal(e.target.getAttribute('data-raffle'));
        });
    });
}

function renderWinnersArchive() {
    const container = document.getElementById('winners-container');
    if (!container) return;
    
    if (appState.winners.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 2rem;">
                <h3>📝 Aún no hay ganadores</h3>
                <p>Los ganadores aparecerán aquí</p>
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
            </div>
        </div>
    `).join('');
}

// ===== CREACIÓN DE SORTEOS - VERSIÓN SIMPLIFICADA =====
async function createRaffle(event) {
    event.preventDefault();
    console.log('🎯 Iniciando creación de sorteo...');
    
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo administradores', 'error');
        return;
    }
    
    const formData = {
        name: document.getElementById('raffle-name').value.trim(),
        description: document.getElementById('raffle-description').value.trim(),
        price: parseFloat(document.getElementById('ticket-price').value),
        totalNumbers: parseInt(document.getElementById('max-numbers').value),
        image: document.getElementById('raffle-image').value.trim() || '🎁'
    };
    
    // Validación
    if (!formData.name || !formData.description || formData.price <= 0 || formData.totalNumbers <= 0) {
        showUserAlert('❌ Completa todos los campos correctamente', 'error');
        return;
    }

    try {
        const statusEl = document.getElementById('transaction-status');
        const detailsEl = document.getElementById('transaction-details');
        
        statusEl.style.display = 'block';
        detailsEl.textContent = '⏳ Creando sorteo...';
        
        const newRaffle = {
            id: 'raffle_' + Date.now(),
            ...formData,
            prize: formData.name,
            soldNumbers: [],
            numberOwners: {},
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: appState.currentWallet.publicKey
        };
        
        console.log('📦 Datos del sorteo:', newRaffle);
        
        // Guardar en Firebase
        const saved = await saveRaffleToFirebase(newRaffle);
        
        if (saved) {
            appState.raffles.push(newRaffle);
            detailsEl.textContent = appState.firebaseAvailable 
                ? '✅ Sorteo creado y guardado en Firebase' 
                : '✅ Sorteo creado (modo local)';
            statusEl.className = 'transaction-status transaction-success';
            
            // Limpiar formulario
            document.getElementById('create-raffle-form').reset();
            document.getElementById('image-preview').innerHTML = '<div class="emoji-preview">🖼️</div>';
            
            showUserAlert('🎯 Sorteo creado exitosamente', 'success');
            
            setTimeout(() => {
                statusEl.style.display = 'none';
                renderRaffles();
            }, 2000);
            
        } else {
            throw new Error('No se pudo guardar el sorteo');
        }
        
    } catch (error) {
        console.error('❌ Error creando sorteo:', error);
        document.getElementById('transaction-details').textContent = '❌ Error creando sorteo';
        document.getElementById('transaction-status').className = 'transaction-status transaction-error';
        showUserAlert('❌ Error creando sorteo', 'error');
    }
}

// ===== FUNCIONES RESTANTES (simplificadas) =====
function openNumberSelection(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) return;
    
    appState.currentRaffle = raffle;
    appState.selectedNumbers = [];
    
    document.getElementById('modal-raffle-name').textContent = raffle.name;
    document.getElementById('price-per-number').textContent = `${raffle.price} SOL`;
    document.getElementById('user-balance').textContent = `${appState.currentWallet.balance.toFixed(4)} SOL`;
    
    document.getElementById('number-selection-modal').classList.add('active');
}

function selectWinner(raffleId) {
    if (!appState.isAdmin) return;
    
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle || raffle.soldNumbers?.length === 0) return;
    
    // Simular selección de ganador
    const winningNumber = raffle.soldNumbers[Math.floor(Math.random() * raffle.soldNumbers.length)];
    const winnerWallet = raffle.numberOwners[winningNumber];
    
    raffle.winner = { number: winningNumber, wallet: winnerWallet };
    raffle.completed = true;
    
    showUserAlert(`🏆 ¡Ganador seleccionado! Número: ${winningNumber}`, 'success');
    renderRaffles();
}

function openClaimModal(raffleId) {
    document.getElementById('claim-prize-modal').classList.add('active');
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
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, duration);
}

function hideUserAlert() {
    const alert = document.getElementById('user-alert');
    if (alert) alert.style.display = 'none';
}

function showUserWinnings() {
    if (!appState.currentWallet) {
        showUserAlert('🔗 Conecta tu wallet primero', 'warning');
        return;
    }
    
    const userWinnings = appState.raffles.filter(r => 
        r.winner && r.winner.wallet === appState.currentWallet.publicKey
    );
    
    if (userWinnings.length === 0) {
        showUserAlert('📝 No has ganado ningún sorteo', 'info');
    } else {
        showUserAlert('🏆 ¡Has ganado sorteos! Reclama tu premio', 'success');
    }
}

// ===== EVENT LISTENERS =====
function setupAllEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Wallet
    document.getElementById('connect-wallet-btn').addEventListener('click', () => {
        document.getElementById('wallet-modal').classList.add('active');
    });
    
    document.getElementById('close-wallet-modal').addEventListener('click', () => {
        document.getElementById('wallet-modal').classList.remove('active');
    });
    
    document.getElementById('connect-phantom-real').addEventListener('click', () => connectWallet('phantom'));
    document.getElementById('connect-solflare-real').addEventListener('click', () => connectWallet('solflare'));
    document.getElementById('disconnect-wallet-btn').addEventListener('click', disconnectWallet);
    
    // Admin
    document.getElementById('admin-panel-link').addEventListener('click', (e) => {
        e.preventDefault();
        if (appState.isAdmin) {
            document.getElementById('admin-panel').classList.add('active');
        }
    });
    
    document.getElementById('close-admin-panel').addEventListener('click', () => {
        document.getElementById('admin-panel').classList.remove('active');
    });
    
    // Modales
    document.getElementById('close-number-modal').addEventListener('click', () => {
        document.getElementById('number-selection-modal').classList.remove('active');
    });
    
    document.getElementById('close-claim-modal').addEventListener('click', () => {
        document.getElementById('claim-prize-modal').classList.remove('active');
    });
    
    // Formularios
    document.getElementById('create-raffle-form').addEventListener('submit', createRaffle);
    document.getElementById('winner-info-btn').addEventListener('click', showUserWinnings);
    
    // Image Preview
    document.getElementById('raffle-image').addEventListener('input', function() {
        const preview = document.getElementById('image-preview');
        const value = this.value.trim();
        preview.innerHTML = value ? `<div class="emoji-preview">${value}</div>` : '<div class="emoji-preview">🖼️</div>';
    });
    
    // Cerrar modales al hacer click fuera
    window.addEventListener('click', (e) => {
        if (e.target.id === 'wallet-modal') document.getElementById('wallet-modal').classList.remove('active');
        if (e.target.id === 'number-selection-modal') document.getElementById('number-selection-modal').classList.remove('active');
        if (e.target.id === 'claim-prize-modal') document.getElementById('claim-prize-modal').classList.remove('active');
    });
    
    console.log('✅ Event listeners configurados');
}

console.log('🎯 VeriRifa-Sol - Script cargado');
