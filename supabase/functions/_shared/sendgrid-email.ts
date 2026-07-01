/**
 * Shared SendGrid email helper for Edge Functions
 * Uses only SENDGRID_API_KEY from Deno.env
 * Implements SendGrid v3 mail/send API
 */

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

export interface SendGridEmailOptions {
  to: string[] | string;
  subject: string;
  html?: string;
  text?: string;
  body?: string;
  from: { email: string; name?: string };
  trackingSettings?: {
    openTracking?: boolean;
    clickTracking?: boolean;
  };
  customArgs?: Record<string, string>;
  /** Override API key (e.g. from DB); if not set, uses SENDGRID_API_KEY env */
  apiKey?: string;
}

export interface SendGridEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Strip HTML tags for plain text fallback */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export async function sendEmailViaSendGrid(
  options: SendGridEmailOptions
): Promise<SendGridEmailResult> {
  const apiKey = options.apiKey ?? Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) {
    return { success: false, error: "SENDGRID_API_KEY not configured" };
  }

  const toEmails = Array.isArray(options.to)
    ? options.to.map((e) => ({ email: e }))
    : [{ email: options.to }];

  let textContent = options.text ?? options.body;
  let htmlContent = options.html;

  if (!textContent && htmlContent) {
    textContent = htmlToPlainText(htmlContent);
  }
  if (!htmlContent && textContent) {
    htmlContent = `<p>${textContent.replace(/\n/g, "<br>")}</p>`;
  }

  if (!textContent && !htmlContent) {
    return { success: false, error: "No email content (text or html) provided" };
  }

  const content: Array<{ type: string; value: string }> = [];
  if (textContent) {
    content.push({ type: "text/plain", value: textContent });
  }
  if (htmlContent) {
    content.push({ type: "text/html", value: htmlContent });
  }

  const payload = {
    personalizations: [{ to: toEmails, custom_args: options.customArgs ?? {} }],
    from: options.from,
    subject: options.subject,
    content,
    tracking_settings: options.trackingSettings
      ? {
          open_tracking: {
            enable: options.trackingSettings.openTracking ?? false,
          },
          click_tracking: {
            enable: options.trackingSettings.clickTracking ?? false,
          },
        }
      : undefined,
  };

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `SendGrid API error: ${response.status} - ${errorText}`,
      };
    }

    const messageId = response.headers.get("x-message-id");
    return { success: true, messageId: messageId ?? undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
