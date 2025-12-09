// ========================================================================
// 0. Konwencja: etykiety
// AssetGroup  = grupa nadrzędna (Risk / Safe)
// AssetClass  = klasa szczegółowa (Equity, Fixed Income, Commodities, Forex, Crypto)
// Asset       = instrument (id, name, desc, value)
// Portfolio   = przykładowy portfel pojedynczego użytkownika
// ========================================================================

// ========================================================================
// 1. Constraints / indeksy (zapobiegają duplikatom)
// ========================================================================
CREATE CONSTRAINT asset_id_unique IF NOT EXISTS
FOR (a:Asset) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT class_name_unique IF NOT EXISTS
FOR (c:AssetClass) REQUIRE c.name IS UNIQUE;

CREATE CONSTRAINT group_name_unique IF NOT EXISTS
FOR (g:AssetGroup) REQUIRE g.name IS UNIQUE;

CREATE CONSTRAINT portfolio_name_unique IF NOT EXISTS
FOR (p:Portfolio) REQUIRE p.name IS UNIQUE;

// ========================================================================
// 2. Tworzenie grup nadrzędnych (AssetGroup)
// ========================================================================
MERGE (:AssetGroup {name: "Risk"});
MERGE (:AssetGroup {name: "Safe"});

// ========================================================================
// 3. Tworzenie klas szczegółowych (AssetClass)
// ========================================================================
MERGE (:AssetClass {name: "Equity"});
MERGE (:AssetClass {name: "Fixed Income"});
MERGE (:AssetClass {name: "Commodities"});
MERGE (:AssetClass {name: "Forex"});
MERGE (:AssetClass {name: "Crypto"});

// ========================================================================
// 4. Powiązanie klas z grupami (SUBCLASS_OF)
// ========================================================================
MATCH (gRisk:AssetGroup {name:"Risk"}), (cEquity:AssetClass {name:"Equity"}) MERGE (cEquity)-[:SUBCLASS_OF]->(gRisk);
MATCH (gRisk:AssetGroup {name:"Risk"}), (cCrypto:AssetClass {name:"Crypto"}) MERGE (cCrypto)-[:SUBCLASS_OF]->(gRisk);
MATCH (gRisk:AssetGroup {name:"Risk"}), (cComm:AssetClass {name:"Commodities"}) MERGE (cComm)-[:SUBCLASS_OF]->(gRisk);

MATCH (gSafe:AssetGroup {name:"Safe"}), (cFI:AssetClass {name:"Fixed Income"}) MERGE (cFI)-[:SUBCLASS_OF]->(gSafe);
MATCH (gSafe:AssetGroup {name:"Safe"}), (cFx:AssetClass {name:"Forex"}) MERGE (cFx)-[:SUBCLASS_OF]->(gSafe);

// ========================================================================
// 5. Dodanie assetów (MERGE -> id unikalne) z bogatszym opisem po polsku
// ========================================================================

MERGE (a:A sset {id:"AAPL"}) // <- placeholder to keep script readable if executed piecewise
// poniżej właściwe bloki (użyj dokładnie tych MERGE poniżej — nie łącz w jeden wiersz)
;



1️⃣ Najbardziej skorelowane aktywa – pojedynczy asset (top N)
:param assetId => "AAPL";
MATCH (a:Asset {id:$assetId})-[r:CORRELATED]->(other:Asset)
RETURN other.id AS id, other.name AS nazwa, r.value AS korelacja
ORDER BY abs(r.value) DESC
LIMIT 10;

2️⃣ Najbardziej skorelowane aktywa – dla całego portfela
MATCH (p:Portfolio {name:"MojPortfel"})-[pc:CONTAINS]->(pa:Asset)
MATCH (pa)-[r:CORRELATED]->(other:Asset)
WHERE NOT (p)-[:CONTAINS]->(other)
MATCH (pa)-[:HAS_PRICE]->(price:Price)
WITH other, sum(abs(r.value) * price.last_price * pc.amount) AS score
RETURN other.id AS id, other.name AS nazwa, score
ORDER BY score DESC
LIMIT 10;

3️⃣ Znalezienie „dywersyfikatorów” – niskie/ujemne korelacje
MATCH (p:Portfolio {name:"MojPortfel"})-[pc:CONTAINS]->(pa:Asset)
WITH collect(pa) AS portAssets
MATCH (candidate:Asset)
WHERE NOT candidate IN portAssets
WITH portAssets, candidate
MATCH (pa)-[r:CORRELATED]->(candidate)
WHERE pa IN portAssets
WITH candidate, avg(r.value) AS avgCorr
RETURN candidate.id AS id, candidate.name AS nazwa, avgCorr
ORDER BY avgCorr ASC
LIMIT 10;

4️⃣ Sprawdzenie ryzyka całej klasy aktywów
:param className => "Akcje";
MATCH (c:AssetClass {name:$className})<-[:BELONGS_TO]-(a:Asset)
WITH collect(a) AS assets
UNWIND assets AS x
UNWIND assets AS y
MATCH (x)-[r:CORRELATED]->(y)
WHERE x.id <> y.id
RETURN $className AS klasa, avg(abs(r.value)) AS srednia_abs_korelacji, count(r) AS liczba_relacji;

5️⃣ Hierarchia klas aktywów (AssetGroup → AssetClass → Asset)
MATCH (g:AssetGroup)<-[:SUBCLASS_OF]-(c:AssetClass)<-[:BELONGS_TO]-(a:Asset)
RETURN g.name AS grupa, c.name AS klasa, collect({id:a.id, name:a.name}) AS assets
ORDER BY g.name, c.name;

6️⃣ Analizy portfela przez ścieżki grafowe
MATCH (btc:Asset {id:"BTC"}), (p:Portfolio {name:"MojPortfel"})-[pc:CONTAINS]->(a:Asset)
MATCH path = shortestPath((btc)-[*..3]-(a))
RETURN a.id AS target, a.name AS nazwa, length(path) AS dystans,
       [n IN nodes(path) | labels(n)[0] + ':' + coalesce(n.id, n.name)] AS sciezka
ORDER BY dystans;





4) Sugestie implementacyjne (krótko)
W seedzie używaj MERGE — bezpieczne przy wielokrotnym uruchamianiu.
W API (FastAPI) wystaw endpointy REST (GET/POST/PUT/DELETE) do CRUD portfela; zapytania Cypher umieszczaj w funkcjach service.
Rekomendacje: użyj zapytań 1+2 jako silnika; możesz dodać dodatkowe filtry (np. maks. udział klasy, minimalna płynność).
W frontendzie: node size = value, color = grupa (Risk/Safe), edge color = funkcja korelacji (ujemne/czerwone, bliskie 0 = brak krawędzi).


Jak używać w praktyce:
Backend (FastAPI) – najlepiej umieścić je w funkcjach serwisowych, np. get_top_correlated(assetId), get_diversifiers(portfolioName).
Parametryzacja – używaj zmiennych ($assetId, $className) i wysyłaj je z requestu, zamiast hardcodować.
Nie trzeba wklejać ręcznie w Neo4j Browser – choć można do testów. W prod/SPA wywołujesz je z backendu, który łączy się przez neo4j-driver.
Frontend – pobiera już wynik JSON z backendu i wizualizuje graf, wykresy kołowe, ryzyko itp.
Krótko: zapytania działają bez zmian, tylko parametry (nazwy klas, assetId) muszą odpowiadać Twojej bazie po polsku.
