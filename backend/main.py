from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
from neo4j_driver import run_query

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    update_all_prices()  # aktualizacja przy starcie
    # TEST cyklicznego pobierania danych - co minutę
    # scheduler.add_job(
    #     update_all_prices,
    #     trigger=CronTrigger(second=0, timezone="Europe/Warsaw")
    # )
    scheduler.add_job(
        update_all_prices,
        trigger=CronTrigger(hour=17, minute=30, timezone="Europe/Warsaw")
    )
    scheduler.start()
    yield
    scheduler.shutdown()

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
# CENY - Aktualizowanie
# =============================
def fetch_price(ticker: str) -> float | None:
    """Pobiera ostatnią cenę zamknięcia z Yahoo Finance.
    Jeśli brak nowych danych, zwraca None."""
    try:
        yf_ticker = yf.Ticker(ticker)
        data = yf_ticker.history(period="5d")  # pobieramy kilka ostatnich dni
        if data.empty:
            return None
        # bierzemy ostatni dostępny dzień
        last_close = float(data["Close"].iloc[-1])
        return last_close
    except Exception as e:
        print(f"⚠ Błąd pobierania ceny dla {ticker}: {e}")
        return None

def update_all_prices():
    print(f"⏳ Aktualizuję ceny... ({datetime.now()})")

    assets = run_query("""
        MATCH (a:Asset)-[:HAS_PRICE]->(p:Price)
        RETURN a.id AS id, a.ticker AS ticker, p.last_price AS last_price
    """)

    for record in assets:
        asset_id = record["id"]
        ticker = record.get("ticker")
        last_price = record.get("last_price", 0.0)

        new_price = fetch_price(ticker) if ticker else None

        if new_price is not None:
            run_query("""
                MATCH (a:Asset {id: $id})-[:HAS_PRICE]->(p:Price)
                SET p.last_price = $price,
                    p.last_price_ts = timestamp()
            """, {"id": asset_id, "price": new_price})
            print(f"✔ {asset_id} → {new_price}")
        else:
            # brak nowych danych, zostawiamy poprzednią cenę
            print(f"⚠ {asset_id} brak nowych danych, zostawiamy {last_price}")

# =============================
# POŁĄCZENIE
# =============================

app = FastAPI(title="Portfolio API", lifespan=lifespan)

# CORS do testów z frontendem
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
def status_check():
    """Sprawdzenie działania backendu oraz połączenia z bazą danych Neo4J"""
    try:
        run_query("RETURN 1 AS ok")
        return {"status": "ok", "neo4j_connection": True}
    except:
        return {"status": "error", "neo4j_connection": False}
    

# =============================
# Endpoint do jednorazowego liczenia korelacji
# =============================
@app.get("/calculate-correlations")
async def calculate_correlations():
    # Hardkodowane daty: od roku wstecz do wczoraj
    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=365)

    # Pobranie wszystkich aktywów z tickerami
    assets = run_query("MATCH (a:Asset) RETURN a.id AS id, a.ticker AS ticker")
    if not assets or len(assets) < 2:
        raise HTTPException(status_code=400, detail="Za mało aktywów do obliczenia korelacji")

    tickers = [a['ticker'] for a in assets]
    ids = [a['id'] for a in assets]

    # Pobranie cen OHLC dziennie
    try:
        data = yf.download(tickers, start=start_date.strftime("%Y-%m-%d"),
                           end=end_date.strftime("%Y-%m-%d"), interval="1d")['Close']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania danych: {e}")

    if data.empty:
        raise HTTPException(status_code=404, detail="Brak danych cenowych")

    # Korelacja cen zamknięcia
    corr_matrix = data.corr()

    # Zapis korelacji do Neo4j
    for i, id1 in enumerate(ids):
        for j, id2 in enumerate(ids):
            if j <= i:  # zapisujemy tylko raz
                continue
            corr_value = float(corr_matrix.iloc[i, j])
            run_query("""
                MATCH (a:Asset {id:$a_id}), (b:Asset {id:$b_id})
                MERGE (a)-[r:CORRELATED]->(b)
                SET r.value = $corr
            """, {"a_id": id1, "b_id": id2, "corr": corr_value})

    return {"status": "success", "message": "Korelacje policzone i zapisane w bazie"}

# =============================
# ENDPOINTY - aktywa
# =============================

# @app.get("/assets")
# def get_assets():
#     query = """
#     MATCH (a:Asset)-[:HAS_PRICE]->(p:Price)
#     OPTIONAL MATCH (a)-[:BELONGS_TO]->(c:AssetClass)
#     OPTIONAL MATCH (c)-[:SUBCLASS_OF]->(g:AssetGroup)
#     RETURN a.id AS id,
#            a.name AS name,
#            c.name AS asset_class,
#            g.name AS asset_group,
#            round(p.last_price, 4) AS value,
#            p.last_price_ts AS price_ts
#     ORDER BY a.id
#     """
#     return run_query(query)


@app.get("/assets")
def get_assets():
    query = """
    MATCH (a:Asset)-[:HAS_PRICE]->(p:Price)
    OPTIONAL MATCH (a)-[:BELONGS_TO]->(c:AssetClass)
    OPTIONAL MATCH (c)-[:SUBCLASS_OF]->(g:AssetGroup)
    RETURN a.id AS id,
           a.name AS name,
           c.name AS asset_class,
           g.name AS asset_group,
           round(p.last_price, 4) AS value,
           p.last_price_ts AS price_ts
    ORDER BY a.id
    """
    return run_query(query)

# @app.get("/assets")
# def get_assets():
#     query = """
#     MATCH (a:Asset)-[:HAS_PRICE]->(p:Price)
#     OPTIONAL MATCH (a)-[:BELONGS_TO]->(c:AssetClass)
#     OPTIONAL MATCH (c)-[:SUBCLASS_OF]->(g:AssetGroup)
#     RETURN a.id AS id,
#            a.name AS name,
#            head(collect(c.name)) AS asset_class,
#            head(collect(g.name)) AS asset_group,
#            round(p.last_price, 4) AS value,
#            p.last_price_ts AS price_ts
#     ORDER BY a.id
#     """
#     return run_query(query)


@app.put("/assets/{asset_id}/price")
def update_asset_price(asset_id: str):
    """Ręczna aktualizacja ceny pojedynczego aktywa"""
    result = run_query("""
        MATCH (a:Asset {id:$id})-[:HAS_PRICE]->(p:Price)
        RETURN a.id AS id, a.ticker AS ticker
    """, {"id": asset_id})

    if not result:
        return {"error": f"Nie znaleziono aktywa {asset_id}"}

    ticker = result[0].get("ticker")
    price = fetch_price(ticker) if ticker else 0.0

    run_query("""
        MATCH (a:Asset {id: $id})-[:HAS_PRICE]->(p:Price)
        SET p.last_price = $price,
            p.last_price_ts = timestamp()
    """, {"id": asset_id, "price": price})

    return {"asset": asset_id, "price": price}

@app.post("/assets")
def add_asset(asset: dict):
    """Dodanie lub aktualizacja nowego aktywa"""
    query = """
    MERGE (a:Asset {id:$id})
    SET a.name=$name, a.ticker=$ticker
    MERGE (a)-[:HAS_PRICE]->(p:Price)
    ON CREATE SET p.last_price=0.0, p.last_price_ts=timestamp()
    """
    run_query(query, {"id": asset["id"], "name": asset["name"], "ticker": asset.get("ticker")})
    return {"message": f"Aktywo {asset['name']} dodane/zmodyfikowane"}


# =============================
# ENDPOINTY PORTFELU
# =============================
# @app.get("/portfolio")
# def get_portfolio():
#     """Pobranie portfela użytkownika z klasą i ceną"""
#     query = """
#     MATCH (p:Portfolio {name:'MojPortfel'})-[r:CONTAINS]->(a:Asset)-[:HAS_PRICE]->(price:Price)
#     MATCH (a)-[:BELONGS_TO]->(cls:AssetClass)
#     RETURN
#         a.id AS asset_id,
#         a.name AS name,
#         cls.name AS asset_class,
#         r.amount AS amount,
#         round(price.last_price, 2) AS current_price
#     ORDER BY a.id
#     """
#     return run_query(query)

@app.get("/portfolio")
def get_portfolio():
    """Pobranie portfela użytkownika z klasą i ceną"""
    query = """
    MATCH (p:Portfolio {name:'MojPortfel'})-[r:CONTAINS]->(a:Asset)-[:HAS_PRICE]->(price:Price)
    OPTIONAL MATCH (a)-[:BELONGS_TO]->(cls:AssetClass)
    RETURN
        a.id AS asset_id,
        a.name AS name,
        head(collect(cls.name)) AS asset_class,
        r.amount AS amount,
        round(price.last_price, 2) AS current_price
    ORDER BY a.id
    """
    return run_query(query)


@app.get("/portfolio/graph")
def get_portfolio_graph():
    """Zwraca węzły i krawędzie portfela dla grafu"""
    nodes_query = """
    MATCH (p:Portfolio {name:'MojPortfel'})-[r:CONTAINS]->(a:Asset)
    RETURN 
        a.id AS asset_id, 
        a.name AS name, 
        r.amount AS amount, 
        a.value AS current_price
    """
    nodes = run_query(nodes_query)
    asset_ids = [n["asset_id"] for n in nodes]

    if asset_ids:
        links_query = f"""
        MATCH (a:Asset)-[r:CORRELATED]->(b:Asset)
        WHERE a.id IN {asset_ids} AND b.id IN {asset_ids}
        RETURN 
            a.id AS source, 
            b.id AS target, 
            r.value AS value
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
    RETURN 
        other.id AS id, 
        other.name AS name, 
        r.value AS correlation
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
    RETURN 
        candidate.id AS id, 
        candidate.name AS name, 
        avgCorr
    ORDER BY avgCorr ASC
    LIMIT {limit}
    """
    return run_query(query)