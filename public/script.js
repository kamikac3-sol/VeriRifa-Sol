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
        throw error;
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
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;

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
        } else if (error.message.includes('clave pública')) {
            errorMessage = 'Error al obtener la dirección de la wallet';
        }
        
        showUserAlert(`❌ ${errorMessage}`, 'error');
        return false;
    }
}

function updateWalletDisplay() {
    if (!appState.currentWallet) {
        // Estado desconectado
        const connectBtn = document.getElementById('connect-wallet-btn');
        if (connectBtn) {
            connectBtn.innerHTML = '<span>👛 Conectar Wallet</span>';
            connectBtn.style.display = 'block';
        }
        
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
        
        const networkIndicator = document.getElementById('network-indicator');
        if (networkIndicator) {
            networkIndicator.textContent = '🔴 Desconectado';
            networkIndicator.style.display = 'block';
        }
        
        return;
    }
    
    // Estado conectado
    const { publicKey, balance } = appState.currentWallet;
    const shortAddress = `${publicKey.substring(0, 6)}...${publicKey.substring(publicKey.length - 4)}`;
    
    // Actualizar elementos de UI
    const addressElement = document.getElementById('connected-wallet-address');
    const balanceElement = document.getElementById('wallet-balance');
    const connectBtn = document.getElementById('connect-wallet-btn');
    const networkIndicator = document.getElementById('network-indicator');
    const disconnectBtn = document.getElementById('disconnect-wallet-btn');
    const winnerBtn = document.getElementById('winner-info-btn');
    
    if (addressElement) {
        addressElement.textContent = shortAddress;
        addressElement.style.display = 'block';
    }
    
    if (balanceElement) {
        balanceElement.textContent = `${balance.toFixed(4)} SOL`;
        balanceElement.style.display = 'block';
    }
    
    if (connectBtn) {
        connectBtn.innerHTML = '<span>✅ Conectado</span>';
    }
    
    if (networkIndicator) {
        networkIndicator.textContent = '🟢 Solana Testnet';
        networkIndicator.style.display = 'block';
    }
    
    if (disconnectBtn) {
        disconnectBtn.style.display = 'block';
    }
    
    if (winnerBtn) {
        winnerBtn.style.display = 'block';
    }
    
    // Actualizar estado de conexión en modal
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        connectionStatus.innerHTML = '<strong>Estado Wallet:</strong> ✅ Conectada';
    }
}

function checkAdminStatus() {
    if (!appState.currentWallet) {
        appState.isAdmin = false;
    } else {
        appState.isAdmin = (appState.currentWallet.publicKey === ADMIN_WALLET_ADDRESS);
    }
    
    updateAdminUI();
    
    if (appState.isAdmin) {
        showUserAlert('✅ Modo verificador activado', 'success');
    }
}

function updateAdminUI() {
    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem) {
        if (appState.isAdmin) {
            adminMenuItem.classList.add('visible');
        } else {
            adminMenuItem.classList.remove('visible');
            // Asegurar que el panel admin esté cerrado
            const adminPanel = document.getElementById('admin-panel');
            if (adminPanel) adminPanel.classList.remove('active');
        }
    }
    
    // Re-renderizar sorteos para actualizar botones
    renderRaffles();
}

function disconnectWallet() {
    console.log('🔌 Desconectando wallet...');
    
    if (appState.currentWallet?.provider) {
        try {
            appState.currentWallet.provider.disconnect();
        } catch (error) {
            console.log('Wallet ya desconectada o error al desconectar:', error);
        }
    }
    
    // Resetear estado COMPLETO
    appState.currentWallet = null;
    appState.isAdmin = false;
    appState.isConnected = false;
    appState.selectedNumbers = [];
    appState.currentRaffle = null;
    
    updateWalletDisplay();
    updateAdminUI();
    
    showUserAlert('🔌 Wallet desconectada', 'info');
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
        const snapshot = await db.collection('raffles').get();
        appState.raffles = [];
        
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const raffle = { id: doc.id, ...doc.data() };
                // Asegurar campos requeridos
                raffle.soldNumbers = raffle.soldNumbers || [];
                raffle.numberOwners = raffle.numberOwners || {};
                raffle.completed = raffle.completed || false;
                raffle.prizeClaimed = raffle.prizeClaimed || false;
                raffle.shippingStatus = raffle.shippingStatus || 'pending';
                
                appState.raffles.push(raffle);
            });
            console.log(`✅ ${appState.raffles.length} sorteos cargados`);
        } else {
            console.log('📝 No hay sorteos - creando ejemplos');
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
            name: 'PlayStation 5 Edición Especial',
            description: 'Sorteo de una PlayStation 5 nueva en caja',
            price: 0.1,
            totalNumbers: 50,
            image: '🎮',
            prize: 'PlayStation 5',
            soldNumbers: [1, 2, 3, 4, 5, 10, 15, 20],
            numberOwners: {
                1: 'user1',
                2: 'user2', 
                3: 'user3',
                4: 'user4',
                5: 'user5',
                10: 'user10',
                15: 'user15',
                20: 'user20'
            },
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
            numberOwners: {
                1: 'user1',
                5: 'user5',
                10: 'user10',
                15: 'user15'
            },
            winner: null,
            completed: false,
            prizeClaimed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
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
            <div class="skeleton-raffle">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text skeleton-text--short"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
            <div class="skeleton-raffle">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text skeleton-text--short"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
            <div class="skeleton-raffle">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text skeleton-text--short"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        `,
        'winners-container': `
            <div class="skeleton skeleton-text" style="height: 120px; margin-bottom: 1rem;"></div>
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
    
    // Verificar si el usuario actual es el ganador
    let isUserWinner = false;
    if (raffle.winner && appState.currentWallet) {
        isUserWinner = (raffle.winner.wallet === appState.currentWallet.publicKey);
    }
    
    const actionButton = createRaffleActionButton(raffle, sold, total, isUserWinner);
    const imageContent = raffle.image?.startsWith('http') 
        ? `<img src="${raffle.image}" alt="${raffle.name}" onerror="this.parentElement.innerHTML='🎁'">`
        : `<div style="font-size: 3rem;">${raffle.image || '🎁'}</div>`;
    
    return `
        <div class="raffle-card" data-raffle-id="${raffle.id}">
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
    // Si es administrador
    else if (appState.isAdmin) {
        if (sold >= total) {
            return `<button class="btn btn-warning select-winner-btn" data-raffle="${raffle.id}" style="width: 100%;">🎰 Seleccionar Ganador</button>`;
        } else {
            return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>⏳ Esperando (${total - sold} restantes)</button>`;
        }
    } 
    // Si es usuario normal
    else {
        if (sold >= total) {
            return `<button class="btn" style="width: 100%; background: var(--gray);" disabled>🔒 Todos vendidos</button>`;
        } else {
            return `<button class="btn participate-btn" data-raffle="${raffle.id}" style="width: 100%;">🎫 Participar (${raffle.price} SOL)</button>`;
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
    // Botones de participación - USAR EVENT DELEGATION
    document.getElementById('raffles-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('participate-btn')) {
            if (!appState.currentWallet) {
                showUserAlert('🔗 Conecta tu wallet primero', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            const raffleId = e.target.getAttribute('data-raffle');
            openNumberSelection(raffleId);
        }
        
        if (e.target.classList.contains('select-winner-btn')) {
            const raffleId = e.target.getAttribute('data-raffle');
            selectWinner(raffleId);
        }
        
        if (e.target.classList.contains('claim-btn')) {
            const raffleId = e.target.getAttribute('data-raffle');
            openClaimModal(raffleId);
        }
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
    console.log('Abriendo selección de números para:', raffleId);
    
    // Verificar que hay wallet conectada
    if (!appState.currentWallet) {
        showUserAlert('🔗 Conecta tu wallet primero', 'warning');
        document.getElementById('wallet-modal').classList.add('active');
        return;
    }
    
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }
    
    // Verificar que el sorteo no está completado
    if (raffle.completed || raffle.winner) {
        showUserAlert('❌ Este sorteo ya ha finalizado', 'error');
        return;
    }
    
    // Verificar que hay números disponibles
    const sold = raffle.soldNumbers?.length || 0;
    const total = raffle.totalNumbers || 100;
    if (sold >= total) {
        showUserAlert('❌ Todos los números están vendidos', 'warning');
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
    } else {
        document.getElementById('user-balance').textContent = '0 SOL';
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
    if (appState.currentWallet.balance < total) {
        showUserAlert('❌ Saldo insuficiente', 'error');
        return;
    }
    
    try {
        const statusEl = document.getElementById('payment-status');
        const detailsEl = document.getElementById('payment-details');
        
        if (statusEl) statusEl.style.display = 'block';
        if (detailsEl) detailsEl.textContent = '⏳ Procesando pago...';
        
        // Simular transacción
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Actualizar datos locales
        const raffleIndex = appState.raffles.findIndex(r => r.id === appState.currentRaffle.id);
        if (raffleIndex !== -1) {
            appState.selectedNumbers.forEach(num => {
                if (!appState.raffles[raffleIndex].soldNumbers.includes(num)) {
                    appState.raffles[raffleIndex].soldNumbers.push(num);
                    appState.raffles[raffleIndex].numberOwners[num] = appState.currentWallet.publicKey;
                }
            });
        }
        
        if (detailsEl) detailsEl.textContent = '✅ Pago procesado exitosamente';
        if (statusEl) statusEl.className = 'transaction-status transaction-success';
        
        showUserAlert(`🎉 ¡Compra exitosa! ${appState.selectedNumbers.length} números adquiridos`, 'success');
        
        setTimeout(() => {
            document.getElementById('number-selection-modal').classList.remove('active');
            renderRaffles();
        }, 1500);
        
    } catch (error) {
        console.error('Error en pago:', error);
        const detailsEl = document.getElementById('payment-details');
        const statusEl = document.getElementById('payment-status');
        
        if (detailsEl) detailsEl.textContent = '❌ Error procesando pago';
        if (statusEl) statusEl.className = 'transaction-status transaction-error';
        showUserAlert('❌ Error en el pago', 'error');
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
        
        statusEl.style.display = 'block';
        detailsEl.textContent = '⏳ Procesando reclamación...';
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Actualizar datos
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
        }
        
        detailsEl.textContent = '✅ ¡Premio reclamado!';
        showUserAlert('🎉 Premio reclamado exitosamente', 'success');
        
        setTimeout(() => {
            document.getElementById('claim-prize-modal').classList.remove('active');
            renderRaffles();
        }, 1500);
        
    } catch (error) {
        console.error('Error reclamando premio:', error);
        document.getElementById('claim-details').textContent = '❌ Error reclamando premio';
        showUserAlert('❌ Error reclamando premio', 'error');
    }
}

// ===== ADMIN FUNCTIONS =====
async function selectWinner(raffleId) {
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo administradores', 'error');
        return;
    }
    
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle || raffle.soldNumbers?.length === 0) {
        showUserAlert('❌ No hay números vendidos', 'warning');
        return;
    }
    
    try {
        raffle.isSelectingWinner = true;
        renderRaffles();
        
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
        
        // Registrar ganador
        const winnerData = {
            raffleName: raffle.name,
            prize: raffle.prize,
            winningNumber: winningNumber,
            winnerWallet: winnerWallet,
            winnerDate: new Date().toISOString(),
            claimed: false
        };
        
        appState.winners.push(winnerData);
        showUserAlert(`🏆 ¡Ganador seleccionado! Número: ${winningNumber}`, 'success');
        
        renderRaffles();
        renderWinnersArchive();
        
    } catch (error) {
        console.error('Error seleccionando ganador:', error);
        raffle.isSelectingWinner = false;
        renderRaffles();
        showUserAlert('❌ Error seleccionando ganador', 'error');
    }
}

async function createRaffle(event) {
    event.preventDefault();
    
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo administradores', 'error');
        return;
    }
    
    const formData = {
        name: document.getElementById('raffle-name').value.trim(),
        description: document.getElementById('raffle-description').value.trim(),
        price: parseFloat(document.getElementById('ticket-price').value),
        totalNumbers: parseInt(document.getElementById('max-numbers').value),
        image: document.getElementById('raffle-image').value.trim()
    };
    
    if (Object.values(formData).some(value => !value)) {
        showUserAlert('❌ Completa todos los campos', 'error');
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
            createdAt: new Date().toISOString()
        };
        
        appState.raffles.push(newRaffle);
        
        detailsEl.textContent = '✅ Sorteo creado exitosamente';
        statusEl.className = 'transaction-status transaction-success';
        
        // Limpiar formulario
        document.getElementById('create-raffle-form').reset();
        document.getElementById('image-preview').innerHTML = '<div class="emoji-preview">🖼️</div>';
        
        showUserAlert('🎯 Sorteo creado exitosamente', 'success');
        
        setTimeout(() => {
            statusEl.style.display = 'none';
            renderRaffles();
        }, 1500);
        
    } catch (error) {
        console.error('Error creando sorteo:', error);
        document.getElementById('transaction-details').textContent = '❌ Error creando sorteo';
        document.getElementById('transaction-status').className = 'transaction-status transaction-error';
        showUserAlert('❌ Error creando sorteo', 'error');
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
        const modals = ['wallet-modal', 'number-selection-modal', 'claim-prize-modal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
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

// Inicializar cuando la ventana carga
window.addEventListener('load', function() {
    console.log('🎯 VeriRifa-Sol - Aplicación completamente cargada');
});

console.log('🎯 VeriRifa-Sol - Script cargado y listo');
