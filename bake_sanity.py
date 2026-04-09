#!/usr/bin/env python3
"""
Fetches current image URLs from Sanity and bakes them directly into the HTML files.
Run this script whenever Sanity content changes to keep the site in sync.
"""
import re, os, urllib.request, json, base64

PROJECT_ID = 'ot1ams1m'
DATASET = 'production'
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
if not GITHUB_TOKEN:
    raise RuntimeError('Set GITHUB_TOKEN env var before running: export GITHUB_TOKEN=your_token')
REPO = 'Akbarali98/midwestern-roofing-mockup'
BASE = os.path.dirname(os.path.abspath(__file__))

def sanity_fetch(query):
    url = f'https://{PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/{DATASET}?query={urllib.request.quote(query)}'
    return json.loads(urllib.request.urlopen(url).read())['result']

def push(path, content):
    encoded = base64.b64encode(content.encode()).decode()
    url = f'https://api.github.com/repos/{REPO}/contents/{path}'
    req = urllib.request.Request(url, headers={
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    })
    try:
        sha = json.loads(urllib.request.urlopen(req).read())['sha']
    except:
        sha = None
    body = {'message': f'[sanity-bake] Update images in {path}', 'content': encoded}
    if sha: body['sha'] = sha
    req2 = urllib.request.Request(url, data=json.dumps(body).encode(), method='PUT',
        headers={'Authorization': f'token {GITHUB_TOKEN}',
                 'Content-Type': 'application/json',
                 'Accept': 'application/vnd.github.v3+json'})
    status = urllib.request.urlopen(req2).status
    print(f'  {status} -> {path}')

# ── Fetch blog post images from Sanity ────────────────────────────────────────
print('Fetching blog post images from Sanity...')
posts = sanity_fetch('*[_type=="blogPost"]{slug,heroImage{asset->{url}}}')
BLOG_IMGS = {}
for p in posts:
    slug = p['slug']['current']
    url = p.get('heroImage') and p['heroImage'].get('asset') and p['heroImage']['asset'].get('url')
    BLOG_IMGS[slug] = url
    print(f'  {slug}: {url or "(no image)"}')

# ── Update article pages ──────────────────────────────────────────────────────
ARTICLES = [
    ('blog-roof-installation.html', 'roof-installation', ['after-storm','siding-gutters','ice-dams']),
    ('blog-after-storm.html',       'after-storm',       ['roof-installation','siding-gutters','ice-dams']),
    ('blog-siding-gutters.html',    'siding-gutters',    ['roof-installation','after-storm','ice-dams']),
    ('blog-ice-dams.html',          'ice-dams',          ['roof-installation','after-storm','siding-gutters']),
]

for fname, slug, related in ARTICLES:
    local = os.path.join(BASE, fname)
    with open(local, encoding='utf-8') as f:
        html = f.read()
    original = html

    # Update hero image if Sanity has one
    if BLOG_IMGS.get(slug):
        html = re.sub(
            r'(<img id="article-hero-img" src=")[^"]+(")',
            r'\g<1>' + BLOG_IMGS[slug] + r'\g<2>',
            html
        )

    # Update related card images
    for rslug in related:
        if BLOG_IMGS.get(rslug):
            html = re.sub(
                r'(<img id="rel-img-' + rslug + r'" src=")[^"]+(")',
                r'\g<1>' + BLOG_IMGS[rslug] + r'\g<2>',
                html
            )

    if html != original:
        with open(local, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'Updated {fname}')
        push(fname, html)
    else:
        print(f'No changes: {fname}')

# ── Update blog listing page ──────────────────────────────────────────────────
fname = 'blog.html'
local = os.path.join(BASE, fname)
with open(local, encoding='utf-8') as f:
    html = f.read()
original = html

for slug, img_url in BLOG_IMGS.items():
    if img_url:
        html = re.sub(
            r'(<img id="blog-img-' + slug + r'" src=")[^"]+(")',
            r'\g<1>' + img_url + r'\g<2>',
            html
        )

if html != original:
    with open(local, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Updated {fname}')
    push(fname, html)
else:
    print(f'No changes: {fname}')

print('\nDone.')
