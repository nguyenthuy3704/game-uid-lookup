import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors()); // Cho phép gọi từ frontend

const BASE_HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  origin: "https://www.midasbuy.com",
  referer: "https://www.midasbuy.com/midasbuy/us/buy/hok",
};

// ⚡ Launch Chromium (Render-compatible)
async function launchBrowser() {
  const executablePath =
    (await chromium.executablePath) ||
    "/usr/bin/chromium-browser"; // fallback local dev

  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
}

// ⚡ Sinh payload từ UID
async function generatePayload(uid) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto("https://www.midasbuy.com/midasbuy/us/buy/hok", {
      waitUntil: "networkidle2",
    });

    const payload = await page.evaluate((uid) => {
      const ctoken = document.getElementById("xMidasToken")?.value;
      const ctoken_ver =
        document.getElementById("xMidasVersion")?.value || "1.0.1";

      if (!ctoken) throw new Error("❌ Không tìm thấy ctoken");

      const offset = window._SERVER_TIME_OFFSET || 0;
      const ts = Date.now() - (offset > 0 && offset <= 15000 ? 0 : offset);
      const obj = { t: ts, h: location.hostname, o: uid };

      const raw = window.xMidas({ d: JSON.stringify(obj) });
      if (!raw) throw new Error("❌ xMidas trả về rỗng");

      const bytes = (raw.match(/../g) || []).map((h) => parseInt(h, 16));
      const encrypt_msg = btoa(String.fromCharCode(...bytes));

      return { encrypt_msg, ctoken, ctoken_ver };
    }, uid);

    return payload;
  } finally {
    await browser.close(); // Đảm bảo browser luôn được đóng
  }
}

// ⚡ API getCharac
async function fetchCharac(uid) {
  const { encrypt_msg, ctoken, ctoken_ver } = await generatePayload(uid);

  const res = await axios.post(
    "https://www.midasbuy.com/interface/getCharac",
    { encrypt_msg, ctoken, ctoken_ver },
    { headers: { ...BASE_HEADERS, "content-type": "application/json" } }
  );

  return res.data;
}

// 📌 Endpoint
app.post("/api/hok", async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "Thiếu UID" });

  try {
    const data = await fetchCharac(uid);
    res.json(data);
  } catch (err) {
    console.error("❌ API error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
