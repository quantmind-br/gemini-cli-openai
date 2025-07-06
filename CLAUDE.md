# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Gemini CLI OpenAI Server** that transforms Google's Gemini models into OpenAI-compatible API endpoints. It acts as a bridge service, allowing developers to use Google's advanced AI models through familiar OpenAI API patterns, powered by OAuth2 authentication and deployed via Docker.

## Essential Commands

### Development & Deployment
- `start.bat` / `docker-compose up -d` - Start application and Redis containers
- `stop.bat` / `docker-compose down` - Stop all containers
- `restart.bat` / `./restart.sh` - Restart containers with health check
- `npm run dev` - Start development server with hot reload (requires local Node.js)
- `npm run build` - Build TypeScript to JavaScript
- `docker-compose up -d --build` - Rebuild and start containers

### Code Quality (ALWAYS run before submitting changes)
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing
- `python test_api.py` - Comprehensive API tests using requests
- `python test_openai_sdk.py` - OpenAI SDK compatibility tests
- `run_tests.bat` - Run all Python tests (Windows)
- Use `api-test.http` and `stream-test.http` for manual API testing
- Debug endpoints: `/v1/debug/cache`, `/v1/token-test`, `/v1/test`
- Dashboard: Access `http://127.0.0.1:3000/dashboard` for configuration interface

## Architecture Overview

### Tech Stack
- **Runtime**: Node.js with Docker containerization
- **Framework**: Hono with @hono/node-server adapter
- **Language**: TypeScript with strict typing
- **Caching**: Redis for OAuth2 token storage
- **Authentication**: OAuth2 with intelligent token refresh
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
- `src/routes/dashboard.ts` - Web dashboard routes and static file serving
- `src/routes/config-api.ts` - Configuration management API endpoints
- `src/routes/auth.ts` - Dashboard authentication endpoints
- `src/auth.ts` - OAuth2 authentication manager with token refresh
- `src/gemini-client.ts` - Gemini API client with streaming support
- `src/stream-transformer.ts` - Real-time response transformation
- `src/middlewares/dashboard-auth.ts` - Dashboard authentication middleware
- `src/utils/config-manager.ts` - Environment variable management utility
- `public/dashboard/` - Static dashboard HTML, CSS, and JavaScript files

## Development Guidelines

### Code Quality Requirements
- **Always run `npm run lint` and `npm run build` before submitting changes**
- Use proper TypeScript types from `src/types.ts` - avoid `any`
- Add constants to `src/constants.ts` instead of using magic numbers/strings
- Follow existing patterns for error handling and logging

### Environment Configuration
Key environment variables (see `Env` interface in `types.ts` and `.env.example`):
- `GCP_SERVICE_ACCOUNT` - OAuth2 credentials JSON (required)
- `REDIS_URL` - Redis connection URL (default: redis://redis:6379)
- `PORT` - Server port (default: 3000)
- `GEMINI_PROJECT_ID` - Google Cloud project ID (optional)
- `OPENAI_API_KEY` - API authentication key (optional)
- `ENABLE_REAL_THINKING` - Enable native Gemini reasoning (optional)
- `ENABLE_FAKE_THINKING` - Enable synthetic thinking for testing (optional)
- `STREAM_THINKING_AS_CONTENT` - DeepSeek R1 style thinking output (optional)
- `DASHBOARD_USERNAME` - Username for web dashboard access (required for dashboard)
- `DASHBOARD_PASSWORD` - Password for web dashboard access (required for dashboard)

### Key Features
- **OAuth2 Authentication** - Uses Google account credentials, no API keys needed
- **OpenAI Compatibility** - Drop-in replacement for OpenAI endpoints
- **Multi-modal Support** - Text + images via base64 or URLs
- **Streaming Responses** - Real-time Server-Sent Events
- **Thinking Capabilities** - Both synthetic and real reasoning support
- **Redis Token Caching** - Intelligent OAuth2 token management with automatic refresh
- **Web Dashboard** - Interactive configuration interface for all environment variables

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
1. **Docker Compose** (primary) - Containerized application with Redis
2. **Local Node.js** - Direct development with `npm run dev`
3. **Docker Single Container** - Build and deploy individual containers

### Testing Strategy
- **Python Test Scripts** - Comprehensive automated testing
  - `test_api.py` - Raw HTTP requests testing
  - `test_openai_sdk.py` - OpenAI SDK compatibility testing
- **HTTP Files** - Manual API validation with `api-test.http` and `stream-test.http`
- **Debug Endpoints** - Authentication and functionality testing
- **Docker Health Checks** - Container and service monitoring
- **Vision Testing** - Multi-modal conversations with various image formats

## Important Notes

- **Security**: Never log sensitive data (tokens, credentials)
- **Compatibility**: Maintain OpenAI SDK compatibility for seamless integration
- **Performance**: Optimize for Node.js and Docker constraints (memory, CPU, Redis connections)
- **Documentation**: Update README.md when adding features or changing behavior
- **OAuth Flow**: Leverages official Gemini CLI credentials for authentication
- **Redis Connection**: Ensure Redis is available before starting the application
- **Environment Setup**: Copy `.env.example` to `.env` and configure OAuth2 credentials

## Quick Start

1. **Setup Environment**: `cp .env.example .env` and add your OAuth2 credentials
2. **Configure Dashboard**: Add `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` to `.env`
3. **Start Services**: `start.bat` or `docker-compose up -d`
4. **Configure via Dashboard**: Visit `http://127.0.0.1:3000/dashboard` to manage settings
5. **Test API**: `python test_api.py` or visit `http://127.0.0.1:3000`
6. **Restart Services**: `restart.bat` or `./restart.sh` (if needed)
7. **Stop Services**: `stop.bat` or `docker-compose down`

## Web Dashboard Features

### Configuration Management
- **Visual Interface**: User-friendly forms for all environment variables
- **File Upload**: Direct upload of GCP OAuth2 credentials JSON
- **Real-time Validation**: Instant feedback on configuration errors
- **Optional Settings**: Enable/disable features without manual file editing
- **Configuration Testing**: Built-in validation and connectivity tests

### Security Features
- **Session-based Authentication**: Secure login with configurable credentials
- **Protected Routes**: Dashboard access requires authentication
- **Input Validation**: Prevents invalid configuration values
- **File Validation**: Ensures uploaded OAuth2 credentials are valid JSON

### Access & Usage
- **URL**: `http://127.0.0.1:3000/dashboard` (use 127.0.0.1, not localhost)
- **Login**: Use credentials from `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`
- **Upload OAuth2**: Upload `oauth_creds.json` file directly through interface
- **Live Updates**: Changes take effect immediately without manual restart
- **Status Indicators**: Visual feedback on required vs optional configurations