let editingBill = null;

document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("bills", "บิลค่าเช่า")) return;

    document.getElementById("billFilter")?.addEventListener("change", renderBills);
    document.getElementById("billSearch")?.addEventListener("input", renderBills);

    renderBills();
    renderBillSummary();

    window.firebaseReady?.then(() => {
        applyDormBrand();
        renderBills();
        renderBillSummary();
    });
});

/* -----------------------------
   Bill / invoice data model
------------------------------ */
function generateBillId() {
    return generateId("BILL");
}

function blankItem(type = "other") {
    return {
        id: generateId("ITEM"),
        type,
        description: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0
    };
}

function calculateBillTotal(form) {
    return form.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function createBillObject(data) {
    const items = (data.items || []).map(item => ({
        ...item,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        amount: Number(item.amount || 0)
    }));

    const total = calculateBillTotal({ items });

    return {
        id: data.id || generateBillId(),
        invoiceNumber: data.invoiceNumber || generateInvoiceNumber(),
        roomId: data.roomId,
        tenantId: data.tenantId,
        month: Number(data.month),
        year: Number(data.year),
        dueDate: data.dueDate || "",
        items,
        total,
        status: data.status || "unpaid",
        createdAt: data.createdAt || new Date().toISOString(),
        paidAt: data.paidAt || null,
        note: data.note || ""
    };
}

/* -----------------------------
   Bill builder
------------------------------ */
function showBillForm(existingId = null) {
    editingBill = existingId;

    const existing = existingId
        ? bills.find(b => b.id === existingId)
        : null;

    const availableRooms = rooms.filter(room =>
        room.status === "occupied" ||
        existing?.roomId === room.id
    );

    if (!availableRooms.length) {
        showToast("ยังไม่มีห้องที่มีผู้เช่า กรุณาเพิ่มผู้เช่าก่อน", "warning");
        return;
    }

    const now = new Date();
    const month = existing?.month || now.getMonth() + 1;
    const year = existing?.year || now.getFullYear();

    const roomOptions = availableRooms.map(room => `
        <option value="${room.id}" ${existing?.roomId === room.id ? "selected" : ""}>
            ห้อง ${escapeHtmlBill(room.number)} - ค่าเช่า ${formatMoney(room.price)} บาท
        </option>
    `).join("");

    const items = existing?.items?.length
        ? existing.items
        : [
            {
                id: generateId("ITEM"),
                type: "rent",
                description: "ค่าเช่าห้อง",
                quantity: 1,
                unitPrice: Number(rooms.find(r => r.id === existing?.roomId)?.price || availableRooms[0]?.price || 0),
                amount: Number(rooms.find(r => r.id === existing?.roomId)?.price || availableRooms[0]?.price || 0)
            },
            {
                id: generateId("ITEM"),
                type: "water",
                description: "ค่าน้ำ",
                quantity: 1,
                unitPrice: Number(settings.water_rate || 0),
                amount: Number(settings.water_rate || 0)
            },
            {
                id: generateId("ITEM"),
                type: "garbage",
                description: "ค่าขยะ",
                quantity: 1,
                unitPrice: Number(settings.garbage_rate || 0),
                amount: Number(settings.garbage_rate || 0)
            }
        ];

    const content = document.getElementById("billModalContent");
    if (!content) return;

    content.innerHTML = `
        <form id="billBuilderForm" class="space-y-5">
            ${editingBill ? recordIdMarkup(editingBill, "รหัสบิล") : `<div class="text-xs text-gray-400 bg-slate-50 border rounded-xl px-3 py-2">รหัสบิล: ระบบจะสร้างอัตโนมัติเมื่อบันทึก</div>`}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label class="block text-sm font-medium mb-1">ห้อง</label>
                    <select id="billRoom" required>
                        <option value="">-- เลือกห้อง --</option>
                        ${roomOptions}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">เดือน</label>
                    <select id="billMonth">
                        ${Array.from({length:12}, (_,i) => `
                            <option value="${i+1}" ${month === i+1 ? "selected" : ""}>เดือน ${i+1}</option>
                        `).join("")}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">ปี</label>
                    <input type="number" id="billYear" value="${year}" min="2000" max="2100">
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">วันครบกำหนด</label>
                    <input type="date" id="billDueDate" value="${existing?.dueDate || defaultDueDate(year, month)}">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-blue-50 rounded-xl p-4">
                    <div class="text-sm text-gray-500">ผู้เช่า</div>
                    <div id="billTenantPreview" class="font-bold mt-1">-</div>
                </div>
                <div class="bg-slate-50 rounded-xl p-4">
                    <div class="text-sm text-gray-500">หมายเหตุ</div>
                    <input id="billNote" value="${escapeAttribute(existing?.note || "")}" placeholder="เช่น ค่าไฟตามมิเตอร์เดือนนี้">
                </div>
            </div>

            <div class="border rounded-2xl p-4">
                <div class="flex flex-wrap justify-between items-center gap-2 mb-3">
                    <div>
                        <h3 class="font-semibold">รายการค่าใช้จ่าย</h3>
                        <p class="text-xs text-gray-500">เพิ่มหรือลบรายการได้ตามห้อง เช่น ค่าไฟไม่เท่ากันในแต่ละห้อง</p>
                    </div>

                    <button type="button" onclick="addBillItem()" class="btn btn-secondary">
                        + เพิ่มค่าใช้จ่าย
                    </button>
                </div>

                <div id="billItems" class="space-y-3"></div>

                <div class="invoice-total mt-4">
                    <div class="invoice-total-row">
                        <span>รวมค่าใช้จ่าย</span>
                        <b id="builderTotal">฿0.00</b>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap justify-between gap-2">
                <div class="flex gap-2">
                    <button type="button" class="btn bg-gray-200" onclick="closeBillModal()">ยกเลิก</button>
                </div>
                <div class="flex gap-2">
                    <button type="button" class="btn btn-warning" onclick="saveBillDraft()">
                        บันทึกร่าง
                    </button>
                    <button type="submit" class="btn btn-primary">
                        บันทึกบิล
                    </button>
                </div>
            </div>
        </form>
    `;

    window.billBuilderItems = items;

    renderBillItems();
    updateBillTenantPreview();

    document.getElementById("billRoom")?.addEventListener("change", handleBillRoomChange);
    document.getElementById("billBuilderForm")?.addEventListener("submit", saveBill);
    document.getElementById("billMonth")?.addEventListener("change", updateDueDateByMonth);
    document.getElementById("billYear")?.addEventListener("change", updateDueDateByMonth);

    document.getElementById("billModal")?.classList.remove("hidden");

    if (window.lucide?.createIcons) lucide.createIcons();
}

function defaultDueDate(year, month) {
    const day = Math.min(Number(settings.due_day || 5), new Date(year, month, 0).getDate());
    return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function updateDueDateByMonth() {
    const year = Number(document.getElementById("billYear")?.value || new Date().getFullYear());
    const month = Number(document.getElementById("billMonth")?.value || new Date().getMonth()+1);
    const due = document.getElementById("billDueDate");
    if (due && !due.value) due.value = defaultDueDate(year, month);
}

function handleBillRoomChange() {
    const roomId = document.getElementById("billRoom")?.value;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    updateBillTenantPreview();

    // For a new bill, synchronize the basic rent line with this room.
    if (!editingBill) {
        const rent = window.billBuilderItems?.find(item => item.type === "rent");
        if (rent) {
            rent.description = `ค่าเช่าห้อง ${room.number}`;
            rent.unitPrice = Number(room.price || 0);
            rent.amount = Number(room.price || 0);
            renderBillItems();
        }
    }
}

function updateBillTenantPreview() {
    const roomId = document.getElementById("billRoom")?.value;
    const tenant = tenants.find(t => t.roomId === roomId);
    const preview = document.getElementById("billTenantPreview");
    if (preview) {
        preview.textContent = tenant ? `${tenant.name} | โทร ${tenant.phone}` : "ยังไม่มีผู้เช่า";
    }
}

function addBillItem() {
    window.billBuilderItems.push(blankItem("other"));
    renderBillItems();
}

function removeBillItem(index) {
    if (window.billBuilderItems.length <= 1) {
        showToast("บิลต้องมีอย่างน้อย 1 รายการ", "warning");
        return;
    }

    window.billBuilderItems.splice(index, 1);
    renderBillItems();
}

function updateBillItem(index, field, value) {
    const item = window.billBuilderItems[index];
    if (!item) return;

    if (field === "quantity" || field === "unitPrice" || field === "amount") {
        item[field] = Number(value || 0);
    } else {
        item[field] = value;
    }

    if (field === "quantity" || field === "unitPrice") {
        item.amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }

    if (field === "amount") {
        item.amount = Math.max(0, Number(value || 0));
    }

    renderBillItems(false);
}

function renderBillItems(focus = false) {
    const container = document.getElementById("billItems");
    if (!container) return;

    container.innerHTML = window.billBuilderItems.map((item, index) => `
        <div class="bill-line border rounded-xl p-3">
            <div>
                <label class="block text-xs text-gray-500 mb-1">รายการ</label>
                <input value="${escapeAttribute(item.description)}"
                       onchange="updateBillItem(${index}, 'description', this.value)"
                       placeholder="เช่น ค่าไฟ, ค่าที่จอดรถ">
            </div>

            <div>
                <label class="block text-xs text-gray-500 mb-1">จำนวนเงิน</label>
                <input type="number" min="0" step="0.01"
                       value="${Number(item.amount || 0)}"
                       onchange="updateBillItem(${index}, 'amount', this.value)">
            </div>

            <div>
                <button type="button" onclick="removeBillItem(${index})"
                        class="w-full h-[42px] rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                    <i data-lucide="trash-2" class="mx-auto"></i>
                </button>
            </div>
        </div>
    `).join("");

    const total = window.billBuilderItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalEl = document.getElementById("builderTotal");
    if (totalEl) totalEl.textContent = "฿" + formatMoney(total);

    if (window.lucide?.createIcons) lucide.createIcons();
}

function collectBillForm(status = "unpaid") {
    const roomId = document.getElementById("billRoom")?.value || "";
    const room = rooms.find(r => r.id === roomId);
    const tenant = tenants.find(t => t.roomId === roomId);

    const month = Number(document.getElementById("billMonth")?.value || 1);
    const year = Number(document.getElementById("billYear")?.value || new Date().getFullYear());
    const dueDate = document.getElementById("billDueDate")?.value || defaultDueDate(year, month);

    if (!roomId || !room || !tenant) {
        showToast("กรุณาเลือกห้องที่มีผู้เช่า", "error");
        return null;
    }

    const items = window.billBuilderItems.map(item => ({
        id: item.id || generateId("ITEM"),
        type: item.type || "other",
        description: String(item.description || "ค่าใช้จ่ายเพิ่มเติม").trim(),
        quantity: 1,
        unitPrice: Number(item.amount || 0),
        amount: Number(item.amount || 0)
    })).filter(item => item.amount > 0 || item.description);

    if (!items.length) {
        showToast("กรุณาเพิ่มรายการค่าใช้จ่ายอย่างน้อย 1 รายการ", "error");
        return null;
    }

    return createBillObject({
        id: editingBill || null,
        invoiceNumber: editingBill
            ? bills.find(b => b.id === editingBill)?.invoiceNumber
            : null,
        roomId,
        tenantId: tenant.id,
        month,
        year,
        dueDate,
        items,
        status,
        note: document.getElementById("billNote")?.value.trim() || "",
        createdAt: editingBill
            ? bills.find(b => b.id === editingBill)?.createdAt
            : new Date().toISOString()
    });
}

function saveBill(event) {
    event.preventDefault();

    const bill = collectBillForm("unpaid");
    if (!bill) return;

    const existing = bills.findIndex(b => b.id === bill.id);
    if (existing >= 0) {
        bills[existing] = {
            ...bills[existing],
            ...bill,
            paidAt: bills[existing].paidAt || null
        };
    } else {
        bills.push(bill);
    }

    autoSave();
    renderBills();
    renderBillSummary();
    closeBillModal();

    showToast(`${editingBill ? "แก้ไขบิลเรียบร้อย" : "สร้างบิลเรียบร้อย"} • ID: ${bill.id}`);
}

function saveBillDraft() {
    const bill = collectBillForm("draft");
    if (!bill) return;

    const existing = bills.findIndex(b => b.id === bill.id);
    if (existing >= 0) bills[existing] = { ...bills[existing], ...bill };
    else bills.push(bill);

    autoSave();
    renderBills();
    renderBillSummary();
    closeBillModal();
    showToast(`บันทึกร่างบิลแล้ว • ID: ${bill.id}`);
}

function closeBillModal() {
    document.getElementById("billModal")?.classList.add("hidden");
    editingBill = null;
}

function renderBills() {
    const container = document.getElementById("billsList");
    if (!container) return;

    const filter = document.getElementById("billFilter")?.value || "all";
    const keyword = (document.getElementById("billSearch")?.value || "").toLowerCase();

    let data = [...bills];

    if (filter !== "all") data = data.filter(bill => bill.status === filter);

    data = data.filter(bill => {
        const room = rooms.find(r => r.id === bill.roomId);
        const tenant = tenants.find(t => t.id === bill.tenantId);

        const text = [
            bill.invoiceNumber,
            bill.id,
            room?.number,
            tenant?.name
        ].join(" ").toLowerCase();

        return text.includes(keyword);
    });

    data.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (!data.length) {
        container.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลบิลที่ตรงกับเงื่อนไข</div>`;
        renderBillSummary();
        return;
    }

    container.innerHTML = data.map(bill => {
        const room = rooms.find(r => r.id === bill.roomId);
        const tenant = tenants.find(t => t.id === bill.tenantId);
        const statusClass =
            bill.status === "paid" ? "bg-green-100 text-green-800" :
            bill.status === "draft" ? "bg-gray-100 text-gray-800" :
            "bg-red-100 text-red-800";

        const statusText =
            bill.status === "paid" ? "ชำระแล้ว" :
            bill.status === "draft" ? "ร่าง" :
            "ยังไม่ชำระ";

        return `
            <div class="bill-card">
                <div class="flex flex-wrap justify-between gap-3">
                    <div>
                        ${recordIdMarkup(bill.id, "Bill ID")}
                        <div class="text-xs text-gray-400">เลขบิล: ${escapeHtmlBill(bill.invoiceNumber || bill.id)}</div>
                        <h3 class="font-bold text-lg">ห้อง ${escapeHtmlBill(room?.number ?? "-")}</h3>
                        <p class="text-sm">${escapeHtmlBill(tenant?.name ?? "-")}</p>
                        <p class="text-xs text-gray-400">รอบเดือน ${bill.month}/${bill.year} | ครบกำหนด ${formatDate(bill.dueDate)}</p>
                        <p class="text-xs text-gray-400">${bill.items?.length || 0} รายการ</p>
                    </div>

                    <div class="text-right">
                        <span class="px-2 py-1 text-xs rounded ${statusClass}">${statusText}</span>
                        <div class="text-xl font-bold text-primary mt-2">฿${formatMoney(bill.total)}</div>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2 mt-4">
                    <button onclick="viewBill('${bill.id}')" class="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300">ดูบิล</button>
                    <button onclick="editBill('${bill.id}')" class="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200">แก้ไข</button>
                    <button onclick="printBill('${bill.id}')" class="px-3 py-1 bg-slate-800 text-white rounded text-sm hover:bg-slate-900">พิมพ์ / PDF</button>
                    <button onclick="downloadBill('${bill.id}')" class="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">ดาวน์โหลด</button>
                    ${bill.status !== "paid"
                        ? `<button onclick="payBill('${bill.id}')" class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">รับชำระ</button>`
                        : ""
                    }
                    <button onclick="deleteBill('${bill.id}')" class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">ลบ</button>
                </div>
            </div>
        `;
    }).join("");

    renderBillSummary();
}

function renderBillSummary() {
    const count = document.getElementById("billCount");
    const unpaid = document.getElementById("billUnpaidTotal");
    const paid = document.getElementById("billPaidTotal");

    if (count) count.textContent = bills.length;

    const unpaidTotal = bills
        .filter(b => b.status === "unpaid")
        .reduce((sum,b) => sum + Number(b.total || 0), 0);

    const paidTotal = bills
        .filter(b => b.status === "paid")
        .reduce((sum,b) => sum + Number(b.total || 0), 0);

    if (unpaid) unpaid.textContent = "฿" + formatMoney(unpaidTotal);
    if (paid) paid.textContent = "฿" + formatMoney(paidTotal);
}

function editBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    showBillForm(id);
}

function viewBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    const html = buildInvoiceHTML(bill, true);
    const printArea = document.getElementById("printArea");
    if (printArea) printArea.innerHTML = html;

    const modal = document.getElementById("billModal");
    const content = document.getElementById("billModalContent");
    if (!modal || !content) return;

    content.innerHTML = `
        ${html}
        <div class="flex flex-wrap justify-end gap-2 mt-5 no-print">
            <button class="btn bg-gray-200" onclick="closeBillModal()">ปิด</button>
            <button class="btn btn-primary" onclick="printBill('${id}')">พิมพ์ / PDF</button>
            <button class="btn bg-purple-600 text-white" onclick="downloadBill('${id}')">ดาวน์โหลดบิล</button>
        </div>
    `;

    modal.classList.remove("hidden");
}

function buildInvoiceHTML(bill, preview = false) {
    const room = rooms.find(r => r.id === bill.roomId);
    const tenant = tenants.find(t => t.id === bill.tenantId);

    const items = bill.items?.length
        ? bill.items
        : [
            { description: "ค่าเช่าห้อง", amount: bill.roomPrice || 0 },
            { description: "ค่าน้ำ", amount: bill.waterPrice || 0 },
            { description: "ค่าขยะ", amount: bill.garbagePrice || 0 },
            { description: "ค่าไฟ", amount: bill.electricPrice || 0 }
        ];

    const total = Number(bill.total || items.reduce((sum,i)=>sum+Number(i.amount||0),0));

    return `
        <div class="invoice-preview print-invoice">
            <div class="invoice-header">
                <div>
                    <div class="text-2xl font-bold text-primary">${escapeHtmlBill(dormInfo.name)}</div>
                    <div class="text-sm text-gray-500">${escapeHtmlBill(dormInfo.address || "")}</div>
                    <div class="text-sm text-gray-500">โทร. ${escapeHtmlBill(dormInfo.phone || "-")}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold">ใบแจ้งค่าเช่า</div>
                    <div class="text-sm text-gray-500">${escapeHtmlBill(bill.invoiceNumber || bill.id)}</div>
                    <div class="text-sm text-gray-500">รอบ ${bill.month}/${bill.year}</div>
                </div>
            </div>

            <div class="invoice-meta">
                <div><b>รหัสข้อมูล:</b> ${escapeHtmlBill(bill.id || "-")}</div>
                <div><b>ผู้เช่า:</b> ${escapeHtmlBill(tenant?.name || "-")}</div>
                <div><b>ห้อง:</b> ${escapeHtmlBill(room?.number || "-")}</div>
                <div><b>โทร:</b> ${escapeHtmlBill(tenant?.phone || "-")}</div>
                <div><b>ครบกำหนด:</b> ${formatDate(bill.dueDate)}</div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width:70%">รายการ</th>
                        <th style="width:30%;text-align:right">จำนวนเงิน</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${escapeHtmlBill(item.description || "ค่าใช้จ่ายเพิ่มเติม")}</td>
                            <td style="text-align:right">${formatMoney(item.amount)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>

            <div class="invoice-total">
                <div class="invoice-total-row final">
                    <span>ยอดรวมสุทธิ</span>
                    <span>฿${formatMoney(total)}</span>
                </div>
                <div class="invoice-total-row">
                    <span>สถานะ</span>
                    <span>${bill.status === "paid" ? "ชำระแล้ว" : bill.status === "draft" ? "ร่าง" : "ยังไม่ชำระ"}</span>
                </div>
            </div>

            ${bill.note ? `
                <div class="mt-6 text-sm">
                    <b>หมายเหตุ:</b> ${escapeHtmlBill(bill.note)}
                </div>
            ` : ""}

            <div class="mt-10 text-xs text-gray-400">
                เอกสารนี้สร้างจากระบบบริหารจัดการหอพัก
            </div>
        </div>
    `;
}

function printBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    const printArea = document.getElementById("printArea");
    if (!printArea) return;

    printArea.innerHTML = buildInvoiceHTML(bill);
    printArea.classList.remove("hidden");

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            printArea.classList.add("hidden");
        }, 500);
    }, 100);
}

function downloadBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlBill(bill.invoiceNumber || bill.id)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:Sarabun,sans-serif;background:#f8fafc;padding:30px;color:#1f2937}
.invoice-preview{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;max-width:900px;margin:auto}
.invoice-header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #e5e7eb;padding-bottom:18px;margin-bottom:18px}
.invoice-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px;margin-bottom:18px}
.invoice-table{width:100%;border-collapse:collapse}
.invoice-table th,.invoice-table td{border:1px solid #e5e7eb;padding:10px 12px}
.invoice-table th{background:#f8fafc}
.invoice-total{margin-left:auto;max-width:360px;margin-top:18px}
.invoice-total-row{display:flex;justify-content:space-between;padding:6px 0}
.invoice-total-row.final{border-top:2px solid #1e3a5f;margin-top:8px;padding-top:12px;font-size:20px;font-weight:700}
@media(max-width:700px){.invoice-header,.invoice-meta{display:block}.invoice-meta>div{margin-top:8px}}
</style>
</head>
<body>${buildInvoiceHTML(bill)}</body>
</html>`;

    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bill.invoiceNumber || bill.id}.html`;
    link.click();
    URL.revokeObjectURL(url);

    showToast("ดาวน์โหลดบิลแล้ว");
}

function payBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill || bill.status === "paid") return;

    bill.status = "paid";
    bill.paidAt = new Date().toISOString();

    const paymentId = generateId("PAY");
    payments.push({
        id: paymentId,
        billId: id,
        amount: bill.total,
        date: bill.paidAt
    });

    autoSave();
    renderBills();
    renderBillSummary();
    showToast(`รับชำระเงินเรียบร้อย • Payment ID: ${paymentId}`);
}

function deleteBill(id) {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    if (!confirm(`ต้องการลบบิล ${bill.invoiceNumber || "-"} หรือไม่?\n\nBill ID: ${id}`)) return;

    bills = bills.filter(b => b.id !== id);
    const deletedPaymentIds = payments.filter(p => p.billId === id).map(p => p.id);
    payments = payments.filter(p => p.billId !== id);

    autoSave();
    deleteFirebaseRecords("bills", id);
    if (deletedPaymentIds.length) deleteFirebaseRecords("payments", deletedPaymentIds);
    renderBills();
    renderBillSummary();
    showToast(`ลบบิล ${bill.invoiceNumber || "-"} แล้ว • ID: ${id}`, "info");
}

function generateMonthlyBills() {
    let created = 0;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    rooms.filter(room => room.status === "occupied").forEach(room => {
        const tenant = tenants.find(t => t.roomId === room.id);
        if (!tenant) return;

        const duplicate = bills.some(b =>
            b.roomId === room.id &&
            b.month === month &&
            b.year === year &&
            b.status !== "draft"
        );

        if (duplicate) return;

        const items = [
            {
                id: generateId("ITEM"),
                type: "rent",
                description: `ค่าเช่าห้อง ${room.number}`,
                quantity: 1,
                unitPrice: Number(room.price || 0),
                amount: Number(room.price || 0)
            },
            {
                id: generateId("ITEM"),
                type: "water",
                description: "ค่าน้ำ",
                quantity: 1,
                unitPrice: Number(settings.water_rate || 0),
                amount: Number(settings.water_rate || 0)
            },
            {
                id: generateId("ITEM"),
                type: "garbage",
                description: "ค่าขยะ",
                quantity: 1,
                unitPrice: Number(settings.garbage_rate || 0),
                amount: Number(settings.garbage_rate || 0)
            }
        ];

        const bill = createBillObject({
            roomId: room.id,
            tenantId: tenant.id,
            month,
            year,
            dueDate: defaultDueDate(year, month),
            items
        });

        bills.push(bill);
        created++;
    });

    autoSave();
    renderBills();
    renderBillSummary();

    showToast(
        created ? `สร้างบิลรายเดือน ${created} ห้อง` : "ไม่มีบิลใหม่ที่ต้องสร้าง",
        created ? "success" : "info"
    );
}

function escapeHtmlBill(value) {
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function escapeAttribute(value) {
    return escapeHtmlBill(value);
}
