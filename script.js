// ============================================
// CROSSFIRE BOOST QUEUE - USER SIDE
// ============================================

const supabaseUrl = 'https://eagvujficirkrlrewtxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZ3Z1amZpaWNya3JscmV3dHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODg1ODAsImV4cCI6MjA5Nzc2NDU4MH0.s1lRcNV-peA0yQBAKWAmhaCh5Z1oLjboBQ_d0r5Uuj8';

const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);
window.supabase = supabaseClient;

let currentUser = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App started');
    loadBoostContracts();
    loadLiveQueue();
    subscribeToUpdates();
    
    const savedUser = sessionStorage.getItem('crossfire_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('currentUserDisplay').textContent = `👤 ${currentUser}`;
        loadUserQueueStatus();
    }
    
    // Set User button
    document.getElementById('setUserBtn').addEventListener('click', function() {
        const ign = document.getElementById('playerIGN').value.trim();
        if (!ign) {
            showMessage('Please enter your IGN', 'error');
            return;
        }
        currentUser = ign;
        sessionStorage.setItem('crossfire_user', ign);
        document.getElementById('currentUserDisplay').textContent = `👤 ${ign}`;
        document.getElementById('playerIGN').value = '';
        loadUserQueueStatus();
        showMessage(`Welcome ${ign}!`, 'success');
    });
});

async function loadBoostContracts() {
    console.log('📡 Loading contracts...');
    
    try {
        const { data, error } = await window.supabase
            .from('boost_contracts')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        console.log('📊 Data:', data);
        console.log('❌ Error:', error);

        const container = document.getElementById('boostContracts');

        if (error) {
            container.innerHTML = `<p class="empty-msg">Error: ${error.message}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = `
                <p class="empty-msg">No available boosts right now</p>
                <p style="color:#666; font-size:0.8rem; text-align:center; margin-top:10px;">
                    💡 Add data to your boost_contracts table in Supabase
                </p>
            `;
            return;
        }

        container.innerHTML = data.map(contract => `
            <div class="boost-card">
                <div class="header">
                    <span class="player">🎮 ${contract.player_ign}</span>
                    <span class="status">${contract.boost_type}</span>
                </div>
                <div class="rank-info">
                    ${contract.from_rank} → ${contract.to_rank}
                </div>
                <div class="rank-info" style="color:#00b894;">
                    💰 ₱${contract.price}
                </div>
                ${contract.notes ? `<div style="color:#666; font-size:0.8rem; margin-top:5px;">📝 ${contract.notes}</div>` : ''}
                <div class="actions" style="margin-top:10px;">
                    <button class="btn success small" onclick="joinQueue('${contract.id}')">🎯 Join Queue</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('boostContracts').innerHTML = `<p class="empty-msg">Error: ${error.message}</p>`;
    }
}

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

        const { error } = await window.supabase
            .from('queue_requests')
            .insert({
                contract_id: contractId,
                player_ign: currentUser,
                status: 'waiting',
                joined_at: new Date().toISOString()
            });

        if (error) {
            showMessage('Error: ' + error.message, 'error');
            return;
        }

        showMessage('✅ You joined the queue!', 'success');
        loadUserQueueStatus();
        loadLiveQueue();
        
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to join queue', 'error');
    }
}

async function loadUserQueueStatus() {
    if (!currentUser) {
        document.getElementById('userQueueStatus').innerHTML = '<p class="empty-msg">Set your IGN first</p>';
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

        const container = document.getElementById('userQueueStatus');

        if (error || !data || data.length === 0) {
            container.innerHTML = '<p class="empty-msg">You are not in any queue</p>';
            return;
        }

        container.innerHTML = data.map(item => `
            <div class="queue-item">
                <div>
                    <span class="player-name">${item.boost_contracts.player_ign}</span>
                    <span style="color:#888; font-size:0.8rem; margin-left:10px;">
                        ${item.boost_contracts.from_rank} → ${item.boost_contracts.to_rank}
                    </span>
                </div>
                <div>
                    <span style="font-size:0.8rem;">
                        ${item.status === 'waiting' ? '⏳ Waiting' : 
                          item.status === 'accepted' ? '✅ Accepted' : 
                          '❌ Cancelled'}
                    </span>
                    ${item.status === 'waiting' ? `<button class="btn danger small" onclick="leaveQueue('${item.id}')" style="margin-left:10px;">Leave</button>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function leaveQueue(queueId) {
    if (!confirm('Leave this queue?')) return;

    try {
        await window.supabase
            .from('queue_requests')
            .update({ status: 'cancelled' })
            .eq('id', queueId);

        showMessage('You left the queue', 'info');
        loadUserQueueStatus();
        loadLiveQueue();
    } catch (error) {
        console.error('Error:', error);
        showMessage('Failed to leave queue', 'error');
    }
}

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

        const container = document.getElementById('liveQueue');

        if (error || !data || data.length === 0) {
            container.innerHTML = '<p class="empty-msg">No active queues</p>';
            return;
        }

        container.innerHTML = data.map((item, index) => `
            <div class="queue-item">
                <div>
                    <span style="color:#888;">#${index + 1}</span>
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

function subscribeToUpdates() {
    window.supabase
        .channel('public')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'boost_contracts' },
            () => loadBoostContracts()
        )
        .subscribe();

    window.supabase
        .channel('queue_public')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'queue_requests' },
            () => {
                loadLiveQueue();
                if (currentUser) loadUserQueueStatus();
            }
        )
        .subscribe();
}

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
