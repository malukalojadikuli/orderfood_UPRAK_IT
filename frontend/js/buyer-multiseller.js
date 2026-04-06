// ===== API URL MANAGEMENT =====
let API_URL = localStorage.getItem('API_URL') || window.location.origin + '/api';
let RETRY_COUNT = 0;
const MAX_RETRIES = 3;

// ===== STATE =====
let menuItems = [];
let cart = [];
let selectedLocation = null;
let selectedLocationName = null;
let locations = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async function () {
    await initializeAPI();
    await loadLocations();
    loadCart();
    updateCartCount();
    showLocationSelector();
});

async function initializeAPI() {
    try {
        const configUrl = `${window.location.origin}/api/config`;
        const response = await fetch(configUrl);
        
        if (response.ok) {
            const config = await response.json();
            API_URL = config.apiUrl || (window.location.origin + '/api');
            localStorage.setItem('API_URL', API_URL);
            console.log(`✅ API URL initialized: ${API_URL}`);
        }
    } catch (error) {
        console.warn('Could not fetch API config, using fallback:', error);
    }
}

// ===== LOCATION MANAGEMENT =====
async function loadLocations() {
    try {
        const response = await fetch(`${API_URL}/config`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const config = await response.json();
            locations = config.locations || [];
            renderLocationSelector();
        }
    } catch (error) {
        console.error('Error loading locations:', error);
        // Fallback locations
        locations = [
            { id: 'seller1', name: 'Harmoni', displayName: 'Kopi & Snack - Harmoni' },
            { id: 'seller2', name: 'Bulevar', displayName: 'Kopi & Snack - Bulevar' }
        ];
        renderLocationSelector();
    }
}

function renderLocationSelector() {
    const grid = document.getElementById('locationGrid');
    if (!grid) return;

    grid.innerHTML = locations.map(location => `
        <div class="location-card" onclick="selectLocation('${location.name}', '${location.displayName}')">
            <div class="location-icon">📍</div>
            <div class="location-info">
                <h3>${location.name}</h3>
                <p>${location.displayName}</p>
            </div>
            <div class="location-arrow">→</div>
        </div>
    `).join('');
}

function selectLocation(locationName, displayName) {
    selectedLocation = locationName;
    selectedLocationName = displayName;
    
    localStorage.setItem('selectedLocation', locationName);
    localStorage.setItem('selectedLocationName', displayName);
    
    document.getElementById('selectedLocationName').textContent = locationName;
    document.getElementById('displayPickupLocation').innerHTML = `
        <strong>📍 ${displayName}</strong><br>
        <small style="color: #8d6e63;">Lokasi Pickup</small>
    `;
    
    // Hide location selector and show menu
    document.getElementById('menuSection').classList.add('hidden');
    document.getElementById('menuDisplaySection').classList.remove('hidden');
    
    fetchMenu();
    showToast(`✅ Lokasi dipilih: ${locationName}`);
}

function changeLocation() {
    selectedLocation = null;
    selectedLocationName = null;
    localStorage.removeItem('selectedLocation');
    localStorage.removeItem('selectedLocationName');
    
    document.getElementById('menuSection').classList.remove('hidden');
    document.getElementById('menuDisplaySection').classList.add('hidden');
    showMenu();
}

function showLocationSelector() {
    // Try to load previously selected location
    const saved = localStorage.getItem('selectedLocation');
    const savedName = localStorage.getItem('selectedLocationName');
    
    if (saved && savedName) {
        selectLocation(saved, savedName);
    } else {
        document.getElementById('menuSection').classList.remove('hidden');
        document.getElementById('menuDisplaySection').classList.add('hidden');
    }
}

// ===== FETCH MENU WITH LOCATION FILTER =====
async function fetchMenu() {
    if (!selectedLocation) {
        showToast('⚠️ Pilih lokasi terlebih dahulu');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/menu?location=${encodeURIComponent(selectedLocation)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        menuItems = await response.json();
        renderMenu();
        RETRY_COUNT = 0;
    } catch (error) {
        console.error('fetchMenu error:', error);
        
        if (RETRY_COUNT < MAX_RETRIES) {
            RETRY_COUNT++;
            showToast(`⏳ Mencoba ulang... (${RETRY_COUNT}/${MAX_RETRIES})`);
            setTimeout(fetchMenu, 2000);
        } else {
            showToast('❌ Gagal memuat menu. Cek koneksi internet.');
            renderMenuFromCache();
        }
    }
}

function renderMenuFromCache() {
    const cached = localStorage.getItem('menuCache');
    if (cached) {
        try {
            menuItems = JSON.parse(cached);
            renderMenu();
            showToast('📋 Menampilkan menu tersimpan');
        } catch (err) {
            console.error('Cache parse error:', err);
        }
    }
}

// ===== RENDER MENU =====
function renderMenu() {
    document.getElementById('menuGrid').innerHTML =
        menuItems.map(item => createMenuItemHTML(item)).join('');
    
    localStorage.setItem('menuCache', JSON.stringify(menuItems));
}

function createMenuItemHTML(item) {
    const soldOut = item.stock === 0;
    return `
        <div class="menu-item ${soldOut ? 'sold-out-item' : ''}" data-testid="menu-item-${item.id}">
            <div class="menu-item-image">${item.emoji || '☕'}</div>
            <div class="menu-item-content">
                <div class="menu-item-name" data-testid="menu-item-name-${item.id}">${item.name}</div>
                <div class="menu-item-price" data-testid="menu-item-price-${item.id}">Rp ${formatPrice(item.price)}</div>
                <div style="font-size: 0.8rem; color: #a1887f; margin-bottom: 0.5rem;">
                    Stok: ${item.stock > 0 ? item.stock : 'Habis'}
                </div>
                ${soldOut
                    ? `<button class="btn-add" disabled style="background:#ccc;cursor:not-allowed;">Sold Out</button>`
                    : `<button class="btn-add" onclick="addToCart(${item.id})" data-testid="add-to-cart-${item.id}">Tambah ke Pesanan</button>`
                }
            </div>
        </div>
    `;
}

// ===== CART MANAGEMENT =====
function addToCart(itemId) {
    const item = menuItems.find(m => m.id === itemId);
    if (!item) return;

    if (item.stock <= 0) {
        showToast(`${item.name} sudah habis!`);
        return;
    }

    const existing = cart.find(c => c.id === itemId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ 
            id: item.id, 
            name: item.name, 
            price: item.price, 
            quantity: 1 
        });
    }

    saveCart();
    updateCartCount();
    showToast(`✅ ${item.name} ditambahkan ke keranjang`);
}

function updateQuantity(itemId, change) {
    const item = cart.find(c => c.id === itemId);
    if (!item) return;

    item.quantity += change;
    if (item.quantity <= 0) {
        removeFromCart(itemId);
        return;
    }

    saveCart();
    renderCart();
    updateCartCount();
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
    renderCart();
    updateCartCount();
    showToast('🗑️ Item dihapus dari keranjang');
}

function renderCart() {
    const cartItemsContainer = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartSummary = document.getElementById('cartSummary');

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '';
        emptyCart.classList.remove('hidden');
        cartSummary.classList.add('hidden');
        return;
    }

    emptyCart.classList.add('hidden');
    cartSummary.classList.remove('hidden');

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item" data-testid="cart-item-${item.id}">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>Rp ${formatPrice(item.price)}</p>
            </div>
            <div class="cart-item-actions">
                <div class="quantity-controls">
                    <button class="btn-qty" onclick="updateQuantity(${item.id}, -1)">−</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="btn-qty" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
                <button class="btn-remove" onclick="removeFromCart(${item.id})">Hapus</button>
            </div>
        </div>
    `).join('');

    updateTotal();
}

function updateTotal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('totalPrice').textContent = `Rp ${formatPrice(total)}`;
    const checkoutTotal = document.getElementById('checkoutTotal');
    if (checkoutTotal) checkoutTotal.textContent = `Rp ${formatPrice(total)}`;
}

function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem('cart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
        } catch (err) {
            console.error('Cart parse error:', err);
            cart = [];
        }
    }
}

// ===== CHECKOUT =====
function renderCheckoutItems() {
    const container = document.getElementById('checkoutItems');
    container.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp ${formatPrice(item.price * item.quantity)}</span>
        </div>
    `).join('');
}

async function confirmOrder(event) {
    event.preventDefault();

    const customerName = document.getElementById('customerName').value.trim();

    if (!customerName) {
        showToast('⚠️ Mohon isi nama pemesan');
        return;
    }

    if (!selectedLocation) {
        showToast('⚠️ Lokasi pickup belum dipilih');
        return;
    }

    if (cart.length === 0) {
        showToast('⚠️ Keranjang Anda kosong');
        return;
    }

    const orderNumber = 'ORD-' + Date.now().toString().slice(-8);
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderPayload = {
        id: orderNumber,
        customer_name: customerName,
        pickup_location: selectedLocation,
        total: total,
        items: cart.map(item => ({
            menu_id: item.id,
            quantity: item.quantity,
            price: item.price
        }))
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(`❌ ${result.error || 'Gagal membuat pesanan'}`);
            console.error('Order error:', result);
            return;
        }

        const orderStatusUrl = `${window.location.origin}/status.html?order=${orderNumber}`;
        localStorage.setItem('lastOrderId', orderNumber);
        localStorage.setItem('lastOrderUrl', orderStatusUrl);
        
        cart = [];
        saveCart();
        updateCartCount();

        showToast('✅ Pesanan berhasil dibuat!');
        
        setTimeout(() => {
            window.location.href = orderStatusUrl;
        }, 1000);

    } catch (error) {
        showToast('❌ Tidak bisa terhubung ke server');
        console.error('confirmOrder error:', error);
    }
}

// ===== NAVIGATION =====
function showMenu() {
    hideAllSections();
    if (selectedLocation) {
        document.getElementById('menuDisplaySection').classList.remove('hidden');
    } else {
        document.getElementById('menuSection').classList.remove('hidden');
    }
}

function showCart() {
    hideAllSections();
    document.getElementById('cartSection').classList.remove('hidden');
    renderCart();
}

function showCheckout() {
    if (cart.length === 0) {
        showToast('⚠️ Keranjang Anda kosong');
        return;
    }
    hideAllSections();
    document.getElementById('checkoutSection').classList.remove('hidden');
    renderCheckoutItems();
    updateTotal();
}

function hideAllSections() {
    ['menuSection', 'menuDisplaySection', 'cartSection', 'checkoutSection']
        .forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.classList.add('hidden');
        });
}

// ===== UTILITIES =====
function formatPrice(price) {
    return price.toLocaleString('id-ID');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}