import { config } from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { OpenAIRoute } from "./routes/openai";
import { DebugRoute } from "./routes/debug";
import { DashboardRoute } from "./routes/dashboard";
import { ConfigApiRoute } from "./routes/config-api";
import { AuthRoute } from "./routes/auth";
import { openAIApiKeyAuth } from "./middlewares/auth";
import { loggingMiddleware } from "./middlewares/logging";

// Load configuration from data/.env if it exists (dashboard configuration)
const dataEnvPath = path.resolve('./data/.env');
console.log(`🔍 Checking for dashboard configuration at: ${dataEnvPath}`);

try {
	// Check if the data directory exists
	const dataDir = path.dirname(dataEnvPath);
	if (!fs.existsSync(dataDir)) {
		console.log(`📁 Data directory does not exist: ${dataDir}`);
		console.log('⚠️  No dashboard configuration available - using environment variables');
	} else {
		console.log(`✅ Data directory exists: ${dataDir}`);
		
		// List contents of data directory for debugging
		try {
			const files = fs.readdirSync(dataDir);
			console.log(`📄 Data directory contents: ${files.length > 0 ? files.join(', ') : '(empty)'}`);
		} catch (dirError) {
			console.log(`❌ Could not read data directory: ${dirError}`);
		}
		
		// Check if .env file exists and is readable
		if (fs.existsSync(dataEnvPath)) {
			try {
				const stats = fs.statSync(dataEnvPath);
				console.log(`📄 Found data/.env file (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
				
				// Read and validate the file content
				const envContent = fs.readFileSync(dataEnvPath, 'utf8');
				console.log(`📝 data/.env content preview: ${envContent.substring(0, 100)}${envContent.length > 100 ? '...' : ''}`);
				
				// Load the configuration with override
				console.log('🔄 Loading dashboard configuration with override=true...');
				const result = config({ path: dataEnvPath, override: true });
				
				if (result.error) {
					console.error('❌ Error loading data/.env:', result.error);
				} else {
					console.log('✅ Dashboard configuration loaded successfully');
					
					// Verify key environment variables were loaded
					if (process.env.GCP_SERVICE_ACCOUNT) {
						console.log('🔐 GCP_SERVICE_ACCOUNT found in environment after loading dashboard config');
					} else {
						console.log('⚠️  GCP_SERVICE_ACCOUNT not found in environment after loading dashboard config');
					}
				}
			} catch (fileError) {
				console.error(`❌ Error reading data/.env file: ${fileError}`);
			}
		} else {
			console.log(`⚠️  data/.env file does not exist at: ${dataEnvPath}`);
			console.log('⚠️  No dashboard configuration available - using environment variables');
		}
	}
} catch (error) {
	console.error(`❌ Error checking dashboard configuration: ${error}`);
	console.log('⚠️  Falling back to environment variables');
}

/**
 * Gemini CLI OpenAI Server
 *
 * A Node.js server that provides OpenAI-compatible API endpoints
 * for Google's Gemini models via the Gemini CLI OAuth flow.
 *
 * Features:
 * - OpenAI-compatible chat completions and model listing
 * - OAuth2 authentication with token caching via Redis
 * - Support for multiple Gemini models (2.5 Pro, 2.0 Flash, 1.5 Pro, etc.)
 * - Streaming responses compatible with OpenAI SDK
 * - Debug and testing endpoints for troubleshooting
 */

// Create the main Hono app
const app = new Hono();

// Add logging middleware
app.use("*", loggingMiddleware);

// Add CORS headers for all requests
app.use("*", async (c, next) => {
	// Set CORS headers
	c.header("Access-Control-Allow-Origin", "*");
	c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

	// Handle preflight requests
	if (c.req.method === "OPTIONS") {
		return new Response(null, { status: 204 });
	}

	await next();
});

// Apply OpenAI API key authentication middleware to all /v1 routes
app.use("/v1/*", openAIApiKeyAuth);

// Setup route handlers
app.route("/v1", OpenAIRoute);
app.route("/v1/debug", DebugRoute);

// Add individual debug routes to main app for backward compatibility
app.route("/v1", DebugRoute);

// Dashboard routes
app.route("/dashboard", DashboardRoute);
app.route("/api/config", ConfigApiRoute);
app.route("/api/auth", AuthRoute);

// Root endpoint - basic info about the service
app.get("/", (c) => {
	const requiresAuth = !!process.env.OPENAI_API_KEY;

	return c.json({
		name: "Gemini CLI OpenAI Server",
		description: "OpenAI-compatible API for Google Gemini models via OAuth",
		version: "1.0.0",
		authentication: {
			required: requiresAuth,
			type: requiresAuth ? "Bearer token in Authorization header" : "None"
		},
		endpoints: {
			chat_completions: "/v1/chat/completions",
			models: "/v1/models",
			dashboard: "/dashboard",
			debug: {
				cache: "/v1/debug/cache",
				token_test: "/v1/token-test",
				full_test: "/v1/test"
			}
		},
		documentation: "https://github.com/gewoonjaap/gemini-cli-openai"
	});
});

// Health check endpoint
app.get("/health", (c) => {
	return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start the server
const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Gemini CLI OpenAI Server starting on port ${port}`);

serve({
	fetch: app.fetch,
	port: port,
});

console.log(`✅ Server running at http://localhost:${port}`);
