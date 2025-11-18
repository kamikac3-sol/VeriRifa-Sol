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
    initializeApp();
});

async function initializeApp() {
    try {
        await initializeFirebase();
        await loadInitialData();
        setupEventListeners();
        await connectToBlockchain();
        
        // Verificar si hay una wallet conectada previamente
        if (window.solana && window.solana.isConnected) {
            await connectRealWallet('phantom');
        }
        
        showUserAlert('✅ VeriRifa-Sol cargada correctamente', 'success');
    } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        showUserAlert('❌ Error al cargar la aplicación', 'error');
    }
}

// ===== MÓDULO FIREBASE =====
async function initializeFirebase() {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        window.db = firebase.firestore();
        window.analytics = firebase.analytics();
        console.log('✅ Firebase inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando Firebase:', error);
        throw error;
    }
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
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        hideSkeletonLoaders();
        showUserAlert('Error cargando datos', 'error');
    }
}

async function loadRafflesFromFirebase() {
    if (!window.db) {
        console.error('❌ Firebase no disponible');
        appState.raffles = [];
        return;
    }

    try {
        const snapshot = await db.collection('raffles').get();
        
        if (!snapshot.empty) {
            appState.raffles = [];
            snapshot.forEach(doc => {
                const raffleData = doc.data();
                raffleData.id = doc.id; // Asegurar que tenemos el ID
                
                // Asegurar que todos los campos necesarios existan
                if (!raffleData.soldNumbers) raffleData.soldNumbers = [];
                if (!raffleData.winner) raffleData.winner = null;
                if (raffleData.prizeClaimed === undefined) raffleData.prizeClaimed = false;
                if (!raffleData.numberOwners) raffleData.numberOwners = {};
                if (raffleData.completed === undefined) raffleData.completed = false;
                if (!raffleData.shippingStatus) raffleData.shippingStatus = 'pending';
                if (!raffleData.prize) raffleData.prize = raffleData.name; // Usar nombre como premio por defecto
                
                appState.raffles.push(raffleData);
            });
            console.log('✅ Sorteos cargados desde Firebase:', appState.raffles.length);
        } else {
            console.log('📝 No hay sorteos en Firebase');
            appState.raffles = [];
        }
    } catch (error) {
        console.error('❌ Error cargando desde Firebase:', error);
        appState.raffles = [];
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
                const winnerData = doc.data();
                winnerData.id = doc.id;
                appState.winners.push(winnerData);
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

async function saveRafflesToFirebase() {
    if (!window.db) {
        console.error('❌ Firebase no disponible');
        return;
    }

    try {
        for (const raffle of appState.raffles) {
            await db.collection('raffles').doc(raffle.id).set({
                ...raffle,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        console.log('✅ Sorteos guardados en Firebase');
    } catch (error) {
        console.error('❌ Error guardando en Firebase:', error);
        showUserAlert('Error guardando datos en la nube', 'error');
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
    document.getElementById('user-alert').style.display = 'none';
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
        document.getElementById('real-connection-status').innerHTML =
            `<strong>Estado Blockchain:</strong> ✅ Conectado a Solana Testnet<br>
             <small>Version: ${version['solana-core']}</small>`;
             
        return true;
    } catch (error) {
        console.error('Error conectando a Solana:', error);
        document.getElementById('real-connection-status').innerHTML =
            '<strong>Estado Blockchain:</strong> ❌ Error conectando a Solana Testnet';
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
        
        // Actualizar balance del admin
        updateAdminWalletBalance();
    } else {
        document.getElementById('admin-menu-item').classList.remove('visible');
        document.getElementById('admin-panel').classList.remove('active');
    }
}

async function updateAdminWalletBalance() {
    if (!appState.isAdmin || !appState.currentWallet.publicKey) return;
    
    try {
        const balance = await connection.getBalance(appState.currentWallet.publicKey);
        const balanceInSOL = balance / solanaWeb3.LAMPORTS_PER_SOL;
        
        document.getElementById('admin-wallet-balance').textContent = `Balance: ${balanceInSOL.toFixed(4)} SOL`;
    } catch (error) {
        console.error('Error actualizando balance admin:', error);
    }
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
        
        const progress = raffle.soldNumbers ? raffle.soldNumbers.length : 0;
        const total = raffle.totalNumbers || 100;
        const progressPercent = total > 0 ? (progress / total) * 100 : 0;
        
        const isUserWinner = raffle.winner && appState.currentWallet.publicKey && 
                            raffle.winner.wallet === appState.currentWallet.publicKey.toString();
        
        let actionButton = '';
        
        const allNumbersSold = progress >= total;
        
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
                    const remainingNumbers = total - progress;
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
                            🎫 Participar (${raffle.price || 0.1} SOL)
                        </button>
                    `;
                }
            }
        }

        raffleCard.innerHTML = `
            <div class="raffle-image">
                ${raffle.image && raffle.image.startsWith('http') ? 
                    `<img src="${raffle.image}" alt="${raffle.name}" onerror="this.parentElement.innerHTML='${raffle.image.includes('🎮') ? '🎮' : '🎁'}'">` : 
                    `<div style="font-size: 3rem;">${raffle.image || '🎁'}</div>`
                }
            </div>
            <div class="raffle-content">
                <h3 class="raffle-title">${raffle.name}</h3>
                <div class="raffle-price">${raffle.price || 0.1} SOL por número</div>
                <div class="raffle-info">
                    <span>🎯 Premio: ${raffle.prize || raffle.name}</span>
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
    document.querySelectorAll('.participate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!appState.currentWallet.publicKey) {
                showUserAlert('🔗 Conecta tu wallet primero para participar', 'warning');
                document.getElementById('wallet-modal').classList.add('active');
                return;
            }
            openNumberSelectionModal(this.getAttribute('data-raffle'));
        });
    });

    document.querySelectorAll('.select-winner-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectWinner(this.getAttribute('data-raffle'));
        });
    });

    document.querySelectorAll('.claim-prize-btn').forEach(btn => {
        btn.addEventListener('click', function() {
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

// ===== FUNCIONES PARA BOTONES FALTANTES =====

// Abrir modal de selección de números
function openNumberSelectionModal(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    appState.currentRaffle = raffle;
    appState.selectedNumbers = [];
    appState.currentPage = 1;

    // Actualizar UI del modal
    document.getElementById('modal-raffle-name').textContent = raffle.name;
    document.getElementById('price-per-number').textContent = `${raffle.price || 0.1} SOL`;
    document.getElementById('user-balance').textContent = `${appState.currentWallet.balance.toFixed(4)} SOL`;
    
    renderNumbersGrid();
    updatePaymentSummary();
    
    // Mostrar modal
    document.getElementById('number-selection-modal').classList.add('active');
}

// Renderizar grid de números
function renderNumbersGrid() {
    const grid = document.getElementById('numbers-grid');
    const pageInfo = document.getElementById('page-info');
    const pagination = document.getElementById('pagination-controls');
    
    if (!appState.currentRaffle) return;

    const raffle = appState.currentRaffle;
    const numbersPerPage = 50;
    const totalNumbers = raffle.totalNumbers || 100;
    const totalPages = Math.ceil(totalNumbers / numbersPerPage);
    const startNumber = (appState.currentPage - 1) * numbersPerPage + 1;
    const endNumber = Math.min(appState.currentPage * numbersPerPage, totalNumbers);

    // Actualizar información de página
    pageInfo.textContent = `Página ${appState.currentPage} de ${totalPages} (Números ${startNumber}-${endNumber})`;

    // Renderizar controles de paginación
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === appState.currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            appState.currentPage = i;
            renderNumbersGrid();
        });
        pagination.appendChild(pageBtn);
    }

    // Renderizar números
    grid.innerHTML = '';
    for (let i = startNumber; i <= endNumber; i++) {
        const numberBtn = document.createElement('button');
        numberBtn.className = 'number-btn';
        numberBtn.textContent = i;
        
        // Verificar si el número está vendido
        const soldNumbers = raffle.soldNumbers || [];
        if (soldNumbers.includes(i)) {
            numberBtn.classList.add('sold');
            numberBtn.disabled = true;
        } else if (appState.selectedNumbers.includes(i)) {
            numberBtn.classList.add('selected');
        }

        // Agregar evento click solo si no está vendido
        if (!soldNumbers.includes(i)) {
            numberBtn.addEventListener('click', () => toggleNumberSelection(i));
        }

        grid.appendChild(numberBtn);
    }
}

// Alternar selección de número
function toggleNumberSelection(number) {
    const index = appState.selectedNumbers.indexOf(number);
    
    if (index === -1) {
        // Agregar número
        appState.selectedNumbers.push(number);
    } else {
        // Remover número
        appState.selectedNumbers.splice(index, 1);
    }
    
    renderNumbersGrid();
    updateSelectedNumbersList();
    updatePaymentSummary();
}

// Actualizar lista de números seleccionados
function updateSelectedNumbersList() {
    const list = document.getElementById('selected-numbers-list');
    list.innerHTML = '';
    
    appState.selectedNumbers.sort((a, b) => a - b).forEach(number => {
        const tag = document.createElement('div');
        tag.className = 'selected-number-tag';
        tag.textContent = number;
        list.appendChild(tag);
    });
}

// Actualizar resumen de pago
function updatePaymentSummary() {
    const selectedCount = appState.selectedNumbers.length;
    const pricePerNumber = appState.currentRaffle ? (appState.currentRaffle.price || 0.1) : 0;
    const totalPayment = selectedCount * pricePerNumber;
    
    document.getElementById('selected-count').textContent = selectedCount;
    document.getElementById('total-payment').textContent = `${totalPayment.toFixed(4)} SOL`;
}

// Procesar pago
async function processPayment() {
    if (!appState.currentWallet.publicKey || !appState.currentRaffle) {
        showUserAlert('❌ Error: Wallet no conectada o sorteo no seleccionado', 'error');
        return;
    }

    if (appState.selectedNumbers.length === 0) {
        showUserAlert('❌ Selecciona al menos un número para participar', 'warning');
        return;
    }

    const totalAmount = appState.selectedNumbers.length * (appState.currentRaffle.price || 0.1);
    
    if (appState.currentWallet.balance < totalAmount) {
        showUserAlert('❌ Saldo insuficiente en tu wallet', 'error');
        return;
    }

    try {
        const paymentStatus = document.getElementById('payment-status');
        const paymentDetails = document.getElementById('payment-details');
        
        paymentStatus.style.display = 'block';
        paymentDetails.textContent = '⏳ Iniciando transacción en Solana...';

        // Simular transacción (en producción usarías una transacción real)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Actualizar estado local
        const raffleIndex = appState.raffles.findIndex(r => r.id === appState.currentRaffle.id);
        if (raffleIndex !== -1) {
            appState.selectedNumbers.forEach(number => {
                if (!appState.raffles[raffleIndex].soldNumbers) {
                    appState.raffles[raffleIndex].soldNumbers = [];
                }
                if (!appState.raffles[raffleIndex].soldNumbers.includes(number)) {
                    appState.raffles[raffleIndex].soldNumbers.push(number);
                    if (!appState.raffles[raffleIndex].numberOwners) {
                        appState.raffles[raffleIndex].numberOwners = {};
                    }
                    appState.raffles[raffleIndex].numberOwners[number] = appState.currentWallet.publicKey.toString();
                }
            });
            
            // Guardar en Firebase
            await saveRafflesToFirebase();
        }

        paymentDetails.textContent = '✅ Pago procesado exitosamente';
        paymentStatus.className = 'transaction-status transaction-success';

        showUserAlert(`🎉 ¡Has comprado ${appState.selectedNumbers.length} números!`, 'success');

        // Cerrar modal después de éxito
        setTimeout(() => {
            document.getElementById('number-selection-modal').classList.remove('active');
            renderRaffles();
        }, 2000);

    } catch (error) {
        console.error('Error procesando pago:', error);
        document.getElementById('payment-details').textContent = '❌ Error procesando el pago';
        document.getElementById('payment-status').className = 'transaction-status transaction-error';
        showUserAlert('❌ Error procesando el pago', 'error');
    }
}

// Seleccionar ganador
async function selectWinner(raffleId) {
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo el verificador puede seleccionar ganadores', 'error');
        return;
    }

    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle) {
        showUserAlert('❌ Sorteo no encontrado', 'error');
        return;
    }

    const soldNumbers = raffle.soldNumbers || [];
    if (soldNumbers.length === 0) {
        showUserAlert('❌ No hay números vendidos en este sorteo', 'warning');
        return;
    }

    try {
        raffle.isSelectingWinner = true;
        renderRaffles();

        // Simular selección aleatoria (en producción usarías un método más seguro)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const randomIndex = Math.floor(Math.random() * soldNumbers.length);
        const winningNumber = soldNumbers[randomIndex];
        const winnerWallet = raffle.numberOwners ? raffle.numberOwners[winningNumber] : 'Unknown';

        // Actualizar sorteo con ganador
        raffle.winner = {
            number: winningNumber,
            wallet: winnerWallet,
            date: new Date().toISOString()
        };
        raffle.completed = true;
        raffle.isSelectingWinner = false;

        // Crear registro de ganador
        const winnerData = {
            raffleName: raffle.name,
            prize: raffle.prize || raffle.name,
            winningNumber: winningNumber,
            winnerWallet: winnerWallet,
            winnerDate: new Date().toISOString(),
            claimed: false
        };

        appState.winners.push(winnerData);

        // Guardar en Firebase
        await saveRafflesToFirebase();
        await saveWinnerToFirebase(winnerData);

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

// Guardar ganador en Firebase
async function saveWinnerToFirebase(winnerData) {
    if (!window.db) return;

    try {
        await db.collection('winners').add({
            ...winnerData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Ganador guardado en Firebase');
    } catch (error) {
        console.error('❌ Error guardando ganador en Firebase:', error);
    }
}

// Abrir modal de reclamar premio
function openClaimPrizeModal(raffleId) {
    const raffle = appState.raffles.find(r => r.id === raffleId);
    if (!raffle || !raffle.winner) {
        showUserAlert('❌ Sorteo o ganador no encontrado', 'error');
        return;
    }

    if (!appState.currentWallet.publicKey || raffle.winner.wallet !== appState.currentWallet.publicKey.toString()) {
        showUserAlert('❌ No eres el ganador de este sorteo', 'error');
        return;
    }

    // Actualizar UI del modal
    document.getElementById('prize-name').textContent = `Premio: ${raffle.prize || raffle.name}`;
    document.getElementById('claim-raffle-name').textContent = raffle.name;
    document.getElementById('winning-number').textContent = raffle.winner.number;
    document.getElementById('winner-wallet').textContent = `${raffle.winner.wallet.substring(0, 8)}...${raffle.winner.wallet.substring(raffle.winner.wallet.length - 4)}`;

    // Limpiar formulario
    document.getElementById('winner-name').value = '';
    document.getElementById('winner-email').value = '';
    document.getElementById('winner-phone').value = '';
    document.getElementById('winner-address').value = '';
    document.getElementById('winner-notes').value = '';

    // Ocultar estado de claim
    document.getElementById('claim-status').style.display = 'none';

    // Mostrar modal
    document.getElementById('claim-prize-modal').classList.add('active');
}

// Procesar reclamación de premio
async function processPrizeClaim() {
    const winnerName = document.getElementById('winner-name').value.trim();
    const winnerEmail = document.getElementById('winner-email').value.trim();
    const winnerPhone = document.getElementById('winner-phone').value.trim();
    const winnerAddress = document.getElementById('winner-address').value.trim();

    // Validaciones
    let isValid = true;

    if (!winnerName) {
        showValidationError('name-validation', 'Por favor, introduce tu nombre completo');
        isValid = false;
    } else {
        hideValidationError('name-validation');
    }

    if (!winnerEmail || !isValidEmail(winnerEmail)) {
        showValidationError('email-validation', 'Por favor, introduce un email válido');
        isValid = false;
    } else {
        hideValidationError('email-validation');
    }

    if (!winnerPhone) {
        showValidationError('phone-validation', 'Por favor, introduce un número de teléfono válido');
        isValid = false;
    } else {
        hideValidationError('phone-validation');
    }

    if (!winnerAddress) {
        showValidationError('address-validation', 'Por favor, introduce tu dirección completa');
        isValid = false;
    } else {
        hideValidationError('address-validation');
    }

    if (!isValid) return;

    try {
        const claimStatus = document.getElementById('claim-status');
        const claimDetails = document.getElementById('claim-details');
        
        claimStatus.style.display = 'block';
        claimDetails.textContent = '⏳ Procesando tu información...';

        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Actualizar información del ganador
        const winnerInfo = {
            name: winnerName,
            email: winnerEmail,
            phone: winnerPhone,
            address: winnerAddress,
            notes: document.getElementById('winner-notes').value.trim(),
            claimDate: new Date().toISOString()
        };

        // Actualizar sorteo
        const raffleIndex = appState.raffles.findIndex(r => r.id === appState.currentRaffle.id);
        if (raffleIndex !== -1) {
            appState.raffles[raffleIndex].prizeClaimed = true;
            appState.raffles[raffleIndex].winnerInfo = winnerInfo;
            appState.raffles[raffleIndex].shippingStatus = 'claimed';

            // Guardar en Firebase
            await saveRafflesToFirebase();
        }

        claimDetails.textContent = '✅ ¡Premio reclamado exitosamente!';
        showUserAlert('🎉 ¡Premio reclamado! Recibirás tu premio pronto.', 'success');

        // Cerrar modal después de éxito
        setTimeout(() => {
            document.getElementById('claim-prize-modal').classList.remove('active');
            renderRaffles();
        }, 2000);

    } catch (error) {
        console.error('Error reclamando premio:', error);
        document.getElementById('claim-details').textContent = '❌ Error reclamando el premio';
        showUserAlert('❌ Error reclamando el premio', 'error');
    }
}

// Funciones auxiliares
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showValidationError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.add('show');
}

function hideValidationError(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('show');
}

function getShippingStatusText(status) {
    switch(status) {
        case 'pending': return 'Pendiente';
        case 'claimed': return 'Reclamado';
        case 'shipped': return 'Enviado';
        case 'delivered': return 'Entregado';
        default: return 'Pendiente';
    }
}

// Mostrar sorteos ganados por el usuario
function showUserWinningRaffles() {
    if (!appState.currentWallet.publicKey) {
        showUserAlert('🔗 Conecta tu wallet primero', 'warning');
        return;
    }

    const userWinnings = appState.raffles.filter(raffle => 
        raffle.winner && 
        raffle.winner.wallet === appState.currentWallet.publicKey.toString()
    );

    if (userWinnings.length === 0) {
        showUserAlert('📝 No has ganado ningún sorteo aún', 'info');
    } else {
        const winningList = userWinnings.map(raffle => 
            `• ${raffle.name} (Número: ${raffle.winner.number})`
        ).join('\n');
        
        showUserAlert(`🏆 Tus premios ganados:\n${winningList}`, 'success', 8000);
    }
}

// ===== FUNCIONES DE CREACIÓN DE SORTEOS =====
async function createRaffle(event) {
    event.preventDefault();
    
    if (!appState.isAdmin) {
        showUserAlert('❌ Solo el verificador puede crear sorteos', 'error');
        return;
    }

    const raffleName = document.getElementById('raffle-name').value.trim();
    const raffleDescription = document.getElementById('raffle-description').value.trim();
    const ticketPrice = parseFloat(document.getElementById('ticket-price').value);
    const maxNumbers = parseInt(document.getElementById('max-numbers').value);
    const raffleImage = document.getElementById('raffle-image').value.trim();

    if (!raffleName || !raffleDescription || !ticketPrice || !maxNumbers || !raffleImage) {
        showUserAlert('❌ Por favor, completa todos los campos', 'error');
        return;
    }

    try {
        const transactionStatus = document.getElementById('transaction-status');
        const transactionDetails = document.getElementById('transaction-details');
        
        transactionStatus.style.display = 'block';
        transactionDetails.textContent = '⏳ Creando sorteo verificado...';

        // Crear nuevo sorteo
        const newRaffle = {
            id: 'raffle_' + Date.now(),
            name: raffleName,
            description: raffleDescription,
            price: ticketPrice,
            totalNumbers: maxNumbers,
            image: raffleImage,
            prize: raffleName, // Usar el nombre como premio por defecto
            soldNumbers: [],
            numberOwners: {},
            winner: null,
            prizeClaimed: false,
            completed: false,
            shippingStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        appState.raffles.push(newRaffle);

        // Guardar en Firebase
        await saveRafflesToFirebase();

        transactionDetails.textContent = '✅ Sorteo creado exitosamente';
        transactionStatus.className = 'transaction-status transaction-success';

        // Limpiar formulario
        document.getElementById('create-raffle-form').reset();
        document.getElementById('image-preview').innerHTML = '<div class="emoji-preview">🖼️</div>';

        showUserAlert('🎯 ¡Sorteo creado exitosamente!', 'success');

        // Actualizar UI
        setTimeout(() => {
            transactionStatus.style.display = 'none';
            renderRaffles();
        }, 2000);

    } catch (error) {
        console.error('Error creando sorteo:', error);
        document.getElementById('transaction-details').textContent = '❌ Error creando el sorteo';
        document.getElementById('transaction-status').className = 'transaction-status transaction-error';
        showUserAlert('❌ Error creando el sorteo', 'error');
    }
}

// ===== FUNCIONES DE ADMIN PARA GANADORES =====
async function loadAndRenderWinnersAdmin() {
    try {
        await loadWinnersFromFirebase();
        renderWinnersAdminTable();
    } catch (error) {
        console.error('Error cargando ganadores para admin:', error);
        showUserAlert('❌ Error cargando datos de ganadores', 'error');
    }
}

// Renderizar tabla de ganadores en admin
function renderWinnersAdminTable() {
    const container = document.getElementById('winners-admin-container');
    const table = document.getElementById('winners-admin-table');
    const tbody = document.getElementById('winners-admin-tbody');
    const noWinnersMessage = document.getElementById('no-winners-message');

    if (!container || !table || !tbody) return;

    if (appState.winners.length === 0) {
        table.style.display = 'none';
        noWinnersMessage.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    noWinnersMessage.style.display = 'none';

    tbody.innerHTML = '';

    appState.winners.forEach((winner, index) => {
        const row = document.createElement('tr');
        
        const shortWallet = `${winner.winnerWallet.substring(0, 8)}...${winner.winnerWallet.substring(winner.winnerWallet.length - 4)}`;
        const winnerDate = new Date(winner.winnerDate).toLocaleDateString('es-ES');
        
        const status = winner.shippingStatus || 'pending';
        const statusText = getShippingStatusText(status);
        const statusClass = `winner-status-badge status-${status}`;

        row.innerHTML = `
            <td>${winner.winnerInfo ? winner.winnerInfo.name : 'No reclamado'}</td>
            <td class="winner-contact-info">
                ${winner.winnerInfo ? `
                    📧 ${winner.winnerInfo.email}<br>
                    📞 ${winner.winnerInfo.phone}
                ` : 'No contactado'}
            </td>
            <td>${winner.prize}</td>
            <td>${winner.raffleName}</td>
            <td>${winner.winningNumber}</td>
            <td>${winnerDate}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td class="winner-actions">
                <button class="btn btn-small btn-info update-status-btn" data-index="${index}">
                    ✏️ Actualizar
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Agregar event listeners a los botones de actualizar
    document.querySelectorAll('.update-status-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            updateWinnerStatus(index);
        });
    });
}

// Actualizar estado del ganador
function updateWinnerStatus(winnerIndex) {
    const winner = appState.winners[winnerIndex];
    if (!winner) return;

    const newStatus = prompt(
        `Actualizar estado para ${winner.winnerInfo?.name || 'ganador'}:\n\n` +
        'pending - Pendiente\n' +
        'claimed - Reclamado\n' + 
        'shipped - Enviado\n' +
        'delivered - Entregado\n\n' +
        'Estado actual:',
        winner.shippingStatus || 'pending'
    );

    if (newStatus && ['pending', 'claimed', 'shipped', 'delivered'].includes(newStatus)) {
        winner.shippingStatus = newStatus;
        
        // Actualizar en Firebase
        updateWinnerInFirebase(winner);
        
        showUserAlert(`✅ Estado actualizado a: ${getShippingStatusText(newStatus)}`, 'success');
        renderWinnersAdminTable();
    }
}

// Actualizar ganador en Firebase
async function updateWinnerInFirebase(winner) {
    if (!window.db) return;

    try {
        // Buscar el documento del ganador por wallet y número ganador
        const snapshot = await db.collection('winners')
            .where('winnerWallet', '==', winner.winnerWallet)
            .where('winningNumber', '==', winner.winningNumber)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            await db.collection('winners').doc(doc.id).update({
                shippingStatus: winner.shippingStatus
            });
            console.log('✅ Estado de ganador actualizado en Firebase');
        }
    } catch (error) {
        console.error('Error actualizando ganador en Firebase:', error);
        showUserAlert('❌ Error actualizando estado en Firebase', 'error');
    }
}

// ===== SETUP DE EVENT LISTENERS =====
function setupEventListeners() {
    // Wallet Modal
    document.getElementById('connect-wallet-btn').addEventListener('click', function() {
        document.getElementById('wallet-modal').classList.add('active');
    });

    document.getElementById('close-wallet-modal').addEventListener('click', function() {
        document.getElementById('wallet-modal').classList.remove('active');
    });

    document.getElementById('connect-phantom-real').addEventListener('click', function() {
        connectRealWallet('phantom');
    });

    document.getElementById('connect-solflare-real').addEventListener('click', function() {
        connectRealWallet('solflare');
    });

    document.getElementById('disconnect-wallet-btn').addEventListener('click', disconnectWallet);

    // Admin Panel
    document.getElementById('admin-panel-link').addEventListener('click', function(e) {
        e.preventDefault();
        if (appState.isAdmin) {
            document.getElementById('admin-panel').classList.add('active');
            window.scrollTo({ top: document.getElementById('admin-panel').offsetTop - 100, behavior: 'smooth' });
        } else {
            showUserAlert('❌ Solo el verificador puede acceder al panel', 'error');
        }
    });

    document.getElementById('close-admin-panel').addEventListener('click', function() {
        document.getElementById('admin-panel').classList.remove('active');
    });

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
    document.getElementById('close-alert').addEventListener('click', hideUserAlert);

    // Modal de selección de números
    document.getElementById('close-number-modal').addEventListener('click', function() {
        document.getElementById('number-selection-modal').classList.remove('active');
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', processPayment);

    document.getElementById('cancel-selection-btn').addEventListener('click', function() {
        document.getElementById('number-selection-modal').classList.remove('active');
    });

    // Modal de reclamar premio
    document.getElementById('close-claim-modal').addEventListener('click', function() {
        document.getElementById('claim-prize-modal').classList.remove('active');
    });

    document.getElementById('cancel-claim-btn').addEventListener('click', function() {
        document.getElementById('claim-prize-modal').classList.remove('active');
    });

    document.getElementById('submit-claim-btn').addEventListener('click', processPrizeClaim);

    // Botón de información del ganador
    document.getElementById('winner-info-btn').addEventListener('click', function() {
        showUserWinningRaffles();
    });

    // Admin actions
    document.getElementById('view-winners-admin').addEventListener('click', function() {
        loadAndRenderWinnersAdmin();
    });

    document.getElementById('refresh-winners-btn').addEventListener('click', function() {
        loadAndRenderWinnersAdmin();
    });

    // Creación de sorteos
    document.getElementById('create-raffle-form').addEventListener('submit', createRaffle);

    // Vista de transacciones
    document.getElementById('view-transactions').addEventListener('click', function() {
        showUserAlert('🔍 Función de visualización de transacciones en desarrollo', 'info');
    });

    // Vista de imagen preview
    document.getElementById('raffle-image').addEventListener('input', function() {
        const preview = document.getElementById('image-preview');
        const value = this.value.trim();
        
        if (value.startsWith('http')) {
            preview.innerHTML = `<img src="${value}" alt="Preview" onerror="this.parentElement.innerHTML='<div class=\\'emoji-preview\\'>❌</div>'">`;
        } else {
            preview.innerHTML = `<div class="emoji-preview">${value || '🖼️'}</div>`;
        }
    });

    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(event) {
        const modals = [
            'wallet-modal',
            'number-selection-modal', 
            'claim-prize-modal'
        ];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

console.log('✅ VeriRifa-Sol - Script cargado completamente');
