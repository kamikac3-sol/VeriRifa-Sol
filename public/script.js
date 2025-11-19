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
const LAMPORTS_PER_SOL = 1000000000;

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

// ===== FIREBASE CORREGIDO =====
async function initializeFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
            console.log('✅ Firebase app inicializado');
        }
        window.db = firebase.firestore();
        
        // Configurar persistencia
        try {
            await db.enablePersistence();
            console.log('✅ Persistencia de Firebase activada');
        } catch (persistenceError) {
            console.warn('⚠️ Persistencia no disponible:', persistenceError);
        }
        
        console.log('✅ Firebase configurado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error en Firebase:', error);
        showUserAlert('⚠️ Firebase no disponible - Modo local activado', 'warning');
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
        console.log('✅ Conectado a Solana Testnet:', version);
        
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

// ===== WALLET CONNECTION =====
async function connectWallet(walletType) {
    console.log(`🔗 Intentando conectar ${walletType}...`);
    
    try {
        let provider;
        if (walletType === 'phantom') {
            provider = window.solana;
            if (!provider || !provider.isPhantom) {
                throw new Error('Phantom Wallet no detectada');
            }
        } else if (walletType === 'solflare') {
            provider = window.solflare;
            if (!provider) {
                throw new Error('Solflare Wallet no detectada');
            }
        } else {
            throw new Error('Tipo de wallet no soportado');
        }

        // Solicitar conexión
        if (!provider.isConnected) {
            await provider.connect();
        }

        const publicKey = provider.publicKey;
        if (!publicKey) {
            throw new Error('No se pudo obtener la clave pública');
        }

        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / LAMPORTS_PER_SOL;

        appState.currentWallet = {
            publicKey: publicKey.toString(),
            provider: provider,
            balance: balanceInSOL
        };

        appState.isConnected = true;
        updateWalletDisplay();
        checkAdminStatus();
        
        // Cerrar modal
        const walletModal = document.getElementById('wallet-modal');
        if (walletModal) walletModal.classList.remove('active');
        
        showUserAlert(`✅ ${walletType} conectada correctamente`, 'success');
        return true;

    } catch (error) {
        console.error(`❌ Error conectando ${walletType}:`, error);
        
        let errorMessage = `Error conectando ${walletType}`;
        if (error.message.includes('User rejected')) {
            errorMessage = 'Usuario canceló la conexión';
        } else if (error.message.includes('not detected') || error.message.includes('no detectada')) {
            errorMessage = `${walletType} no detectada. ¿Está instalada?`;
        }
        
        showUserAlert(`❌ ${errorMessage}`, 'error');
        return false;
    }
}

function updateWalletDisplay() {
    if (!appState.currentWallet) return;
    
    const { publicKey, balance } = appState.currentWallet;
    const shortAddress = `${publicKey.substring(0, 6)}...${publicKey.substring(publicKey.length - 4)}`;
    
    // Actualizar elementos de UI
    const walletAddress = document.getElementById('connected-wallet-address');
    const walletBalance = document.getElementById('wallet-balance');
    const connectBtn = document.getElementById('connect-wallet-btn');
    const networkIndicator = document.getElementById('network-indicator');
    const disconnectBtn = document.getElementById('disconnect-wallet-btn');
    const winnerInfoBtn = document.getElementById('winner-info-btn');
    
    if (walletAddress) {
        walletAddress.textContent = shortAddress;
        walletAddress.style.display = 'block';
    }
    
    if (walletBalance) {
        walletBalance.textContent = `${balance.toFixed(4)} SOL`;
        walletBalance.style.display = 'block';
    }
    
    if (connectBtn) {
        connectBtn.innerHTML = '<span>✅ Conectado</span>';
    }
    
    if (networkIndicator) {
        networkIndicator.textContent = '🟢 Solana Testnet';
    }
    
    if (disconnectBtn) disconnectBtn.style.display = 'block';
    if (winnerInfoBtn) winnerInfoBtn.style.display = 'block';
    
    // Actualizar estado de conexión
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.innerHTML = '<strong>Estado Wallet:</strong> ✅ Conectada';
    }
}

function checkAdminStatus() {
    if (!appState.currentWallet) return;
    
    appState.isAdmin = (appState.currentWallet.publicKey === ADMIN_WALLET_ADDRESS);
    const adminMenuItem = document.getElementById('admin-menu-item');
    
    if (adminMenuItem) {
        if (appState.isAdmin) {
            adminMenuItem.classList.add('visible');
            showUserAlert('✅ Modo verificador activado', 'success');
            
            // Mostrar panel admin automáticamente
            document.getElementById('admin-panel').classList.add('active');
        } else {
            adminMenuItem.classList.remove('visible');
        }
    }
}

function disconnectWallet() {
    console.log('🔌 Desconectando wallet...');
    
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
    }
    
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.innerHTML = '<strong>Estado Wallet:</strong> Desconectado';
    }
    
    // Ocultar panel admin
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.classList.remove('active');
    
    showUserAlert('🔌 Wallet desconectada', 'info');
}

// ===== FIREBASE FUNCTIONS =====
async function saveRaffleToFirebase(raffle) {
    try {
        if (!window.db) {
            console.error('Firebase no inicializado');
            return false;
        }
        
        await db.collection('raffles').doc(raffle.id).set(raffle);
        console.log('✅ Sorteo guardado en Firebase:', raffle.id);
        return true;
    } catch (error) {
        console.error('❌ Error guardando en Firebase:', error);
        return false;
    }
}

async function updateRaffleInFirebase(raffleId, updates) {
    try {
        if (!window.db) {
            console.error('Firebase no inicializado');
            return false;
        }
        
        await db.collection('raffles').doc(raffleId).update(updates);
        console.log('✅ Sorteo actualizado en Firebase:', raffleId);
        return true;
    } catch (error) {
        console.error('❌ Error actualizando en Firebase:', error);
        return false;
    }
}

async function saveWinnerToFirebase(winnerData) {
    try {
        if (!window.db) {
            console.error('Firebase no inicializado');
            return false;
        }
        
        const winnerRef = await db.collection('winners').add(winnerData);
        console.log('✅ Ganador guardado en Firebase:', winnerRef.id);
        return winnerRef.id;
    } catch (error) {
        console.error('❌ Error guardando ganador:', error);
        return null;
    }
}

// ===== TRANSACCIONES REALES DE SOLANA =====
async function sendSolanaTransaction(recipientAddress, amountInSOL) {
    try {
        if (!appState.currentWallet?.provider) {
            throw new Error('Wallet no conectada');
        }

        const provider = appState.currentWallet.provider;
        const connection = window.connection;

        // Convertir SOL a lamports
        const amountInLamports = Math.floor(amountInSOL * LAMPORTS_PER_SOL);
        
        // Crear transacción
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: new solanaWeb3.PublicKey(appState.currentWallet.publicKey),
                toPubkey: new solanaWeb3.PublicKey(recipientAddress),
                lamports: amountInLamports,
            })
        );

        // Obtener blockhash reciente
        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new solanaWeb3.PublicKey(appState.currentWallet.publicKey);

        // Firmar transacción
        const signedTransaction = await provider.signTransaction(transaction);
        
        // Enviar transacción
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        // Confirmar transacción
        await connection.confirmTransaction(signature, 'confirmed');
        
        console.log('✅ Transacción exitosa:', signature);
        return {
            success: true,
            signature: signature,
            amount: amountInSOL
        };

    } catch (error) {
        console.error('❌ Error en transacción:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== DATA MANAGEMENT =====
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
        const snapshot = await db.collection('raffles').orderBy('createdAt', 'desc').get();
        appState.raffles = [];
        
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const raffle = { 
                    id: doc.id, 
                    ...doc.data(),
                    // Asegurar campos requeridos
                    soldNumbers: doc.data().soldNumbers || [],
                    numberOwners: doc.data().numberOwners || {},
                    completed: doc.data().completed || false,
                    prizeClaimed: doc.data().prizeClaimed || false,
                    shippingStatus: doc.data().shippingStatus || 'pending',
                    totalCollected: doc.data().totalCollected || 0
                };
                appState.raffles.push(raffle);
            });
            console.log(`✅ ${appState.raffles.length} sorteos cargados desde Firebase`);
        } else {
            console.log('📝 No hay sorteos en Firebase - creando ejemplos');
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
            id: 'sample_1_' + Date.now(),
            name: 'PlayStation 5 Edición Especial',
            description: 'Sorteo de una PlayStation 5 nueva en caja',
            price: 0.1,
            totalNumbers: 50,
            image: '🎮',
            prize: 'PlayStation 5',
            soldNumbers: [1, 2, 3, 4, 5, 10, 15, 20],
            numberOwners: {
                1: 'EjemploWallet1',
                2: 'EjemploWallet2',
                3: 'EjemploWallet3'
            },
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString(),
            totalCollected: 0.8
        },
        {
            id: 'sample_2_' + Date.now(), 
            name: 'iPhone 15 Pro Max',
            description: 'Último modelo de iPhone con 512GB',
            price: 0.2,
            totalNumbers: 30,
            image: '📱',
            prize: 'iPhone 15 Pro Max',
            soldNumbers: [1, 5, 10, 15],
            numberOwners: {
                1: 'EjemploWallet4',
                5: 'EjemploWallet5'
            },
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString(),
            totalCollected: 0.4
        }
    ];
}

async function loadWinners() {
    if (!window.db) {
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
            console.log(`✅ ${appState.winners.length} ganadores cargados`);
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

function renderRaffles() {
    const container = document.getElementById('raffles-container');
    if (!container) return;
    
    const activeRaffles = appState.raffles.filter(raffle => !raffle.completed);
    
    if (activeRaffles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 3rem;">
                <h3>📝 No hay sorteos activos</h3>
                <p>Los sorteos aparecerán aquí pronto</p>
                ${appState.isAdmin ? '<button class="btn" onclick="document.getElementById(\'admin-panel\').classList.add(\'active\')">Crear Primer Sorteo</button>' : ''}
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
                ${actionButton}
            </div>
        </div>
    `;
}

function createRaffleActionButton(raffle, sold, total, isUserWinner) {
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
    } else if (raffle.isSelectingWinner) {
        return `<button class="btn" style="width: 100%; background: var(--warning);" disabled>⏳ Seleccionando...</button>`;
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
            openNumberSelection(e.target.getAttribute('data-raffle'));
        });
    });
    
    // Botones de selección de ganador (admin)
    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectWinner(e.target.getAttribute('data-raffle'));
        });
    });
    
    // Botones de reclamar premio
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

// ===== NUMBER SELECTION MODAL =====
function openNumberSelection(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }
    
    appState.currentRaffle = raffle;
    appState.selectedNumbers = [];
    appState.currentPage = 1;
    
    // Actualizar modal
    document.getElementById('modal-raffle-name').textContent = raffle.name;
    document.getElementById('price-per-number').textContent = `${raffle.price} SOL`;
    
    if (appState.currentWallet) {
        document.getElementById('user-balance').textContent = `${appState.currentWallet.balance.toFixed(4)} SOL`;
    }
    
    renderNumberGrid();
    updatePaymentSummary();
    
    // Mostrar modal
    document.getElementById('number-selection-modal').classList.add('active');
}

function renderNumberGrid() {
    const grid = document.getElementById('numbers-grid');
    const pageInfo = document.getElementById('page-info');
    const pagination = document.getElementById('pagination-controls');
    
    if (!appState.currentRaffle) return;
    
    const raffle = appState.currentRaffle;
    const numbersPerPage = 50;
    const totalPages = Math.ceil(raffle.totalNumbers / numbersPerPage);
    const startNum = (appState.currentPage - 1) * numbersPerPage + 1;
    const endNum = Math.min(appState.currentPage * numbersPerPage, raffle.totalNumbers);
    
    // Info de página
    if (pageInfo) {
        pageInfo.textContent = `Página ${appState.currentPage} de ${totalPages} (Números ${startNum}-${endNum})`;
    }
    
    // Paginación
    if (pagination) {
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === appState.currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => {
                appState.currentPage = i;
                renderNumberGrid();
            };
            pagination.appendChild(btn);
        }
    }
    
    // Números
    if (grid) {
        grid.innerHTML = '';
        for (let i = startNum; i <= endNum; i++) {
            const btn = document.createElement('button');
            btn.className = 'number-btn';
            btn.textContent = i;
            
            if (raffle.soldNumbers?.includes(i)) {
                btn.classList.add('sold');
                btn.disabled = true;
            } else if (appState.selectedNumbers.includes(i)) {
                btn.classList.add('selected');
            }
            
            if (!raffle.soldNumbers?.includes(i)) {
                btn.onclick = () => toggleNumber(i);
            }
            
            grid.appendChild(btn);
        }
    }
}

function toggleNumber(number) {
    const index = appState.selectedNumbers.indexOf(number);
    if (index === -1) {
        appState.selectedNumbers.push(number);
    } else {
        appState.selectedNumbers.splice(index, 1);
    }
    renderNumberGrid();
    updateSelectedNumbers();
    updatePaymentSummary();
}

function updateSelectedNumbers() {
    const list = document.getElementById('selected-numbers-list');
    if (!list) return;
    
    list.innerHTML = '';
    appState.selectedNumbers.sort((a, b) => a - b).forEach(num => {
        const tag = document.createElement('div');
        tag.className = 'selected-number-tag';
        tag.textContent = num;
        list.appendChild(tag);
    });
}

function updatePaymentSummary() {
    const count = appState.selectedNumbers.length;
    const price = appState.currentRaffle?.price || 0;
    const total = count * price;
    
    const selectedCount = document.getElementById('selected-count');
    const totalPayment = document.getElementById('total-payment');
    
    if (selectedCount) selectedCount.textContent = count;
    if (totalPayment) totalPayment.textContent = `${total.toFixed(4)} SOL`;
}

// ===== PROCESAMIENTO DE PAGO REAL =====
async function processPayment() {
    if (!appState.currentWallet || !appState.currentRaffle) {
        showUserAlert('❌ Error: Wallet no conectada', 'error');
        return;
    }
    
    if (appState.selectedNumbers.length === 0) {
        showUserAlert('❌ Selecciona al menos un número', 'warning');
        return;
    }
    
    const total = appState.selectedNumbers.length * appState.currentRaffle.price;
    
    // Verificar saldo
    if (appState.currentWallet.balance < total) {
        showUserAlert(`❌ Saldo insuficiente. Necesitas ${total.toFixed(4)} SOL`, 'error');
        return;
    }

    try {
        const statusEl = document.getElementById('payment-status');
        const detailsEl = document.getElementById('payment-details');
        
        if (statusEl) statusEl.style.display = 'block';
        if (detailsEl) detailsEl.textContent = '⏳ Iniciando transacción en Solana...';

        // 1. Realizar transacción real a la wallet del administrador
        const transactionResult = await sendSolanaTransaction(ADMIN_WALLET_ADDRESS, total);
        
        if (!transactionResult.success) {
            throw new Error(transactionResult.error);
        }

        if (detailsEl) {
            detailsEl.textContent = `✅ Transacción confirmada: ${transactionResult.signature.substring(0, 16)}...`;
        }

        // 2. Actualizar datos locales
        const raffleIndex = appState.raffles.findIndex(r => r.id === appState.currentRaffle.id);
        if (raffleIndex !== -1) {
            appState.selectedNumbers.forEach(num => {
                if (!appState.raffles[raffleIndex].soldNumbers.includes(num)) {
                    appState.raffles[raffleIndex].soldNumbers.push(num);
                    appState.raffles[raffleIndex].numberOwners[num] = appState.currentWallet.publicKey;
                }
            });
            
            // Actualizar total recolectado
            appState.raffles[raffleIndex].totalCollected = 
                (appState.raffles[raffleIndex].totalCollected || 0) + total;

            // 3. Guardar en Firebase
            await updateRaffleInFirebase(appState.currentRaffle.id, {
                soldNumbers: appState.raffles[raffleIndex].soldNumbers,
                numberOwners: appState.raffles[raffleIndex].numberOwners,
                totalCollected: appState.raffles[raffleIndex].totalCollected
            });
        }

        // 4. Actualizar balance local
        appState.currentWallet.balance -= total;
        updateWalletDisplay();

        if (detailsEl) {
            detailsEl.innerHTML = `
                ✅ Pago procesado exitosamente!<br>
                <small>TX: ${transactionResult.signature.substring(0, 20)}...</small>
            `;
        }
        if (statusEl) statusEl.className = 'transaction-status transaction-success';
        
        showUserAlert(`🎉 ¡Compra exitosa! ${appState.selectedNumbers.length} números adquiridos por ${total} SOL`, 'success');
        
        setTimeout(() => {
            document.getElementById('number-selection-modal').classList.remove('active');
            renderRaffles();
        }, 3000);
        
    } catch (error) {
        console.error('Error en pago:', error);
        const detailsEl = document.getElementById('payment-details');
        const statusEl = document.getElementById('payment-status');
        
        if (detailsEl) detailsEl.textContent = '❌ Error: ' + error.message;
        if (statusEl) statusEl.className = 'transaction-status transaction-error';
        showUserAlert('❌ Error en el pago: ' + error.message, 'error');
    }
}

// ===== CLAIM PRIZE MODAL =====
function openClaimModal(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle?.winner) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }
    
    if (!appState.currentWallet || raffle.winner.wallet !== appState.currentWallet.publicKey) {
        showUserAlert('❌ No eres el ganador', 'error');
        return;
    }
    
    // Actualizar modal
    document.getElementById('prize-name').textContent = `Premio: ${raffle.prize}`;
    document.getElementById('claim-raffle-name').textContent = raffle.name;
    document.getElementById('winning-number').textContent = raffle.winner.number;
    document.getElementById('winner-wallet').textContent = `${raffle.winner.wallet.substring(0, 8)}...${raffle.winner.wallet.substring(raffle.winner.wallet.length - 4)}`;
    
    // Reset form
    ['winner-name', 'winner-email', 'winner-phone', 'winner-address', 'winner-notes'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    document.getElementById('claim-status').style.display = 'none';
    document.getElementById('claim-prize-modal').classList.add('active');
}

async function processClaim() {
    const fields = {
        name: document.getElementById('winner-name').value.trim(),
        email: document.getElementById('winner-email').value.trim(),
        phone: document.getElementById('winner-phone').value.trim(),
        address: document.getElementById('winner-address').value.trim()
    };
    
    // Validación básica
    for (const [field, value] of Object.entries(fields)) {
        if (!value) {
            showUserAlert(`❌ Completa el campo ${field}`, 'error');
            return;
        }
    }
    
    if (!isValidEmail(fields.email)) {
        showUserAlert('❌ Email inválido', 'error');
        return;
    }

    try {
        const statusEl = document.getElementById('claim-status');
        const detailsEl = document.getElementById('claim-details');
        
        if (statusEl) statusEl.style.display = 'block';
        if (detailsEl) detailsEl.textContent = '⏳ Registrando reclamación...';

        // Actualizar datos locales
        const raffleIndex = appState.raffles.findIndex(r => r.id === appState.currentRaffle.id);
        if (raffleIndex !== -1) {
            appState.raffles[raffleIndex].prizeClaimed = true;
            appState.raffles[raffleIndex].winnerInfo = {
                name: fields.name,
                email: fields.email,
                phone: fields.phone,
                address: fields.address,
                notes: document.getElementById('winner-notes').value.trim(),
                claimDate: new Date().toISOString()
            };
            appState.raffles[raffleIndex].shippingStatus = 'claimed';

            // Actualizar en Firebase
            await updateRaffleInFirebase(appState.currentRaffle.id, {
                prizeClaimed: true,
                winnerInfo: appState.raffles[raffleIndex].winnerInfo,
                shippingStatus: 'claimed'
            });

            // Actualizar ganador en Firebase
            const winnerIndex = appState.winners.findIndex(w => 
                w.raffleName === appState.currentRaffle.name && 
                w.winningNumber === appState.currentRaffle.winner.number
            );
            
            if (winnerIndex !== -1) {
                appState.winners[winnerIndex].claimed = true;
                appState.winners[winnerIndex].winnerInfo = appState.raffles[raffleIndex].winnerInfo;
                
                // Actualizar winner en Firebase si existe
                if (appState.winners[winnerIndex].id) {
                    await db.collection('winners').doc(appState.winners[winnerIndex].id).update({
                        claimed: true,
                        winnerInfo: appState.raffles[raffleIndex].winnerInfo
                    });
                }
            }
        }

        if (detailsEl) detailsEl.textContent = '✅ ¡Premio reclamado exitosamente!';
        showUserAlert('🎉 Premio reclamado. Te contactaremos pronto para el envío.', 'success');
        
        setTimeout(() => {
            document.getElementById('claim-prize-modal').classList.remove('active');
            renderRaffles();
        }, 2000);
        
    } catch (error) {
        console.error('Error reclamando premio:', error);
        const detailsEl = document.getElementById('claim-details');
        if (detailsEl) detailsEl.textContent = '❌ Error: ' + error.message;
        showUserAlert('❌ Error reclamando premio: ' + error.message, 'error');
    }
}

// ===== ADMIN FUNCTIONS =====
async function selectWinner(raffleId) {
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo administradores pueden seleccionar ganadores', 'error');
        return;
    }
    
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle || raffle.soldNumbers?.length === 0) {
        showUserAlert('❌ No hay números vendidos en este sorteo', 'warning');
        return;
    }
    
    if (raffle.completed) {
        showUserAlert('❌ Este sorteo ya tiene un ganador', 'warning');
        return;
    }

    try {
        raffle.isSelectingWinner = true;
        renderRaffles();
        
        showUserAlert('🎰 Seleccionando ganador aleatoriamente...', 'info');

        // Simular proceso aleatorio (en producción usarías un RNG verificable)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const randomIndex = Math.floor(Math.random() * raffle.soldNumbers.length);
        const winningNumber = raffle.soldNumbers[randomIndex];
        const winnerWallet = raffle.numberOwners[winningNumber];
        
        raffle.winner = {
            number: winningNumber,
            wallet: winnerWallet,
            date: new Date().toISOString()
        };
        raffle.completed = true;
        raffle.isSelectingWinner = false;

        // Registrar ganador en Firebase
        const winnerData = {
            raffleName: raffle.name,
            prize: raffle.prize,
            winningNumber: winningNumber,
            winnerWallet: winnerWallet,
            winnerDate: new Date().toISOString(),
            claimed: false,
            transactionHash: 'manual_selection_' + Date.now()
        };
        
        const winnerId = await saveWinnerToFirebase(winnerData);
        if (winnerId) {
            winnerData.id = winnerId;
        }
        
        await updateRaffleInFirebase(raffleId, {
            winner: raffle.winner,
            completed: true
        });

        // Agregar a winners local
        appState.winners.push(winnerData);
        
        showUserAlert(`🏆 ¡Ganador seleccionado! Número: ${winningNumber} - Wallet: ${winnerWallet.substring(0, 8)}...`, 'success');
        
        renderRaffles();
        renderWinnersArchive();
        
    } catch (error) {
        console.error('Error seleccionando ganador:', error);
        raffle.isSelectingWinner = false;
        renderRaffles();
        showUserAlert('❌ Error seleccionando ganador: ' + error.message, 'error');
    }
}

// ===== CREACIÓN DE SORTEOS =====
async function createRaffle(event) {
    event.preventDefault();
    
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo administradores pueden crear sorteos', 'error');
        return;
    }
    
    const formData = {
        name: document.getElementById('raffle-name').value.trim(),
        description: document.getElementById('raffle-description').value.trim(),
        price: parseFloat(document.getElementById('ticket-price').value),
        totalNumbers: parseInt(document.getElementById('max-numbers').value),
        image: document.getElementById('raffle-image').value.trim()
    };
    
    // Validaciones
    if (Object.values(formData).some(value => !value || isNaN(value))) {
        showUserAlert('❌ Completa todos los campos correctamente', 'error');
        return;
    }
    
    if (formData.price <= 0) {
        showUserAlert('❌ El precio debe ser mayor a 0', 'error');
        return;
    }
    
    if (formData.totalNumbers < 10) {
        showUserAlert('❌ Mínimo 10 números por sorteo', 'error');
        return;
    }

    try {
        const statusEl = document.getElementById('transaction-status');
        const detailsEl = document.getElementById('transaction-details');
        
        if (statusEl) statusEl.style.display = 'block';
        if (detailsEl) detailsEl.textContent = '⏳ Creando sorteo verificado...';

        const newRaffle = {
            id: 'raffle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...formData,
            prize: formData.name,
            soldNumbers: [],
            numberOwners: {},
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString(),
            adminWallet: ADMIN_WALLET_ADDRESS,
            totalCollected: 0
        };

        // Guardar en Firebase
        const firebaseSuccess = await saveRaffleToFirebase(newRaffle);
        
        if (!firebaseSuccess) {
            throw new Error('Error guardando en la base de datos');
        }

        // Agregar al estado local
        appState.raffles.push(newRaffle);
        
        if (detailsEl) detailsEl.textContent = '✅ Sorteo creado y guardado en Firebase';
        if (statusEl) statusEl.className = 'transaction-status transaction-success';

        // Limpiar formulario
        document.getElementById('create-raffle-form').reset();
        document.getElementById('image-preview').innerHTML = '<div class="emoji-preview">🖼️</div>';
        
        showUserAlert('🎯 Sorteo verificado creado exitosamente', 'success');
        
        setTimeout(() => {
            if (statusEl) statusEl.style.display = 'none';
            renderRaffles();
        }, 2000);
        
    } catch (error) {
        console.error('Error creando sorteo:', error);
        const detailsEl = document.getElementById('transaction-details');
        const statusEl = document.getElementById('transaction-status');
        
        if (detailsEl) detailsEl.textContent = '❌ Error: ' + error.message;
        if (statusEl) statusEl.className = 'transaction-status transaction-error';
        showUserAlert('❌ Error creando sorteo: ' + error.message, 'error');
    }
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

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
        const list = userWinnings.map(r => `• ${r.name} (N° ${r.winner.number})`).join('\n');
        showUserAlert(`🏆 Tus premios:\n${list}`, 'success', 8000);
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
    
    // Number Selection Modal
    safeAddListener('close-number-modal', 'click', () => {
        document.getElementById('number-selection-modal').classList.remove('active');
    });
    
    safeAddListener('confirm-payment-btn', 'click', processPayment);
    safeAddListener('cancel-selection-btn', 'click', () => {
        document.getElementById('number-selection-modal').classList.remove('active');
    });
    
    // Claim Prize Modal
    safeAddListener('close-claim-modal', 'click', () => {
        document.getElementById('claim-prize-modal').classList.remove('active');
    });
    
    safeAddListener('submit-claim-btn', 'click', processClaim);
    safeAddListener('cancel-claim-btn', 'click', () => {
        document.getElementById('claim-prize-modal').classList.remove('active');
    });
    
    // Winner Info
    safeAddListener('winner-info-btn', 'click', showUserWinnings);
    
    // Admin Actions
    safeAddListener('view-winners-admin', 'click', () => {
        showUserAlert('🔍 Vista de ganadores en desarrollo', 'info');
    });
    
    safeAddListener('refresh-winners-btn', 'click', () => {
        loadInitialData();
        showUserAlert('🔄 Datos actualizados', 'success');
    });
    
    // Form Creation
    safeAddListener('create-raffle-form', 'submit', createRaffle);
    
    // Image Preview
    safeAddListener('raffle-image', 'input', function() {
        const preview = document.getElementById('image-preview');
        const value = this.value.trim();
        
        if (value.startsWith('http')) {
            preview.innerHTML = `<img src="${value}" alt="Preview" onerror="this.parentElement.innerHTML='<div class=\"emoji-preview\">❌</div>'">`;
        } else {
            preview.innerHTML = `<div class="emoji-preview">${value || '🖼️'}</div>`;
        }
    });
    
    // FAQ Toggles
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function() {
            const answer = this.nextElementSibling;
            const toggle = this.querySelector('.faq-toggle');
            
            // Cerrar otros
            document.querySelectorAll('.faq-answer').forEach(ans => {
                if (ans !== answer) {
                    ans.classList.remove('active');
                    ans.previousElementSibling.querySelector('.faq-toggle').classList.remove('active');
                }
            });
            
            // Toggle actual
            answer.classList.toggle('active');
            toggle.classList.toggle('active');
        });
    });
    
    // Close Alerts
    safeAddListener('close-alert', 'click', hideUserAlert);
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        ['wallet-modal', 'number-selection-modal', 'claim-prize-modal'].forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
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

console.log('🎯 VeriRifa-Sol - Script cargado y listo');
