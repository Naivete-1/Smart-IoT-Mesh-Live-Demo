// SMART IoT MESH NETWORK ANALYZER // 

// INITIALIZATION & GLOBAL VARIABLES
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
const svg = document.getElementById('networkSvg');
const container = document.getElementById('canvasContainer');

// Network data 
let nodes = [
    { id: 'GW1', type: 'gateway', x: 400, y: 300, active: true, range: 150, status: 'online', rssi: -45 },
    {id:  'R1', type: 'gateway', x: 350, y:260, active:true, range: 150, status: 'online', rssi: -35},
    { id: 'N1', type: 'node', x: 200, y: 200, active: true, range: 100, status: 'online', rssi: -52 },
    { id: 'N2', type: 'node', x: 600, y: 250, active: true, range: 100, status: 'online', rssi: -48 },
    { id: 'N3', type: 'node', x: 300, y: 450, active: true, range: 100, status: 'online', rssi: -61 },
    { id: 'N4', type: 'node', x: 500, y: 400, active: true, range: 100, status: 'online', rssi: -55 }
];

let draggingNode = null;
let viewMode = 'topology'; // 'topology' or 'coverage'
let zoom = 1;

// Initialize links array if not present
if (!window.links) {
    window.links = [];
}
// RESIZE HANDLER
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    refreshView();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// SIGNAL-BASED DEVICE STATUS UPDATE
function updateDeviceStatusFromSignal() {
    // Find all service providers (gateways, routers, AND repeaters)
    const serviceProviders = nodes.filter(n => n.active && 
        (n.type === 'gateway' || 
         n.type === 'router' || 
         n.type === 'repeater' ||
         n.id.includes('ISP') || 
         n.id.includes('AP')));
    
    // If no service providers, all client devices should be offline
    if (serviceProviders.length === 0) {
        nodes.forEach(node => {
            // Only client devices (nodes) go offline
            if (node.type === 'node') {
                node.active = false;
                node.status = 'offline';
                node.signalQuality = 'no signal';
                node.rssi = -100;
                node.connectedTo = null;
            }
        });
        return;
    }
    
    // Update each client node based on signal strength from ANY provider
    nodes.forEach(node => {
        // Skip infrastructure devices (they provide signal, don't need to find signal)
        if (node.type === 'gateway' || node.type === 'router' || node.type === 'repeater') {
            // These devices are always active if they were created as active
            return;
        }
        
        let bestSignal = -Infinity;
        let bestProvider = null;
        
        // Check signal from ALL service providers (including repeaters)
        serviceProviders.forEach(provider => {
            const dist = Math.sqrt((node.x - provider.x) ** 2 + (node.y - provider.y) ** 2);
            
            // Only consider if within provider's range
            if (dist < provider.range) {
                // Calculate signal strength (closer = better)
                // Formula: -30dBm at center, -90dBm at edge
                const signalStrength = -30 - ((dist / provider.range) * 60);
                
                if (signalStrength > bestSignal) {
                    bestSignal = signalStrength;
                    bestProvider = provider;
                }
            }
        });
        
        // Update node based on best signal
        if (bestSignal > -100) { // Has some signal
            node.active = true;
            node.status = 'online';
            node.rssi = Math.round(bestSignal);
            node.connectedTo = bestProvider ? bestProvider.id : null;
            
            // Determine signal quality
            if (bestSignal > -50) {
                node.signalQuality = 'excellent';
            } else if (bestSignal > -65) {
                node.signalQuality = 'good';
            } else if (bestSignal > -75) {
                node.signalQuality = 'fair';
            } else {
                node.signalQuality = 'weak';
            }
        } else {
            // No signal - device goes offline
            node.active = false;
            node.status = 'offline';
            node.signalQuality = 'no signal';
            node.rssi = -100;
            node.connectedTo = null;
        }
    });
}
// MAIN RENDER FUNCTION
function refreshView() {
    svg.innerHTML = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update device status based on signal
    updateDeviceStatusFromSignal();

    // Draw coverage in coverage mode
    if (viewMode === 'coverage') {
        drawCoverage();
    }

    // Draw connections
    drawConnections();
    
    // Draw nodes
    drawNodes();
    
    // Update sidebar
    updateSidebar();
    
    // Update dashboard if available
    if (window.dashboard) {
        window.dashboard.updateDeviceStatus(nodes);
    }
}
// DRAW COVERAGE CIRCLES
function drawCoverage() {
    // Include repeaters as service providers for coverage visualization
    const serviceProviders = nodes.filter(n => n.active && 
        (n.type === 'gateway' || n.type === 'router' || n.type === 'repeater' || 
         n.id.includes('ISP') || n.id.includes('Cloud') || n.id.includes('AP')));
    
    if (serviceProviders.length === 0) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No service providers - Add a router, gateway, or repeater', canvas.width/2, canvas.height/2);
        return;
    }
    
    serviceProviders.forEach(provider => {
        // Draw coverage circle in SVG
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", provider.x);
        circle.setAttribute("cy", provider.y);
        circle.setAttribute("r", provider.range);
        
        // Color based on provider type
        if (provider.type === 'gateway') {
            circle.setAttribute("fill", "rgba(239, 68, 68, 0.15)");
            circle.setAttribute("stroke", "rgba(239, 68, 68, 0.5)");
        } else if (provider.type === 'router') {
            circle.setAttribute("fill", "rgba(8, 138, 8, 0.15)");
            circle.setAttribute("stroke", "rgba(32, 150, 9, 0.5)");
        } else if (provider.type === 'repeater') {
            circle.setAttribute("fill", "rgba(139, 92, 246, 0.15)");
            circle.setAttribute("stroke", "rgba(139, 92, 246, 0.5)");
        } else {
            circle.setAttribute("fill", "rgba(59, 130, 246, 0.15)");
            circle.setAttribute("stroke", "rgba(59, 130, 246, 0.5)");
        }
        
        circle.setAttribute("stroke-dasharray", "5,5");
        circle.setAttribute("stroke-width", "2");
        svg.appendChild(circle);
        
        // Draw heatmap on canvas
        const gradient = ctx.createRadialGradient(provider.x, provider.y, 0, provider.x, provider.y, provider.range);
        
        if (provider.type === 'gateway') {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
            gradient.addColorStop(0.7, 'rgba(239, 68, 68, 0.1)');
        } else if (provider.type === 'router') {
            gradient.addColorStop(0, 'rgba(8, 138, 8, 0.15)');
            gradient.addColorStop(0.7, 'rgba(32, 150, 9, 0.5)');
        } else if (provider.type === 'repeater') {
            gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
            gradient.addColorStop(0.7, 'rgba(139, 92, 246, 0.1)');
        } else {
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
            gradient.addColorStop(0.7, 'rgba(59, 130, 246, 0.1)');
        }
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(provider.x, provider.y, provider.range, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    });
}

// DRAW CONNECTIONS
function drawConnections() {
    const activeNodes = nodes.filter(n => n.active);
    const drawnConnections = new Set();
    
    // Method 1: Draw connections from the 'links' array (explicit connections)
    if (window.links && window.links.length > 0) {
        window.links.forEach(link => {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);
            
            if (sourceNode && targetNode && sourceNode.active && targetNode.active) {
                const connectionId = [sourceNode.id, targetNode.id].sort().join('-');
                if (!drawnConnections.has(connectionId)) {
                    drawnConnections.add(connectionId);
                    
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", sourceNode.x);
                    line.setAttribute("y1", sourceNode.y);
                    line.setAttribute("x2", targetNode.x);
                    line.setAttribute("y2", targetNode.y);
                    
                    if (sourceNode.type === 'gateway' || targetNode.type === 'gateway') {
                        line.setAttribute("stroke", "#ef4444");
                    } else if (sourceNode.type === 'router' || targetNode.type === 'router') {
                        line.setAttribute("stroke", "#f97316");
                    } else {
                        line.setAttribute("stroke", "#10b981");
                    }
                    
                    line.setAttribute("stroke-width", "3");
                    line.setAttribute("stroke-opacity", "0.8");
                    svg.appendChild(line);
                }
            }
        });
    }
    
    // Method 2: Draw wireless connections based on range
    for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
            const n1 = activeNodes[i];
            const n2 = activeNodes[j];
            
            const dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
            if (dist < n1.range || dist < n2.range) {
                const connectionId = [n1.id, n2.id].sort().join('-');
                
                if (!drawnConnections.has(connectionId)) {
                    drawnConnections.add(connectionId);
                    
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", n1.x);
                    line.setAttribute("y1", n1.y);
                    line.setAttribute("x2", n2.x);
                    line.setAttribute("y2", n2.y);
                    
                    if (n1.type === 'gateway' || n2.type === 'gateway') {
                        line.setAttribute("stroke", "#ef4444");
                    } else if (n1.type === 'router' || n2.type === 'router') {
                        line.setAttribute("stroke", "#f97316");
                    } else {
                        line.setAttribute("stroke", "#3b82f6");
                    }
                    
                    line.setAttribute("stroke-opacity", "0.3");
                    line.setAttribute("stroke-width", "2");
                    line.setAttribute("stroke-dasharray", "5,5");
                    svg.appendChild(line);
                }
            }
        }
    }
}

// DRAW NODES
function drawNodes() {
    nodes.forEach(node => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("class", "node-active");
        
        group.onclick = (e) => {
            e.stopPropagation();
            node.active = !node.active;
            node.status = node.active ? 'online' : 'offline';
            refreshView();
        };
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", node.x);
        circle.setAttribute("cy", node.y);
        circle.setAttribute("r", (node.type === 'gateway' || node.type === 'router') ? 12 : 8);
        
        // Color based on type and status
        if (!node.active) {
            circle.setAttribute("fill", "#6b7280");
            circle.setAttribute("stroke", "#4b5563");
        } else if (node.type === 'gateway') {
            circle.setAttribute("fill", "#ef4444");
            circle.setAttribute("stroke", "#fff");
        } else if (node.type === 'repeater') {
            circle.setAttribute("fill", "#8b5cf6");
            circle.setAttribute("stroke", "#fff");
        } else if (node.type === 'router') {
            circle.setAttribute("fill", "#139b1e"); // Orange for router
            circle.setAttribute("stroke", "#fff");
        } else {
            circle.setAttribute("fill", "#3b82f6");
            circle.setAttribute("stroke", "#fff");
        }
        
        circle.setAttribute("stroke-width", "2");
        
        if (node.active) {
            circle.setAttribute("style", "animation: pulse 2s infinite;");
        }
        
        // Add signal indicator ring for non-infrastructure devices
        if (node.signalQuality && node.type !== 'gateway' && node.type !== 'router' && 
            !node.id.includes('ISP') && !node.id.includes('Cloud')) {
            const signalRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            signalRing.setAttribute("cx", node.x);
            signalRing.setAttribute("cy", node.y);
            signalRing.setAttribute("r", (node.type === 'gateway' ? 14 : 10));
            signalRing.setAttribute("fill", "none");
            
            if (node.signalQuality === 'excellent') {
                signalRing.setAttribute("stroke", "#10b981");
                signalRing.setAttribute("stroke-width", "3");
            } else if (node.signalQuality === 'good') {
                signalRing.setAttribute("stroke", "#84cc16");
                signalRing.setAttribute("stroke-width", "2.5");
            } else if (node.signalQuality === 'fair') {
                signalRing.setAttribute("stroke", "#facc15");
                signalRing.setAttribute("stroke-width", "2");
            } else if (node.signalQuality === 'weak') {
                signalRing.setAttribute("stroke", "#f97316");
                signalRing.setAttribute("stroke-width", "2");
            } else {
                signalRing.setAttribute("stroke", "#ef4444");
                signalRing.setAttribute("stroke-width", "1.5");
                signalRing.setAttribute("stroke-dasharray", "3,3");
            }
            
            signalRing.setAttribute("stroke-opacity", "0.8");
            signalRing.setAttribute("fill-opacity", "0");
            group.appendChild(signalRing);
        }
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", node.x);
        text.setAttribute("y", node.y + 25);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#9ca3af");
        text.setAttribute("font-size", "9");
        text.textContent = node.id;
        
        group.appendChild(circle);
        group.appendChild(text);
        svg.appendChild(group);
    });
}
// UPDATE SIDEBAR 
function updateSidebar() {
    // Calculate network health based on active nodes
    const activeNodes = nodes.filter(n => n.active);
    const totalNodes = nodes.length;
    const health = totalNodes > 0 ? Math.round((activeNodes.length / totalNodes) * 100) : 0;
    
    const healthPercent = document.getElementById('healthPercent');
    if (healthPercent) healthPercent.textContent = health + '%';
    
    const healthBar = document.getElementById('healthBar');
    if (healthBar) {
        healthBar.style.width = health + '%';
        healthBar.className = `h-full transition-all duration-500 ${
            health > 80 ? 'bg-emerald-500' : 
            health > 40 ? 'bg-amber-500' : 
            'bg-red-500'
        }`;
    }
    
    const gateways = nodes.filter(n => n.type === 'gateway' && n.active);
    const routers = nodes.filter(n => n.type === 'router' && n.active);
    const repeaters = nodes.filter(n => n.type === 'repeater' && n.active);
    
    const statNodes = document.getElementById('statNodes');
    if (statNodes) statNodes.textContent = nodes.length;
    
    const gatewayCount = document.getElementById('gatewayCount');
    const gatewayCount2 = document.getElementById('gatewayCount2');
    const gwCount = gateways.length;
    if (gatewayCount) gatewayCount.textContent = gwCount;
    if (gatewayCount2) gatewayCount2.textContent = gwCount;
    
    // Detect network type
    let networkType = "Unknown";
    let networkDescription = "";
    
    if (gateways.length === 0 && routers.length === 0 && repeaters.length > 0) {
        networkType = "🏠 Local LAN (Switch-only)";
        networkDescription = "Local communication only. No internet gateway.";
    } else if ((gateways.length > 0 || routers.length > 0) && repeaters.length > 0) {
        networkType = "🌐 Hybrid Network";
        networkDescription = "Switches + Router - Internet ready";
    } else if (gateways.length > 0 || routers.length > 0) {
        networkType = "🖧 Mesh Network";
        networkDescription = "Direct connections to router";
    } else if (gateways.length === 0 && routers.length === 0 && repeaters.length === 0) {
        networkType = "🔄 Ad-hoc Mesh";
        networkDescription = "Peer-to-peer communication only";
    }
    
    // Analyze connectivity
    let isolated = [];
    let connected = [];
    const infrastructureNodes = [...gateways, ...routers];
    
    if (infrastructureNodes.length === 0) {
        connected = activeNodes.map(n => n.id);
        
        const trulyIsolated = [];
        activeNodes.forEach(node => {
            let hasAnyLink = false;
            
            nodes.filter(n => n.active && n.id !== node.id).forEach(other => {
                const dist = Math.sqrt((node.x - other.x) ** 2 + (node.y - other.y) ** 2);
                if (dist < node.range || dist < other.range) {
                    hasAnyLink = true;
                }
            });
            
            if (window.links) {
                window.links.forEach(link => {
                    if (link.source === node.id || link.target === node.id) {
                        hasAnyLink = true;
                    }
                });
            }
            
            if (!hasAnyLink) {
                trulyIsolated.push(node.id);
            }
        });
        
        if (trulyIsolated.length > 0) {
            isolated = trulyIsolated;
            connected = connected.filter(id => !trulyIsolated.includes(id));
        }
    } else {
        const infrastructureIds = infrastructureNodes.map(n => n.id);
        
        activeNodes.forEach(node => {
            if (infrastructureIds.includes(node.id)) {
                connected.push(node.id);
                return;
            }
            
            let canReachInfrastructure = false;
            
            infrastructureIds.forEach(infId => {
                const inf = nodes.find(n => n.id === infId);
                const dist = Math.sqrt((node.x - inf.x) ** 2 + (node.y - inf.y) ** 2);
                if (dist < node.range || dist < inf.range) {
                    canReachInfrastructure = true;
                }
            });
            
            if (!canReachInfrastructure && window.links) {
                const adj = {};
                nodes.forEach(n => adj[n.id] = []);
                
                window.links.forEach(link => {
                    if (adj[link.source]) adj[link.source].push(link.target);
                    if (adj[link.target]) adj[link.target].push(link.source);
                });
                
                const visited = new Set();
                const queue = [node.id];
                
                while (queue.length > 0 && !canReachInfrastructure) {
                    const current = queue.shift();
                    if (visited.has(current)) continue;
                    visited.add(current);
                    
                    if (infrastructureIds.includes(current)) {
                        canReachInfrastructure = true;
                        break;
                    }
                    
                    if (adj[current]) {
                        adj[current].forEach(neighbor => {
                            if (!visited.has(neighbor)) {
                                queue.push(neighbor);
                            }
                        });
                    }
                }
            }
            
            if (canReachInfrastructure) {
                connected.push(node.id);
            } else {
                isolated.push(node.id);
            }
        });
    }
    
    // Update device list
    const deviceList = document.getElementById('deviceList');
    const onlineCount = document.getElementById('onlineCount');
    
    if (deviceList) {
        if (nodes.length === 0) {
            deviceList.innerHTML = '<div class="text-center text-gray-500 py-2">No devices</div>';
            if (onlineCount) onlineCount.textContent = '0 Online';
        } else {
            let online = 0;
            let html = '';
            
            nodes.forEach(node => {
                const isActive = node.active;
                const isConnected = connected.includes(node.id);
                const isIsolated = isolated.includes(node.id);
                const isInfrastructure = infrastructureNodes.map(n => n.id).includes(node.id);
                
                if (isActive && (isConnected || infrastructureNodes.length === 0)) online++;
                
                let statusIcon = '';
                let statusColor = '';
                let statusText = '';
                
                if (!isActive) {
                    statusIcon = '○';
                    statusColor = 'text-gray-500';
                    statusText = 'offline';
                } else if (infrastructureNodes.length === 0) {
                    if (isConnected) {
                        statusIcon = '●';
                        statusColor = 'text-green-400';
                        statusText = 'LAN';
                    } else {
                        statusIcon = '◐';
                        statusColor = 'text-yellow-400';
                        statusText = 'no links';
                    }
                } else {
                    if (isInfrastructure) {
                        statusIcon = node.type === 'router' ? '📡' : '★';
                        statusColor = node.type === 'router' ? 'text-orange-400' : 'text-purple-400';
                        statusText = node.type === 'router' ? 'router' : 'gateway';
                    } else if (isConnected) {
                        let signalEmoji = '';
                        if (node.signalQuality === 'excellent') signalEmoji = '🟢';
                        else if (node.signalQuality === 'good') signalEmoji = '🟡';
                        else if (node.signalQuality === 'fair') signalEmoji = '🟠';
                        else signalEmoji = '🔴';
                        
                        statusIcon = '●';
                        statusColor = 'text-green-400';
                        statusText = `${signalEmoji} ${node.signalQuality || 'connected'}`;
                    } else if (isIsolated) {
                        statusIcon = '◌';
                        statusColor = 'text-red-400';
                        statusText = 'isolated';
                    } else {
                        statusIcon = '○';
                        statusColor = 'text-gray-400';
                        statusText = 'idle';
                    }
                }
                
                let typeIcon = '';
                if (node.type === 'gateway') typeIcon = '🖧';
                else if (node.type === 'router') typeIcon = '📡';
                else if (node.type === 'repeater') typeIcon = '🔄';
                else typeIcon = '💻';
                
                const dbmDisplay = isActive && node.rssi ? 
                    `<span class="font-mono ${
                        node.rssi > -50 ? 'text-green-400' :
                        node.rssi > -65 ? 'text-yellow-400' :
                        node.rssi > -75 ? 'text-orange-400' :
                        'text-red-400'
                    } ml-1">${node.rssi}dBm</span>` : '';
                
                html += `
                    <div class="flex items-center justify-between p-1.5 bg-gray-700/30 rounded text-xs mb-1">
                        <div class="flex items-center space-x-2">
                            <span>${typeIcon}</span>
                            <span class="font-medium">${node.id}</span>
                            <span class="text-gray-500 text-xxs">${node.type}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${dbmDisplay}
                            <div class="${statusColor} text-xxs">
                                ${statusIcon} ${statusText}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            deviceList.innerHTML = html;
            if (onlineCount) onlineCount.textContent = `${online} Online`;
            document.getElementById('deviceCount').textContent = nodes.length;
        }
    }
    
    // Update diagnostics 
    const diagBox = document.getElementById('diagnosticBox');
    if (diagBox) {
        let diagHtml = '';
        
        const noSignal = nodes.filter(n => n.signalQuality === 'no signal' && n.type !== 'gateway' && n.type !== 'router').length;
        const weak = nodes.filter(n => n.signalQuality === 'weak' && n.type !== 'gateway' && n.type !== 'router').length;
        
        if (infrastructureNodes.length === 0) {
            if (isolated.length > 0) {
                diagHtml = `
                    <div class="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                        <p class="text-xs text-yellow-400">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            ${isolated.length} device(s) have no connections
                        </p>
                        <p class="text-xxs text-gray-400 mt-1">Local LAN - No internet gateway</p>
                    </div>
                `;
            } else {
                diagHtml = `
                    <div class="p-2 bg-green-900/20 border border-green-500/30 rounded">
                        <p class="text-xs text-green-400">
                            <i class="fas fa-check-circle mr-1"></i>
                            Local LAN - All devices connected
                        </p>
                        <p class="text-xxs text-gray-400 mt-1">Switches only. No internet access.</p>
                    </div>
                `;
            }
        } else {
            if (noSignal > 0) {
                diagHtml = `
                    <div class="p-2 bg-red-900/20 border border-red-500/30 rounded">
                        <p class="text-xs text-red-400">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            ${noSignal} device(s) have NO SIGNAL
                        </p>
                        <p class="text-xxs text-gray-400 mt-1">Devices out of range - Add repeaters</p>
                    </div>
                `;
            } else if (weak > 0) {
                diagHtml = `
                    <div class="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                        <p class="text-xs text-yellow-400">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            ${weak} device(s) have WEAK signal
                        </p>
                        <p class="text-xxs text-gray-400 mt-1">Consider adding repeaters</p>
                    </div>
                `;
            } else {
                diagHtml = `
                    <div class="p-2 bg-green-900/20 border border-green-500/30 rounded">
                        <p class="text-xs text-green-400">
                            <i class="fas fa-globe mr-1"></i>
                            Full connectivity - All devices online
                        </p>
                    </div>
                `;
            }
        }
        
        diagHtml += `
            <div class="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                <p class="text-xs text-blue-400">
                    <i class="fas fa-network-wired mr-1"></i>
                    ${networkType}
                </p>
                <p class="text-xxs text-gray-400">${networkDescription}</p>
            </div>
        `;
        
        diagBox.innerHTML = diagHtml;
    }
    
    // Update AI recommendations (simplified - focused on actionable advice)
    const recBox = document.getElementById('recommendationBox');
    if (recBox) {
        let recHtml = '';
        
        const excellent = nodes.filter(n => n.signalQuality === 'excellent' && n.type !== 'gateway' && n.type !== 'router').length;
        const good = nodes.filter(n => n.signalQuality === 'good' && n.type !== 'gateway' && n.type !== 'router').length;
        const fair = nodes.filter(n => n.signalQuality === 'fair' && n.type !== 'gateway' && n.type !== 'router').length;
        const weak = nodes.filter(n => n.signalQuality === 'weak' && n.type !== 'gateway' && n.type !== 'router').length;
        const noSignal = nodes.filter(n => n.signalQuality === 'no signal' && n.type !== 'gateway' && n.type !== 'router').length;
        
        const weakDevices = nodes.filter(n => (n.signalQuality === 'weak' || n.signalQuality === 'no signal') && 
                              n.type !== 'gateway' && n.type !== 'router');
        
        if (infrastructureNodes.length === 0) {
            if (nodes.filter(n => n.type !== 'gateway' && n.type !== 'router').length > 0) {
                recHtml = `
                    <div class="p-2 bg-red-900/20 border-l-4 border-red-500 rounded mb-1">
                        <p class="text-xs text-red-400 font-bold">🚫 NO SERVICE PROVIDER</p>
                        <p class="text-xxs text-gray-400">All devices offline - Add a router or gateway</p>
                    </div>
                `;
            }
        } else if (noSignal > 0) {
            recHtml += `
                <div class="p-2 bg-red-900/20 border-l-4 border-red-500 rounded mb-1">
                    <p class="text-xs text-red-400 font-bold">📡 ${noSignal} device(s) have NO SIGNAL</p>
                    <p class="text-xxs text-gray-400">Move closer to router or add repeater</p>
                </div>
            `;
            
            weakDevices.slice(0, 3).forEach(device => {
                const gateways = nodes.filter(n => (n.type === 'gateway' || n.type === 'router') && n.active);
                if (gateways.length > 0) {
                    const nearest = gateways.reduce((prev, curr) => {
                        const distPrev = Math.sqrt((device.x - prev.x) ** 2 + (device.y - prev.y) ** 2);
                        const distCurr = Math.sqrt((device.x - curr.x) ** 2 + (device.y - curr.y) ** 2);
                        return distPrev < distCurr ? prev : curr;
                    });
                    
                    const midX = Math.round((device.x + nearest.x) / 2);
                    const midY = Math.round((device.y + nearest.y) / 2);
                    
                    recHtml += `
                        <div class="p-2 bg-yellow-900/20 border-l-4 border-yellow-500 rounded mb-1">
                            <p class="text-xxs"><span class="font-bold text-yellow-400">${device.id}</span> 
                            <span class="text-gray-400">(${device.rssi}dBm)</span></p>
                            <p class="text-xxs text-gray-400">📌 Add repeater at (${midX}, ${midY})</p>
                        </div>
                    `;
                }
            });
        } else if (weak > 0) {
            recHtml += `
                <div class="p-2 bg-yellow-900/20 border-l-4 border-yellow-500 rounded mb-1">
                    <p class="text-xs text-yellow-400 font-bold">⚠️ ${weak} device(s) have WEAK signal</p>
                    <p class="text-xxs text-gray-400">Consider adding repeaters to improve coverage</p>
                </div>
            `;
        } else {
            recHtml += `
                <div class="p-2 bg-green-900/20 border-l-4 border-green-500 rounded mb-1">
                    <p class="text-xs text-green-400 font-bold">✅ Optimal Network Performance</p>
                    <p class="text-xxs text-gray-400">All devices have good signal quality</p>
                </div>
            `;
        }
        
        recHtml += `
            <div class="mt-2 p-2 bg-gray-800/80 rounded text-xxs">
                <div class="flex justify-between">
                    <span>🟢 Excellent: <span class="text-green-400">${excellent}</span></span>
                    <span>🟡 Good: <span class="text-yellow-400">${good}</span></span>
                </div>
                <div class="flex justify-between mt-1">
                    <span>🟠 Fair: <span class="text-orange-400">${fair}</span></span>
                    <span>🔴 Weak/No: <span class="text-red-400">${weak + noSignal}</span></span>
                </div>
            </div>
        `;
        
        recBox.innerHTML = recHtml;
    }
    
    // Update bottom stats
    const dataRate = document.getElementById('dataRate');
    const packetLoss = document.getElementById('packetLoss');
    
    if (dataRate) {
        dataRate.textContent = infrastructureNodes.length > 0 ? '1.2 Gbps' : '100 Mbps';
    }
    if (packetLoss) {
        const noSignalCount = nodes.filter(n => n.signalQuality === 'no signal' && n.type !== 'gateway' && n.type !== 'router').length;
        const weakCount = nodes.filter(n => n.signalQuality === 'weak' && n.type !== 'gateway' && n.type !== 'router').length;
        const totalClients = nodes.filter(n => n.type !== 'gateway' && n.type !== 'router').length;
        
        if (totalClients > 0) {
            const lossPercent = Math.round(((noSignalCount + weakCount * 0.5) / totalClients) * 100);
            packetLoss.textContent = lossPercent + '%';
        } else {
            packetLoss.textContent = '0%';
        }
    }
}
function isPingableDevice(node) {
    if (!node || !node.active) return false;
    if (node.type === 'node') return true;
    const id = node.id.toLowerCase();
    if (id.includes('pc') || id.includes('server') || id.includes('laptop') || 
        id.includes('workstation') || id.includes('desktop')) {
        return true;
    }
    return false;
}
function updatePingDropdowns() {
    const sourceSelect = document.getElementById('pingSource');
    const targetSelect = document.getElementById('pingTarget');
    
    if (!sourceSelect || !targetSelect) return;
    
    const pingableDevices = nodes.filter(node => node.active && node.type === 'node');
    
    sourceSelect.innerHTML = '<option value="">Select Source</option>';
    targetSelect.innerHTML = '<option value="">Select Target</option>';
    
    pingableDevices.forEach(device => {
        const ipText = device.ip ? ` (${device.ip})` : '';
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = `${device.id}${ipText}`;
        
        sourceSelect.appendChild(option.cloneNode(true));
        targetSelect.appendChild(option);
    });
}

function findPath(startId, endId) {
    const start = nodes.find(n => n.id === startId);
    const end = nodes.find(n => n.id === endId);
    
    if (!start || !end || !start.active || !end.active) return null;
    
    const queue = [{ node: startId, path: [startId] }];
    const visited = new Set([startId]);
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        if (current.node === endId) {
            return current.path;
        }
        
        if (window.links && window.links.length > 0) {
            window.links.forEach(link => {
                if (link.source === current.node || link.target === current.node) {
                    const neighbor = link.source === current.node ? link.target : link.source;
                    const neighborNode = nodes.find(n => n.id === neighbor);
                    
                    if (neighborNode && neighborNode.active && !visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push({
                            node: neighbor,
                            path: [...current.path, neighbor]
                        });
                    }
                }
            });
        }
    }
    
    return null;
}
function sendPing(sourceId, targetId) {
    const result = document.getElementById('pingResult');
    const flowDiv = document.getElementById('packetFlow');
    
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    
    if (!source || !target) {
        result.innerHTML += `\n❌ Invalid source or target`;
        return;
    }
    
    if (!isPingableDevice(source) || !isPingableDevice(target)) {
        result.innerHTML += `\n❌ Pings can only be sent between end devices (PCs, servers, etc.)`;
        return;
    }
    
    if (!source.active || !target.active) {
        result.innerHTML += `\n❌ Source or target is offline`;
        return;
    }
    
    result.innerHTML += `\n🔄 Pinging ${targetId} (${target.ip}) from ${sourceId} (${source.ip})...`;
    result.scrollTop = result.scrollHeight;
    
    const path = findPath(sourceId, targetId);
    
    if (!path || path.length < 2) {
        result.innerHTML += `\n❌ No route to host - Destination unreachable (check connections)`;
        result.scrollTop = result.scrollHeight;
        return;
    }
    
    flowDiv.innerHTML += `\n📦 Path: ${path.join(' → ')}`;
    flowDiv.scrollTop = flowDiv.scrollHeight;
    
    let successful = 0;
    let times = [];
    
    for (let i = 1; i <= 4; i++) {
        setTimeout(() => {
            let lossChance = 0.05;
            if (target.signalQuality === 'weak') lossChance = 0.15;
            else if (target.signalQuality === 'fair') lossChance = 0.1;
            else if (target.signalQuality === 'good') lossChance = 0.03;
            else if (target.signalQuality === 'excellent') lossChance = 0.01;

            if (Math.random() > lossChance) {
                const hopCount = path.length - 1;
                let baseRTT = hopCount * 5;
                
                path.forEach(hop => {
                    const hopNode = nodes.find(n => n.id === hop);
                    if (hopNode && (hopNode.type === 'gateway' || hopNode.type === 'router')) {
                        baseRTT += 3;
                    }
                });
                
                const rtt = Math.floor(baseRTT + Math.random() * 10);
                successful++;
                times.push(rtt);
                
                visualizePacket(path, i, rtt);
                
                result.innerHTML += `\n  ✅ Reply from ${target.ip}: bytes=32 time=${rtt}ms TTL=64`;
            } else {
                result.innerHTML += `\n  ⏱️ Request timeout`;
            }
            
            if (i === 4) {
                const loss = ((4 - successful) / 4) * 100;
                const avgTime = times.length > 0 ? Math.floor(times.reduce((a,b) => a+b, 0) / times.length) : 0;
                const minTime = times.length > 0 ? Math.min(...times) : 0;
                const maxTime = times.length > 0 ? Math.max(...times) : 0;
                
                result.innerHTML += `\n\nPing statistics for ${target.ip}:`;
                result.innerHTML += `\n   Packets: Sent = 4, Received = ${successful}, Lost = ${4-successful} (${loss}% loss)`;
                if (successful > 0) {
                    result.innerHTML += `\n   Round trip: min=${minTime}ms, avg=${avgTime}ms, max=${maxTime}ms`;
                }
                result.scrollTop = result.scrollHeight;
            }
        }, i * 700);
    }
}

function visualizePacket(path, seq, rtt) {
    const flowDiv = document.getElementById('packetFlow');
    let currentHop = 0;
    
    flowDiv.innerHTML += `\n   Packet #${seq} traveling...`;
    
    setTimeout(() => {
        flowDiv.innerHTML += ` Path: ${path.join(' → ')}`;
        flowDiv.scrollTop = flowDiv.scrollHeight;
    }, 100);
    
    const hopInterval = setInterval(() => {
        if (currentHop >= path.length - 1) {
            clearInterval(hopInterval);
            flowDiv.innerHTML += ` ✓ (${rtt}ms)`;
            flowDiv.scrollTop = flowDiv.scrollHeight;
            setTimeout(() => refreshView(), 500);
            return;
        }
        
        const fromNode = nodes.find(n => n.id === path[currentHop]);
        const toNode = nodes.find(n => n.id === path[currentHop + 1]);
        
        if (fromNode && toNode) {
            const steps = 20;
            let step = 0;
            
            const moveInterval = setInterval(() => {
                const x = fromNode.x + ((toNode.x - fromNode.x) * step / steps);
                const y = fromNode.y + ((toNode.y - fromNode.y) * step / steps);
                
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
                
                step++;
                
                if (step >= steps) {
                    clearInterval(moveInterval);
                }
            }, 30);
        }
        
        currentHop++;
    }, 400);
}

function assignIPs() {
    const networks = {
        'gateway': '10.0.',
        'router': '10.1.',
        'repeater': '10.2.',
        'node': '192.168.'
    };
    
    let counters = {
        'gateway': 1,
        'router': 1,
        'repeater': 1,
        'node': 1
    };
    
    nodes.forEach(node => {
        if (!node.ip) {
            const network = networks[node.type] || '192.168.';
            const counter = counters[node.type]++;
            node.ip = `${network}${Math.floor(counter/254) + 1}.${counter % 254 + 1}`;
            node.mac = generateMAC();
        }
    });
    
    updateIPDisplay();
}

function generateMAC() {
    const mac = [];
    for (let i = 0; i < 6; i++) {
        mac.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
    }
    return mac.join(':').toUpperCase();
}

function updateIPDisplay() {
    const ipList = document.getElementById('ipConfigList');
    if (!ipList) return;
    
    let html = '';
    nodes.forEach(node => {
        const statusColor = node.active ? 'text-green-400' : 'text-red-400';
        const signalIcon = node.signalQuality === 'excellent' ? '🟢' :
                          node.signalQuality === 'good' ? '🟡' :
                          node.signalQuality === 'fair' ? '🟠' :
                          node.signalQuality === 'weak' ? '🔴' : '⚫';
        
        html += `
            <div class="flex justify-between items-center bg-gray-700/30 p-1 rounded mb-1">
                <div>
                    <span class="font-medium">${node.id}</span>
                    <span class="text-gray-500 ml-1">${signalIcon}</span>
                </div>
                <div class="text-xxs ${statusColor}">${node.ip || 'N/A'}</div>
            </div>
        `;
    });
    ipList.innerHTML = html;
}

function exportNetwork() {
    const networkData = {
        name: "Exported Network",
        timestamp: new Date().toISOString(),
        nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            ip: node.ip,
            mac: node.mac,
            active: node.active,
            signalQuality: node.signalQuality,
            rssi: node.rssi
        })),
        links: window.links || []
    };
    
    const blob = new Blob([JSON.stringify(networkData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-export-${Date.now()}.json`;
    a.click();
    
    alert('✅ Network exported successfully!');
}

function simulateFailure(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    node.active = false;
    node.status = 'offline';
    node.signalQuality = 'no signal';
    node.rssi = -100;
    
    const diagBox = document.getElementById('diagnosticBox');
    const affected = [];
    
    nodes.forEach(n => {
        if (n.id !== nodeId && n.active) {
            const canReachGateway = findPath(n.id, nodes.find(g => g.type === 'gateway' || g.type === 'router')?.id);
            if (!canReachGateway) {
                affected.push(n.id);
            }
        }
    });
    
    diagBox.innerHTML = `
        <div class="p-2 bg-red-900/20 border border-red-500/30 rounded">
            <p class="text-xs text-red-400 font-bold"> NODE FAILED: ${nodeId}</p>
            <p class="text-xxs text-gray-400">${affected.length} devices affected</p>
            ${affected.length > 0 ? `<p class="text-xxs text-yellow-400 mt-1">Rerouting traffic...</p>` : ''}
        </div>
    `;
    
    refreshView();
    updateIPDisplay();
    updatePingDropdowns();
}
// EVENT LISTENERS
document.getElementById('addNodeBtn')?.addEventListener('click', () => {
    const typeSelect = document.getElementById('nodeType');
    if (!typeSelect) return;
    
    const type = typeSelect.value;
    const typeCount = nodes.filter(n => n.type === type).length;
    
    let prefix = 'N';
    if (type === 'gateway') prefix = 'GW';
    else if (type === 'router') prefix = 'RTR';
    else if (type === 'repeater') prefix = 'RPT';
    
    const newNode = {
        id: prefix + (typeCount + 1),
        type: type,
        x: Math.random() * (canvas.width - 200) + 100,
        y: Math.random() * (canvas.height - 200) + 100,
        active: true,
        range: type === 'gateway' ? 150 : type === 'router' ? 140 : type === 'repeater' ? 120 : 100,
        status: 'online',
        rssi: (type === 'gateway' || type === 'router') ? -45 : -45 - Math.random() * 30
    };
    
    nodes.push(newNode);
    assignIPs();
    updatePingDropdowns();
    refreshView();
});

document.getElementById('viewToggle')?.addEventListener('click', function() {
    viewMode = viewMode === 'topology' ? 'coverage' : 'topology';
    this.textContent = viewMode === 'topology' ? 'Switch to Coverage' : 'Switch to Topology';
    refreshView();
});

document.getElementById('pingBtn')?.addEventListener('click', () => {
    const source = document.getElementById('pingSource').value;
    const target = document.getElementById('pingTarget').value;
    
    if (!source || !target) {
        alert('Please select both source and target');
        return;
    }
    
    if (source === target) {
        alert('Source and target cannot be the same');
        return;
    }
    
    sendPing(source, target);
});

document.getElementById('exportIPs')?.addEventListener('click', exportNetwork);

document.getElementById('zoomIn')?.addEventListener('click', () => {
    zoom *= 1.2;
    zoom = Math.min(3, zoom);
    container.style.transform = `scale(${zoom})`;
});

document.getElementById('zoomOut')?.addEventListener('click', () => {
    zoom /= 1.2;
    zoom = Math.max(0.5, zoom);
    container.style.transform = `scale(${zoom})`;
});

document.getElementById('resetView')?.addEventListener('click', () => {
    zoom = 1;
    container.style.transform = `scale(1)`;
});

// File upload handler
document.getElementById('upload')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            nodes = [];
            
            if (data.nodes && Array.isArray(data.nodes)) {
                data.nodes.forEach((node, index) => {
                    let nodeType = node.type ? node.type.toLowerCase() : 'node';
                    
                    const typeMap = {
                        'pc': 'node', 'computer': 'node', 'laptop': 'node',
                        'workstation': 'node', 'desktop': 'node', 'server': 'node',
                        'client': 'node', 'endpoint': 'node', 'host': 'node',
                        'router': 'router', 'modem': 'router', 'gateway': 'gateway',
                        'switch': 'repeater', 'repeater': 'repeater', 'hub': 'repeater',
                        'accesspoint': 'repeater', 'ap': 'repeater', 'extender': 'repeater'
                    };
                    
                    nodeType = typeMap[nodeType] || nodeType;
                    
                    nodes.push({
                        id: node.id,
                        type: nodeType,
                        x: node.x || (100 + Math.random() * 400),
                        y: node.y || (100 + Math.random() * 300),
                        active: true,
                        range: node.range || (nodeType === 'gateway' ? 150 : nodeType === 'router' ? 140 : nodeType === 'repeater' ? 120 : 100),
                        status: 'online',
                        rssi: (nodeType === 'gateway' || nodeType === 'router') ? -45 : -55
                    });
                });
            }
            
            if (data.links && Array.isArray(data.links)) {
                window.links = data.links;
            } else {
                window.links = [];
            }
            
            assignIPs();
            refreshView();
            setTimeout(() => {
                updatePingDropdowns();
            }, 200);
            
            alert(`✅ Imported ${nodes.length} nodes and ${window.links.length} connections!`);
        } catch (err) {
            alert('❌ Error parsing JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// Drag and drop
svg.addEventListener('mousedown', (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    for (let node of nodes) {
        const dist = Math.sqrt((node.x - mouseX) ** 2 + (node.y - mouseY) ** 2);
        if (dist < 15) {
            draggingNode = node;
            break;
        }
    }
});

svg.addEventListener('mousemove', (e) => {
    if (!draggingNode) return;
    const rect = svg.getBoundingClientRect();
    draggingNode.x = e.clientX - rect.left;
    draggingNode.y = e.clientY - rect.top;
    refreshView();
});

svg.addEventListener('mouseup', () => { draggingNode = null; });
svg.addEventListener('mouseleave', () => { draggingNode = null; });

// Mouse coordinates
document.getElementById('canvasContainer')?.addEventListener('mousemove', (e) => {
    const rect = e.target.getBoundingClientRect();
    document.getElementById('mouseX').textContent = Math.round(e.clientX - rect.left);
    document.getElementById('mouseY').textContent = Math.round(e.clientY - rect.top);
});

// Ctrl+Click for node failure
document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') document.body.style.cursor = 'crosshair';
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') document.body.style.cursor = 'default';
});

svg.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const clickedNode = nodes.find(node => {
            const dist = Math.sqrt((node.x - mouseX) ** 2 + (node.y - mouseY) ** 2);
            return dist < 15;
        });
        
        if (clickedNode) {
            simulateFailure(clickedNode.id);
        }
    }
});

// Router scanner
async function loadRealRouters() {
    try {
        const response = await fetch('/api/routers');
        const data = await response.json();
        
        if (data.routers && data.routers.length > 0) {
            const container = document.getElementById('routerDeviceList');
            if (container) {
                container.innerHTML = data.routers.map(router => {
                    let signalClass = '';
                    if (router.signal_strength > -50) signalClass = 'text-green-400';
                    else if (router.signal_strength > -60) signalClass = 'text-lime-400';
                    else if (router.signal_strength > -70) signalClass = 'text-yellow-400';
                    else signalClass = 'text-red-400';
                    
                    const percent = ((router.signal_strength + 90) / 60) * 100;
                    
                    return `
                        <div class="bg-gray-700/30 rounded p-2 mb-2">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-medium">${router.ssid}</span>
                                <span class="text-xxs ${signalClass}">${router.signal_strength} dBm</span>
                            </div>
                            <div class="w-full h-1 bg-gray-600 rounded-full mt-1">
                                <div class="h-full ${signalClass.replace('text', 'bg')}" style="width: ${Math.min(100, percent)}%"></div>
                            </div>
                            <div class="text-xxs text-gray-500 mt-1">Channel: ${router.channel || 'auto'}</div>
                        </div>
                    `;
                }).join('');
                document.getElementById('routerDeviceCount').textContent = data.routers.length;
            }
        }
    } catch (error) {
        console.log('Router API not ready yet');
    }
}

if (document.getElementById('routerDeviceList')) {
    loadRealRouters();
    setInterval(loadRealRouters, 30000);
}
// INITIALIZATION
setTimeout(() => {
    assignIPs();
    setTimeout(() => {
        updatePingDropdowns();
    }, 100);
}, 500);

// Export for dashboard
window.nodes = nodes;
window.refreshView = refreshView;

console.log("✅ Node toggling enabled - Click any node to turn on/off");
console.log("✅ Router color: Orange (#f97316)");