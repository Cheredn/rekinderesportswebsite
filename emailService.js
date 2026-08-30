import nodemailer from 'nodemailer';
import dns from 'node:dns';

// Force Node.js to prioritize IPv4 to avoid ENETUNREACH in cloud environments (Render, etc.)
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (e) {
  // Ignore if not supported
}

// Explicit IPv4 DNS lookup function for nodemailer/tls/net
const ipv4Lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { family: 4 }, (err, address, family) => {
    if (err) {
      // Fallback
      return dns.lookup(hostname, callback);
    }
    callback(null, address, family || 4);
  });
};

export const sentEmailsHistory = [];

let testAccountTransporter = null;
let isInitializingTestAccount = false;

// Pre-warm test account on startup in the background if no real credentials
async function initTestAccount() {
  if (testAccountTransporter || isInitializingTestAccount) return;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (user && pass) return; // Real SMTP used

  isInitializingTestAccount = true;
  try {
    const testAccount = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Ethereal setup timeout')), 6000))
    ]);
    testAccountTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log(`[Email Service] Pre-warmed ethereal test mailbox: ${testAccount.user}`);
  } catch (e) {
    console.warn('[Email Service] Background test account init info:', e.message);
  } finally {
    isInitializingTestAccount = false;
  }
}

// Start pre-warm asynchronously without blocking startup
initTestAccount().catch(() => {});

let realTransporter = null;

/**
 * Creates and returns a nodemailer transporter based on environment variables or test account
 */
async function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // If real credentials provided, use cached or create real SMTP transporter
  if (user && pass) {
    if (realTransporter) {
      return {
        transporter: realTransporter,
        isTest: false,
        from: process.env.SMTP_FROM || `"Rekinder eSports" <${user}>`
      };
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'false' ? false : (port === 465);

    const transportOptions = {
      host,
      port,
      secure,
      auth: { user, pass },
      family: 4, // Force IPv4 to prevent ENETUNREACH on IPv6 cloud environments
      lookup: ipv4Lookup,
      tls: {
        rejectUnauthorized: false,
        servername: host
      },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 15000
    };

    realTransporter = nodemailer.createTransport(transportOptions);

    return {
      transporter: realTransporter,
      isTest: false,
      from: process.env.SMTP_FROM || `"Rekinder eSports" <${user}>`
    };
  }

  // If test transporter is ready, use it
  if (testAccountTransporter) {
    return {
      transporter: testAccountTransporter,
      isTest: true,
      from: '"Rekinder eSports" <noreply@rekinder-esports.com>'
    };
  }

  // Fallback: Create test ethereal transporter with 5s hard timeout
  try {
    const testAccount = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Ethereal test mailbox timeout')), 5000))
    ]);
    testAccountTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
    console.log(`[Email Service] Created ethereal test mailbox: ${testAccount.user}`);
    return {
      transporter: testAccountTransporter,
      isTest: true,
      from: '"Rekinder eSports" <noreply@rekinder-esports.com>'
    };
  } catch (e) {
    console.warn('[Email Service] Test account unavailable:', e.message);
    return null;
  }
}

/**
 * Generate stylized HTML email wrapper with Rekinder eSports theme
 */
function generateEmailTemplate({ title, badge, badgeColor, content, booking }) {
  const teamTitle = booking.team === 'junior' ? 'Rekinder eSports Junior' : 'Rekinder eSports (Main)';
  
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background-color: #07080b; font-family: 'Montserrat', Arial, sans-serif; color: #e5e7eb; }
    .email-container { max-width: 600px; margin: 20px auto; background: #0d0f14; border: 1px solid #222630; border-radius: 6px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
    .email-header { background: linear-gradient(135deg, #11141c 0%, #08090d 100%); padding: 30px 24px; border-bottom: 2px solid #ffbb00; text-align: center; }
    .email-logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; margin: 0; }
    .email-logo span { color: #ffbb00; }
    .email-badge { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 3px; margin-top: 10px; background: ${badgeColor || '#ffbb00'}; color: #000000; }
    .email-body { padding: 30px 24px; }
    .email-title { font-size: 19px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
    .email-text { font-size: 14px; line-height: 1.6; color: #9ca3af; margin-bottom: 20px; }
    .booking-card { background: #07080b; border: 1px solid #1f2430; border-radius: 4px; padding: 18px; margin-bottom: 24px; }
    .booking-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #141720; font-size: 13px; }
    .booking-row:last-child { border-bottom: none; }
    .b-label { color: #6b7280; }
    .b-value { color: #ffffff; font-weight: 700; text-align: right; }
    .email-footer { background: #07080b; padding: 20px 24px; text-align: center; border-top: 1px solid #191c24; font-size: 12px; color: #6b7280; }
    .email-footer a { color: #ffbb00; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 class="email-logo">REKINDER <span>eSPORTS</span></h1>
      <div class="email-badge">${badge}</div>
    </div>
    <div class="email-body">
      <h2 class="email-title">${title}</h2>
      <p class="email-text">${content}</p>
      
      <div class="booking-card">
        <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #181c26;">
            <td style="color: #6b7280;">Код заявки:</td>
            <td align="right" style="color: #ffbb00; font-weight: bold; font-family: monospace;">#${booking.id}</td>
          </tr>
          <tr style="border-bottom: 1px solid #181c26;">
            <td style="color: #6b7280;">Состав Rekinder:</td>
            <td align="right" style="color: #ffffff; font-weight: bold;">${teamTitle}</td>
          </tr>
          <tr style="border-bottom: 1px solid #181c26;">
            <td style="color: #6b7280;">Ваша команда:</td>
            <td align="right" style="color: #ffffff; font-weight: bold;">${booking.opponentTeam}</td>
          </tr>
          <tr style="border-bottom: 1px solid #181c26;">
            <td style="color: #6b7280;">Дата и Время:</td>
            <td align="right" style="color: #ffffff; font-weight: bold;">${booking.date} в ${booking.time} (МСК)</td>
          </tr>
          <tr style="border-bottom: 1px solid #181c26;">
            <td style="color: #6b7280;">Формат:</td>
            <td align="right" style="color: #ffffff; font-weight: bold;">${booking.format || 'BO3'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #181c26;">
            <td style="color: #6b7280;">Контакт в Telegram:</td>
            <td align="right" style="color: #ffffff; font-weight: bold;">${booking.contact}</td>
          </tr>
          <tr>
            <td style="color: #6b7280;">Текущий статус:</td>
            <td align="right" style="color: ${booking.status === 'confirmed' ? '#22c55e' : (booking.status === 'declined' ? '#ef4444' : '#eab308')}; font-weight: 800;">
              ${booking.status === 'confirmed' ? 'ПОДТВЕРЖДЕН' : (booking.status === 'declined' ? 'ОТКЛОНЕН' : 'НА РАССМОТРЕНИИ')}
            </td>
          </tr>
        </table>
      </div>
      
      <p class="email-text" style="margin-bottom: 0;">
        При возникновении вопросов вы всегда можете связаться с нашим менеджментом через Telegram: 
        <a href="https://t.me/rekinder_manager" style="color:#ffbb00; text-decoration:none; font-weight:bold;">@rekinder_manager</a>.
      </p>
    </div>
    <div class="email-footer">
      © ${new Date().getFullYear()} Rekinder eSports Organization. Все права защищены.<br>
      Официальный сайт: <a href="https://rekinder-esports.com">rekinder-esports.com</a>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Helper to send email via modern HTTP REST APIs (Resend, Brevo) over port 443 (never blocked by Render)
 */
async function sendViaHttpApi({ to, subject, html }) {
  // 1. Resend API (Free 3,000 emails/month, 100% inbox delivery)
  if (process.env.RESEND_API_KEY) {
    const from = process.env.RESEND_FROM || process.env.SMTP_FROM || 'Rekinder eSports <onboarding@resend.dev>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resend API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return { id: data.id, provider: 'Resend' };
  }

  // 2. Brevo API (Free 300 emails/day, can send from any registered email like rekinderesportsteam@gmail.com)
  if (process.env.BREVO_API_KEY) {
    const senderEmail = process.env.BREVO_SENDER || process.env.SMTP_USER || 'rekinderesportsteam@gmail.com';
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Rekinder eSports', email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Brevo API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return { id: data.messageId, provider: 'Brevo' };
  }

  return null;
}

/**
 * Helper to reliably send mail with automatic IPv4 and port fallback
 */
async function sendMailSafely(mailConfig, mailOptions) {
  // First check if an HTTP API is configured (Bypasses all cloud port restrictions)
  try {
    const httpResult = await sendViaHttpApi(mailOptions);
    if (httpResult) {
      return { info: { messageId: httpResult.id }, isTest: false, provider: httpResult.provider };
    }
  } catch (httpErr) {
    console.error(`[Email Service] HTTP API send failed: ${httpErr.message}. Attempting SMTP fallback...`);
  }

  const { transporter, isTest, from } = mailConfig;
  const fullOptions = { from, ...mailOptions };

  try {
    const info = await transporter.sendMail(fullOptions);
    return { info, isTest, provider: 'SMTP' };
  } catch (primaryErr) {
    if (!isTest && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.warn(`[Email Service] Primary SMTP send failed (${primaryErr.message}). Retrying via Gmail port 587 STARTTLS (IPv4)...`);
      try {
        const fallbackTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          family: 4,
          lookup: ipv4Lookup,
          tls: {
            rejectUnauthorized: false,
            servername: 'smtp.gmail.com'
          },
          connectionTimeout: 12000,
          greetingTimeout: 12000,
          socketTimeout: 15000
        });
        const info = await fallbackTransporter.sendMail(fullOptions);
        realTransporter = fallbackTransporter;
        return { info, isTest: false, provider: 'SMTP-Port587' };
      } catch (fallbackErr) {
        console.error(`[Email Service] Port 587 fallback also failed: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }
    throw primaryErr;
  }
}

/**
 * Send email when booking is created
 */
export async function sendBookingReceivedEmail(booking) {
  if (!booking.email) return false;

  const mailConfig = await getTransporter();
  if (!mailConfig) {
    console.log(`[Email Service] Mail service unavailable. Skipped sending creation email to ${booking.email}`);
    return false;
  }

  const subject = `⚡ Заявка на пракк #${booking.id} принята в обработку — Rekinder eSports`;
  const html = generateEmailTemplate({
    title: `Заявка на пракк #${booking.id} принята!`,
    badge: 'ЗАЯВКА В ОБРАБОТКЕ',
    badgeColor: '#eab308',
    content: `Здравствуйте! Ваша заявка на проведение тренировочного матча (пракка) с <strong>${booking.opponentTeam}</strong> успешно получена и передана руководству команды <strong>Rekinder eSports</strong>. Мы рассмотрим её в ближайшее время и уведомим вас о решении.`,
    booking
  });

  try {
    const { info, isTest } = await sendMailSafely(mailConfig, {
      to: booking.email,
      subject,
      html
    });

    const previewUrl = isTest ? nodemailer.getTestMessageUrl(info) : null;
    
    const emailRecord = {
      id: `EML-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: booking.id,
      to: booking.email,
      subject,
      html,
      isTest,
      previewUrl,
      type: 'received',
      sentAt: new Date().toISOString()
    };
    sentEmailsHistory.unshift(emailRecord);
    if (sentEmailsHistory.length > 50) sentEmailsHistory.pop();

    console.log(`[Email Service] Booking received email sent to ${booking.email}`);
    if (previewUrl) {
      console.log(`[Email Service] 🔗 Ethereal Live Preview URL: ${previewUrl}`);
    }
    return emailRecord;
  } catch (err) {
    console.error(`[Email Service] Failed to send creation email to ${booking.email}:`, err.message);
    return false;
  }
}

/**
 * Send email when booking is confirmed or declined
 */
export async function sendBookingStatusUpdateEmail(booking) {
  if (!booking.email) return false;

  const isConfirmed = booking.status === 'confirmed';
  const isDeclined = booking.status === 'declined';

  if (!isConfirmed && !isDeclined) return false;

  const mailConfig = await getTransporter();
  if (!mailConfig) {
    console.log(`[Email Service] Mail service unavailable. Skipped sending status email to ${booking.email}`);
    return false;
  }

  const title = isConfirmed 
    ? `Пракк #${booking.id} подтвержден! ✅` 
    : `Заявка #${booking.id} отклонена ❌`;

  const badge = isConfirmed ? 'ПРАКК ПОДТВЕРЖДЕН' : 'ЗАЯВКА ОТКЛОНЕНА';
  const badgeColor = isConfirmed ? '#22c55e' : '#ef4444';

  const content = isConfirmed
    ? `Отличные новости! Руководство команды <strong>Rekinder eSports</strong> подтвердило пракк против вашей команды <strong>${booking.opponentTeam}</strong> на <strong>${booking.date} в ${booking.time} (МСК)</strong>. Наш менеджер свяжется с вами в Telegram для предоставления сервера/GOTV.`
    : `К сожалению, наш состав не сможет сыграть пракк в указанное время (<strong>${booking.date} в ${booking.time} МСК</strong>) из-за плотного графика официальных матчей или занятости состава. Вы можете оставить заявку на другую дату на нашем сайте.`;

  const html = generateEmailTemplate({
    title,
    badge,
    badgeColor,
    content,
    booking
  });

  const subject = isConfirmed 
    ? `✅ Пракк #${booking.id} ПОДТВЕРЖДЕН — Rekinder eSports vs ${booking.opponentTeam}`
    : `❌ Обновление статуса по заявке #${booking.id} — Rekinder eSports`;

  try {
    const { info, isTest } = await sendMailSafely(mailConfig, {
      to: booking.email,
      subject,
      html
    });

    const previewUrl = isTest ? nodemailer.getTestMessageUrl(info) : null;

    const emailRecord = {
      id: `EML-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bookingId: booking.id,
      to: booking.email,
      subject,
      html,
      isTest,
      previewUrl,
      type: booking.status,
      sentAt: new Date().toISOString()
    };
    sentEmailsHistory.unshift(emailRecord);
    if (sentEmailsHistory.length > 50) sentEmailsHistory.pop();

    console.log(`[Email Service] Status update email sent to ${booking.email}`);
    if (previewUrl) {
      console.log(`[Email Service] 🔗 Ethereal Live Preview URL: ${previewUrl}`);
    }
    return emailRecord;
  } catch (err) {
    console.error(`[Email Service] Failed to send status update email to ${booking.email}:`, err.message);
    return false;
  }
}
