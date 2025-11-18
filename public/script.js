/******************************************
 * VeriRifa-Sol - script.js (completo)
 * - Solana Testnet (Phantom / Solflare)
 * - Firestore (raffles, transactions, winners)
 * - Crear sorteo (admin), comprar números, seleccionar ganador, reclamar premio
 *
 * Nota: el storageBucket se ajustó a .appspot.com (corrige si tu bucket es distinto).
 ******************************************/

/* ===== CONFIG - ya vienen del ZIP; si cambias, actualiza aquí ===== */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBFeUIpZ4SvDJH60WJyuPB9Ud2JJSbjN7Q",
    authDomain: "veririfa-sol.firebaseapp.com",
    projectId: "veririfa-sol",
    // storageBucket corregido a formato appspot.com
    storageBucket: "veririfa-sol.appspot.com",
    messagingSenderId: "398195570983",
    appId: "1:398195570983:web:f415c5e20213ccca2fd102",
    measurementId: "G-1BJXVTRG15"
};

const ADMIN_WALLET_ADDRESS = '3Yekte2UrR2rKFBfm3q6D2DyinZKN58svqJvQF87RX3o';
const SOLANA_NETWORK = 'testnet'; // testnet

/* ===== App state ===== */
const appState = {
  connection: null,
  wallet: null, // { publicKey, provider, balance }
  raffles: [],
  winners: [],
  currentRaffleId: null,
  selectedNumbers: [], // for modal
  pageSize: 100 // números por "página" (si quieres paginar grandes)
};

/* ===== Init ===== */
window.addEventListener('load', initApp);

async function initApp(){
  try {
    initFirebase();
    await connectToSolana();
    setupUIHandlers();
    await loadAllData();
    showAlert('VeriRifa-Sol lista (Testnet)', 'success');
  } catch (err) {
    console.error('initApp error', err);
    showAlert('Error inicializando la app: ' + (err.message || err), 'error', 8000);
  }
}

/* ===== Firebase ===== */
function initFirebase(){
  if (!window.firebase) {
    console.error('Firebase SDK no cargado');
    showAlert('Firebase SDK no cargado', 'error');
    return;
  }
  firebase.initializeApp(FIREBASE_CONFIG);
  window.db = firebase.firestore();
  window.analytics = firebase.analytics ? firebase.analytics() : null;
  console.log('Firebase init');
}

/* ===== Solana connection ===== */
async function connectToSolana(){
  appState.connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl(SOLANA_NETWORK), 'confirmed');
  try {
    const ver = await appState.connection.getVersion();
    document.getElementById('network-indicator').textContent = '🟢 Solana Testnet';
    console.log('Connected to Solana:', ver);
  } catch (err) {
    console.error('Error connecting to Solana', err);
    document.getElementById('network-indicator').textContent = '🔴 Error Solana';
    throw err;
  }
}

/* ===== UI helpers ===== */
function showAlert(msg, type='info', timeout=4000){
  const container = document.getElementById('alerts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'alert';
  el.innerText = msg;
  container.appendChild(el);
  if (timeout>0) setTimeout(()=> el.remove(), timeout);
}

function formatShortAddr(a){
  if (!a) return '';
  a = String(a);
  return `${a.slice(0,6)}...${a.slice(-4)}`;
}

/* ===== Load data ===== */
async function loadAllData(){
  await Promise.all([loadRafflesFromFirebase(), loadWinnersFromFirebase()]);
  renderRaffles();
  renderWinners();
}

/* Load raffles */
async function loadRafflesFromFirebase(){
  if (!window.db) return;
  try {
    const snap = await db.collection('raffles').orderBy('createdAt','desc').get();
    const arr = [];
    snap.forEach(d => {
      const data = d.data();
      data.id = d.id;
      // normalize
      data.soldNumbers = data.soldNumbers || [];
      data.numberOwners = data.numberOwners || {};
      data.purchases = data.purchases || [];
      data.completed = data.completed || false;
      arr.push(data);
    });
    appState.raffles = arr;
    console.log('Raffles loaded', arr.length);
  } catch (err) {
    console.error('loadRafflesFromFirebase', err);
    showAlert('Error cargando sorteos', 'error');
  }
}

/* Load winners (archive) */
async function loadWinnersFromFirebase(){
  if (!window.db) return;
  try {
    const snap = await db.collection('winners').orderBy('winnerDate','desc').get();
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    appState.winners = arr;
  } catch (err) {
    console.error('loadWinnersFromFirebase', err);
  }
}

/* ===== Render UI: raffles ===== */
function renderRaffles(){
  const container = document.getElementById('raffles-container');
  if (!container) return;
  container.innerHTML = '';

  if (!appState.raffles.length) {
    container.innerHTML = `<div style="padding:20px;color:var(--muted)">No hay sorteos activos.</div>`;
    return;
  }

  appState.raffles.forEach(raffle => {
    const sold = (raffle.soldNumbers || []).length;
    const total = raffle.totalNumbers || raffle.maxNumbers || raffle.numberCount || 0;
    const percent = total ? Math.round((sold/total)*100) : 0;
    const completed = raffle.completed || (total > 0 && sold >= total);
    const isWinnerSelected = !!raffle.winner;

    const card = document.createElement('div');
    card.className = 'raffle-card';

    // image or emoji
    let imageHtml = '';
    if (raffle.image && String(raffle.image).startsWith('http')) {
      imageHtml = `<div class="raffle-image"><img src="${raffle.image}" alt="${escapeHtml(raffle.name)}" /></div>`;
    } else {
      imageHtml = `<div class="raffle-image" style="font-size:2rem">${raffle.image || '🎁'}</div>`;
    }

    const actionBtnHtml = (() => {
      if (isWinnerSelected) {
        if (appState.wallet && appState.wallet.publicKey && raffle.winner.wallet === appState.wallet.publicKey.toString()) {
          // user is winner
          if (raffle.prizeClaimed) {
            return `<button class="btn" disabled>✅ Premio Reclamado</button>`;
          } else {
            return `<button class="btn btn-success claim-prize-btn" data-id="${raffle.id}">🎉 Reclamar Premio</button>`;
          }
        } else {
          return `<button class="btn" disabled>🔒 Ganador seleccionado</button>`;
        }
      }
      if (completed) {
        // admin can select winner
        if (appState.wallet && appState.wallet.publicKey && appState.wallet.publicKey.toString() === ADMIN_WALLET_ADDRESS) {
          return `<button class="btn btn-warning select-winner-btn" data-id="${raffle.id}">🎰 Seleccionar Ganador</button>`;
        } else {
          return `<button class="btn" disabled>🔒 Completado</button>`;
        }
      } else {
        // participate
        return `<button class="btn participate-btn" data-id="${raffle.id}">🎫 Participar (${raffle.price} SOL)</button>`;
      }
    })();

    const prizeText = raffle.prize ? escapeHtml(raffle.prize) : '—';

    card.innerHTML = `
      ${imageHtml}
      <div class="raffle-content">
        <h3 class="raffle-title">${escapeHtml(raffle.name)}</h3>
        <div class="raffle-price">${raffle.price} SOL / número</div>
        <div class="raffle-info">Premio: ${prizeText} • ${sold}/${total} números</div>
        <div class="progress-bar"><div class="progress" style="width:${percent}%;"></div></div>
      </div>
      <div style="width:150px">${actionBtnHtml}</div>
    `;
    container.appendChild(card);
  });

  // attach listeners
  document.querySelectorAll('.participate-btn').forEach(b => b.addEventListener('click', onParticipate));
  document.querySelectorAll('.select-winner-btn').forEach(b => b.addEventListener('click', onSelectWinner));
  document.querySelectorAll('.claim-prize-btn').forEach(b => b.addEventListener('click', onOpenClaimModal));
}

/* ===== Render winners list ===== */
function renderWinners(){
  const c = document.getElementById('winners-container');
  if (!c) return;
  c.innerHTML = '';
  if (!appState.winners.length) {
    c.innerHTML = '<div style="color:var(--muted);padding:8px">Aún no hay ganadores</div>';
    return;
  }
  appState.winners.forEach(w => {
    const el = document.createElement('div');
    el.className = 'winner-card';
    el.innerHTML = `<div><strong>${escapeHtml(w.raffleName)}</strong> — Nº ${w.winningNumber} — ${formatShortAddr(w.winnerWallet)} — ${new Date(w.winnerDate?.toDate ? w.winnerDate.toDate() : w.winnerDate).toLocaleString()}</div>`;
    c.appendChild(el);
  });
}

/* ===== Handlers ===== */
function setupUIHandlers(){
  // wallet modal
  document.getElementById('open-wallet-modal-btn').addEventListener('click', () => {
    document.getElementById('wallet-modal').classList.remove('hidden');
  });
  document.getElementById('close-wallet-modal').addEventListener('click', () => {
    document.getElementById('wallet-modal').classList.add('hidden');
  });

  document.getElementById('connect-phantom').addEventListener('click', () => connectWallet('phantom'));
  document.getElementById('connect-solflare').addEventListener('click', () => connectWallet('solflare'));
  document.getElementById('disconnect-wallet-btn').addEventListener('click', disconnectWallet);

  // create raffle form
  const createForm = document.getElementById('create-raffle-form');
  createForm.addEventListener('submit', onCreateRaffle);
  document.getElementById('admin-refresh-btn').addEventListener('click', async () => { await loadRafflesFromFirebase(); renderRaffles(); showAlert('Lista actualizada', 'success'); });

  // number modal controls
  document.getElementById('close-number-modal').addEventListener('click', () => document.getElementById('number-selection-modal').classList.add('hidden'));
  document.getElementById('cancel-selection-btn').addEventListener('click', () => document.getElementById('number-selection-modal').classList.add('hidden'));
  document.getElementById('confirm-payment-btn').addEventListener('click', handleConfirmPayment);

  // claim modal
  document.getElementById('close-claim-modal').addEventListener('click', () => document.getElementById('claim-modal').classList.add('hidden'));
  document.getElementById('cancel-claim').addEventListener?.('click', ()=> document.getElementById('claim-modal').classList.add('hidden'));
  document.getElementById('submit-claim').addEventListener('click', submitClaim);
}

/* ===== Wallet connect/disconnect ===== */
async function connectWallet(type='phantom'){
  try {
    let provider = null;
    if (type === 'phantom') provider = window.solana && window.solana.isPhantom ? window.solana : null;
    if (type === 'solflare') provider = window.solflare ? window.solflare : null;

    if (!provider) {
      showAlert(`${type} no detectada. Instala la extensión.`, 'warning', 5000);
      return;
    }

    await provider.connect();
    const pubkey = provider.publicKey;
    const balanceLamports = await appState.connection.getBalance(pubkey);
    const balance = balanceLamports / solanaWeb3.LAMPORTS_PER_SOL;

    appState.wallet = { publicKey: pubkey, provider: provider, balance };

    document.getElementById('wallet-address').textContent = formatShortAddr(pubkey.toString());
    document.getElementById('wallet-balance').textContent = `${balance.toFixed(4)} SOL`;
    document.getElementById('disconnect-wallet-btn').classList.remove('hidden');
    document.getElementById('wallet-modal').classList.add('hidden');

    // admin section visibility
    if (pubkey.toString() === ADMIN_WALLET_ADDRESS) {
      document.getElementById('admin-section').classList.remove('hidden');
      showAlert('Modo Admin activado', 'success');
    } else {
      document.getElementById('admin-section').classList.add('hidden');
    }

    // refresh lists (balance or permissions changed)
    await loadRafflesFromFirebase();
    renderRaffles();
  } catch (err) {
    console.error('connectWallet', err);
    showAlert('Error conectando wallet: ' + (err.message || err), 'error');
  }
}

function disconnectWallet(){
  try {
    if (appState.wallet && appState.wallet.provider && appState.wallet.provider.disconnect) {
      appState.wallet.provider.disconnect();
    }
  } catch(e){ /* ignore */ }

  appState.wallet = null;
  document.getElementById('wallet-address').textContent = '';
  document.getElementById('wallet-balance').textContent = '';
  document.getElementById('disconnect-wallet-btn').classList.add('hidden');
  document.getElementById('admin-section').classList.add('hidden');
  showAlert('Wallet desconectada', 'info');
}

/* ===== Create raffle ===== */
async function onCreateRaffle(e){
  e.preventDefault();
  if (!appState.wallet || appState.wallet.publicKey.toString() !== ADMIN_WALLET_ADDRESS) {
    showAlert('Solo la wallet admin puede crear sorteos', 'error');
    return;
  }

  const name = document.getElementById('raffle-name').value.trim();
  const description = document.getElementById('raffle-description').value.trim();
  const prize = document.getElementById('raffle-prize').value.trim() || name;
  const price = parseFloat(document.getElementById('ticket-price').value);
  const totalNumbers = parseInt(document.getElementById('max-numbers').value, 10);
  const image = document.getElementById('raffle-image').value.trim() || '🎁';

  if (!name || !price || !totalNumbers) {
    showAlert('Completa nombre, precio y cantidad', 'warning');
    return;
  }

  const doc = {
    name,
    description,
    prize,
    price,
    totalNumbers,
    image,
    owner: ADMIN_WALLET_ADDRESS,
    soldNumbers: [],
    numberOwners: {},
    purchases: [],
    completed: false,
    isSelectingWinner: false,
    prizeClaimed: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    const ref = await db.collection('raffles').add(doc);
    // save id
    await ref.update({ id: ref.id });
    showAlert('Sorteo creado', 'success');
    document.getElementById('create-raffle-form').reset();
    await loadRafflesFromFirebase();
    renderRaffles();
  } catch (err) {
    console.error('create raffle error', err);
    showAlert('Error creando sorteo: ' + (err.message || err), 'error');
  }
}

/* ===== Participate -> open numbers modal ===== */
function onParticipate(ev){
  const raffleId = ev.currentTarget.getAttribute('data-id');
  openNumberSelectionModal(raffleId);
}

async function openNumberSelectionModal(raffleId){
  const raffle = appState.raffles.find(r => r.id === raffleId);
  if (!raffle) {
    showAlert('Sorteo no encontrado', 'error');
    return;
  }
  appState.currentRaffleId = raffleId;
  appState.selectedNumbers = [];

  // set modal text
  document.getElementById('modal-raffle-title').textContent = raffle.name;
  document.getElementById('modal-price').textContent = `${raffle.price} SOL`;
  document.getElementById('selected-count').textContent = '0';
  document.getElementById('total-payment').textContent = `0 SOL`;

  // build numbers grid (with pagination support)
  const grid = document.getElementById('numbers-grid');
  grid.innerHTML = '';
  const total = raffle.totalNumbers || raffle.maxNumbers || 100;
  for (let n=1; n<=total; n++){
    const btn = document.createElement('div');
    btn.className = 'number';
    btn.textContent = n;
    btn.dataset.num = n;
    if (raffle.soldNumbers && raffle.soldNumbers.includes(String(n))) {
      btn.classList.add('sold');
    } else {
      btn.addEventListener('click', () => toggleSelectNumber(btn, n));
    }
    grid.appendChild(btn);
  }

  renderSelectedPreview();
  document.getElementById('number-selection-modal').classList.remove('hidden');
}

function toggleSelectNumber(el, n){
  const s = String(n);
  const idx = appState.selectedNumbers.indexOf(s);
  if (idx === -1) {
    // select
    appState.selectedNumbers.push(s);
    el.classList.add('selected');
  } else {
    // deselect
    appState.selectedNumbers.splice(idx,1);
    el.classList.remove('selected');
  }
  renderSelectedPreview();
}

function renderSelectedPreview(){
  const list = document.getElementById('selected-list');
  list.innerHTML = '';
  appState.selectedNumbers.forEach(n => {
    const d = document.createElement('div');
    d.textContent = n;
    list.appendChild(d);
  });
  document.getElementById('selected-count').textContent = `${appState.selectedNumbers.length}`;
  // total
  const raffle = appState.raffles.find(r=> r.id === appState.currentRaffleId);
  const totalSOL = (raffle?.price || 0) * appState.selectedNumbers.length;
  document.getElementById('total-payment').textContent = `${totalSOL} SOL`;
}

/* ===== Confirm and process payment via Phantom (Testnet) ===== */
async function handleConfirmPayment(){
  if (!appState.wallet || !appState.wallet.publicKey) {
    showAlert('Conecta tu wallet para comprar', 'warning');
    return;
  }
  if (!appState.selectedNumbers.length) {
    showAlert('Selecciona al menos un número', 'warning');
    return;
  }

  const raffleId = appState.currentRaffleId;
  const raffleRef = db.collection('raffles').doc(raffleId);
  // fetch latest raffle doc to avoid race
  const raffleSnap = await raffleRef.get();
  if (!raffleSnap.exists) {
    showAlert('Sorteo no encontrado', 'error');
    return;
  }
  const raffle = raffleSnap.data();

  // check collisions
  for (const num of appState.selectedNumbers) {
    if ((raffle.soldNumbers || []).includes(String(num))) {
      showAlert(`El número ${num} ya fue vendido`, 'error');
      return;
    }
  }

  // amount
  const totalSOL = Number(raffle.price) * appState.selectedNumbers.length;
  const lamports = Math.floor(totalSOL * solanaWeb3.LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    showAlert('Total inválido', 'error');
    return;
  }

  // prepare tx (transfer to raffle.owner)
  try {
    const fromPubkey = new solanaWeb3.PublicKey(appState.wallet.publicKey.toString());
    const toPubkey = new solanaWeb3.PublicKey(raffle.owner || ADMIN_WALLET_ADDRESS);

    const tx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports
      })
    );

    // set recent blockhash
    const { blockhash } = await appState.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    // request signature from provider (Phantom)
    const signed = await appState.wallet.provider.signTransaction(tx);
    const raw = signed.serialize();
    const txid = await appState.connection.sendRawTransaction(raw);

    showAlert('Transacción enviada: ' + txid + ' — esperando confirmación...', 'info', 7000);

    // wait confirmation
    const conf = await appState.connection.confirmTransaction(txid, 'confirmed');
    if (conf.value && conf.value.err) {
      throw new Error('Transacción falló: ' + JSON.stringify(conf.value.err));
    }

    // write purchase to Firestore (transaction successful)
    await finalizePurchaseOnFirebase(raffleRef, raffle, appState.selectedNumbers, txid, appState.wallet.publicKey.toString());

    showAlert('Compra confirmada. Tx: ' + txid, 'success', 7000);
    document.getElementById('number-selection-modal').classList.add('hidden');

    // reload
    await loadRafflesFromFirebase();
    renderRaffles();

  } catch (err) {
    console.error('payment error', err);
    showAlert('Error durante la transacción: ' + (err.message || err), 'error', 8000);
  }
}

/* finalizePurchaseOnFirebase: updates raffle doc atomically using transaction */
async function finalizePurchaseOnFirebase(raffleRef, raffle, selectedNumbers, txid, buyerPubKey){
  // Use transaction to avoid race conditions
  const dbt = db;
  const selectedSet = selectedNumbers.map(String);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (t) => {
    const doc = await t.get(raffleRef);
    if (!doc.exists) throw new Error('Sorteo no existe (transacción)');

    const data = doc.data();
    const sold = data.soldNumbers || [];
    // check collisions again
    for (const n of selectedSet) {
      if (sold.includes(String(n))) throw new Error('Número ya vendido: ' + n);
    }

    // update arrays/maps
    const newSold = sold.concat(selectedSet);
    const purchases = data.purchases || [];
    purchases.push({
      buyer: buyerPubKey,
      numbers: selectedSet,
      txid,
      date: now
    });

    // update numberOwners map
    const numberOwners = data.numberOwners || {};
    for (const n of selectedSet) numberOwners[String(n)] = buyerPubKey;

    const completed = (data.totalNumbers || data.maxNumbers || 0) <= newSold.length;

    t.update(raffleRef, {
      soldNumbers: newSold,
      purchases,
      numberOwners,
      completed,
      lastUpdated: now
    });

    // add transaction log
    const txRef = db.collection('transactions').doc();
    t.set(txRef, {
      raffleId: raffleRef.id,
      buyer: buyerPubKey,
      numbers: selectedSet,
      txid,
      createdAt: now
    });
  });
}

/* ===== Selecting winner (admin) ===== */
async function onSelectWinner(ev){
  const raffleId = ev.currentTarget.getAttribute('data-id');
  if (!appState.wallet || appState.wallet.publicKey.toString() !== ADMIN_WALLET_ADDRESS) {
    showAlert('Solo admin puede seleccionar ganador', 'error');
    return;
  }
  const raffleRef = db.collection('raffles').doc(raffleId);
  const snap = await raffleRef.get();
  if (!snap.exists) { showAlert('Sorteo no existe', 'error'); return; }
  const raffle = snap.data();
  if (!raffle.soldNumbers || raffle.soldNumbers.length === 0) { showAlert('No hay números vendidos', 'warning'); return; }

  // mark selecting
  await raffleRef.update({ isSelectingWinner: true });
  showAlert('Seleccionando ganador...', 'info', 3000);

  // random pick from soldNumbers
  const sold = raffle.soldNumbers;
  const idx = Math.floor(Math.random() * sold.length);
  const winningNumber = sold[idx];
  const winnerWallet = raffle.numberOwners ? raffle.numberOwners[winningNumber] : null;

  const winnerDoc = {
    raffleId,
    raffleName: raffle.name,
    winningNumber,
    winnerWallet,
    prize: raffle.prize || raffle.name,
    winnerDate: firebase.firestore.FieldValue.serverTimestamp()
  };

  // update raffle doc
  await raffleRef.update({
    winner: { number: winningNumber, wallet: winnerWallet },
    isSelectingWinner: false,
    completed: true,
    winnerSelectedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // add to winners collection
  await db.collection('winners').add(winnerDoc);

  showAlert('Ganador seleccionado: número ' + winningNumber + ' — ' + formatShortAddr(winnerWallet), 'success', 6000);

  // reload
  await loadRafflesFromFirebase();
  await loadWinnersFromFirebase();
  renderRaffles();
  renderWinners();
}

/* ===== Claim prize flow ===== */
function onOpenClaimModal(ev){
  const raffleId = ev.currentTarget.getAttribute('data-id');
  appState.currentRaffleId = raffleId;
  document.getElementById('claim-modal').classList.remove('hidden');
  const raffle = appState.raffles.find(r=> r.id === raffleId);
  document.getElementById('claim-info').textContent = `Reclama: ${raffle?.prize || raffle?.name} — Nº ganador: ${raffle?.winner?.number || 'N/A'}`;
}

async function submitClaim(){
  const name = document.getElementById('claim-name').value.trim();
  const email = document.getElementById('claim-email').value.trim();
  const phone = document.getElementById('claim-phone').value.trim();
  const address = document.getElementById('claim-address').value.trim();

  if (!name || !email || !phone || !address) {
    showAlert('Completa todos los campos para reclamar', 'warning');
    return;
  }

  const raffleId = appState.currentRaffleId;
  const raffleRef = db.collection('raffles').doc(raffleId);
  const raffleSnap = await raffleRef.get();
  if (!raffleSnap.exists) { showAlert('Sorteo no encontrado', 'error'); return; }
  const raffle = raffleSnap.data();
  const userWallet = appState.wallet && appState.wallet.publicKey ? appState.wallet.publicKey.toString() : null;

  // validate wallet matches winner
  if (!raffle.winner || raffle.winner.wallet !== userWallet){
    showAlert('Tu wallet no coincide con la wallet del ganador', 'error');
    return;
  }

  // store claim info
  await raffleRef.update({
    prizeClaimed: true,
    claimInfo: { name, email, phone, address, claimedAt: firebase.firestore.FieldValue.serverTimestamp() }
  });

  showAlert('Reclamo enviado. El admin gestionará el envío.', 'success');
  document.getElementById('claim-modal').classList.add('hidden');

  // optionally add to claims collection
  await db.collection('claims').add({
    raffleId,
    winnerWallet: userWallet,
    name, email, phone, address,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // refresh
  await loadRafflesFromFirebase();
  renderRaffles();
}

/* ===== Utility ===== */
function escapeHtml(s=''){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

