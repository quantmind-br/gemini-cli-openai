import { Context, Next } from "hono";
import { Env } from "../types";
import { Logger, LogCategory, generateCorrelationId } from "../utils/logger";

/**
 * Enhanced logging middleware with structured logging and correlation IDs
 *
 * Features:
 * - Structured JSON logging with correlation IDs
 * - Request/response tracking with timing
 * - Sensitive data masking
 * - Integration with log buffer for dashboard viewing
 */
export const loggingMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
	const correlationId = generateCorrelationId();
	const logger = new Logger(correlationId);
	const method = c.req.method;
	const path = c.req.path;
	const startTime = Date.now();
	const userAgent = c.req.header("User-Agent");
	const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";

	// Store correlation ID in context for use in route handlers (cast to bypass Hono typing issues)
	(c as { set: (key: string, value: unknown) => void }).set("correlationId", correlationId);
	(c as { set: (key: string, value: unknown) => void }).set("logger", logger);

	// Log request body for POST/PUT/PATCH requests (with masking)
	let requestBody: string | undefined;
	if (["POST", "PUT", "PATCH"].includes(method)) {
		try {
			const clonedReq = c.req.raw.clone();
			const body = await clonedReq.text();
			
			if (body) {
				// Truncate very long bodies
				const truncatedBody = body.length > 1000 ? body.substring(0, 1000) + "..." : body;
				// Mask sensitive data more comprehensively
				requestBody = truncatedBody.replace(
					/"(api_?key|token|authorization|password|secret|credential)":\s*"[^"]*"/gi, 
					'"$1": "***"'
				);
			}
		} catch (error) {
			logger.warn(LogCategory.HTTP, "Failed to parse request body", { 
				error: error instanceof Error ? error.message : "Unknown error" 
			});
		}
	}

	// Log request start
	logger.info(LogCategory.HTTP, "Request started", {
		req: {
			method,
			url: path,
			ip,
			userAgent
		},
		requestBody: requestBody ? { preview: requestBody } : undefined
	});

	await next();

	const duration = Date.now() - startTime;
	const status = c.res.status;

	// Log request completion with timing and status
	const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
	
	if (logLevel === "error") {
		logger.error(LogCategory.HTTP, "Request completed with server error", undefined, {
			req: { method, url: path, ip, userAgent },
			res: { statusCode: status, responseTime: duration }
		});
	} else if (logLevel === "warn") {
		logger.warn(LogCategory.HTTP, "Request completed with client error", {
			req: { method, url: path, ip, userAgent },
			res: { statusCode: status, responseTime: duration }
		});
	} else {
		logger.info(LogCategory.HTTP, "Request completed successfully", {
			req: { method, url: path, ip, userAgent },
			res: { statusCode: status, responseTime: duration }
		});
	}

	// Add response time header for debugging
	c.res.headers.set("X-Response-Time", `${duration}ms`);
	c.res.headers.set("X-Correlation-ID", correlationId);
};
