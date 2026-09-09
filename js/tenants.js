let editingTenant = null;

document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("tenants", "จัดการผู้เช่า")) return;

    document.getElementById("tenantSearch")?.addEventListener("input", renderTenants);
    renderTenants();

    window.firebaseReady?.then(() => {
        applyDormBrand();
        renderTenants();
    });
});

function generateTenantId() {
    return generateId("TENANT");
}

function showTenantForm() {
    const title = document.getElementById("tenantModalTitle");
    const content = document.getElementById("tenantModalContent");
    if (!content) return;

    if (title) title.textContent = editingTenant ? "แก้ไขผู้เช่า" : "เพิ่มผู้เช่า";

    const tenant = editingTenant ? tenants.find(t => t.id === editingTenant) : null;
    const roomOptions = rooms
        .filter(room => room.status === "empty" || room.id === tenant?.roomId)
        .map(room => `<option value="${room.id}">ห้อง ${escapeHtmlSimple(room.number)}</option>`)
        .join("");

    content.innerHTML = `
        <form id="tenantForm" class="space-y-4">
            ${editingTenant ? recordIdMarkup(editingTenant, "รหัสผู้เช่า") : `<div class="text-xs text-gray-400 bg-slate-50 border rounded-xl px-3 py-2">รหัสผู้เช่า: ระบบจะสร้างอัตโนมัติเมื่อบันทึก</div>`}
            <div class="form-group">
                <label for="tenantName">ชื่อ-นามสกุล</label>
                <input id="tenantName" required>
            </div>
            <div class="form-group">
                <label for="tenantPhone">เบอร์โทรศัพท์</label>
                <input id="tenantPhone" required>
            </div>
            <div class="form-group">
                <label for="tenantIdCard">เลขบัตรประชาชน</label>
                <input id="tenantIdCard">
            </div>
            <div class="form-group">
                <label for="tenantRoom">เลือกห้อง</label>
                <select id="tenantRoom">
                    <option value="">-- เลือกห้อง --</option>
                    ${roomOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="tenantMoveInDate">วันที่เข้าพัก</label>
                <input type="date" id="tenantMoveInDate">
            </div>
            <div class="flex gap-2 justify-end">
                <button type="button" class="btn bg-gray-200" onclick="closeTenantModal()">ยกเลิก</button>
                <button type="submit" class="btn btn-primary">บันทึก</button>
            </div>
        </form>
    `;

    const form = document.getElementById("tenantForm");
    form?.addEventListener("submit", saveTenant);

    document.getElementById("tenantName").value = tenant?.name || "";
    document.getElementById("tenantPhone").value = tenant?.phone || "";
    document.getElementById("tenantIdCard").value = tenant?.idCard || "";
    document.getElementById("tenantRoom").value = tenant?.roomId || "";
    document.getElementById("tenantMoveInDate").value =
        tenant?.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);

    document.getElementById("tenantModal")?.classList.remove("hidden");
}

function closeTenantModal() {
    document.getElementById("tenantModal")?.classList.add("hidden");
    editingTenant = null;
}

function saveTenant(event) {
    event.preventDefault();

    const name = document.getElementById("tenantName")?.value.trim() || "";
    const phone = document.getElementById("tenantPhone")?.value.trim() || "";
    const idCard = document.getElementById("tenantIdCard")?.value.trim() || "";
    const roomId = document.getElementById("tenantRoom")?.value || "";
    const moveInDate = document.getElementById("tenantMoveInDate")?.value || new Date().toISOString().slice(0,10);

    if (!name || !phone) {
        showToast("กรุณากรอกข้อมูลผู้เช่าให้ครบถ้วน", "error");
        return;
    }

    const previousTenant = editingTenant ? tenants.find(t => t.id === editingTenant) : null;

    if (previousTenant?.roomId && previousTenant.roomId !== roomId) {
        const oldRoom = rooms.find(r => r.id === previousTenant.roomId);
        if (oldRoom) oldRoom.status = "empty";
    }

    const tenantData = {
        id: editingTenant || generateTenantId(),
        name,
        phone,
        idCard,
        roomId,
        moveInDate: new Date(moveInDate).toISOString()
    };

    if (editingTenant) {
        tenants = tenants.map(t => t.id === editingTenant ? tenantData : t);
    } else {
        tenants.push(tenantData);
    }

    const room = rooms.find(r => r.id === roomId);
    if (room) room.status = "occupied";

    autoSave();
    renderTenants();
    closeTenantModal();
    showToast(`บันทึกผู้เช่าเรียบร้อย • ID: ${tenantData.id}`);
}

function renderTenants() {
    const container = document.getElementById("tenantsList");
    if (!container) return;

    const keyword = (document.getElementById("tenantSearch")?.value || "").toLowerCase();

    const data = tenants.filter(t =>
        [t.name, t.id, t.phone].some(value => String(value || "").toLowerCase().includes(keyword))
    );

    if (!data.length) {
        container.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลผู้เช่า</div>`;
        return;
    }

    container.innerHTML = data.map(tenant => {
        const room = rooms.find(r => r.id === tenant.roomId);
        return `
            <div class="tenant-card">
                <div class="min-w-0 flex-1">
                    ${recordIdMarkup(tenant.id, "Tenant ID")}
                    <div class="tenant-name">${escapeHtmlSimple(tenant.name)}</div>
                    <div class="tenant-room">ห้อง: <b>${room ? escapeHtmlSimple(room.number) : "-"}</b></div>
                    <div class="text-xs text-gray-400">โทร: ${escapeHtmlSimple(tenant.phone)}</div>
                    <div class="text-xs text-gray-400">เข้าพัก: ${formatDate(tenant.moveInDate)}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editTenant('${tenant.id}')" class="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300">แก้ไข</button>
                    <button onclick="deleteTenant('${tenant.id}')" class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">ลบ</button>
                </div>
            </div>
        `;
    }).join("");
}

function editTenant(id) {
    editingTenant = id;
    showTenantForm();
}

function deleteTenant(id) {
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return;
    if (!confirm(`ต้องการลบผู้เช่า ${tenant.name || "-"} หรือไม่?\n\nTenant ID: ${id}`)) return;

    if (tenant) {
        const room = rooms.find(r => r.id === tenant.roomId);
        if (room) room.status = "empty";
    }

    tenants = tenants.filter(t => t.id !== id);
    autoSave();
    deleteFirebaseRecords("tenants", id);
    renderTenants();
    showToast(`ลบผู้เช่า ${tenant.name || "-"} แล้ว • ID: ${id}`, "info");
}

function escapeHtmlSimple(value) {
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}
