import { Env, OAuth2Credentials } from "./types";
import { createClient, RedisClientType } from "redis";
import {
	CODE_ASSIST_ENDPOINT,
	CODE_ASSIST_API_VERSION,
	OAUTH_CLIENT_ID,
	OAUTH_CLIENT_SECRET,
	OAUTH_REFRESH_URL,
	TOKEN_BUFFER_TIME,
	KV_TOKEN_KEY
} from "./config";

// Auth-related interfaces
interface TokenRefreshResponse {
	access_token: string;
	expires_in: number;
}

interface CachedTokenData {
	access_token: string;
	expiry_date: number;
	cached_at: number;
}

interface TokenCacheInfo {
	cached: boolean;
	cached_at?: string;
	expires_at?: string;
	time_until_expiry_seconds?: number;
	is_expired?: boolean;
	message?: string;
	error?: string;
}

/**
 * Handles OAuth2 authentication and Google Code Assist API communication.
 * Manages token caching, refresh, and API calls.
 */
export class AuthManager {
	private env: Env;
	private accessToken: string | null = null;
	private redisClient: RedisClientType | null = null;

	constructor(env: Env) {
		this.env = env;
	}

	/**
	 * Initialize Redis client if not already initialized.
	 */
	private async initRedis(): Promise<RedisClientType> {
		if (!this.redisClient) {
			const redisUrl = this.env.REDIS_URL || process.env.REDIS_URL || "redis://redis:6379";
			this.redisClient = createClient({ url: redisUrl });
			await this.redisClient.connect();
		}
		return this.redisClient;
	}

	/**
	 * Initializes authentication using OAuth2 credentials with Redis caching.
	 */
	public async initializeAuth(): Promise<void> {
		const credentials = this.env.GCP_SERVICE_ACCOUNT || process.env.GCP_SERVICE_ACCOUNT;
		if (!credentials) {
			throw new Error("`GCP_SERVICE_ACCOUNT` environment variable not set. Please provide OAuth2 credentials JSON.");
		}

		try {
			// First, try to get a cached token from Redis
			let cachedTokenData = null;

			try {
				const redis = await this.initRedis();
				const cachedToken = await redis.get(KV_TOKEN_KEY);
				if (cachedToken) {
					cachedTokenData = JSON.parse(cachedToken) as CachedTokenData;
					console.log("Found cached token in Redis storage");
				}
			} catch (redisError) {
				console.log("No cached token found in Redis storage or Redis error:", redisError);
			}

			// Check if cached token is still valid (with buffer)
			if (cachedTokenData) {
				const timeUntilExpiry = cachedTokenData.expiry_date - Date.now();
				if (timeUntilExpiry > TOKEN_BUFFER_TIME) {
					this.accessToken = cachedTokenData.access_token;
					console.log(`Using cached token, valid for ${Math.floor(timeUntilExpiry / 1000)} more seconds`);
					return;
				}
				console.log("Cached token expired or expiring soon");
			}

			// Parse original credentials from environment
			const oauth2Creds: OAuth2Credentials = JSON.parse(credentials);

			// Check if the original token is still valid
			const timeUntilExpiry = oauth2Creds.expiry_date - Date.now();
			if (timeUntilExpiry > TOKEN_BUFFER_TIME) {
				// Original token is still valid, cache it and use it
				this.accessToken = oauth2Creds.access_token;
				console.log(`Original token is valid for ${Math.floor(timeUntilExpiry / 1000)} more seconds`);

				// Cache the token in Redis
				await this.cacheTokenInRedis(oauth2Creds.access_token, oauth2Creds.expiry_date);
				return;
			}

			// Both original and cached tokens are expired, refresh the token
			console.log("All tokens expired, refreshing...");
			await this.refreshAndCacheToken(oauth2Creds.refresh_token);
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			console.error("Failed to initialize authentication:", e);
			throw new Error("Authentication failed: " + errorMessage);
		}
	}

	/**
	 * Refresh the OAuth token and cache it in Redis.
	 */
	private async refreshAndCacheToken(refreshToken: string): Promise<void> {
		console.log("Refreshing OAuth token...");

		const refreshResponse = await fetch(OAUTH_REFRESH_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				client_id: OAUTH_CLIENT_ID,
				client_secret: OAUTH_CLIENT_SECRET,
				refresh_token: refreshToken,
				grant_type: "refresh_token"
			})
		});

		if (!refreshResponse.ok) {
			const errorText = await refreshResponse.text();
			console.error("Token refresh failed:", errorText);
			throw new Error(`Token refresh failed: ${errorText}`);
		}

		const refreshData = (await refreshResponse.json()) as TokenRefreshResponse;
		this.accessToken = refreshData.access_token;

		// Calculate expiry time (typically 1 hour from now)
		const expiryTime = Date.now() + refreshData.expires_in * 1000;

		console.log("Token refreshed successfully");
		console.log(`New token expires in ${refreshData.expires_in} seconds`);

		// Cache the new token in Redis
		await this.cacheTokenInRedis(refreshData.access_token, expiryTime);
	}

	/**
	 * Cache the access token in Redis.
	 */
	private async cacheTokenInRedis(accessToken: string, expiryDate: number): Promise<void> {
		try {
			const tokenData = {
				access_token: accessToken,
				expiry_date: expiryDate,
				cached_at: Date.now()
			};

			// Cache for slightly less than the token expiry to be safe
			const ttlSeconds = Math.floor((expiryDate - Date.now()) / 1000) - 300; // 5 minutes buffer

			if (ttlSeconds > 0) {
				const redis = await this.initRedis();
				await redis.setEx(KV_TOKEN_KEY, ttlSeconds, JSON.stringify(tokenData));
				console.log(`Token cached in Redis with TTL of ${ttlSeconds} seconds`);
			} else {
				console.log("Token expires too soon, not caching in Redis");
			}
		} catch (redisError) {
			console.error("Failed to cache token in Redis:", redisError);
			// Don't throw an error here as the token is still valid, just not cached
		}
	}

	/**
	 * Clear cached token from Redis.
	 */
	public async clearTokenCache(): Promise<void> {
		try {
			const redis = await this.initRedis();
			await redis.del(KV_TOKEN_KEY);
			console.log("Cleared cached token from Redis");
		} catch (redisError) {
			console.log("Error clearing Redis cache:", redisError);
		}
	}

	/**
	 * Get cached token info from Redis.
	 */
	public async getCachedTokenInfo(): Promise<TokenCacheInfo> {
		try {
			const redis = await this.initRedis();
			const cachedToken = await redis.get(KV_TOKEN_KEY);
			if (cachedToken) {
				const tokenData = JSON.parse(cachedToken) as CachedTokenData;
				const timeUntilExpiry = tokenData.expiry_date - Date.now();

				return {
					cached: true,
					cached_at: new Date(tokenData.cached_at).toISOString(),
					expires_at: new Date(tokenData.expiry_date).toISOString(),
					time_until_expiry_seconds: Math.floor(timeUntilExpiry / 1000),
					is_expired: timeUntilExpiry < 0
					// Removed token_preview for security
				};
			}
			return { cached: false, message: "No token found in cache" };
		} catch (e: unknown) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			return { cached: false, error: errorMessage };
		}
	}

	/**
	 * A generic method to call a Code Assist API endpoint.
	 */
	public async callEndpoint(method: string, body: Record<string, unknown>, isRetry: boolean = false): Promise<unknown> {
		await this.initializeAuth();

		const response = await fetch(`${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.accessToken}`
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			if (response.status === 401 && !isRetry) {
				console.log("Got 401 error, clearing token cache and retrying...");
				this.accessToken = null; // Clear cached token
				await this.clearTokenCache(); // Clear Redis cache
				await this.initializeAuth(); // This will refresh the token
				return this.callEndpoint(method, body, true); // Retry once
			}
			const errorText = await response.text();
			throw new Error(`API call failed with status ${response.status}: ${errorText}`);
		}

		return response.json();
	}

	/**
	 * Get the current access token.
	 */
	public getAccessToken(): string | null {
		return this.accessToken;
	}
}
