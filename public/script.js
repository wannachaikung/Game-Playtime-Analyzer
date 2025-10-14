document.addEventListener('DOMContentLoaded', () => {
    // --- View Elements ---
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const appView = document.getElementById('app-view');
    const errorContainer = document.getElementById('error-message');

    // --- Form Elements ---
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const settingsForm = document.getElementById('settings-form');

    // --- Buttons and Links ---
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    // --- Dashboards & Settings ---
    const parentDashboard = document.getElementById('parent-dashboard');
    const userInfo = document.getElementById('user-info');
    const discordWebhookUrlInput = document.getElementById('discord-webhook-url');
    const settingsSuccess = document.getElementById('settings-success');
    const settingsError = document.getElementById('settings-error');


    // --- Chart instance ---
    let playtimeChartInstance = null;

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

    // --- Event Listeners ---

    // Toggle between login and register views
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        registerView.style.display = 'block';
        clearErrors();
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerView.style.display = 'none';
        loginView.style.display = 'block';
        clearErrors();
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;

        const body = { username, password, role };

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
            showLoginLink.click(); // Switch to login view

        } catch (error) {
            showError(error.message);
        }
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            // Save user data and show the main app
            sessionStorage.setItem('user', JSON.stringify(data.user));
            initializeApp();

        } catch (error) {
            showError(error.message);
        }
    });
    
    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed:', error);
        }
        sessionStorage.removeItem('user');
        initializeApp();
        // Hide settings form on logout
        document.getElementById('settings-section').style.display = 'none';
    });

    // --- App Initialization ---
    function initializeApp() {
        const user = JSON.parse(sessionStorage.getItem('user'));

        if (user) {
            // User is logged in
            document.getElementById('auth-container').style.display = 'none';
            appView.style.display = 'block';

            userInfo.textContent = `สวัสดี, ${user.username}`;

            if (user.role.toLowerCase() === 'admin') {
                window.location.href = '/admin.html';
                return;
            }

            parentDashboard.style.display = 'block';
            fetchAndDisplayParentChildren();
            loadUserSettings(); // Load user settings
            document.getElementById('settings-section').style.display = 'block';


        } else {
            // User is logged out
            document.getElementById('auth-container').style.display = 'block';
            loginView.style.display = 'block';
            registerView.style.display = 'none';
            appView.style.display = 'none';
        }
    }

    // --- User Settings Logic ---
    async function loadUserSettings() {
        try {
            const response = await fetch('/api/user/settings');
            if (!response.ok) {
                throw new Error('Could not load settings.');
            }
            const settings = await response.json();
            discordWebhookUrlInput.value = settings.discord_webhook_url || '';
        } catch (error) {
            settingsError.textContent = error.message;
        }
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        settingsError.textContent = '';
        settingsSuccess.textContent = '';

        const webhookUrl = discordWebhookUrlInput.value;

        try {
            const response = await fetch('/api/user/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discord_webhook_url: webhookUrl }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save settings.');
            }

            settingsSuccess.textContent = 'บันทึกการตั้งค่าสำเร็จ!';
            setTimeout(() => { settingsSuccess.textContent = ''; }, 3000);

        } catch (error) {
            settingsError.textContent = error.message;
        }
    });


    // --- Parent Dashboard Logic ---
    const parentChildrenTableBody = document.querySelector('#parent-children-table tbody');
    const parentLoader = document.getElementById('parent-loader');
    const parentError = document.getElementById('parent-error');
    const resultsContainer = document.getElementById('parent-results');

    function renderResults(data) {
        resultsContainer.innerHTML = ''; // Clear previous results

        // 1. Summary
        const summary = document.createElement('div');
        summary.className = 'stats-summary';
        summary.innerHTML = `
            <h3>สรุปเวลาเล่นเกม (2 สัปดาห์ล่าสุด)</h3>
            <p><strong>เวลาเล่นทั้งหมด:</strong> ${data.total_playtime_hours} ชั่วโมง (${data.total_playtime_minutes} นาที)</p>
            <p><strong>กำหนดเวลาต่อสัปดาห์:</strong> ${data.limit_hours} ชั่วโมง</p>
            <p><strong>สถานะ:</strong> ${data.is_over_limit ? '<span class="status-over">เกินกำหนด</span>' : '<span class="status-ok">ปกติ</span>'}</p>
        `;
        resultsContainer.appendChild(summary);

        if (!data.games || data.games.length === 0) {
            resultsContainer.innerHTML += '<p>ไม่พบข้อมูลเกมที่เล่นล่าสุด</p>';
            return;
        }

        // 2. Chart
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        const canvas = document.createElement('canvas');
        const canvasId = 'playtime-chart-' + new Date().getTime();
        canvas.id = canvasId;
        chartContainer.appendChild(canvas);
        resultsContainer.appendChild(chartContainer);
        renderPlaytimeChart(data.games, canvasId);

        // 3. Table
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        const table = document.createElement('table');
        table.innerHTML = `
            <caption>รายละเอียดเกมที่เล่น (2 สัปดาห์ล่าสุด)</caption>
            <thead>
                <tr>
                    <th>เกม</th>
                    <th>เวลาเล่น (นาที)</th>
                    <th>เวลาเล่น (ชั่วโมง)</th>
                </tr>
            </thead>
            <tbody>
                ${data.games.map(game => {
                    const iconUrl = game.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg` : '';
                    const playtimeHours = (game.playtime_2weeks / 60).toFixed(2);
                    return `
                        <tr>
                            <td>
                                <a href="https://store.steampowered.com/app/${game.appid}" target="_blank" rel="noopener noreferrer" class="game-link">
                                    ${iconUrl ? `<img src="${iconUrl}" class="game-icon" alt="${game.name || 'N/A'} icon">` : ''} 
                                    ${game.name || 'N/A'}
                                </a>
                            </td>
                            <td>${game.playtime_2weeks || 0}</td>
                            <td>${playtimeHours || 0}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
        resultsContainer.appendChild(tableContainer);
        tableContainer.appendChild(table);
    }

    async function fetchAndDisplayParentChildren() {
        parentLoader.style.display = 'block';
        parentError.textContent = '';
        parentChildrenTableBody.innerHTML = '';

        try {
            const response = await fetch('/api/children');
            if (!response.ok) throw new Error('Failed to fetch children.');
            
            const children = await response.json();
            if (children.length === 0) {
                const row = parentChildrenTableBody.insertRow();
                const cell = row.insertCell(0);
                cell.colSpan = 4;
                cell.innerHTML = `คุณยังไม่ได้เพิ่มข้อมูลบุตรหลาน <a href="/children.html">คลิกที่นี่เพื่อเพิ่ม</a>`;
                cell.style.textAlign = 'center';
            } else {
                children.forEach(child => {
                    const row = parentChildrenTableBody.insertRow();
                    row.dataset.childId = child.id;

                    // Check for saved data immediately while building the row
                    const savedDataJSON = localStorage.getItem(`playtimeResult_${child.id}`);
                    let statusHTML = '-';

                    if (savedDataJSON) {
                        const data = JSON.parse(savedDataJSON);
                        row.classList.add('clickable-row'); // Make row clickable
                        if (data.is_over_limit) {
                            statusHTML = `<span class="status-over">เกินกำหนด</span> (${data.total_playtime_hours} ชม.)`;
                        } else {
                            statusHTML = `<span class="status-ok">ปกติ</span> (${data.total_playtime_hours} ชม.)`;
                        }
                    }

                    row.innerHTML = `
                        <td>${child.child_name}</td>
                        <td>${child.steam_id}</td>
                        <td class="status-cell">${statusHTML}</td>
                        <td><button class="check-now-btn">ตรวจสอบ</button></td>
                    `;
                });
            }
        } catch (error) {
            parentError.textContent = error.message;
        } finally {
            parentLoader.style.display = 'none';
        }
    }

    // Handle clicks on table rows and "Check Now" buttons
    parentChildrenTableBody.addEventListener('click', async (e) => {
        // Handle "Check Now" button click
        if (e.target.classList.contains('check-now-btn')) {
            const button = e.target;
            const row = button.closest('tr');
            const childId = row.dataset.childId;
            const statusCell = row.querySelector('.status-cell');

            button.disabled = true;
            statusCell.innerHTML = '<div class="mini-loader"></div>';

            try {
                const response = await fetch(`/api/check-playtime/${childId}`, { method: 'POST' });
                const data = await response.json();

                if (!response.ok) throw new Error(data.error || 'Check failed');

                if (data.is_over_limit) {
                    statusCell.innerHTML = `<span class="status-over">เกินกำหนด</span> (${data.total_playtime_hours} ชม.)`;
                } else {
                    statusCell.innerHTML = `<span class="status-ok">ปกติ</span> (${data.total_playtime_hours} ชม.)`;
                }
                renderResults(data); // Display detailed results
                
                // Save the successful result to localStorage
                localStorage.setItem(`playtimeResult_${childId}`, JSON.stringify(data));
                row.classList.add('clickable-row'); // Add clickable class after first successful check

            } catch (error) {
                statusCell.textContent = 'Error';
                parentError.textContent = error.message;
            } finally {
                button.disabled = false;
            }
            return; // Stop further processing
        }

        // Handle click on the row itself to show saved results
        const clickedRow = e.target.closest('tr.clickable-row');
        if (clickedRow) {
            const childId = clickedRow.dataset.childId;
            const savedDataJSON = localStorage.getItem(`playtimeResult_${childId}`);
            if (savedDataJSON) {
                const data = JSON.parse(savedDataJSON);
                renderResults(data);
            }
        }
    });


    // --- Utility Functions ---
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }

    function clearErrors() {
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
    }

    // --- Function to Render the Pie Chart ---
    function renderPlaytimeChart(games, canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        if (Chart.getChart(canvasId)) {
            Chart.getChart(canvasId).destroy();
        }

        const labels = games.map(g => g.name);
        const data = games.map(g => g.playtime_2weeks);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'เวลาเล่น (นาที)',
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
                        '#FF9F40', '#E7E9ED', '#8DDF63', '#E46651', '#63B5DF'
                    ],
                    borderColor: '#2a475e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: document.body.classList.contains('dark-mode') ? '#c7d5e0' : '#1b2838'
                        }
                    },
                    title: {
                        display: true,
                        text: 'สัดส่วนเวลาเล่นเกมใน 2 สัปดาห์ล่าสุด',
                        color: document.body.classList.contains('dark-mode') ? '#ffffff' : '#1b2838'
                    }
                }
            }
        });
    }

    // --- Initial Check ---
    initializeApp();
});
