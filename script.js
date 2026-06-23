// ============================================
// CROSSFIRE BOOST QUEUE - USER SIDE
// ============================================

// ✅ FIX: Initialize Supabase correctly
const supabaseUrl = 'https://eagvujficirkrlrewtxk.supabase.co';
const supabaseKey = 'YOUR_ANON_KEY_HERE';  // ← REPLACE WITH YOUR REAL KEY

// ✅ CORRECT: Create supabase client with function
const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Make it globally accessible
window.supabase = supabaseClient;

// State
let currentUser = null;
let userQueueId = null;

// DOM Elements
const boostContracts = document.getElementById('boostContracts');
const liveQueue = document.getElementById('liveQueue');
const userQueueStatus = document.getElementById('userQueueStatus');
const playerIGN = document.getElementById('playerIGN');
const setUserBtn = document.getElementById('setUserBtn');
const currentUserDisplay = document.getElementById('currentUserDisplay');

// Initialize
async function init() {
    console.log('🚀 Initializing app...');
    console.log('🔑 Supabase client:', window.supabase);
    await loadBoostContracts();
    await loadLiveQueue();
    await subscribeToUpdates();
    
    const savedUser = sessionStorage.getItem('crossfire_user');
    if (savedUser) {
        currentUser = savedUser;
        currentUserDisplay.textContent = `👤 ${currentUser}`;
        await loadUserQueueStatus();
    }
    console.log('✅ App initialized');
}

// Set User
setUserBtn.addEventListener('click', async () => {
    const ign = playerIGN.value.trim();
    if (!ign) {
        showMessage('Please enter your IGN', 'error');
        return;
    }
    
    currentUser = ign;
    sessionStorage.setItem('crossfire_user', ign);
    currentUserDisplay.textContent = `👤 ${ign}`;
    playerIGN.value = '';
    await loadUserQueueStatus();
    showMessage(`Welcome ${ign}!`, 'success');
});

// Load Boost Contracts
async function loadBoostContracts() {
    console.log('📡 Loading boost contracts...');
    
    try {
        const { data, error } = await window.supabase
            .from('boost_contracts')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        console.log('📊 Data:', data);
        console.log('❌ Error:', error);

        if (error) {
            console.error('Error loading contracts:', error);
            showMessage('Error loading contracts: ' + error.message, 'error');
            return;
        }

        if (!data || data.length === 0) {
            boostContracts.innerHTML = '<p class="empty-msg">No available boosts right now</p>';
            return;
        }

        boostContracts.innerHTML = data.map(contract => `
            <div class="boost-card">
                <div class="header">
                    <span class="player">🎮 ${contract.player_ign}</span>
                    <span class="status">${contract.boost_type}</span>
                </div>
                <div class="rank-info">
                    ${contract.from_rank} <span class="arrow">→</span> ${contract.to_rank}
                </div>
                <div class="rank-info" style="color:#888; font-size:0.8rem;">
                    💰 ₱${contract.price}
                </div>
                ${contract.notes ? `<div style="color:#666; font-size:0.8rem; margin-top:5px;">📝 ${contract.notes}</div>` : ''}
                <div class="actions">
                    <button class="btn success small" onclick="joinQueue('${contract.id}')">🎯 Join Queue</button>
                </div>
            </div>
        `).join('');
        
        console.log('✅ Contracts loaded successfully!');
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to load contracts', 'error');
    }
}

// Join Queue
async function joinQueue(contractId) {
    if (!currentUser) {
        showMessage('Please set your IGN first!', 'error');
        return;
    }

    try {
        const { data: existing } = await window.supabase
            .from('queue_requests')
            .select('*')
            .eq('contract_id', contractId)
            .eq('player_ign', currentUser)
            .eq('status', 'waiting');

        if (existing && existing.length > 0) {
            showMessage('You are already in this queue!', 'error');
            return;
        }

        const { data, error } = await window.supabase
            .from('queue_requests')
            .insert([
                {
                    contract_id: contractId,
                    player_ign: currentUser,
                    status: 'waiting',
                    joined_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            showMessage('Error joining queue: ' + error.message, 'error');
            return;
        }

        userQueueId = data.id;
        showMessage('✅ You joined the queue!', 'success');
        await loadUserQueueStatus();
        await loadLiveQueue();
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to join queue', 'error');
    }
}

// Load User Queue Status
async function loadUserQueueStatus() {
    if (!currentUser) {
        userQueueStatus.innerHTML = '<p class="empty-msg">Set your IGN to see your queue status</p>';
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('queue_requests')
            .select(`
                *,
                boost_contracts (
                    player_ign,
                    from_rank,
                    to_rank,
                    boost_type,
                    price
                )
            `)
            .eq('player_ign', currentUser)
            .neq('status', 'completed')
            .order('joined_at', { ascending: false });

        if (error) {
            console.error('Error loading user queue:', error);
            return;
        }

        if (!data || data.length === 0) {
            userQueueStatus.innerHTML = '<p class="empty-msg">You are not in any queue</p>';
            return;
        }

        userQueueStatus.innerHTML = data.map(item => `
            <div class="queue-item">
                <div>
                    <span class="player-name">${item.boost_contracts.player_ign}</span>
                    <span style="color:#888; font-size:0.8rem; margin-left:10px;">
                        ${item.boost_contracts.from_rank} → ${item.boost_contracts.to_rank}
                    </span>
                </div>
                <div>
                    <span class="status ${item.status === 'accepted' ? 'completed' : ''}" style="font-size:0.8rem;">
                        ${item.status === 'waiting' ? '⏳ Waiting' : 
                          item.status === 'accepted' ? '✅ Accepted' : 
                          item.status === 'in_progress' ? '🔄 In Progress' : 
                          item.status === 'completed' ? '✅ Completed' : '❌ Cancelled'}
                    </span>
                    ${item.status === 'waiting' ? `<button class="btn danger small" onclick="leaveQueue('${item.id}')" style="margin-left:10px;">Leave</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Leave Queue
async function leaveQueue(queueId) {
    if (!confirm('Are you sure you want to leave this queue?')) return;

    try {
        const { error } = await window.supabase
            .from('queue_requests')
            .update({ status: 'cancelled' })
            .eq('id', queueId);

        if (error) {
            showMessage('Error leaving queue', 'error');
            return;
        }

        showMessage('You left the queue', 'info');
        await loadUserQueueStatus();
        await loadLiveQueue();
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to leave queue', 'error');
    }
}

// Load Live Queue
async function loadLiveQueue() {
    try {
        const { data, error } = await window.supabase
            .from('queue_requests')
            .select(`
                *,
                boost_contracts (
                    player_ign,
                    from_rank,
                    to_rank
                )
            `)
            .eq('status', 'waiting')
            .order('joined_at', { ascending: true });

        if (error) {
            console.error('Error loading live queue:', error);
            return;
        }

        if (!data || data.length === 0) {
            liveQueue.innerHTML = '<p class="empty-msg">No active queues</p>';
            return;
        }

        liveQueue.innerHTML = data.map((item, index) => `
            <div class="queue-item">
                <div>
                    <span style="color:#888; font-size:0.8rem;">#${index + 1}</span>
                    <span class="player-name" style="margin-left:10px;">${item.player_ign}</span>
                    <span style="color:#888; font-size:0.8rem; margin-left:10px;">
                        ${item.boost_contracts.from_rank} → ${item.boost_contracts.to_rank}
                    </span>
                </div>
                <span class="time">${new Date(item.joined_at).toLocaleTimeString()}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Real-time Subscriptions
function subscribeToUpdates() {
    console.log('📡 Setting up real-time subscriptions...');
    
    window.supabase
        .channel('contract_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'boost_contracts' },
            () => loadBoostContracts()
        )
        .subscribe();

    window.supabase
        .channel('queue_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'queue_requests' },
            () => {
                loadLiveQueue();
                if (currentUser) loadUserQueueStatus();
            }
        )
        .subscribe();
    
    console.log('✅ Subscriptions set up');
}

// Show Message
function showMessage(msg, type = 'info') {
    const container = document.querySelector('.user-panel');
    const existing = document.querySelector('.message');
    if (existing) existing.remove();
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = msg;
    container.insertBefore(msgDiv, container.firstChild);
    
    setTimeout(() => msgDiv.remove(), 5000);
}

// Initialize
init();
