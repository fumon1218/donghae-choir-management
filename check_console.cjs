const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    });
    page.on('pageerror', error => {
        console.error(`[Browser Page Error]:`, error.message);
    });

    console.log('Navigating to http://localhost:3000/donghae-choir-management/');
    // increase timeout to allow app to load
    await page.goto('http://localhost:3000/donghae-choir-management/', { waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log(e.message));

    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
})();
