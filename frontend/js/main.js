// =============================
// Import funkcji API i grafu
import { fetchBackendStatus, fetchPortfolio, fetchPortfolioGraph, fetchAssets, fetchDiversifiers, fetchCorrelations } from './api.js';
import { drawPortfolioGraph } from './graph.js';

// =============================
// Zakładki SPA
document.querySelectorAll('nav ul li').forEach(tab => {
    tab.addEventListener('click', () => {
        // Reset aktywnej zakładki
        document.querySelectorAll('nav ul li').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');

        // Wywołanie funkcji ładowania danych dla zakładki
        if (tab.dataset.tab === "portfolio") loadPortfolio();
        if (tab.dataset.tab === "assets") loadAssets();
        if (tab.dataset.tab === "recommend") loadRecommendations();
    });
});


// =============================
// Wartość portfela 
async function updatePortfolioValue() {
    try {
        const response = await fetch('/api/portfolio/value'); // Twój endpoint
        if (!response.ok) throw new Error('Błąd pobierania wartości portfela');
        const data = await response.json();
        document.getElementById('portfolio-value').textContent = `Wartość: ${data.value} zł`;
    } catch (error) {
        console.error(error);
        document.getElementById('portfolio-value').textContent = 'Wartość: błąd';
    }
}

// Odświeżanie wartości co np. 10 sekund
setInterval(updatePortfolioValue, 10000);
updatePortfolioValue(); // od razu przy ładowaniu

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
// Portfel

async function loadPortfolioTable() {
    const portfolio = await fetchPortfolio();
    renderPortfolioTable(portfolio);
}

async function loadPortfolioGraph() {
    const portfolioGraph = await fetchPortfolioGraph(); // nodes + links
    const nodes = portfolioGraph.nodes.map(a => ({ id: a.asset_id, name: a.name }));
    const links = portfolioGraph.links.map(l => ({ source: l.source, target: l.target, value: l.value }));
    drawPortfolioGraph({ nodes, links });
}

// Ładowanie całej zakładki
async function loadPortfolio() {
    loadPortfolioTable();
    loadPortfolioGraph();
    initPortfolioButton();
}

// Funkcja otwierająca modal z listą wszystkich aktywów

// window.openAddAssetModal = async function () {
//     const res = await fetch('http://localhost:8000/assets');
//     const assets = await res.json();

//     const modal = document.createElement('div');
//     modal.className = 'modal';   // ma display:none w CSS
//     modal.innerHTML = `
//         <div class="modal-content">
//             <span class="close" style="float:right;cursor:pointer;font-size:22px;">&times;</span>
//             <h3>Dodaj nowe aktywo</h3>

//             <label>Wybierz aktywo:</label>
//             <select id="selectAsset">
//                 ${assets.map(a => `<option value="${a.id}">${a.id} – ${a.name}</option>`).join('')}
//             </select>

//             <label>Ilość:</label>
//             <input type="number" id="newAmount" min="0.01" step="0.01">

//             <button id="confirmAdd">Dodaj</button>
//         </div>
//     `;

//     document.body.appendChild(modal);

//     // 🔥 KLUCZOWE — włącz modal
//     modal.style.display = "flex";

//     modal.querySelector('.close').onclick = () => modal.remove();

//     modal.querySelector('#confirmAdd').onclick = async () => {
//         const id = document.getElementById('selectAsset').value;
//         const amount = Number(document.getElementById('newAmount').value);

//         if (!amount || amount <= 0) {
//             alert("Podaj poprawną ilość");
//             return;
//         }

//         await addToPortfolio(id, amount);
//         modal.remove();
//     };
// };

window.openAddAssetModal = async function () {
    const res = await fetch('http://localhost:8000/assets');
    const assets = await res.json();

    // lista unikalnych klas
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
            <input type="number" id="newAmount" min="0.01" step="0.01">

            <button id="confirmAdd">Dodaj</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = "flex";

    modal.querySelector('.close').onclick = () => modal.remove();

    const selectAsset = modal.querySelector('#selectAsset');
    const filterClass = modal.querySelector('#filterClass');

    // 🔍 FILTROWANIE PO KLASIE
    filterClass.onchange = () => {
        const selected = filterClass.value;

        selectAsset.innerHTML = assets
            .filter(a => !selected || a.asset_class === selected)
            .map(a => `
                <option value="${a.id}" data-class="${a.asset_class}">
                    ${a.id} – ${a.name}
                </option>`
            )
            .join('');
    };

    modal.querySelector('#confirmAdd').onclick = async () => {
        const id = selectAsset.value;
        const amount = Number(modal.querySelector('#newAmount').value);

        if (!amount || amount <= 0) {
            alert("Podaj poprawną ilość");
            return;
        }

        await addToPortfolio(id, amount);
        modal.remove();
    };
};


// ------------------
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
        { label: "Wartość", key: "current_price" },
        { label: "", key: "actions" }
    ];

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.style.position = 'relative';
        th.style.padding = '8px';
        th.style.background = '#f2f2f2';
        th.style.border = '1px solid #ccc';
        th.style.cursor = col.key !== "actions" ? 'pointer' : 'default';

        th.innerText = col.label;

        if (col.key !== "actions") {
            const arrowBox = document.createElement('span');
            arrowBox.className = 'sort-arrow-box';
            arrowBox.style.position = 'absolute';
            arrowBox.style.right = '8px';
            arrowBox.style.top = '50%';
            arrowBox.style.transform = 'translateY(-50%)';
            arrowBox.style.display = 'flex';
            arrowBox.style.flexDirection = 'column';
            arrowBox.style.lineHeight = '0.8em';
            arrowBox.style.userSelect = 'none';

            arrowBox.innerHTML = `
                <span class="arrow-up neutral">▲</span>
                <span class="arrow-down neutral">▼</span>
            `;

            th.appendChild(arrowBox);

            th.addEventListener('click', () => {
                sortPortfolioTable(data, col.key);
                renderPortfolioTable(data);
            });
        }

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement('tbody');

    data.forEach(item => {
        const price = item.current_price !== null && item.current_price !== undefined
            ? Number(item.current_price).toFixed(2)
            : '-';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="id-col">${item.asset_id}</td>
            <td class="name-col">${item.name}</td>
            <td class="class-col">${item.asset_class || '-'}</td>
            <td class="amount-col">
                <input type="number" value="${item.amount}" min="0" id="amount-${item.asset_id}">
            </td>
            <td class="price-col">${price}</td>
            <td class="actions-col">
                <button onclick="updatePortfolio('${item.asset_id}')">Aktualizuj</button>
                <button onclick="removeFromPortfolio('${item.asset_id}')">Usuń</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Dodawanie nowego aktywa
    const addRow = document.createElement('tr');
    addRow.innerHTML = `
        <td colspan="6" class="add-row">
            <button onclick="openAddAssetModal()">Dodaj nowe aktywo</button>
        </td>
    `;
    tbody.appendChild(addRow);

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
        let A = a[column] ?? '';
        let B = b[column] ?? '';

        const numA = parseFloat(A);
        const numB = parseFloat(B);

        const numeric = !isNaN(numA) && !isNaN(numB);

        if (numeric) {
            A = numA;
            B = numB;
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
    const headers = ["asset_id", "name", "asset_class", "amount", "current_price"];
    const ths = table.querySelectorAll('th');

    ths.forEach((th, idx) => {
        const up = th.querySelector('.arrow-up');
        const down = th.querySelector('.arrow-down');

        if (!up || !down) return;

        // Reset
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


// function renderPortfolioTable(data) {
//     const container = document.getElementById('portfolio-table');
//     container.innerHTML = '';

//     const table = document.createElement('table');
//     const header = document.createElement('tr');
//     header.innerHTML = `
//         <th class="id-col">ID</th>
//         <th class="name-col">Nazwa</th>
//         <th class="class-col">Klasa</th>
//         <th class="amount-col">Ilość</th>
//         <th class="price-col">Wartość</th>
//         <th class="actions-col"> </th>
//     `;
//     table.appendChild(header);

//     data.forEach(item => {
//         const price = (item.current_price !== null && item.current_price !== undefined)
//             ? Number(item.current_price).toFixed(2)
//             : '-';
//         const cls = item.asset_class || '-';

//         const row = document.createElement('tr');
//         row.innerHTML = `
//             <td class="id-col">${item.asset_id}</td>
//             <td class="name-col">${item.name}</td>
//             <td class="class-col">${cls}</td>
//             <td class="amount-col">
//                 <input type="number" value="${item.amount}" min="0" id="amount-${item.asset_id}">
//             </td>
//             <td class="price-col">${price}</td>
//             <td class="actions-col">
//                 <button onclick="updatePortfolio('${item.asset_id}')">Aktualizuj</button>
//                 <button onclick="removeFromPortfolio('${item.asset_id}')">Usuń</button>
//             </td>
//         `;
//         table.appendChild(row);
//     });

//     // Dodawanie nowego aktywa przez modal
//     const addRow = document.createElement('tr');
//     addRow.innerHTML = `
//         <td colspan="6" class="add-row">
//             <button onclick="openAddAssetModal()">Dodaj nowe aktywo</button>
//         </td>
//     `;
//     table.appendChild(addRow);

//     container.appendChild(table);
// }

// =============================
// Zakładka Aktywa
// async function loadAssets() {
//     const data = await fetchAssets();
//     const container = document.getElementById('assets-list');
//     container.innerHTML = '<h3>Lista aktywów:</h3>';

//     const ul = document.createElement('ul');
//     data.forEach(a => {
//         const price = (a.value !== null && a.value !== undefined) ? Number(a.value).toFixed(4) : '-';
//         const type = a.type || '-';
//         const group = a.group || '-';
//         const li = document.createElement('li');
//         // li.innerText = `${a.id} - ${a.name} | Typ: ${type} | Grupa: ${group} | Cena: ${price}`;
//         li.innerText = `${a.id} - ${a.name} | Klasa: ${a.asset_class || '-'} | Grupa: ${a.asset_group || '-'} | Cena: ${a.value ?? '-'}`;
//         ul.appendChild(li);
//     });
//     container.appendChild(ul);
// }



let assetSort = { column: null, asc: true };

async function loadAssets() {
    const data = await fetchAssets();
    const container = document.getElementById('assets-list');
    container.innerHTML = ''; // czyścimy

    // Tworzymy tabelę
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const columns = [
        { label: 'ID', key: 'id' },
        { label: 'Nazwa', key: 'name' },
        { label: 'Klasa', key: 'asset_class' },
        { label: 'Grupa', key: 'asset_group' },
        { label: 'Cena', key: 'value' }
    ];

    // THEAD
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.style.border = '1px solid #ccc';
        th.style.padding = '8px';
        th.style.textAlign = 'left';
        th.style.backgroundColor = '#f2f2f2';
        th.style.cursor = 'pointer';
        th.style.position = 'relative';

        // Tekst nagłówka
        th.innerText = col.label;

        // Box z dwiema strzałkami
        const arrowBox = document.createElement('span');
        arrowBox.className = 'sort-arrow-box';
        arrowBox.style.position = 'absolute';
        arrowBox.style.right = '8px';
        arrowBox.style.top = '50%';
        arrowBox.style.transform = 'translateY(-50%)';
        arrowBox.style.display = 'flex';
        arrowBox.style.flexDirection = 'column';
        arrowBox.style.lineHeight = '0.8em';
        arrowBox.style.userSelect = 'none';

        arrowBox.innerHTML = `
            <span class="arrow-up neutral">▲</span>
            <span class="arrow-down neutral">▼</span>
        `;

        th.appendChild(arrowBox);

        // Kliknięcie sortujące
        th.addEventListener('click', () => {
            sortAssets(data, col.key);
            loadAssetsRender(data); // render bez ponownego fetch
        });

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY (render osobno)
    loadAssetsRender(data, table);

    container.appendChild(table);
}


// Render samego TBODY
function loadAssetsRender(data, table = null) {
    if (!table) table = document.querySelector('#assets-list table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();

    const tbody = document.createElement('tbody');

    data.forEach(a => {
        const row = document.createElement('tr');

        const price =
            (a.value !== null && a.value !== undefined)
                ? Number(a.value).toFixed(4)
                : '-';

        const assetClass = a.asset_class || '-';
        const assetGroup = a.asset_group || '-';

        [a.id, a.name, assetClass, assetGroup, price].forEach(text => {
            const td = document.createElement('td');
            td.innerText = text;
            td.style.border = '1px solid #ccc';
            td.style.padding = '8px';
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);

    updateSortArrows(table);
}


// Sortowanie danych
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

        if (numeric) {
            A = numA;
            B = numB;
        } else {
            A = String(A).toLowerCase();
            B = String(B).toLowerCase();
        }

        if (A < B) return assetSort.asc ? -1 : 1;
        if (A > B) return assetSort.asc ? 1 : -1;
        return 0;
    });
}


// AKTUALIZACJA STRZAŁEK
function updateSortArrows(table) {
    const headers = ['id', 'name', 'asset_class', 'asset_group', 'value'];
    const ths = table.querySelectorAll('th');

    ths.forEach((th, idx) => {
        const up = th.querySelector('.arrow-up');
        const down = th.querySelector('.arrow-down');

        // Reset - obie neutralne
        up.classList.add('neutral');
        down.classList.add('neutral');

        up.style.opacity = "0.5";
        down.style.opacity = "0.5";

        up.style.color = "#777";
        down.style.color = "#777";

        const key = headers[idx];
        if (key !== assetSort.column) return;

        // Jeśli to ta kolumna — pokazujemy aktywną jedną strzałkę
        if (assetSort.asc) {
            up.classList.remove('neutral');
            up.style.opacity = "1";
            up.style.color = "black";

            down.style.opacity = "0";
        } else {
            down.classList.remove('neutral');
            down.style.opacity = "1";
            down.style.color = "black";

            up.style.opacity = "0";
        }
    });
}



// async function loadAssets() {
//     const data = await fetchAssets();
//     const container = document.getElementById('assets-list');
//     container.innerHTML = ''; // czyścimy zawartość

//     // Tworzymy tabelę
//     const table = document.createElement('table');
//     table.style.width = '100%';
//     table.style.borderCollapse = 'collapse';

//     // Nagłówki
//     const thead = document.createElement('thead');
//     const headerRow = document.createElement('tr');
//     ['ID', 'Nazwa', 'Klasa', 'Grupa', 'Cena'].forEach(text => {
//         const th = document.createElement('th');
//         th.innerText = text;
//         th.style.border = '1px solid #ccc';
//         th.style.padding = '8px';
//         th.style.textAlign = 'left';
//         th.style.backgroundColor = '#f2f2f2';
//         headerRow.appendChild(th);
//     });
//     thead.appendChild(headerRow);
//     table.appendChild(thead);

//     // Dane
//     const tbody = document.createElement('tbody');
//     data.forEach(a => {
//         const row = document.createElement('tr');

//         const price = (a.value !== null && a.value !== undefined) ? Number(a.value).toFixed(4) : '-';
//         const assetClass = a.asset_class || '-';
//         const assetGroup = a.asset_group || '-';

//         [a.id, a.name, assetClass, assetGroup, price].forEach(text => {
//             const td = document.createElement('td');
//             td.innerText = text;
//             td.style.border = '1px solid #ccc';
//             td.style.padding = '8px';
//             row.appendChild(td);
//         });

//         tbody.appendChild(row);
//     });
//     table.appendChild(tbody);

//     container.appendChild(table);
// }


// =============================
// Zakładka Rekomendacje
async function loadRecommendations() {
    const data = await fetchDiversifiers();
    const container = document.getElementById('recommend-list');
    container.innerHTML = '<h3>Dywersyfikatory portfela:</h3>';

    const ul = document.createElement('ul');
    data.forEach(item => {
        const li = document.createElement('li');
        li.innerText = `${item.id} - ${item.name} | średnia korelacja: ${item.avgCorr.toFixed(2)}`;
        ul.appendChild(li);
    });
    container.appendChild(ul);
}

// =============================
// CRUD funkcje globalne

// Dodanie aktywa do portfela
window.addToPortfolio = async function(asset_id, amount){
    await fetch(`http://localhost:8000/portfolio`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ asset_id, amount })
    });
    loadPortfolio();
}

window.updatePortfolio = async function(asset_id){
    const amount = Number(document.getElementById(`amount-${asset_id}`).value);

    if (amount === 0) {
        await removeFromPortfolio(asset_id);
        return;
    }

    await fetch(`http://localhost:8000/portfolio`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ asset_id, amount })
    });

    loadPortfolio();
}

window.removeFromPortfolio = async function(asset_id){
    await fetch(`http://localhost:8000/portfolio/${asset_id}`, {method:'DELETE'});
    loadPortfolio();
}



// ##########################################################################################

// Funkcja wywoływana po kliknięciu przycisku
export async function loadCorrelations() {
    const btn = document.getElementById('computeCorrBtn');
    btn.disabled = true;
    btn.innerText = 'Obliczanie...';

    try {
        // Wywołanie endpointu, który liczy korelacje i zapisuje w bazie
        await fetch('http://localhost:8000/calculate-correlations');
        console.log("✅ Korelacje obliczone i zapisane w bazie");
        // Odśwież graf portfela
        await loadPortfolioGraph();
    } catch (err) {
        console.error("Błąd obliczania korelacji:", err);
        alert("Błąd przy obliczaniu korelacji");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Oblicz korelacje z ostatniego roku';
    }
}

// Dodanie listenera przy ładowaniu zakładki
export function initPortfolioButton() {
    const btn = document.getElementById('computeCorrBtn');
    if (btn && !btn.dataset.listenerAdded) {
        btn.dataset.listenerAdded = 'true';
        btn.addEventListener('click', loadCorrelations);
    }
}