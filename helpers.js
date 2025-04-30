/* smooth scroll to bottom to trigger lazy widgets */
async function autoScroll(page) {
    await page.evaluate(async () => {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      for (let y = 0; y < document.body.scrollHeight; y += 1200) {
        window.scrollTo(0, y);
        await delay(350);
      }
    });
  }
  
  /* master grabber – merges Taboola + Outbrain */
  async function grabAds(page) {
    const taboola = 
        await page.$$eval('[data-item-id]', cards =>
        cards.map(card => {
            const anchors = [...card.querySelectorAll('a')].filter(a => a.href);
            const getLabel = () => {
            const n = card.querySelector('.branding-inner, [slot="branding"]');
            if (!n) return null;
            const raw = n.textContent.trim() || n.getAttribute('aria-label') || '';
            return raw.replace(/\s+in Taboola advertising section$/i, '').trim();
            };
            const parseBg = bg => (bg.match(/url\(["']?(.*?)["']?\)/)||[])[1]||null;
            const imgEl = card.querySelector('.thumbBlock, img');
    
            return {
            network   : 'taboola',
            id        : card.dataset.itemId,
            title     : card.dataset.itemTitle ||
                        card.querySelector('[slot="title"], .video-label')?.innerText.trim() || null,
            label     : getLabel(),
            thumb     : card.dataset.itemThumb || null,
            heroImage : imgEl ? (imgEl.src || parseBg(getComputedStyle(imgEl).backgroundImage)) : null,
            tracker   : anchors[0]?.href || null,
            landing   : anchors.find(a => !/trc\.taboola\.com/.test(a.href))?.href || null,
            sponsored : card.dataset.itemSyndicated === 'true'
            };
        })
        );
  
    /* ─────────────────────────────────────────────
 *  OUTBRAIN – old widgets  +  dynamic widgets
 * ────────────────────────────────────────────*/
    const outbrain = [

        /* 1 ▸ legacy widgets that carry data-ob-item_id */
        ...await page.$$eval('[data-ob-item_id]', cards => {
        const pick = (sel, el = document) =>
            (el.querySelector(sel)?.textContent || '').trim() || null;
    
        return cards.map(card => {
            const id   = card.getAttribute('data-ob-item_id');
            const img  = card.querySelector('img, .ob-rec-image')?.src || null;
            const aTag = card.querySelector('a[href]');
            return {
            network   : 'outbrain',
            id,
            title     : card.getAttribute('data-ob-title') || pick('.ob-rec-text', card),
            label     : pick('.ob-rec-source', card) || card.getAttribute('data-ct-source'),
            thumb     : img,
            heroImage : img,
            tracker   : aTag?.href || null,
            landing   : aTag?.href || null,
            sponsored : true
            };
        });
        }),
    
        /* 2 ▸ “dynamic” widgets (your snippet) */
        ...await page.$$eval('a.ob-dynamic-rec-link[data-rec-en-did]', links => {
        const uniq = new Map();           // de-dupe by rec-id
    
        links.forEach(a => {
            const card   = a.closest('.ob-dynamic-rec-container') || a;
            const id     = a.getAttribute('data-rec-en-did');   // unique per creative
            const title  = card.querySelector('.ob-rec-text')?.textContent.trim() || null;
            const label  = card.querySelector('.ob-rec-source')?.textContent.trim() || null;
            const img    = card.querySelector('img')?.src || null;
    
            uniq.set(id, {
            network   : 'outbrain',
            id,
            title,
            label,
            thumb     : img,
            heroImage : img,
            tracker   : a.href,           // Outbrain redirect
            landing   : a.href,           // can resolve later if you need final URL
            sponsored : true
            });
        });
        return [...uniq.values()];
        })
    ];
  
    return [...taboola, ...outbrain];
}

module.exports = { autoScroll, grabAds };