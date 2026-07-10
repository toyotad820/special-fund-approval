const BASE = "http://localhost:3100";
function setCk(res, jar) { for (const c of res.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); jar[p.slice(0, i)] = p.slice(i + 1); } }
const ch = (j) => Object.entries(j).map(([k, v]) => `${k}=${v}`).join("; ");
function dec(s) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'"); }
const strip = (s) => s.replace(/<!--.*?-->/g, "");
function af(h) { const f = {}; const re = /<input[^>]*name="(\$ACTION[^"]*)"[^>]*>/g; let m; while ((m = re.exec(h))) { const vm = /value="([^"]*)"/.exec(m[0]); f[m[1]] = vm ? dec(vm[1]) : ""; } return f; }
function fc(h, mk) { const i = h.indexOf(mk); if (i < 0) return ""; const s = h.lastIndexOf("<form", i); const e = h.indexOf("</form>", i); return h.slice(s, e); }
async function get(p, j) { const r = await fetch(BASE + p, { headers: { cookie: ch(j) }, redirect: "manual" }); setCk(r, j); return { status: r.status, location: r.headers.get("location"), body: r.status === 200 ? strip(await r.text()) : "" }; }
async function pa(p, h, x, j, mk) { const fd = new FormData(); for (const [k, v] of Object.entries(af(mk ? fc(h, mk) : h))) fd.append(k, v); for (const [k, v] of Object.entries(x)) fd.append(k, String(v)); const r = await fetch(BASE + p, { method: "POST", body: fd, headers: { cookie: ch(j) }, redirect: "manual" }); setCk(r, j); return { status: r.status, location: r.headers.get("location"), body: r.status === 200 ? strip(await r.text()) : "" }; }
async function login(u) { const j = {}; const lp = await get("/login", j); await pa("/login", lp.body, { username: u, password: "1234" }, j, 'name="username"'); return j; }
function check(l, c, d = "") { console.log((c ? "✅" : "❌") + " " + l + (d ? " — " + d : "")); if (!c) process.exitCode = 1; }
async function catId(j) { const p = await get("/cases/new", j); return /<option value="(c[a-z0-9]+)">/.exec(p.body)[1]; }

async function main() {
  // ============ 項目1：儲存草稿 ============
  const k01a = await login("k01a");
  const np = await get("/cases/new", k01a);
  check("新增申請頁有『儲存草稿』按鈕", np.body.includes("儲存草稿"));

  // 存草稿：只填領牌名稱，其餘留空（測試寬鬆驗證）
  const draftRes = await pa("/cases/new", np.body, {
    intent: "draft",
    plateName: "草稿測試",
    orderNo: "",
    categoryId: "",
    categoryNo: "",
    carModel: "",
    description: "",
    subsidyDeptCourse: "",
    goldMedal: "",
    silverMedal: "",
    discountTotal: "",
    specialSubsidy: "",
  }, k01a, 'name="plateName"');
  // 注意：成功視窗(Modal)是純前端 useEffect 觸發，no-JS 腳本看不到；改驗證回傳的 action-state 資料是否正確
  check(
    "草稿儲存成功（回傳 ok:true + 訊息）",
    draftRes.status === 200 &&
      /&quot;ok&quot;:true/.test(draftRes.body) &&
      draftRes.body.includes("草稿已儲存"),
    `status=${draftRes.status}`
  );

  // 首頁應出現草稿（狀態徽章「草稿」）
  const home1 = await get("/", k01a);
  check("首頁未結區含『草稿』狀態", home1.body.includes("草稿"));
  check("首頁未結區含草稿的領牌名稱", home1.body.includes("草稿測試"));

  // 從首頁抓草稿案件連結
  const draftLinkMatch = /href="(\/cases\/[a-zA-Z0-9]+)"[^>]*>[\s\S]{0,400}?草稿測試/.exec(home1.body) || /(\/cases\/[a-zA-Z0-9]+)/.exec(home1.body);
  // 更可靠：直接查所有 /cases/ 連結，找出對應「草稿測試」那筆——改用抓取表格列
  const rows = home1.body.split("<tr").filter(r => r.includes("草稿測試"));
  const idMatch = rows.length ? /router\.push\(`(\/cases\/[a-zA-Z0-9]+)`\)/.exec(home1.body) : null;
  // 表格是 client component 用 onClick，SSR 不含 href，改抓 encoded state 中的 id 較麻煩；改用資料庫API方式：直接抓 /cases/new 送出後 redirect 位置不可得(因不redirect)。
  // 改用替代驗證：查詢後台清單頁不存在草稿專頁，改為在案件明細頁使用「刪除」按鈕測試——我們改抓 approvalLog 的方式不可行(無API)。
  // 改為：直接用課長本課本月明細（showTotals表）尋找 orderNo（草稿無填會產生 DRAFT- 開頭亂碼），改查 body 是否含 "DRAFT-"
  check("草稿的自動產生訂單編號可見(DRAFT- 開頭)", home1.body.includes("DRAFT-"));

  console.log("\n============ 項目3：所長課別必填數字欄 ============");
  const s01 = await login("s01");
  const sNew = await get("/cases/new", s01);
  {
    const i = sNew.body.indexOf('name="deptCode"');
    const tagStart = sNew.body.lastIndexOf("<input", i);
    const tagEnd = sNew.body.indexOf("/>", i);
    const tag = sNew.body.slice(tagStart, tagEnd);
    check(
      "所長填單頁課別為可編輯的必填 number input",
      tag.includes('type="number"') && tag.includes("required")
    );
  }

  const cid = await catId(s01);
  const orderNo = "D" + Date.now().toString().slice(-9) + "001";
  const sSubmit = await pa("/cases/new", sNew.body, {
    intent: "submit",
    plateName: "所長測試",
    orderNo,
    categoryId: cid,
    categoryNo: "D01-09-01",
    carModel: "ALTIS",
    description: "所長送單測試",
    deptCode: "9",
    subsidyDeptCourse: "1000",
    goldMedal: "0",
    silverMedal: "0",
    discountTotal: "0",
    specialSubsidy: "0",
  }, s01, 'name="plateName"');
  check(
    "所長送單成功（回傳 ok:true）",
    sSubmit.status === 200 && /&quot;ok&quot;:true/.test(sSubmit.body),
    `status=${sSubmit.status}`
  );

  console.log("\n============ 項目4：表格欄位（無月份欄、寬度、卷軸容器） ============");
  const home2 = await get("/", s01);
  check("表格表頭不含『月份』", !/<th[^>]*>\s*月份/.test(home2.body));
  check("表格含審核狀態、訂單編號、領牌名稱等欄位", home2.body.includes("審核狀態") && home2.body.includes("訂單編號") && home2.body.includes("領牌名稱"));
  check("所課支援金欄有寬度樣式", /所課支援金[\s\S]{0,20}style="width:\s*96px/.test(home2.body) || home2.body.includes('style="width:96px'));
  check("表格容器含垂直捲軸 class(max-h + overflow-auto)", /overflow-auto max-h-\[26rem\]/.test(home2.body));

  console.log("\n============ 項目2：取消按鈕 + 結果視窗 ============");
  check("新增申請頁含 ← 取消 按鈕", np.body.includes("← 取消"));
  check(
    "草稿的 action-state 含 ok/caseId/message（前端據此跳出成功視窗）",
    /&quot;ok&quot;:true/.test(draftRes.body) &&
      /&quot;caseId&quot;:&quot;[a-zA-Z0-9]+&quot;/.test(draftRes.body) &&
      draftRes.body.includes("草稿已儲存")
  );

  // 問題視窗（送出但缺必填 -> 應回傳 fieldErrors，前端據此跳出問題視窗）
  const np2 = await get("/cases/new", k01a);
  const badSubmit = await pa("/cases/new", np2.body, {
    intent: "submit",
    plateName: "",
    orderNo: "",
    categoryId: "",
    categoryNo: "",
    carModel: "",
    description: "",
    subsidyDeptCourse: "",
    goldMedal: "",
    silverMedal: "",
    discountTotal: "",
    specialSubsidy: "",
  }, k01a, 'name="plateName"');
  check(
    "缺必填送出：回傳 fieldErrors 而非 ok:true",
    badSubmit.status === 200 &&
      !/&quot;ok&quot;:true/.test(badSubmit.body) &&
      /fieldErrors/.test(badSubmit.body)
  );

  console.log("\n完成。");
}
main().catch((e) => { console.error(e); process.exit(1); });
