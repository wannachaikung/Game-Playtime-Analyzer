document.addEventListener('DOMContentLoaded', () => {
    const userTableBody = document.querySelector('#users-table tbody');
    const loader = document.getElementById('admin-loader');
    const errorContainer = document.getElementById('admin-error');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const createUserForm = document.getElementById('create-user-form');
    const createUserError = document.getElementById('create-user-error');
    const editUserForm = document.getElementById('edit-user-form');
    const editUserError = document.getElementById('edit-user-error');
    const cancelEditBtn = document.getElementById('cancel-edit');

    // --- Logout Logic (using event delegation) ---
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'admin-logout-btn') {
            try {
                await fetch('/api/logout', { method: 'POST' });
            } catch (error) {
                console.error('Logout failed:', error);
            }
            sessionStorage.removeItem('user');
            window.location.href = '/'; // Redirect to login page
        }
    });

    // --- Theme Switcher Logic ---

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleBtn.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '🌙';
        }
    };

    // On page load, apply saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(defaultTheme);

    // Add click event listener
    themeToggleBtn.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const newTheme = isDarkMode ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // --- Utility Functions ---
    function showError(message, targetElement) {
        targetElement.textContent = message;
        targetElement.style.display = 'block';
    }

    function clearError(targetElement) {
        targetElement.textContent = '';
        targetElement.style.display = 'none';
    }

    // --- Fetch and Display Users ---
    async function fetchUsers() {
        loader.style.display = 'block';
        clearError(errorContainer);

        const userString = sessionStorage.getItem('user');
        if (!userString) {
            showError('คุณต้องเข้าสู่ระบบก่อน', errorContainer);
            loader.style.display = 'none';
            window.location.href = '/';
            return;
        }

        const user = JSON.parse(userString);
        if (user.role !== 'admin') {
            showError('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', errorContainer);
            loader.style.display = 'none';
            setTimeout(() => { window.location.href = '/'; }, 2000);
            return;
        }

        try {
            const response = await fetch('/api/admin/users');
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch users.');
            }
            const users = await response.json();
            userTableBody.innerHTML = '';
            users.forEach(u => {
                const row = userTableBody.insertRow();
                row.innerHTML = `
                    <td>${u.id}</td>
                    <td>${u.username}</td>
                    <td>${u.role}</td>
                    <td>${u.email || 'N/A'}</td>
                    <td>${u.discord_webhook_url || 'N/A'}</td>
                    <td>${u.steam_id || 'N/A'}</td>
                    <td>
                        <button class="btn-edit" data-id="${u.id}">Edit</button>
                        <button class="btn-delete" data-id="${u.id}">Delete</button>
                    </td>
                `;
            });
        } catch (error) {
            showError(error.message, errorContainer);
        } finally {
            loader.style.display = 'none';
        }
    }

    // --- Create User ---
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError(createUserError);

        const username = document.getElementById('create-username').value;
        const password = document.getElementById('create-password').value;
        const role = document.getElementById('create-role').value;
        const email = document.getElementById('create-email').value;
        const discordWebhook = document.getElementById('create-discord-webhook').value;

        if (!username || !password || !role) {
            showError('Please provide username, password, and role.', createUserError);
            return;
        }

        try {
            const response = await fetch('/api/admin/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role, email, discord_webhook_url: discordWebhook }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create user.');
            }
            alert(data.message);
            createUserForm.reset();
            fetchUsers();
        } catch (error) {
            showError(error.message, createUserError);
        }
    });

    // --- Edit and Delete User Logic ---
    userTableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Edit User
        if (target.classList.contains('btn-edit')) {
            const userId = target.dataset.id;
            const row = target.closest('tr');
            const cells = row.querySelectorAll('td');

            document.getElementById('edit-user-id').value = userId;
            document.getElementById('edit-username').value = cells[1].textContent;
            document.getElementById('edit-role').value = cells[2].textContent;
            document.getElementById('edit-email').value = cells[3].textContent === 'N/A' ? '' : cells[3].textContent;
            document.getElementById('edit-discord-webhook').value = cells[4].textContent === 'N/A' ? '' : cells[4].textContent;

            editUserForm.style.display = 'block';
            clearError(editUserError);
        }

        // Delete User
        if (target.classList.contains('btn-delete')) {
            const userId = target.dataset.id;
            if (confirm('Are you sure you want to delete this user?')) {
                try {
                    const response = await fetch(`/api/admin/users/${userId}`, {
                        method: 'DELETE',
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to delete user.');
                    }
                    alert(data.message);
                    fetchUsers();
                } catch (error) {
                    showError(error.message, errorContainer);
                }
            }
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        editUserForm.style.display = 'none';
        editUserForm.reset();
    });

    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError(editUserError);

        const userId = document.getElementById('edit-user-id').value;
        const username = document.getElementById('edit-username').value;
        const role = document.getElementById('edit-role').value;
        const email = document.getElementById('edit-email').value;
        const discordWebhook = document.getElementById('edit-discord-webhook').value;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, role, email, discord_webhook_url: discordWebhook }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update user.');
            }
            alert(data.message);
            editUserForm.style.display = 'none';
            editUserForm.reset();
            fetchUsers();
        } catch (error) {
            showError(error.message, editUserError);
        }
    });

    // --- Fetch and Display Activity Log ---
    async function fetchActivityLog() {
        const activityTableBody = document.querySelector('#activity-table tbody');
        const loader = document.getElementById('activity-loader');
        const errorContainer = document.getElementById('activity-error');

        loader.style.display = 'block';
        errorContainer.textContent = '';

        try {
            const response = await fetch('/api/admin/activity');

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch activity log.');
            }

            const activities = await response.json();

            activityTableBody.innerHTML = ''; // Clear existing rows
            if (activities.length === 0) {
                const row = activityTableBody.insertRow();
                const cell = row.insertCell(0);
                cell.colSpan = 3;
                cell.textContent = 'No parent activity recorded yet.';
                cell.style.textAlign = 'center';
            }
            activities.forEach(act => {
                const row = activityTableBody.insertRow();
                const formattedDate = new Date(act.timestamp).toLocaleString();
                row.innerHTML = `
                    <td>${act.parent_username}</td>
                    <td>${act.checked_steam_id}</td>
                    <td>${formattedDate}</td>
                `;
            });

        } catch (error) {
            errorContainer.textContent = error.message;
        } finally {
            loader.style.display = 'none';
        }
    }

    // --- Initial Load ---
    fetchUsers();
    fetchActivityLog();
});