import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MARKETS = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "XRP-USDT", "DOGE-USDT", "OKB-USDT"];
const BARS = ["1m", "5m", "15m", "1H", "4H", "1D"];
const API_ORIGIN = process.env.OKX_API_ORIGIN || "https://www.okx.com";
const OUTPUT_JSON = resolve("data/okx-market.json");
const OUTPUT_SCRIPT = resolve("data/okx-market-cache.js");

const wait = milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));

async function requestJson(path, attempts = 3) {
  let lastError = new Error("OKX request failed");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(API_ORIGIN + path, {
        headers: {
          Accept: "application/json",
          "User-Agent": "origin-service-station-market-cache/1.0"
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.code !== "0") throw new Error(payload?.msg || "Invalid OKX response");
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(attempt * 750);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function normalizeCandle(row) {
  const candle = {
    ts: Number(row?.[0]),
    open: Number(row?.[1]),
    high: Number(row?.[2]),
    low: Number(row?.[3]),
    close: Number(row?.[4]),
    volume: Number(row?.[5]),
    quoteVolume: Number(row?.[7]),
    confirmed: row?.[8] === "1"
  };
  if (![candle.ts, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) {
    throw new Error("Invalid OKX candle row");
  }
  return candle;
}

function compactCandle(candle) {
  return [
    candle.ts,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
    candle.quoteVolume,
    candle.confirmed ? 1 : 0
  ];
}

function compactCandles(candles) {
  return Object.fromEntries(Object.entries(candles).map(([instId, bars]) => [
    instId,
    Object.fromEntries(Object.entries(bars).map(([bar, rows]) => [
      bar,
      rows.map(compactCandle)
    ]))
  ]));
}

async function loadTickers() {
  const payload = await requestJson("/api/v5/market/tickers?instType=SPOT");
  const wanted = new Set(MARKETS);
  const tickers = (Array.isArray(payload.data) ? payload.data : [])
    .filter(ticker => wanted.has(ticker?.instId))
    .map(ticker => ({
      instId: ticker.instId,
      last: ticker.last,
      open24h: ticker.open24h,
      high24h: ticker.high24h,
      low24h: ticker.low24h,
      vol24h: ticker.vol24h,
      volCcy24h: ticker.volCcy24h,
      ts: ticker.ts
    }));
  if (tickers.length !== MARKETS.length) {
    throw new Error(`Only received ${tickers.length}/${MARKETS.length} required tickers`);
  }
  return MARKETS.map(instId => tickers.find(ticker => ticker.instId === instId));
}

async function loadCandles() {
  const candles = {};
  const candleUpdatedAt = {};
  for (const instId of MARKETS) {
    candles[instId] = {};
    const rowsByBar = await Promise.all(BARS.map(async bar => {
      const query = new URLSearchParams({ instId, bar, limit: "100" });
      const payload = await requestJson(`/api/v5/market/candles?${query}`);
      const rows = (Array.isArray(payload.data) ? payload.data : [])
        .map(normalizeCandle)
        .sort((a, b) => a.ts - b.ts);
      if (!rows.length) throw new Error(`No candles for ${instId} ${bar}`);
      return [bar, rows];
    }));
    for (const [bar, rows] of rowsByBar) {
      const key = `${instId}|${bar}`;
      candles[instId][bar] = rows;
      candleUpdatedAt[key] = rows.at(-1)?.ts || Date.now();
    }
    await wait(450);
  }
  return { candles, candleUpdatedAt };
}

async function main() {
  const [tickers, candleResult] = await Promise.all([loadTickers(), loadCandles()]);
  const generatedAt = Date.now();
  const tickerUpdatedAt = Math.max(
    ...tickers.map(ticker => Number(ticker.ts)).filter(Number.isFinite),
    generatedAt
  );
  const snapshot = {
    version: 1,
    source: "OKX public market data",
    generatedAt,
    tickerUpdatedAt,
    tickers,
    candles: candleResult.candles,
    candleUpdatedAt: candleResult.candleUpdatedAt
  };
  const compactSnapshot = {
    ...snapshot,
    candles: compactCandles(snapshot.candles)
  };
  const json = JSON.stringify(compactSnapshot);
  const prettyJson = JSON.stringify(snapshot, null, 2) + "\n";
  const script = `window.OKX_MARKET_SNAPSHOT = Object.freeze(${json});\n`;
  await mkdir(dirname(OUTPUT_JSON), { recursive: true });
  await Promise.all([
    writeFile(OUTPUT_JSON, prettyJson, "utf8"),
    writeFile(OUTPUT_SCRIPT, script, "utf8")
  ]);
  console.log(`Cached ${tickers.length} tickers and ${MARKETS.length * BARS.length} candle series.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
