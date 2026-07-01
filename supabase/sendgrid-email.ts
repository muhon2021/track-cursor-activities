const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

export interface SendGridRecipient {
  email: string;
  name?: string;
}

export interface SendGridEmailOptions {
  to: SendGridRecipient | SendGridRecipient[] | string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: SendGridRecipient;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  categories?: string[];
  customArgs?: Record<string, string>;
  trackingSettings?: {
    clickTracking?: boolean;
    openTracking?: boolean;
  };
}

interface SendGridResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

const defaultFrom: SendGridRecipient = {
  email: 'noreply@sjinnovation.com',
  name: 'SJ Control Tower',
};

const normalizeRecipients = (
  recipients: SendGridEmailOptions['to']
): SendGridRecipient[] => {
  const items = Array.isArray(recipients) ? recipients : [recipients];
  return items.map((recipient) =>
    typeof recipient === 'string' ? { email: recipient } : recipient
  );
};

export async function sendEmailViaSendGrid(
  options: SendGridEmailOptions
): Promise<SendGridResponse> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');

  if (!sendgridApiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const toRecipients = normalizeRecipients(options.to);

  const payload = {
    personalizations: [
      {
        to: toRecipients,
        cc: options.cc?.map((email) => ({ email })),
        bcc: options.bcc?.map((email) => ({ email })),
        dynamic_template_data: options.dynamicTemplateData,
        custom_args: options.customArgs,
      },
    ],
    from: options.from || defaultFrom,
    subject: options.subject,
    content: [
      ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
      ...(options.html ? [{ type: 'text/html', value: options.html }] : []),
    ],
    reply_to: options.replyTo ? { email: options.replyTo } : undefined,
    template_id: options.templateId,
    categories: options.categories,
    tracking_settings: options.trackingSettings
      ? {
          click_tracking: {
            enable: options.trackingSettings.clickTracking ?? false,
          },
          open_tracking: {
            enable: options.trackingSettings.openTracking ?? false,
          },
        }
      : undefined,
  };

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', errorText);
      return {
        success: false,
        error: `SendGrid API error: ${response.status} - ${errorText}`,
      };
    }

    const messageId = response.headers.get('x-message-id');
    return { success: true, messageId: messageId || undefined };
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
