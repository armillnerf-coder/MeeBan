# MEEBAN - แยกไฟล์แล้ว

## โครงสร้าง
- index.html = Login
- pages/dashboard.html = Dashboard
- pages/rooms.html = จัดการห้องพัก
- pages/tenants.html = จัดการผู้เช่า
- pages/bills.html = บิลค่าเช่า
- pages/payments.html = การชำระเงิน
- pages/reports.html = รายงาน
- pages/settings.html = ตั้งค่า

## CSS
- css/style.css = CSS กลาง
- css/*.css = CSS เฉพาะหน้า

## JavaScript
- js/main.js = state, localStorage, auth, navigation helper, utility
- js/login.js = Login
- js/dashboard.js = Dashboard + chart
- js/rooms.js = ห้องพัก + รูปภาพห้อง
- js/tenants.js = ผู้เช่า
- js/bills.js = บิล + รับชำระ
- js/payments.js = ประวัติการชำระเงิน
- js/reports.js = รายงาน + CSV + พิมพ์
- js/settings.js = ข้อมูลหอพัก + ค่าเข้าห้อง + ค่าไฟ/น้ำ/ขยะ/กำหนดชำระ

## วิธีเปิด
ใช้ VS Code + Live Server แล้วเปิด index.html
Login demo: admin / 1234

หมายเหตุ:
- ข้อมูลเก็บใน LocalStorage ของ browser
- ยังไม่มีฐานข้อมูล/backend จริง
- รูปห้องถูกเก็บเป็น Data URL ใน LocalStorage จึงเหมาะกับ prototype/งานโครงงานขนาดเล็กมากกว่าระบบ production

- 1 บิล = 1 ห้อง + 1 รอบเดือน
- สร้างบิลเองได้จากปุ่ม "สร้างบิล"
- กำหนดรายการค่าใช้จ่ายแยกเป็นรายห้องได้
- ค่าเช่า/ค่าน้ำ/ค่าขยะเป็นรายการเริ่มต้น และเพิ่มค่าใช้จ่ายอื่นได้ เช่น ค่าไฟ ค่าที่จอดรถ ค่าปรับ ฯลฯ
- แก้ไขบิลย้อนหลังได้
- บันทึกร่างบิลได้
- รับชำระและเก็บประวัติการชำระเงิน
- ปุ่ม "พิมพ์ / PDF" ใช้ Print dialog ของเบราว์เซอร์ แล้วเลือก "Save as PDF"
- ปุ่ม "ดาวน์โหลด" ดาวน์โหลดใบแจ้งค่าเช่าเป็น HTML
- ข้อมูลบิลและรายการค่าใช้จ่ายเก็บใน LocalStorage


### ระบบรหัสข้อมูล
รายการในระบบจะมีรหัสประจำรายการที่ไม่เปลี่ยนเมื่อแก้ไข เช่น `ROOM-...`, `TENANT-...`, `BILL-...`, `PAY-...` รหัสนี้ตรงกับ Firestore Document ID สามารถดูบนการ์ด ค้นหา และคัดลอกได้ และกล่องยืนยันตอนลบจะแสดง ID ชัดเจนเพื่อป้องกันลบผิดรายการ
