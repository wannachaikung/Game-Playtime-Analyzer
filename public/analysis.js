document.addEventListener('DOMContentLoaded', () => {
    // --- Basic Elements ---
    const loader = document.getElementById('analysis-loader');
    const errorDiv = document.getElementById('analysis-error');
    const dashboard = document.getElementById('dashboard');
    const analysisTitle = document.getElementById('analysis-title');

    // --- Theme Switcher Logic (Copied from children.js for consistency) ---
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

    // --- Get Child Info from URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const childId = urlParams.get('child_id');
    const childName = urlParams.get('name');

    if (!childId || !childName) {
        errorDiv.textContent = 'ไม่พบข้อมูลบุตรหลานที่ต้องการวิเคราะห์';
        return;
    }

    analysisTitle.textContent = `ผลการวิเคราะห์ของ: ${childName}`;

    // --- MOCK DATA ---
    // In a real scenario, you would fetch this from your API: /api/children/${childId}/playtime
    async function getPlaytimeData(childId) {
        console.log(`Fetching real data for childId: ${childId}`);
        try {
            const response = await fetch(`/api/children/${childId}/playtime_sessions`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Network response was not ok (${response.status})`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch playtime data:', error);
            // Re-throw the error to be caught by the main execution block
            throw error;
        }
    }

    // --- ANALYSIS FUNCTIONS ---

    function analyzeData(sessions) {
        let totalPlaytimeHours = 0;
        let maxSessionMinutes = 0;
        let lateNightHours = 0;
        let behaviorScore = 0;

        const timeOfDayData = {
            'Morning (6-12)': { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 },
            'Afternoon (12-18)': { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 },
            'Evening (18-22)': { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 },
            'Night (22-6)': { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 },
        };
        const dayMapping = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        sessions.forEach(session => {
            const start = new Date(session.start_time);
            const end = new Date(session.end_time);
            const durationMinutes = (end - start) / (1000 * 60);

            if (durationMinutes <= 0) return;

            totalPlaytimeHours += durationMinutes / 60;
            if (durationMinutes > maxSessionMinutes) {
                maxSessionMinutes = durationMinutes;
            }

            // Behavior Score & Time of Day Analysis
            if (durationMinutes > 180) behaviorScore += 1; // +1 for sessions > 3 hours

            for (let d = new Date(start); d < end; d.setHours(d.getHours() + 1)) {
                const hour = d.getHours();
                const day = dayMapping[d.getDay()];
                let period = '';
                if (hour >= 22 || hour < 6) {
                    period = 'Night (22-6)';
                    lateNightHours += 1;
                    behaviorScore += 2; // +2 for every late night hour
                } else if (hour >= 18) {
                    period = 'Evening (18-22)';
                } else if (hour >= 12) {
                    period = 'Afternoon (12-18)';
                } else {
                    period = 'Morning (6-12)';
                }
                timeOfDayData[period][day] += 1;
            }
        });

        return {
            totalPlaytime: totalPlaytimeHours.toFixed(1),
            maxSession: maxSessionMinutes.toFixed(0),
            lateNightPlay: lateNightHours.toFixed(0),
            behaviorScore,
            timeOfDayData
        };
    }

    // --- RENDER FUNCTIONS ---

    function renderDashboard(analysis) {
        document.getElementById('total-playtime').textContent = `${analysis.totalPlaytime} ชม.`;
        document.getElementById('max-session').textContent = `${analysis.maxSession} นาที`;
        document.getElementById('late-night-play').textContent = `${analysis.lateNightPlay} ชม.`;
        
        const scoreEl = document.getElementById('behavior-score');
        scoreEl.textContent = `${analysis.behaviorScore}`;
        if (analysis.behaviorScore > 20) {
            scoreEl.style.color = 'var(--danger-color)';
        } else if (analysis.behaviorScore > 10) {
            scoreEl.style.color = 'var(--warning-color)';
        }

        // Render Time of Day Table
        const table = document.getElementById('time-of-day-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        const headerRow = thead.insertRow();
        headerRow.insertCell().textContent = 'ช่วงเวลา';
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(day => headerRow.insertCell().textContent = day);

        for (const period in analysis.timeOfDayData) {
            const row = tbody.insertRow();
            row.insertCell().textContent = period;
            days.forEach(day => {
                const cell = row.insertCell();
                const hours = analysis.timeOfDayData[period][day];
                cell.textContent = hours > 0 ? hours : '-';
                if (hours > 2) {
                    cell.style.backgroundColor = 'var(--danger-color-light)';
                } else if (hours > 0) {
                    cell.style.backgroundColor = 'var(--warning-color-light)';
                }
            });
        }
    }

    // --- MAIN EXECUTION ---
    async function main() {
        loader.style.display = 'block';
        try {
            const sessions = await getPlaytimeData(childId);
            if (!sessions || sessions.length === 0) {
                errorDiv.textContent = 'ไม่พบข้อมูลการเล่นเกมสำหรับบุตรหลานคนนี้';
                return;
            }
            const analysis = analyzeData(sessions);
            renderDashboard(analysis);
            dashboard.style.display = 'block';
        } catch (err) {
            errorDiv.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
        } finally {
            loader.style.display = 'none';
        }
    }

    main();
});
