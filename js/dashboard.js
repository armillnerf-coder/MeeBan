document.addEventListener("DOMContentLoaded", () => {
    initShared();
    if (!setupSharedPage("dashboard", "แดชบอร์ด")) return;
    renderDashboard();
    renderChart();

    window.firebaseReady?.then(() => {
        applyDormBrand();
        renderDashboard();
        renderChart();
    });
});

function getUnpaidBills() {
    return bills.filter(bill => bill.status === "unpaid");
}

function getUnpaidAmount() {
    return getUnpaidBills().reduce((sum, bill) => sum + Number(bill.total || 0), 0);
}

function getCurrentMonthIncome() {
    const now = new Date();
    return payments
        .filter(payment => {
            const date = new Date(payment.date);
            return date.getMonth() === now.getMonth() &&
                   date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function getIncomeByMonth(month, year = new Date().getFullYear()) {
    return bills
        .filter(bill => bill.month === month && bill.year === year && bill.status === "paid")
        .reduce((sum, bill) => sum + Number(bill.total || 0), 0);
}

function renderDashboard() {
    const total = document.getElementById("statTotal");
    const empty = document.getElementById("statEmpty");
    const occupied = document.getElementById("statOccupied");
    const income = document.getElementById("statIncome");
    const unpaid = document.getElementById("statUnpaid");
    const unpaidCount = document.getElementById("statUnpaidCount");

    if (total) total.textContent = rooms.length;
    if (empty) empty.textContent = rooms.filter(r => r.status === "empty").length;
    if (occupied) occupied.textContent = rooms.filter(r => r.status === "occupied").length;
    if (income) income.textContent = "฿" + formatMoney(getCurrentMonthIncome());
    if (unpaid) unpaid.textContent = "฿" + formatMoney(getUnpaidAmount());
    if (unpaidCount) unpaidCount.textContent = getUnpaidBills().length;
}

function renderChart() {
    const chart = document.getElementById("chartContainer");
    if (!chart) return;

    const year = new Date().getFullYear();
    const values = Array.from({ length: 12 }, (_, i) => getIncomeByMonth(i + 1, year));
    const max = Math.max(...values, 1);

    chart.innerHTML = values.map((value, index) => {
        const height = Math.max((value / max) * 150, value ? 12 : 4);
        return `
            <div class="flex flex-col items-center min-w-7">
                <div class="chart-bar" title="${formatMoney(value)} บาท"
                     style="height:${height}px;width:20px;"></div>
                <span class="text-xs mt-1">${index + 1}</span>
            </div>
        `;
    }).join("");
}
