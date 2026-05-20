import nodemailer from "nodemailer";

type MailTransporter = ReturnType<typeof nodemailer.createTransport>;

export interface SendEmailOptions {
  /** Intended recipient (e.g. user email). Delivered to MAIL_TO when set. */
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function normalizeAppPassword(pass: string): string {
  return pass.replace(/\s+/g, "");
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS
    ? normalizeAppPassword(process.env.SMTP_PASS)
    : undefined;
  const from = (process.env.SMTP_FROM || user)?.trim();
  const mailTo = process.env.MAIL_TO?.trim();

  if (!user || !pass) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from: from || user,
    mailTo: mailTo || null,
  };
}

/** Where all outbound mail is delivered (MAIL_TO overrides per-message `to`). */
export function getMailTo(): string | null {
  return getSmtpConfig()?.mailTo ?? null;
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

let transporter: MailTransporter | null = null;

function getTransporter(): MailTransporter {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error(
      "Email not configured. Set SMTP_USER and SMTP_PASS (Gmail app password) in .env"
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });
  }

  return transporter;
}

function resolveDeliveryAddress(intendedTo: string): {
  to: string;
  intendedTo: string;
  routedViaMailTo: boolean;
} {
  const cfg = getSmtpConfig();
  const mailTo = cfg?.mailTo;
  if (mailTo) {
    return { to: mailTo, intendedTo, routedViaMailTo: true };
  }
  return { to: intendedTo, intendedTo, routedViaMailTo: false };
}

function wrapRoutedBody(
  intendedTo: string,
  subject: string,
  text: string,
  html?: string
): { subject: string; text: string; html: string } {
  const banner = `[MTK Finance — routed to MAIL_TO]\nOriginally for: ${intendedTo}\nSubject: ${subject}\n\n`;
  return {
    subject: `[MTK Finance] ${subject}`,
    text: banner + text,
    html:
      `<p style="color:#666;font-size:12px">Originally for: <strong>${intendedTo}</strong></p>` +
      (html ?? text.replace(/\n/g, "<br>")),
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error("SMTP is not configured");
  }

  const { to, intendedTo, routedViaMailTo } = resolveDeliveryAddress(
    options.to
  );
  let subject = options.subject;
  let text = options.text;
  let html = options.html;

  if (routedViaMailTo) {
    const wrapped = wrapRoutedBody(intendedTo, subject, text, html);
    subject = wrapped.subject;
    text = wrapped.text;
    html = wrapped.html;
  }

  const transport = getTransporter();
  await transport.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
}

export async function sendPasswordResetEmail(
  intendedTo: string,
  resetUrl: string
): Promise<void> {
  await sendEmail({
    to: intendedTo,
    subject: "Reset your MTK Finance password",
    text: `You requested a password reset for MTK Finance.

Click the link below to set a new password (valid for 1 hour):
${resetUrl}

If you did not request this, ignore this email.

— MTK Finance`,
    html: `
      <p>You requested a password reset for <strong>MTK Finance</strong>.</p>
      <p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour)</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

