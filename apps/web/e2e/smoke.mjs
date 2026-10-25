// End-to-end smoke test against a running server: `pnpm --filter web start` then `pnpm --filter web e2e`.
// Plays level 1 through the UI: discovery, building the board, wiring, settings, run, review.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exit(1);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${BASE}/levels/ask_before_draw`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

// 1. Discovery: ask the questions that reveal the hidden constraints.
for (const q of ['q_budget', 'q_noshow', 'q_data', 'q_team']) await page.click(`[data-testid=ask-${q}]`);
const hours = await page.textContent('[data-testid=hours-left]');
if (!hours?.startsWith('0,5')) fail(`expected 0,5 hours left, got ${hours}`);
await page.click('[data-testid=start-design]');

// 2. Design: add components, set them to Vietnam, wire them.
const add = async (type) => {
  await page.click(`[data-testid=palette-${type}]`);
  await page.waitForTimeout(100);
};
const region = async (id) => {
  await page.click(`.react-flow__node[data-id=${id}]`);
  await page.selectOption('[data-testid=region-select]', 'vn');
  await page.click('[data-testid=tab-components]');
};
for (const t of ['app_server', 'relational_db', 'queue', 'worker', 'sms_vn', 'monitoring']) await add(t);
for (const id of ['app_server_1', 'relational_db_1', 'queue_1', 'worker_1']) await region(id);
await page.click('button[title="Sắp xếp tự động"]');
await page.waitForTimeout(500);

const wire = async (from, to) => {
  const s = await page.locator(`.react-flow__node[data-id=${from}] .react-flow__handle-bottom`).boundingBox();
  const t = await page.locator(`.react-flow__node[data-id=${to}] .react-flow__handle-top`).boundingBox();
  if (!s || !t) fail(`missing handle ${from} -> ${to}`);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
};
await wire('users', 'app_server_1');
await wire('app_server_1', 'relational_db_1');
await wire('app_server_1', 'queue_1');
await page.click('button[title="Sắp xếp tự động"]');
await page.waitForTimeout(500);
await wire('queue_1', 'worker_1');
await page.click('button[title="Sắp xếp tự động"]');
await page.waitForTimeout(500);
await wire('worker_1', 'sms_vn_1');
const edges = await page.locator('.react-flow__edge').count();
if (edges !== 5) fail(`expected 5 wires, got ${edges}`);

// 3. Run and 4. review.
await page.click('[data-testid=run]');
await page.waitForSelector('[data-testid=review]', { timeout: 10000 });
const verdict = await page.textContent('[data-testid=verdict]');
if (!verdict?.includes('Đạt')) fail(`expected a pass, got "${verdict}"`);
if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('OK: level 1 played through the UI and passed.');
await browser.close();
