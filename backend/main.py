from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neo4j_driver import run_query

app = FastAPI(title="Portfolio API")

# CORS do testów z frontendem
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# =============================
# MODELE DANYCH
# =============================
class AssetModel(BaseModel):
    id: str
    name: str
    type: str = None  # np. Akcje, Obligacje, Kryptowaluty
    value: float = 0.0  # aktualna cena

class PortfolioItemModel(BaseModel):
    asset_id: str
    amount: float  # ile jednostek użytkownik posiada

# =============================
# ENDPOINTY OGÓLNE - aktywa
# =============================

@app.get("/")
def status_check():
    """Sprawdzenie działania backendu oraz połączenia z bazą danych Neo4J"""
    try:
        run_query("RETURN 1 AS ok")
        return {"status": "ok", "neo4j_connection": True}
    except:
        return {"status": "error", "neo4j_connection": False}

@app.get("/assets")
def get_assets():
    """Pobranie wszystkich aktywów z bazy"""
    query = "MATCH (a:Asset) RETURN a.id AS id, a.name AS name, a.type AS type, a.value AS value"
    return run_query(query)

@app.post("/assets")
def add_asset(asset: AssetModel):
    """Dodanie nowego aktywa do bazy"""
    query = f"""
    MERGE (a:Asset {{id: '{asset.id}'}})
    SET a.name = '{asset.name}', a.type = '{asset.type}', a.value = {asset.value}
    """
    run_query(query)
    return {"message": f"Aktywo {asset.name} dodane/zmodyfikowane w bazie"}

@app.put("/assets/{asset_id}/price")
def update_asset_price(asset_id: str, price: float):
    """Aktualizacja ceny aktywa"""
    query = f"""
    MATCH (a:Asset {{id: '{asset_id}'}})
    MERGE (p:Price)  // jeśli chcesz mieć osobny node Price, lub można trzymać w Asset.value
    SET a.value = {price}
    """
    run_query(query)
    return {"message": f"Cena aktywa {asset_id} zaktualizowana na {price}"}

# =============================
# ENDPOINTY PORTFELU
# =============================
@app.get("/portfolio")
def get_portfolio():
    """Pobranie portfela użytkownika"""
    query = """
    MATCH (p:Portfolio {name:'MojPortfel'})-[r:CONTAINS]->(a:Asset)
    RETURN a.id AS asset_id, a.name AS name, r.amount AS amount, a.value AS current_price
    """
    return run_query(query)

@app.get("/portfolio/graph")
def get_portfolio_graph():
    """Zwraca węzły i krawędzie portfela dla grafu"""
    nodes_query = """
    MATCH (p:Portfolio {name:'MojPortfel'})-[r:CONTAINS]->(a:Asset)
    RETURN a.id AS asset_id, a.name AS name, r.amount AS amount, a.value AS current_price
    """
    nodes = run_query(nodes_query)
    asset_ids = [n["asset_id"] for n in nodes]

    if asset_ids:
        links_query = f"""
        MATCH (a:Asset)-[r:CORRELATED]->(b:Asset)
        WHERE a.id IN {asset_ids} AND b.id IN {asset_ids}
        RETURN a.id AS source, b.id AS target, r.value AS value
        """
        links = run_query(links_query)
    else:
        links = []

    return {"nodes": nodes, "links": links}

@app.post("/portfolio")
def add_to_portfolio(item: PortfolioItemModel):
    """Dodanie nowego aktywa do portfela"""
    query = f"""
    MATCH (p:Portfolio {{name:'MojPortfel'}}), (a:Asset {{id:'{item.asset_id}'}})
    MERGE (p)-[r:CONTAINS]->(a)
    SET r.amount = coalesce(r.amount,0) + {item.amount}
    """
    run_query(query)
    return {"message": f"Dodano {item.amount} jednostek aktywa {item.asset_id} do portfela"}

@app.put("/portfolio")
def update_portfolio_item(item: PortfolioItemModel):
    """Aktualizacja ilości jednostek aktywa w portfelu"""
    query = f"""
    MATCH (p:Portfolio {{name:'MojPortfel'}})-[r:CONTAINS]->(a:Asset {{id:'{item.asset_id}'}})
    SET r.amount = {item.amount}
    """
    run_query(query)
    return {"message": f"Ilość aktywa {item.asset_id} w portfelu zaktualizowana na {item.amount}"}

@app.delete("/portfolio/{asset_id}")
def remove_from_portfolio(asset_id: str):
    """Usunięcie aktywa z portfela użytkownika"""
    query = f"""
    MATCH (p:Portfolio {{name:'MojPortfel'}})-[r:CONTAINS]->(a:Asset {{id:'{asset_id}'}})
    DELETE r
    """
    run_query(query)
    return {"message": f"Aktywo {asset_id} usunięte z portfela"}

# =============================
# ENDPOINTY ANALITYCZNE
# =============================
@app.get("/recommend/top_correlated/{asset_id}")
def get_top_correlated(asset_id: str, limit: int = 10):
    """Znajdź najbardziej skorelowane aktywa dla danego assetu"""
    query = f"""
    MATCH (a:Asset {{id:'{asset_id}'}})-[r:CORRELATED]->(other:Asset)
    RETURN other.id AS id, other.name AS name, r.value AS correlation
    ORDER BY abs(r.value) DESC
    LIMIT {limit}
    """
    return run_query(query)

@app.get("/recommend/diversifiers")
def get_diversifiers(limit: int = 10):
    """Znajdź dywersyfikatory portfela (niska lub ujemna korelacja)"""
    query = f"""
    MATCH (p:Portfolio {{name:'MojPortfel'}})-[:CONTAINS]->(pa:Asset)
    WITH collect(pa) AS portAssets
    MATCH (candidate:Asset)
    WHERE NOT candidate IN portAssets
    WITH portAssets, candidate
    MATCH (pa)-[r:CORRELATED]->(candidate)
    WHERE pa IN portAssets
    WITH candidate, avg(r.value) AS avgCorr
    RETURN candidate.id AS id, candidate.name AS name, avgCorr
    ORDER BY avgCorr ASC
    LIMIT {limit}
    """
    return run_query(query)