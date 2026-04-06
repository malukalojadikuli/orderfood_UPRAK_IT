// ===== CONFIG =====
const API_URL = window.location.origin + '/api';

// ===== STATE =====
let menuItems = [];
let cart = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    loadCart();
    fetchMenu();
    updateCartCount();
});

// ===== FETCH MENU FROM SERVER =====
async function fetchMenu() {
    try {
        const response = await fetch(`${API_URL}/menu`);
        menuItems = await response.json();
        renderMenu();
    } catch (error) {
        showToast('Gagal memuat menu, coba refresh halaman');
        console.error('fetchMenu error:', error);
    }
}

// ===== RENDER MENU =====
function renderMenu() {
    document.getElementById('menuGrid').innerHTML =
        menuItems.map(item => createMenuItemHTML(item)).join('');
}

function createMenuItemHTML(item) {
    const soldOut = item.stock === 0;
    const cartItem = cart.find(c => c.id === item.id);
    const inCart = !!cartItem;

    if (soldOut) {
        return `
            <div class="menu-item sold-out-item" data-testid="menu-item-${item.id}">
                <img src="${item.imageUrl}" alt="${item.name}" class="menu-item-image" data-testid="menu-item-image-${item.id}">
                <div class="menu-item-content">
                    <div class="menu-item-name" data-testid="menu-item-name-${item.id}">${item.name}</div>
                    <div class="menu-item-price" data-testid="menu-item-price-${item.id}">Rp ${formatPrice(item.price)}</div>
                    <button class="btn-add" disabled style="background:#ccc;cursor:not-allowed;">Sold Out</button>
                </div>
            </div>
        `;
    }

    if (inCart) {
        return `
            <div class="menu-item" data-testid="menu-item-${item.id}">
                <img src="${item.imageUrl}" alt="${item.name}" class="menu-item-image" data-testid="menu-item-image-${item.id}">
                <div class="menu-item-content">
                    <div class="menu-item-name" data-testid="menu-item-name-${item.id}">${item.name}</div>
                    <div class="menu-item-price" data-testid="menu-item-price-${item.id}">Rp ${formatPrice(item.price)}</div>
                    <div class="quantity-controls">
                        <button class="btn-qty" onclick="updateQuantity(${item.id}, -1)">−</button>
                        <span class="quantity">${cartItem.quantity}</span>
                        <button class="btn-qty" onclick="updateQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="menu-item" data-testid="menu-item-${item.id}">
            <img src="${item.imageUrl}" alt="${item.name}" class="menu-item-image" data-testid="menu-item-image-${item.id}">
            <div class="menu-item-content">
                <div class="menu-item-name" data-testid="menu-item-name-${item.id}">${item.name}</div>
                <div class="menu-item-price" data-testid="menu-item-price-${item.id}">Rp ${formatPrice(item.price)}</div>
                <button class="btn-add" onclick="addToCart(${item.id})" data-testid="add-to-cart-${item.id}">Tambah ke Pesanan</button>
            </div>
        </div>
    `;
}

// ===== CART =====
function addToCart(itemId) {
    const item = menuItems.find(m => m.id === itemId);
    if (!item) return;

    const existing = cart.find(c => c.id === itemId);
    if (existing) {
        if (existing.quantity + 1 > item.stock) {
            showToast(`Stok ${item.name} hanya tersisa ${item.stock}`);
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({ id: item.id, name: item.name, price: item.price, quantity: 1 });
    }

    saveCart();
    updateCartCount();
    renderMenu();
    showToast(`${item.name} ditambahkan ke keranjang`);
}

function updateQuantity(itemId, change) {
    const item = cart.find(c => c.id === itemId);
    if (!item) return;

    const menuItem = menuItems.find(m => m.id === itemId);
    if (!menuItem) return;

    const newQuantity = item.quantity + change;
    if (newQuantity > menuItem.stock) {
        showToast(`Stok ${item.name} hanya tersisa ${menuItem.stock}`);
        return;
    }

    item.quantity = newQuantity;
    if (item.quantity <= 0) {
        removeFromCart(itemId);
        return;
    }

    saveCart();
    renderCart();
    renderMenu();
    updateCartCount();
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
    renderCart();
    renderMenu();
    updateCartCount();
    showToast('Item dihapus dari keranjang');
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
    if (saved) cart = JSON.parse(saved);
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

// ===== CONFIRM ORDER - sends to server =====
async function confirmOrder(event) {
    event.preventDefault();

    const customerName = document.getElementById('customerName').value;
    const pickupLocation = document.getElementById('pickupLocation').value;

    if (!customerName || !pickupLocation) {
        showToast('Mohon lengkapi semua data');
        return;
    }

    const orderNumber = 'ORD-' + Date.now().toString().slice(-8);
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderPayload = {
        id: orderNumber,
        customer_name: customerName,
        pickup_location: pickupLocation,
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
            showToast('Gagal membuat pesanan, coba lagi');
            console.error(result);
            return;
        }

        // Clear cart then redirect to the dedicated status page
        cart = [];
        saveCart();
        updateCartCount();

        window.location.href = `status.html?order=${orderNumber}`;

    } catch (error) {
        showToast('Tidak bisa terhubung ke server');
        console.error('confirmOrder error:', error);
    }
}

// ===== NAVIGATION =====
function showMenu() {
    hideAllSections();
    document.getElementById('menuSection').classList.remove('hidden');
}

function showCart() {
    hideAllSections();
    document.getElementById('cartSection').classList.remove('hidden');
    renderCart();
}

function showCheckout() {
    if (cart.length === 0) {
        showToast('Keranjang Anda kosong');
        return;
    }
    hideAllSections();
    document.getElementById('checkoutSection').classList.remove('hidden');
    renderCheckoutItems();
    updateTotal();
}

function hideAllSections() {
    ['menuSection', 'cartSection', 'checkoutSection']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
}

// ===== UTILS =====
function formatPrice(price) {
    return price.toLocaleString('id-ID');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}