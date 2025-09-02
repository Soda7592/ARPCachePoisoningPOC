// websocket.js - WebSocket 通訊相關功能

// 全域變數
const flows = [];
const STORAGE_KEYS = {
    flows: 'twos_flows',
    stats: 'twos_stats',
    filter: 'twos_filter',
    method: 'twos_method'
};

// 統計追蹤
let stats = {
    total: 0,
    http: 0,
    https: 0,
    active: 0
};

// 篩選狀態
let currentFilter = 'all';
let currentMethod = 'ALL';

// ---------- 狀態指示器 ----------
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

// ---------- WebSocket 自動重連功能 ----------
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

function handleWSMessage(event) {
    try {
        const data = JSON.parse(event.data);
        // 記錄到達時間（每筆 request 的專屬時間戳）
        if (!data.timestamp) {
            // 後端若未附上 ISO 格式，使用毫秒整數（仍為固定捕捉時間）
            data.timestamp = Date.now();
        }
        const flowIndex = flows.push(data) - 1;

        // 更新統計
        stats.total++;
        if (data.protocol === 'http') {
            stats.http++;
        } else if (data.protocol === 'https') {
            stats.https++;
        }
        stats.active = Math.min(stats.total, 50); // 顯示活躍連線（最多 50）

        // 同步到 window.stats 供 UI 使用
        window.stats = stats;

        // 更新摘要卡片
        if (typeof updateSummaryCards === 'function') {
            updateSummaryCards();
        }

        // 建立並插入表格行
        if (typeof createAndInsertRow === 'function') {
            createAndInsertRow(data, flowIndex);
        }

        // 持久化狀態
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

// 狀態保存和恢復
function saveState() {
    try {
        const maxStore = 200; // 儲存最後 200 個流量
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
            // 推入記憶體並重建表格
            for (const f of savedFlows) {
                const idx = flows.push(f) - 1;
                if (typeof createAndInsertRow === 'function') {
                    createAndInsertRow(f, idx);
                }
            }
        }
        if (savedStats && typeof savedStats === 'object') {
            stats = savedStats;
            // 同步到 window.stats 供 UI 使用
            window.stats = stats;
        }
        if (typeof updateSummaryCards === 'function') {
            updateSummaryCards();
        }
        if (savedFilter && typeof setFilter === 'function') {
            setFilter(savedFilter);
        }
        if (savedMethod && typeof setMethodFilter === 'function') {
            setMethodFilter(savedMethod);
        }
    } catch (_) {}
}

// 初始化 WebSocket 連線
// 初始先假設本地可連（未接上 Proxy）
setStatus('local-only');
connectWebSocket();

// 重置統計資料
function resetStats() {
    stats = { total: 0, http: 0, https: 0, active: 0 };
    window.stats = stats;
}

// 匯出全域變數和函數供其他模組使用
window.flows = flows;
window.stats = stats;
window.currentFilter = currentFilter;
window.currentMethod = currentMethod;
window.STORAGE_KEYS = STORAGE_KEYS;
window.saveState = saveState;
window.restoreState = restoreState;
window.resetStats = resetStats;
