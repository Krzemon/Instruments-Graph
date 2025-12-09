from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

# =============================
# Uzupełnij zmienne środowiskowe lub plik .env
# =============================
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

def run_query(query: str, params: dict = None):
    """Wrapper do wykonywania zapytań Cypher"""
    with driver.session() as session:
        result = session.run(query, params or {})
        return [record.data() for record in result]