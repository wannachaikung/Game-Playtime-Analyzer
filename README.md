# Game Playtime Analyzer

โปรเจกต์สำหรับผู้ปกครองในการตรวจสอบชั่วโมงการเล่นเกมของบุตรหลานผ่าน Steam API พร้อมระบบแจ้งเตือนเมื่อเล่นเกินเวลาที่กำหนดผ่าน Discord Webhook และอีเมล
Link:https://3000-firebase-gameplaytimeanalyzer-1760497843600.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev/

## ฟีเจอร์หลัก (Features)

- **ระบบสมาชิก:** รองรับการลงทะเบียนและเข้าสู่ระบบสำหรับผู้ปกครอง (parent) และผู้ดูแลระบบ (admin)
- **การจัดการข้อมูลบุตรหลาน:** ผู้ปกครองสามารถเพิ่ม, แก้ไข, และลบข้อมูลของบุตรหลาน (ชื่อ, Steam ID) ได้
- **ตั้งค่าจำกัดเวลาเล่น:** สามารถกำหนดชั่วโมงการเล่นเกมต่อสัปดาห์สำหรับบุตรหลานแต่ละคน
- **ตรวจสอบเวลาเล่น:** ดึงข้อมูลชั่วโมงการเล่นเกมล่าสุด (2 สัปดาห์) จาก Steam API
- **ระบบแจ้งเตือน:**
  - **Discord:** แจ้งเตือนผ่าน Webhook เมื่อชั่วโมงการเล่นเกินกำหนด
  - **Email:** แจ้งเตือนผ่านอีเมล (ต้องตั้งค่า SMTP)
- **ตรวจสอบอัตโนมัติ:** มีระบบ Cron Job สำหรับตรวจสอบเวลาเล่นของเด็กทุกคนในฐานข้อมูลโดยอัตโนมัติ
- **หน้าสำหรับผู้ดูแลระบบ:** จัดการผู้ใช้ทั้งหมดในระบบและดูประวัติการใช้งาน (Activity Logs)

## เทคโนโลยีที่ใช้ (Tech Stack)

- **Backend:** Node.js, Express.js
- **Database:** Supabase (PostgreSQL)
- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Authentication:** Express Sessions, bcryptjs
- **API Communication:** Axios
- **Notifications:** Nodemailer (Email), Axios (Discord)
- **Scheduled Jobs:** node-cron
- **Environment Variables:** dotenv

---

## เริ่มต้นใช้งาน (Getting Started)

ทำตามขั้นตอนต่อไปนี้เพื่อติดตั้งและรันโปรเจกต์บนเครื่องของคุณ

### ข้อกำหนดเบื้องต้น (Prerequisites)

- **Node.js:** version 16.x หรือสูงกว่า
- **npm:** (มาพร้อมกับ Node.js)
- **Supabase Account:** สำหรับสร้างฐานข้อมูล PostgreSQL
- **Steam API Key:** สำหรับดึงข้อมูลจาก Steam

### การติดตั้ง (Installation)

1. **Clone a copy of the repository:**
   ```bash
   git clone https://github.com/your-username/game-playtime-analyzer.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd game-playtime-analyzer
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

---

## การตั้งค่า (Configuration)

โปรเจกต์นี้ใช้ไฟล์ `.env` ในการจัดการข้อมูลสำคัญต่างๆ

1.  สร้างไฟล์ `.env` โดยการคัดลอกจาก `.env.example`:
    ```bash
    cp .env.example .env
    ```

2.  เปิดไฟล์ `.env` และกรอกข้อมูลของคุณให้ครบถ้วน:

    | ตัวแปร (Variable)       | คำอธิบาย                                                              |
    | ----------------------- | --------------------------------------------------------------------- |
    | `SUPABASE_URL`          | URL ของโปรเจกต์ Supabase ของคุณ (อยู่ในหน้า Settings > API)            |
    | `SUPABASE_KEY`          | `anon` key ของโปรเจกต์ Supabase ของคุณ (อยู่ในหน้า Settings > API)     |
    | `STEAM_API_KEY`         | API Key ที่ได้รับจาก Steam                                             |
    | `SESSION_SECRET`        | ข้อความยาวๆ แบบสุ่มสำหรับเข้ารหัส Session (สำคัญมาก)                  |
    | `PORT`                  | (ไม่จำเป็น) Port ที่จะรันเซิร์ฟเวอร์ (ค่าเริ่มต้นคือ 3000)              |
    | `EMAIL_HOST`            | (ไม่จำเป็น) Host ของ SMTP Server สำหรับส่งอีเมล (เช่น `smtp.gmail.com`) |
    | `EMAIL_PORT`            | (ไม่จำเป็น) Port ของ SMTP Server (เช่น `587`)                         |
    | `EMAIL_USER`            | (ไม่จำเป็น) Username สำหรับล็อกอิน SMTP Server                        |
    | `EMAIL_PASS`            | (ไม่จำเป็น) Password หรือ App Password สำหรับล็อกอิน SMTP Server       |

### การใช้งาน (Usage)

หลังจากตั้งค่าเรียบร้อยแล้ว สามารถรันเซิร์ฟเวอร์ได้ด้วยคำสั่ง:
```bash
npm start
```
จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

---

## โครงสร้างฐานข้อมูล (Database Schema)

โปรเจกต์นี้ใช้ Supabase (PostgreSQL) ในการจัดเก็บข้อมูล โดยมีโครงสร้างตารางหลักดังนี้:

### ตาราง `users`

เก็บข้อมูลผู้ใช้งานและช่องทางการแจ้งเตือน

- `id`: (Primary Key) ID ของผู้ใช้
- `username`: (Unique) ชื่อผู้ใช้สำหรับล็อกอิน
- `password`: รหัสผ่านที่ถูกเข้ารหัส (Hashed)
- `role`: บทบาทของผู้ใช้ (`parent` หรือ `admin`)
- `email`: (Unique) อีเมลสำหรับรับการแจ้งเตือน
- `discord_webhook_url`: URL ของ Discord Webhook สำหรับรับการแจ้งเตือน

### ตาราง `children`

เก็บข้อมูลบุตรหลานและเชื่อมโยงกับผู้ปกครอง

- `id`: (Primary Key) ID ของเด็ก
- `parent_id`: (Foreign Key) ID ของผู้ปกครองที่อ้างอิงจากตาราง `users`
- `child_name`: ชื่อของเด็ก
- `steam_id`: (Unique) Steam ID ของเด็ก
- `playtime_limit_hours`: จำนวนชั่วโมงที่จำกัดต่อสัปดาห์
- `last_notified_at`: วันและเวลาล่าสุดที่ส่งการแจ้งเตือน (เพื่อป้องกันการส่งซ้ำ)

### ตาราง `activity_logs`

เก็บประวัติการตรวจสอบเวลาเล่น

- `id`: (Primary Key) ID ของ Log
- `user_id`: (Foreign Key) ID ของผู้ใช้ที่ทำการตรวจสอบ
- `checked_steam_id`: Steam ID ที่ถูกตรวจสอบ
- `timestamp`: วันและเวลาที่ทำการตรวจสอบ
