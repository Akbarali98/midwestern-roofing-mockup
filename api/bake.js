// Sanity webhook endpoint — called automatically when content is published in Sanity.
// Fetches latest blog post images and updates the HTML files in GitHub.
// Set this as a Sanity webhook: POST https://midwestern-roofing.vercel.app/api/bake

const https = require('https');

const PROJECT_ID   = 'ot1ams1m';
const DATASET      = 'production';
const REPO         = 'Akbarali98/midwestern-roofing';
const GH_TOKEN     = process.env.GH_TOKEN;
const DEPLOY_HOOK  = 'https://api.vercel.com/v1/integrations/deploy/prj_YY7F6abEyoeV8FoSWlumd6fbMBae/xcy6u5F43f';

// ── helpers ──────────────────────────────────────────────────────────────────
function triggerDeploy() {
  return new Promise((resolve) => {
    const u = new URL(DEPLOY_HOOK);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'GET' }, res => {
      res.on('data', () => {});
      res.on('end', () => { console.log('Deploy hook fired:', res.statusCode); resolve(); });
    });
    req.on('error', e => { console.error('Deploy hook error:', e); resolve(); });
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'midwestern-bake/1.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${REPO}/contents/${path}`,
      method,
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'midwestern-bake/1.0',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getFileSha(path) {
  const res = await githubRequest('GET', path);
  return res.status === 200 ? res.body.sha : null;
}

async function pushFile(path, content, message) {
  const sha = await getFileSha(path);
  const encoded = Buffer.from(content).toString('base64');
  const body = { message, content: encoded };
  if (sha) body.sha = sha;
  const res = await githubRequest('PUT', path, body);
  console.log(`  ${res.status} -> ${path}`);
  return res.status;
}

// ── bake logic ────────────────────────────────────────────────────────────────
async function bake() {
  // 1. Fetch all blog images from Sanity
  const query = encodeURIComponent('*[_type=="blogPost"]{slug,heroImage{asset->{url}}}');
  const data  = await httpsGet(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${query}`);
  const imgs  = {};
  for (const p of data.result) {
    const slug = p.slug.current;
    const url  = p.heroImage?.asset?.url || null;
    imgs[slug] = url;
    console.log(`  ${slug}: ${url || '(none)'}`);
  }

  // 2. For each HTML file, fetch content, update src, push back
  const ARTICLES = [
    ['blog-roof-installation.html', 'roof-installation', ['after-storm','siding-gutters','ice-dams']],
    ['blog-after-storm.html',       'after-storm',       ['roof-installation','siding-gutters','ice-dams']],
    ['blog-siding-gutters.html',    'siding-gutters',    ['roof-installation','after-storm','ice-dams']],
    ['blog-ice-dams.html',          'ice-dams',          ['roof-installation','after-storm','siding-gutters']],
  ];

  const results = [];

  for (const [fname, slug, related] of ARTICLES) {
    const res = await githubRequest('GET', fname);
    if (res.status !== 200) continue;
    let html = Buffer.from(res.body.content, 'base64').toString('utf-8');
    let changed = false;

    if (imgs[slug]) {
      html = html.replace(
        /(<img id="article-hero-img" src=")[^"]*(")/,
        `$1${imgs[slug]}?w=1200&auto=format$2`
      );
    }
    for (const rslug of related) {
      if (imgs[rslug]) {
        html = html.replace(
          new RegExp(`(<img id="rel-img-${rslug}" src=")[^"]*(")`,'g'),
          `$1${imgs[rslug]}?w=800&auto=format$2`
        );
      }
    }
    await pushFile(fname, html, `[sanity-bake] Update images in ${fname}`);
    results.push(fname);
  }

  // 3. Service page images
  const serviceQuery = encodeURIComponent('*[_type=="servicePage"]{slug,heroImage{asset->{url}}}');
  const serviceData  = await httpsGet(`https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${serviceQuery}`);
  const SERVICE_FILES = {
    'gutters':             'service-gutters.html',
    'roof-installation':   'service-roof-installation.html',
    'roof-repairs':        'service-roof-repairs.html',
    'siding':              'service-siding.html',
    'storm-damage-repairs':'service-storm-damage.html',
    'home-renovations':    'service-home-renovations.html',
  };
  for (const p of (serviceData.result || [])) {
    const slug = p.slug?.current;
    const url  = p.heroImage?.asset?.url;
    const fname = SERVICE_FILES[slug];
    if (!slug || !url || !fname) continue;
    const res = await githubRequest('GET', fname);
    if (res.status !== 200) continue;
    let html = Buffer.from(res.body.content, 'base64').toString('utf-8');
    html = html.replace(
      new RegExp(`(<img id="service-hero-img-${slug}" src=")[^"]*("[^>]*)style="opacity:0;"`),
      `$1${url}?w=1400&auto=format$2style="opacity:1;"`
    );
    // fallback if opacity was already 1
    html = html.replace(
      new RegExp(`(<img id="service-hero-img-${slug}" src=")[^"]*(")`),
      `$1${url}?w=1400&auto=format$2`
    );
    await pushFile(fname, html, `[sanity-bake] Update service image in ${fname}`);
    results.push(fname);
  }

  // blog.html listing
  const blogRes = await githubRequest('GET', 'blog.html');
  if (blogRes.status === 200) {
    let html = Buffer.from(blogRes.body.content, 'base64').toString('utf-8');
    for (const [slug, url] of Object.entries(imgs)) {
      if (!url) continue;
      html = html.replace(
        new RegExp(`(<img id="blog-img-${slug}" src=")[^"]*(")`,'g'),
        `$1${url}?w=800&auto=format$2`
      );
    }
    await pushFile('blog.html', html, '[sanity-bake] Update blog listing images');
    results.push('blog.html');
  }

  // Trigger Vercel redeploy so changes go live immediately
  await triggerDeploy();

  return results;
}

// ── Vercel handler ────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!GH_TOKEN) {
    return res.status(500).json({ error: 'GH_TOKEN env var not set' });
  }
  try {
    console.log('Sanity webhook received — baking images...');
    const updated = await bake();
    return res.status(200).json({ ok: true, updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
