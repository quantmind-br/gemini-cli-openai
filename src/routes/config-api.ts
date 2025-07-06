import { Hono } from 'hono';
import { ConfigManager } from '../utils/config-manager';
import { dashboardAuth } from '../middlewares/dashboard-auth';
import { DashboardConfig } from '../types';

const app = new Hono();
const configManager = new ConfigManager();

// Apply authentication middleware to all config API routes
app.use('*', dashboardAuth.requireAuth);

/**
 * GET /api/config - Get current configuration
 */
app.get('/', async (c) => {
	try {
		const config = configManager.readConfig();
		const fields = configManager.getConfigFields();
		
		// Don't send sensitive values in full (mask them)
		const sanitizedConfig = { ...config };
		if (sanitizedConfig.GCP_SERVICE_ACCOUNT) {
			sanitizedConfig.GCP_SERVICE_ACCOUNT = '[CONFIGURED]';
		}
		if (sanitizedConfig.OPENAI_API_KEY) {
			sanitizedConfig.OPENAI_API_KEY = '[CONFIGURED]';
		}

		return c.json({
			config: sanitizedConfig,
			fields,
			success: true
		});
	} catch (error) {
		console.error('Failed to read configuration:', error);
		return c.json({ error: 'Failed to read configuration' }, 500);
	}
});

/**
 * POST /api/config - Update configuration
 */
app.post('/', async (c) => {
	try {
		const body = await c.req.json();
		const config = body.config as DashboardConfig;

		if (!config) {
			return c.json({ error: 'Configuration data is required' }, 400);
		}

		// Validate configuration
		const validation = configManager.validateConfig(config);
		if (!validation.isValid) {
			return c.json({ 
				error: 'Configuration validation failed', 
				details: validation.errors 
			}, 400);
		}

		// Read current config to merge with new values
		const currentConfig = configManager.readConfig();
		const mergedConfig = { ...currentConfig };

		// Update only the fields that were provided
		for (const [key, value] of Object.entries(config)) {
			if (value !== undefined && value !== '') {
				mergedConfig[key as keyof DashboardConfig] = value;
			} else if (value === '') {
				// Empty string means remove the field
				delete mergedConfig[key as keyof DashboardConfig];
			}
		}

		// Write the updated configuration
		configManager.writeConfig(mergedConfig);

		return c.json({ 
			success: true, 
			message: 'Configuration updated successfully' 
		});
	} catch (error) {
		console.error('Failed to update configuration:', error);
		return c.json({ error: 'Failed to update configuration' }, 500);
	}
});

/**
 * POST /api/config/upload - Upload GCP credentials file
 */
app.post('/upload', async (c) => {
	try {
		const body = await c.req.parseBody();
		const file = body.file as File;

		if (!file) {
			return c.json({ error: 'No file provided' }, 400);
		}

		// Validate file type
		if (!file.name.endsWith('.json')) {
			return c.json({ error: 'File must be a JSON file' }, 400);
		}

		// Read file content
		const fileContent = await file.text();

		// Validate JSON format
		let credentials;
		try {
			credentials = JSON.parse(fileContent);
		} catch {
			return c.json({ error: 'Invalid JSON file' }, 400);
		}

		// Validate OAuth2 credentials structure
		if (!credentials.access_token || !credentials.refresh_token) {
			return c.json({ 
				error: 'Invalid OAuth2 credentials. File must contain access_token and refresh_token' 
			}, 400);
		}

		// Update configuration with the uploaded credentials
		const currentConfig = configManager.readConfig();
		currentConfig.GCP_SERVICE_ACCOUNT = fileContent;
		
		configManager.writeConfig(currentConfig);

		return c.json({ 
			success: true, 
			message: 'GCP credentials uploaded successfully' 
		});
	} catch (error) {
		console.error('Failed to upload credentials:', error);
		return c.json({ error: 'Failed to upload credentials' }, 500);
	}
});

/**
 * GET /api/config/status - Get configuration status
 */
app.get('/status', async (c) => {
	try {
		const config = configManager.readConfig();
		const fields = configManager.getConfigFields();
		
		// Check which required fields are configured
		const status = {
			configured: {} as Record<string, boolean>,
			validation: configManager.validateConfig(config)
		};

		for (const field of fields) {
			const value = config[field.key];
			status.configured[field.key] = !!(value && value.trim());
		}

		return c.json({
			status,
			success: true
		});
	} catch (error) {
		console.error('Failed to get configuration status:', error);
		return c.json({ error: 'Failed to get configuration status' }, 500);
	}
});

/**
 * DELETE /api/config/:key - Remove a configuration key
 */
app.delete('/:key', async (c) => {
	try {
		const key = c.req.param('key') as keyof DashboardConfig;
		
		if (!key) {
			return c.json({ error: 'Configuration key is required' }, 400);
		}

		const config = configManager.readConfig();
		
		if (!(key in config)) {
			return c.json({ error: 'Configuration key not found' }, 404);
		}

		// Remove the key
		delete config[key];
		
		// Write updated configuration
		configManager.writeConfig(config);

		return c.json({ 
			success: true, 
			message: `Configuration key '${key}' removed successfully` 
		});
	} catch (error) {
		console.error('Failed to remove configuration key:', error);
		return c.json({ error: 'Failed to remove configuration key' }, 500);
	}
});

/**
 * POST /api/config/test - Test configuration
 */
app.post('/test', async (c) => {
	try {
		const config = configManager.readConfig();
		const validation = configManager.validateConfig(config);

		// Additional runtime tests
		const tests = {
			validation: validation.isValid,
			gcpCredentials: false,
			redisConnection: false,
			port: false
		};

		// Test GCP credentials
		if (config.GCP_SERVICE_ACCOUNT) {
			try {
				const credentials = JSON.parse(config.GCP_SERVICE_ACCOUNT);
				tests.gcpCredentials = !!(credentials.access_token && credentials.refresh_token);
			} catch {
				tests.gcpCredentials = false;
			}
		}

		// Test port
		if (config.PORT) {
			const port = Number(config.PORT);
			tests.port = !isNaN(port) && port > 0 && port < 65536;
		} else {
			tests.port = true; // Default port is fine
		}

		// Note: Redis connection test would require actual connection attempt
		// For now, just validate URL format
		if (config.REDIS_URL) {
			tests.redisConnection = config.REDIS_URL.startsWith('redis://');
		} else {
			tests.redisConnection = true; // Default Redis is fine
		}

		return c.json({
			tests,
			validation,
			success: true
		});
	} catch (error) {
		console.error('Failed to test configuration:', error);
		return c.json({ error: 'Failed to test configuration' }, 500);
	}
});

export { app as ConfigApiRoute };