// 後台管理平台端到端檢查
const BASE = "http://localhost:3100";

function parseSetCookie(res, jar) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [p] = c.split(";");
    const i = p.indexOf("=");
    jar[p.slice(0, i)] = p.slice(i + 1);
  }
}
const ch = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
function actionFields(html) {
  const f = {};
  const re = /<input[^>]*name="(\$ACTION[^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const vm = /value="([^"]*)"/.exec(m[0]);
    f[m[1]] = vm ? vm[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"') : "";
  }
  return f;
}
function formContaining(html, marker) {
  const i = html.indexOf(marker);
  if (i === -1) return "";
  const s = html.lastIndexOf("<form", i);
  const e = html.indexOf("</form>", i);
  return html.slice(s, e);
}
async function get(path, jar) {
  const r = await fetch(BASE + path, { headers: { cookie: ch(jar) }, redirect: "manual" });
  parseSetCookie(r, jar);
  return { status: r.status, location: r.headers.get("location"), body: r.status === 200 ? await r.text() : "" };
}
async function postAction(path, pageHtml, extra, jar, marker, file) {
  const scoped = marker ? formContaining(pageHtml, marker) : pageHtml;
  const fd = new FormData();
  for (const [k, v] of Object.entries(actionFields(scoped))) fd.append(k, v);
  for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
  if (file) fd.append("file", new File([file.content], file.name, { type: "text/csv" }));
  const r = await fetch(BASE + path, { method: "POST", body: fd, headers: { cookie: ch(jar) }, redirect: "manual" });
  parseSetCookie(r, jar);
  return { status: r.status, location: r.headers.get("location"), body: r.status === 200 ? await r.text() : "" };
}
async function login(u, password = "1234") {
  const jar = {};
  const pg = await get("/login", jar);
  await postAction("/login", pg.body, { username: u, password }, jar, 'name="username"');
  return { jar };
}
function check(label, cond, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  // A. 非管理者被擋
  const kez = await login("k01a");
  const blocked = await get("/admin/users", kez.jar);
  check("課長無法進入後台（redirect）", blocked.status === 307 || blocked.status === 302, `status=${blocked.status}`);

  // B. 管理者可進後台
  const boss = await login("boss");
  const usersPage = await get("/admin/users", boss.jar);
  check("部主管可開啟人員管理", usersPage.status === 200 && usersPage.body.includes("人員清單"));

  // C. 新增人員 + 可登入
  const uname = "t" + Date.now().toString().slice(-8);
  const created = await postAction(
    "/admin/users",
    usersPage.body,
    { username: uname, name: "表單測試員", role: "KEZHANG", storeCode: "D01", deptCode: "09", password: "1234" },
    boss.jar,
    'name="username"'
  );
  check("新增人員成功（redirect）", created.status === 303, `status=${created.status}`);
  const newLogin = await login(uname);
  check("新人員可登入", !!newLogin.jar["sfa_session"]);

  // D. CSV 匯入
  const impUser = "imp" + Date.now().toString().slice(-7);
  const csv = `username,name,role,storeCode,deptCode,password\n${impUser},CSV匯入員,所長,D03,,4321\n`;
  const usersPage2 = await get("/admin/users", boss.jar);
  const imported = await postAction(
    "/admin/users",
    usersPage2.body,
    {},
    boss.jar,
    'name="file"',
    { content: csv, name: "users.csv" }
  );
  check("CSV 匯入回應成功(200)", imported.status === 200, `status=${imported.status}`);
  check("匯入結果訊息含『新增 1』", imported.body.includes("新增 1"), imported.body.match(/新增 \d+ 筆[^<]*/)?.[0] ?? "");
  const impLogin = await login(impUser, "4321");
  const impHome = await get("/", impLogin.jar);
  check("CSV 匯入的所長可用自訂密碼登入", impHome.status === 200 && impHome.body.includes("您好"));

  // E. 新增特案類別 → 出現在填單選項
  const catName = "測試類別" + Date.now().toString().slice(-5);
  const catPage = await get("/admin/categories", boss.jar);
  const catRes = await postAction("/admin/categories", catPage.body, { name: catName }, boss.jar, 'name="name"');
  check("新增特案類別(200)", catRes.status === 200, `status=${catRes.status}`);
  const newCasePage = await get("/cases/new", newLogin.jar);
  check("新類別出現在填單下拉", newCasePage.body.includes(catName), catName);

  // F. 新增月份
  const monthPage = await get("/admin/months", boss.jar);
  const mRes = await postAction("/admin/months", monthPage.body, { month: "2030-01" }, boss.jar, 'name="month"');
  check("新增月份(200)", mRes.status === 200 && mRes.body.includes("2030-01"));

  console.log("\n後台檢查完成。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
