// Drive a real browser through the key screens and capture what actually renders.
// Uses the Chrome DevTools Protocol over a headless instance (no Playwright available).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const OUT = 'E:\\Data\\CacheData\\shots';
const BASE = 'http://127.0.0.1:3000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(pathname) {
  const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`);
  return res.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.logs = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        this.logs.push({ type: msg.params.type, text });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.logs.push({ type: 'exception', text: d.exception?.description || d.text });
      }
      if (msg.method === 'Log.entryAdded') {
        const e = msg.params.entry;
        this.logs.push({ type: e.level, text: e.text });
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result.value;
  }

  async screenshot(name) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(res.data, 'base64'));
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + path.join(process.env.TEMP, 'cdp-profile'),
    '--window-size=1280,900',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    // Wait for the debugging endpoint.
    let target = null;
    for (let i = 0; i < 60; i += 1) {
      try {
        const list = await getJson('/json/list');
        target = list.find((t) => t.type === 'page');
        if (target) break;
      } catch { /* not ready */ }
      await sleep(500);
    }
    if (!target) throw new Error('CDP endpoint never came up');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    const cdp = new Cdp(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');

    const results = [];
    const check = (name, ok, detail) => {
      results.push({ name, ok });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
    };

    async function goto(url) {
      await cdp.send('Page.navigate', { url });
      await sleep(2500);
    }

    // ---- Home ----
    await goto(BASE + '/');
    const heroKicker = await cdp.evaluate("document.querySelector('.hero-kicker')?.textContent || ''");
    check('home kicker is niji', heroKicker.includes('NIJISANJI'), heroKicker);
    check('home has no CS MAJOR text', !(await cdp.evaluate("document.body.innerText.includes('CS MAJOR')")));

    // ---- Game rules dialog (all three locales) ----
    for (const lang of ['zh', 'en', 'ja']) {
      await goto(BASE + '/');
      await cdp.evaluate(`localStorage.setItem('i18nextLng', ${JSON.stringify(lang)})`);
      await goto(BASE + '/');
      await cdp.evaluate(`
        (() => {
          const btns = [...document.querySelectorAll('button')];
          const b = btns.find(x => /规则|Rules|ルール/.test(x.textContent || ''));
          if (b) b.click();
          return Boolean(b);
        })()
      `);
      await sleep(1200);
      const body = await cdp.evaluate('document.body.innerText');
      // i18next renders the raw key when a translation is missing.
      const rawKeys = await cdp.evaluate(`
        (function(){
          const bad = new Set();
          document.querySelectorAll('body *').forEach(el => {
            if (el.children.length === 0) {
              const t = (el.textContent || '').trim();
              if (/^(rules|game|player|guess|admin|search|home|common)\\.[a-zA-Z.]+$/.test(t)) bad.add(t);
            }
          });
          return [...bad];
        })()
      `);
      check(`rules dialog renders in ${lang}`, body.length > 200, `len=${body.length}`);
      check(`${lang} rules has no raw i18n keys`, rawKeys.length === 0, rawKeys.join(',') || 'none');
      check(`${lang} rules mentions niji fields`,
        /性别|Gender|性別/.test(body) && /种族|Race|種族/.test(body));
      await cdp.screenshot(`rules-${lang}`);
    }

    // ---- Search a real player ----
    await goto(BASE + '/');
    await cdp.evaluate("localStorage.setItem('i18nextLng','zh')");
    await goto(BASE + '/search');
    // The app's axios client solves PoW automatically and caches the player list
    // in localStorage, so read the nickname from that cache after the page loads.
    const resolvedNickname = await cdp.evaluate(`
      (async () => {
        for (let i = 0; i < 40; i += 1) {
          const raw = localStorage.getItem('player-list-v1');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.players?.length) return parsed.players[0].nickname;
            } catch {}
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        return null;
      })()
    `);
    if (!resolvedNickname) throw new Error('player list never populated in localStorage');
    const nickname = resolvedNickname;
    await cdp.evaluate(`
      (() => {
        const input = document.querySelector('input');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(nickname)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    await sleep(800);
    await cdp.evaluate(`
      (() => {
        const b = [...document.querySelectorAll('button')].find(x => /查询|Search/.test(x.textContent||''));
        if (b) b.click();
        return Boolean(b);
      })()
    `);
    await sleep(2500);
    const tableText = await cdp.evaluate("document.querySelector('.player-info-table')?.innerText || ''");
    check('search renders player info table', tableText.length > 0, tableText.replace(/\\s+/g, ' ').slice(0, 120));
    const rows = await cdp.evaluate("document.querySelectorAll('.player-info-table tr').length");
    check('player table has 7 rows', rows === 7, `rows=${rows}`);
    check('player table has niji fields',
      /性别/.test(tableText) && /出道日/.test(tableText) && /身高/.test(tableText) &&
      /年龄/.test(tableText) && /关系/.test(tableText) && /种族/.test(tableText));
    await cdp.screenshot('search-result');

    // ---- Solo game ----
    await goto(BASE + '/single/normal');
    await sleep(2000);
    const gameBody = await cdp.evaluate('document.body.innerText');
    check('solo page loads', gameBody.length > 100, `len=${gameBody.length}`);
    const columnText = await cdp.evaluate(
      "document.querySelector('.guess-board, .guess-header, table')?.innerText || document.body.innerText.slice(0,400)"
    );
    check('solo board mentions niji columns',
      /性别|出道日|身高|年龄|关系|种族/.test(columnText), columnText.replace(/\\s+/g,' ').slice(0, 120));
    await cdp.screenshot('solo');

    // ---- Daily ----
    await goto(BASE + '/daily');
    await sleep(3000);
    const dailyResolved = await cdp.evaluate(`
      (async () => {
        for (let i = 0; i < 40; i += 1) {
          const t = document.body.innerText;
          if (!/正在加载|Loading|読み込み/.test(t)) return true;
          await new Promise((r) => setTimeout(r, 250));
        }
        return false;
      })()
    `);
    check('daily status resolved', dailyResolved);
    const dailyBody = await cdp.evaluate('document.body.innerText');
    check('daily page loads', /进入挑战|Enter challenge|チャレンジへ/.test(dailyBody), `len=${dailyBody.length}`);
    check('daily shows the resolved status', !/正在加载|Loading|読み込み/.test(dailyBody));
    check('daily shows a single tier', !/简单版|完整版.*简单|Easy ·|Beginner/.test(dailyBody));
    check('daily title no longer asks to pick a difficulty',
      !/选择每日挑战难度|Choose a daily difficulty|デイリー難易度を選択/.test(dailyBody),
      dailyBody.split('\n').slice(0, 3).join(' / '));
    await cdp.screenshot('daily-live');

    // ---- Leaderboard ----
    await goto(BASE + '/leaderboard');
    await sleep(2000);
    const lbBody = await cdp.evaluate('document.body.innerText');
    check('leaderboard loads', lbBody.length > 50, `len=${lbBody.length}`);
    await cdp.screenshot('leaderboard-live');

    // ---- Error scan ----
    // Ignore browser-level noise unrelated to the app (missing Chrome extensions etc).
    const errors = cdp.logs.filter(
      (l) => (l.type === 'error' || l.type === 'exception') &&
        !/extension|\.crx|favicon/i.test(l.text) &&
        !/status of 404/i.test(l.text)
    );
    check('no console errors during run', errors.length === 0, errors.slice(0, 3).map((e) => e.text.slice(0, 120)).join(' | ') || 'none');

    console.log('\n--- SUMMARY ---');
    const failed = results.filter((r) => !r.ok);
    console.log(`${results.length - failed.length}/${results.length} passed`);
    if (failed.length) { console.log('FAILED:'); failed.forEach((r) => console.log('  - ' + r.name)); }

    ws.close();
    process.exit(failed.length ? 1 : 0);
  } finally {
    chrome.kill();
  }
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
