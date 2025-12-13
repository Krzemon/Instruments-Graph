import { 
    fetchBackendStatus, fetchPortfolio, fetchPortfolioGraph, 
    fetchAssets, fetchCorrelations, fetchRisk, fetchAssetsValuePLN,
    fetchPortfolioAdd, fetchPortfolioUpdate, fetchPortfolioRemove,
    fetchAddAsset, fetchRemoveAsset, 
} from './api.js';
import { drawPortfolioGraph } from './graph.js';
import { drawPortfolioPieChart } from './pieChart.js';

// Zakładki SPA
document.querySelectorAll('nav ul li').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('nav ul li').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));

        tab.classList.add('active');

        const activeTab = document.getElementById(tab.dataset.tab);
        activeTab.classList.add('active');

        if (tab.dataset.tab === "portfolio") loadPortfolio();
        if (tab.dataset.tab === "assets") loadAssets();
        if (tab.dataset.tab === "dashboard") loadDashboard();
    });
});

// Wartość portfela 
async function updatePortfolioValue() {
    try {
        // Pobieramy listę aktywów z wartością w PLN
        const assetsPLN = await fetchAssetsValuePLN(); // [{asset_id, value_pln}, ...]

        // Sumujemy wszystkie wartości
        const total = assetsPLN.reduce((sum, a) => sum + (a.value_pln || 0), 0);

        // Wyświetlamy wartość portfela
        document.getElementById('portfolio-amount').textContent = total.toFixed(2);
    } catch (err) {
        console.error("Błąd wartości portfela:", err);
        document.getElementById('portfolio-amount').textContent = "błąd";
    }
}

// Sprawdza status połączenia
async function updateBackendStatus() {
    const status = await fetchBackendStatus();
    const container = document.getElementById('backend-status');
    container.innerHTML = '';

    const icon = document.createElement('span');
    icon.style.display='inline-block';
    icon.style.width='16px';
    icon.style.height='16px';
    icon.style.borderRadius='50%';
    icon.style.background = status.neo4j_connection ? 'green' : 'red';

    const text = document.createElement('span');
    text.innerText = status.neo4j_connection ? 'Połączono z bazą Neo4j' : 'Brak połączenia z bazą';
    text.style.marginLeft = '8px'; // odstęp od ikony

    container.appendChild(icon);
    container.appendChild(text);
}

async function loadPortfolioGraph() {
    const portfolioGraph = await fetchPortfolioGraph();
    const nodes = portfolioGraph.nodes.map(a => ({ id: a.asset_id, name: a.name }));
    const links = portfolioGraph.links.map(l => ({ source: l.source, target: l.target, value: l.value }));
    drawPortfolioGraph({ nodes, links });
}

async function loadPortfolioTable() {
    try {
        const portfolio = await fetchPortfolio();
        const assetsPLN = await fetchAssetsValuePLN();
        const assetMap = {};
        assetsPLN.forEach(a => {
            assetMap[a.asset_id] = a.value_pln ?? 0;
        });

        const mergedData = portfolio.map(p => ({
            ...p,
            value_pln: assetMap[p.asset_id] ?? 0
        }));
        renderPortfolioTable(mergedData);
    } catch (err) {
        console.error("Błąd ładowania tabeli portfela:", err);
    }
}

async function updatePortfolioRisk() {
    try {
        const assets = await fetchAssets(); // tu są prawdziwe risk_score i wartości
        const assetsValuePLN = await fetchAssetsValuePLN();
        const valueMap = {};
        assetsValuePLN.forEach(a => valueMap[a.asset_id] = a.value_pln);

        let totalValue = 0;
        let weightedRisk = 0;

        assets.forEach(a => {
            const valuePLN = valueMap[a.id] ?? 0;
            const risk = Number(a.risk_score ?? 0);
            weightedRisk += risk * valuePLN;
            totalValue += valuePLN;
        });

        const portfolioRisk = totalValue ? Math.round(weightedRisk / totalValue) : 0;

        const riskContainer = document.getElementById('portfolio-risk');
        riskContainer.innerHTML = `<strong>Ryzyko portfela:</strong> ${portfolioRisk}/100`;

    } catch (err) {
        console.error("Błąd liczenia ryzyka portfela:", err);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

// -------------------------------------
// Zakładka Dashboard
async function loadDashboard() {
    try {
        await updatePortfolioValue();
        await updateBackendStatus();
        const assetsPLN = await fetchAssetsValuePLN();
        const portfolio = await fetchPortfolio();
        const classTotals = {};
        const assetMap = {};
        assetsPLN.forEach(a => {
            const p = portfolio.find(pf => pf.asset_id === a.asset_id);
            const cls = (p?.asset_class || "Inne");
            classTotals[cls] = (classTotals[cls] || 0) + (a.value_pln || 0);
            assetMap[a.asset_id] = { ...p, value_pln: a.value_pln };
        });
        const totalValue = Object.values(classTotals).reduce((sum, v) => sum + v, 0) || 1;
        const classDistribution = Object.entries(classTotals).map(([cls, val]) => ({
            class: cls,
            value: val,
            percent: (val / totalValue * 100)
        }));
        drawPortfolioPieChart(classDistribution);
    } catch (err) {
        console.error("Błąd ładowania dashboardu:", err);
    }
}

// Zakładka Portfel
async function loadPortfolio() {
    await loadPortfolioTable();
    await loadPortfolioGraph();
    await updatePortfolioValue();
    await updatePortfolioRisk();
}

// Zakładka Aktywa
async function loadAssets() {
    await loadAssetsTab();
    await updatePortfolioValue();
    initRiskButton();
    initAssetButtons(); 
    initCorrelationsButton();
}

// Okno dodawania aktywa
window.openAddAssetModal = async function () {
    const assets = await fetchAssets();
    const classes = [...new Set(assets.map(a => a.asset_class || "-"))];

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" style="float:right;cursor:pointer;font-size:22px;">&times;</span>
            <h3>Dodaj nowe aktywo</h3>

            <label>Filtruj po klasie:</label>
            <select id="filterClass">
                <option value="">Wszystkie</option>
                ${classes.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>

            <label>Wybierz aktywo:</label>
            <select id="selectAsset">
                ${assets.map(a => `
                    <option value="${a.id}" data-class="${a.asset_class}">
                        ${a.id} – ${a.name}
                    </option>`
                ).join('')}
            </select>

            <label>Ilość:</label>
            <input type="number" id="newAmount" min="0.0001" step="0.0001">

            <button id="confirmAdd">Dodaj</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = "flex";

    modal.querySelector('.close').onclick = () => modal.remove();

    const selectAsset = modal.querySelector('#selectAsset');
    const filterClass = modal.querySelector('#filterClass');

    filterClass.onchange = () => {
        const selected = filterClass.value;
        selectAsset.innerHTML = assets
            .filter(a => !selected || a.asset_class === selected)
            .map(a => `
                <option value="${a.id}" data-class="${a.asset_class}">
                    ${a.id} – ${a.name}
                </option>`
            ).join('');
    };

    modal.querySelector('#confirmAdd').onclick = async () => {
        const id = selectAsset.value;
        const amount = Number(modal.querySelector('#newAmount').value);

        if (!amount || amount <= 0) {
            alert("Podaj poprawną ilość");
            return;
        }

        try {
            await addToPortfolio(id, amount);
            modal.remove();
            await loadPortfolio();
        } catch (err) {
            console.error(err);
            alert('Błąd przy dodawaniu aktywa do portfela');
        }
    };
};

// tabela portfela
let portfolioSort = { column: null, asc: true };

function renderPortfolioTable(data) {
    const container = document.getElementById('portfolio-table');
    container.innerHTML = '';

    const table = document.createElement('table');
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    const columns = [
        { label: "ID", key: "asset_id" },
        { label: "Nazwa", key: "name" },
        { label: "Klasa", key: "asset_class" },
        { label: "Ilość", key: "amount" },
        { label: "Wartość w PLN", key: "value" },
        { label: "", key: "actions" }
    ];

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.style.padding = '8px';
        th.style.border = '1px solid #ccc';
        th.style.background = '#f2f2f2';

        if (col.key === "value") {
            th.innerHTML = col.label.replace(' ', '<br>');
        } else if (col.key === "actions") {
            const btnAdd = document.createElement('button');
            btnAdd.innerText = "Dodaj nowe aktywo";
            btnAdd.style.width = "100%";
            btnAdd.style.backgroundColor = '#4b9762ff';
            btnAdd.style.color = "white";
            btnAdd.style.border = "none";
            btnAdd.style.padding = "4px 8px";
            btnAdd.style.borderRadius = "4px";
            btnAdd.style.display = "block";
            btnAdd.onclick = () => openAddAssetModal();
            th.appendChild(btnAdd);
        } else {
            th.innerText = col.label;
            th.style.cursor = "pointer";

            const arrowBox = document.createElement('span');
            arrowBox.className = "sort-arrow-box";
            arrowBox.style.position = 'absolute';
            arrowBox.style.right = '8px';
            arrowBox.style.top = '50%';
            arrowBox.style.transform = 'translateY(-50%)';
            arrowBox.innerHTML = `
                <span class="arrow-up neutral">▲</span>
                <span class="arrow-down neutral">▼</span>
            `;
            th.appendChild(arrowBox);

            th.addEventListener("click", () => {
                sortPortfolioTable(data, col.key);
                renderPortfolioTable(data);
            });
        }

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    data.forEach(item => {
        const row = document.createElement('tr');
        const amount = Number(item.amount ?? 0);
        const positionValue = Number(item.value_pln ?? 0);

        [
            item.asset_id,
            item.name,
            item.asset_class,
            amount,
            positionValue.toFixed(2)
        ].forEach((text, idx) => {
            const td = document.createElement('td');
            td.style.border = '1px solid #ccc';
            td.style.padding = '8px';
            td.innerText = text;
            if(idx === 4) td.style.textAlign = "right";
            row.appendChild(td);
        });

        // Input do edycji ilości i przyciski akcji pozostają bez zmian
        const input = document.createElement('input');
        input.type = "number";
        input.step = "0.0001";
        input.value = amount;
        input.id = `amount-${item.asset_id}`;
        input.style.width = "80px";
        row.children[3].innerHTML = "";
        row.children[3].appendChild(input);

        const actions = document.createElement('td');
        actions.style.border = '1px solid #ccc';
        actions.style.padding = '8px';
        actions.style.width = "120px";
        actions.style.textAlign = "center";

        const btnUpdate = document.createElement('button');
        btnUpdate.innerText = "Aktualizuj";
        btnUpdate.style.display = "block";
        btnUpdate.style.width = "100%";
        btnUpdate.style.marginBottom = "4px";
        btnUpdate.style.backgroundColor = '#436fceff';
        btnUpdate.style.color = "white";
        btnUpdate.style.border = "none";
        btnUpdate.style.padding = "4px 8px";
        btnUpdate.style.borderRadius = "4px";
        btnUpdate.onclick = () => updatePortfolio(item.asset_id);   

        const btnRemove = document.createElement('button');
        btnRemove.innerText = "Usuń";
        btnRemove.style.display = "block";
        btnRemove.style.width = "100%";
        btnRemove.style.marginBottom = "4px";
        btnRemove.style.backgroundColor = '#c46565ff';
        btnRemove.style.color = "white";
        btnRemove.style.border = "none";
        btnRemove.style.padding = "4px 8px";
        btnRemove.style.borderRadius = "4px";
        btnRemove.style.textAlign = "center";
        btnRemove.onclick = () => removeFromPortfolio(item.asset_id);   

        actions.appendChild(btnUpdate);
        actions.appendChild(btnRemove);
        row.appendChild(actions);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    updatePortfolioSortArrows(table);
}

function sortPortfolioTable(data, column) {
    if (portfolioSort.column === column) {
        portfolioSort.asc = !portfolioSort.asc;
    } else {
        portfolioSort.column = column;
        portfolioSort.asc = true;
    }

    data.sort((a, b) => {
        let A, B;

        if (column === "value") {
            A = (Number(a.current_price) || 0) * (Number(a.amount) || 0);
            B = (Number(b.current_price) || 0) * (Number(b.amount) || 0);
        } else {
            A = a[column] ?? '';
            B = b[column] ?? '';
        }

        const numA = parseFloat(A);
        const numB = parseFloat(B);
        const numeric = !isNaN(numA) && !isNaN(numB);

        if (numeric) {
            A = numA; B = numB;
        } else {
            A = String(A).toLowerCase();
            B = String(B).toLowerCase();
        }

        if (A < B) return portfolioSort.asc ? -1 : 1;
        if (A > B) return portfolioSort.asc ? 1 : -1;
        return 0;
    });
}

function updatePortfolioSortArrows(table) {
    const headers = ["asset_id", "name", "asset_class", "amount", "value"];
    const ths = table.querySelectorAll('th');

    ths.forEach((th, idx) => {
        const up = th.querySelector('.arrow-up');
        const down = th.querySelector('.arrow-down');
        if (!up || !down) return;

        up.style.fontSize = "12px";
        down.style.fontSize = "12px";
        up.style.lineHeight = "12px";
        down.style.lineHeight = "12px";

        up.style.opacity = "0.5";
        down.style.opacity = "0.5";
        up.style.color = "#777";
        down.style.color = "#777";

        const key = headers[idx];
        if (key !== portfolioSort.column) return;

        if (portfolioSort.asc) {
            up.style.opacity = "1";
            up.style.color = "black";
            down.style.opacity = "0";
        } else {
            down.style.opacity = "1";
            down.style.color = "black";
            up.style.opacity = "0";
        }
    });
}

// tabela aktywów
let assetSort = { column: null, asc: true };

async function loadAssetsTab() {
    const data = await fetchAssets();
    const container = document.getElementById('assets-list');
    container.innerHTML = '';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const columns = [
        { label: 'ID', key: 'id' },
        { label: 'Nazwa', key: 'name' },
        { label: 'Klasa', key: 'asset_class' },
        { label: 'Ryzyko', key: 'risk_score' },
        { label: 'Cena', key: 'value' },
        { label: 'Waluta', key: 'currency' }
    ];

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.style.border = '1px solid #ccc';
        th.style.padding = '8px';
        th.style.backgroundColor = '#f2f2f2';
        th.style.cursor = 'pointer';
        th.style.position = 'relative';
        th.innerText = col.label;

        const arrowBox = document.createElement('span');
        arrowBox.className = 'sort-arrow-box';
        arrowBox.style.position = 'absolute';
        arrowBox.style.right = '8px';
        arrowBox.style.top = '50%';
        arrowBox.style.transform = 'translateY(-50%)';
        arrowBox.style.display = 'flex';
        arrowBox.style.flexDirection = 'column';

        arrowBox.innerHTML = `
            <span class="arrow-up neutral">▲</span>
            <span class="arrow-down neutral">▼</span>
        `;

        th.appendChild(arrowBox);

        th.addEventListener('click', () => {
            sortAssets(data, col.key);
            renderAssetsTable(data, table);
        });

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    renderAssetsTable(data, table);
    container.appendChild(table);
}

function renderAssetsTable(data, table) {
    if (!table) table = document.querySelector('#assets-list table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();

    const tbody = document.createElement('tbody');

    data.forEach(a => {
        const row = document.createElement('tr');

        let rawRisk = a.risk_score;
        let riskScaled;
        if (rawRisk === null || rawRisk === undefined || isNaN(Number(rawRisk))) {
            riskScaled = '-';
        } else {
            let r = Number(rawRisk);
            if (r >= 0 && r <= 1) r = r * 100;
            r = Math.max(0, Math.min(100, r));
            riskScaled = Math.round(r).toString();
        }

        const price = (a.value !== null && a.value !== undefined) ? Number(a.value).toFixed(2) : '-';

        [a.id, a.name, a.asset_class, riskScaled, price, a.currency].forEach(text => {
            const td = document.createElement('td');
            td.innerText = text;
            td.style.border = '1px solid #ccc';
            td.style.padding = '8px';
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    updateAssetSortArrows(table);
}

function sortAssets(data, column) {
    if (assetSort.column === column) {
        assetSort.asc = !assetSort.asc;
    } else {
        assetSort.column = column;
        assetSort.asc = true;
    }

    data.sort((a, b) => {
        let A = a[column] ?? '';
        let B = b[column] ?? '';
        const numA = parseFloat(A);
        const numB = parseFloat(B);
        const numeric = !isNaN(numA) && !isNaN(numB);

        if (numeric) { A = numA; B = numB; } 
        else { A = String(A).toLowerCase(); B = String(B).toLowerCase(); }

        if (A < B) return assetSort.asc ? -1 : 1;
        if (A > B) return assetSort.asc ? 1 : -1;
        return 0;
    });
}

function updateAssetSortArrows(table) {
    const headers = ['id', 'name', 'asset_class', 'risk_score', 'value', 'currency'];
    const ths = table.querySelectorAll('th');

    ths.forEach((th, idx) => {
        const up = th.querySelector('.arrow-up');
        const down = th.querySelector('.arrow-down');

        if (!up || !down) return;

        up.style.fontSize = "12px";
        down.style.fontSize = "12px";
        up.style.lineHeight = "12px";
        down.style.lineHeight = "12px";

        up.style.opacity = "0.5";
        down.style.opacity = "0.5";
        up.style.color = "#777";
        down.style.color = "#777";

        const key = headers[idx];
        if (key !== assetSort.column) return;

        if (assetSort.asc) {
            up.style.opacity = "1";
            up.style.color = "black";
            down.style.opacity = "0";
        } else {
            down.style.opacity = "1";
            down.style.color = "black";
            up.style.opacity = "0";
        }
    });
}

// -------------------------------------
window.addToPortfolio = async function(asset_id, amount) {
    try {
        await fetchPortfolioAdd(asset_id, amount);
        await loadPortfolio();
    } catch (err) {
        console.error(err);
        alert("Błąd dodawania aktywa");
    }
};

window.updatePortfolio = async function(asset_id) {
    const amount = Number(document.getElementById(`amount-${asset_id}`).value);

    if (isNaN(amount) || amount < 0) {
        alert("Nieprawidłowa ilość");
        return;
    }
    if (amount === 0) {
        await removeFromPortfolio(asset_id);
        return;
    }
    try {
        await fetchPortfolioUpdate(asset_id, amount);
        await loadPortfolio();
    } catch (err) {
        console.error(err);
        alert("Błąd aktualizacji pozycji");
    }
};

window.removeFromPortfolio = async function(asset_id) {
    if (!confirm(`Czy na pewno chcesz usunąć ${asset_id}?`)) return;

    try {
        await fetchPortfolioRemove(asset_id);
        await loadPortfolio();
    } catch (err) {
        console.error(err);
        alert("Błąd usuwania pozycji");
    }
};


// Korelacje
async function loadCorrelations() {
    const btn = document.getElementById('computeCorrBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = 'Obliczanie...';

    try {
        await fetchCorrelations();
        // await loadPortfolioGraph();
    } catch (err) {
        console.error("Błąd obliczania korelacji:", err);
        alert("Błąd przy obliczaniu korelacji");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Oblicz korelacje';
    }
}

function initCorrelationsButton() {
    const btn = document.getElementById('computeCorrBtn');
    if (btn && !btn.dataset.listenerAdded) {
        btn.dataset.listenerAdded = 'true';
        btn.addEventListener('click', loadCorrelations);
    }
}

async function loadRiskScores() {
    const btn = document.getElementById('updateRiskBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerText = 'Obliczanie...';

    try {
        await fetchRisk();
        await loadAssetsTab();
    } catch (err) {
        console.error("Błąd obliczania ryzyka:", err);
        alert("Błąd przy obliczaniu ryzyka");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Oblicz ryzyko aktywów';
    }
}

function initRiskButton() {
    const btn = document.getElementById('updateRiskBtn');
    if (btn && !btn.dataset.listenerAdded) {
        btn.dataset.listenerAdded = 'true';
        btn.addEventListener('click', loadRiskScores);
    }
}

async function handleAddAsset() {
    const id = prompt("Podaj ID aktywa (unikalne):")?.trim();
    if (!id) return alert("ID aktywa jest wymagane");

    const name = prompt("Podaj nazwę aktywa:")?.trim();
    if (!name) return alert("Nazwa aktywa jest wymagana");

    const asset_class = prompt(
        "Podaj klasę aktywa (np. Akcje, Kryptowaluty, Surowce, Forex, Obligacje):"
    )?.trim();

    if (!asset_class) return alert("Klasa aktywa jest wymagana");

    const asset = { id, name, asset_class };

    const ticker = prompt("Podaj ticker aktywa (opcjonalnie):")?.trim();
    if (ticker) asset.ticker = ticker;

    const currency = prompt("Podaj walutę (domyślnie USD):")?.trim();
    if (currency) asset.currency = currency;

    try {
        const res = await fetchAddAsset(asset);
        alert(res.message);
        await loadAssetsTab();
    } catch (err) {
        console.error("Błąd dodawania aktywa:", err);
        alert("Nie udało się dodać aktywa");
    }
}

async function handleRemoveAsset() {
    const asset_id = prompt("Podaj ID aktywa do usunięcia:")?.trim();
    if (!asset_id) return;

    if (!confirm(`Czy na pewno chcesz usunąć aktywo ${asset_id}?`)) return;

    try {
        const res = await fetchRemoveAsset(asset_id);
        alert(res.message);
        await loadAssetsTab();
    } catch (err) {
        console.error("Błąd usuwania aktywa:", err);
        alert("Nie udało się usunąć aktywa");
    }
}

function initAssetButtons() {
    const addBtn = document.getElementById('addAssetBtn');
    if (addBtn && !addBtn.dataset.listenerAdded) {
        addBtn.dataset.listenerAdded = 'true';
        addBtn.addEventListener('click', handleAddAsset);
    }
    const removeBtn = document.getElementById('removeAssetBtn');
    if (removeBtn && !removeBtn.dataset.listenerAdded) {
        removeBtn.dataset.listenerAdded = 'true';
        removeBtn.addEventListener('click', handleRemoveAsset);
    }
}