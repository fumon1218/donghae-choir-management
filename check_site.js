import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log('Navigating to site...');
  await page.goto('https://fumon1218.github.io/donghae-choir-management/', { waitUntil: 'networkidle0' });
  
  console.log('Done.');
  await browser.close();
})();
