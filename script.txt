// ===========================
// 0. Constraints
// ===========================
CREATE CONSTRAINT asset_id_unique IF NOT EXISTS
FOR (a:Asset) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT class_name_unique IF NOT EXISTS
FOR (c:AssetClass) REQUIRE c.name IS UNIQUE;

CREATE CONSTRAINT portfolio_name_unique IF NOT EXISTS
FOR (p:Portfolio) REQUIRE p.name IS UNIQUE;


// ===========================
// 1. AssetClass
// ===========================
MERGE (:AssetClass {name:"Akcje"});
MERGE (:AssetClass {name:"Kryptowaluty"});
MERGE (:AssetClass {name:"Surowce"});
MERGE (:AssetClass {name:"Forex"});
MERGE (:AssetClass {name:"Obligacje"});


// ===========================
// 2. Assets
// ===========================
MERGE (:Asset {id:"AAPL", name:"Apple Inc.", ticker:"AAPL", currency:"USD"});
MERGE (:Asset {id:"MSFT", name:"Microsoft Corp.", ticker:"MSFT", currency:"USD"});
MERGE (:Asset {id:"SPY", name:"S&P500 ETF", ticker:"SPY", currency:"USD"});
MERGE (:Asset {id:"EEM", name:"Emerging Markets ETF", ticker:"EEM", currency:"USD"});
MERGE (:Asset {id:"TLT", name:"iShares 20+ Year Treasury Bond ETF", ticker:"TLT", currency:"USD"});
MERGE (:Asset {id:"LQD", name:"Corporate Bond ETF", ticker:"LQD", currency:"USD"});
MERGE (:Asset {id:"HYG", name:"High Yield Bond ETF", ticker:"HYG", currency:"USD"});
MERGE (:Asset {id:"EUNH", name:"iShares Core € Govt Bond UCITS ETF", ticker:"EUNH.DE", currency:"EUR"});
MERGE (:Asset {id:"XAU", name:"Gold", ticker:"GC=F", currency:"USD"});
MERGE (:Asset {id:"XAG", name:"Silver", ticker:"SI=F", currency:"USD"});
MERGE (:Asset {id:"OIL", name:"Brent Oil", ticker:"BZ=F", currency:"USD"});
MERGE (:Asset {id:"NG", name:"Natural Gas", ticker:"NG=F", currency:"USD"});
MERGE (:Asset {id:"BTC", name:"Bitcoin", ticker:"BTC-USD", currency:"USD"});
MERGE (:Asset {id:"ETH", name:"Ethereum", ticker:"ETH-USD", currency:"USD"});
MERGE (:Asset {id:"BNB", name:"BNB", ticker:"BNB-USD", currency:"USD"});
MERGE (:Asset {id:"SOL", name:"Solana", ticker:"SOL-USD", currency:"USD"});
MERGE (:Asset {id:"EURUSD", name:"EUR/USD", ticker:"EURUSD=X", currency:"USD"});
MERGE (:Asset {id:"GBPUSD", name:"GBP/USD", ticker:"GBPUSD=X", currency:"USD"});
MERGE (:Asset {id:"USDJPY", name:"USD/JPY", ticker:"USDJPY=X", currency:"JPY"});
MERGE (:Asset {id:"USDCAD", name:"USD/CAD", ticker:"USDCAD=X", currency:"CAD"});


// ===========================
// 3. Assign Assets to Classes
// ===========================
UNWIND [
  {id:"AAPL", class:"Akcje"},
  {id:"MSFT", class:"Akcje"},
  {id:"SPY", class:"Akcje"},
  {id:"EEM", class:"Akcje"},
  {id:"BTC", class:"Kryptowaluty"},
  {id:"ETH", class:"Kryptowaluty"},
  {id:"BNB", class:"Kryptowaluty"},
  {id:"SOL", class:"Kryptowaluty"},
  {id:"XAU", class:"Surowce"},
  {id:"XAG", class:"Surowce"},
  {id:"OIL", class:"Surowce"},
  {id:"NG", class:"Surowce"},
  {id:"EURUSD", class:"Forex"},
  {id:"GBPUSD", class:"Forex"},
  {id:"USDJPY", class:"Forex"},
  {id:"USDCAD", class:"Forex"},
  {id:"TLT", class:"Obligacje"},
  {id:"LQD", class:"Obligacje"},
  {id:"HYG", class:"Obligacje"},
  {id:"EUNH", class:"Obligacje"}
] AS asset_info
MATCH (a:Asset {id: asset_info.id})
MATCH (c:AssetClass {name: asset_info.class})
MERGE (a)-[:BELONGS_TO]->(c);


// ===========================
// 4. Price – dynamic prices
// ===========================
MATCH (a:Asset)
MERGE (a)-[:HAS_PRICE]->(p:Price)
ON CREATE SET p.last_price = 0.0,
              p.last_price_ts = timestamp();


// ===========================
// 5. Risk Score (NEW)
// ===========================
MATCH (a:Asset)
SET a.risk_score = 0,
    a.risk_last_update = timestamp();


// ===========================
// 6. Portfolio
// ===========================
MERGE (p:Portfolio {name:"MojPortfel"})
  SET p.owner="user@example.com",
      p.description="Proof-of-concept jednego użytkownika";

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