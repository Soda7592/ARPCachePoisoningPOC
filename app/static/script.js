// script.js

const flows = [];
const trafficList = document.getElementById('traffic-list');
const detailsContent = document.getElementById('details-content');
const noContentMessage = document.getElementById('no-content-message');
const flowDetails = document.getElementById('flow-details');

const ws = new WebSocket('ws://localhost:8088');

ws.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        const flowIndex = flows.push(data) - 1;

        const flowItem = document.createElement('li');
        flowItem.className = 'flow-item';
        flowItem.dataset.index = flowIndex;

        flowItem.innerHTML = `
            <span>${data.client_ip}</span>
            <span class="method ${data.method}">${data.method}</span>
            <span>${data.protocol}</span>
            <span class="url-text">${data.url}</span>
            <span class="status-code" data-status="${data.status}">${data.status}</span>
        `;
        
        if (trafficList.firstChild && trafficList.firstChild.className === 'traffic-list-header') {
            trafficList.insertBefore(flowItem, trafficList.firstChild.nextSibling);
        } else {
            trafficList.prepend(flowItem);
        }

        flowItem.addEventListener('click', function() {
            const activeItem = document.querySelector('.flow-item.active');
            if (activeItem) {
                activeItem.classList.remove('active');
            }
            this.classList.add('active');
            
            showDetailsInSidebar(data);
        });
        
        const maxItems = 50;
        if (trafficList.children.length > maxItems) {
            trafficList.lastElementChild.remove();
        }
    } catch (e) {
        console.error("Error parsing message:", e);
    }
};

function showDetailsInSidebar(data) {
    noContentMessage.style.display = 'none';
    flowDetails.style.display = 'block';

    document.getElementById('details-url').textContent = data.url;
    document.getElementById('details-method').textContent = data.method;
    document.getElementById('details-status').textContent = data.status;
    document.getElementById('details-protocol').textContent = data.protocol;

    document.getElementById('details-headers').textContent = JSON.stringify(data.headers, null, 2);
    
    if (data.protocol === 'http' && data.body) {
        document.getElementById('details-body').textContent = data.body;
    } else {
        document.getElementById('details-body').textContent = "Body content is not available for HTTPS flows or is empty.";
    }
}