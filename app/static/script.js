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

// ---------- Formatting helpers ----------
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function nl2br(htmlEscapedText) {
    return htmlEscapedText.replace(/\n/g, '<br>');
}

function getHeaderValue(headers, name) {
    if (!headers) return undefined;
    const lowerName = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerName) return headers[key];
    }
    return undefined;
}

function formatHeaders(headersObj) {
    try {
        if (!headersObj || typeof headersObj !== 'object') return '';
        const lines = [];
        for (const [key, value] of Object.entries(headersObj)) {
            const safeKey = escapeHtml(key);
            const safeVal = escapeHtml(Array.isArray(value) ? value.join(', ') : String(value));
            lines.push(`<strong>${safeKey}</strong>: ${safeVal}`);
        }
        return lines.join('<br>');
    } catch (e) {
        return nl2br(escapeHtml(JSON.stringify(headersObj)));
    }
}

function truncateText(text, max = 20000) {
    if (typeof text !== 'string') return '';
    if (text.length <= max) return text;
    const hidden = text.length - max;
    return text.slice(0, max) + `\n... [truncated ${hidden} chars]`;
}

function isLikelyQueryString(body) {
    return typeof body === 'string' && /[=&]/.test(body) && !/[{}\[\]]/.test(body);
}

function formatJsonTopLevelToLines(obj) {
    try {
        if (Array.isArray(obj)) {
            // 列出陣列每一項
            const lines = obj.map((item, idx) => {
                const safeVal = escapeHtml(typeof item === 'string' ? item : JSON.stringify(item));
                return `<strong>[${idx}]</strong>: ${safeVal}`;
            });
            return lines.join('<br>');
        }
        if (obj && typeof obj === 'object') {
            // 只展開最外層，不顯示包覆的大括號
            const lines = Object.entries(obj).map(([k, v]) => {
                const safeKey = escapeHtml(k);
                const valStr = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
                const safeVal = nl2br(escapeHtml(valStr));
                return `<strong>${safeKey}</strong>: ${safeVal}`;
            });
            return lines.join('<br>');
        }
        // 不是物件就原樣
        return nl2br(escapeHtml(String(obj)));
    } catch (_) {
        return nl2br(escapeHtml(JSON.stringify(obj, null, 2)));
    }
}

function formatBody(body, headersObj) {
    if (!body) return '';

    const ctype = (getHeaderValue(headersObj, 'content-type') || '').toLowerCase();

    // JSON（移除最外層大括號，key 粗體）
    if (ctype.includes('application/json') || (typeof body === 'string' && (body.trim().startsWith('{') || body.trim().startsWith('[')))) {
        try {
            const parsed = typeof body === 'string' ? JSON.parse(body) : body;
            return formatJsonTopLevelToLines(parsed);
        } catch (_) {
            // 解析失敗則以文字顯示
        }
    }

    // x-www-form-urlencoded（key 粗體逐行）
    if (ctype.includes('application/x-www-form-urlencoded') || isLikelyQueryString(body)) {
        try {
            const params = new URLSearchParams(body);
            const lines = [];
            for (const [k, v] of params.entries()) {
                lines.push(`<strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)}`);
            }
            return lines.join('<br>');
        } catch (_) {}
    }

    // multipart：僅顯示截斷文字
    if (ctype.includes('multipart/form-data')) {
        return nl2br(escapeHtml(truncateText(String(body), 4000)));
    }

    // 其他：原文（轉義 + 換行處理，避免大括號造成閱讀負擔）
    return nl2br(escapeHtml(truncateText(String(body))));
}

function showDetailModal(data) {
    // Fill in details
    document.getElementById('modal-client-ip').textContent = data.client_ip;
    document.getElementById('modal-method').textContent = data.method;
    document.getElementById('modal-protocol').textContent = data.protocol.toUpperCase();
    document.getElementById('modal-status').textContent = data.status;
    
    document.getElementById('modal-url').textContent = data.url;

    // headers 每行一個 header: value（HTML）
    document.getElementById('modal-headers').innerHTML = formatHeaders(data.headers);
    
    // body 依 content-type 漂亮化，並在必要時截斷（HTML）
    const formattedBody = formatBody(data.body, data.headers);
    if (formattedBody) {
        document.getElementById('modal-body').innerHTML = formattedBody;
    } else {
        document.getElementById('modal-body').innerHTML = nl2br(escapeHtml("Body content is not available or could not be decoded."));
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