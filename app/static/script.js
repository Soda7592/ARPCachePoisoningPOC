// script.js

const flows = [];
const STORAGE_KEYS = {
    flows: 'twos_flows',
    stats: 'twos_stats',
    filter: 'twos_filter',
    method: 'twos_method'
};
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
let currentMethod = 'ALL';

// ---------- Status indicator ----------
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

function setStatus(mode) {
    // mode: 'live' | 'no-proxy' | 'local-only'
    if (!statusDot || !statusText) return;
    statusDot.classList.remove('success', 'warning', 'error');
    if (mode === 'live') {
        statusDot.classList.add('success');
        statusText.textContent = 'Live';
    } else if (mode === 'no-proxy') {
        statusDot.classList.add('warning');
        statusText.textContent = 'No Proxy';
    } else if (mode === 'local-only') {
        statusDot.classList.add('error');
        statusText.textContent = 'Local Only';
    }
}

// ---------- WebSocket with auto-reconnect ----------
let ws;
let reconnectAttempts = 0;
let reconnectTimer = null;

function scheduleReconnect() {
    if (reconnectTimer) return;
    const base = 2000; // 2s
    const delay = Math.min(30000, base * Math.pow(2, reconnectAttempts));
    reconnectAttempts++;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
    }, delay);
}

function createAndInsertRow(data, flowIndex) {
    const tableRow = document.createElement('tr');
    tableRow.className = 'traffic-row';
    tableRow.dataset.index = flowIndex;
    tableRow.dataset.protocol = data.protocol;

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

    if (trafficList.firstChild) {
        trafficList.insertBefore(tableRow, trafficList.firstChild);
    } else {
        trafficList.appendChild(tableRow);
    }

    applyFilter(tableRow);

    tableRow.addEventListener('click', function() {
        const activeRow = document.querySelector('.traffic-row.active');
        if (activeRow) {
            activeRow.classList.remove('active');
        }
        this.classList.add('active');
        
        showDetailModal(data);
    });

    const maxRows = 50;
    if (trafficList.children.length > maxRows) {
        trafficList.lastElementChild.remove();
    }
}

function saveState() {
    try {
        const maxStore = 200; // store last 200 flows
        const flowsToSave = flows.slice(-maxStore);
        localStorage.setItem(STORAGE_KEYS.flows, JSON.stringify(flowsToSave));
        localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
        localStorage.setItem(STORAGE_KEYS.filter, currentFilter);
        localStorage.setItem(STORAGE_KEYS.method, currentMethod);
    } catch (_) {}
}

function restoreState() {
    try {
        const savedFlows = JSON.parse(localStorage.getItem(STORAGE_KEYS.flows) || '[]');
        const savedStats = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats) || 'null');
        const savedFilter = localStorage.getItem(STORAGE_KEYS.filter);
        const savedMethod = localStorage.getItem(STORAGE_KEYS.method);

        if (Array.isArray(savedFlows) && savedFlows.length) {
            // push into in-memory and rebuild table
            for (const f of savedFlows) {
                const idx = flows.push(f) - 1;
                createAndInsertRow(f, idx);
            }
        }
        if (savedStats && typeof savedStats === 'object') {
            stats = savedStats;
        }
        updateSummaryCards();
        if (savedFilter) {
            setFilter(savedFilter);
        }
        if (savedMethod) {
            setMethodFilter(savedMethod);
        }
    } catch (_) {}
}

function handleWSMessage(event) {
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

        createAndInsertRow(data, flowIndex);

        // persist state after new message
        saveState();
    } catch (e) {
        console.error("Error parsing message:", e);
    }
}

function connectWebSocket() {
    try {
        ws = new WebSocket('ws://localhost:8088');

        ws.onopen = function() {
            setStatus('live');
            reconnectAttempts = 0;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        ws.onmessage = handleWSMessage;

        const onDisconnect = function() {
            setStatus('no-proxy');
            scheduleReconnect();
        };

        ws.onclose = onDisconnect;
        ws.onerror = onDisconnect;
    } catch (_) {
        setStatus('no-proxy');
        scheduleReconnect();
    }
}

// 初始先假設本地可連（未接上 Proxy）
setStatus('local-only');
connectWebSocket();

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
    const methodEl = row.querySelector('.method-badge');
    const methodVal = methodEl ? methodEl.textContent : '';

    let protoPass = true;
    if (currentFilter === 'http') protoPass = protocol === 'http';
    else if (currentFilter === 'https') protoPass = protocol === 'https';

    let methodPass = true;
    if (currentMethod !== 'ALL') {
        if (currentMethod === 'Others') {
            methodPass = !['GET','POST','PUT','DELETE'].includes(methodVal);
        } else {
            methodPass = methodVal === currentMethod;
        }
    }

    row.style.display = (protoPass && methodPass) ? '' : 'none';
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
    // restore previous state from cache FIRST
    restoreState();
    // Bind filter button events
    document.querySelectorAll('.filter-icon-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const filterType = this.dataset.filter;
            setFilter(filterType);
            // save filter on change
            try { localStorage.setItem(STORAGE_KEYS.filter, currentFilter); } catch (_) {}
        });
    });
    
    // Ensure there is an active filter; if none restored, default to 'all'
    const hasActive = !!document.querySelector('.filter-icon-btn.active');
    if (!hasActive) {
        setFilter('all');
    }

    // Method filter UI（點擊整個 Method 區域）
    const control = document.getElementById('method-filter-control');
    const menu = document.getElementById('method-filter-menu');
    if (control && menu) {
        control.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        menu.querySelectorAll('.method-filter-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const val = this.dataset.method || 'ALL';
                setMethodFilter(val);
                try { localStorage.setItem(STORAGE_KEYS.method, currentMethod); } catch (_) {}
                menu.classList.remove('show');
            });
        });

        document.addEventListener('click', function() {
            menu.classList.remove('show');
        });
    }
    // Bind clear traffic button
    const clearBtn = document.getElementById('clear-traffic-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const confirmed = confirm('Confirm to clear current traffic?');
            if (!confirmed) return;

            // Close modal if open
            if (detailModal.classList.contains('show')) {
                closeDetailModal();
            }

            // Clear table rows
            while (trafficList.firstChild) {
                trafficList.removeChild(trafficList.firstChild);
            }

            // Reset data and stats
            flows.length = 0;
            stats = { total: 0, http: 0, https: 0, active: 0 };
            updateSummaryCards();

            // Keep current filter state active styling
            setFilter(currentFilter);

            // Clear persisted cache (method resets to ALL)
            try {
                localStorage.removeItem(STORAGE_KEYS.flows);
                localStorage.removeItem(STORAGE_KEYS.stats);
                localStorage.setItem(STORAGE_KEYS.method, 'ALL');
            } catch (_) {}
        });
    }
    // Save before unload to persist latest counters
    window.addEventListener('beforeunload', function() {
        try { saveState(); } catch (_) {}
    });
});

function setMethodFilter(method) {
    currentMethod = method || 'ALL';
    document.querySelectorAll('.traffic-row').forEach(row => applyFilter(row));
    // 更新 chip 顯示（ALL 隱藏 chip）
    const chip = document.getElementById('method-filter-chip');
    if (chip) {
        if (currentMethod && currentMethod !== 'ALL') {
            chip.textContent = currentMethod === 'OTHERS' ? 'Others' : currentMethod;
            chip.style.display = '';
        } else {
            chip.style.display = 'none';
        }
    }
}