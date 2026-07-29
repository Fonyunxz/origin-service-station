(function () {
  "use strict";

  // 防止页面被第三方站点套入 iframe 后伪装按钮或诱导点击。
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location = window.self.location.href; }
    catch (error) {}
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = value;
  };
  const CONFIG = window.SITE_CONFIG || {};
  const normalizeOrigin = value => {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const url = new URL(text);
      const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
      return url.protocol === "https:" || (url.protocol === "http:" && isLocal) ? url.origin : "";
    } catch (error) {
      return "";
    }
  };
  const SOURCE_MEDIA_ORIGIN = normalizeOrigin(CONFIG.sourceMediaOrigin) || "https://media.web3origin.com";
  const MEDIA_ORIGIN = normalizeOrigin(CONFIG.mediaOrigin) || SOURCE_MEDIA_ORIGIN;
  const SOURCE_API_ORIGIN = normalizeOrigin(CONFIG.sourceApiOrigin) || "https://count.web3origin.com";
  const API_ORIGIN = normalizeOrigin(CONFIG.apiOrigin) || SOURCE_API_ORIGIN;
  const PUBLIC_ORIGIN = normalizeOrigin(CONFIG.publicOrigin);
  const REFRESH_INTERVAL_MS = Math.max(15000, Number(CONFIG.refreshIntervalMs) || 60000);
  const remapMediaUrl = value => {
    const url = String(value || "");
    return MEDIA_ORIGIN !== SOURCE_MEDIA_ORIGIN && url.startsWith(SOURCE_MEDIA_ORIGIN + "/")
      ? MEDIA_ORIGIN + url.slice(SOURCE_MEDIA_ORIGIN.length)
      : url;
  };
  const apiOrigins = [API_ORIGIN];
  if (CONFIG.allowApiFallback !== false && API_ORIGIN !== SOURCE_API_ORIGIN) {
    apiOrigins.push(SOURCE_API_ORIGIN);
  }
  async function fetchApi(path, options) {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
      throw new Error("Invalid API path");
    }
    let lastError = new Error("API unavailable");
    for (const origin of apiOrigins) {
      try {
        const response = await fetch(origin + path, options);
        if (response.ok) return response;
        lastError = new Error("HTTP " + response.status);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
  const COURSES = Array.isArray(window.ACADEMY) ? window.ACADEMY : [];
  const VIDEOS = Array.isArray(window.VIDEOS)
    ? window.VIDEOS.filter(video => video && video.src).map(video => ({
        ...video,
        src: remapMediaUrl(video.src),
        poster: remapMediaUrl(video.poster)
      }))
    : [];
  const STORE_KEY = "web3origin_service_station_v2";
  let courseLevel = "all";
  let videoCategory = "all";
  let videoExpanded = false;
  let activeVideo = null;
  let lastVideoSave = 0;
  let radarData = null;
  let activeTool = null;
  let lastFocusedElement = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (error) { return {}; }
  }

  function writeStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (error) {}
  }

  function updateStore(section, key, value) {
    const data = readStore();
    data[section] = data[section] || {};
    if (value === false || value == null) delete data[section][key];
    else data[section][key] = value;
    writeStore(data);
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    const abs = Math.abs(number);
    if (abs >= 1e9) return (number / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (number / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (number / 1e3).toFixed(1) + "K";
    return Math.round(number).toLocaleString("zh-CN");
  }

  function formatUSD(value) {
    const number = Number(value);
    return Number.isFinite(number) ? "$" + formatNumber(number) : "—";
  }

  function formatPrice(value) {
    const number = Number(value);
    return Number.isFinite(number) ? "$" + number.toFixed(4) : "—";
  }

  function isAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
  }

  function shortAddress(value) {
    const text = String(value || "");
    return text.length > 14 ? text.slice(0, 8) + "…" + text.slice(-6) : text;
  }

  function explorerAddress(address, chain) {
    return (String(chain).toLowerCase() === "anubis"
      ? "https://browser.anubispace.org/address/"
      : "https://polygonscan.com/address/") + encodeURIComponent(address);
  }

  function explorerTx(hash, chain) {
    return (String(chain).toLowerCase() === "anubis"
      ? "https://browser.anubispace.org/tx/"
      : "https://polygonscan.com/tx/") + encodeURIComponent(hash);
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(String(value));
      if (button) {
        const old = button.textContent;
        button.textContent = "已复制";
        setTimeout(() => { button.textContent = old; }, 1000);
      }
    } catch (error) {
      if (button) button.textContent = "复制失败";
    }
  }

  function bindCopyButtons(root) {
    $$(".tool-copy", root).forEach(button => {
      button.addEventListener("click", () => copyText(button.dataset.copy, button));
    });
  }

  function openToolModal(title, renderer, toolName) {
    const modal = $("#toolModal");
    const body = $("#toolModalBody");
    if (!modal || !body) return;
    if (!modal.classList.contains("open")) lastFocusedElement = document.activeElement;
    activeTool = toolName;
    $("#toolModalTitle").textContent = title;
    body.innerHTML = "";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderer(body);
    setTimeout(() => body.querySelector("input,select,button")?.focus(), 20);
  }

  function closeToolModal() {
    const modal = $("#toolModal");
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeTool = null;
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  }

  const FALLBACK_CONTRACTS = [
    { name: "LGNS 主代币", chain: "Polygon", addr: "0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01", type: "Token" },
    { name: "LGNS / DAI 底池", chain: "Polygon", addr: "0x882df4B0fB50a229C3B4124EB18c759911485bFb", type: "Liquidity" },
    { name: "主国库 Treasury", chain: "Polygon", addr: "0x7B9B7d4F870A38e92c9a181B00f9b33cc8Ef5321", type: "Treasury" },
    { name: "质押池 Staking", chain: "Polygon", addr: "0x1964Ca90474b11FFD08af387b110ba6C96251Bfc", type: "Staking" },
    { name: "sLGNS 质押凭证", chain: "Polygon", addr: "0x99a57E6C8558BC6689f894e068733ADf83C19725", type: "Token" },
    { name: "LGNS 主代币", chain: "Anubis", addr: "0x4D1D808a081FdAc440703b3765FC61f8028C06B8", type: "Token" },
    { name: "主质押合约", chain: "Anubis", addr: "0x7a2E3fA6eA60437F0441b8eb5e60674B80339228", type: "Staking" }
  ];

  const FALLBACK_EVENTS = [
    {
      id: "ORIGIN-2024-001", title: "LGNS 代币在 Polygon 部署", cat: "Token 创建",
      date: "2024-03-06 16:34 UTC", chain: "Polygon",
      tx: "0x1074b961d4f3b1fb9519f91e18c10d769600a61258affdaeffb5d504168365da",
      summary: "LGNS 主代币部署到 Polygon，可由区块浏览器独立核验。"
    },
    {
      id: "ORIGIN-2026-001", title: "Anubis 隐私公链主网上线", cat: "重大升级",
      date: "2026-04-08", chain: "Anubis", tx: "",
      summary: "Anubis 主网上线，Chain ID 6714，Gas 使用 DAI。"
    },
    {
      id: "ORIGIN-2026-003", title: "LGNS 部署上 Anubis 链", cat: "合约部署",
      date: "2026-04-28 00:14 UTC", chain: "Anubis",
      tx: "0xf5e7f5848346e69ac543aa377f5d14d63f27ca0b02071d33b9ca829e798b021c",
      summary: "LGNS 主代币完成 Anubis 链部署。"
    }
  ];

  function renderContractsTool(body) {
    const contracts = Array.isArray(window.CONTRACTS) && window.CONTRACTS.length
      ? window.CONTRACTS : FALLBACK_CONTRACTS;
    body.innerHTML = '<div class="tool-form"><div class="tool-field"><label for="contractSearch">搜索名称或合约地址</label>'
      + '<input class="tool-input" id="contractSearch" type="search" placeholder="LGNS / Treasury / 0x…"></div>'
      + '<button class="tool-action secondary" id="contractClear" type="button">清空搜索</button></div>'
      + '<div class="tool-result" id="contractResults"></div>'
      + '<div class="tool-disclaimer">地址来自 Web3Origin 公开合约库；点击浏览器链接可再次独立核验。</div>';
    const output = $("#contractResults", body);
    const input = $("#contractSearch", body);
    const render = () => {
      const query = input.value.trim().toLowerCase();
      const matches = contracts.filter(item => {
        const text = [item.name, item.addr, item.chain, item.type, item.category].join(" ").toLowerCase();
        return !query || text.includes(query);
      }).slice(0, 80);
      output.innerHTML = '<div class="tool-message">找到 ' + matches.length + ' 个匹配合约</div><div class="tool-list">'
        + matches.map(item => {
          const address = item.addr || item.address || "";
          const chain = item.chain || "Polygon";
          return '<div class="tool-list-item"><div class="tool-list-item-head"><b>' + escapeHtml(item.name || "未命名合约")
            + '</b><small>' + escapeHtml(chain) + ' · ' + escapeHtml(item.type || item.category || "Contract") + '</small></div>'
            + '<a href="' + escapeHtml(explorerAddress(address, chain)) + '" target="_blank" rel="noopener">'
            + escapeHtml(address) + ' ↗</a><div><button class="tool-copy" type="button" data-copy="' + escapeHtml(address)
            + '">复制地址</button></div></div>';
        }).join("") + "</div>";
      bindCopyButtons(output);
    };
    input.addEventListener("input", render);
    $("#contractClear", body)?.addEventListener("click", () => { input.value = ""; render(); input.focus(); });
    render();
  }

  function renderWalletTool(body) {
    body.innerHTML = '<form class="tool-form three" id="walletForm"><div class="tool-field"><label for="walletChain">网络</label>'
      + '<select class="tool-select" id="walletChain"><option value="polygon">Polygon</option><option value="anubis">Anubis</option></select></div>'
      + '<div class="tool-field"><label for="walletAddress">公开钱包地址</label><input class="tool-input" id="walletAddress" '
      + 'placeholder="0x…（不要输入助记词或私钥）" autocomplete="off" spellcheck="false"></div>'
      + '<button class="tool-action" type="submit">开始体检</button></form><div class="tool-result" id="walletResult"></div>'
      + '<div class="tool-disclaimer">只读取公开链上数据，不连接钱包、不签名、不代管资产。</div>';
    const form = $("#walletForm", body);
    const output = $("#walletResult", body);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const address = $("#walletAddress", body).value.trim();
      const chain = $("#walletChain", body).value;
      if (!isAddress(address)) {
        output.innerHTML = '<div class="tool-message error">地址格式不正确，应为 0x 开头的 42 位地址。</div>';
        return;
      }
      output.innerHTML = '<div class="tool-message">正在读取公开链上数据，首次查询可能需要数秒…</div>';
      try {
        const response = await fetchApi("/wallet?chain="
          + encodeURIComponent(chain) + "&addr=" + encodeURIComponent(address), { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (!data?.ok) throw new Error("invalid response");
        const tokens = Array.isArray(data.tokens) ? data.tokens.filter(token => Number(token.amount) > 0) : [];
        const unlimited = Array.isArray(data.approvals) ? data.approvals.filter(item => item.unlimited) : [];
        const bigOut = Array.isArray(data.transfers)
          ? data.transfers.filter(item => item.dir === "out" && /LGNS/i.test(item.token || "") && Number(item.amount) >= 1000)
          : [];
        let riskScore = Math.max(10, 100 - Math.min(unlimited.length * 15, 55) - (bigOut.length ? 10 : 0));
        const chainName = data.chain || (chain === "anubis" ? "Anubis" : "Polygon");
        const native = data.native || {};
        output.innerHTML = '<div class="tool-result-grid">'
          + '<div class="tool-result-card"><span>地址类型</span><b>' + (data.isContract ? "合约地址" : "普通钱包") + '</b></div>'
          + '<div class="tool-result-card"><span>只读风险评分</span><b>' + riskScore + ' / 100</b></div>'
          + '<div class="tool-result-card"><span>' + escapeHtml(native.sym || "原生代币") + ' 余额</span><b>' + formatNumber(native.amount) + '</b></div>'
          + '<div class="tool-result-card"><span>已识别代币</span><b>' + tokens.length + ' 种</b></div></div>'
          + (tokens.length ? '<div class="tool-list">' + tokens.map(token =>
            '<div class="tool-list-item"><div class="tool-list-item-head"><b>' + escapeHtml(token.sym || token.symbol || "Token")
            + '</b><span>' + escapeHtml(formatNumber(token.amount)) + '</span></div></div>').join("") + "</div>" : "")
          + '<div class="tool-message ' + (unlimited.length ? "warn" : "") + '" style="margin-top:12px">'
          + (unlimited.length ? "检测到 " + unlimited.length + " 项无限授权，请到对应钱包或区块浏览器逐项确认。"
            : "当前返回数据中未发现无限授权。") + (bigOut.length ? " 另有 " + bigOut.length + " 笔大额 LGNS 转出。" : "") + "</div>"
          + '<div style="margin-top:12px"><a class="tool-inline-link" href="' + escapeHtml(explorerAddress(address, chainName))
          + '" target="_blank" rel="noopener">在区块浏览器核验该地址 ↗</a></div>';
      } catch (error) {
        output.innerHTML = '<div class="tool-message error">暂时无法读取该地址，请检查网络后重试。</div>';
      }
    });
  }

  function renderSecurityTool(body) {
    const lgns = "0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01";
    body.innerHTML = '<form class="tool-form" id="securityForm"><div class="tool-field"><label for="securityAddress">Polygon 代币合约</label>'
      + '<input class="tool-input" id="securityAddress" value="' + lgns + '" autocomplete="off" spellcheck="false"></div>'
      + '<button class="tool-action" type="submit">安全检测</button></form><div class="tool-result" id="securityResult"></div>'
      + '<div class="tool-disclaimer">检测数据由 GoPlus Token Security API 返回；结果是辅助信息，不替代人工审计。</div>';
    const output = $("#securityResult", body);
    $("#securityForm", body).addEventListener("submit", async event => {
      event.preventDefault();
      const address = $("#securityAddress", body).value.trim().toLowerCase();
      if (!isAddress(address)) {
        output.innerHTML = '<div class="tool-message error">请输入有效的 Polygon 合约地址。</div>';
        return;
      }
      output.innerHTML = '<div class="tool-message">正在查询公开安全数据…</div>';
      try {
        const response = await fetch("https://api.gopluslabs.io/api/v1/token_security/137?contract_addresses="
          + encodeURIComponent(address), { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const result = data.result?.[address];
        if (!result) {
          output.innerHTML = '<div class="tool-message warn">未查到该代币，可能不在 Polygon 或尚未被收录。</div>';
          return;
        }
        const yesNo = value => value === "1" ? "是" : "否";
        const tax = value => Number.isFinite(Number(value)) ? (Number(value) * 100).toFixed(1) + "%" : "—";
        const owner = result.owner_address && !/^0x0{40}$/i.test(result.owner_address)
          ? shortAddress(result.owner_address) : "无 / 已弃权";
        output.innerHTML = '<div class="tool-message"><b>' + escapeHtml(result.token_name || "?") + " ("
          + escapeHtml(result.token_symbol || "?") + ')</b></div><div class="tool-result-grid" style="margin-top:10px">'
          + '<div class="tool-result-card"><span>是否貔貅</span><b>' + yesNo(result.is_honeypot) + '</b></div>'
          + '<div class="tool-result-card"><span>买入税 / 卖出税</span><b>' + tax(result.buy_tax) + " / " + tax(result.sell_tax) + '</b></div>'
          + '<div class="tool-result-card"><span>可增发</span><b>' + yesNo(result.is_mintable) + '</b></div>'
          + '<div class="tool-result-card"><span>可暂停转账</span><b>' + yesNo(result.transfer_pausable) + '</b></div>'
          + '<div class="tool-result-card"><span>有黑名单</span><b>' + yesNo(result.is_blacklisted) + '</b></div>'
          + '<div class="tool-result-card"><span>源码开源</span><b>' + yesNo(result.is_open_source) + '</b></div>'
          + '<div class="tool-result-card"><span>Owner</span><b>' + escapeHtml(owner) + '</b></div>'
          + '<div class="tool-result-card"><span>持币地址数</span><b>' + formatNumber(result.holder_count) + '</b></div></div>'
          + '<div style="margin-top:12px"><a class="tool-inline-link" href="' + escapeHtml(explorerAddress(address, "Polygon"))
          + '" target="_blank" rel="noopener">在 PolygonScan 继续核验 ↗</a></div>';
      } catch (error) {
        output.innerHTML = '<div class="tool-message error">安全接口暂时不可用，请稍后重试。</div>';
      }
    });
  }

  function renderEvidenceTool(body) {
    const events = Array.isArray(window.EVENTS) && window.EVENTS.length ? window.EVENTS : FALLBACK_EVENTS;
    body.innerHTML = '<div class="tool-form three"><div class="tool-field"><label for="evidenceChain">区块链</label>'
      + '<select class="tool-select" id="evidenceChain"><option value="all">全部链</option><option value="Polygon">Polygon</option>'
      + '<option value="Anubis">Anubis</option></select></div><div class="tool-field"><label for="evidenceSearch">搜索事件、地址或交易哈希</label>'
      + '<input class="tool-input" id="evidenceSearch" type="search" placeholder="部署 / 质押 / 0x…"></div>'
      + '<button class="tool-action secondary" id="evidenceReset" type="button">重置</button></div>'
      + '<div class="tool-result" id="evidenceResults"></div>';
    const output = $("#evidenceResults", body);
    const render = () => {
      const chain = $("#evidenceChain", body).value;
      const query = $("#evidenceSearch", body).value.trim().toLowerCase();
      const matches = events.filter(item => {
        const chainMatch = chain === "all" || item.chain === chain;
        const text = [item.id, item.title, item.cat, item.summary, item.tx,
          JSON.stringify(item.contracts || []), JSON.stringify(item.addresses || [])].join(" ").toLowerCase();
        return chainMatch && (!query || text.includes(query));
      }).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
      output.innerHTML = '<div class="tool-message">共 ' + matches.length + ' 个公开事件</div><div class="tool-list">'
        + matches.map(item => {
          const txLink = item.tx ? '<a href="' + escapeHtml(explorerTx(item.tx, item.chain))
            + '" target="_blank" rel="noopener">核验交易 ' + escapeHtml(shortAddress(item.tx)) + ' ↗</a>' : "";
          const contractLinks = (item.contracts || []).map(contract => '<a href="'
            + escapeHtml(explorerAddress(contract.a, item.chain)) + '" target="_blank" rel="noopener">'
            + escapeHtml(contract.n || "相关合约") + " " + escapeHtml(shortAddress(contract.a)) + " ↗</a>").join("");
          return '<div class="tool-list-item"><div class="tool-list-item-head"><b>' + escapeHtml(item.title)
            + '</b><small>' + escapeHtml(item.date || "") + ' · ' + escapeHtml(item.chain || "") + '</small></div>'
            + '<small>' + escapeHtml(item.id || item.cat || "") + '</small><div>' + escapeHtml(item.summary || "") + '</div>'
            + txLink + contractLinks + "</div>";
        }).join("") + "</div>";
    };
    $("#evidenceChain", body).addEventListener("change", render);
    $("#evidenceSearch", body).addEventListener("input", render);
    $("#evidenceReset", body)?.addEventListener("click", () => {
      $("#evidenceChain", body).value = "all";
      $("#evidenceSearch", body).value = "";
      render();
    });
    render();
  }

  function renderDashboardTool(body) {
    if (!radarData) {
      body.innerHTML = '<div class="tool-message">实时数据仍在加载，点击刷新后再查看。</div>'
        + '<button class="tool-action" id="toolRefreshRadar" type="button" style="margin-top:12px">刷新实时数据</button>';
      $("#toolRefreshRadar", body)?.addEventListener("click", loadRadarData);
      return;
    }
    const market = radarData.market || {};
    const eco = radarData.eco || {};
    const treasury = radarData.treasury || {};
    const anubis = radarData.anubis || {};
    const health = radarData.health || {};
    const change = Number(market.change24h);
    body.innerHTML = '<div class="tool-result-grid">'
      + '<div class="tool-result-card"><span>LGNS 价格</span><b>' + formatPrice(market.price) + ' · '
      + (Number.isFinite(change) ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%" : "—") + '</b></div>'
      + '<div class="tool-result-card"><span>全网供应</span><b>' + formatNumber(market.supply) + ' LGNS</b></div>'
      + '<div class="tool-result-card"><span>质押率</span><b>' + (Number.isFinite(Number(eco.stakeRate)) ? Number(eco.stakeRate).toFixed(2) + "%" : "—") + '</b></div>'
      + '<div class="tool-result-card"><span>生态 TVL</span><b>' + formatUSD(eco.tvl) + '</b></div>'
      + '<div class="tool-result-card"><span>国库市值</span><b>' + formatUSD(treasury.marketValue) + '</b></div>'
      + '<div class="tool-result-card"><span>Anubis 高度</span><b>' + formatNumber(anubis.height) + '</b></div>'
      + '<div class="tool-result-card"><span>地址数</span><b>' + formatNumber(anubis.addresses || radarData.wallets?.anbAddresses) + '</b></div>'
      + '<div class="tool-result-card"><span>健康评分</span><b>' + (Number.isFinite(Number(health.score)) ? Math.round(health.score) + "/100" : "—") + '</b></div></div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="tool-action" id="toolRefreshRadar" type="button">刷新</button>'
      + '<button class="tool-action secondary" id="dashboardWhales" type="button">查看大额成交</button></div>'
      + '<div class="tool-disclaimer">公开数据每 60 秒自动刷新；最终数据请以链上与区块浏览器为准。</div>';
    $("#toolRefreshRadar", body)?.addEventListener("click", loadRadarData);
    $("#dashboardWhales", body)?.addEventListener("click", () => {
      openToolModal("大额成交监测", renderWhalesTool, "whales");
    });
  }

  function renderWhalesTool(body) {
    body.innerHTML = '<form class="tool-form" id="whaleForm"><div class="tool-field"><label for="whaleThreshold">最低成交额（DAI）</label>'
      + '<input class="tool-input" id="whaleThreshold" type="number" min="0" step="100" value="10000"></div>'
      + '<button class="tool-action" type="submit">筛选成交</button></form><div class="tool-result" id="whaleResult"></div>'
      + '<div class="tool-disclaimer">从雷达接口返回的近期 LGNS/DAI 成交中筛选；“买/卖”是成交方向，不是投资建议。</div>';
    const output = $("#whaleResult", body);
    const render = event => {
      event?.preventDefault();
      if (!radarData) {
        output.innerHTML = '<div class="tool-message warn">实时成交尚未加载，请先点击页面顶部“刷新数据”。</div>';
        return;
      }
      const threshold = Math.max(0, Number($("#whaleThreshold", body).value) || 0);
      const rows = (Array.isArray(radarData.events) ? radarData.events : [])
        .filter(item => Number(item.dai) >= threshold).sort((a, b) => Number(b.ts) - Number(a.ts)).slice(0, 20);
      output.innerHTML = rows.length ? '<div class="tool-list">' + rows.map(item => {
        const side = item.dir === "buy" ? "买入" : item.dir === "sell" ? "卖出" : item.dir || "成交";
        const time = item.ts ? new Date(Number(item.ts) * 1000).toLocaleString("zh-CN") : "近期";
        return '<div class="tool-list-item"><div class="tool-list-item-head"><b>' + escapeHtml(side) + " "
          + formatNumber(item.lgns) + ' LGNS</b><span>' + formatNumber(item.dai) + ' DAI</span></div><small>'
          + escapeHtml(time) + " · " + escapeHtml(shortAddress(item.who)) + '</small>'
          + (item.tx ? '<a href="' + escapeHtml(explorerTx(item.tx, "Polygon")) + '" target="_blank" rel="noopener">核验交易 ↗</a>' : "")
          + "</div>";
      }).join("") + "</div>" : '<div class="tool-message">近期返回数据中没有达到该阈值的成交，可调低阈值重新筛选。</div>';
    };
    $("#whaleForm", body).addEventListener("submit", render);
    render();
  }

  function renderCalculatorTool(body) {
    body.innerHTML = '<form id="calculatorForm"><div class="tool-result-grid">'
      + '<div class="tool-field"><label for="calcPrincipal">质押本金（LGNS）</label><input class="tool-input" id="calcPrincipal" type="number" min="0" step="any" value="1000"></div>'
      + '<div class="tool-field"><label for="calcDays">质押天数</label><input class="tool-input" id="calcDays" type="number" min="1" max="3650" step="1" value="30"></div>'
      + '<div class="tool-field"><label for="calcRate">每 6 小时奖励率（%）</label><input class="tool-input" id="calcRate" type="number" min="0" step="0.001" value="0.3"></div>'
      + '<div class="tool-field"><label for="calcPrice">假设币价（DAI，可选）</label><input class="tool-input" id="calcPrice" type="number" min="0" step="any" value="'
      + (Number(radarData?.market?.price) || "") + '"></div></div><button class="tool-action" type="submit" style="margin-top:13px">计算复利情景</button></form>'
      + '<div class="tool-result" id="calculatorResult"></div><div class="tool-disclaimer">默认 0.3% 仅是可编辑的演示参数，不代表承诺收益。实际奖励率、币价、滑点与税费都会变化。</div>';
    const calculate = event => {
      event?.preventDefault();
      const principal = Math.max(0, Number($("#calcPrincipal", body).value) || 0);
      const days = Math.max(0, Number($("#calcDays", body).value) || 0);
      const rate = Math.max(0, Number($("#calcRate", body).value) || 0) / 100;
      const price = Math.max(0, Number($("#calcPrice", body).value) || 0);
      const periods = days * 4;
      const total = principal * Math.pow(1 + rate, periods);
      const reward = total - principal;
      const annualized = rate > 0 ? (Math.pow(1 + rate, 1461) - 1) * 100 : 0;
      $("#calculatorResult", body).innerHTML = '<div class="tool-result-grid">'
        + '<div class="tool-result-card"><span>预计期末数量</span><b>' + formatNumber(total) + ' LGNS</b></div>'
        + '<div class="tool-result-card"><span>数量增加</span><b>' + formatNumber(reward) + ' LGNS</b></div>'
        + '<div class="tool-result-card"><span>按输入参数折算年化</span><b>' + formatNumber(annualized) + '%</b></div>'
        + '<div class="tool-result-card"><span>按假设币价估值</span><b>' + (price ? formatUSD(total * price) : "未输入币价") + '</b></div></div>';
    };
    $("#calculatorForm", body).addEventListener("submit", calculate);
    calculate();
  }

  function renderReferrerTool(body) {
    body.innerHTML = '<form class="tool-form" id="referrerForm"><div class="tool-field"><label for="referrerAddress">查询地址的推荐人绑定</label>'
      + '<input class="tool-input" id="referrerAddress" placeholder="0x…（仅查询公开绑定数据）" autocomplete="off" spellcheck="false"></div>'
      + '<button class="tool-action" type="submit">查询</button></form><div class="tool-result" id="referrerResult"></div>'
      + '<div class="tool-disclaimer">此处只显示公开接口返回的免费结果，不发起转账、不代替用户付款，也不会要求私钥。</div>';
    const output = $("#referrerResult", body);
    $("#referrerForm", body).addEventListener("submit", async event => {
      event.preventDefault();
      const address = $("#referrerAddress", body).value.trim().toLowerCase();
      if (!isAddress(address)) {
        output.innerHTML = '<div class="tool-message error">请输入有效的钱包地址。</div>';
        return;
      }
      output.innerHTML = '<div class="tool-message">正在查询公开绑定关系…</div>';
      try {
        const response = await fetchApi("/referrer?addr=" + encodeURIComponent(address), { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (!data?.ok) throw new Error("invalid response");
        if (!data.hasRef) {
          output.innerHTML = '<div class="tool-message">该地址暂未查到推荐人绑定关系。</div>';
          return;
        }
        output.innerHTML = '<div class="tool-result-grid"><div class="tool-result-card"><span>推荐人（公开遮罩结果）</span><b>'
          + escapeHtml(data.masked || shortAddress(data.referrer) || "已绑定") + '</b></div>'
          + '<div class="tool-result-card"><span>查询状态</span><b>链上已绑定</b></div></div>'
          + '<div class="tool-message warn" style="margin-top:12px">仅展示公开接口返回的免费遮罩结果，不发起付款、转账或钱包签名。</div>';
      } catch (error) {
        output.innerHTML = '<div class="tool-message error">查询接口暂时不可用，请稍后重试。</div>';
      }
    });
  }

  const TOOL_RENDERERS = {
    contracts: ["合约验证中心", renderContractsTool],
    wallet: ["钱包监控 · 链上体检", renderWalletTool],
    security: ["代币安全自查", renderSecurityTool],
    evidence: ["起源链上证据库", renderEvidenceTool],
    dashboard: ["链上数据面板", renderDashboardTool],
    whales: ["大额成交监测", renderWhalesTool],
    calculator: ["质押收益计算器", renderCalculatorTool],
    referrer: ["查推荐人（绑定关系）", renderReferrerTool]
  };

  function openLocalInfo() {
    openToolModal("资料说明", body => {
      body.innerHTML = '<div class="course-reader"><div class="reader-lede"><b>学习内容、课程问答、视频目录、合约档案与证据数据均由本地资源加载。</b></div>'
        + '<div class="reader-block"><h4>打开方式</h4><p>课程点击后直接阅读，视频点击后直接播放，工具点击后在弹窗使用，不跳转到 Web3Origin 的课程或视频页面。</p></div>'
        + '<div class="reader-block"><h4>联网内容</h4><p>视频文件采用公开媒体源流式播放，实时雷达、钱包查询和安全检测需要联网读取公开接口；页面地址和交互不会改变。</p></div>'
        + '<div class="reader-block"><h4>安全边界</h4><p>不连接钱包、不发起签名、不要求助记词或私钥。区块浏览器核验链接属于独立公开证据入口。</p></div></div>';
    }, "info");
  }

  function openCourseRoute(course) {
    if (!course) return;
    if (document.body.dataset.page === "academy") openCourse(course);
    else window.location.href = "academy.html?course=" + encodeURIComponent(course.slug);
  }

  function openVideoRoute(video) {
    if (!video) return;
    if (document.body.dataset.page === "videos") openVideo(video);
    else window.location.href = "videos.html?video=" + encodeURIComponent(video.slug);
  }

  function initTools() {
    $$("[data-tool]").forEach(card => {
      card.addEventListener("click", event => {
        const config = TOOL_RENDERERS[card.dataset.tool];
        if (!config) return;
        event.preventDefault();
        openToolModal(config[0], config[1], card.dataset.tool);
      });
    });
    $$("[data-course]").forEach(link => {
      link.addEventListener("click", event => {
        const course = COURSES.find(item => item.slug === link.dataset.course);
        if (!course) return;
        event.preventDefault();
        openCourseRoute(course);
      });
    });
    $("#localInfoBtn")?.addEventListener("click", openLocalInfo);
    $("#toolModalClose")?.addEventListener("click", closeToolModal);
    $("#toolModal")?.addEventListener("click", event => {
      if (event.target.id === "toolModal") closeToolModal();
    });
  }

  function levelName(level) {
    return ({
      1: "Web3 入门",
      2: "钱包安全",
      3: "DeFi 基础",
      4: "Origin 生态",
      5: "链上研究"
    })[level] || "课程";
  }

  function openCourse(course) {
    if (!course) return;
    const courseTools = Array.isArray(course.tools) ? course.tools : [];
    const relatedVideos = VIDEOS.filter(video => {
      const videoTools = Array.isArray(video.tools) ? video.tools : [];
      return courseTools.some(tool => videoTools.includes(tool));
    }).slice(0, 4);
    openToolModal(course.title, body => {
      const done = Boolean((readStore().courseDone || {})[course.slug]);
      body.innerHTML = '<article class="course-reader">'
        + '<div class="reader-lede">Lv.' + escapeHtml(course.level) + " · " + escapeHtml(levelName(course.level))
        + " · 约 " + escapeHtml(course.dur || 6) + " 分钟<br><b>" + escapeHtml(course.objective || "") + "</b></div>"
        + '<div class="reader-block"><h4>大白话说明</h4><p>' + escapeHtml(String(course.plain || "").replace(/^大白话：/, "")) + "</p></div>"
        + '<div class="reader-block"><h4>举个例子</h4><p>' + escapeHtml(String(course.example || "").replace(/^举个例子：/, "")) + "</p></div>"
        + ((course.faq || []).length ? '<div class="reader-faq"><h4>这节课常见问题</h4>'
          + course.faq.map(item => '<details><summary>' + escapeHtml(item.q) + '</summary><p>'
            + escapeHtml(item.a) + "</p></details>").join("") + "</div>" : "")
        + (relatedVideos.length ? '<div class="reader-videos"><h4>相关视频</h4>'
          + relatedVideos.map(video => '<button class="reader-video" type="button" data-reader-video="'
            + escapeHtml(video.slug) + '"><span>▶ ' + escapeHtml(video.title) + '</span><small>'
            + escapeHtml(video.durText || "") + "</small></button>").join("") + "</div>" : "")
        + '<div class="reader-actions"><button class="tool-action" id="readerDone" type="button">'
        + (done ? "✓ 已完成（点击取消）" : "标记本课已完成") + '</button>'
        + '<button class="tool-action secondary" id="readerBackCatalog" type="button">返回课程目录</button></div>'
        + '<div class="tool-disclaimer">课程正文、问答和学习进度均在当前页面展示；学习进度仅保存在当前浏览器。</div></article>';
      $("#readerDone", body)?.addEventListener("click", () => {
        const current = Boolean((readStore().courseDone || {})[course.slug]);
        updateStore("courseDone", course.slug, !current);
        updateCourseProgress();
        renderCourses();
        openCourse(course);
      });
      $("#readerBackCatalog", body)?.addEventListener("click", () => {
        closeToolModal();
        $("#academy-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      $$("[data-reader-video]", body).forEach(button => {
        button.addEventListener("click", () => {
          const video = VIDEOS.find(item => item.slug === button.dataset.readerVideo);
          closeToolModal();
          openVideoRoute(video);
        });
      });
    }, "course");
  }

  function renderCourses() {
    const grid = $("#courseGrid");
    if (!grid) return;
    if (!COURSES.length) {
      grid.innerHTML = '<div class="empty-state">课程数据暂时无法载入，请确认“服务站11-1-assets”资料目录与网页放在同一文件夹。</div>';
      return;
    }

    const query = ($("#courseSearch")?.value || "").trim().toLowerCase();
    const done = readStore().courseDone || {};
    const matches = COURSES.filter(course => {
      const levelMatch = courseLevel === "all" || String(course.level) === courseLevel;
      const text = [course.title, course.title_en, course.plain, course.objective, course.slug].join(" ").toLowerCase();
      return levelMatch && (!query || text.includes(query));
    });

    grid.innerHTML = matches.length ? matches.map(course => {
      const isDone = Boolean(done[course.slug]);
      return '<article class="course-card' + (isDone ? " done" : "") + '" data-slug="' + escapeHtml(course.slug) + '">'
        + '<div class="course-top"><span class="course-level">Lv.' + escapeHtml(course.level) + " · " + escapeHtml(levelName(course.level)) + '</span>'
        + '<button class="course-check" type="button" aria-label="' + (isDone ? "取消完成标记" : "标记为已完成") + '" title="' + (isDone ? "已完成" : "标记完成") + '">' + (isDone ? "✓" : "") + "</button></div>"
        + '<button class="course-main" type="button">'
        + "<h3>" + escapeHtml(course.title) + "</h3>"
        + "<p>" + escapeHtml(String(course.plain || course.objective || "").replace(/^大白话：/, "")) + "</p>"
        + '<div class="course-foot"><span>⏱ ' + escapeHtml(course.dur || 6) + " 分钟</span><span>阅读 →</span></div>"
        + "</button></article>";
    }).join("") : '<div class="empty-state">没有找到匹配课程，换一个关键词试试。</div>';

    $$(".course-check", grid).forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest(".course-card");
        const slug = card.dataset.slug;
        const isDone = card.classList.contains("done");
        updateStore("courseDone", slug, !isDone);
        renderCourses();
        updateCourseProgress();
      });
    });
    $$(".course-main", grid).forEach(button => {
      button.addEventListener("click", () => {
        const slug = button.closest(".course-card").dataset.slug;
        openCourse(COURSES.find(course => course.slug === slug));
      });
    });
    updateCourseProgress();
  }

  function updateCourseProgress() {
    const done = readStore().courseDone || {};
    const count = COURSES.filter(course => done[course.slug]).length;
    const total = COURSES.length || 36;
    const text = $("#courseProgressText");
    const fill = $("#courseProgressFill");
    if (text) text.textContent = "已完成 " + count + " / " + total;
    if (fill) fill.style.width = (total ? count / total * 100 : 0) + "%";
  }

  function renderFaqs() {
    const list = $("#faqList");
    if (!list) return;
    const allFaqs = COURSES.flatMap(course => (course.faq || []).map(item => ({
      q: item.q, a: item.a, courseTitle: course.title, slug: course.slug
    })));
    const query = ($("#faqSearch")?.value || "").trim().toLowerCase();
    const matches = allFaqs.filter(item => !query
      || [item.q, item.a, item.courseTitle].join(" ").toLowerCase().includes(query));
    if ($("#faqCount")) $("#faqCount").textContent = "共 " + matches.length + " 个问题";
    list.innerHTML = matches.length ? matches.map((item, index) =>
      '<article class="faq-item"><button class="faq-question" type="button" aria-expanded="false">'
      + escapeHtml(item.q) + ' <span style="float:right;color:var(--green-primary)">＋</span></button>'
      + '<div class="faq-answer"><p>' + escapeHtml(item.a) + '</p><button class="local-evidence-link" type="button" data-faq-course="'
      + escapeHtml(item.slug) + '">阅读相关课程：' + escapeHtml(item.courseTitle) + " →</button></div></article>"
    ).join("") : '<div class="empty-state">没有找到匹配问题，换一个关键词试试。</div>';
    $$(".faq-question", list).forEach(button => {
      button.addEventListener("click", () => {
        const item = button.closest(".faq-item");
        const open = item.classList.toggle("open");
        button.setAttribute("aria-expanded", String(open));
        button.querySelector("span").textContent = open ? "－" : "＋";
      });
    });
    $$("[data-faq-course]", list).forEach(button => {
      button.addEventListener("click", () => {
        openCourseRoute(COURSES.find(course => course.slug === button.dataset.faqCourse));
      });
    });
  }

  function videoCategoryName(category) {
    return ({
      "lgns-basic": "🪙 LGNS 基础",
      howto: "🎯 上手实操",
      web3: "🌱 Web3 基础",
      security: "🔐 钱包安全",
      defi: "💧 DeFi 入门",
      origin: "🏛️ Origin 生态",
      tools: "🛠️ 链上工具",
      research: "🔬 研究报告"
    })[category] || "视频课";
  }

  function renderVideos() {
    const grid = $("#videoLibrary");
    const more = $("#videoMore");
    if (!grid) return;
    if (!VIDEOS.length) {
      grid.innerHTML = '<div class="empty-state">视频目录暂时无法载入，请确认“服务站11-1-assets”资料目录与网页放在同一文件夹。</div>';
      if (more) more.hidden = true;
      return;
    }

    const query = ($("#videoSearch")?.value || "").trim().toLowerCase();
    const store = readStore();
    const favorites = store.videoFav || {};
    const progress = store.videoProgress || {};
    let matches = VIDEOS.filter(video => {
      const catMatch = videoCategory === "all" || videoCategory === "fav"
        ? true : video.cat === videoCategory;
      const favoriteMatch = videoCategory !== "fav" || favorites[video.slug];
      const text = [video.title, video.title_en, video.desc, video.slug].join(" ").toLowerCase();
      return catMatch && favoriteMatch && (!query || text.includes(query));
    });
    const totalMatches = matches.length;
    if (!videoExpanded && !query && videoCategory === "all") matches = matches.slice(0, 9);

    grid.innerHTML = matches.length ? matches.map(video => {
      const watched = Number(progress[video.slug] || 0);
      const poster = video.poster || "https://web3origin.com/assets/og-image.png";
      return '<article class="video-card" data-slug="' + escapeHtml(video.slug) + '">'
        + '<button class="video-open" type="button" aria-label="播放：' + escapeHtml(video.title) + '">'
        + '<div class="video-thumb"><img src="' + escapeHtml(poster) + '" alt="' + escapeHtml(video.title) + ' 视频封面" loading="lazy">'
        + '<div class="video-play-btn">▶</div><div class="video-duration">' + escapeHtml(video.durText || "") + "</div>"
        + '<div class="vid-prog-track" aria-hidden="true"><div class="vid-prog" style="width:' + Math.min(100, watched) + '%"></div></div></div>'
        + '<div class="video-card-body"><div class="video-cat">' + escapeHtml(videoCategoryName(video.cat)) + "</div>"
        + '<div class="video-title">' + escapeHtml(video.title) + "</div>"
        + '<div class="video-desc">' + escapeHtml(video.desc || "") + "</div>"
        + '<div class="video-card-foot"><span>' + (watched >= 90 ? "✓ 已看完" : watched > 0 ? "已看 " + Math.round(watched) + "%" : "公开课") + "</span><span>立即播放</span></div>"
        + "</div></button>"
        + '<button class="video-fav' + (favorites[video.slug] ? " on" : "") + '" type="button" aria-label="收藏视频" title="收藏">' + (favorites[video.slug] ? "★" : "☆") + "</button>"
        + "</article>";
    }).join("") : '<div class="empty-state">没有找到匹配视频。</div>';

    $$(".video-open", grid).forEach(button => {
      button.addEventListener("click", () => {
        const slug = button.closest(".video-card").dataset.slug;
        const video = VIDEOS.find(item => item.slug === slug);
        if (video) openVideo(video);
      });
    });
    $$(".video-fav", grid).forEach(button => {
      button.addEventListener("click", () => {
        const slug = button.closest(".video-card").dataset.slug;
        const isFavorite = Boolean((readStore().videoFav || {})[slug]);
        updateStore("videoFav", slug, !isFavorite);
        renderVideos();
      });
    });

    if (more) {
      more.hidden = totalMatches <= 9 || query || videoCategory !== "all";
      more.textContent = videoExpanded ? "收起视频" : "显示全部 " + totalMatches + " 部视频";
    }
  }

  function openVideo(video) {
    activeVideo = video;
    const modal = $("#videoModal");
    const player = $("#videoPlayer");
    const title = $("#videoModalTitle");
    const meta = $("#videoModalMeta");
    if (!modal || !player) return;
    if (!modal.classList.contains("open")) lastFocusedElement = document.activeElement;
    title.textContent = video.title;
    player.poster = video.poster || "";
    player.src = video.src;
    const store = readStore();
    const savedTime = Number((store.videoPosition || {})[video.slug] || 0);
    player.onloadedmetadata = () => {
      if (savedTime > 5 && savedTime < player.duration - 5) player.currentTime = savedTime;
    };
    meta.innerHTML = "<p>" + escapeHtml(video.desc || "") + "</p>"
      + '<p>正在播放 · ' + escapeHtml(video.durText || "")
      + ' · 播放位置与完成进度保存在当前浏览器。</p>';
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    player.play().catch(() => {});
  }

  function closeVideo() {
    const modal = $("#videoModal");
    const player = $("#videoPlayer");
    if (!modal || !player) return;
    const closingSlug = activeVideo?.slug;
    saveVideoProgress();
    player.pause();
    player.removeAttribute("src");
    player.load();
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeVideo = null;
    renderVideos();
    const freshTrigger = $$(".video-card").find(card => card.dataset.slug === closingSlug)?.querySelector(".video-open");
    if (freshTrigger) freshTrigger.focus();
    else if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  }

  function saveVideoProgress() {
    const player = $("#videoPlayer");
    if (!activeVideo || !player || !Number.isFinite(player.duration) || !player.duration) return;
    updateStore("videoPosition", activeVideo.slug, Math.floor(player.currentTime));
    updateStore("videoProgress", activeVideo.slug, Math.min(100, Math.round(player.currentTime / player.duration * 100)));
  }

  function renderAssistant(query) {
    const output = $("#aiResults");
    if (!output) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      output.className = "ai-results";
      output.innerHTML = "";
      return;
    }

    const answers = [
      {
        keys: ["收益", "奖励", "质押", "rebase", "年化"],
        text: "LGNS 质押奖励来自协议每 6 小时一次的 rebase 增发。币的数量增加不等于净收益，还要同时看价格、真实储备与通胀。",
        slugs: ["what-is-staking", "what-is-yield-model", "how-to-check-lgns-data"]
      },
      {
        keys: ["钱包", "助记词", "私钥", "被盗", "安全"],
        text: "钱包只是管理链上资产钥匙的工具。助记词和私钥永远不要输入网页，也不要截图上传云端；日常钱包与大额金库钱包应分开。",
        slugs: ["what-is-wallet", "private-key-and-seed", "protect-your-wallet"]
      },
      {
        keys: ["涡轮", "turbo", "能量"],
        text: "涡轮属于实操主题，建议先了解收益模型与风险，再观看对应操作视频。页面不会替你发起交易或要求连接钱包。",
        videos: ["lgns-turbo-full", "turbo-energy", "lgns-turbo-claim"]
      },
      {
        keys: ["anubis", "跨链", "6714", "dai"],
        text: "Anubis 是 Origin 生态自建公链，Chain ID 为 6714，Gas 使用 DAI。跨链前请核对网络、代币和目标地址，并先做小额测试。",
        slugs: ["what-is-anubis-chain", "how-to-use-block-explorer"],
        videos: ["okx-add-anubis-network", "bridge-dai-to-anubis", "bridge-lgns-to-anubis"]
      },
      {
        keys: ["合约", "验证", "项目", "权限", "增发"],
        text: "验证项目应检查合约是否开源、能否升级、管理员权限、增发能力和国库真实资产，并给每个结论附上可复核地址或交易哈希。",
        slugs: ["how-to-read-contracts", "how-to-verify-project", "how-to-write-onchain-report"]
      }
    ];
    const answer = answers.find(item => item.keys.some(key => q.includes(key)));
    const scoredCourses = COURSES.map(course => {
      const text = [course.title, course.plain, course.objective, course.slug].join(" ").toLowerCase();
      let score = text.includes(q) ? 5 : 0;
      q.split(/\s+/).filter(Boolean).forEach(token => { if (text.includes(token)) score += 1; });
      return { course, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.course.slug);
    const courseSlugs = Array.from(new Set([...(answer?.slugs || []), ...scoredCourses])).slice(0, 4);
    const videoSlugs = (answer?.videos || []).slice(0, 3);
    const links = [
      ...courseSlugs.map(slug => {
        const course = COURSES.find(item => item.slug === slug);
        return course ? '<button type="button" data-ai-course="' + escapeHtml(slug) + '">📖 '
          + escapeHtml(course.title) + "</button>" : "";
      }),
      ...videoSlugs.map(slug => {
        const video = VIDEOS.find(item => item.slug === slug);
        return video ? '<button type="button" data-ai-video="' + escapeHtml(slug) + '">▶ '
          + escapeHtml(video.title) + "</button>" : "";
      })
    ].filter(Boolean);
    const fallback = "我会从学院资料里帮你定位最相关的课程。这个助手只做知识检索，不给投资建议，也不会要求连接钱包。";
    output.innerHTML = "<strong>学习导航建议</strong><p>" + escapeHtml(answer?.text || fallback) + '</p><div class="ai-result-links">'
      + (links.length ? links.join("") : '<button type="button" data-ai-catalog="1">查看完整学院</button>') + "</div>";
    output.className = "ai-results show";
    $$("[data-ai-course]", output).forEach(button => {
      button.addEventListener("click", () => openCourseRoute(COURSES.find(course => course.slug === button.dataset.aiCourse)));
    });
    $$("[data-ai-video]", output).forEach(button => {
      button.addEventListener("click", () => {
        const video = VIDEOS.find(item => item.slug === button.dataset.aiVideo);
        openVideoRoute(video);
      });
    });
    $("[data-ai-catalog]", output)?.addEventListener("click", () => {
      if ($("#academy-catalog")) $("#academy-catalog").scrollIntoView({ behavior: "smooth", block: "start" });
      else window.location.href = "academy.html";
    });
  }

  function chartPath(values) {
    if (!Array.isArray(values) || values.length < 2) return "M0,100 L600,100";
    const numbers = values.map(Number).filter(Number.isFinite);
    if (numbers.length < 2) return "M0,100 L600,100";
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const range = max - min || 1;
    return numbers.map((value, index) => {
      const x = index / (numbers.length - 1) * 600;
      const y = 104 - (value - min) / range * 86;
      return (index ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
  }

  async function loadRadarData() {
    const status = $("#radarStatus");
    const globalStatus = $("#globalDataStatus");
    status?.classList.remove("online", "offline");
    if (status) status.textContent = "正在刷新公开数据";
    if (globalStatus) globalStatus.textContent = "刷新中";
    try {
      const response = await fetchApi("/radar", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data || !data.ok) throw new Error("无有效数据");
      radarData = data;
      const market = data.market || {};
      const anubis = data.anubis || {};
      const eco = data.eco || {};
      const treasury = data.treasury || {};
      const wallets = data.wallets || {};
      const health = data.health || {};
      const risk = data.risk || {};
      const change = Number(market.change24h);
      const changeText = Number.isFinite(change) ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%" : "—";
      const changeClass = Number.isFinite(change) ? (change >= 0 ? "up" : "down") : "";

      $("#globalPrice").textContent = formatPrice(market.price);
      $("#globalPriceChange").textContent = changeText;
      $("#globalPriceChange").className = "global-change " + changeClass;
      $("#globalSupply").textContent = formatNumber(market.supply);
      $("#globalStakeRate").textContent = Number.isFinite(Number(eco.stakeRate)) ? Number(eco.stakeRate).toFixed(1) + "%" : "—";
      $("#globalTreasury").textContent = formatUSD(treasury.marketValue);
      $("#globalTvl").textContent = formatUSD(eco.tvl);
      $("#globalBlock").textContent = formatNumber(anubis.height);
      $("#globalAddresses").textContent = formatNumber(anubis.addresses || wallets.anbAddresses);
      globalStatus.textContent = "在线";
      globalStatus.className = "global-change up";

      setText("#metricAddresses", formatNumber(wallets.anbAddresses || anubis.addresses));
      setText("#metricTxToday", formatNumber(wallets.txToday || anubis.txToday));
      setText("#metricBlock", formatNumber(anubis.height));
      setText("#metricBlockTime", Number.isFinite(Number(anubis.blockTime)) ? "约 " + anubis.blockTime + " 秒出块" : "—");
      setText("#metricHealth", Number.isFinite(Number(health.score)) ? Math.round(health.score) + "/100" : "—");
      setText("#metricRisk", risk.level ? "风险：" + risk.level : "机械计算参考");
      const metricNetwork = $("#metricNetwork");
      if (metricNetwork) {
        metricNetwork.textContent = data.net?.anubis === false ? "网络状态异常" : "网络正常";
        metricNetwork.className = "metric-change " + (data.net?.anubis === false ? "down" : "up");
      }

      const dailyPrice = $("#dailyPrice");
      if (dailyPrice) {
        dailyPrice.textContent = formatPrice(market.price) + " (" + changeText + ")";
        dailyPrice.className = "daily-val " + changeClass;
      }
      setText("#dailySupply", formatNumber(market.supply) + " LGNS");
      setText("#dailyStaked", formatNumber(eco.staked) + " LGNS");
      setText("#dailyTreasury", formatUSD(treasury.marketValue));
      setText("#dailyLp", formatUSD(eco.lp));

      const line = chartPath(market.spark);
      $("#marketLine")?.setAttribute("d", line);
      $("#marketArea")?.setAttribute("d", line + " L600,120 L0,120 Z");
      const updated = new Date(data.ts || Date.now()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      setText("#radarUpdated", "更新 " + updated);
      if (status) {
        status.textContent = "公开数据在线";
        status.classList.add("online");
      }
      if (activeTool === "dashboard" && $("#toolModalBody")) renderDashboardTool($("#toolModalBody"));
    } catch (error) {
      if (status) {
        status.textContent = "实时接口暂不可用";
        status.classList.add("offline");
      }
      if (globalStatus) {
        globalStatus.textContent = "离线";
        globalStatus.className = "global-change down";
      }
    }
  }

  function initNavigation() {
    const toggle = $("#navToggle");
    const nav = $(".nav-links");
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });
    $$('.nav-link[href^="#"]').forEach(link => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
        if (toggle) toggle.textContent = "☰";
      });
    });
  }

  function initScrollUi() {
    const backToTop = $("#backToTop");
    const navLinks = $$('.nav-link[href^="#"]');
    const sectionLinks = navLinks.filter(link => link.getAttribute("href") !== "#home").map(link => ({
      link,
      element: $(link.getAttribute("href"))
    })).filter(item => item.element);
    let ticking = false;
    const update = () => {
      const marker = window.scrollY + 150;
      let activeHref = "#home";
      sectionLinks.forEach(item => {
        const top = item.element.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) activeHref = item.link.getAttribute("href");
      });
      navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === activeHref));
      backToTop?.classList.toggle("show", window.scrollY > 720);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    update();
  }

  function trapModalFocus(event) {
    if (event.key !== "Tab") return;
    const modal = $(".modal.open");
    if (!modal) return;
    const focusable = $$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])', modal)
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initFilters() {
    $("#courseSearch")?.addEventListener("input", renderCourses);
    $("#faqSearch")?.addEventListener("input", renderFaqs);
    $$("#courseFilters .filter-btn").forEach(button => {
      button.addEventListener("click", () => {
        courseLevel = button.dataset.level;
        $$("#courseFilters .filter-btn").forEach(item => item.classList.toggle("active", item === button));
        renderCourses();
      });
    });
    $("#videoSearch")?.addEventListener("input", renderVideos);
    $$("#videoFilters .filter-btn").forEach(button => {
      button.addEventListener("click", () => {
        videoCategory = button.dataset.cat;
        $$("#videoFilters .filter-btn").forEach(item => item.classList.toggle("active", item === button));
        renderVideos();
      });
    });
    $("#videoMore")?.addEventListener("click", () => {
      videoExpanded = !videoExpanded;
      renderVideos();
    });
    $("#expandAllVideos")?.addEventListener("click", () => {
      videoExpanded = true;
      videoCategory = "all";
      if ($("#videoSearch")) $("#videoSearch").value = "";
      $$("#videoFilters .filter-btn").forEach(item => item.classList.toggle("active", item.dataset.cat === "all"));
      renderVideos();
      $("#videoLibrary")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function initEmbers() {
    const canvas = $("#originEmbers");
    if (!canvas || !canvas.getContext || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let particles = [];
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: Math.min(44, Math.max(22, Math.round(width / 36))) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: .5 + Math.random() * 1.7,
        vy: .12 + Math.random() * .42,
        vx: -.12 + Math.random() * .24,
        alpha: .08 + Math.random() * .38
      }));
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y -= particle.vy;
        if (particle.y < -8) {
          particle.y = height + 8;
          particle.x = Math.random() * width;
        }
        const glow = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.r * 5);
        glow.addColorStop(0, "rgba(240,212,138," + particle.alpha + ")");
        glow.addColorStop(1, "rgba(122,11,18,0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.r * 5, 0, Math.PI * 2);
        context.fill();
      });
      requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    draw();
  }

  function initMotion() {
    if (!("IntersectionObserver" in window)) {
      $$(".fade-up").forEach(element => element.style.animationPlayState = "running");
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = "running";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    $$(".fade-up").forEach(element => {
      element.style.animationPlayState = "paused";
      observer.observe(element);
    });
  }

  function boot() {
    const pagePaths = {
      home: "/",
      academy: "/academy.html",
      videos: "/videos.html",
      tools: "/tools.html",
      radar: "/radar.html"
    };
    const pagePath = pagePaths[document.body.dataset.page] || "/";
    document.documentElement.dataset.siteMode = PUBLIC_ORIGIN
      ? "public"
      : (window.location.protocol === "file:" ? "local" : "hosted");
    $$('a[target="_blank"]').forEach(link => {
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
    });
    document.addEventListener("click", event => {
      const link = event.target.closest?.('a[target="_blank"]');
      if (!link) return;
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
    }, true);
    if (PUBLIC_ORIGIN) {
      const canonicalUrl = PUBLIC_ORIGIN + pagePath;
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = canonicalUrl;
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement("meta");
        ogUrl.setAttribute("property", "og:url");
        document.head.appendChild(ogUrl);
      }
      ogUrl.content = canonicalUrl;
    }
    initNavigation();
    initScrollUi();
    initFilters();
    initMotion();
    initEmbers();
    initTools();
    const courseCount = COURSES.length || 36;
    const videoCount = VIDEOS.length || 61;
    if ($("#heroVideoCount")) $("#heroVideoCount").textContent = videoCount;
    if ($("#quickVideoCount")) $("#quickVideoCount").textContent = videoCount;
    if ($("#evidenceVideoCount")) $("#evidenceVideoCount").textContent = videoCount;
    if ($("#aiDatasetCount")) $("#aiDatasetCount").textContent = courseCount + " 节课程与 " + videoCount + " 部视频";
    renderCourses();
    renderVideos();
    renderFaqs();
    const params = new URLSearchParams(window.location.search);
    const requestedCourse = params.get("course");
    const requestedVideo = params.get("video");
    if (requestedCourse && document.body.dataset.page === "academy") {
      const course = COURSES.find(item => item.slug === requestedCourse);
      if (course) setTimeout(() => openCourse(course), 0);
    }
    if (requestedVideo && document.body.dataset.page === "videos") {
      const video = VIDEOS.find(item => item.slug === requestedVideo);
      if (video) setTimeout(() => openVideo(video), 0);
    }
    loadRadarData();
    setInterval(loadRadarData, REFRESH_INTERVAL_MS);
    $("#refreshData")?.addEventListener("click", loadRadarData);

    const input = $(".ai-input");
    const send = $(".ai-send");
    const ask = () => {
      const query = input?.value || "";
      if (!query.trim()) return;
      if (send) send.textContent = "✓";
      renderAssistant(query);
      setTimeout(() => { if (send) send.textContent = "➜"; }, 600);
    };
    send?.addEventListener("click", ask);
    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); ask(); }
    });

    $("#videoModalClose")?.addEventListener("click", closeVideo);
    $("#videoModal")?.addEventListener("click", event => {
      if (event.target.id === "videoModal") closeVideo();
    });
    document.addEventListener("keydown", event => {
      trapModalFocus(event);
      if (event.key === "Escape" && $("#videoModal")?.classList.contains("open")) closeVideo();
      if (event.key === "Escape" && $("#toolModal")?.classList.contains("open")) closeToolModal();
    });
    $("#videoPlayer")?.addEventListener("timeupdate", () => {
      if (Date.now() - lastVideoSave > 3000) {
        lastVideoSave = Date.now();
        saveVideoProgress();
      }
    });
    $("#videoPlayer")?.addEventListener("ended", () => {
      if (activeVideo) updateStore("videoProgress", activeVideo.slug, 100);
    });
    window.addEventListener("pagehide", saveVideoProgress);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveVideoProgress();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
