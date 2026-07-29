/*
 * 全站部署配置
 *
 * 域名确定后只需要修改这个文件，不需要逐页查找替换。
 * 留空表示继续使用当前默认来源，适合本地预览和域名尚未确定时使用。
 */
window.SITE_CONFIG = Object.freeze({
  siteName: "链上服务站",

  // 示例：https://www.example.com
  publicOrigin: "",

  // 示例：https://media.example.com
  // 填写后，视频与封面地址会自动从 sourceMediaOrigin 映射到这里。
  mediaOrigin: "",
  sourceMediaOrigin: "https://media.web3origin.com",

  // 示例：https://api.example.com
  // 新接口尚未部署时请留空，现有实时功能会继续使用 sourceApiOrigin。
  apiOrigin: "",
  sourceApiOrigin: "https://count.web3origin.com",

  // 自有接口临时故障时是否回退到现有公开接口。
  allowApiFallback: true,

  // 实时数据自动刷新间隔，单位为毫秒。
  refreshIntervalMs: 60000
});
