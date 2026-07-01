# Using Lovable AI

If you're using Lovable Cloud, you can use **Lovable AI** for all AI features without providing your own API key.

---

## What is Lovable AI?

Lovable AI is a built-in AI service provided by Lovable.dev that:

- ✅ Works out of the box (no API key setup)
- ✅ Included in your Lovable subscription
- ✅ Supports chat, summarization, and embeddings
- ✅ Automatically scales with usage
- ✅ No configuration required

---

## How to Enable

Lovable AI is enabled automatically when you:

1. Use Lovable Cloud for your backend
2. Enable AI features in Admin → System Settings

That's it! No API keys to manage.

---

## Supported Features

| Feature | Lovable AI | Your Own API Key |
|---------|------------|------------------|
| AI Chat | ✅ | ✅ |
| Meeting Summaries | ✅ | ✅ |
| Document Analysis | ✅ | ✅ |
| Semantic Search | ✅ | ✅ |
| AI Agents | ✅ | ✅ |
| Knowledge Q&A | ✅ | ✅ |
| Custom Model Selection | ❌ | ✅ |
| Fine-tuned Models | ❌ | ✅ |
| GPT-4 / Claude 3 specific | ❌ | ✅ |

---

## Usage & Pricing

Lovable AI usage is included in your Lovable subscription with usage-based pricing:

- A limited amount of free AI usage is included
- Additional usage is billed based on consumption
- Check your usage in Lovable Settings → Usage

See [Lovable Pricing](https://lovable.dev/pricing) for current rates.

---

## When to Use Your Own API Key

Consider using your own OpenAI/Anthropic key if you need:

| Requirement | Recommendation |
|-------------|----------------|
| Specific model versions (GPT-4 Turbo, Claude 3 Opus) | Your own key |
| Higher rate limits | Your own key |
| Custom fine-tuned models | Your own key |
| Full control over AI costs | Your own key |
| Enterprise compliance requirements | Your own key |
| Simple setup, no management | Lovable AI ✅ |

---

## Switching Between Providers

You can switch between Lovable AI and your own provider:

### Enable Your Own API Key

1. Go to **Settings → Secrets** in Lovable
2. Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
3. In Admin → AI Settings, select your provider

### Switch Back to Lovable AI

1. Remove your API key from Secrets
2. Lovable AI will be used automatically

---

## Technical Details

### How It Works

When using Lovable AI:
1. Your edge functions call the Lovable AI endpoint
2. Lovable AI routes to the best available model
3. Responses are returned to your app
4. Usage is tracked in your Lovable account

### API Compatibility

Lovable AI uses the OpenAI-compatible API format:

```typescript
// Your edge function code works the same way
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  // Lovable automatically injects credentials
  body: JSON.stringify({
    messages: [...],
    model: 'gpt-4o-mini' // Model is automatically selected
  })
});
```

---

## Troubleshooting

### AI Chat not responding
1. Check that Lovable Cloud is enabled
2. Verify AI Chat feature is enabled in Admin → Features
3. Check browser console for errors

### Slow responses
- AI responses typically take 2-10 seconds
- Complex queries may take longer
- Check your internet connection

### Usage limits reached
- Check usage in Lovable Settings
- Consider upgrading your plan
- Or switch to your own API key

---

## Related Documentation

- [AI Provider Routing](./provider-routing.md) - Using your own API keys
- [AI Chat Guide](./ai-chat.md) - Using the chat feature
- [AI Agents](./ai-agents.md) - Custom AI agents
