# 🚀 Gemini CLI OpenAI Worker

Transform Google's Gemini models into OpenAI-compatible endpoints using Cloudflare Workers. Access Google's most advanced AI models through familiar OpenAI API patterns, powered by OAuth2 authentication and the same infrastructure that drives the official Gemini CLI.

## ✨ Features

- 🔐 **OAuth2 Authentication** - No API keys required, uses your Google account
- 🎯 **OpenAI-Compatible API** - Drop-in replacement for OpenAI endpoints
- 📚 **OpenAI SDK Support** - Works with official OpenAI SDKs and libraries
- 🖼️ **Vision Support** - Multi-modal conversations with images (base64 & URLs)
- 🌐 **Third-party Integration** - Compatible with Open WebUI, ChatGPT clients, and more
- ⚡ **Cloudflare Workers** - Global edge deployment with low latency
- 🔄 **Smart Token Caching** - Intelligent token management with KV storage
- 🆓 **Free Tier Access** - Leverage Google's free tier through Code Assist API
- 📡 **Real-time Streaming** - Server-sent events for live responses
- 🎭 **Multiple Models** - Access to latest Gemini models including experimental ones

## 🤖 Supported Models

| Model ID | Context Window | Max Tokens | Thinking Support | Description |
|----------|----------------|------------|------------------|-------------|
| `gemini-2.5-pro` | 1M | 65K | ✅ | Latest Gemini 2.5 Pro model with reasoning capabilities |
| `gemini-2.5-flash` | 1M | 65K | ✅ | Fast Gemini 2.5 Flash model with reasoning capabilities |

> **Note:** Thinking support requires `ENABLE_FAKE_THINKING=true` environment variable. When enabled, these models will show their reasoning process before providing the final answer.

## 🏗️ How It Works

```mermaid
graph TD
    A[Client Request] --> B[Cloudflare Worker]
    B --> C{Token in KV Cache?}
    C -->|Yes| D[Use Cached Token]
    C -->|No| E[Check Environment Token]
    E --> F{Token Valid?}
    F -->|Yes| G[Cache & Use Token]
    F -->|No| H[Refresh Token]
    H --> I[Cache New Token]
    D --> J[Call Gemini API]
    G --> J
    I --> J
    J --> K[Stream Response]
    K --> L[OpenAI Format]
    L --> M[Client Response]
```

The worker acts as a translation layer, converting OpenAI API calls to Google's Code Assist API format while managing OAuth2 authentication automatically.

## 🛠️ Setup

### Prerequisites

1. **Google Account** with access to Gemini
2. **Cloudflare Account** with Workers enabled
3. **Wrangler CLI** installed (`npm install -g wrangler`)

### Step 1: Get OAuth2 Credentials

You need OAuth2 credentials from a Google account that has accessed Gemini. The easiest way to get these is through the official Gemini CLI.

#### Using Gemini CLI

1. **Install Gemini CLI**:
   ```bash
   npm install -g @google/gemini-cli
   ```

2. **Start the Gemini CLI**:
   ```bash
   gemini
   ```
3. **Authenticate with Google**:
   
   Select `● Login with Google`.
   
   A browser window will now open prompting you to login with your Google account.
   
4. **Locate the credentials file**:
   
   **Windows:**
   ```
   C:\Users\USERNAME\.gemini\oauth_creds.json
   ```
   
   **macOS/Linux:**
   ```
   ~/.gemini/oauth_creds.json
   ```

5. **Copy the credentials**:
   The file contains JSON in this format:
   ```json
   {
     "access_token": "ya29.a0AS3H6Nx...",
     "refresh_token": "1//09FtpJYpxOd...",
     "scope": "https://www.googleapis.com/auth/cloud-platform ...",
     "token_type": "Bearer",
     "id_token": "eyJhbGciOiJSUzI1NiIs...",
     "expiry_date": 1750927763467
   }
   ```

### Step 2: Create KV Namespace

```bash
# Create a KV namespace for token caching
wrangler kv:namespace create "GEMINI_CLI_KV"
```

Note the namespace ID returned.
Update `wrangler.toml` with your KV namespace ID:
```toml
kv_namespaces = [
  { binding = "GEMINI_CLI_KV", id = "your-kv-namespace-id" }
]
```

### Step 3: Environment Setup

Create a `.dev.vars` file:
```bash
# Required: OAuth2 credentials JSON from Gemini CLI authentication
GCP_SERVICE_ACCOUNT={"access_token":"ya29...","refresh_token":"1//...","scope":"...","token_type":"Bearer","id_token":"eyJ...","expiry_date":1750927763467}

# Optional: Google Cloud Project ID (auto-discovered if not set)
# GEMINI_PROJECT_ID=your-project-id

# Optional: API key for authentication (if not set, API is public)
# When set, clients must include "Authorization: Bearer <your-api-key>" header
# Example: sk-1234567890abcdef1234567890abcdef
OPENAI_API_KEY=sk-your-secret-api-key-here
```

For production, set the secrets:
```bash
wrangler secret put GCP_SERVICE_ACCOUNT
wrangler secret put OPENAI_API_KEY  # Optional, only if you want authentication
```

### Step 4: Deploy

```bash
# Install dependencies
npm install

# Deploy to Cloudflare Workers
npm run deploy

# Or run locally for development
npm run dev
```

## 📡 API Endpoints

### Base URL
```
https://your-worker.your-subdomain.workers.dev
```

### List Models
```http
GET /v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-2.5-pro",
      "object": "model",
      "created": 1708976947,
      "owned_by": "google-gemini-cli"
    }
  ]
}
```

### Chat Completions
```http
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "gemini-2.5-flash",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user", 
      "content": "Hello! How are you?"
    }
  ]
}
```

**Response (Streaming):**
```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1708976947,"model":"gemini-2.5-flash","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1708976947,"model":"gemini-2.5-flash","choices":[{"index":0,"delta":{"content":"! I'm"},"finish_reason":null}]}

data: [DONE]
```

### Debug Endpoints

#### Check Token Cache
```http
GET /v1/debug/cache
```

#### Test Authentication
```http
POST /v1/token-test
POST /v1/test
```

## 💻 Usage Examples

### OpenAI SDK (Python)
```python
from openai import OpenAI

# Initialize with your worker endpoint
client = OpenAI(
    base_url="https://your-worker.workers.dev/v1",
    api_key="sk-your-secret-api-key-here"  # Use your OPENAI_API_KEY if authentication is enabled
)

# Chat completion
response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain machine learning in simple terms"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### OpenAI SDK (JavaScript/TypeScript)
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://your-worker.workers.dev/v1',
  apiKey: 'sk-your-secret-api-key-here', // Use your OPENAI_API_KEY if authentication is enabled
});

const stream = await openai.chat.completions.create({
  model: 'gemini-2.5-flash',
  messages: [
    { role: 'user', content: 'Write a haiku about coding' }
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  process.stdout.write(content);
}
```

### Open WebUI Integration

1. **Add as OpenAI-compatible endpoint**:
   - Base URL: `https://your-worker.workers.dev/v1`
   - API Key: `sk-your-secret-api-key-here` (use your OPENAI_API_KEY if authentication is enabled)

2. **Configure models**:
   Open WebUI will automatically discover available Gemini models through the `/v1/models` endpoint.

3. **Start chatting**:
   Use any Gemini model just like you would with OpenAI models!

### cURL
```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-secret-api-key-here" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ]
  }'
```

### Raw JavaScript/TypeScript
```javascript
const response = await fetch('https://your-worker.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: 'Hello, world!' }
    ]
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      const data = JSON.parse(line.substring(6));
      const content = data.choices[0]?.delta?.content;
      if (content) {
        console.log(content);
      }
    }
  }
}
```

### Raw Python (without SDK)
```python
import requests
import json

url = "https://your-worker.workers.dev/v1/chat/completions"
data = {
    "model": "gemini-2.5-flash",
    "messages": [
        {"role": "user", "content": "Write a Python function to calculate fibonacci"}
    ]
}

response = requests.post(url, json=data, stream=True)

for line in response.iter_lines():
    if line and line.startswith(b'data: '):
        try:
            chunk = json.loads(line[6:].decode())
            content = chunk['choices'][0]['delta'].get('content', '')
            if content:
                print(content, end='')
        except json.JSONDecodeError:
            continue
```

### Image Support (Vision)

The worker supports multimodal conversations with images for vision-capable models. Images can be provided as base64-encoded data URLs or as external URLs.

#### Supported Image Formats
- JPEG, PNG, GIF, WebP
- Base64 encoded (recommended for reliability)
- External URLs (may have limitations with some services)

#### Vision-Capable Models
- `gemini-2.5-pro`
- `gemini-2.5-flash` 
- `gemini-2.0-flash-001`
- `gemini-2.0-flash-lite-preview-02-05`
- `gemini-2.0-pro-exp-02-05`

#### Example with Base64 Image
```python
from openai import OpenAI
import base64

# Encode your image
with open("image.jpg", "rb") as image_file:
    base64_image = base64.b64encode(image_file.read()).decode('utf-8')

client = OpenAI(
    base_url="https://your-worker.workers.dev/v1",
    api_key="sk-your-secret-api-key-here"
)

response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What do you see in this image?"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                }
            ]
        }
    ]
)

print(response.choices[0].message.content)
```

#### Example with Image URL
```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-secret-api-key-here" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Describe this image in detail."
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://example.com/image.jpg",
              "detail": "high"
            }
          }
        ]
      }
    ]
  }'
```

#### Multiple Images
You can include multiple images in a single message:
```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Compare these two images."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,..."
          }
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,..."
          }
        }
      ]
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GCP_SERVICE_ACCOUNT` | ✅ | OAuth2 credentials JSON string |
| `GEMINI_PROJECT_ID` | ❌ | Google Cloud Project ID (auto-discovered if not set) |
| `OPENAI_API_KEY` | ❌ | API key for authentication (if not set, API is public) |
| `ENABLE_FAKE_THINKING` | ❌ | Enable synthetic thinking output for thinking models (set to "true" to enable) |

**Authentication Security:**
- When `OPENAI_API_KEY` is set, all `/v1/*` endpoints require authentication
- Clients must include the header: `Authorization: Bearer <your-api-key>`
- Without this environment variable, the API is publicly accessible
- Recommended format: `sk-` followed by a random string (e.g., `sk-1234567890abcdef...`)

**Thinking Models:**
- When `ENABLE_FAKE_THINKING` is set to "true", models marked with `thinking: true` will generate synthetic reasoning text before their actual response
- This simulates the thinking process similar to OpenAI's o3 model behavior, showing the model's reasoning steps
- The reasoning output is streamed as `reasoning` chunks in the OpenAI-compatible response format
- If not set or set to any value other than "true", thinking models will behave like regular models

### KV Namespaces

| Binding | Purpose |
|---------|---------|
| `GEMINI_CLI_KV` | Token caching and session management |

## 🚨 Troubleshooting

### Common Issues

**401 Authentication Error**
- Check if your OAuth2 credentials are valid
- Ensure the refresh token is working
- Verify the credentials format matches exactly

**Token Refresh Failed**
- Credentials might be from wrong OAuth2 client
- Refresh token might be expired or revoked
- Check the debug cache endpoint for token status

**Project ID Discovery Failed**
- Set `GEMINI_PROJECT_ID` environment variable manually
- Ensure your Google account has access to Gemini

### Debug Commands

```bash
# Check KV cache status
curl https://your-worker.workers.dev/v1/debug/cache

# Test authentication only
curl -X POST https://your-worker.workers.dev/v1/token-test

# Test full flow
curl -X POST https://your-worker.workers.dev/v1/test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the official [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
- Built on [Cloudflare Workers](https://workers.cloudflare.com/)
- Uses [Hono](https://hono.dev/) web framework

---

**⚠️ Important**: This project uses Google's Code Assist API which may have usage limits and terms of service. Please ensure compliance with Google's policies when using this worker.

[![Star History Chart](https://api.star-history.com/svg?repos=GewoonJaap/gemini-cli-openai&type=Date)](https://www.star-history.com/#GewoonJaap/gemini-cli-openai&Date)