// main.js
// =============================
// Import funkcji API i grafu
import { 
    fetchBackendStatus, fetchPortfolio, fetchPortfolioGraph, 
    fetchAssets, fetchCorrelations, fetchRisk, fetchPortfolioValue,
    fetchPortfolioAdd, fetchPortfolioUpdate, fetchPortfolioRemove
} from './api.js';
import { drawPortfolioGraph } from './graph.js';


// =============================
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

// =============================
// Wartość portfela 
async function updatePortfolioValue() {
    try {
        const result = await fetchPortfolioValue();
        const total = Number(result.value ?? 0);
        document.getElementById('portfolio-amount').textContent = total.toFixed(2);
    } catch (err) {
        console.error("Błąd wartości portfela:", err);
        document.getElementById('portfolio-amount').textContent = "błąd";
    }
}
// setInterval(updatePortfolioValue, 10000);
// updatePortfolioValue();


// =============================
// Dashboard – status backendu
window.addEventListener('DOMContentLoaded', async () => {
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

    container.appendChild(icon);
    container.appendChild(text);
});

// =============================
// Dashboard
async function loadDashboard() {
    await updatePortfolioValue();
}
// =============================
// Portfel
async function loadPortfolioTable() {
    const portfolio = await fetchPortfolio();
    renderPortfolioTable(portfolio);
}

async function loadPortfolioGraph() {
    const portfolioGraph = await fetchPortfolioGraph();
    const nodes = portfolioGraph.nodes.map(a => ({ id: a.asset_id, name: a.name }));
    const links = portfolioGraph.links.map(l => ({ source: l.source, target: l.target, value: l.value }));
    drawPortfolioGraph({ nodes, links });
}

async function loadPortfolio() {
    await loadPortfolioTable();
    await loadPortfolioGraph();
    await updatePortfolioValue();
    initPortfolioButton();
}

// =============================
// Aktywa
async function loadAssets() {
    await loadAssetsTab();
    await updatePortfolioValue();
    initRiskButton();
}
// =============================
// Modal dodawania aktywa
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


// =============================
// Render tabeli portfela
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
        { label: "Wartość pozycji", key: "value" },
        { label: "", key: "actions" }
    ];

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.style.padding = '8px';
        th.style.border = '1px solid #ccc';
        th.style.background = '#f2f2f2';
        
        if (col.key === "actions") {
            // Tutaj wstaw przycisk zamiast pustego tekstu
            const btnAdd = document.createElement('button');
            btnAdd.innerText = "Dodaj nowe aktywo";
            btnAdd.style.width = "100%";
            btnAdd.style.backgroundColor = '#4b9762ff';; // zielone tło
            btnAdd.style.color = "white";           // biały tekst
            btnAdd.style.border = "none";           // opcjonalnie usuń obramowanie
            btnAdd.style.padding = "4px 8px";       // dopasowanie do rozmiaru
            btnAdd.style.borderRadius = "4px";      // lekko zaokrąglone rogi
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

    // columns.forEach(col => {
    //     const th = document.createElement('th');
    //     th.style.padding = '8px';
    //     th.style.border = '1px solid #ccc';
    //     th.style.background = '#f2f2f2';
    //     th.innerText = col.label;

    //     if (col.key !== "actions") {
    //         th.style.cursor = "pointer";
    //         const arrowBox = document.createElement('span');
    //         arrowBox.className = "sort-arrow-box";
    //         arrowBox.style.position = 'absolute';
    //         arrowBox.style.right = '8px';
    //         arrowBox.style.top = '50%';
    //         arrowBox.style.transform = 'translateY(-50%)';
    //         arrowBox.innerHTML = `
    //             <span class="arrow-up neutral">▲</span>
    //             <span class="arrow-down neutral">▼</span>
    //         `;
    //         th.appendChild(arrowBox);

    //         th.addEventListener("click", () => {
    //             sortPortfolioTable(data, col.key);
    //             renderPortfolioTable(data);
    //         });
    //     }

    //     headerRow.appendChild(th);
    // });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    data.forEach(item => {
        const row = document.createElement('tr');

        // aktualna cena jednostkowa z backendu
        const unitPrice = Number(item.current_price ?? 0);
        const amount = Number(item.amount ?? 0);
        const positionValue = unitPrice * amount;

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

        // INPUT dla ilości
        const input = document.createElement('input');
        input.type = "number";
        input.step = "0.0001";
        input.value = amount;
        input.id = `amount-${item.asset_id}`;
        input.style.width = "80px";

        row.children[3].innerHTML = "";
        row.children[3].appendChild(input);

        // Akcje
        const actions = document.createElement('td');
        actions.style.border = '1px solid #ccc';
        actions.style.padding = '8px';
        actions.style.width = "120px";       // stała szerokość kolumny
        actions.style.textAlign = "center"; // wyśrodkowanie przycisków

        const btnUpdate = document.createElement('button');
        btnUpdate.innerText = "Aktualizuj";
        btnUpdate.style.display = "block";  // jeden pod drugim
        btnUpdate.style.width = "100%";
        btnUpdate.style.marginBottom = "4px"; // odstęp między przyciskami
        btnUpdate.style.backgroundColor = '#436fceff';; // zielone tło
        btnUpdate.style.color = "white";           // biały tekst
        btnUpdate.style.border = "none";           // opcjonalnie usuń obramowanie
        btnUpdate.style.padding = "4px 8px";       // dopasowanie do rozmiaru
        btnUpdate.style.borderRadius = "4px";      // lekko zaokrąglone rogi
        btnUpdate.onclick = () => updatePortfolio(item.asset_id);   

        const btnRemove = document.createElement('button');
        btnRemove.innerText = "Usuń";
        btnRemove.style.display = "block";
        btnRemove.style.width = "100%";
        btnRemove.style.marginBottom = "4px"; // odstęp między przyciskami
        btnRemove.style.backgroundColor = '#c46565ff';; // zielone tło
        btnRemove.style.color = "white";           // biały tekst
        btnRemove.style.border = "none";           // opcjonalnie usuń obramowanie
        btnRemove.style.padding = "4px 8px";       // dopasowanie do rozmiaru
        btnRemove.style.borderRadius = "4px";      // lekko zaokrąglone rogi
        btnRemove.style.textAlign = "center"; // tekst w środku
        btnRemove.onclick = () => removeFromPortfolio(item.asset_id);   

        actions.appendChild(btnUpdate);
        actions.appendChild(btnRemove);
        row.appendChild(actions);

        tbody.appendChild(row);
    });

    // const addRow = document.createElement('tr');
    // addRow.innerHTML = `
    //     <td colspan="6" style="text-align:center; padding:12px;">
    //         <button id="addNewAssetRowBtn">Dodaj nowe aktywo</button>
    //     </td>
    // `;
    // tbody.appendChild(addRow);

    table.appendChild(tbody);
    container.appendChild(table);

    // document.getElementById('addNewAssetRowBtn').onclick = () => openAddAssetModal();

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

        // ustawienie wielkości identycznej jak w aktywach
        up.style.fontSize = "12px";      // dopasuj do pożądanego rozmiaru
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


// =============================
// ASSETS LIST (risk_score zamiast grupy)
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
        { label: 'Cena', key: 'value' }
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

        // Risk scaling: jeśli backend zwraca 0..1 (lub 0..100), skalujemy do 0..100
        let rawRisk = a.risk_score;
        let riskScaled;
        if (rawRisk === null || rawRisk === undefined || isNaN(Number(rawRisk))) {
            riskScaled = '-';
        } else {
            let r = Number(rawRisk);
            // jeśli w [0,1] -> pomnóż przez 100
            if (r >= 0 && r <= 1) r = r * 100;
            // jeśli >100 -> clamp
            r = Math.max(0, Math.min(100, r));
            riskScaled = Math.round(r).toString();
        }

        const price = (a.value !== null && a.value !== undefined) ? Number(a.value).toFixed(2) : '-';

        [a.id, a.name, a.asset_class || '-', riskScaled, price].forEach(text => {
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
    const headers = ['id', 'name', 'asset_class', 'risk_score', 'value'];
    const ths = table.querySelectorAll('th');

    ths.forEach((th, idx) => {
        const up = th.querySelector('.arrow-up');
        const down = th.querySelector('.arrow-down');

        if (!up || !down) return;

        // Ustawienie tej samej wielkości jak w portfelu
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


// =============================
// Portfolio actions
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

    // ilość 0 = usuń
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


// =============================
// Korelacje
export async function loadCorrelations() {
    const btn = document.getElementById('computeCorrBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerText = 'Obliczanie...';

    try {
        await fetchCorrelations();
        await loadPortfolioGraph();
    } catch (err) {
        console.error("Błąd obliczania korelacji:", err);
        alert("Błąd przy obliczaniu korelacji");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Oblicz korelacje z ostatniego roku';
    }
}

export function initPortfolioButton() {
    const btn = document.getElementById('computeCorrBtn');
    if (btn && !btn.dataset.listenerAdded) {
        btn.dataset.listenerAdded = 'true';
        btn.addEventListener('click', loadCorrelations);
    }
}

// =============================
// Ryzyko aktywów — analogiczne 1:1 do korelacji
// =============================
export async function loadRiskScores() {
    const btn = document.getElementById('updateRiskBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerText = 'Obliczanie...';

    try {
        await fetchRisk();   // Twój backend
        await loadAssetsTab();  // odśwież tabelę po obliczeniach
    } catch (err) {
        console.error("Błąd obliczania ryzyka:", err);
        alert("Błąd przy obliczaniu ryzyka");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Oblicz ryzyko aktywów';
    }
}

export function initRiskButton() {
    const btn = document.getElementById('updateRiskBtn');
    if (btn && !btn.dataset.listenerAdded) {
        btn.dataset.listenerAdded = 'true';
        btn.addEventListener('click', loadRiskScores);
    }
}