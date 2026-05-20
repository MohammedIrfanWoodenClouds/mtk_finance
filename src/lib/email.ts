import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/transporter";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass) {
    return null;
  }

  return { host, port, user, pass, from: from || user };
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
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

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error("SMTP is not configured");
  }

  const transport = getTransporter();
  await transport.sendMail({
    from: cfg.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? options.text.replace(/\n/g, "<br>"),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await sendEmail({
    to,
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
