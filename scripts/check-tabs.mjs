const B = "http://localhost:3100";
const j = {};
function sc(r) { for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); j[p.slice(0, i)] = p.slice(i + 1); } }
const ch = () => Object.entries(j).map(([k, v]) => `${k}=${v}`).join("; ");
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const strip = (s) => s.replace(/<!--.*?-->/g, "");
function af(h) {
  const f = {};
  const re = /<input[^>]*name="(\$ACTION[^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(h))) {
    const vm = /value="([^"]*)"/.exec(m[0]);
    f[m[1]] = vm ? dec(vm[1]) : "";
  }
  return f;
}
function fc(h, mk) {
  const i = h.indexOf(mk);
  return h.slice(h.lastIndexOf("<form", i), h.indexOf("</form>", i));
}
async function g(p) {
  const r = await fetch(B + p, { headers: { cookie: ch() }, redirect: "manual" });
  sc(r);
  return { s: r.status, b: r.status === 200 ? strip(await r.text()) : "" };
}
async function pa(p, h, x, mk) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(af(fc(h, mk)))) fd.append(k, v);
  for (const [k, v] of Object.entries(x)) fd.append(k, v);
  const r = await fetch(B + p, { method: "POST", body: fd, headers: { cookie: ch() }, redirect: "manual" });
  sc(r);
}
function check(l, c) {
  console.log((c ? "✅" : "❌") + " " + l);
  if (!c) process.exitCode = 1;
}
function tabsNav(html) {
  const i = html.indexOf("案件明細下載");
  const s = html.lastIndexOf("<nav", i);
  const e = html.indexOf("</nav>", i) + 6;
  return html.slice(s, e);
}
function tabTag(nav, href) {
  const i = nav.indexOf(`href="${href}"`);
  const s = nav.lastIndexOf("<a", i);
  const e = nav.indexOf("</a>", i) + 4;
  return nav.slice(s, e);
}

const lp = await g("/login");
await pa("/login", lp.b, { username: "boss", password: "1234" }, 'name="username"');

const catUsage = await g("/reports/category-usage");
check("類別統計頁載入", catUsage.s === 200);
const nav = tabsNav(catUsage.b);
const activeTab = tabTag(nav, "/reports/category-usage");
const inactiveTab = tabTag(nav, "/reports/export");
check("active分頁有實心藍底(bg-blue-600)", activeTab.includes("bg-blue-600"));
check("active分頁文字為白色(text-white)", activeTab.includes("text-white"));
check("active分頁有 aria-current", activeTab.includes('aria-current="page"'));
check("非active分頁沒有藍底", !inactiveTab.includes("bg-blue-600"));
check("nav容器有膠囊底色(bg-slate-100 rounded-xl)", nav.includes("bg-slate-100") && nav.includes("rounded-xl"));

console.log("\n完成。");
