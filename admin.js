const supabaseUrl = 'https://eagvujficirkrlrewtxk.supabase.co';
const supabaseKey = 'eyJhbGci0iJIUzI1NiIsInR5cCI6IkpXVcJ9.eyJpc3Mi0iJzdXBhYmFzZSIsInJIzIi16ImVhZ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Admin Password
const ADMIN_PASSWORD = 'admin123';

// DOM Elements
const boostIGN = document.getElementById('boostIGN');
const boostFromRank = document.getElementById('boostFromRank');
const boostToRank = document.getElementById('boostToRank');
const boostType = document.getElementById('boostType');
const boostPrice = document.getElementById('boostPrice');
const boostNotes = document.getElementById('boostNotes');
const createBoostBtn = document.getElementById('createBoostBtn');
const adminBoostList = document.getElementById('adminBoostList');
const queueRequests = document.getElementById('queueRequests');
const completedList = document.getElementById('completedList');
const logoutBtn = document.getElementById('logoutBtn');
const adminMessage = document.getElementById('adminMessage');

// Stats
const activeBoosts = document.getElementById('activeBoosts');
const totalQueued = document.getElementById('totalQueued');
const completedBoosts = document.getElementById('completedBoosts');
const totalEarnings = document.getElementById('totalEarnings');

// Initialize
async function init() {
    const isAdmin = sessionStorage.getItem('adminLoggedIn');
    if (!isAdmin) {
        promptLogin();
        return;
    }
    
    await loadAdminData();
    await subscribeToUpdates();
}

// Prompt Login
function promptLogin() {
    const password = prompt('Enter admin password:');
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        location.reload();
    } else {
        alert('Wrong password!');
        window.location.href = 'index.html';
    }
}

// Load Admin Data
async function loadAdminData() {
    await loadContracts();
    await loadQueueRequests();
    await loadCompleted();
    await loadStats();
}

// Load Contracts
async function loadContracts() {
    const { data, error } = await supabase
        .from('boost_contracts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading contracts:', error);
        return;
    }

    if (!data || data.length === 0) {
        adminBoostList.innerHTML = '<p class="empty-msg">No active contracts</p>';
        return;
    }

    adminBoostList.innerHTML = data.map(contract => `
        <div class="boost-card">
            <div class="header">
                <span class="player">🎮 ${contract.player_ign}</span>
                <span class="status ${contract.status === 'completed' ? 'completed' : ''}">${contract.status}</span>
            </div>
            <div class="rank-info">
                ${contract.from_rank} <span class="arrow">→</span> ${contract.to_rank}
            </div>
            <div class="rank-info" style="color:#888; font-size:0.8rem;">
                ${contract.boost_type} | 💰 ₱${contract.price}
            </div>
            ${contract.notes ? `<div style="color:#666; font-size:0.8rem;">📝 ${contract.notes}</div>` : ''}
            <div class="actions">
                ${contract.status === 'active' ? 
                    `<button class="btn primary small" onclick="completeContract('${contract.id}')">✅ Complete</button>` : ''}
                <button class="btn danger small" onclick="deleteContract('${contract.id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

// Create Boost Contract
createBoostBtn.addEventListener('click', async () => {
    const ign = boostIGN.value.trim();
    const fromRank = boostFromRank.value;
    const toRank = boostToRank.value;
    const type = boostType.value;
    const price = boostPrice.value;
    const notes = boostNotes.value.trim();

    if (!ign || !fromRank || !toRank || !price) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    const { data, error } = await supabase
        .from('boost_contracts')
        .insert([
            {
                player_ign: ign,
                from_rank: fromRank,
                to_rank: toRank,
                boost_type: type,
                price: parseInt(price),
                notes: notes || '',
                status: 'active',
                created_at: new Date().toISOString()
            }
        ]);

    if (error) {
        showMessage('Error creating contract: ' + error.message, 'error');
        return;
    }

    showMessage(`✅ Boost contract created for ${ign}!`, 'success');
    
    // Clear fields
    boostIGN.value = '';
    boostPrice.value = '';
    boostNotes.value = '';
    
    await loadAdminData();
});

// Complete Contract
async function completeContract(contractId) {
    if (!confirm('Mark this boost as completed?')) return;

    const { error } = await supabase
        .from('boost_contracts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', contractId);

    if (error) {
        showMessage('Error completing contract', 'error');
        return;
    }

    // Mark all queue requests as completed
    await supabase
        .from('queue_requests')
        .update({ status: 'completed' })
        .eq('contract_id', contractId);

    showMessage('✅ Boost marked as completed!', 'success');
    await loadAdminData();
}

// Delete Contract
async function deleteContract(contractId) {
    if (!confirm('Delete this contract?')) return;

    const { error } = await supabase
        .from('boost_contracts')
        .delete()
        .eq('id', contractId);

    if (error) {
        showMessage('Error deleting contract', 'error');
        return;
    }

    showMessage('Contract deleted', 'info');
    await loadAdminData();
}

// Load Queue Requests
async function loadQueueRequests() {
    const { data, error } = await supabase
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
        .eq('status', 'waiting')
        .order('joined_at', { ascending: true });

    if (error) {
        console.error('Error loading queue:', error);
        return;
    }

    if (!data || data.length === 0) {
        queueRequests.innerHTML = '<p class="empty-msg">No pending requests</p>';
        return;
    }

    queueRequests.innerHTML = data.map(item => `
        <div class="queue-item">
            <div>
                <span class="player-name">${item.player_ign}</span>
                <span style="color:#888; font-size:0.8rem; margin-left:10px;">
                    ${item.boost_contracts.from_rank} → ${item.boost_contracts.to_rank}
                </span>
                <span style="color:#888; font-size:0.8rem; margin-left:10px;">
                    💰 ₱${item.boost_contracts.price}
                </span>
            </div>
            <div>
                <span class="time">${new Date(item.joined_at).toLocaleTimeString()}</span>
                <button class="btn success small" onclick="acceptRequest('${item.id}')" style="margin-left:10px;">Accept</button>
            </div>
        </div>
    `).join('');
}

// Accept Queue Request
async function acceptRequest(requestId) {
    const { error } = await supabase
        .from('queue_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

    if (error) {
        showMessage('Error accepting request', 'error');
        return;
    }

    showMessage('✅ Request accepted!', 'success');
    await loadAdminData();
}

// Load Completed Boosts
async function loadCompleted() {
    const { data, error } = await supabase
        .from('boost_contracts')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error loading completed:', error);
        return;
    }

    if (!data || data.length === 0) {
        completedList.innerHTML = '<p class="empty-msg">No completed boosts yet</p>';
        return;
    }

    completedList.innerHTML = data.map(item => `
        <div class="queue-item">
            <div>
                <span class="player-name">${item.player_ign}</span>
                <span style="color:#888; font-size:0.8rem; margin-left:10px;">
                    ${item.from_rank} → ${item.to_rank}
                </span>
            </div>
            <div>
                <span style="color:#00b894;">✅ Completed</span>
                <span class="time">${item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ''}</span>
            </div>
        </div>
    `).join('');
}

// Load Stats
async function loadStats() {
    try {
        // Active boosts
        const { count: active } = await supabase
            .from('boost_contracts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        // Queued requests
        const { count: queued } = await supabase
            .from('queue_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting');

        // Completed boosts
        const { count: completed } = await supabase
            .from('boost_contracts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');

        // Total earnings
        const { data: earningsData } = await supabase
            .from('boost_contracts')
            .select('price')
            .eq('status', 'completed');

        const total = earningsData?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;

        activeBoosts.textContent = active || 0;
        totalQueued.textContent = queued || 0;
        completedBoosts.textContent = completed || 0;
        totalEarnings.textContent = `₱${total}`;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Show Message
function showMessage(msg, type = 'info') {
    adminMessage.textContent = msg;
    adminMessage.className = `message ${type}`;
    setTimeout(() => {
        adminMessage.textContent = '';
        adminMessage.className = 'message';
    }, 5000);
}

// Real-time Subscriptions
function subscribeToUpdates() {
    supabase
        .channel('admin_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'boost_contracts' },
            () => loadAdminData()
        )
        .subscribe();

    supabase
        .channel('queue_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'queue_requests' },
            () => loadAdminData()
        )
        .subscribe();
}

// Logout
logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = 'index.html';
});

// Initialize
init();
