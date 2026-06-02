const API_URL = "https://mybus-7qti.onrender.com";

// State Management for Editing
let currentEditId = null;
let currentEditType = null;
let currentEditSubtype = null;
let currentDataType = 'transaction';
let currentPage = 1;
const pageSize = 6;
let currentSearch = '';
let currentFromDate = '';
let currentToDate = '';
let currentData = [];

// Element Selectors
const form = document.getElementById('business-form');
const entryType = document.getElementById('entry-type');
const subType = document.getElementById('sub-type');
const paidTithesInput = document.getElementById('paid-tithes-input');
const savePaidTitheBtn = document.getElementById('save-paid-tithe-btn');
const resetPaidTitheBtn = document.getElementById('reset-paid-tithe-btn');
const searchInput = document.getElementById('search-query');
const filterFromInput = document.getElementById('filter-from');
const filterToInput = document.getElementById('filter-to');
const paginationBar = document.getElementById('pagination-bar');
const tabButtons = document.querySelectorAll('.tabs button');
const summaryRecordCount = document.getElementById('summary-record-count');
const summaryTotalAmount = document.getElementById('summary-total-amount');
const summaryTotalTithe = document.getElementById('summary-total-tithe');
const summaryTitheCard = document.querySelector('.transaction-only');

// --- 1. DYNAMIC UI LOGIC ---
const updateOptions = () => {
    if (!entryType || !subType) return;
    if (entryType.value === 'transaction') {
        subType.innerHTML = `
            <option value="Repair">Repair</option>
            <option value="Sale">Sale</option>
            <option value="Flashing">Flashing</option>
            <option value="Power/Charging">Power/Charging</option>
        `;
    } else {
        subType.innerHTML = `
            <option value="Utilities">Utilities (Data/Fuel)</option>
            <option value="Rent">Shop Rent</option>
            <option value="Tools">Tools/Parts</option>
            <option value="Others">Others</option>
        `;
    }
};

function validateAmount(amount) {
    return !Number.isNaN(amount) && amount > 0;
}

function validateDescription(text) {
    return typeof text === 'string' && text.trim().length > 0;
}

function validateEntry(type, description, amount, subtype) {
    if (!validateDescription(description)) {
        showToast('Please enter a valid description.', 'error');
        return false;
    }

    if (!validateAmount(amount)) {
        showToast('Amount must be greater than zero.', 'error');
        return false;
    }

    if (!validateDescription(subtype)) {
        showToast('Please choose a valid type or category.', 'error');
        return false;
    }

    return true;
}

function getPaidTithes() {
    const amount = Number(localStorage.getItem('paidTithes') || 0);
    return Number.isNaN(amount) ? 0 : amount;
}

function setPaidTithes(amount) {
    localStorage.setItem('paidTithes', amount);
}

function clearPaidTithes() {
    localStorage.removeItem('paidTithes');
}

savePaidTitheBtn?.addEventListener('click', () => {
    const amount = Number(paidTithesInput.value);
    if (!validateAmount(amount)) {
        showToast('Enter a valid paid tithe amount.', 'error');
        return;
    }

    setPaidTithes(amount);
    showToast('Paid tithe updated.', 'success');
    calculateNetProfit();
});

resetPaidTitheBtn?.addEventListener('click', () => {
    clearPaidTithes();
    paidTithesInput.value = '';
    showToast('Paid tithe reset.', 'success');
    calculateNetProfit();
});

// --- 2. CREATE (POST) LOGIC ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = entryType?.value || 'transaction';
    const path = type === 'transaction' ? '/transaction' : '/expenses';
    const description = document.getElementById('description').value.trim();
    const amount = Number(document.getElementById('amount').value);
    const subtype = subType.value;

    if (!validateEntry(type, description, amount, subtype)) {
        return;
    }

    const payload = { amount };
    if (type === 'transaction') {
        payload.description = description;
        payload.transactionType = subtype;
    } else {
        payload.item = description;
        payload.category = subtype;
    }

    try {
        const res = await fetch(`${API_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Successfully saved!", "success");
            form.reset();
            updateOptions();
            loadData(type);
            calculateNetProfit();
        } else {
            const result = await res.json();
            showToast(result.error || "Validation failed", "error");
        }
    } catch (err) {
        showToast("Server connection failed", "error");
    }
});

// --- 3. READ (GET) LOGIC ---
async function loadData(type, resetPage = true) {
    currentDataType = type;
    if (resetPage) currentPage = 1;
    const path = type === 'transaction' ? '/transaction' : '/expenses';
    const tbody = document.getElementById('table-body');
    const thead = document.getElementById('table-head');
    const table = document.getElementById('data-table');

    tbody.innerHTML = `<tr><td colspan='${type === 'transaction' ? 6 : 5}'>Loading records...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}${path}`);
        const result = await res.json();
        currentData = result.data || result || [];

        thead.innerHTML = type === 'transaction' 
            ? `<th>Date</th><th>Info</th><th>Type</th><th>Amount</th><th>Tithe</th><th>Actions</th>`
            : `<th>Date</th><th>Item</th><th>Category</th><th>Amount</th><th>Actions</th>`;

        updateActiveTab();
        renderTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan='${type === 'transaction' ? 6 : 5}'>Error loading data.</td></tr>`;
        paginationBar.innerHTML = '';
    }
}

function updateActiveTab() {
    tabButtons.forEach(button => {
        button.classList.toggle('active-tab', button.dataset.type === currentDataType);
    });
}

function applyFilters(data) {
    const query = currentSearch.trim().toLowerCase();
    const from = filterFromInput.value ? new Date(filterFromInput.value) : null;
    const to = filterToInput.value ? new Date(filterToInput.value) : null;
    if (to) {
        to.setHours(23, 59, 59, 999);
    }

    return data.filter(item => {
        const itemDate = item.date ? new Date(item.date) : null;
        if (from && itemDate && itemDate < from) return false;
        if (to && itemDate && itemDate > to) return false;

        if (!query) return true;
        const values = [
            item.description || item.item || '',
            item.transactionType || item.category || '',
            item.amount?.toString() || ''
        ].join(' ').toLowerCase();

        return values.includes(query);
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const filteredData = applyFilters(currentData);
    const totalPages = Math.max(Math.ceil(filteredData.length / pageSize), 1);
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * pageSize;
    const pageData = filteredData.slice(startIndex, startIndex + pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan='${currentDataType === 'transaction' ? 6 : 5}'>No records found.</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.description || item.item}</td>
                <td>${item.transactionType || item.category}</td>
                <td>₦${Number(item.amount).toLocaleString()}</td>
                ${currentDataType === 'transaction' ? `<td>₦${Number(item.tithe).toLocaleString()}</td>` : ''}
                <td>
                    <button class="btn-edit" onclick="openEditModal('${item._id}', '${currentDataType}')">Edit</button>
                    <button class="btn-delete" onclick="deleteEntry('${item._id}', '${currentDataType}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(totalPages);
    updateRecordSummary(filteredData);
}

function updateRecordSummary(filteredData) {
    const recordCount = filteredData.length;
    const totalAmount = filteredData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalTithe = filteredData.reduce((sum, item) => sum + Number(item.tithe || 0), 0);

    if (summaryRecordCount) summaryRecordCount.innerText = recordCount;
    if (summaryTotalAmount) summaryTotalAmount.innerText = `₦${totalAmount.toLocaleString()}`;
    if (summaryTotalTithe) summaryTotalTithe.innerText = `₦${totalTithe.toLocaleString()}`;
    if (summaryTitheCard) summaryTitheCard.style.display = currentDataType === 'transaction' ? 'block' : 'none';
}

function renderPagination(totalPages) {
    if (!paginationBar) return;

    paginationBar.innerHTML = `
        <button class="pagination-btn" data-action="prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" data-action="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
}

paginationBar?.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (!action) return;

    const filteredData = applyFilters(currentData);
    const totalPages = Math.max(Math.ceil(filteredData.length / pageSize), 1);

    if (action === 'prev' && currentPage > 1) {
        currentPage -= 1;
        renderTable();
    }
    if (action === 'next' && currentPage < totalPages) {
        currentPage += 1;
        renderTable();
    }
});

searchInput?.addEventListener('input', (event) => {
    currentSearch = event.target.value;
    currentPage = 1;
    renderTable();
});

filterFromInput?.addEventListener('change', (event) => {
    currentFromDate = event.target.value;
    currentPage = 1;
    renderTable();
});

filterToInput?.addEventListener('change', (event) => {
    currentToDate = event.target.value;
    currentPage = 1;
    renderTable();
});

// --- 4. UPDATE (PUT) LOGIC ---
async function openEditModal(id, type) {
    currentEditId = id;
    currentEditType = type;
    const path = type === 'transaction' ? '/transaction' : '/expenses';

    try {
        const res = await fetch(`${API_URL}${path}/${id}`);
        const result = await res.json();
        const item = result.data || result;

        const editDescriptionEl = document.getElementById('edit-description');
        const editAmountEl = document.getElementById('edit-amount');
        const editModalEl = document.getElementById('edit-modal');

        if (editDescriptionEl) editDescriptionEl.value = item.description || item.item;
        if (editAmountEl) editAmountEl.value = item.amount;
        currentEditSubtype = item.transactionType || item.category;
        if (editModalEl) editModalEl.style.display = 'flex';
    } catch (err) {
        showToast("Could not load data", "error");
    }
}

const saveEditBtn = document.getElementById('save-edit-btn');
saveEditBtn?.addEventListener('click', async () => {
    const path = currentEditType === 'transaction' ? '/transaction' : '/expenses';
    const editDescriptionEl = document.getElementById('edit-description');
    const editAmountEl = document.getElementById('edit-amount');

    if (!editDescriptionEl || !editAmountEl) return;

    const updatedData = { amount: Number(editAmountEl.value) };
    const editDescription = editDescriptionEl.value.trim();
    const editAmount = Number(editAmountEl.value);
    const editSubtype = currentEditSubtype;

    if (!validateEntry(currentEditType, editDescription, editAmount, editSubtype)) {
        return;
    }

    if (currentEditType === 'transaction') {
        updatedData.description = editDescription;
        if (currentEditSubtype) updatedData.transactionType = currentEditSubtype;
    } else {
        updatedData.item = editDescription;
        if (currentEditSubtype) updatedData.category = currentEditSubtype;
    }

    try {
        const res = await fetch(`${API_URL}${path}/${currentEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (res.ok) {
            showToast("Updated Successfully!", "success");
            closeModal();
            loadData(currentEditType);
            calculateNetProfit();
        }
    } catch (err) {
        showToast("Update failed", "error");
    }
});

function closeModal() {
    const editModalEl = document.getElementById('edit-modal');
    if (editModalEl) editModalEl.style.display = 'none';
}

// --- 5. DELETE LOGIC ---
async function deleteEntry(id, type) {
    if (!confirm("Are you sure you want to delete this record?")) return;
    const path = type === 'transaction' ? '/transaction' : '/expenses';
    try {
        const res = await fetch(`${API_URL}${path}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("Record Deleted", "success");
            loadData(type);
            calculateNetProfit();
        }
    } catch (err) {
        showToast("Delete failed", "error");
    }
}

async function calculateNetProfit() {
    const grossIncomeEl = document.getElementById('gross-income');
    const totalExpensesEl = document.getElementById('total-expenses');
    const totalTithesEl = document.getElementById('total-tithes');
    const netProfitEl = document.getElementById('net-profit');
    const navProfitEl = document.getElementById('nav-profit');
    const insightTotalTitheEl = document.getElementById('insight-total-tithe');
    const insightPaidTitheEl = document.getElementById('insight-paid-tithe');
    const insightRemainingTitheEl = document.getElementById('insight-remaining-tithe');

    try {
        const [incomeRes, expenseRes] = await Promise.all([
            fetch(`${API_URL}/transaction`),
            fetch(`${API_URL}/expenses`)
        ]);

        const incomeJson = await incomeRes.json();
        const expenseJson = await expenseRes.json();

        const incomes = incomeJson.data || incomeJson || [];
        const expenses = expenseJson.data || expenseJson || [];

        const grossIncome = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const netIncomeBeforeTithe = grossIncome - totalExpenses;
        const totalTithes = netIncomeBeforeTithe > 0 ? Math.round(netIncomeBeforeTithe * 0.1) : 0;

        const paidTithes = getPaidTithes();
        const remainingTithes = Math.max(totalTithes - paidTithes, 0);
        const netProfit = netIncomeBeforeTithe - totalTithes;

        if (grossIncomeEl) grossIncomeEl.innerText = `₦${grossIncome.toLocaleString()}`;
        if (totalExpensesEl) totalExpensesEl.innerText = `₦${totalExpenses.toLocaleString()}`;
        if (totalTithesEl) totalTithesEl.innerText = `₦${totalTithes.toLocaleString()}`;
        setText('paid-tithes', `₦${paidTithes.toLocaleString()}`);
        setText('remaining-tithes', `₦${remainingTithes.toLocaleString()}`);
        if (netProfitEl) netProfitEl.innerText = `₦${netProfit.toLocaleString()}`;
        if (navProfitEl) navProfitEl.innerText = `₦${netProfit.toLocaleString()}`;
        if (insightTotalTitheEl) insightTotalTitheEl.innerText = `₦${totalTithes.toLocaleString()}`;
        if (insightPaidTitheEl) insightPaidTitheEl.innerText = `₦${paidTithes.toLocaleString()}`;
        if (insightRemainingTitheEl) insightRemainingTitheEl.innerText = `₦${remainingTithes.toLocaleString()}`;
    } catch (err) {
        console.error('Profit calculation failed', err);
        if (grossIncomeEl) grossIncomeEl.innerText = '₦0';
        if (totalExpensesEl) totalExpensesEl.innerText = '₦0';
        if (totalTithesEl) totalTithesEl.innerText = '₦0';
        setText('paid-tithes', '₦0');
        setText('remaining-tithes', '₦0');
        if (netProfitEl) netProfitEl.innerText = '₦0';
        if (navProfitEl) navProfitEl.innerText = '₦0';
        if (insightTotalTitheEl) insightTotalTitheEl.innerText = '₦0';
        if (insightPaidTitheEl) insightPaidTitheEl.innerText = '₦0';
        if (insightRemainingTitheEl) insightRemainingTitheEl.innerText = '₦0';
    }
}

// --- 7. UTILS ---
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function initApp() {
    if (entryType) {
        updateOptions();
        entryType.addEventListener('change', updateOptions);
    }

    if (document.getElementById('table-body')) {
        loadData(currentDataType);
    }

    calculateNetProfit();
}

document.addEventListener('DOMContentLoaded', initApp);