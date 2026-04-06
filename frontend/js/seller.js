// ===== CONFIG =====
const API_URL = window.location.origin + '/api';

// ===== STATE =====
let orders = [];
let menuItems = [];
let editingMenuId = null;   
let deletingMenuId = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    loadOrders();
    loadMenu();
    // Refresh setiap 10 detik
    setInterval(loadOrders, 10000);
});

// ===== NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.seller-page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
    if (pageId === 'incomePage') loadIncome();
}

// ===== ORDERS =====
async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`);
        orders = await response.json();
        renderOrders();
        updatePendingBadge();
    } catch (error) {
        showToast('Gagal memuat pesanan');
        console.error('loadOrders error:', error);
    }
}

function renderOrders() {
    const list  = document.getElementById('ordersList');
    const empty = document.getElementById('ordersEmpty');

    // misahin active dan completed orders
    const active = orders.filter(o => o.status !== 'done' && o.status !== 'rejected');
    const completed = orders.filter(o => o.status === 'done');

    if (active.length === 0 && completed.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    const order = { pending: 0, accepted: 1, ready: 2 };
    active.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    completed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let html = '';

    // Active orders
    if (active.length > 0) {
        html += active.map(o => createOrderCard(o)).join('');
    }

    // order selesai
    if (completed.length > 0) {
        html += `
            <div class="completed-orders-header">
                <h3>Pesanan Selesai</h3>
            </div>
        `;
        html += completed.map(o => createOrderCard(o)).join('');
    }

    list.innerHTML = html;
}

function createOrderCard(order) {
    const statusLabels = {
        pending:  'Menunggu',
        accepted: 'Diproses',
        ready:    'Siap Diambil',
        done:     'Selesai',
    };

    const itemsHTML = order.items.map(item => `
        <div class="order-item-row">
            <span>${item.name} x${item.quantity}</span>
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
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) { showToast('Gagal update status'); return; }

        const messages = {
            accepted: 'Pesanan diterima!',
            rejected: 'Pesanan ditolak.',
            ready:    'Pesanan siap diambil!',
            done:     'Pesanan selesai!'
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
        const response = await fetch(`${API_URL}/menu`);
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
                <img src="${item.imageUrl}" alt="${item.name}" class="menu-item-image" data-testid="menu-item-image-${item.id}">
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
        const response = await fetch(`${API_URL}/menu/${menuId}/stock`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
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

// ===== MENU MODAL (add / edit) =====
function openMenuModal(menuId) {
    editingMenuId = menuId;
    const modal = document.getElementById('menuModal');
    const title = document.getElementById('modalTitle');

    if (menuId === null) {
        // Adding new
        title.textContent = 'Tambah Menu Baru';
        document.getElementById('modalImage').value    = '';
        document.getElementById('modalName').value     = '';
        document.getElementById('modalPrice').value    = '';
        document.getElementById('modalCategory').value = 'coffee';
        document.getElementById('modalStock').value    = '10';
    } else {
        // Editing existing
        const item = menuItems.find(m => m.id === menuId);
        if (!item) return;
        title.textContent = 'Edit Menu';
        document.getElementById('modalImage').value    = item.image    || '';
        document.getElementById('modalName').value     = item.name     || '';
        document.getElementById('modalPrice').value    = item.price    || '';
        document.getElementById('modalCategory').value = item.category || 'coffee';
        document.getElementById('modalStock').value    = item.stock    ?? 0;
    }

    modal.classList.remove('hidden');
}

function closeMenuModal() {
    document.getElementById('menuModal').classList.add('hidden');
    editingMenuId = null;
}

async function saveMenu() {
    const image    = document.getElementById('modalImage').value.trim()  || 'default.jpg';
    const name     = document.getElementById('modalName').value.trim();
    const price    = parseInt(document.getElementById('modalPrice').value);
    const category = document.getElementById('modalCategory').value;
    const stock    = parseInt(document.getElementById('modalStock').value);

    if (!name || isNaN(price) || isNaN(stock)) {
        showToast('Mohon lengkapi semua field');
        return;
    }

    const payload = { name, price, category, image, stock };

    try {
        let response;
        if (editingMenuId === null) {
            // POST - tambah baru
            response = await fetch(`${API_URL}/menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // PUT - update menu yang sudah ada
            response = await fetch(`${API_URL}/menu/${editingMenuId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            showToast('Gagal menyimpan menu');
            return;
        }

        showToast(editingMenuId === null ? 'Menu berhasil ditambahkan!' : 'Menu berhasil diperbarui!');
        closeMenuModal();
        await loadMenu(); // Reload dari database
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
        const response = await fetch(`${API_URL}/menu/${deletingMenuId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            showToast('Gagal menghapus menu');
            return;
        }

        showToast('Menu berhasil dihapus');
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
        const response = await fetch(`${API_URL}/orders`);
        if (response.ok) orders = await response.json();
    } catch (err) {
        console.error('loadIncome fetch error:', err);
    }

    const doneOrders = orders.filter(o => o.status === 'done');
    const total = doneOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    document.getElementById('totalIncome').textContent = `Rp ${formatPrice(total)}`;
    document.getElementById('totalOrders').textContent = doneOrders.length;

    const list  = document.getElementById('incomeList');
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
                <p>${order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</p>
            </div>
            <div class="income-order-amount">+ Rp ${formatPrice(Number(order.total || 0))}</div>
        </div>
    `).join('');
}

// ===== UTILS =====
function formatPrice(price) {
    return price.toLocaleString('id-ID');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}