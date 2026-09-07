document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("reports", "รายงาน")) return;
    loadReportSelectors();
    generateReport();

    window.firebaseReady?.then(() => {
        applyDormBrand();
        loadReportSelectors();
        generateReport();
    });
});

function loadReportSelectors() {
    const monthEl = document.getElementById("reportMonth");
    const yearEl = document.getElementById("reportYear");
    if (!monthEl || !yearEl) return;

    monthEl.innerHTML = Array.from({length:12}, (_,i) =>
        `<option value="${i+1}">เดือน ${i+1}</option>`
    ).join("");

    const years = [...new Set([
        new Date().getFullYear(),
        ...bills.map(b => b.year).filter(Boolean)
    ])].sort((a,b) => b-a);

    yearEl.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function generateReport() {
    const month = Number(document.getElementById("reportMonth")?.value || new Date().getMonth()+1);
    const year = Number(document.getElementById("reportYear")?.value || new Date().getFullYear());
    const reportBills = bills.filter(bill => bill.month === month && bill.year === year);

    let total = 0;
    let paid = 0;
    let unpaid = 0;

    const rows = reportBills.map(bill => {
        const room = rooms.find(r => r.id === bill.roomId);
        const tenant = tenants.find(t => t.id === bill.tenantId);
        total += Number(bill.total || 0);

        if (bill.status === "paid") paid += Number(bill.total || 0);
        else unpaid += Number(bill.total || 0);

        return `
            <tr>
                <td class="p-2 border">${room?.number ?? "-"}</td>
                <td class="p-2 border">${tenant?.name ?? "-"}</td>
                <td class="p-2 border">${formatMoney(bill.total)}</td>
                <td class="p-2 border">${bill.status === "paid" ? "ชำระแล้ว" : "ค้างชำระ"}</td>
            </tr>
        `;
    }).join("");

    const content = document.getElementById("reportContent");
    if (!content) return;

    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div class="bg-slate-50 rounded-xl p-4">
                <div class="text-sm text-gray-500">รวมทั้งหมด</div>
                <div class="text-xl font-bold">${formatMoney(total)} บาท</div>
            </div>
            <div class="bg-green-50 rounded-xl p-4">
                <div class="text-sm text-gray-500">ชำระแล้ว</div>
                <div class="text-xl font-bold text-green-700">${formatMoney(paid)} บาท</div>
            </div>
            <div class="bg-red-50 rounded-xl p-4">
                <div class="text-sm text-gray-500">ค้างชำระ</div>
                <div class="text-xl font-bold text-red-700">${formatMoney(unpaid)} บาท</div>
            </div>
        </div>

        ${reportBills.length
            ? `<table class="w-full text-left border-collapse border">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="p-2 border">ห้อง</th>
                        <th class="p-2 border">ผู้เช่า</th>
                        <th class="p-2 border">ยอดเงิน</th>
                        <th class="p-2 border">สถานะ</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`
            : `<div class="empty-state">ไม่มีข้อมูลสำหรับเดือนที่เลือก</div>`
        }
    `;
}

function exportCSV() {
    if (!bills.length) {
        showToast("ไม่มีข้อมูลสำหรับส่งออก", "warning");
        return;
    }

    let csv = "Bill ID,เลขบิล,Room ID,เลขห้อง,Tenant ID,ผู้เช่า,เดือน,ปี,ยอดเงิน,สถานะ\n";
    bills.forEach(bill => {
        const room = rooms.find(r => r.id === bill.roomId);
        const tenant = tenants.find(t => t.id === bill.tenantId);

        const row = [
            bill.id ?? "-",
            bill.invoiceNumber ?? "-",
            room?.id ?? "-",
            room?.number ?? "-",
            tenant?.id ?? "-",
            tenant?.name ?? "-",
            bill.month,
            bill.year,
            bill.total,
            bill.status === "paid" ? "ชำระแล้ว" : "ค้างชำระ"
        ];

        csv += row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "report.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function printReport() {
    window.print();
}
