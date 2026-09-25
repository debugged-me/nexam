import fs from 'fs';
import puppeteer from 'puppeteer';

function installedChromePath() {
  const candidates = [
    process.env.CHROME_EXECUTABLE,
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null,
    process.platform === 'darwin' ? '/Applications/Chromium.app/Contents/MacOS/Chromium' : null,
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : null,
    process.platform === 'linux' ? '/usr/bin/google-chrome' : null,
    process.platform === 'linux' ? '/usr/bin/chromium' : null,
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

/** Launch Puppeteer's bundled browser, or a known installed Chrome fallback. */
export function launchBrowser() {
  const executablePath = installedChromePath();
  return puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export default { launchBrowser };
