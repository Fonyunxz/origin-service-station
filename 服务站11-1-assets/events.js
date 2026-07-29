/* 起源链上证据库 · 事件数据集
   原则：没有链上证据不进核心档案。★★★★★=链上直证(交易/区块) ★★★★=官方公开 ★★★=社区整理
   交易哈希/地址/合约均可在区块浏览器独立核实。措辞客观中性。 */
window.EVENTS = [
  {
    id:"ORIGIN-2024-001", title:"LGNS 代币在 Polygon 部署", cat:"Token创建",
    date:"2024-03-06 16:34 UTC", ts:1709742866, chain:"Polygon", block:54339832,
    tx:"0x1074b961d4f3b1fb9519f91e18c10d769600a61258affdaeffb5d504168365da",
    contracts:[{n:"LGNS 代币",a:"0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01"}],
    addresses:[{n:"部署钱包",a:"0x5e4e7cadb7c3d10e3bc96fb830a724448d9b4351"}],
    summary:"起源核心代币 LGNS 的合约在 Polygon 链正式部署上线，由部署钱包 0x5e4e…4351 创建。这是整个起源生态的起点。",
    level:5, source:"链上合约创建交易"
  },
  {
    id:"ORIGIN-2024-002", title:"LGNS 首次铸造（存入 100,001 DAI）", cat:"Token创建",
    date:"2024-03-06 16:37 UTC", ts:1709743020, chain:"Polygon", block:54339972,
    tx:"0x9df4503580ae182a25580cd89704cd7070fba2a9a1e1da71544b609a5fe6a831",
    contracts:[{n:"主国库 Treasury",a:"0x7B9B7d4F870A38e92c9a181B00f9b33cc8Ef5321"},{n:"LGNS 代币",a:"0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01"}],
    addresses:[{n:"部署钱包",a:"0x5e4e7cadb7c3d10e3bc96fb830a724448d9b4351"}],
    summary:"部署钱包向国库存入 100,001 DAI，铸出首批 70,001 LGNS。这是 LGNS 的第一笔铸造，创世托底率约 1.43。",
    level:5, source:"链上铸造交易"
  },
  {
    id:"ORIGIN-2024-003", title:"开池定价：开盘价 4 DAI", cat:"流动性添加",
    date:"2024-03-06 16:52 UTC", ts:1709744000, chain:"Polygon", block:54340471,
    tx:"0x84443c8387ab6488d6aff80faf990743ba364f3d73167771bcdd0c93b1098330",
    contracts:[{n:"LGNS/DAI 底池",a:"0x882df4B0fB50a229C3B4124EB18c759911485bFb"}],
    addresses:[{n:"部署钱包",a:"0x5e4e7cadb7c3d10e3bc96fb830a724448d9b4351"}],
    summary:"向 LGNS/DAI 交易池注入 70,000 LGNS + 280,000 DAI，开盘价确定为 4 DAI/LGNS。这笔 28 万 DAI 是团队自有资金。",
    level:5, source:"链上添加流动性交易"
  },
  {
    id:"ORIGIN-2024-004", title:"首笔市场买入", cat:"市场事件",
    date:"2024-03-06 16:52 UTC", ts:1709744010, chain:"Polygon", block:54340475,
    tx:"", contracts:[{n:"LGNS/DAI 底池",a:"0x882df4B0fB50a229C3B4124EB18c759911485bFb"}],
    addresses:[{n:"首个买入地址",a:"0xcb099561dce45b0b401722a789f65db3233addf2"}],
    summary:"建池后约 8 秒（4 个区块）出现首笔买入：1,313 DAI 换得 325.74 LGNS。开盘即有多个地址同块扫货。",
    level:5, source:"链上区块记录（区块 54340475）"
  },
  {
    id:"ORIGIN-2024-005", title:"首位用户质押", cat:"生态发展事件",
    date:"2024-03-06 17:32 UTC", ts:1709746371, chain:"Polygon", block:54340900,
    tx:"", contracts:[{n:"质押助手 StakingHelper",a:"0x78654ed080c1d1c87907646fdb2ae48db3635341"}],
    addresses:[{n:"首个质押地址",a:"0xf2d3b56b44ccfafeac8f54bdbb6a5a79f4939094"}],
    summary:"生态首位真实用户质押 129.35 LGNS，通过 StakingHelper 完成。质押机制正式启用。",
    level:5, source:"链上区块记录"
  },
  {
    id:"ORIGIN-2024-006", title:"主国库合约部署", cat:"合约部署",
    date:"2024-03-06 16:35 UTC", ts:1709742936, chain:"Polygon", block:54339900,
    tx:"0x7366b7fc964af8c0ef54dbb785ef21d4096df571f81226e307cd3707b0bd9185",
    contracts:[{n:"主国库 Treasury",a:"0x7B9B7d4F870A38e92c9a181B00f9b33cc8Ef5321"}],
    addresses:[{n:"部署钱包",a:"0x5e4e7cadb7c3d10e3bc96fb830a724448d9b4351"}],
    summary:"生态资金与铸币中枢——主国库合约部署。它负责按储备铸造 LGNS、管理协议资金。",
    level:5, source:"链上合约创建交易"
  },
  {
    id:"ORIGIN-2024-007", title:"质押池与 sLGNS 部署", cat:"合约部署",
    date:"2024-03-06 16:37 UTC", ts:1709743000, chain:"Polygon", block:54339990,
    tx:"0xf16fd6c927352bc03663071ecfb638b063b33be1fc385d112f7281cdfdd8521b",
    contracts:[{n:"质押池 Staking",a:"0x1964Ca90474b11FFD08af387b110ba6C96251Bfc"},{n:"sLGNS 质押凭证",a:"0x99a57E6C8558BC6689f894e068733ADf83C19725"}],
    addresses:[{n:"部署钱包",a:"0x5e4e7cadb7c3d10e3bc96fb830a724448d9b4351"}],
    summary:"质押核心引擎部署：质押池负责存 LGNS 生成 sLGNS 生息凭证；sLGNS 随 rebase 自动增长。",
    level:5, source:"链上合约创建交易"
  },
  {
    id:"ORIGIN-2024-008", title:"通过安全审计", cat:"生态合作",
    date:"2024-04-22", ts:1713744000, chain:"Polygon", block:0, tx:"",
    contracts:[{n:"主国库 Treasury",a:"0x7B9B7d4F870A38e92c9a181B00f9b33cc8Ef5321"}],
    addresses:[],
    summary:"Armors Labs 完成 Treasury 合约专项审计（编号 0X202403040006，17 项检测全部 PASSED）；CertiK Skynet 持续监控，评级 A（82.58）。",
    level:4, source:"官方审计报告"
  },
  {
    id:"ORIGIN-2025-001", title:"Gate 交易所上架 LGNS", cat:"市场事件",
    date:"2025-09", ts:1756684800, chain:"Polygon", block:0, tx:"",
    contracts:[{n:"LGNS 代币",a:"0xeB51D9A39AD5EEF215dC0Bf39a8821ff804A0F01"}],
    addresses:[],
    summary:"Gate 交易所主动上架 LGNS，生态进入中心化交易所可交易阶段。",
    level:4, source:"官方公告 / 交易所页面"
  },
  {
    id:"ORIGIN-2026-001", title:"Anubis 隐私公链主网上线", cat:"重大升级",
    date:"2026-04-08", ts:1775952000, chain:"Anubis", block:0, tx:"",
    contracts:[], addresses:[],
    summary:"起源自建的隐私公链 Anubis 主网上线（Chain ID 6714，出块约 2 秒，gas 直接用 DAI），生态迈入双链时代。",
    level:4, source:"官方公告 / 链参数"
  },
  {
    id:"ORIGIN-2026-002", title:"ILO 发行合约部署", cat:"生态发展事件",
    date:"2026-03-29", ts:1774810022, chain:"Polygon", block:0,
    tx:"0x7ce65c23ff31b074abfefb98debc2eccf1574fca86610c0204c90d636e281245",
    contracts:[{n:"阿奴比 ILO",a:"0x13ac027C0336e80A09EB09328d1c401Ab08950A5"}],
    addresses:[],
    summary:"阿奴比 ILO 发行合约在 Polygon 部署，用于生态的初始发行募集。",
    level:5, source:"链上合约创建交易"
  },
  {
    id:"ORIGIN-2026-003", title:"LGNS 部署上 Anubis 链", cat:"合约部署",
    date:"2026-04-28 00:14 UTC", ts:1777335266, chain:"Anubis", block:0,
    tx:"0xf5e7f5848346e69ac543aa377f5d14d63f27ca0b02071d33b9ca829e798b021c",
    contracts:[{n:"LGNS 主代币(Anubis)",a:"0x4D1D808a081FdAc440703b3765FC61f8028C06B8"}],
    addresses:[{n:"部署钱包",a:"0xe979f492f934556c56fb9c1f6a82fecc7abb867e"}],
    summary:"LGNS 代币在 Anubis 链部署上线，生态核心资产实现双链。",
    level:5, source:"链上合约创建交易"
  },
  {
    id:"ORIGIN-2026-004", title:"Anubis 质押合约部署", cat:"合约部署",
    date:"2026-04-28 00:15 UTC", ts:1777335302, chain:"Anubis", block:0,
    tx:"0x5e0c535e4a6430ff7ef729173afeb820a5e9e6965b5955d49ffaa1462290b6b1",
    contracts:[{n:"主质押合约(Anubis)",a:"0x7a2E3fA6eA60437F0441b8eb5e60674B80339228"}],
    addresses:[{n:"部署钱包",a:"0xe979f492f934556c56fb9c1f6a82fecc7abb867e"}],
    summary:"Anubis 链质押合约部署，双链质押体系搭建。",
    level:5, source:"链上合约创建交易"
  },
  {
    id:"ORIGIN-2026-005", title:"LGNS 在 Anubis 链开盘", cat:"市场事件",
    date:"2026-05-13", ts:1778976000, chain:"Anubis", block:0, tx:"",
    contracts:[{n:"LGNS 主代币(Anubis)",a:"0x4D1D808a081FdAc440703b3765FC61f8028C06B8"}],
    addresses:[],
    summary:"LGNS 在 Anubis 链开盘交易，开盘价 5 U。",
    level:3, source:"社区 / 官方口径"
  }
];
