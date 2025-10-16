# 🎮 Game Playtime Analyzer

Game Playtime Analyzer เป็นเครื่องมือสำหรับผู้ปกครองในการตรวจสอบและติดตามเวลาการเล่นเกมของบุตรหลานผ่าน Steam โดยสามารถกำหนดเวลาเล่นที่เหมาะสมและรับการแจ้งเตือนเมื่อมีการเล่นเกินกำหนด

**🔗 Link:** [https://3000-firebase-gameplaytimeanalyzer-1760497843600.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev/](https://3000-firebase-gameplaytimeanalyzer-1760497843600.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev/)

---

## ✨ ฟีเจอร์หลัก (Features)

-   **🕒 ตรวจสอบเวลาเล่นเกม:** ดึงข้อมูลเวลาเล่นเกมล่าสุด (2 สัปดาห์) จาก Steam Web API
-   **👥 ระบบสมาชิก:**
    -   รองรับการลงทะเบียนและเข้าสู่ระบบสำหรับผู้ปกครอง (parent) และผู้ดูแลระบบ (admin)
-   **🧒 จัดการข้อมูลบุตรหลาน:** ผู้ปกครองสามารถเพิ่ม, แก้ไข, และลบข้อมูลของบุตรหลาน (ชื่อ, Steam ID) และกำหนดเวลาเล่นเกมได้
-   **🔔 การแจ้งเตือนอัตโนมัติ:**
    -   ส่งอีเมลแจ้งเตือนไปยังผู้ปกครองเมื่อบุตรหลานเล่นเกมเกินเวลาที่กำหนด
    -   ส่งการแจ้งเตือนผ่าน Discord Webhook
-   **📊 หน้าแดชบอร์ด และระบบจัดการ:**
    -   **สำหรับผู้ปกครอง:** แสดงรายชื่อบุตรหลานและข้อมูลเวลาเล่นเกม
    -   **สำหรับผู้ดูแลระบบ:** จัดการผู้ใช้ทั้งหมดในระบบและดูประวัติการใช้งาน (Activity Logs)
-   **🤖 ตรวจสอบอัตโนมัติ:** มีระบบ Cron Job สำหรับตรวจสอบเวลาเล่นของเด็กทุกคนในฐานข้อมูลโดยอัตโนมัติ

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

-   **Backend:** Node.js, Express.js
-   **Database:** Supabase (PostgreSQL)
-   **Frontend:** HTML, CSS, JavaScript (Vanilla)
-   **Authentication:** Express Sessions, bcrypt.js
-   **API Communication:** Axios
-   **Notifications:** Nodemailer (Email), Axios (Discord)
-   **Scheduled Jobs:** node-cron
-   **Environment Variables:** dotenv

---

## 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์

### 1. Clone a Project

```bash
git clone https://github.com/wannachaikung/Game-Playtime-Analyzer.git
cd Game-Playtime-Analyzer
```

### 2. ติดตั้ง Dependencies

```bash
npm install
```

### 3. ตั้งค่า Environment Variables

คัดลอกไฟล์ `.env.example` และสร้างไฟล์ใหม่ชื่อ `.env`

```bash
cp .env.example .env
```

จากนั้น แก้ไขค่าในไฟล์ `.env` ตามข้อมูลของคุณ:

-   `PORT`: พอร์ตที่ต้องการให้เซิร์ฟเวอร์ทำงาน (ค่าเริ่มต้น: 3000)
-   `SESSION_SECRET`: ข้อความลับสำหรับเข้ารหัส Session
-   `STEAM_API_KEY`: API Key จาก Steam (ดูวิธีขอได้ที่ [Steam Web API Key](https://steamcommunity.com/dev/apikey))
-   `SUPABASE_URL` และ `SUPABASE_KEY`: ข้อมูลจากโปรเจกต์ Supabase ของคุณ
-   `EMAIL_*`: ตั้งค่า SMTP Server สำหรับการส่งอีเมลแจ้งเตือน

### 4. ตั้งค่าฐานข้อมูล (Supabase)

โปรเจกต์นี้ต้องใช้ตารางใน Supabase ดังนี้:

-   `users`: เก็บข้อมูลผู้ใช้ (id, username, password, role, email, discord_webhook_url)
-   `children`: เก็บข้อมูลบุตรหลาน (id, parent_id, child_name, steam_id, playtime_limit_hours, last_notified_at)
-   `activity_logs`: เก็บ Log การตรวจสอบเวลาเล่น (id, user_id, checked_steam_id, timestamp)

คุณสามารถใช้ SQL ด้านล่างนี้เพื่อสร้างตารางที่จำเป็นใน Supabase SQL Editor:

```sql
-- ตารางผู้ใช้
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'parent', -- 'parent' or 'admin'
    email VARCHAR(255) UNIQUE,
    discord_webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ตารางบุตรหลาน
CREATE TABLE children (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    child_name VARCHAR(255) NOT NULL,
    steam_id VARCHAR(255) UNIQUE NOT NULL,
    playtime_limit_hours INTEGER NOT NULL,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ตารางบันทึกกิจกรรม
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    checked_steam_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5. รันโปรเจกต์

```bash
node server.js
```

เซิร์ฟเวอร์จะทำงานที่ `http://localhost:3000` (หรือพอร์ตที่คุณตั้งค่าไว้)