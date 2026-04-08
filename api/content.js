// api/content.js — Vercel Serverless Function
// Returns site settings and home page content from Sanity.
// Dataset is public — no token required.

const PROJECT_ID  = 'ot1ams1m';
const DATASET     = 'production';
const API_VERSION = '2021-10-21';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const query = `{
    "settings": *[_type == "siteSettings"][0] {
      companyName, phone, email, address,
      "logoUrl": logo.asset->url
    },
    "home": *[_type == "homePage"][0] {
      heroEyebrow, heroHeadline, heroHeadlineAccent, heroSubheadline,
      "heroImageUrl": heroImage.asset->url,
      heroTrustItems,
      whyEyebrow, whyHeadlinePre, whyHeadlineAccent, whyHeadlinePost,
      whyBody1, whyBody2, whyStatNumber, whyStatLabel,
      "whyImageUrl": whyImage.asset->url,
      values[] { icon, title, description },
      services[] { number, title, description },
      processSteps[] { title, description },
      faqs[] { question, answer },
      serviceAreas
    }
  }`;

  const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sanity error: ${response.status}`);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data.result || {});
  } catch (err) {
    console.error('Content API error:', err.message);
    return res.status(500).json({ error: 'Failed to load content' });
  }
};
