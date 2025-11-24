const nodemailer = require('nodemailer');

let transporter = null;
let transporterReady = false;

function buildTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function ensureTransporter() {
  if (!transporter) {
    transporter = buildTransporter();
    transporterReady = false;
  }
  if (!transporter) {
    return null;
  }
  if (!transporterReady) {
    try {
      await transporter.verify();
      transporterReady = true;
    } catch (error) {
      console.warn('Email transport verification failed; falling back to console logging:', error.message);
      transporter = null;
      transporterReady = false;
      return null;
    }
  }
  return transporter;
}

async function sendMail({ to, subject, text = '', html = '' }) {
  if (!to) {
    throw new Error('Recipient address is required to send email.');
  }

  const transport = await ensureTransporter();
  if (!transport) {
    console.log('[Email:stub]', { to, subject, preview: text || html });
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
  return transport.sendMail({ from, to, subject, text, html });
}

module.exports = {
  sendMail,
};
