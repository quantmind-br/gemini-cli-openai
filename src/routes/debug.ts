import { Hono } from "hono";
import { Env } from "../types";
import { AuthManager } from "../auth";
import { GeminiApiClient } from "../gemini-client";
import * as path from "path";
import * as fs from "fs";

/**
 * Debug and testing routes for troubleshooting authentication and API functionality.
 */
export const DebugRoute = new Hono();

// Check KV cache status
DebugRoute.get("/cache", async (c) => {
	try {
		const env = process.env as unknown as Env;
		const authManager = new AuthManager(env);
		const cacheInfo = await authManager.getCachedTokenInfo();

		// Remove sensitive information from the response
		const sanitizedInfo = {
			status: "ok",
			cached: cacheInfo.cached,
			cached_at: cacheInfo.cached_at,
			expires_at: cacheInfo.expires_at,
			time_until_expiry_seconds: cacheInfo.time_until_expiry_seconds,
			is_expired: cacheInfo.is_expired,
			message: cacheInfo.message
			// Explicitly exclude token_preview and any other sensitive data
		};

		return c.json(sanitizedInfo);
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return c.json(
			{
				status: "error",
				message: errorMessage
			},
			500
		);
	}
});

// Simple token test endpoint
DebugRoute.post("/token-test", async (c) => {
	try {
		console.log("Token test endpoint called");
		const env = process.env as unknown as Env;
		const authManager = new AuthManager(env);

		// Test authentication only
		await authManager.initializeAuth();
		console.log("Token test passed");

		return c.json({
			status: "ok",
			message: "Token authentication successful"
		});
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		console.error("Token test error:", e);
		return c.json(
			{
				status: "error",
				message: errorMessage
				// Removed stack trace for security
			},
			500
		);
	}
});

// Full functionality test endpoint
DebugRoute.post("/test", async (c) => {
	try {
		console.log("Test endpoint called");
		const env = process.env as unknown as Env;
		const authManager = new AuthManager(env);
		const geminiClient = new GeminiApiClient(env, authManager);

		// Test authentication
		await authManager.initializeAuth();
		console.log("Auth test passed");

		// Test project discovery
		const projectId = await geminiClient.discoverProjectId();
		console.log("Project discovery test passed");

		return c.json({
			status: "ok",
			message: "Authentication and project discovery successful",
			project_available: !!projectId
			// Removed actual projectId for security
		});
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		console.error("Test endpoint error:", e);
		return c.json(
			{
				status: "error",
				message: errorMessage
				// Removed stack trace and detailed error message for security
			},
			500
		);
	}
});

// Environment configuration debug endpoint
DebugRoute.get("/env-config", async (c) => {
	try {
		const dataEnvPath = path.resolve('./data/.env');
		const dataDir = path.dirname(dataEnvPath);
		
		const debugInfo = {
			status: "ok",
			paths: {
				working_directory: process.cwd(),
				data_directory: dataDir,
				env_file_path: dataEnvPath
			},
			file_system: {
				data_dir_exists: fs.existsSync(dataDir),
				env_file_exists: fs.existsSync(dataEnvPath),
				data_dir_contents: [] as string[],
				env_file_stats: null as Record<string, unknown> | null
			},
			environment_variables: {
				gcp_service_account_configured: !!process.env.GCP_SERVICE_ACCOUNT,
				gcp_service_account_length: process.env.GCP_SERVICE_ACCOUNT?.length || 0,
				dashboard_username_configured: !!process.env.DASHBOARD_USERNAME,
				dashboard_password_configured: !!process.env.DASHBOARD_PASSWORD,
				redis_url: process.env.REDIS_URL || 'not set',
				port: process.env.PORT || 'not set'
			},
			node_info: {
				node_version: process.version,
				platform: process.platform,
				architecture: process.arch
			}
		};
		
		// Get data directory contents if it exists
		if (fs.existsSync(dataDir)) {
			try {
				debugInfo.file_system.data_dir_contents = fs.readdirSync(dataDir);
			} catch (error) {
				debugInfo.file_system.data_dir_contents = [`Error reading directory: ${error}`];
			}
		}
		
		// Get env file stats if it exists
		if (fs.existsSync(dataEnvPath)) {
			try {
				const stats = fs.statSync(dataEnvPath);
				debugInfo.file_system.env_file_stats = {
					size_bytes: stats.size,
					modified: stats.mtime.toISOString(),
					readable: true
				};
				
				// Try to read file content (non-sensitive preview)
				try {
					const content = fs.readFileSync(dataEnvPath, 'utf8');
					const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
					debugInfo.file_system.env_file_stats.line_count = lines.length;
					debugInfo.file_system.env_file_stats.has_gcp_service_account = lines.some(line => 
						line.startsWith('GCP_SERVICE_ACCOUNT=')
					);
				} catch (readError) {
					debugInfo.file_system.env_file_stats.readable = false;
					debugInfo.file_system.env_file_stats.read_error = String(readError);
				}
			} catch (statError) {
				debugInfo.file_system.env_file_stats = { error: String(statError) };
			}
		}
		
		return c.json(debugInfo);
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return c.json(
			{
				status: "error",
				message: errorMessage
			},
			500
		);
	}
});
