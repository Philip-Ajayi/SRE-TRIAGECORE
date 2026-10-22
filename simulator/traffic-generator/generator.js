import axios from 'axios';

const TARGET_URL = process.env.TARGET_URL || 'http://auth-service:4000/login';
const INTERVAL_MS = parseInt(process.env.REQUEST_INTERVAL_MS || '150', 10);

console.log(`[traffic-generator] Sending synthetic requests to ${TARGET_URL} every ${INTERVAL_MS}ms`);

let okCount = 0;
let errorCount = 0;

setInterval(async () => {
  try {
    const res = await axios.post(TARGET_URL, { user: 'load-test-agent' }, { timeout: 1200 });
    if (res.status === 200) okCount++;
  } catch (err) {
    errorCount++;
  }
}, INTERVAL_MS);

setInterval(() => {
  const total = okCount + errorCount;
  const errorPct = total > 0 ? ((errorCount / total) * 100).toFixed(1) : '0.0';
  console.log(`[traffic-generator stats] Past 10s: Total=${total} | OK=${okCount} | 5xx=${errorCount} | ErrorRate=${errorPct}%`);
  okCount = 0;
  errorCount = 0;
}, 10000);
