// =============================
// API — pełna obsługa backendu
// =============================

const BASE = "http://localhost:8000";

// Status backendu / Neo4j
export async function fetchBackendStatus() {
    const res = await fetch(`${BASE}/`);
    return await res.json();
}

// Pobranie wszystkich aktywów
export async function fetchAssets() {
    const res = await fetch(`${BASE}/assets`);
    return await res.json();
}

// Pobranie portfela
export async function fetchPortfolio() {
    const res = await fetch(`${BASE}/portfolio`);
    return await res.json();
}

// Pobranie grafu portfela
export async function fetchPortfolioGraph() {
    const res = await fetch(`${BASE}/portfolio/graph`);
    return await res.json();
}

// Liczenie korelacji
export async function fetchCorrelations() {
    const res = await fetch(`${BASE}/calculate-correlations`);
    return await res.json();
}

// Liczenie ryzyka
export async function fetchRisk() {
    const res = await fetch(`${BASE}/update-risk`);
    return await res.json();
}

// Wartość portfela
export async function fetchPortfolioValue() {
    const res = await fetch(`${BASE}/portfolio/value`);
    return await res.json();
}

// Usuń aktywo
export async function fetchRemoveAsset(asset_id) {
    return await fetch(`${BASE}/assets/${asset_id}`, {
        method: "DELETE"
    }).then(r => r.json());
}

// =============================
// PORTFOLIO OPERATIONS
// =============================

// Dodaj lub zaktualizuj aktywo
export async function fetchAddAsset(asset) {
    return await fetch(`${BASE}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset)
    }).then(r => r.json());
}

// Dodaj aktywo do portfela
export async function fetchPortfolioAdd(asset_id, amount) {
    return await fetch(`${BASE}/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id, amount })
    }).then(r => r.json());
}

// Aktualizuj ilość
export async function fetchPortfolioUpdate(asset_id, amount) {
    return await fetch(`${BASE}/portfolio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id, amount })
    }).then(r => r.json());
}

// Usuń aktywo z portfela
export async function fetchPortfolioRemove(asset_id) {
    return await fetch(`${BASE}/portfolio/${asset_id}`, {
        method: "DELETE"
    }).then(r => r.json());
}

// =============================
// Pobranie procentowej wartości klas aktywów w portfelu
// =============================
export async function fetchPortfolioClassDistribution() {
    const res = await fetch(`${BASE}/portfolio/class-distribution`);
    if (!res.ok) throw new Error("Błąd pobierania danych o klasach aktywów");
    return await res.json(); // zwróci tablicę obiektów {class, value, percent}
}