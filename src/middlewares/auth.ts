import { MiddlewareHandler } from "hono";
import { ConfigManager } from "../utils/config-manager";

// Create singleton instance for configuration access
const configManager = new ConfigManager();

/**
 * Middleware to enforce OpenAI-style API key authentication if OPENAI_API_KEY is configured.
 * Checks for 'Authorization: Bearer <key>' header on protected routes.
 * Supports both environment variables and dashboard configuration.
 */
export const openAIApiKeyAuth: MiddlewareHandler = async (c, next) => {
	// Skip authentication for public endpoints
	const publicEndpoints = ["/", "/health"];
	if (publicEndpoints.some((endpoint) => c.req.path === endpoint)) {
		await next();
		return;
	}

	// Get API key from dashboard configuration first, fallback to environment
	let apiKey = process.env.OPENAI_API_KEY;
	try {
		const dashboardConfig = configManager.readConfig();
		if (dashboardConfig.OPENAI_API_KEY) {
			apiKey = dashboardConfig.OPENAI_API_KEY;
		}
	} catch (error) {
		// Fallback to environment variable if dashboard config fails
		console.warn('Failed to read dashboard configuration for API key, using environment variable:', error);
	}
	if (apiKey) {
		const authHeader = c.req.header("Authorization");

		if (!authHeader) {
			return c.json(
				{
					error: {
						message: "Missing Authorization header",
						type: "authentication_error",
						code: "missing_authorization"
					}
				},
				401
			);
		}

		// Check for Bearer token format
		const match = authHeader.match(/^Bearer\s+(.+)$/);
		if (!match) {
			return c.json(
				{
					error: {
						message: "Invalid Authorization header format. Expected: Bearer <token>",
						type: "authentication_error",
						code: "invalid_authorization_format"
					}
				},
				401
			);
		}

		const providedKey = match[1];
		if (providedKey !== apiKey) {
			return c.json(
				{
					error: {
						message: "Invalid API key",
						type: "authentication_error",
						code: "invalid_api_key"
					}
				},
				401
			);
		}

		// Optionally log successful authentication
		// console.log('API key authentication successful');
	}

	await next();
};
