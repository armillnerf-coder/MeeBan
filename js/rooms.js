let editingRoom = null;

document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("rooms", "จัดการห้องพัก")) return;

    document.getElementById("roomSearch")?.addEventListener("input", renderRooms);
    renderRooms();

    window.firebaseReady?.then(() => {
        applyDormBrand();
        renderRooms();
    });
});

function generateRoomId() {
    return generateId("ROOM");
}

function showRoomForm() {
    editingRoom = null;

    const title = document.getElementById("roomModalTitle");
    const content = document.getElementById("roomModalContent");
    if (!content) return;

    if (title) title.textContent = "เพิ่มห้องพัก";

    content.innerHTML = `
        <form id="roomForm" class="space-y-4">
            ${editingRoom ? recordIdMarkup(editingRoom, "รหัสห้อง") : `<div class="text-xs text-gray-400 bg-slate-50 border rounded-xl px-3 py-2">รหัสห้อง: ระบบจะสร้างอัตโนมัติเมื่อบันทึก</div>`}
            <div class="form-group">
                <label for="roomNumber">เลขห้อง</label>
                <input id="roomNumber" required>
            </div>
            <div class="form-group">
                <label for="roomPrice">ค่าเช่า</label>
                <input type="number" id="roomPrice" min="0" required>
            </div>
            <div class="form-group">
                <label for="roomStatus">สถานะ</label>
                <select id="roomStatus">
                    <option value="empty">ว่าง</option>
                    <option value="occupied">มีผู้เช่า</option>
                    <option value="maintenance">ปรับปรุง</option>
                </select>
            </div>
            <div class="form-group">
                <label for="roomImage">รูปภาพห้อง</label>
                <input type="file" id="roomImage" accept="image/*">
                <img id="roomImagePreview" class="image-preview mt-3 hidden" alt="ตัวอย่างรูปห้อง">
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" class="btn bg-gray-200" onclick="closeRoomModal()">ยกเลิก</button>
                <button type="submit" class="btn btn-primary">บันทึก</button>
            </div>
        </form>
    `;

    document.getElementById("roomForm")?.addEventListener("submit", saveRoom);
    document.getElementById("roomImage")?.addEventListener("change", previewRoomImage);

    if (editingRoom) fillRoomForm(editingRoom);

    document.getElementById("roomModal")?.classList.remove("hidden");
}

function previewRoomImage(event) {
    const file = event.target.files?.[0];
    const preview = document.getElementById("roomImagePreview");
    if (!file || !preview) return;

    const reader = new FileReader();
    reader.onload = () => {
        preview.src = reader.result;
        preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

function fillRoomForm(id) {
    const room = rooms.find(r => r.id === id);
    if (!room) return;

    document.getElementById("roomNumber").value = room.number || "";
    document.getElementById("roomPrice").value = room.price || 0;
    document.getElementById("roomStatus").value = room.status || "empty";

    if (room.image) {
        const preview = document.getElementById("roomImagePreview");
        preview.src = room.image;
        preview.classList.remove("hidden");
    }
}

function closeRoomModal() {
    document.getElementById("roomModal")?.classList.add("hidden");
}

function saveRoom(event) {
    event.preventDefault();

    const number = document.getElementById("roomNumber")?.value.trim() || "";
    const price = Number(document.getElementById("roomPrice")?.value || 0);
    const status = document.getElementById("roomStatus")?.value || "empty";
    const imageInput = document.getElementById("roomImage");

    if (!number || price <= 0) {
        showToast("กรุณากรอกข้อมูลห้องให้ถูกต้อง", "error");
        return;
    }

    const existing = editingRoom ? rooms.find(r => r.id === editingRoom) : null;

    const saveData = imageInput?.files?.[0]
        ? readFileAsDataURL(imageInput.files[0]).then(dataUrl => compressImageDataUrl(dataUrl, 700 * 1024))
        : Promise.resolve(existing?.image || "").then(dataUrl => compressImageDataUrl(dataUrl, 700 * 1024));

    saveData.then(image => {
        const roomData = {
            id: editingRoom || generateRoomId(),
            number,
            price,
            status,
            image
        };

        if (editingRoom) {
            rooms = rooms.map(r => r.id === editingRoom ? roomData : r);
        } else {
            rooms.push(roomData);
        }

        autoSave();
        renderRooms();
        closeRoomModal();
        showToast(`บันทึกห้องเรียบร้อย • ID: ${roomData.id}`);
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function renderRooms() {
    const container = document.getElementById("roomsList");
    if (!container) return;

    const keyword = (document.getElementById("roomSearch")?.value || "").toLowerCase();
    const filtered = rooms.filter(room =>
        [room.number, room.id].some(value => String(value || "").toLowerCase().includes(keyword))
    );

    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state col-span-full">ยังไม่มีข้อมูลห้องพัก</div>`;
        return;
    }

    container.innerHTML = filtered.map(room => {
        const statusClass =
            room.status === "occupied" ? "room-occupied" :
            room.status === "empty" ? "room-empty" : "room-maintenance";

        const statusText =
            room.status === "occupied" ? "มีผู้เช่า" :
            room.status === "empty" ? "ว่าง" : "ปรับปรุง";

        return `
            <div class="room-card">
                ${room.image
                    ? `<img src="${room.image}" class="room-thumb mb-3" alt="ห้อง ${escapeHtml(room.number)}">`
                    : `<div class="room-thumb mb-3 flex items-center justify-center text-gray-400">ไม่มีรูปภาพ</div>`
                }
                ${recordIdMarkup(room.id, "Room ID")}
                <div class="flex justify-between items-center mb-2">
                    <div class="room-number">ห้อง ${escapeHtml(room.number)}</div>
                    <span class="room-status ${statusClass}">${statusText}</span>
                </div>
                <div class="mb-3 text-sm">ค่าเช่า: <b>${formatMoney(room.price)}</b> บาท</div>
                <div class="flex gap-2">
                    <button onclick="editRoom('${room.id}')" class="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300">แก้ไข</button>
                    <button onclick="deleteRoom('${room.id}')" class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">ลบ</button>
                </div>
            </div>
        `;
    }).join("");
}

function editRoom(id) {
    editingRoom = id;
    showRoomForm();
}

function deleteRoom(id) {
    const room = rooms.find(r => r.id === id);
    if (!room) return;
    if (!confirm(`ต้องการลบห้อง ${room.number || "-"} หรือไม่?\n\nRoom ID: ${id}`)) return;
    rooms = rooms.filter(r => r.id !== id);
    tenants = tenants.map(t => t.roomId === id ? { ...t, roomId: "" } : t);
    autoSave();
    deleteFirebaseRecords("rooms", id);
    renderRooms();
    showToast(`ลบห้อง ${room.number || "-"} แล้ว • ID: ${id}`, "info");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
