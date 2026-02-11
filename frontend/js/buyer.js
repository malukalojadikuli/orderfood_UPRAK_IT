const menuData = {
    coffee: [
        { id: 1, name: 'Menu Contoh 1', price: 25000, category: 'coffee', emoji: '☕' },
        { id: 2, name: 'Menu Contoh 2', price: 28000, category: 'coffee', emoji: '☕' }
    ],
    nonCoffee: [
        { id: 3, name: 'Menu Contoh 3', price: 22000, category: 'nonCoffee', emoji: '🥤' },
        { id: 4, name: 'Menu Contoh 4', price: 24000, category: 'nonCoffee', emoji: '🧃' }
    ],
    snack: [
        { id: 5, name: 'Menu Contoh 5', price: 18000, category: 'snack', emoji: '🍰' },
        { id: 6, name: 'Menu Contoh 6', price: 20000, category: 'snack', emoji: '🥐' }
    ]
};

// State Management - Keranjang disimpan di localStorage
let cart = [];

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    loadCart();
    renderMenu();
    updateCartCount();
});

// Render Menu ke HTML
function renderMenu() {
    // Render Coffee Menu
    const coffeeContainer = document.getElementById('coffeeMenu');
    coffeeContainer.innerHTML = menuData.coffee.map(item => createMenuItemHTML(item)).join('');

    // Render Non-Coffee Menu
    const nonCoffeeContainer = document.getElementById('nonCoffeeMenu');
    nonCoffeeContainer.innerHTML = menuData.nonCoffee.map(item => createMenuItemHTML(item)).join('');

    // Render Snack Menu
    const snackContainer = document.getElementById('snackMenu');
    snackContainer.innerHTML = menuData.snack.map(item => createMenuItemHTML(item)).join('');
}

// Create Menu Item HTML
function createMenuItemHTML(item) {
    return `
        <div class=\"menu-item\" data-testid=\"menu-item-${item.id}\">
            <div class=\"menu-item-image\">${item.emoji}</div>
            <div class=\"menu-item-content\">
                <div class=\"menu-item-name\" data-testid=\"menu-item-name-${item.id}\">${item.name}</div>
                <div class=\"menu-item-price\" data-testid=\"menu-item-price-${item.id}\">Rp ${formatPrice(item.price)}</div>
                <button class=\"btn-add\" onclick=\"addToCart(${item.id})\" data-testid=\"add-to-cart-${item.id}\">
                    Tambah ke Pesanan
                </button>
            </div>
        </div>
    `;
}

// Format harga ke format Rupiah
function formatPrice(price) {
    return price.toLocaleString('id-ID');
}

// Tambah item ke keranjang
function addToCart(itemId) {
    // Cari item dari semua kategori
    let item = null;
    for (let category in menuData) {
        item = menuData[category].find(m => m.id === itemId);
        if (item) break;
    }

    if (!item) return;

    // Cek apakah item sudah ada di keranjang
    const existingItem = cart.find(cartItem => cartItem.id === itemId);
    
    if (existingItem) {
        existingItem.quantity += 1;
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
    showToast(`${item.name} ditambahkan ke keranjang`);
}

// Update jumlah item di keranjang
function updateQuantity(itemId, change) {
    const item = cart.find(cartItem => cartItem.id === itemId);
    
    if (item) {
        item.quantity += change;
        
        // Hapus item jika quantity = 0
        if (item.quantity <= 0) {
            removeFromCart(itemId);
            return;
        }
        
        saveCart();
        renderCart();
        updateCartCount();
    }
}

// Hapus item dari keranjang
function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCart();
    renderCart();
    updateCartCount();
    showToast('Item dihapus dari keranjang');
}

// Render keranjang
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

    // Render cart items
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class=\"cart-item\" data-testid=\"cart-item-${item.id}\">
            <div class=\"cart-item-info\">
                <h4 data-testid=\"cart-item-name-${item.id}\">${item.name}</h4>
                <p data-testid=\"cart-item-price-${item.id}\">Rp ${formatPrice(item.price)}</p>
            </div>
            <div class=\"cart-item-actions\">
                <div class=\"quantity-controls\">
                    <button class=\"btn-qty\" onclick=\"updateQuantity(${item.id}, -1)\" data-testid=\"decrease-quantity-${item.id}\">−</button>
                    <span class=\"quantity\" data-testid=\"item-quantity-${item.id}\">${item.quantity}</span>
                    <button class=\"btn-qty\" onclick=\"updateQuantity(${item.id}, 1)\" data-testid=\"increase-quantity-${item.id}\">+</button>
                </div>
                <button class=\"btn-remove\" onclick=\"removeFromCart(${item.id})\" data-testid=\"remove-item-${item.id}\">Hapus</button>
            </div>
        </div>
    `).join('');

    // Update total
    updateTotal();
}

// Update total harga
function updateTotal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('totalPrice').textContent = `Rp ${formatPrice(total)}`;
    
    const checkoutTotal = document.getElementById('checkoutTotal');
    if (checkoutTotal) {
        checkoutTotal.textContent = `Rp ${formatPrice(total)}`;
    }
}

// Update jumlah di tombol keranjang
function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
}

// Simpan keranjang ke localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Load keranjang dari localStorage
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

// Show toast notification dengan animasi smooth
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

// Navigation Functions
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
    document.getElementById('menuSection').classList.add('hidden');
    document.getElementById('cartSection').classList.add('hidden');
    document.getElementById('checkoutSection').classList.add('hidden');
    document.getElementById('confirmationSection').classList.add('hidden');
}

// Render checkout items
function renderCheckoutItems() {
    const checkoutItemsContainer = document.getElementById('checkoutItems');
    checkoutItemsContainer.innerHTML = cart.map(item => `
        <div class=\"checkout-item\" data-testid=\"checkout-item-${item.id}\">
            <span data-testid=\"checkout-item-details-${item.id}\">${item.name} x${item.quantity}</span>
            <span data-testid=\"checkout-item-subtotal-${item.id}\">Rp ${formatPrice(item.price * item.quantity)}</span>
        </div>
    `).join('');
}

// Konfirmasi pesanan
function confirmOrder(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    const pickupLocation = document.getElementById('pickupLocation').value;
    
    if (!customerName || !pickupLocation) {
        showToast('Mohon lengkapi semua data');
        return;
    }
    
    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString().slice(-8);
    
    // Set confirmation data
    document.getElementById('orderNumber').textContent = orderNumber;
    document.getElementById('confirmCustomerName').textContent = customerName;
    document.getElementById('confirmPickupLocation').textContent = pickupLocation;
    
    // Clear cart
    cart = [];
    saveCart();
    updateCartCount();
    
    // Show confirmation
    hideAllSections();
    document.getElementById('confirmationSection').classList.remove('hidden');
    
    // Reset form
    document.getElementById('checkoutForm').reset();
}

// Mulai pesanan baru
function newOrder() {
    showMenu();
}