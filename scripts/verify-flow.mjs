// 以 Next.js no-JS server action 協定，完整跑一次核心流程
const BASE = "http://localhost:3000";

function parseSetCookie(res, jar) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
}
function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function extractActionFields(html) {
  const fields = {};
  const re = /<input[^>]*name="(\$ACTION[^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const name = m[1];
    const vm = /value="([^"]*)"/.exec(tag);
    fields[name] = vm
      ? vm[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
      : "";
  }
  return fields;
}

// 只取「包含 marker 的那個 <form>」的 HTML（避免混到版面其他表單，如登出）
function formContaining(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return html;
  const start = html.lastIndexOf("<form", idx);
  const end = html.indexOf("</form>", idx);
  return html.slice(start === -1 ? 0 : start, end === -1 ? html.length : end);
}

// 送出一個 server action 表單（no-JS 協定），回傳 { status, location }
async function postAction(path, pageHtml, extra, jar, marker) {
  const scoped = marker ? formContaining(pageHtml, marker) : pageHtml;
  const fields = extractActionFields(scoped);
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
  const res = await fetch(BASE + path, {
    method: "POST",
    body: fd,
    headers: { cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  parseSetCookie(res, jar);
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

async function get(path, jar) {
  const res = await fetch(BASE + path, {
    headers: { cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  parseSetCookie(res, jar);
  const body = res.status < 300 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

function check(label, cond, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (!cond) process.exitCode = 1;
}

async function loginAs(username) {
  const jar = {};
  const page = await get("/login", jar);
  const r = await postAction("/login", page.body, { username, password: "1234" }, jar, 'name="username"');
  return { jar, r };
}

async function main() {
  // 1) 登入：課長 k01a
  const kez = await loginAs("k01a");
  check("課長登入設定 session cookie", !!kez.jar["sfa_session"], `status=${kez.r.status}`);
  const kezHome = await get("/", kez.jar);
  check("課長可進入儀表板", kezHome.status === 200 && kezHome.body.includes("您好"));

  // 2) 課長送單
  const newPage = await get("/cases/new", kez.jar);
  check("課長可開啟填單頁", newPage.status === 200 && newPage.body.includes("新增特案申請"));
  // 前 3 碼須為送單人所別（k01a 是 D01），共 13 碼英數字
  const orderNo = "D01" + Date.now().toString().slice(-10);
  const submit = await postAction(
    "/cases/new",
    newPage.body,
    {
      plateName: "測試領牌",
      orderNo,
      categoryId: "", // 故意留空 → 先測驗證會不會擋
      categoryNo: "D01-01-01",
      carModel: "ALTIS",
      description: "自動化測試案件",
      subsidyDeptCourse: "1000",
      goldMedal: "0",
      silverMedal: "0",
      discountTotal: "0",
      specialSubsidy: "5000",
    },
    kez.jar,
    'name="plateName"'
  );
  // categoryId 空 → 應回填錯誤(200) 而非 redirect
  check("必填驗證擋下缺類別的送單", submit.status === 200 || submit.status === 400, `status=${submit.status}`);

  // 需要真正的 categoryId：抓一個
  const catMatch = /<option value="(c[a-z0-9]+)">/.exec(newPage.body);
  const categoryId = catMatch ? catMatch[1] : "";
  check("取得特案類別選項 id", !!categoryId, categoryId);

  const newPage2 = await get("/cases/new", kez.jar);
  const submit2 = await postAction(
    "/cases/new",
    newPage2.body,
    {
      plateName: "測試領牌",
      orderNo,
      categoryId,
      categoryNo: "D01-01-01",
      carModel: "ALTIS",
      description: "自動化測試案件",
      subsidyDeptCourse: "1000",
      goldMedal: "0",
      silverMedal: "0",
      discountTotal: "0",
      specialSubsidy: "5000",
    },
    kez.jar,
    'name="plateName"'
  );
  // 送出成功後不再 redirect，改回傳 { ok, caseId, message }（供前端跳出結果視窗）
  const idMatch = /&quot;caseId&quot;:&quot;([a-zA-Z0-9]+)&quot;/.exec(submit2.body);
  const okMatch = /&quot;ok&quot;:true/.test(submit2.body);
  check("課長成功送單（回傳 ok+caseId）", submit2.status === 200 && okMatch && !!idMatch, `status=${submit2.status}`);
  const caseUrl = `/cases/${idMatch ? idMatch[1] : ""}`;

  // 3) 所長 s01 登入 → 待審應看到此案（v1.8.0 起首頁改統計儀表板，
  //    未結案件清單搬到「案件審核」頁）→ 核准
  const suo = await loginAs("s01");
  check("所長登入", !!suo.jar["sfa_session"]);
  const suoReview = await get("/cases-review", suo.jar);
  check("所長待審清單看到新案", suoReview.body.includes(orderNo), orderNo);

  const casePage = await get(caseUrl, suo.jar);
  check("所長可開啟案件並看到審核區", casePage.status === 200 && casePage.body.includes("審核"));
  const caseId = caseUrl.split("/").pop();
  const approve = await postAction(caseUrl, casePage.body, { caseId, decision: "APPROVE", comment: "所長同意" }, suo.jar, 'name="comment"');
  check("所長核准（進入第二關）", approve.status === 303, `status=${approve.status}`);
  const afterSuo = await get(caseUrl, suo.jar);
  check("狀態變為待部長審核", afterSuo.body.includes("待部長審核"));

  // 4) 部主管 boss 核准 → 已核准
  const boss = await loginAs("boss");
  check("部主管登入", !!boss.jar["sfa_session"], `status=${boss.r.status}`);
  const bossCase = await get(caseUrl, boss.jar);
  check("部主管可開啟案件", bossCase.status === 200, `status=${bossCase.status}`);
  check("部主管可審核（看到核准鈕）", bossCase.body.includes('value="APPROVE"') && bossCase.body.includes(orderNo));
  const approve2 = await postAction(caseUrl, bossCase.body, { caseId, decision: "APPROVE", comment: "核准" }, boss.jar, 'name="comment"');
  check("部主管核准", approve2.status === 303);
  const done = await get(caseUrl, boss.jar);
  check("最終狀態＝已核准", done.body.includes("已核准"));

  // 5) 權限：課長 k02a（D02）不應看到 D01 的案件
  const kez2 = await loginAs("k02a");
  const cross = await get(caseUrl, kez2.jar);
  check("跨據點課長無法檢視他所案件", cross.status !== 200 || !cross.body.includes(orderNo), `status=${cross.status}`);

  console.log("\n完成。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
