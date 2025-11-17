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
    } else {
        document.getElementById('admin-menu-item').classList.remove('visible');
        document.getElementById('admin-panel').classList.remove('active');
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
        
        const progress = raffle.soldNumbers.length;
        const total = raffle.totalNumbers;
        const progressPercent = total > 0 ? (progress / total) * 100 : 0;
        
        const isUserWinner = raffle.winner && appState.currentWallet.publicKey && 
                            raffle.winner.wallet === appState.currentWallet.publicKey.toString();
        
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

    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('wallet-modal')) {
            document.getElementById('wallet-modal').classList.remove('active');
        }
    });
}

// Nota: Las funciones más complejas como selección de números, procesamiento de pagos, etc.
// se han simplificado para este ejemplo. En una implementación completa, incluirías toda la lógica.