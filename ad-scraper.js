const fs         = require('fs');
const puppeteer  = require('puppeteer');
const { autoScroll, grabAds } = require('./helpers');
var Xvfb = require('xvfb');

const MAX_ADS            = 50;
const MAX_SCROLL_PASSES  = 12;
const MAX_IDLE_PASSES    = 2;

// Ritik
// var xvfb_switch = 0;
// var xvfb = new Xvfb({
//     silent: true,
//     reuse: true,
//     xvfb_args: ["-screen", "0", '1280x720x24', "-ac"],
// });

// if (xvfb_switch === 1){
//     xvfb.startSync((err)=>{if (err) console.error(err)});
// }


(async () => {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node ad_scraper.js <url>');
    process.exit(1);
  }

  var domain = target.split('://')[1].split('/')[0]

  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 } });
  const page    = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/123.0.0.0 Safari/537.36'
  );
  await page.goto(target, { waitUntil: 'networkidle2', timeout: 60000 });

  /* ─── harvest loop ───────────────────────────────────── */
  let allAds = {};
  let idle   = 0, same = -1, passes = 0;

  while (
    Object.keys(allAds).length < MAX_ADS &&
    passes < MAX_SCROLL_PASSES          &&
    idle   < MAX_IDLE_PASSES
  ) {
    passes += 1;
    await autoScroll(page);
    // await page.waitForTimeout(1200);
    await new Promise(r => setTimeout(r, 1200));
    
    const batch = await grabAds(page);
    batch.forEach(x => (allAds[x.id] = x));

    const total = Object.keys(allAds).length;
    idle = (total === same) ? idle + 1 : 0;
    same = total;
  }

  const output = Object.values(allAds).slice(0, MAX_ADS);
  fs.writeFileSync(`data/${domain}.json`, JSON.stringify(output, null, 2));
  console.log(`✅ Saved ${output.length} ads → 
    data/${domain}.json`);

  /* ─── screenshots ───────────────────────────────────── */
  for (const ad of output) {
    let handle = null;

    if (ad.network === 'taboola') {
      /* Taboola cards */
      handle = await page.$(
        `[data-item-id="${ad.id.replace(/"/g, '\\"')}"]`
      );

    } else {                   // Outbrain
      /* 1️⃣  legacy widgets that carry data-ob-item_id */
      handle = await page.$(`[data-ob-item_id="${ad.id}"]`);

      /* 2️⃣  dynamic widgets: <a class="ob-dynamic-rec-link" …> */
      if (!handle) {
        handle = await page.$(
          `a.ob-dynamic-rec-link[data-rec-en-did="${ad.id}"]`
        );
      }
    }

    if (!handle) continue;     // node vanished – skip

    try {
      await handle.screenshot({
        path: `ss/${domain}_${ad.id.slice(0, 12)}.png`
      });
    } catch { /* detached during navigation – ignore */ }

    await handle.dispose();
  }

  await browser.close();
  // await xvfb.stopSync();
})();

