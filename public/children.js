document.addEventListener('DOMContentLoaded', () => {
    const childrenTableBody = document.querySelector('#children-table tbody');
    const addChildForm = document.getElementById('add-child-form');
    const loader = document.getElementById('children-loader');
    const formError = document.getElementById('form-error');
    const listError = document.getElementById('children-list-error');

    // --- Theme Switcher Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleBtn.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '🌙';
        }
    };
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(defaultTheme);
    themeToggleBtn.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const newTheme = isDarkMode ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // --- Modal Elements ---
    const editModal = document.getElementById('edit-child-modal');
    const closeBtn = document.querySelector('.close-btn');
    const editForm = document.getElementById('edit-child-form');
    const editFormError = document.getElementById('edit-form-error');

    // --- Fetch and display children on page load ---
    async function fetchChildren() {
        loader.style.display = 'block';
        listError.textContent = '';
        childrenTableBody.innerHTML = '';

        try {
            const response = await fetch('/api/children', { credentials: 'include' });
            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/'; // Redirect to login if not authenticated
                    return;
                }
                throw new Error('Failed to fetch children data.');
            }
            const children = await response.json();
            displayChildren(children);
        } catch (error) {
            listError.textContent = error.message;
        } finally {
            loader.style.display = 'none';
        }
    }

    function displayChildren(children) {
        childrenTableBody.innerHTML = ''; // Clear the table
        if (children.length === 0) {
            const row = childrenTableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 4;
            cell.textContent = 'คุณยังไม่ได้เพิ่มข้อมูลบุตรหลาน';
            cell.style.textAlign = 'center';
            return;
        }

        children.forEach(child => {
            const row = childrenTableBody.insertRow();
            row.innerHTML = `
                <td>${child.child_name}</td>
                <td>${child.steam_id}</td>
                <td>${child.playtime_limit_hours}</td>
                <td>
                    <button class="btn-edit" data-id="${child.id}" data-name="${child.child_name}" data-steamid="${child.steam_id}" data-limit="${child.playtime_limit_hours}">แก้ไข</button>
                    <button class="btn-danger btn-delete" data-id="${child.id}">ลบ</button>
                </td>
            `;
        });
    }

    // --- Handle form submission for adding a new child ---
    addChildForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.textContent = '';

        const childName = document.getElementById('child-name').value;
        const steamId = document.getElementById('steam-id').value;
        const playtimeLimit = document.getElementById('playtime-limit').value;

        try {
            const response = await fetch('/api/children', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // <-- ADD THIS LINE
                body: JSON.stringify({
                    child_name: childName,
                    steam_id: steamId,
                    playtime_limit_hours: parseInt(playtimeLimit, 10)
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Could not add child.');
            }

            addChildForm.reset();
            fetchChildren(); // Refresh the list

        } catch (error) {
            formError.textContent = error.message;
        }
    });

    // --- Event Delegation for Edit and Delete buttons ---
    childrenTableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // --- Delete Logic ---
        if (target.classList.contains('btn-delete')) {
            const childId = target.dataset.id;
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบุตรหลานคนนี้?')) {
                try {
                    const response = await fetch(`/api/children/${childId}`, {
                        method: 'DELETE',
                        credentials: 'include',
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'ไม่สามารถลบข้อมูลได้');
                    }
                    fetchChildren(); // Refresh list
                } catch (error) {
                    listError.textContent = error.message;
                    listError.style.display = 'block';
                }
            }
        }

        // --- Edit Logic (Open Modal) ---
        if (target.classList.contains('btn-edit')) {
            editFormError.style.display = 'none';
            document.getElementById('edit-child-id').value = target.dataset.id;
            document.getElementById('edit-child-name').value = target.dataset.name;
            document.getElementById('edit-steam-id').value = target.dataset.steamid;
            document.getElementById('edit-playtime-limit').value = target.dataset.limit;
            editModal.style.display = 'flex';
        }
    });

    // --- Modal Close Logic ---
    closeBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target == editModal) {
            editModal.style.display = 'none';
        }
    });

    // --- Handle Edit Form Submission ---
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        editFormError.textContent = '';
        editFormError.style.display = 'none';

        const childId = document.getElementById('edit-child-id').value;
        const childName = document.getElementById('edit-child-name').value;
        const steamId = document.getElementById('edit-steam-id').value;
        const playtimeLimit = document.getElementById('edit-playtime-limit').value;

        try {
            const response = await fetch(`/api/children/${childId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // <-- ADD THIS LINE
                body: JSON.stringify({
                    child_name: childName,
                    steam_id: steamId,
                    playtime_limit_hours: parseInt(playtimeLimit, 10)
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'ไม่สามารถอัปเดตข้อมูลได้');
            }
            editModal.style.display = 'none';
            fetchChildren();
        } catch (error) {
            editFormError.textContent = error.message;
            editFormError.style.display = 'block';
        }
    });

    // --- Initial Load ---
    fetchChildren();
});
