// ui.js - 動態產生前端 UI 相關功能

// DOM 元素
const trafficList = document.getElementById('traffic-list');
const detailModal = document.getElementById('detailModal');

// 摘要卡片元素
const totalRequestsEl = document.getElementById('total-requests');
const activeConnectionsEl = document.getElementById('active-connections');
const httpRequestsEl = document.getElementById('http-requests');
const httpsRequestsEl = document.getElementById('https-requests');
const topHttpIpEl = document.getElementById('top-http-ip');
const topHttpCountEl = document.getElementById('top-http-count');

// 篩選元素
const allCountEl = document.getElementById('all-count');
const httpCountEl = document.getElementById('http-count');
const httpsCountEl = document.getElementById('https-count');
let ipStatsModal = null;
let ipStatsList = null;
let ipReqsModal = null;
let ipReqsTitle = null;
let ipReqsList = null;

// 建立並插入表格行
function createAndInsertRow(data, flowIndex) {
    const tableRow = document.createElement('tr');
    tableRow.className = 'traffic-row';
    tableRow.dataset.index = flowIndex;
    tableRow.dataset.protocol = data.protocol;

    const tsSource = data && data.timestamp ? new Date(data.timestamp) : new Date();
    const timestamp = tsSource.toLocaleTimeString('en-US', {
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

// 更新摘要卡片
function updateSummaryCards() {
    if (!window.stats) return;
    
    totalRequestsEl.textContent = window.stats.total.toLocaleString();
    // 將 Active 改為顯示現在時間（於 index.html 中改為 id=now-time）
    const nowLabel = document.getElementById('now-time');
    if (nowLabel) {
        const now = new Date();
        nowLabel.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    httpRequestsEl.textContent = window.stats.http.toLocaleString();
    httpsRequestsEl.textContent = window.stats.https.toLocaleString();
    
    // 更新篩選計數
    allCountEl.textContent = window.stats.total.toLocaleString();
    httpCountEl.textContent = window.stats.http.toLocaleString();
    httpsCountEl.textContent = window.stats.https.toLocaleString();

    // 計算 HTTP 請求最多的來源 IP
    if (Array.isArray(window.flows) && topHttpIpEl && topHttpCountEl) {
        const httpCounts = new Map();
        for (const f of window.flows) {
            if (f && f.protocol === 'http' && f.client_ip) {
                httpCounts.set(f.client_ip, (httpCounts.get(f.client_ip) || 0) + 1);
            }
        }
        let topIp = '-';
        let topCount = 0;
        for (const [ip, count] of httpCounts.entries()) {
            if (count > topCount) { topIp = ip; topCount = count; }
        }
        topHttpIpEl.textContent = topIp;
        topHttpCountEl.textContent = topCount.toLocaleString();
    }
}

// 篩選功能
function setFilter(filterType) {
    window.currentFilter = filterType;
    
    // 更新活躍按鈕狀態
    document.querySelectorAll('.filter-icon-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-filter="${filterType}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // 對所有現有行應用篩選
    document.querySelectorAll('.traffic-row').forEach(row => {
        applyFilter(row);
    });
}

function applyFilter(row) {
    const protocol = row.dataset.protocol;
    const methodEl = row.querySelector('.method-badge');
    const methodVal = methodEl ? methodEl.textContent : '';

    let protoPass = true;
    if (window.currentFilter === 'http') protoPass = protocol === 'http';
    else if (window.currentFilter === 'https') protoPass = protocol === 'https';

    let methodPass = true;
    if (window.currentMethod !== 'ALL') {
        if (window.currentMethod === 'OTHERS') {
            methodPass = !['GET','POST','PUT','DELETE','TLS'].includes(methodVal);
        } else {
            methodPass = methodVal === window.currentMethod;
        }
    }

    row.style.display = (protoPass && methodPass) ? '' : 'none';
}

function setMethodFilter(method) {
    window.currentMethod = method || 'ALL';
    document.querySelectorAll('.traffic-row').forEach(row => applyFilter(row));
    // 更新 chip 顯示（ALL 隱藏 chip）
    const chip = document.getElementById('method-filter-chip');
    if (chip) {
        if (window.currentMethod && window.currentMethod !== 'ALL') {
            chip.textContent = window.currentMethod === 'OTHERS' ? 'Others' : window.currentMethod;
            chip.style.display = '';
        } else {
            chip.style.display = 'none';
        }
    }
}

// ---------- 格式化輔助函數 ----------
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

// 詳細模態框功能
function showDetailModal(data) {
    // 填入詳細資訊
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
    
    // 顯示模態框
    detailModal.classList.add('show');
    
    // 防止背景滾動
    document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
    detailModal.classList.remove('show');
    
    // 恢復背景滾動
    document.body.style.overflow = 'auto';
    
    // 移除活躍狀態
    const activeRow = document.querySelector('.traffic-row.active');
    if (activeRow) {
        activeRow.classList.remove('active');
    }
}

// IP 統計模態框
function openIpStatsModal() {
    // 確保取得最新的節點（因為腳本載入早於節點插入）
    if (!ipStatsModal) ipStatsModal = document.getElementById('ipStatsModal');
    if (!ipStatsList) ipStatsList = document.getElementById('ip-stats-list');
    if (!Array.isArray(window.flows) || !ipStatsModal || !ipStatsList) return;
    const map = new Map();
    for (const f of window.flows) {
        if (f && f.protocol === 'http' && f.client_ip) {
            map.set(f.client_ip, (map.get(f.client_ip) || 0) + 1);
        }
    }
    const rows = [...map.entries()].sort((a,b) => b[1]-a[1]);
    ipStatsList.innerHTML = rows.map(([ip, count]) => `<tr><td>${ip}</td><td>${count}</td></tr>`).join('');
    ipStatsModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeIpStatsModal() {
    if (!ipStatsModal) ipStatsModal = document.getElementById('ipStatsModal');
    if (!ipStatsModal) return;
    ipStatsModal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// 點擊模態框外部關閉
detailModal.addEventListener('click', function(e) {
    if (e.target === detailModal) {
        closeDetailModal();
    }
});

// ESC 鍵關閉模態框
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && detailModal.classList.contains('show')) {
        closeDetailModal();
    }
});

// 初始化摘要卡片
updateSummaryCards();

// 初始化篩選狀態和綁定事件
document.addEventListener('DOMContentLoaded', function() {
    // 取得 IP 統計模態框節點
    ipStatsModal = document.getElementById('ipStatsModal');
    ipStatsList = document.getElementById('ip-stats-list');
    ipReqsModal = document.getElementById('ipReqsModal');
    ipReqsTitle = document.getElementById('ip-reqs-title');
    ipReqsList = document.getElementById('ip-reqs-list');
    // 首先從快取恢復之前的狀態
    if (typeof window.restoreState === 'function') {
        window.restoreState();
    }
    
    // 綁定篩選按鈕事件
    document.querySelectorAll('.filter-icon-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const filterType = this.dataset.filter;
            setFilter(filterType);
            // 變更時儲存篩選
            try { localStorage.setItem(window.STORAGE_KEYS.filter, window.currentFilter); } catch (_) {}
        });
    });
    
    // 確保有活躍的篩選；如果沒有恢復的，預設為 'all'
    const hasActive = !!document.querySelector('.filter-icon-btn.active');
    if (!hasActive) {
        setFilter('all');
    }

    // 方法篩選 UI（點擊整個 Method 區域）
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
                try { localStorage.setItem(window.STORAGE_KEYS.method, window.currentMethod); } catch (_) {}
                menu.classList.remove('show');
            });
        });

        document.addEventListener('click', function() {
            menu.classList.remove('show');
        });
    }
    
    // 綁定清除流量按鈕
    const clearBtn = document.getElementById('clear-traffic-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const confirmed = confirm('Confirm to clear current traffic?');
            if (!confirmed) return;

            // 如果模態框開啟則關閉
            if (detailModal.classList.contains('show')) {
                closeDetailModal();
            }

            // 清除表格行
            while (trafficList.firstChild) {
                trafficList.removeChild(trafficList.firstChild);
            }

            // 重置資料和統計
            if (window.flows) {
                window.flows.length = 0;
            }
            if (typeof window.resetStats === 'function') {
                window.resetStats();
            }
            updateSummaryCards();

            // 保持當前篩選狀態活躍樣式
            setFilter(window.currentFilter);

            // 清除持久化快取（方法重置為 ALL）
            try {
                localStorage.removeItem(window.STORAGE_KEYS.flows);
                localStorage.removeItem(window.STORAGE_KEYS.stats);
                localStorage.setItem(window.STORAGE_KEYS.method, 'ALL');
            } catch (_) {}
        });
    }
    
    // 在卸載前儲存以持久化最新計數器
    window.addEventListener('beforeunload', function() {
        try { 
            if (typeof window.saveState === 'function') {
                window.saveState(); 
            }
        } catch (_) {}
    });
    // 每秒刷新當前時間顯示
    const nowLabel = document.getElementById('now-time');
    if (nowLabel) {
        setInterval(() => {
            const now = new Date();
            nowLabel.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        }, 1000);
    }
    // 綁定 Source IP 表頭開啟統計
    const thSourceIp = document.getElementById('th-source-ip');
    if (thSourceIp) {
        thSourceIp.addEventListener('click', function() {
            openIpStatsModal();
        });
    }
    // 綁定 Summary 卡片開啟統計
    const sourceIpCard = document.getElementById('source-ip-card');
    if (sourceIpCard) {
        sourceIpCard.addEventListener('click', function() {
            openIpStatsModal();
        });
    }
    // 點擊背景關閉
    if (ipStatsModal) {
        ipStatsModal.addEventListener('click', function(e) {
            if (e.target === ipStatsModal) {
                closeIpStatsModal();
            }
        });

        // 在 IP 統計表中點擊某 IP → 打開該 IP 的請求列表
        ipStatsList?.addEventListener('click', function(e) {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const ipCell = tr.querySelector('td');
            if (!ipCell) return;
            const ip = ipCell.textContent.trim();
            openIpReqsModal(ip);
        });
    }

    // 讓 IP Requests 視窗支援點擊背景關閉
    if (ipReqsModal) {
        ipReqsModal.addEventListener('click', function(e) {
            if (e.target === ipReqsModal) {
                closeIpReqsModal();
            }
        });
    }
    // ESC 關閉
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && ipStatsModal && ipStatsModal.classList.contains('show')) {
            closeIpStatsModal();
        }
    });
});

// 匯出全域函數供其他模組使用
window.createAndInsertRow = createAndInsertRow;
window.updateSummaryCards = updateSummaryCards;
window.setFilter = setFilter;
window.setMethodFilter = setMethodFilter;
window.showDetailModal = showDetailModal;
window.closeDetailModal = closeDetailModal;
window.openIpStatsModal = openIpStatsModal;
window.closeIpStatsModal = closeIpStatsModal;
function openIpReqsModal(ip) {
    if (!ipReqsModal) ipReqsModal = document.getElementById('ipReqsModal');
    if (!ipReqsTitle) ipReqsTitle = document.getElementById('ip-reqs-title');
    if (!ipReqsList) ipReqsList = document.getElementById('ip-reqs-list');
    if (!ipReqsModal || !ipReqsTitle || !ipReqsList) return;

    ipReqsTitle.textContent = ip;
    const items = [];
    const all = (window.flows || []);
    for (let idx = 0; idx < all.length; idx++) {
        const f = all[idx];
        if (f && f.protocol === 'http' && f.client_ip === ip) {
            items.push({ index: idx, flow: f });
        }
    }
    // 排序：POST 優先，其次依照時間/新舊（index 大在前）
    items.sort((a, b) => {
        const aP = a.flow.method === 'POST' ? 1 : 0;
        const bP = b.flow.method === 'POST' ? 1 : 0;
        if (aP !== bP) return bP - aP;
        return b.index - a.index; // 越新的 index 越大
    });

    const rows = items.map(({ index, flow }) => {
        const safeUrl = escapeHtml(flow.url);
        // 使用每筆流量固定的時間戳（timestamp），如無則回退為現在
        const tsObj = flow && flow.timestamp ? new Date(flow.timestamp) : new Date();
        const ts = tsObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        return `<tr data-flow-index="${index}">
            <td class="nowrap"><span class="method-badge ${flow.method}">${flow.method}</span></td>
            <td class="url-cell" title="${safeUrl}">${safeUrl}</td>
            <td class="nowrap"><span class="status-badge" data-status="${flow.status}">${flow.status}</span></td>
            <td class="nowrap"><span class="time-badge">${ts}</span></td>
        </tr>`;
    });
    ipReqsList.innerHTML = rows.join('') || '<tr><td colspan="4">No HTTP requests.</td></tr>';
    ipReqsModal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // 列或按鈕點擊 → 開啟詳細
    const clickHandler = function(ev) {
        const tr = ev.target.closest('tr');
        if (!tr) return;
        const idxStr = tr.getAttribute('data-flow-index');
        const idx = idxStr ? parseInt(idxStr, 10) : NaN;
        const item = Number.isFinite(idx) ? (window.flows || [])[idx] : null;
        if (item) {
            // 不關閉當前 IP Requests 列表，直接在最上層開啟詳細視窗
            const dm = document.getElementById('detailModal');
            if (dm) {
                dm.style.zIndex = '5000';
            }
            showDetailModal(item);
            // 標示此列為已讀
            tr.classList.add('read');
        }
    };
    // 維持綁定（不使用 once），讓多次點擊都可開啟
    ipReqsList.addEventListener('click', clickHandler);
}

function closeIpReqsModal() {
    if (!ipReqsModal) ipReqsModal = document.getElementById('ipReqsModal');
    if (!ipReqsModal) return;
    ipReqsModal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

window.closeIpReqsModal = closeIpReqsModal;
