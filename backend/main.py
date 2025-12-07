from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
import os

app = FastAPI()

# CORS do testów frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Połączenie Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://<HOST>:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "<USER>")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "<PASSWORD>")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# Endpoint 1: lista aktywów do wykresu kołowego
@app.get("/assets")
def get_assets():
    query = """
    MATCH (a:Asset)
    RETURN a.name AS name, a.type AS type, a.value AS value
    """
    with driver.session() as session:
        result = session.run(query)
        data = [record.data() for record in result]
    return data

# Endpoint 2: graf instrumentów
@app.get("/graph")
def get_graph():
    query_nodes = "MATCH (a:Asset) RETURN a"
    query_edges = "MATCH (a:Asset)-[r:CORRELATED]->(b:Asset) RETURN a.name AS source, b.name AS target, r.value AS value"
    with driver.session() as session:
        nodes = [{"id": record["a"].id, "label": record["a"]["name"], "type": record["a"]["type"]} for record in session.run(query_nodes)]
        edges = [{"from": record["source"], "to": record["target"], "value": record["value"]} for record in session.run(query_edges)]
    return {"nodes": nodes, "edges": edges}

# Run: uvicorn main:app --reload
# Uwaga: w środowisku Render ustaw zmienne środowiskowe: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD