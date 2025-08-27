// script.js

const flows = [];
const trafficList = document.getElementById('traffic-list');
const detailModal = document.getElementById('detailModal');

// Summary card elements
const totalRequestsEl = document.getElementById('total-requests');
const activeConnectionsEl = document.getElementById('active-connections');
const httpRequestsEl = document.getElementById('http-requests');
const httpsRequestsEl = document.getElementById('https-requests');

// Filter elements
const allCountEl = document.getElementById('all-count');
const httpCountEl = document.getElementById('http-count');
const httpsCountEl = document.getElementById('https-count');

// Statistics tracking
let stats = {
    total: 0,
    http: 0,
    https: 0,
    active: 0
};

// Filter state
let currentFilter = 'all';

const ws = new WebSocket('ws://localhost:8088');

ws.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        const flowIndex = flows.push(data) - 1;

        // Update statistics
        stats.total++;
        if (data.protocol === 'http') {
            stats.http++;
        } else if (data.protocol === 'https') {
            stats.https++;
        }
        stats.active = Math.min(stats.total, 50); // Show active connections (max 50)

        // Update summary cards
        updateSummaryCards();

        // Create table row
        const tableRow = document.createElement('tr');
        tableRow.className = 'traffic-row';
        tableRow.dataset.index = flowIndex;
        tableRow.dataset.protocol = data.protocol;

        // Format timestamp
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        tableRow.innerHTML = `
            <td>${data.client_ip}</td>
            <td><span class="method-badge ${data.method}">${data.method}</span></td>
            <td>${data.protocol.toUpperCase()}</td>
            <td class="url-cell" title="${data.url}">${data.url}</td>
            <td><span class="status-badge" data-status="${data.status}">${data.status}</span></td>
            <td>${timestamp}</td>
        `;

        // Insert at the top of the table
        if (trafficList.firstChild) {
            trafficList.insertBefore(tableRow, trafficList.firstChild);
        } else {
            trafficList.appendChild(tableRow);
        }

        // Apply current filter
        applyFilter(tableRow);

        // Add click event
        tableRow.addEventListener('click', function() {
            const activeRow = document.querySelector('.traffic-row.active');
            if (activeRow) {
                activeRow.classList.remove('active');
            }
            this.classList.add('active');
            
            showDetailModal(data);
        });
        
        // Limit table rows
        const maxRows = 50;
        if (trafficList.children.length > maxRows) {
            trafficList.lastElementChild.remove();
        }
    } catch (e) {
        console.error("Error parsing message:", e);
    }
};

function updateSummaryCards() {
    totalRequestsEl.textContent = stats.total.toLocaleString();
    activeConnectionsEl.textContent = stats.active.toLocaleString();
    httpRequestsEl.textContent = stats.http.toLocaleString();
    httpsRequestsEl.textContent = stats.https.toLocaleString();
    
    // Update filter counts
    allCountEl.textContent = stats.total.toLocaleString();
    httpCountEl.textContent = stats.http.toLocaleString();
    httpsCountEl.textContent = stats.https.toLocaleString();
}

function setFilter(filterType) {
    currentFilter = filterType;
    
    // Update active button state
    document.querySelectorAll('.filter-icon-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-filter="${filterType}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Apply filter to all existing rows
    document.querySelectorAll('.traffic-row').forEach(row => {
        applyFilter(row);
    });
}

function applyFilter(row) {
    const protocol = row.dataset.protocol;
    
    if (currentFilter === 'all') {
        row.style.display = '';
    } else if (currentFilter === 'http') {
        row.style.display = protocol === 'http' ? '' : 'none';
    } else if (currentFilter === 'https') {
        row.style.display = protocol === 'https' ? '' : 'none';
    }
}

function showDetailModal(data) {
    // Fill in details
    document.getElementById('modal-client-ip').textContent = data.client_ip;
    document.getElementById('modal-method').textContent = data.method;
    document.getElementById('modal-protocol').textContent = data.protocol.toUpperCase();
    document.getElementById('modal-status').textContent = data.status;
    
    document.getElementById('modal-url').textContent = data.url;
    document.getElementById('modal-headers').textContent = JSON.stringify(data.headers, null, 2);
    
    if (data.protocol === 'http' && data.body) {
        document.getElementById('modal-body').textContent = data.body;
    } else {
        document.getElementById('modal-body').textContent = "Body content is not available for HTTPS flows or is empty.";
    }
    
    // Show modal
    detailModal.classList.add('show');
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    detailModal.classList.remove('show');
    
    // Restore background scrolling
    document.body.style.overflow = 'auto';
    
    // Remove active state
    const activeRow = document.querySelector('.traffic-row.active');
    if (activeRow) {
        activeRow.classList.remove('active');
    }
}

// Click outside modal to close
detailModal.addEventListener('click', function(e) {
    if (e.target === detailModal) {
        closeDetailModal();
    }
});

// ESC key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && detailModal.classList.contains('show')) {
        closeDetailModal();
    }
});

// Initialize summary cards
updateSummaryCards();

// Initialize filter state and bind events
document.addEventListener('DOMContentLoaded', function() {
    // Bind filter button events
    document.querySelectorAll('.filter-icon-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const filterType = this.dataset.filter;
            setFilter(filterType);
        });
    });
    
    // Set initial filter
    setFilter('all');
});