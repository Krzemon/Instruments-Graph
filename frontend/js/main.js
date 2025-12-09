// =============================
// Import funkcji API i grafu
import { fetchBackendStatus, fetchPortfolio, fetchPortfolioGraph, fetchAssets, fetchDiversifiers } from './api.js';
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
}

// Funkcja otwierająca modal z listą wszystkich aktywów
window.openAddAssetModal = async function () {
    const res = await fetch('http://localhost:8000/assets');
    const assets = await res.json();

    const modal = document.createElement('div');
    modal.className = 'modal';   // ma display:none w CSS
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" style="float:right;cursor:pointer;font-size:22px;">&times;</span>
            <h3>Dodaj nowe aktywo</h3>

            <label>Wybierz aktywo:</label>
            <select id="selectAsset">
                ${assets.map(a => `<option value="${a.id}">${a.id} – ${a.name}</option>`).join('')}
            </select>

            <label>Ilość:</label>
            <input type="number" id="newAmount" min="0.01" step="0.01">

            <button id="confirmAdd">Dodaj</button>
        </div>
    `;

    document.body.appendChild(modal);

    // 🔥 KLUCZOWE — włącz modal
    modal.style.display = "flex";

    modal.querySelector('.close').onclick = () => modal.remove();

    modal.querySelector('#confirmAdd').onclick = async () => {
        const id = document.getElementById('selectAsset').value;
        const amount = Number(document.getElementById('newAmount').value);

        if (!amount || amount <= 0) {
            alert("Podaj poprawną ilość");
            return;
        }

        await addToPortfolio(id, amount);
        modal.remove();
    };
};

// Renderowanie tabeli z CRUD
function renderPortfolioTable(data) {
    const container = document.getElementById('portfolio-table');
    container.innerHTML = '';

    const table = document.createElement('table');
    const header = document.createElement('tr');
    header.innerHTML = `
        <th class="id-col">ID</th>
        <th class="name-col">Nazwa</th>
        <th class="amount-col">Ilość</th>
        <th class="price-col">Cena</th>
        <th class="actions-col">Akcje</th>
    `;
    table.appendChild(header);

    // Wiersze portfela
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="id-col">${item.asset_id}</td>
            <td class="name-col">${item.name}</td>
            <td class="amount-col">
                <input type="number" value="${item.amount}" min="0" id="amount-${item.asset_id}">
            </td>
            <td class="price-col">${item.current_price}</td>
            <td class="actions-col">
                <button onclick="updatePortfolio('${item.asset_id}')">Aktualizuj</button>
                <button onclick="removeFromPortfolio('${item.asset_id}')">Usuń</button>
            </td>
        `;
        table.appendChild(row);
    });

    // Dodawanie nowego aktywa przez modal
    const addRow = document.createElement('tr');
    addRow.innerHTML = `
        <td colspan="5" class="add-row">
            <button onclick="openAddAssetModal()">Dodaj nowe aktywo</button>
        </td>
    `;
    table.appendChild(addRow);

    container.appendChild(table);
}

// =============================
// Zakładka Aktywa
async function loadAssets() {
    const data = await fetchAssets();
    const container = document.getElementById('assets-list');
    container.innerHTML = '<h3>Lista aktywów:</h3>';

    const ul = document.createElement('ul');
    data.forEach(a => {
        const li = document.createElement('li');
        li.innerText = `${a.id} - ${a.name} | Typ: ${a.type || '-'} | Cena: ${a.value ?? '-'}`;
        ul.appendChild(li);
    });
    container.appendChild(ul);
}

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

