import { chromium } from 'playwright';
import { validateUrl } from './browser/security.js';
import { readResource } from './browser/transport.js';

/** Public-page browser tool executed within the agent's Substrate sandbox. */
export async function readPublicPage(url: string) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const controller = new AbortController();
  const deadline = setTimeout(() => { controller.abort(); void browser?.close(); }, 40_000);
  let mainError: string | undefined;
  try {
    await validateUrl(url);
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage'],
      executablePath: process.env.CHROMIUM_PATH,
    });
    controller.signal.throwIfAborted();
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: 'block',
      acceptDownloads: false,
      viewport: { width: 1200, height: 800 },
    });
    let count = 0;
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (
        ++count > 50 ||
        request.method() !== 'GET' ||
        !['document', 'stylesheet', 'image', 'font'].includes(
          request.resourceType(),
        )
      ) {
        await route.abort();
        return;
      }
      try {
        await route.fulfill(
          await readResource(request.url(), controller.signal),
        );
      } catch (error) {
        if (request.isNavigationRequest())
          mainError =
            error instanceof Error ? error.message : 'Navigation failed.';
        await route.abort();
      }
    });
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25_000,
    });
    if (mainError) throw new Error(mainError);
    if (!response || response.status() >= 400)
      throw new Error(
        `Source returned HTTP ${response?.status() ?? 'unknown'}.`,
      );
    await validateUrl(page.url());
    const text = (
      await page.locator('body').innerText({ timeout: 5000 })
    ).slice(0, 30_000);
    const title = await page.title();
    const screenshot = (
      await page.screenshot({ type: 'jpeg', quality: 60, timeout: 5000 })
    ).toString('base64');
    return {
      url: page.url(),
      title,
      text,
      screenshot: `data:image/jpeg;base64,${screenshot}`,
    };
  } finally {
    clearTimeout(deadline);
    await browser?.close();
  }
}
