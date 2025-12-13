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
    type: str = None
    value: float = 0.0

class PortfolioItemModel(BaseModel):
    asset_id: str
    amount: float

# =============================
# CENY - Aktualizowanie
# =============================
def fetch_price(ticker: str) -> float | None:
    """Pobiera ostatnią cenę zamknięcia z Yahoo Finance.
    Jeśli brak nowych danych, zwraca None."""
    try:
        yf_ticker = yf.Ticker(ticker)
        data = yf_ticker.history(period="5d")
        if data.empty:
            return None
        # bierzemy ostatni dostępny dzień
        last_close = float(data["Close"].iloc[-1])
        return last_close
    except Exception as e:
        print(f"Błąd pobierania ceny dla {ticker}: {e}")
        return None

def update_all_prices():
    print(f"Aktualizuję ceny... ({datetime.now()})")

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
            print(f"{asset_id} → {new_price}")
        else:
            # brak nowych danych, zostawiamy poprzednią cenę
            print(f"{asset_id} brak nowych danych, zostawiamy {last_price}")

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
# Endpoint do liczenia korelacji
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
# Endpoint do liczenia ryzyka
# =============================
@app.get("/update-risk")
async def update_risk():
    """Oblicza 30-dniową zmienność dla wszystkich aktywów i zapisuje risk_score"""

    assets = run_query("MATCH (a:Asset) RETURN a.id AS id, a.ticker AS ticker")
    if not assets:
        raise HTTPException(status_code=400, detail="Brak aktywów w bazie")

    tickers = [a["ticker"] for a in assets]

    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=60)

    try:
        price_data = yf.download(
            tickers,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            interval="1d"
        )["Close"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania danych: {e}")

    if price_data.empty:
        raise HTTPException(status_code=404, detail="Brak danych cenowych")

    log_returns = price_data.pct_change().dropna()
    volatility_30d = log_returns.tail(30).std()
    vol_dict = volatility_30d.to_dict()

    vols = [v for v in vol_dict.values() if v == v]
    min_vol = min(vols) if vols else 0
    max_vol = max(vols) if vols else 0

    def scale_risk(vol):
        if vol != vol:  # NaN
            return 0
        if max_vol == min_vol:
            return 0
        return int(100 * (vol - min_vol) / (max_vol - min_vol))

    for rec in assets:
        vol = vol_dict.get(rec["ticker"], 0)
        risk_score = scale_risk(vol)
        run_query("""
            MATCH (a:Asset {id: $id})
            SET a.risk_score = $risk,
                a.risk_last_update = timestamp()
        """, {"id": rec["id"], "risk": risk_score})

    return {"status": "success", "message": "Ryzyko obliczone i zapisane"}

# =============================
# ENDPOINTY - wartosc portfela
# =============================
@app.get("/portfolio/value")
def get_portfolio_value():
    try:
        res = run_query("""
        MATCH (p:Portfolio {name:'MojPortfel'})-[r:CONTAINS]->(a:Asset)-[:HAS_PRICE]->(price:Price)
        RETURN sum(r.amount * price.last_price) AS value
        """)
        value = res[0]['value'] if res else 0
        return {"value": value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania wartości portfela: {e}")
# =============================
# ENDPOINTY - aktywa
# =============================

@app.get("/assets")
def get_assets():
    query = """
    MATCH (a:Asset)-[:HAS_PRICE]->(p:Price)
    OPTIONAL MATCH (a)-[:BELONGS_TO]->(c:AssetClass)
    RETURN a.id AS id,
           a.name AS name,
           c.name AS asset_class,
           a.risk_score AS risk_score,
           round(p.last_price, 4) AS value,
           p.currency AS currency,
           p.last_price_ts AS price_ts
    ORDER BY a.id
    """
    try:
        result = run_query(query)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania aktywów: {e}")


@app.post("/assets")
def add_asset(asset: dict):
    # Walidacja minimalna
    if not all(k in asset for k in ("id", "name", "asset_class")):
        raise HTTPException(
            status_code=400,
            detail="Wymagane pola: id, name, asset_class"
        )

    query = """
    MERGE (a:Asset {id: $id})
    SET a.name = $name,
        a.ticker = $ticker,
        a.currency = $currency,
        a.risk_score = coalesce(a.risk_score, 0),
        a.risk_last_update = timestamp()

    MERGE (c:AssetClass {name: $asset_class})
    MERGE (a)-[:BELONGS_TO]->(c)

    MERGE (a)-[:HAS_PRICE]->(p:Price)
    ON CREATE SET
        p.last_price = 0.0,
        p.last_price_ts = timestamp()
    """

    try:
        run_query(query, {
            "id": asset["id"],
            "name": asset["name"],
            "asset_class": asset["asset_class"],
            "ticker": asset.get("ticker"),
            "currency": asset.get("currency", "USD")
        })

        return {"message": f"Aktywo {asset['id']} dodane / zaktualizowane"}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd dodawania aktywa: {e}"
        )

@app.delete("/assets/{asset_id}")
def remove_asset(asset_id: str):
    query = """
    MATCH (a:Asset {id: $id})
    DETACH DELETE a
    RETURN count(a) AS deleted
    """

    try:
        result = run_query(query, {"id": asset_id})

        if not result or result[0]["deleted"] == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Aktywo {asset_id} nie istnieje"
            )

        return {"message": f"Aktywo {asset_id} zostało usunięte"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Błąd usuwania aktywa: {e}"
        )
    
# =============================
# ENDPOINTY PORTFELU
# =============================


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
    try:
        result = run_query(query)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania portfela: {e}")


@app.get("/portfolio/graph")
def get_portfolio_graph():
    """Zwraca węzły i krawędzie portfela dla grafu"""
    try:
        # Pobranie węzłów portfela
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

        # Pobranie powiązań (korelacji) między aktywami w portfelu
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania grafu portfela: {e}")
    

@app.post("/portfolio")
def add_to_portfolio(item: PortfolioItemModel):
    """Dodanie nowego aktywa do portfela"""
    # Walidacja minimalna
    if item.amount <= 0:
        raise HTTPException(status_code=400, detail="Ilość dodawanego aktywa musi być większa niż 0")

    try:
        query = f"""
        MATCH (p:Portfolio {{name:'MojPortfel'}}), (a:Asset {{id:'{item.asset_id}'}})
        MERGE (p)-[r:CONTAINS]->(a)
        SET r.amount = coalesce(r.amount,0) + {item.amount}
        """
        result = run_query(query)

        # Jeśli nie znaleziono Portfolio lub Asset, można też rzucić 400
        if result is None:
            raise HTTPException(status_code=400, detail=f"Nie znaleziono portfela lub aktywa {item.asset_id}")

        return {"message": f"Dodano {item.amount} jednostek aktywa {item.asset_id} do portfela"}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd dodawania do portfela: {e}")

@app.put("/portfolio")
def update_portfolio_item(item: PortfolioItemModel):
    """Aktualizacja ilości jednostek aktywa w portfelu"""
    # Minimalna walidacja
    if item.amount < 0:
        raise HTTPException(status_code=400, detail="Ilość jednostek nie może być ujemna")

    try:
        query = f"""
        MATCH (p:Portfolio {{name:'MojPortfel'}})-[r:CONTAINS]->(a:Asset {{id:'{item.asset_id}'}})
        SET r.amount = {item.amount}
        """
        result = run_query(query)

        # Jeśli nie znaleziono relacji, można rzucić 400
        if result is None:
            raise HTTPException(status_code=400, detail=f"Nie znaleziono portfela lub aktywa {item.asset_id}")

        return {"message": f"Ilość aktywa {item.asset_id} w portfelu zaktualizowana na {item.amount}"}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd aktualizacji portfela: {e}")

@app.delete("/portfolio/{asset_id}")
def remove_from_portfolio(asset_id: str):
    """Usunięcie aktywa z portfela użytkownika"""
    try:
        query = f"""
        MATCH (p:Portfolio {{name:'MojPortfel'}})-[r:CONTAINS]->(a:Asset {{id:'{asset_id}'}})
        DELETE r
        """
        result = run_query(query)

        # Jeśli nie znaleziono relacji, można rzucić 400
        if result is None:
            raise HTTPException(status_code=400, detail=f"Nie znaleziono aktywa {asset_id} w portfelu")

        return {"message": f"Aktywo {asset_id} usunięte z portfela"}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd usuwania aktywa z portfela: {e}")
    


@app.get("/portfolio/class-distribution")
def portfolio_class_distribution():
    """
    Zwraca procentową wartość portfela podzieloną na klasy aktywów.
    """
    query = """
    MATCH (p:Portfolio {name:"MojPortfel"})-[pc:CONTAINS]->(a:Asset)-[:HAS_PRICE]->(pr:Price)
    MATCH (a)-[:BELONGS_TO]->(c:AssetClass)
    WITH c.name AS class, SUM(pr.last_price * pc.amount) AS class_value
    RETURN class, class_value
    """
    try:
        result = run_query(query)
        # Obliczamy całkowitą wartość portfela
        total_value = sum(r["class_value"] for r in result) or 1
        # Zwracamy procenty
        return [
            {
                "class": r["class"], 
                "value": r["class_value"], 
                "percent": r["class_value"]/total_value*100
            }
            for r in result
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd obliczania rozkładu klas: {e}")
