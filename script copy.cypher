// ===========================
// 0. Constraints
// ===========================
CREATE CONSTRAINT asset_id_unique IF NOT EXISTS
FOR (a:Asset) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT class_name_unique IF NOT EXISTS
FOR (c:AssetClass) REQUIRE c.name IS UNIQUE;

CREATE CONSTRAINT group_name_unique IF NOT EXISTS
FOR (g:AssetGroup) REQUIRE g.name IS UNIQUE;

CREATE CONSTRAINT portfolio_name_unique IF NOT EXISTS
FOR (p:Portfolio) REQUIRE p.name IS UNIQUE;

// ===========================
// 1. AssetGroup
// ===========================
MERGE (gRisk:AssetGroup {name: "Ryzykowne"});
MERGE (gSafe:AssetGroup {name: "Bezpieczne"});

// ===========================
// 2. AssetClass
// ===========================
MERGE (equity:AssetClass {name:"Akcje"});
MERGE (crypto:AssetClass {name:"Kryptowaluty"});
MERGE (commodities:AssetClass {name:"Surowce"});
MERGE (forex:AssetClass {name:"Forex"});
MERGE (bonds:AssetClass {name:"Obligacje"});

// ===========================
// 3. Relacje SUBCLASS_OF
// ===========================
MERGE (equity)-[:SUBCLASS_OF]->(gRisk);
MERGE (crypto)-[:SUBCLASS_OF]->(gRisk);
MERGE (commodities)-[:SUBCLASS_OF]->(gRisk);
MERGE (bonds)-[:SUBCLASS_OF]->(gSafe);
MERGE (forex)-[:SUBCLASS_OF]->(gSafe);

// ===========================
// 4. Assets (20 aktywów)
// ===========================
// --- Akcje
MERGE (:Asset {id:"AAPL", name:"Apple Inc.", ticker:"AAPL"});
MERGE (:Asset {id:"MSFT", name:"Microsoft Corp.", ticker:"MSFT"});
MERGE (:Asset {id:"SPY", name:"S&P500 ETF", ticker:"SPY"});
MERGE (:Asset {id:"EEM", name:"Emerging Markets ETF", ticker:"EEM"});

// --- Obligacje
MERGE (:Asset {id:"UST10Y", name:"US Treasury 10Y", ticker:"^TNX"});
MERGE (:Asset {id:"LQD", name:"Corporate Bond ETF", ticker:"LQD"});
MERGE (:Asset {id:"HYG", name:"High Yield Bond ETF", ticker:"HYG"});
MERGE (:Asset {id:"EUNH", name:"iShares Core € Govt Bond UCITS ETF", ticker:"EUNH.DE"});

// --- Surowce
MERGE (:Asset {id:"XAU", name:"Gold", ticker:"GC=F"});
MERGE (:Asset {id:"XAG", name:"Silver", ticker:"SI=F"});
MERGE (:Asset {id:"OIL", name:"Brent Oil", ticker:"BZ=F"});
MERGE (:Asset {id:"NG", name:"Natural Gas", ticker:"NG=F"});

// --- Kryptowaluty
MERGE (:Asset {id:"BTC", name:"Bitcoin", ticker:"BTC-USD"});
MERGE (:Asset {id:"ETH", name:"Ethereum", ticker:"ETH-USD"});
MERGE (:Asset {id:"BNB", name:"BNB", ticker:"BNB-USD"});
MERGE (:Asset {id:"SOL", name:"Solana", ticker:"SOL-USD"});

// --- Forex
MERGE (:Asset {id:"EURUSD", name:"EUR/USD", ticker:"EURUSD=X"});
MERGE (:Asset {id:"GBPUSD", name:"GBP/USD", ticker:"GBPUSD=X"});
MERGE (:Asset {id:"USDJPY", name:"USD/JPY", ticker:"USDJPY=X"});
MERGE (:Asset {id:"USDCAD", name:"USD/CAD", ticker:"USDCAD=X"});

// ===========================
// 5. Przypisanie Assets do klas
// ===========================
MATCH (equity:AssetClass {name:"Akcje"})
MATCH (crypto:AssetClass {name:"Kryptowaluty"})
MATCH (commodities:AssetClass {name:"Surowce"})
MATCH (forex:AssetClass {name:"Forex"})
MATCH (bonds:AssetClass {name:"Obligacje"})

MATCH (a:Asset)
WHERE a.id IN ["AAPL","MSFT","SPY","EEM"]
MERGE (a)-[:BELONGS_TO]->(equity);

MATCH (a:Asset)
WHERE a.id IN ["BTC","ETH","BNB","SOL"]
MERGE (a)-[:BELONGS_TO]->(crypto);

MATCH (a:Asset)
WHERE a.id IN ["XAU","XAG","OIL","NG"]
MERGE (a)-[:BELONGS_TO]->(commodities);

MATCH (a:Asset)
WHERE a.id IN ["EURUSD","GBPUSD","USDJPY","USDCAD"]
MERGE (a)-[:BELONGS_TO]->(forex);

MATCH (a:Asset)
WHERE a.id IN ["UST10Y","LQD","HYG","EUNH"]
MERGE (a)-[:BELONGS_TO]->(bonds);

// ===========================
// 6. Price – dynamiczne ceny
// ===========================
MATCH (a:Asset)
MERGE (a)-[:HAS_PRICE]->(p:Price)
ON CREATE SET p.last_price = 0.0, p.last_price_ts = timestamp();

// ===========================
// 7. Portfolio – jeden użytkownik
// ===========================
MERGE (p:Portfolio {name:"MojPortfel"})
  SET p.owner="user@example.com", p.description="Proof-of-concept jednego użytkownika";

MATCH (p:Portfolio {name:"MojPortfel"}), (a:Asset)
WHERE a.id IN ["AAPL","SPY","BTC","XAU"]
MERGE (p)-[:CONTAINS {amount:
CASE a.id
  WHEN "AAPL" THEN 10
  WHEN "SPY" THEN 5
  WHEN "BTC" THEN 0.5
  WHEN "XAU" THEN 2
END
}]->(a);

// ===========================
// 8. Korelacje między aktywami (przykłady)
// ===========================
// Wysokie
MATCH (a:Asset), (b:Asset)
WHERE (a.id="AAPL" AND b.id="MSFT") OR (a.id="AAPL" AND b.id="SPY") OR (a.id="MSFT" AND b.id="SPY")
   OR (a.id="BTC" AND b.id="ETH") OR (a.id="XAU" AND b.id="XAG")
   OR (a.id="UST10Y" AND b.id="EUNH") OR (a.id="LQD" AND b.id="EUNH") OR (a.id="BTC" AND b.id="SOL")
MERGE (a)-[:CORRELATED {value:
CASE a.id + "-" + b.id
  WHEN "AAPL-MSFT" THEN 0.85
  WHEN "AAPL-SPY" THEN 0.80
  WHEN "MSFT-SPY" THEN 0.88
  WHEN "BTC-ETH" THEN 0.90
  WHEN "XAU-XAG" THEN 0.85
  WHEN "UST10Y-EUNH" THEN 0.80
  WHEN "LQD-EUNH" THEN 0.75
  WHEN "BTC-SOL" THEN 0.70
END
}]->(b);

// Średnie
MATCH (a:Asset), (b:Asset)
WHERE (a.id="XAU" AND b.id="SPY") OR (a.id="OIL" AND b.id="SPY") OR (a.id="HYG" AND b.id="EEM")
   OR (a.id="OIL" AND b.id="NG") OR (a.id="ETH" AND b.id="SOL")
MERGE (a)-[:CORRELATED {value:
CASE a.id + "-" + b.id
  WHEN "XAU-SPY" THEN 0.40
  WHEN "OIL-SPY" THEN 0.35
  WHEN "HYG-EEM" THEN 0.50
  WHEN "OIL-NG" THEN 0.45
  WHEN "ETH-SOL" THEN 0.55
END
}]->(b);

// Niskie
MATCH (a:Asset), (b:Asset)
WHERE (a.id="XAU" AND b.id="BTC") OR (a.id="UST10Y" AND b.id="BTC") OR (a.id="EUNH" AND b.id="OIL")
MERGE (a)-[:CORRELATED {value:
CASE a.id + "-" + b.id
  WHEN "XAU-BTC" THEN 0.15
  WHEN "UST10Y-BTC" THEN 0.20
  WHEN "EUNH-OIL" THEN 0.10
END
}]->(b);

// Forex ↔ Forex
MATCH (a:Asset), (b:Asset)
WHERE (a.id="EURUSD" AND b.id="GBPUSD") OR (a.id="USDJPY" AND b.id="EURUSD") OR (a.id="USDJPY" AND b.id="GBPUSD")
MERGE (a)-[:CORRELATED {value:
CASE a.id + "-" + b.id
  WHEN "EURUSD-GBPUSD" THEN 0.85
  WHEN "USDJPY-EURUSD" THEN -0.40
  WHEN "USDJPY-GBPUSD" THEN 0.55
END
}]->(b);

// Forex ↔ Commodities
MATCH (a:Asset), (b:Asset)
WHERE (a.id="USDCAD" AND b.id="OIL") OR (a.id="GBPUSD" AND b.id="XAU")
MERGE (a)-[:CORRELATED {value:
CASE a.id + "-" + b.id
  WHEN "USDCAD-OIL" THEN -0.75
  WHEN "GBPUSD-XAU" THEN 0.30
END
}]->(b);

// Forex ↔ Equity
MATCH (a:Asset), (b:Asset)
WHERE (a.id="USDJPY" AND b.id="SPY") OR (a.id="EURUSD" AND b.id="SPY")
MERGE (a)-[:CORRELATED {value:
CASE a.id + "-" + b.id
  WHEN "USDJPY-SPY" THEN -0.50
  WHEN "EURUSD-SPY" THEN 0.25
END
}]->(b);

// Forex ↔ Fixed Income
MATCH (a:Asset), (b:Asset)
WHERE (a.id="USDJPY" AND b.id="UST10Y")
MERGE (a)-[:CORRELATED {value:0.60}]->(b);