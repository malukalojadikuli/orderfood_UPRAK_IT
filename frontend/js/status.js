// ===== CONFIG =====
const API_URL = window.location.origin + '/api';

// ===== STATE =====
let pollingInterval = null;
let lastStatus = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    // Read order ID from URL: status.html?order=ORD-12345678
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');

    if (!orderId) {
        showError();
        return;
    }

    document.getElementById('orderNumber').textContent = orderId;

    // Load order details and start polling
    loadOrderDetails(orderId);
    startPolling(orderId);
});

// ===== LOAD ORDER DETAILS (name, pickup location) =====
async function loadOrderDetails(orderId) {
    try {
        const response = await fetch(`${API_URL}/orders`);
        const orders = await response.json();
        const order = orders.find(o => o.id === orderId);

        if (!order) {
            showError();
            return;
        }

        // Fill in order info
        document.getElementById('customerName').textContent = order.customer_name;
        document.getElementById('pickupLocation').textContent = order.pickup_location;

        // Show the card now that we have data
        document.getElementById('statusLoading').classList.add('hidden');
        document.getElementById('statusCard').classList.remove('hidden');

        // Set initial status
        updateTracker(order.status);

    } catch (error) {
        console.error('loadOrderDetails error:', error);
        showError();
    }
}

// ===== POLLING =====
function startPolling(orderId) {
    // Poll every 5 seconds
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_URL}/orders`);
            const orders = await response.json();
            const order = orders.find(o => o.id === orderId);

            if (!order) return;

            // Only update UI if status actually changed
            if (order.status !== lastStatus) {
                updateTracker(order.status);
            }

            // Stop polling when order is finished
            if (order.status === 'done' || order.status === 'rejected') {
                clearInterval(pollingInterval);
            }

        } catch (error) {
            console.error('polling error:', error);
        }
    }, 5000);
}

// ===== UPDATE TRACKER UI =====
function updateTracker(status) {
    lastStatus = status;

    const stepAccepted = document.getElementById('step-accepted');
    const stepReady    = document.getElementById('step-ready');
    const stepDone     = document.getElementById('step-done');
    const fill         = document.getElementById('trackerFill');
    const msgBox       = document.getElementById('statusMessageBox');
    const msg          = document.getElementById('statusMessage');

    // Reset all steps
    [stepAccepted, stepReady, stepDone].forEach(s => {
        s.classList.remove('active', 'completed');
    });
    msgBox.classList.remove('rejected');

    const messages = {
        pending:  'Menunggu konfirmasi dari seller...',
        accepted: 'Pesananmu sedang dibuat, harap tunggu ya! ☕',
        ready:    'Pesananmu sudah siap! Silakan ambil di lokasi pickup. 🛍️',
        done:     'Pesanan selesai! Terima kasih sudah mampir. 🎉',
        rejected: 'Maaf, pesananmu tidak dapat diproses saat ini.',
    };

    msg.textContent = messages[status] || 'Memproses pesanan...';

    if (status === 'pending') {
        fill.style.width = '0%';

    } else if (status === 'accepted') {
        stepAccepted.classList.add('active');
        fill.style.width = '0%';

    } else if (status === 'ready') {
        stepAccepted.classList.add('completed');
        stepReady.classList.add('active');
        fill.style.width = '50%';

    } else if (status === 'done') {
        stepAccepted.classList.add('completed');
        stepReady.classList.add('completed');
        stepDone.classList.add('active');
        fill.style.width = '100%';

    } else if (status === 'rejected') {
        fill.style.width = '0%';
        msgBox.classList.add('rejected');
    }
}

// ===== ERROR STATE =====
function showError() {
    document.getElementById('statusLoading').classList.add('hidden');
    document.getElementById('statusCard').classList.add('hidden');
    document.getElementById('statusError').classList.remove('hidden');
}