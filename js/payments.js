document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("payments", "การชำระเงิน")) return;
    renderPayments();

    window.firebaseReady?.then(() => {
        applyDormBrand();
        renderPayments();
    });
});

function renderPayments() {
    const container = document.getElementById("paymentsList");
    if (!container) return;

    const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalEl = document.getElementById("totalIncome");
    if (totalEl) totalEl.textContent = "฿" + formatMoney(totalIncome);

    if (!payments.length) {
        container.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลการชำระเงิน</div>`;
        return;
    }

    container.innerHTML = [...payments]
        .sort((a,b) => new Date(b.date) - new Date(a.date))
        .map(payment => {
            const bill = bills.find(b => b.id === payment.billId);
            const tenant = tenants.find(t => t.id === bill?.tenantId);
            const room = rooms.find(r => r.id === bill?.roomId);

            return `
                <div class="border p-4 rounded-lg bg-white shadow-sm flex justify-between items-center gap-4">
                    <div class="min-w-0 flex-1">
                        ${recordIdMarkup(payment.id, "Payment ID")}
                        <h3 class="font-bold">${tenant?.name ?? "-"}</h3>
                        <p class="text-sm text-gray-600">ห้อง ${room?.number ?? "-"}</p>
                        <p class="text-xs text-gray-400">บิล ID: ${escapeHtmlShared(bill?.id || "-")}</p>
                        <p class="text-xs text-gray-400">${formatDate(payment.date)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-green-600 font-bold text-base">+${formatMoney(payment.amount)} บาท</p>
                    </div>
                </div>
            `;
        }).join("");
}
