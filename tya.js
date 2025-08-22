// tya.js
import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const app = express();
const PORT = process.env.PORT || 3000;

async function fetchFromElite(game, serverid, userid) {
  const isLocal = process.platform === "win32"; // Windows = local dev
  const browser = await puppeteer.launch({
    headless: true,
    args: isLocal ? [] : chromium.args,
    executablePath: isLocal
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" // đường dẫn Chrome của bạn
      : await chromium.executablePath(),
    defaultViewport: chromium.defaultViewport,
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.goto("https://elitedias.com", { waitUntil: "domcontentloaded" });

  console.log("✅ Đã mở elitedias.com, chờ Cloudflare...");
  await new Promise((r) => setTimeout(r, 8000));

  const result = await page.evaluate(async ({ game, serverid, userid }) => {
    try {
      const res = await fetch("https://api.elitedias.com/checkid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/plain, */*",
        },
        body: JSON.stringify({ game, serverid, userid }),
      });

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { error: "JSON parse fail", raw: text };
      }
    } catch (err) {
      return { error: err.message };
    }
  }, { game, serverid, userid });

  await browser.close();
  return result;
}

app.get("/check", async (req, res) => {
  const { game, server, uid } = req.query;
  if (!game || !server || !uid) {
    return res.status(400).json({ error: "Thiếu tham số game, server, uid" });
  }

  try {
    const data = await fetchFromElite(game, server, uid);
    res.json({
      name: data?.name ?? null,
      openid: data?.openid ?? null,
      debug: data,
    });
  } catch (err) {
    console.error("❌ API lỗi:", err);
    res.status(500).json({ error: "Fetch thất bại", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
