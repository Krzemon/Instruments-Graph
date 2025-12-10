export async function fetchBackendStatus() {
    const res = await fetch('http://localhost:8000/');
    return await res.json();
}

export async function fetchAssets() {
    const res = await fetch('http://localhost:8000/assets');
    return await res.json();
}

export async function fetchPortfolio() {
    const res = await fetch('http://localhost:8000/portfolio');
    return await res.json();
}

export async function fetchPortfolioGraph() {
    const res = await fetch('http://localhost:8000/portfolio/graph');
    return await res.json();
}

export async function fetchTopCorrelated(asset_id) {
    const res = await fetch(`http://localhost:8000/recommend/top_correlated/${asset_id}`);
    return await res.json();
}

export async function fetchDiversifiers() {
    const res = await fetch('http://localhost:8000/recommend/diversifiers');
    return await res.json();
}

export async function fetchCorrelations() {
    const res = await fetch('http://localhost:8000/calculate-correlations');
    return await res.json();
}