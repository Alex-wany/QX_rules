/*
^https?:\/\/api\.xunjiapp\.cn\/(whole_user_info_checks_2|try_vip_get) url script-response-body https://gist.githubusercontent.com/Yu9191/ea4e1fdd1d7817faef96ad2748967504/raw/xunji1230.js
hostname = api.xunjiapp.cn
 */

// 最高版本7.00.229
const $ = new Env("训记VIP");
const CONFIG = {
  USER_INFO: { name: "王东东", vipds: 99999, isAdmin: false, expiry: Date.now() + 99999 * 24 * 60 * 60 * 1000 },
  TRY_VIP: { vipDay: 99999, hasTry: true, showVipTry: false }
};

(async () => {
  if (typeof $response === "undefined") return $done();
  // 首次运行通知
  if (!$.getdata("xj_tz_time")) {
    $.setdata(String(Date.now()), "xj_tz_time");
    $.msg("训记", "脚本免费,如果你是买的那你他妈是真蠢");
  }
  const url = $request?.url || "";
  const raw = $response.body || "";
  try {
    if (/\/try_vip_get/.test(url)) {
      let json = JSON.parse(raw);
      Object.assign(json.res || (json.res = {}), CONFIG.TRY_VIP);
      return $done({ body: JSON.stringify(json) });
    }
    if (!/\/whole_user_info_checks_2/.test(url)) return $done();
    const Utils = await loadUtils().catch(() => null);
    if (!Utils) { console.log("❌ Utils 加载失败"); return $done({ body: raw }); }
    const CryptoJS = Utils.createCryptoJS();
    let userData, decryptKey, isEnDataMode = false, originalJson = null, resWrapper = null;
    try {
      originalJson = JSON.parse(raw);
      let dataObj = originalJson;
      if (originalJson.res && originalJson.res.en_data) { resWrapper = originalJson; dataObj = originalJson.res; }
      if (dataObj.en_data && dataObj._userid) {
        isEnDataMode = true;
        decryptKey = dataObj._userid;
        originalJson = dataObj;
        const decrypted = CryptoJS.AES.decrypt(dataObj.en_data, decryptKey);
        userData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      } else {
        return $done({ body: raw });
      }
    } catch (e) {
      isEnDataMode = false;
      decryptKey = $request.headers?.["openid"] || $request.headers?.["Openid"] || $.getdata("xj_openid") || "";
      if (!decryptKey) { console.log("❌ 缺少 openid"); return $done({ body: raw }); }
      try {
        const decrypted = CryptoJS.AES.decrypt(raw, decryptKey);
        userData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      } catch (err) { console.log("❌ 解密失败"); return $done({ body: raw }); }
    }
    Object.assign(userData, CONFIG.USER_INFO);
    let encryptedBody;
    if (isEnDataMode) {
      originalJson.en_data = CryptoJS.AES.encrypt(JSON.stringify(userData), decryptKey).toString();
      encryptedBody = resWrapper ? (resWrapper.res = originalJson, JSON.stringify(resWrapper)) : JSON.stringify(originalJson);
    } else {
      encryptedBody = CryptoJS.AES.encrypt(JSON.stringify(userData), decryptKey).toString();
    }
    return $done({ body: encryptedBody });
  } catch (e) { console.log("❌ 异常:", e.message); return $done({ body: $response.body }); }
})();

async function loadUtils() {
  let code = $.getdata?.("Utils_Code") || "";
  if (code && code.length) { eval(code); return creatUtils(); }
  return new Promise((resolve, reject) => {
    $.getScript("https://cdn.jsdelivr.net/gh/xzxxn777/Surge@main/Utils/Utils.js").then((fn) => {
      $.setdata?.(fn, "Utils_Code"); eval(fn); resolve(creatUtils());
    }).catch(reject);
  });
}

function Env(name) {
  const isLoon = typeof $loon !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isLoon;
  const isQX = typeof $task !== "undefined";
  const log = (...args) => console.log(`[${name}]`, ...args);
  const getdata = (key) => { if (isSurge || isLoon) return $persistentStore.read(key); if (isQX) return $prefs.valueForKey(key); return null; };
  const setdata = (val, key) => { if (isSurge || isLoon) return $persistentStore.write(val, key); if (isQX) return $prefs.setValueForKey(val, key); return false; };
  const request = (method, opts) => {
    if (typeof opts === "string") opts = { url: opts };
    return new Promise((resolve, reject) => {
      const cb = (err, resp, body) => err ? reject(err) : resolve({ status: resp?.status || resp?.statusCode, headers: resp?.headers, body });
      if (isSurge || isLoon) { opts.method = method; $httpClient[method.toLowerCase()](opts, cb); }
      else if (isQX) { opts.method = method; $task.fetch(opts).then(r => cb(null, r, r.body), e => cb(e)); }
    });
  };
  const http = { get: (opts) => request("GET", opts), post: (opts) => request("POST", opts) };
  const getScript = (url) => new Promise((resolve, reject) => http.get({ url }).then(r => r.body ? resolve(r.body) : reject("Empty")).catch(reject));
  const msg = (title, sub = "", body = "", opts = {}) => { if (isSurge || isLoon) $notification.post(title, sub, body, opts); else if (isQX) $notify(title, sub, body, opts); else log(title, sub, body); };
  return { name, log, getdata, setdata, http, getScript, msg, isSurge, isLoon, isQX };
}
