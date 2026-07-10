const BASE = "http://localhost:3100";
function setCk(res, jar) { for (const c of res.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); jar[p.slice(0, i)] = p.slice(i + 1); } }
const ch = (j) => Object.entries(j).map(([k, v]) => `${k}=${v}`).join("; ");
function dec(s) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'"); }
function af(h) { const f = {}; const re = /<input[^>]*name="(\$ACTION[^"]*)"[^>]*>/g; let m; while ((m = re.exec(h))) { const vm = /value="([^"]*)"/.exec(m[0]); f[m[1]] = vm ? dec(vm[1]) : ""; } return f; }
function fc(h, mk) { const i = h.indexOf(mk); if (i < 0) return ""; const s = h.lastIndexOf("<form", i); const e = h.indexOf("</form>", i); return h.slice(s, e); }
async function get(p, j) { const r = await fetch(BASE + p, { headers: { cookie: ch(j) }, redirect: "manual" }); setCk(r, j); return { status: r.status, location: r.headers.get("location"), body: r.status === 200 ? await r.text() : "" }; }
async function pa(p, h, x, j, mk) { const fd = new FormData(); for (const [k, v] of Object.entries(af(mk ? fc(h, mk) : h))) fd.append(k, v); for (const [k, v] of Object.entries(x)) fd.append(k, String(v)); const r = await fetch(BASE + p, { method: "POST", body: fd, headers: { cookie: ch(j) }, redirect: "manual" }); setCk(r, j); return { status: r.status, location: r.headers.get("location"), body: r.status === 200 ? await r.text() : "" }; }
async function login(u) { const j = {}; const lp = await get("/login", j); await pa("/login", lp.body, { username: u, password: "1234" }, j, 'name="username"'); return j; }
function check(l, c, d = "") { console.log((c ? "✅" : "❌") + " " + l + (d ? " — " + d : "")); if (!c) process.exitCode = 1; }

async function catId(j) { const p = await get("/cases/new", j); return /<option value="(c[a-z0-9]+)">/.exec(p.body)[1]; }
let seq = 0;
function order() { return "D" + (Date.now().toString().slice(-9) + String(seq++).padStart(3, "0")).slice(-12); }
async function submitCase(j, cid, amounts = {}) {
  const np = await get("/cases/new", j);
  const orderNo = order();
  const r = await pa("/cases/new", np.body, {
    intent: "submit",
    plateName: "測試", orderNo, categoryId: cid, categoryNo: "D01-01-01", carModel: "ALTIS",
    description: "測試", deptCode: "01", subsidyDeptCourse: 1000, goldMedal: 0, silverMedal: 0, discountTotal: 0, specialSubsidy: 0,
    ...amounts,
  }, j, 'name="plateName"');
  const m = /&quot;caseId&quot;:&quot;([a-zA-Z0-9]+)&quot;/.exec(r.body);
  return { orderNo, url: `/cases/${m ? m[1] : ""}` };
}
async function withdraw(j, url) {
  const p = await get(url, j);
  const id = url.split("/").pop();
  return pa(url, p.body, { caseId: id }, j, "可撤回此單");
}
async function approve(j, url) {
  const p = await get(url, j);
  const id = url.split("/").pop();
  return pa(url, p.body, { caseId: id, decision: "APPROVE", comment: "ok" }, j, 'name="comment"');
}
function unresolvedSlice(body) {
  const a = body.indexOf("未結案件") >= 0 ? body.indexOf("未結案件") : body.indexOf("待審核案件");
  let e = body.indexOf("本月申請明細");
  if (e < 0) e = body.length;
  return body.slice(a, e);
}

async function main() {
  const k01a = await login("k01a");
  const cid = await catId(k01a);

  // A：課長送單後撤回
  const A = await submitCase(k01a, cid);
  await withdraw(k01a, A.url);
  const aDetail = await get(A.url, k01a);
  check("課長撤回案：明細顯示可重送或刪除", aDetail.body.includes("已撤回，可修改後重送或刪除"));
  check("課長撤回案：有刪除鈕", aDetail.body.includes(">刪除<"));
  check("課長撤回案：有修改後重送", aDetail.body.includes("修改後重送"));

  // D：課長送單 → 所長核准 → 待部主管審核
  const D = await submitCase(k01a, cid);
  const s01 = await login("s01");
  await approve(s01, D.url);

  // B：所長送單後自己撤回
  const B = await submitCase(s01, cid);
  await withdraw(s01, B.url);

  // 部主管：只看待部主管審核
  const boss = await login("boss");
  const bh = await get("/", boss.jar ?? boss);
  const bhb = (await get("/", boss)).body;
  check("部主管標題為『待審核案件』", bhb.includes("待審核案件"));
  check("部主管清單含待部長審核", bhb.includes("待部長審核"));
  check("部主管清單不含待所長審核", !bhb.includes("待所長審核"));
  check("部主管清單不含已撤回", !bhb.includes("已撤回"));
  check("部主管清單含 D 案", bhb.includes(D.orderNo), D.orderNo);

  // 所長首頁
  const sh = (await get("/", s01)).body;
  const su = unresolvedSlice(sh);
  check("所長未結含本人撤回案 B", su.includes(B.orderNo), B.orderNo);
  check("所長未結不含課長撤回案 A", !su.includes(A.orderNo), A.orderNo);
  check("課長撤回案 A 仍出現在所長本月明細", sh.includes(A.orderNo));

  // 刪除課長撤回案 A
  const aDel = await get(A.url, k01a);
  const idA = A.url.split("/").pop();
  const delRes = await pa(A.url, aDel.body, { caseId: idA }, k01a, `value="${idA}"`);
  check("刪除後導回首頁", delRes.status === 303 && delRes.location === "/", `status=${delRes.status} loc=${delRes.location}`);
  const aGone = await get(A.url, k01a);
  check("刪除後案件不存在(404)", aGone.status === 404, `status=${aGone.status}`);

  // 修改後重送 B（所長本人撤回）→ 待所長審核
  const editB = await get(B.url + "/edit", s01);
  const idB = B.url.split("/").pop();
  const reB = await pa(B.url + "/edit", editB.body, {
    intent: "submit",
    caseId: idB, plateName: "改", orderNo: B.orderNo, categoryId: cid, categoryNo: "D01-01-01",
    carModel: "ALTIS", description: "改", deptCode: "01", subsidyDeptCourse: 2000, goldMedal: 0, silverMedal: 0, discountTotal: 0, specialSubsidy: 0,
  }, s01, 'name="plateName"');
  // 送出後案件不再符合 edit 頁的可編輯條件，該頁會自行導回案件頁（307），為預期行為
  check("修改後重送成功(redirect 307)", reB.status === 307, `status=${reB.status}`);
  const bAfter = await get(B.url, s01);
  check("重送後狀態＝待所長審核", bAfter.body.includes("待所長審核"));

  console.log("\n完成。");
}
main().catch((e) => { console.error(e); process.exit(1); });
