// Contact form handler — sends email via Resend API
// Requires RESEND_API_KEY env var in Vercel project settings

const https = require('https');

const TO_EMAIL   = 'akkiiali98@gmail.com'; // TODO: change to support@midwestern.construction after domain verified
const FROM_EMAIL = 'onboarding@resend.dev';
const RESEND_KEY = process.env.RESEND_API_KEY;

function resendSend(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const { name, phone, email, service, message } = req.body || {};

  if (!name || !phone || !email || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const html = `
    <h2 style="color:#E85D04;font-family:sans-serif;">New Contact Form Submission</h2>
    <table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;width:100%;max-width:500px;">
      <tr><td style="padding:10px 0;color:#6B7280;width:140px;">Name</td><td style="padding:10px 0;font-weight:700;">${name}</td></tr>
      <tr><td style="padding:10px 0;color:#6B7280;">Phone</td><td style="padding:10px 0;font-weight:700;"><a href="tel:${phone}" style="color:#E85D04;">${phone}</a></td></tr>
      <tr><td style="padding:10px 0;color:#6B7280;">Email</td><td style="padding:10px 0;font-weight:700;"><a href="mailto:${email}" style="color:#E85D04;">${email}</a></td></tr>
      <tr><td style="padding:10px 0;color:#6B7280;">Service</td><td style="padding:10px 0;font-weight:700;">${service}</td></tr>
      <tr><td style="padding:10px 0;color:#6B7280;vertical-align:top;">Message</td><td style="padding:10px 0;">${message || '(none)'}</td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:13px;color:#9CA3AF;margin-top:32px;">Sent from midwestern-roofing-mockup.vercel.app</p>
  `;

  try {
    const result = await resendSend({
      from: `MidWestern Construction <${FROM_EMAIL}>`,
      to: [TO_EMAIL],
      reply_to: email,
      subject: `New Inquiry from ${name} — ${service}`,
      html,
    });

    if (result.status === 200 || result.status === 201) {
      return res.status(200).json({ ok: true });
    } else {
      console.error('Resend error:', result.body);
      return res.status(500).json({ error: 'Email failed to send' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
