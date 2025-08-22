import puppeteer from "puppeteer";

async function fetchUid(uid, server, game) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.goto("https://elitedias.com", { waitUntil: "networkidle2" });

  // lấy cookie Cloudflare
  const cookies = await page.cookies();
  const cf = cookies.find(c => c.name === "cf_clearance");

  // gọi API kèm cookie
  const resp = await page.evaluate(async (uid, server, game, cf) => {
    const res = await fetch("https://elitedias.com/api/checkid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `${cf.name}=${cf.value}`
      },
      body: JSON.stringify({ uid, server, game })
    });
    return res.text(); // trả về text để debug
  }, uid, server, game, cf);

  await browser.close();
  return resp;
}
