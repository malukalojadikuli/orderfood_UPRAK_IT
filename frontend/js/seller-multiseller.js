// ===== API URL & STATE =====
let API_URL = localStorage.getItem('API_URL') || window.location.origin + '/api';
let currentSeller = null;
let currentSellerId = null;

// ===== STATE =====
let orders = [];
let menuItems = [];
let editingMenuId = null;
let deletingMenuId = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async function () {
    await initializeAPI();
    checkLogin();
});

async function initializeAPI() {
    try {
        const configUrl = `${window.location.origin}/api/config`;
        const response = await fetch(configUrl);
        
        if (response.ok) {
            const config = await response.json();
            API_URL = config.apiUrl || (window.location.origin + '/api');
            localStorage.setItem('API_URL', API_URL);
        }
    } catch (error) {
        console.warn('Could not fetch API config:', error);
    }
}

// ===== LOGIN MANAGEMENT =====
function checkLogin() {
    const seller_id = localStorage.getItem('seller_id');
    const sellerToken = localStorage.getItem('seller_token');

    if (seller_id && sellerToken) {
        currentSellerId = seller_id;
        loginSuccess(seller_id);
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
}

async function handleLogin(event) {
    event.preventDefault();

    const seller_id = document.getElementById('sellerId').value.trim();
    const password = document.getElementById('sellerPassword').value.trim();

    if (!seller_id || !password) {
        showToast('⚠️ Mohon isi username dan password');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/seller/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seller_id, password })
        });

        const result = await response.json();

        if (!response.ok) {
            showToast('❌ Username atau password salah');
            console.error('Login error:', result);
            return;
        }

        // Store credentials securely (in real app, use proper auth)
        localStorage.setItem('seller_id', seller_id);
        localStorage.setItem('seller_token', 'authenticated');
        localStorage.setItem('seller_location', result.location);

        showToast(`✅ Login berhasil! Selamat datang di ${result.location}`);
        loginSuccess(seller_id, result);

    } catch (error) {
        showToast('❌ Tidak bisa terhubung ke server');
        console.error('Login error:', error);
    }
}

function loginSuccess(seller_id, sellerData = null) {
    currentSellerId = seller_id;
    
    // Set display info
    const location = sellerData?.location || localStorage.getItem('seller_location');
    const displayName = sellerData?.displayName || `Kopi & Snack - ${location}`;
    
    document.getElementById('sellerLocation').textContent = `📍 ${location}`;
    document.title = displayName;

    // Clear form and show dashboard
    document.getElementById('loginForm').reset();
    showDashboard();

    // Load data
    loadOrders();
    loadMenu();
    setInterval(loadOrders, 10000);
}

function handleLogout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        localStorage.removeItem('seller_id');
        localStorage.removeItem('seller_token');
        localStorage.removeItem('seller_location');
        
        currentSellerId = null;
        showToast('✅ Logout berhasil');
        
        setTimeout(() => {
            showLoginPage();
        }, 1000);
    }
}

// ===== NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.seller-page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => {
        if (b.classList.contains('logout-btn')) return;
        b.classList.remove('active');
    });
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
    if (pageId === 'incomePage') loadIncome();
}

// ===== ORDERS =====
async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/seller/orders`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'X-Seller-Id': currentSellerId
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                showToast('⚠️ Sesi berakhir, silakan login ulang');
                handleLogout();
            }
            throw new Error(`HTTP ${response.status}`);
        }

        orders = await response.json();
        renderOrders();
        updatePendingBadge();
    } catch (error) {
        console.error('loadOrders error:', error);
        showToast('Gagal memuat pesanan');
    }
}

function renderOrders() {
    const list = document.getElementById('ordersList');
    const empty = document.getElementById('ordersEmpty');

    // Show active orders only (not done/rejected)
    const active = orders.filter(o => o.status !== 'done' && o.status !== 'rejected');

    if (active.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    const order = { pending: 0, accepted: 1, ready: 2 };
    active.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    list.innerHTML = active.map(o => createOrderCard(o)).join('');
}

function createOrderCard(order) {
    const statusLabels = {
        pending: 'Menunggu',
        accepted: 'Diproses',
        ready: 'Siap Diambil',
    };

    const itemsHTML = order.items.map(item => `
        <div class="order-item-row">
            <span>${item.emoji || '🍽️'} ${item.name} x${item.quantity}</span>
            <span>Rp ${formatPrice(item.price * item.quantity)}</span>
        </div>
    `).join('');

    const time = new Date(order.created_at).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit'
    });

    return `
        <div class="order-card status-${order.status}" id="order-${order.id}">
            <div class="order-status-strip"></div>
            <div class="order-card-body">
                <div class="order-card-header">
                    <div>
                        <div class="order-id">${order.id}</div>
                        <div class="order-customer">${order.customer_name}</div>
                        <div class="order-time">📍 ${order.pickup_location} · ${time}</div>
                    </div>
                    <span class="order-status-badge badge-${order.status}">
                        ${statusLabels[order.status] || order.status}
                    </span>
                </div>
                <div class="order-items-list">${itemsHTML}</div>
                <div class="order-total">
                    <span>Total</span>
                    <span>Rp ${formatPrice(order.total)}</span>
                </div>
                <div class="order-actions">${getActionButtons(order)}</div>
            </div>
        </div>
    `;
}

function getActionButtons(order) {
    switch (order.status) {
        case 'pending':
            return `
                <button class="btn-accept" onclick="updateOrderStatus('${order.id}', 'accepted')">✅ Terima</button>
                <button class="btn-reject" onclick="updateOrderStatus('${order.id}', 'rejected')">❌ Tolak</button>
            `;
        case 'accepted':
            return `<button class="btn-ready" onclick="updateOrderStatus('${order.id}', 'ready')">🔔 Pesanan Siap</button>`;
        case 'ready':
            return `<button class="btn-done" onclick="updateOrderStatus('${order.id}', 'done')">🏁 Selesai & Terima Pembayaran</button>`;
        default:
            return '';
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`${API_URL}/seller/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Seller-Id': currentSellerId
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            showToast('Gagal update status');
            return;
        }

        const messages = {
            accepted: 'Pesanan diterima!',
            rejected: 'Pesanan ditolak.',
            ready: 'Pesanan siap diambil!',
            done: 'Pesanan selesai!'
        };
        showToast(messages[newStatus] || 'Status diperbarui');
        await loadOrders();
    } catch (error) {
        showToast('Tidak bisa terhubung ke server');
        console.error('updateOrderStatus error:', error);
    }
}

function updatePendingBadge() {
    const count = orders.filter(o => o.status === 'pending').length;
    const badge = document.getElementById('pendingBadge');
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

// ===== MENU =====
async function loadMenu() {
    try {
        const response = await fetch(`${API_URL}/seller/menu`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Seller-Id': currentSellerId
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        menuItems = await response.json();
        renderMenu();
    } catch (error) {
        showToast('Gagal memuat menu');
        console.error('loadMenu error:', error);
    }
}

function renderMenu() {
    const container = document.getElementById('menuManageList');
    container.innerHTML = menuItems.map(item => createMenuCard(item)).join('');
}

function createMenuCard(item) {
    const isSoldOut = item.stock === 0;
    return `
        <div class="menu-manage-card ${isSoldOut ? 'sold-out' : ''}" id="menu-card-${item.id}">
            <div class="menu-card-top">
                <div class="menu-emoji-large">${item.emoji}</div>
                <div class="menu-card-info">
                    <h3>${item.name}</h3>
                    <p>Rp ${formatPrice(item.price)}</p>
                    <span class="menu-category-tag">${item.category}</span>
                </div>
            </div>
            <div class="stock-control">
                <span class="stock-label">Stok</span>
                <div class="stock-adjuster">
                    ${isSoldOut
                        ? `<span class="sold-out-tag">SOLD OUT</span>`
                        : `
                            <button class="btn-stock" onclick="adjustStock(${item.id}, -1)">−</button>
                            <span class="stock-number" id="stock-${item.id}">${item.stock}</span>
                            <button class="btn-stock" onclick="adjustStock(${item.id}, 1)">+</button>
                        `
                    }
                </div>
            </div>
            <div class="menu-card-actions">
                <button class="btn-edit-menu" onclick="openMenuModal(${item.id})">✏️ Edit</button>
                <button class="btn-delete-menu" onclick="openDeleteModal(${item.id}, '${item.name.replace(/'/g, "\\'")}')">🗑️ Hapus</button>
            </div>
        </div>
    `;
}

async function adjustStock(menuId, change) {
    try {
        const response = await fetch(`${API_URL}/seller/menu/${menuId}/stock`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Seller-Id': currentSellerId
            },
            body: JSON.stringify({ change })
        });

        const result = await response.json();
        const item = menuItems.find(m => m.id === menuId);
        if (item) item.stock = result.stock;

        if (result.stock === 0) {
            showToast(`${item.name} habis!`);
            renderMenu();
        } else {
            document.getElementById(`stock-${menuId}`).textContent = result.stock;
            showToast(`Stok ${item.name}: ${result.stock}`);
        }
    } catch (error) {
        showToast('Gagal update stok');
        console.error('adjustStock error:', error);
    }
}

// ===== MENU MODAL =====
function openMenuModal(menuId) {
    editingMenuId = menuId;
    const modal = document.getElementById('menuModal');
    const title = document.getElementById('modalTitle');

    if (menuId === null) {
        title.textContent = 'Tambah Menu Baru';
        document.getElementById('modalEmoji').value = '';
        document.getElementById('modalName').value = '';
        document.getElementById('modalPrice').value = '';
        document.getElementById('modalCategory').value = 'coffee';
        document.getElementById('modalStock').value = '10';
    } else {
        const item = menuItems.find(m => m.id === menuId);
        if (!item) return;
        title.textContent = 'Edit Menu';
        document.getElementById('modalEmoji').value = item.emoji || '';
        document.getElementById('modalName').value = item.name || '';
        document.getElementById('modalPrice').value = item.price || '';
        document.getElementById('modalCategory').value = item.category || 'coffee';
        document.getElementById('modalStock').value = item.stock ?? 0;
    }

    modal.classList.remove('hidden');
}

function closeMenuModal() {
    document.getElementById('menuModal').classList.add('hidden');
    editingMenuId = null;
}

async function saveMenu() {
    const emoji = document.getElementById('modalEmoji').value.trim() || '☕';
    const name = document.getElementById('modalName').value.trim();
    const price = parseInt(document.getElementById('modalPrice').value);
    const category = document.getElementById('modalCategory').value;
    const stock = parseInt(document.getElementById('modalStock').value);

    if (!name || isNaN(price) || isNaN(stock)) {
        showToast('⚠️ Mohon lengkapi semua field');
        return;
    }

    const payload = { name, price, category, emoji, stock };

    try {
        let response;
        if (editingMenuId === null) {
            response = await fetch(`${API_URL}/seller/menu`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Seller-Id': currentSellerId
                },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`${API_URL}/seller/menu/${editingMenuId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Seller-Id': currentSellerId
                },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            showToast('Gagal menyimpan menu');
            return;
        }

        showToast(editingMenuId === null ? '✅ Menu berhasil ditambahkan!' : '✅ Menu berhasil diperbarui!');
        closeMenuModal();
        await loadMenu();
    } catch (error) {
        showToast('Tidak bisa terhubung ke server');
        console.error('saveMenu error:', error);
    }
}

// ===== DELETE MODAL =====
function openDeleteModal(menuId, menuName) {
    deletingMenuId = menuId;
    document.getElementById('deleteMenuName').textContent = menuName;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    deletingMenuId = null;
}

async function confirmDelete() {
    if (!deletingMenuId) return;
    try {
        const response = await fetch(`${API_URL}/seller/menu/${deletingMenuId}`, {
            method: 'DELETE',
            headers: {
                'X-Seller-Id': currentSellerId
            }
        });

        if (!response.ok) {
            showToast('Gagal menghapus menu');
            return;
        }

        showToast('✅ Menu berhasil dihapus');
        closeDeleteModal();
        await loadMenu();
    } catch (error) {
        showToast('Tidak bisa terhubung ke server');
        console.error('confirmDelete error:', error);
    }
}

// ===== INCOME =====
async function loadIncome() {
    try {
        const response = await fetch(`${API_URL}/seller/orders`, {
            method: 'GET',
            headers: {
                'X-Seller-Id': currentSellerId
            }
        });

        if (response.ok) orders = await response.json();
    } catch (err) {
        console.error('loadIncome fetch error:', err);
    }

    const doneOrders = orders.filter(o => o.status === 'done');
    const total = doneOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    document.getElementById('totalIncome').textContent = `Rp ${formatPrice(total)}`;
    document.getElementById('totalOrders').textContent = doneOrders.length;

    const list = document.getElementById('incomeList');
    const empty = document.getElementById('incomeEmpty');

    if (doneOrders.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    list.innerHTML = doneOrders.map(order => `
        <div class="income-order-card">
            <div class="income-order-info">
                <p>${order.id} · ${new Date(order.created_at).toLocaleDateString('id-ID')}</p>
                <h4>${order.customer_name}</h4>
                <p>${order.items.map(i => `${i.emoji || '🍽️'} ${i.name} x${i.quantity}`).join(', ')}</p>
            </div>
            <div class="income-order-amount">+ Rp ${formatPrice(Number(order.total || 0))}</div>
        </div>
    `).join('');
}

// ===== UTILITIES =====
function formatPrice(price) {
    return price.toLocaleString('id-ID');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}