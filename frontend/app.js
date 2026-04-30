const API_URL = "http://localhost:5000";

// State Management for Editing
let currentEditId = null;
let currentEditType = null;
let currentEditSubtype = null;

// Element Selectors
const form = document.getElementById('business-form');
const entryType = document.getElementById('entry-type');
const subType = document.getElementById('sub-type');

// --- 1. DYNAMIC UI LOGIC ---
const updateOptions = () => {
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

entryType.addEventListener('change', updateOptions);

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

// --- 2. CREATE (POST) LOGIC ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = entryType.value;
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
async function loadData(type) {
    const path = type === 'transaction' ? '/transaction' : '/expenses';
    const tbody = document.getElementById('table-body');
    const thead = document.getElementById('table-head');
    
    tbody.innerHTML = "<tr><td colspan='6'>Loading records...</td></tr>";

    try {
        const res = await fetch(`${API_URL}${path}`);
        const result = await res.json();
        const data = result.data || result;

        thead.innerHTML = type === 'transaction' 
            ? `<th>Date</th><th>Info</th><th>Type</th><th>Amount</th><th>Tithe</th><th>Actions</th>`
            : `<th>Date</th><th>Item</th><th>Category</th><th>Amount</th><th>Actions</th>`;

        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.description || item.item}</td>
                <td>${item.transactionType || item.category}</td>
                <td>₦${Number(item.amount).toLocaleString()}</td>
                ${type === 'transaction' ? `<td>₦${Number(item.tithe).toLocaleString()}</td>` : ''}
                <td>
                    <button class="btn-edit" onclick="openEditModal('${item._id}', '${type}')">Edit</button>
                    <button class="btn-delete" onclick="deleteEntry('${item._id}', '${type}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='6'>Error loading data.</td></tr>";
    }
}

// --- 4. UPDATE (PUT) LOGIC ---
async function openEditModal(id, type) {
    currentEditId = id;
    currentEditType = type;
    const path = type === 'transaction' ? '/transaction' : '/expenses';

    try {
        const res = await fetch(`${API_URL}${path}/${id}`);
        const result = await res.json();
        const item = result.data || result;

        document.getElementById('edit-description').value = item.description || item.item;
        document.getElementById('edit-amount').value = item.amount;
        currentEditSubtype = item.transactionType || item.category;
        document.getElementById('edit-modal').style.display = 'flex';
    } catch (err) {
        showToast("Could not load data", "error");
    }
}

document.getElementById('save-edit-btn').onclick = async () => {
    const path = currentEditType === 'transaction' ? '/transaction' : '/expenses';
    const updatedData = { amount: Number(document.getElementById('edit-amount').value) };

    const editDescription = document.getElementById('edit-description').value.trim();
    const editAmount = Number(document.getElementById('edit-amount').value);
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
};

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
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

        const netProfit = netIncomeBeforeTithe - totalTithes;

        grossIncomeEl.innerText = `₦${grossIncome.toLocaleString()}`;
        totalExpensesEl.innerText = `₦${totalExpenses.toLocaleString()}`;
        totalTithesEl.innerText = `₦${totalTithes.toLocaleString()}`;
        netProfitEl.innerText = `₦${netProfit.toLocaleString()}`;
        navProfitEl.innerText = `₦${netProfit.toLocaleString()}`;
    } catch (err) {
        console.error('Profit calculation failed', err);
        grossIncomeEl.innerText = '₦0';
        totalExpensesEl.innerText = '₦0';
        totalTithesEl.innerText = '₦0';
        netProfitEl.innerText = '₦0';
        navProfitEl.innerText = '₦0';
    }
}

// --- 7. UTILS ---
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

// Start
updateOptions();
loadData('transaction');
calculateNetProfit();