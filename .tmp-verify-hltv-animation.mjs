import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => {
  if (!error.message.includes('pointer lock')) errors.push(error.message);
});
await page.goto('http://127.0.0.1:43173', { waitUntil: 'domcontentloaded' });
await page.locator('input[type=file][accept=".dem"]').setInputFiles(
  '/Users/ldmnt/Code/hltv/demos/2004/home/infe/hlds/cstrike/caterchryinfe_3on3-0407281433-de_dust2.dem',
);
await page.getByText('HLTV', { exact: true }).waitFor({ timeout: 60_000 });
await page.locator('input[webkitdirectory]').setInputFiles('/Users/ldmnt/Code/hltv/app/game-assets');
const playerSelect = page.locator('.frag-filters select').nth(1);
const playerValue = await playerSelect.locator('option').evaluateAll((options) =>
  options.find((option) => option.textContent?.toLowerCase().includes('chrysofrejz'))?.getAttribute('value'));
if (!playerValue) throw new Error('crapoffline chrysofrejz saknas');
await playerSelect.selectOption(playerValue);
await page.getByRole('radio', { name: /Original/ }).click();
await page.getByRole('button', { name: /Endast frags/ }).click();
await page.getByText('Motor igång', { exact: true }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(7_000);
for (let frame = 0; frame < 3; frame += 1) {
  await page.screenshot({ path: `/private/tmp/hltv-restored-${frame}.png` });
  await page.waitForTimeout(500);
}
console.log(JSON.stringify({ errors, counter: await page.getByText(/ENDAST FRAGS/).first().textContent() }));
await browser.close();
