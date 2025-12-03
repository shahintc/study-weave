const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const defaultFrom = process.env.EMAIL_FROM || smtpUser || '';

let transporter = null;

const isEmailConfigured = () =>
  Boolean(smtpHost && defaultFrom && (smtpUser || !smtpPass));

if (isEmailConfigured()) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser
      ? {
          user: smtpUser,
          pass: smtpPass,
        }
      : undefined,
  });
} else {
  console.warn(
    'Email not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM to enable verification emails.',
  );
}

async function sendEmail({ to, subject, text }) {
  if (!transporter) {
    throw new Error('Email service is not configured on the server.');
  }

  return transporter.sendMail({
    from: defaultFrom,
    to,
    subject,
    text,
  });
}

module.exports = {
  sendEmail,
  isEmailConfigured,
};
