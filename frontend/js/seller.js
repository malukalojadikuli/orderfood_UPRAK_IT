// ===== CONFIG =====
const API_URL = window.location.origin + "/api";

// ===== STATE =====
let orders = [];
let menuItems = [];
let currentTab = "pending";

// ===== INIT =====
document.addEventListener("DOMContentLoaded", function () {
  loadOrders();
  loadMenu();
});

// ===== NAVIGATION =====
function showPage(pageId) {
  document
    .querySelectorAll(".seller-page")
    .forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));

  document.getElementById(pageId).classList.remove("hidden");
  document.querySelector(`[data-page="${pageId}"]`).classList.add("active");

  if (pageId === "incomePage") loadIncome();
}

// ===== ORDERS =====
async function loadOrders() {
  try {
    const response = await fetch(`${API_URL}/orders`);
    orders = await response.json();
    filterOrders(currentTab);
    updatePendingBadge();
  } catch (error) {
    showToast("Gagal memuat pesanan");
    console.error("loadOrders error:", error);
  }
}

function filterOrders(tab) {
  currentTab = tab;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

  const filtered = orders.filter((o) => o.status === tab);
  renderOrders(filtered);
}

function renderOrders(filteredOrders) {
  const list = document.getElementById("ordersList");
  const empty = document.getElementById("ordersEmpty");

  if (filteredOrders.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  list.innerHTML = filteredOrders
    .map((order) => createOrderCard(order))
    .join("");
}

function createOrderCard(order) {
  const statusLabels = {
    pending: "Menunggu",
    accepted: "Diproses",
    ready: "Siap Diambil",
    done: "Selesai",
    rejected: "Ditolak",
  };

  const itemsHTML = order.items
    .map(
      (item) => `
        <div class="order-item-row">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp ${formatPrice(item.price * item.quantity)}</span>
        </div>
    `,
    )
    .join("");

  const time = new Date(order.created_at).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
        <div class="order-card status-${order.status}" id="order-${order.id}">
            <div class="order-card-header">
                <div>
                    <div class="order-id">${order.id}</div>
                    <div class="order-customer">${order.customer_name}</div>
                    <div class="order-time">📍 ${order.pickup_location} · ${time}</div>
                </div>
                <span class="order-status-badge badge-${order.status}">
                    ${statusLabels[order.status]}
                </span>
            </div>
            <div class="order-items-list">${itemsHTML}</div>
            <div class="order-total">
                <span>Total</span>
                <span>Rp ${formatPrice(order.total)}</span>
            </div>
            <div class="order-actions">${getActionButtons(order)}</div>
        </div>
    `;
}

function getActionButtons(order) {
  switch (order.status) {
    case "pending":
      return `
                <button class="btn-accept" onclick="updateOrderStatus('${order.id}', 'accepted')">✅ Terima</button>
                <button class="btn-reject" onclick="updateOrderStatus('${order.id}', 'rejected')">❌ Tolak</button>
            `;
    case "accepted":
      return `<button class="btn-ready" onclick="updateOrderStatus('${order.id}', 'ready')">🔔 Pesanan Siap</button>`;
    case "ready":
      return `<button class="btn-done" onclick="updateOrderStatus('${order.id}', 'done')">🏁 Selesai & Terima Pembayaran</button>`;
    default:
      return "";
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      showToast("Gagal update status");
      return;
    }

    const statusMessages = {
      accepted: "Pesanan diterima!",
      rejected: "Pesanan ditolak.",
      ready: "Pesanan siap diambil!",
      done: "Pesanan selesai!",
    };

    showToast(statusMessages[newStatus] || "Status diperbarui");
    await loadOrders(); // Reload from server
  } catch (error) {
    showToast("Tidak bisa terhubung ke server");
    console.error("updateOrderStatus error:", error);
  }
}

function updatePendingBadge() {
  const count = orders.filter((o) => o.status === "pending").length;
  const badge = document.getElementById("pendingBadge");
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

// ===== MENU =====
async function loadMenu() {
  try {
    const response = await fetch(`${API_URL}/menu`);
    menuItems = await response.json();
    renderMenu();
  } catch (error) {
    showToast("Gagal memuat menu");
    console.error("loadMenu error:", error);
  }
}

function renderMenu() {
  const container = document.getElementById("menuManageList");
  container.innerHTML = menuItems.map((item) => createMenuCard(item)).join("");
}

function createMenuCard(item) {
  const isSoldOut = item.stock === 0;
  return `
        <div class="menu-manage-card ${isSoldOut ? "sold-out" : ""}" id="menu-card-${item.id}">
            <div class="menu-card-top">
                <div class="menu-emoji-large">${item.emoji}</div>
                <div class="menu-card-info">
                    <h3>${item.name}</h3>
                    <p>Rp ${formatPrice(item.price)}</p>
                </div>
            </div>
            <div class="stock-control">
                <span class="stock-label">Stok</span>
                <div class="stock-adjuster">
                    ${
                      isSoldOut
                        ? `<span class="sold-out-tag">SOLD OUT</span>`
                        : `
                            <button class="btn-stock" onclick="adjustStock(${item.id}, -1)">−</button>
                            <span class="stock-number" id="stock-${item.id}">${item.stock}</span>
                            <button class="btn-stock" onclick="adjustStock(${item.id}, 1)">+</button>
                        `
                    }
                </div>
            </div>
            <button class="btn-soldout ${isSoldOut ? "restock" : ""}" onclick="toggleSoldOut(${item.id})">
                ${isSoldOut ? "🔄 Restock Menu" : "🚫 Tandai Sold Out"}
            </button>
        </div>
    `;
}

async function adjustStock(menuId, change) {
  try {
    const response = await fetch(`${API_URL}/menu/${menuId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change }),
    });

    const result = await response.json();
    const item = menuItems.find((m) => m.id === menuId);
    if (item) item.stock = result.stock;

    if (result.stock === 0) {
      showToast(statusMessages[newStatus] || "Status diperbarui");
      await loadOrders(); // Reload from server

      // If the income view is present (user is on Income page), refresh it
      try {
        if (document.getElementById("totalIncome")) await loadIncome();
      } catch (e) {
        console.error("Failed to refresh income view", e);
      }
    } else {
      document.getElementById(`stock-${menuId}`).textContent = result.stock;
      showToast(`Stok ${item.name}: ${result.stock}`);
    }
  } catch (error) {
    showToast("Gagal update stok");
    console.error("adjustStock error:", error);
  }
}

async function toggleSoldOut(menuId) {
  try {
    const response = await fetch(`${API_URL}/menu/${menuId}/soldout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();
    const item = menuItems.find((m) => m.id === menuId);
    if (item) item.stock = result.stock;

    showToast(
      result.stock === 0 ? `${item.name} sold out` : `${item.name} di-restock!`,
    );
    renderMenu();
  } catch (error) {
    showToast("Gagal update menu");
    console.error("toggleSoldOut error:", error);
  }
}

// ===== INCOME =====
async function loadIncome() {
  // Ensure we have the latest orders from server
  try {
    const response = await fetch(`${API_URL}/orders`);
    if (response.ok) orders = await response.json();
  } catch (err) {
    console.error("loadIncome: failed to refresh orders", err);
  }

  const doneOrders = orders.filter((o) => o.status === "done");
  const total = doneOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  document.getElementById("totalIncome").textContent =
    `Rp ${formatPrice(total)}`;
  document.getElementById("totalOrders").textContent = doneOrders.length;

  const list = document.getElementById("incomeList");
  const empty = document.getElementById("incomeEmpty");

  if (doneOrders.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  list.innerHTML = doneOrders
    .map(
      (order) => `
        <div class="income-order-card">
            <div class="income-order-info">
                <p>${order.id} · ${new Date(order.created_at).toLocaleDateString("id-ID")}</p>
                <h4>${order.customer_name}</h4>
                <p>${order.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}</p>
            </div>
            <div class="income-order-amount">+ Rp ${formatPrice(Number(order.total || 0))}</div>
        </div>
    `,
    )
    .join("");
}

// ===== UTILS =====
function formatPrice(price) {
  return price.toLocaleString("id-ID");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}
