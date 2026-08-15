// --- State Management ---
let currentUser = null;
const API_BASE = '/api';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');

const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const currentUserDisplay = document.getElementById('current-user-display');
const logoutBtn = document.getElementById('logout-btn');

const myListArea = document.getElementById('my-list-area');
const otherListArea = document.getElementById('other-list-area');

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

const addItemForm = document.getElementById('add-item-form');
const itemNameInput = document.getElementById('item-name');
const myWishesUl = document.getElementById('my-wishes');

const otherUserTitle = document.getElementById('other-user-title');
const otherWishesUl = document.getElementById('other-wishes');
const backToMyListBtn = document.getElementById('back-to-my-list');
const otherEmptyState = document.getElementById('other-empty-state');

const showAllUsersBtn = document.getElementById('show-all-users-btn');
const allUsersArea = document.getElementById('all-users-area');
const directoryList = document.getElementById('directory-list');
const backToDashboardBtn = document.getElementById('back-to-dashboard-from-directory');

const myReservationsBtn = document.getElementById('my-reservations-btn');
const myReservationsArea = document.getElementById('my-reservations-area');
const reservationsList = document.getElementById('reservations-list');
const backToDashboardFromResBtn = document.getElementById('back-to-dashboard-from-reservations');

const toast = document.getElementById('toast');

// --- Functions ---

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function renderMyList() {
    try {
        const res = await fetch(`${API_BASE}/users/${currentUser}/wishes`);
        if (!res.ok) throw new Error('Erreur réseau');
        const data = await res.json();
        const myWishes = data.wishes || [];

        myWishesUl.innerHTML = '';

        if (myWishes.length === 0) {
            myWishesUl.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-gift"></i>
                    <p>Votre liste est vide. Ajoutez votre premier souhait !</p>
                </div>
            `;
            return;
        }

        myWishes.forEach((wish, index) => {
            const li = document.createElement('li');
            li.className = 'wish-item';
            li.innerHTML = `
                <div class="wish-content">
                    <i class="ph-fill ph-gift wish-icon"></i>
                    <span>${wish.name}</span>
                </div>
                <button class="icon-btn delete-btn" onclick="deleteWish(${index})" title="Supprimer">
                    <i class="ph ph-trash"></i>
                </button>
            `;
            myWishesUl.appendChild(li);
        });
    } catch (err) {
        showToast("Erreur lors du chargement de votre liste.");
        console.error(err);
    }
}

async function renderOtherList(username) {
    try {
        const res = await fetch(`${API_BASE}/users/${username}/wishes`);

        if (res.status === 404) {
            showToast(`L'utilisateur "${username}" n'a pas encore de liste.`);
            return;
        }

        const data = await res.json();
        const userKey = data.username;
        const theirWishes = data.wishes || [];

        otherUserTitle.textContent = `Liste de ${userKey}`;
        otherWishesUl.innerHTML = '';

        if (theirWishes.length === 0) {
            otherEmptyState.classList.remove('hidden');
        } else {
            otherEmptyState.classList.add('hidden');
            theirWishes.forEach((wish, index) => {
                const li = document.createElement('li');
                li.className = 'wish-item';

                let actionHtml = '';
                if (!wish.reservedBy) {
                    actionHtml = `<button class="secondary-btn" style="padding: 0.5rem 1rem; font-size: 0.9rem;" onclick="reserveWish('${userKey}', ${index})">Réserver</button>`;
                } else if (wish.reservedBy === currentUser) {
                    actionHtml = `<button class="secondary-btn" style="padding: 0.5rem 1rem; font-size: 0.9rem; border-color: var(--primary); color: var(--primary);" onclick="unreserveWish('${userKey}', ${index})">Annuler réservation</button>`;
                } else {
                    actionHtml = `<span style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;"><i class="ph-fill ph-lock-key"></i> Déjà réservé</span>`;
                }

                li.innerHTML = `
                    <div class="wish-content">
                        <i class="ph-fill ph-star wish-icon" style="color: ${wish.reservedBy ? 'var(--text-muted)' : 'var(--accent)'};"></i>
                        <span style="${wish.reservedBy ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${wish.name}</span>
                    </div>
                    <div class="wish-actions">
                        ${actionHtml}
                    </div>
                `;
                otherWishesUl.appendChild(li);
            });
        }

        // Switch view
        myListArea.classList.add('hidden');
        myListArea.classList.remove('active');
        allUsersArea.classList.remove('active');
        allUsersArea.classList.add('hidden');

        otherListArea.classList.remove('hidden');
        setTimeout(() => otherListArea.classList.add('active'), 10);
    } catch (err) {
        showToast("Impossible de contacter le serveur.");
        console.error(err);
    }
}

async function renderDirectory() {
    try {
        const res = await fetch(`${API_BASE}/users`);
        if (!res.ok) throw new Error('Erreur serveur');
        const data = await res.json();

        directoryList.innerHTML = '';
        const otherUsers = (data.users || []).filter(u => u !== currentUser);

        if (otherUsers.length === 0) {
            directoryList.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-users"></i>
                    <p>Aucun autre utilisateur pour le moment.</p>
                </div>
            `;
        } else {
            otherUsers.forEach(user => {
                const li = document.createElement('li');
                li.className = 'wish-item';
                li.style.cursor = 'pointer';
                li.innerHTML = `
                    <div class="wish-content">
                        <i class="ph-fill ph-user wish-icon" style="color: var(--text-muted)"></i>
                        <span>${user}</span>
                    </div>
                    <i class="ph ph-caret-right" style="color: var(--text-muted)"></i>
                `;
                li.onclick = () => {
                    allUsersArea.classList.remove('active');
                    setTimeout(() => {
                        allUsersArea.classList.add('hidden');
                        renderOtherList(user);
                    }, 400);
                };
                directoryList.appendChild(li);
            });
        }

        // Switch view
        myListArea.classList.add('hidden');
        myListArea.classList.remove('active');
        otherListArea.classList.add('hidden');
        otherListArea.classList.remove('active');
        myReservationsArea.classList.add('hidden');
        myReservationsArea.classList.remove('active');

        allUsersArea.classList.remove('hidden');
        setTimeout(() => allUsersArea.classList.add('active'), 10);
    } catch (err) {
        showToast("Erreur lors du chargement de l'annuaire.");
    }
}

async function renderMyReservations() {
    try {
        const res = await fetch(`${API_BASE}/users/${currentUser}/reservations`);
        if (!res.ok) throw new Error('Erreur');
        const data = await res.json();

        reservationsList.innerHTML = '';
        const reservations = data.reservations || [];

        if (reservations.length === 0) {
            reservationsList.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-gift"></i>
                    <p>Vous n'avez encore rien réservé.</p>
                </div>
            `;
        } else {
            reservations.forEach(resItem => {
                const li = document.createElement('li');
                li.className = 'wish-item';
                li.innerHTML = `
                    <div class="wish-content" style="flex-direction: column; align-items: flex-start; gap: 0.2rem;">
                        <span><i class="ph-fill ph-gift" style="color: var(--primary)"></i> <strong>${resItem.wish.name}</strong></span>
                        <span style="font-size: 0.9rem; color: var(--text-muted)">Pour : ${resItem.listOwner}</span>
                    </div>
                    <button class="secondary-btn" style="padding: 0.5rem; font-size: 0.9rem;" onclick="unreserveWishFromMyReservations('${resItem.listOwner}', ${resItem.wishIndex})">Annuler</button>
                `;
                reservationsList.appendChild(li);
            });
        }

        // Switch view
        myListArea.classList.add('hidden');
        myListArea.classList.remove('active');
        allUsersArea.classList.add('hidden');
        allUsersArea.classList.remove('active');
        otherListArea.classList.add('hidden');
        otherListArea.classList.remove('active');

        myReservationsArea.classList.remove('hidden');
        setTimeout(() => myReservationsArea.classList.add('active'), 10);
    } catch (err) {
        showToast("Erreur lors du chargement des réservations.");
    }
}

// Global functions for inline onclick
window.deleteWish = async function (index) {
    try {
        const res = await fetch(`${API_BASE}/users/${currentUser}/wishes/${index}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            renderMyList();
            showToast('Souhait supprimé');
        }
    } catch (err) {
        showToast("Erreur lors de la suppression.");
    }
}

window.reserveWish = async function (listOwner, wishIndex) {
    try {
        const res = await fetch(`${API_BASE}/users/${listOwner}/wishes/${wishIndex}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserveBy: currentUser, action: 'reserve' })
        });

        if (res.ok) {
            renderOtherList(listOwner); // refresh the list
            showToast('Cadeau réservé !');
        } else {
            const data = await res.json();
            showToast(data.error || "Erreur de réservation");
        }
    } catch (err) {
        showToast("Erreur réseau");
    }
}

window.unreserveWish = async function (listOwner, wishIndex) {
    try {
        const res = await fetch(`${API_BASE}/users/${listOwner}/wishes/${wishIndex}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserveBy: currentUser, action: 'unreserve' })
        });

        if (res.ok) {
            renderOtherList(listOwner); // refresh the list
            showToast('Réservation annulée');
        }
    } catch (err) {
        showToast("Erreur réseau");
    }
}

window.unreserveWishFromMyReservations = async function (listOwner, wishIndex) {
    try {
        const res = await fetch(`${API_BASE}/users/${listOwner}/wishes/${wishIndex}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserveBy: currentUser, action: 'unreserve' })
        });

        if (res.ok) {
            renderMyReservations(); // refresh the reservations list
            showToast('Réservation annulée');
        }
    } catch (err) {
        showToast("Erreur réseau");
    }
}

// --- Event Listeners ---

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) {
        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            if (res.ok) {
                const data = await res.json();
                currentUser = data.username;
                currentUserDisplay.textContent = currentUser;

                // Switch Views
                loginView.classList.remove('active');
                setTimeout(() => {
                    loginView.classList.add('hidden');
                    dashboardView.classList.remove('hidden');
                    setTimeout(() => dashboardView.classList.add('active'), 50);
                    renderMyList();
                }, 400); // match transition duration

                usernameInput.value = '';
            } else {
                showToast("Serveur hors ligne ou erreur");
            }
        } catch (err) {
            showToast("Impossible de se connecter au serveur backend");
            console.error(err);
        }
    }
});

logoutBtn.addEventListener('submit', (e) => e.preventDefault());
logoutBtn.addEventListener('click', () => {
    currentUser = null;

    // Switch Views back
    dashboardView.classList.remove('active');
    setTimeout(() => {
        dashboardView.classList.add('hidden');
        loginView.classList.remove('hidden');
        setTimeout(() => loginView.classList.add('active'), 50);

        // Reset sub views
        otherListArea.classList.add('hidden');
        allUsersArea.classList.add('hidden');
        myReservationsArea.classList.add('hidden');
        myListArea.classList.remove('hidden');
        myListArea.classList.add('active');
    }, 400);
});


addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = itemNameInput.value.trim();
    if (item && currentUser) {
        try {
            const res = await fetch(`${API_BASE}/users/${currentUser}/wishes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item })
            });

            if (res.ok) {
                itemNameInput.value = '';
                renderMyList();
                showToast('Ajouté à votre liste !');
            }
        } catch (err) {
            showToast("Impossible d'ajouter le souhait");
        }
    }
});

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
        if (query.toLowerCase() === currentUser.toLowerCase()) {
            backToMyListBtn.click();
        } else {
            renderOtherList(query);
        }
        searchInput.value = '';
    }
});

backToMyListBtn.addEventListener('click', () => {
    otherListArea.classList.remove('active');
    setTimeout(() => {
        otherListArea.classList.add('hidden');
        myListArea.classList.remove('hidden');
        setTimeout(() => myListArea.classList.add('active'), 50);
        renderMyList(); // Refresh my list just in case
    }, 400);
});

showAllUsersBtn.addEventListener('click', () => {
    renderDirectory();
});

backToDashboardBtn.addEventListener('click', () => {
    allUsersArea.classList.remove('active');
    setTimeout(() => {
        allUsersArea.classList.add('hidden');
        myListArea.classList.remove('hidden');
        setTimeout(() => myListArea.classList.add('active'), 50);
        renderMyList();
    }, 400);
});

myReservationsBtn.addEventListener('click', () => {
    renderMyReservations();
});

backToDashboardFromResBtn.addEventListener('click', () => {
    myReservationsArea.classList.remove('active');
    setTimeout(() => {
        myReservationsArea.classList.add('hidden');
        myListArea.classList.remove('hidden');
        setTimeout(() => myListArea.classList.add('active'), 50);
        renderMyList();
    }, 400);
});
