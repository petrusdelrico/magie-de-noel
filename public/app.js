// --- State Management ---
let currentUser = null;
let currentGroup = null; // Groupe de l'utilisateur courant (ou null)
let currentEditTarget = null; // Membre du groupe en cours d'édition (par défaut = currentUser)
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

const groupSwitcher = document.getElementById('group-switcher');
const myListTitle = document.getElementById('my-list-title');
const exportBtn = document.getElementById('export-btn');

/** Affiche le bouton d'export uniquement pour l'utilisateur "Pierre" */
function updateExportBtn() {
    if (currentUser === 'Pierre') {
        exportBtn.style.display = 'inline-flex';
    } else {
        exportBtn.style.display = 'none';
    }
}

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
        // Charger la liste de currentEditTarget (pas currentUser)
        const targetUser = currentEditTarget || currentUser;
        const res = await fetch(`${API_BASE}/users/${targetUser}/wishes`);
        if (!res.ok) throw new Error('Erreur réseau');
        const data = await res.json();
        const myWishes = data.wishes || [];

        // Mettre à jour le titre
        if (currentEditTarget && currentEditTarget !== currentUser) {
            myListTitle.textContent = `Liste de ${currentEditTarget}`;
        } else {
            myListTitle.textContent = 'Ma Liste de Souhaits';
        }

        myWishesUl.innerHTML = '';

        if (myWishes.length === 0) {
            myWishesUl.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-gift"></i>
                    <p>Cette liste est vide. Ajoutez votre premier souhait !</p>
                </div>
            `;
            return;
        }

        myWishes.forEach((wish, index) => {
            const li = document.createElement('li');
            li.className = 'wish-item';

            // Badge souhait commun
            let sharedBadge = '';
            if (wish.sharedWith) {
                sharedBadge = `<span class="shared-badge"><i class="ph-fill ph-users"></i> Commun avec ${wish.sharedWith}</span>`;
            } else if (wish.sharedFrom) {
                sharedBadge = `<span class="shared-badge"><i class="ph-fill ph-users"></i> Commun avec ${wish.sharedFrom}</span>`;
            }

            // Badge "Ajouté par" si le souhait vient d'un autre membre du groupe
            let addedByBadge = '';
            if (wish.addedBy && wish.addedBy !== currentUser) {
                addedByBadge = `<span class="added-by-badge"><i class="ph-fill ph-pencil"></i> Ajouté par ${wish.addedBy}</span>`;
            }

            // Métadonnées (URL et commentaire)
            let wishMetaHtml = '';
            if (wish.url || wish.comment) {
                wishMetaHtml = '<div class="wish-meta">';
                if (wish.url) {
                    wishMetaHtml += `<a href="${wish.url}" target="_blank" rel="noopener noreferrer" class="wish-url"><i class="ph ph-link"></i> Voir le lien</a>`;
                }
                if (wish.comment) {
                    wishMetaHtml += `<div class="wish-comment">${wish.comment}</div>`;
                }
                wishMetaHtml += '</div>';
            }

            // Badge "réservé" — visible par le propriétaire
            const isReserved = !!wish.reservedBy;
            let reservedBadge = '';
            if (isReserved) {
                reservedBadge = `<span class="reserved-badge"><i class="ph-fill ph-lock-key"></i> Réservé</span>`;
            }

            // Bouton partager (uniquement si pas encore partagé et pas réservé)
            const shareBtn = (!wish.sharedWith && !wish.sharedFrom && !isReserved)
                ? `<button class="icon-btn" onclick="openShareModal(${index})" title="Souhait commun" style="color: #f59e0b;">
                       <i class="ph ph-users"></i>
                   </button>`
                : '';

            li.innerHTML = `
                <div class="wish-content" style="flex-direction: column; align-items: flex-start; gap: 0.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="ph-fill ph-gift wish-icon" style="${isReserved ? 'color: var(--text-muted);' : ''}"></i>
                        <span style="${isReserved ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${wish.name}</span>
                    </div>
                    ${reservedBadge}
                    ${sharedBadge}
                    ${addedByBadge}
                    ${wishMetaHtml}
                </div>
                <div style="display: flex; gap: 0.25rem; align-items: center;">
                    ${shareBtn}
                    <button class="icon-btn delete-btn" onclick="deleteWish(${index})" title="Supprimer">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
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

                // Badge souhait commun visible par l'acheteur
                let sharedBadgeOther = '';
                if (wish.sharedWith) {
                    sharedBadgeOther = `<span class="shared-badge"><i class="ph-fill ph-users"></i> Aussi pour ${wish.sharedWith}</span>`;
                } else if (wish.sharedFrom) {
                    sharedBadgeOther = `<span class="shared-badge"><i class="ph-fill ph-users"></i> Aussi pour ${wish.sharedFrom}</span>`;
                }

                // Métadonnées (URL et commentaire)
                let wishMetaHtmlOther = '';
                if (wish.url || wish.comment) {
                    wishMetaHtmlOther = '<div class="wish-meta">';
                    if (wish.url) {
                        wishMetaHtmlOther += `<a href="${wish.url}" target="_blank" rel="noopener noreferrer" class="wish-url"><i class="ph ph-link"></i> Voir le lien</a>`;
                    }
                    if (wish.comment) {
                        wishMetaHtmlOther += `<div class="wish-comment">${wish.comment}</div>`;
                    }
                    wishMetaHtmlOther += '</div>';
                }

                li.innerHTML = `
                    <div class="wish-content" style="flex-direction: column; align-items: flex-start; gap: 0.2rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="ph-fill ph-star wish-icon" style="color: ${wish.reservedBy ? 'var(--text-muted)' : 'var(--accent)'};\"></i>
                            <span style="${wish.reservedBy ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${wish.name}</span>
                        </div>
                        ${sharedBadgeOther}
                        ${wishMetaHtmlOther}
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
        const targetUser = currentEditTarget || currentUser;
        const res = await fetch(`${API_BASE}/users/${targetUser}/wishes/${index}`, {
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

// Exposer renderOtherList pour les tests Playwright (page.evaluate)
window.renderOtherList = renderOtherList;

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

// --- Souhait Commun ---

const shareModal = document.getElementById('share-modal');
const shareForm = document.getElementById('share-form');
const sharePartnerSelect = document.getElementById('share-partner-select');
const shareSubmitBtn = document.getElementById('share-submit-btn');
const shareCancelBtn = document.getElementById('share-cancel-btn');

let pendingShareIndex = null; // index du souhait en attente de partage

window.openShareModal = async function (wishIndex) {
    pendingShareIndex = wishIndex;

    // Réinitialiser le select
    sharePartnerSelect.innerHTML = '';
    shareSubmitBtn.disabled = true;

    shareModal.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/users`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        // Exclure le propriétaire du souhait (pas forcément l'utilisateur connecté)
        const wishOwner = currentEditTarget || currentUser;
        const others = (data.users || []).filter(u => u !== wishOwner);

        if (others.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Aucun autre membre disponible';
            opt.disabled = true;
            opt.selected = true;
            sharePartnerSelect.appendChild(opt);
            // bouton reste désactivé
        } else {
            // Option placeholder non sélectionnable
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '— Choisir un membre —';
            placeholder.disabled = true;
            placeholder.selected = true;
            sharePartnerSelect.appendChild(placeholder);

            others.forEach(user => {
                const opt = document.createElement('option');
                opt.value = user;
                opt.textContent = user;
                sharePartnerSelect.appendChild(opt);
            });

            shareSubmitBtn.disabled = false;
        }
    } catch {
        showToast("Impossible de charger la liste des membres.");
        closeShareModal();
    }
};

function closeShareModal() {
    shareModal.classList.add('hidden');
    pendingShareIndex = null;
}

shareCancelBtn.addEventListener('click', closeShareModal);

// Fermer en cliquant sur l'overlay
shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) closeShareModal();
});

// Désactiver le bouton si on revient sur le placeholder
sharePartnerSelect.addEventListener('change', () => {
    shareSubmitBtn.disabled = !sharePartnerSelect.value;
});

shareForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const partner = sharePartnerSelect.value;
    if (!partner || pendingShareIndex === null) return;

    try {
        const wishOwner = currentEditTarget || currentUser;
        const res = await fetch(`${API_BASE}/users/${wishOwner}/wishes/${pendingShareIndex}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sharedWith: partner })
        });

        const data = await res.json();
        if (res.ok) {
            closeShareModal();
            renderMyList();
            showToast(`Souhait commun créé avec ${data.wish.sharedWith} !`);
        } else {
            showToast(data.error || "Erreur lors du partage.");
        }
    } catch (err) {
        showToast("Erreur réseau.");
    }
});

// --- Groupes Familiaux ---

async function initializeGroupSwitcher() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${API_BASE}/users/${currentUser}/group`);
        if (!res.ok) return;
        const data = await res.json();
        currentGroup = data.group;

        if (!currentGroup) {
            groupSwitcher.classList.add('hidden');
            return;
        }

        // Afficher le group-switcher
        groupSwitcher.classList.remove('hidden');
        groupSwitcher.innerHTML = '';

        // Créer un bouton par membre du groupe
        currentGroup.members.forEach(member => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = member === currentUser ? `${member} (moi)` : member;
            btn.className = member === currentUser ? 'active' : '';

            btn.addEventListener('click', () => {
                // Mettre à jour currentEditTarget
                currentEditTarget = member;
                // Mettre à jour l'UI
                groupSwitcher.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Rafraîchir la liste
                renderMyList();
            });

            groupSwitcher.appendChild(btn);
        });

        // Initialiser currentEditTarget
        currentEditTarget = currentUser;
    } catch (err) {
        console.error('Erreur chargement groupe:', err);
        currentGroup = null;
    }
}

// --- Authentification ---

/**
 * Calcule le SHA-256 d'une chaîne via l'API Web Crypto (natif navigateur).
 * @param {string} message
 * @returns {Promise<string>} Hash hexadécimal
 */
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retourne le timestamp en ms arrondi aux 10 dernières minutes.
 * Ex : 14h23 → 14h20, 14h37 → 14h30
 * @returns {number}
 */
function roundedTimestamp() {
    const TEN_MINUTES = 10 * 60 * 1000;
    return Math.floor(Date.now() / TEN_MINUTES) * TEN_MINUTES;
}

/**
 * Construit le token d'authentification :
 *   sha256( sha256(password) + roundedTimestamp )
 * Le sha256(password) est calculé d'abord (côté client),
 * puis concaténé au timestamp arrondi avant un second hash.
 * @param {string} password Mot de passe en clair saisi par l'utilisateur
 * @returns {Promise<string>} Token hexadécimal
 */
async function buildAuthToken(password) {
    const passwordHash = await sha256(password);
    const timestamp = String(roundedTimestamp());
    return sha256(passwordHash + timestamp);
}

// --- Event Listeners ---

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const passwordInput = document.getElementById('password-input');
    const password = passwordInput.value;

    if (username && password) {
        try {
            const token = await buildAuthToken(password);
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, token })
            });

            if (res.ok) {
                const data = await res.json();
                currentUser = data.username;
                currentUserDisplay.textContent = currentUser;
                updateExportBtn();

                // Switch Views
                loginView.classList.remove('active');
                setTimeout(() => {
                    loginView.classList.add('hidden');
                    dashboardView.classList.remove('hidden');
                    setTimeout(async () => {
                        dashboardView.classList.add('active');
                        await initializeGroupSwitcher();
                        renderMyList();
                    }, 50);
                }, 400); // match transition duration

                usernameInput.value = '';
                passwordInput.value = '';
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.error || "Erreur de connexion.");
                passwordInput.value = '';
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
    currentGroup = null;
    currentEditTarget = null;
    updateExportBtn();

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
        
        // Reset group switcher
        groupSwitcher.classList.add('hidden');
        groupSwitcher.innerHTML = '';
    }, 400);
});


addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = itemNameInput.value.trim();
    const itemUrl = document.getElementById('item-url').value.trim();
    const itemComment = document.getElementById('item-comment').value.trim();
    const targetUser = currentEditTarget || currentUser;

    if (item && currentUser) {
        try {
            const body = { item };
            
            // Ajouter les champs optionnels s'ils sont fournis
            if (itemUrl) body.url = itemUrl;
            if (itemComment) body.comment = itemComment;
            
            // Si on édite quelqu'un d'autre, ajouter addedBy
            if (targetUser !== currentUser) {
                body.addedBy = currentUser;
            }

            const res = await fetch(`${API_BASE}/users/${targetUser}/wishes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                // Réinitialiser tous les champs
                itemNameInput.value = '';
                document.getElementById('item-url').value = '';
                document.getElementById('item-comment').value = '';
                renderMyList();
                showToast(targetUser === currentUser ? 'Ajouté à votre liste !' : `Ajouté à la liste de ${targetUser} !`);
            }
        } catch (err) {
            showToast("Impossible d'ajouter le souhait");
        }
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
