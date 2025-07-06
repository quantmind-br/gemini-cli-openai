# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Gemini CLI OpenAI Worker** that transforms Google's Gemini models into OpenAI-compatible API endpoints. It acts as a bridge service, allowing developers to use Google's advanced AI models through familiar OpenAI API patterns, powered by OAuth2 authentication.

## Essential Commands

### Development
- `yarn dev` - Start development server with Wrangler hot reload
- `yarn build` - Build and validate for production (dry-run deployment)
- `yarn deploy` - Deploy to Cloudflare Workers

### Code Quality (ALWAYS run before submitting changes)
- `yarn lint` - Run ESLint to check code quality
- `yarn lint:fix` - Auto-fix linting issues
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting

### Testing
- Use `api-test.http` and `stream-test.http` for manual API testing
- Debug endpoints: `/v1/debug/cache`, `/v1/token-test`, `/v1/test`

## Architecture Overview

### Tech Stack
- **Runtime**: Cloudflare Workers (primary) + Docker (alternative)
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript with strict typing
- **Authentication**: OAuth2 with token caching via Cloudflare KV/Redis
- **AI Models**: Google Gemini 2.5 Pro/Flash with thinking capabilities

### Core Request Flow
1. **Route Handler** (`src/routes/openai.ts`) - Handles OpenAI-compatible requests
2. **Authentication** (`src/auth.ts`) - Manages OAuth2 tokens with caching
3. **Gemini Client** (`src/gemini-client.ts`) - Communicates with Google's Code Assist API
4. **Stream Transformer** (`src/stream-transformer.ts`) - Converts Gemini responses to OpenAI format

### Key Files
- `src/index.ts` - Main application entry point with Hono app setup
- `src/types.ts` - TypeScript interfaces for all data structures
- `src/constants.ts` - Application constants and configuration values
- `src/models.ts` - Gemini model definitions and capabilities
- `src/routes/openai.ts` - OpenAI-compatible API endpoints
- `src/auth.ts` - OAuth2 authentication manager with token refresh
- `src/gemini-client.ts` - Gemini API client with streaming support
- `src/stream-transformer.ts` - Real-time response transformation

## Development Guidelines

### Code Quality Requirements
- **Always run `yarn lint` and `yarn build` before submitting changes**
- Use proper TypeScript types from `src/types.ts` - avoid `any`
- Add constants to `src/constants.ts` instead of using magic numbers/strings
- Follow existing patterns for error handling and logging

### Environment Configuration
Key environment variables (see `Env` interface in `types.ts`):
- `GCP_SERVICE_ACCOUNT` - OAuth2 credentials JSON (required)
- `GEMINI_PROJECT_ID` - Google Cloud project ID (optional)
- `OPENAI_API_KEY` - API authentication key (optional)
- `ENABLE_REAL_THINKING` - Enable native Gemini reasoning (optional)
- `ENABLE_FAKE_THINKING` - Enable synthetic thinking for testing (optional)
- `STREAM_THINKING_AS_CONTENT` - DeepSeek R1 style thinking output (optional)

### Key Features
- **OAuth2 Authentication** - Uses Google account credentials, no API keys needed
- **OpenAI Compatibility** - Drop-in replacement for OpenAI endpoints
- **Multi-modal Support** - Text + images via base64 or URLs
- **Streaming Responses** - Real-time Server-Sent Events
- **Thinking Capabilities** - Both synthetic and real reasoning support
- **Token Caching** - Intelligent OAuth2 token management

### Architecture Patterns
- **Error Handling** - Always use proper HTTP status codes and descriptive messages
- **Logging** - Use structured logging for debugging (see `src/middlewares/logging.ts`)
- **CORS** - Configured for web client compatibility
- **Authentication** - Optional Bearer token protection for API endpoints

### Model Support
- `gemini-2.5-pro` - Advanced reasoning, 1M context, 65K max tokens
- `gemini-2.5-flash` - Faster responses, same capabilities as Pro
- **Thinking Support** - Both fake (synthetic) and real (native) reasoning modes
- **Vision Support** - Multi-modal conversations with image analysis

### Deployment Targets
1. **Cloudflare Workers** (primary) - Global serverless deployment
2. **Docker** - Containerized with Redis caching
3. **Local Development** - Wrangler dev server

### Testing Strategy
- Use HTTP test files for manual API validation
- Debug endpoints for authentication and functionality testing
- Comprehensive error handling for all edge cases
- Vision testing with various image formats and sources

## Important Notes

- **Security**: Never log sensitive data (tokens, credentials)
- **Compatibility**: Maintain OpenAI SDK compatibility for seamless integration
- **Performance**: Optimize for Cloudflare Workers constraints (bundle size, memory, CPU)
- **Documentation**: Update README.md when adding features or changing behavior
- **OAuth Flow**: Leverages official Gemini CLI credentials for authentication