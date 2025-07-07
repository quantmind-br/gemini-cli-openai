import * as fs from 'fs';
import * as path from 'path';
import { DashboardConfig, ConfigField } from '../types';

export class ConfigManager {
	private envPath: string;

	constructor(envPath: string = './data/.env') {
		this.envPath = path.resolve(envPath);
	}

	/**
	 * Read current configuration from .env file
	 */
	readConfig(): DashboardConfig {
		const config: DashboardConfig = {};
		
		if (!fs.existsSync(this.envPath)) {
			return config;
		}

		const content = fs.readFileSync(this.envPath, 'utf-8');
		const lines = content.split('\n');

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=');
				const value = valueParts.join('=');
				
				if (key && value) {
					const cleanKey = key.trim() as keyof DashboardConfig;
					let cleanValue = value.trim();
					
					// Remove quotes if present
					if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
						(cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
						cleanValue = cleanValue.slice(1, -1);
					}
					
					config[cleanKey] = cleanValue;
				}
			}
		}

		return config;
	}

	/**
	 * Write configuration to .env file
	 */
	writeConfig(config: DashboardConfig): void {
		let content = '';
		
		// Read existing content to preserve comments and structure
		if (fs.existsSync(this.envPath)) {
			const existingContent = fs.readFileSync(this.envPath, 'utf-8');
			const lines = existingContent.split('\n');
			const processedKeys = new Set<string>();
			
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed && !trimmed.startsWith('#')) {
					const [key] = trimmed.split('=');
					if (key && key.trim() in config) {
						const configKey = key.trim() as keyof DashboardConfig;
						const value = config[configKey];
						if (value !== undefined) {
							// Handle value quoting properly
							const quotedValue = this.formatEnvValue(value);
							content += `${key.trim()}=${quotedValue}\n`;
							processedKeys.add(key.trim());
						} else {
							// Keep the line as-is if value is undefined (to preserve structure)
							content += line + '\n';
						}
					} else {
						// Keep non-config lines as-is
						content += line + '\n';
					}
				} else {
					// Keep comments and empty lines
					content += line + '\n';
				}
			}
			
			// Add any new config keys that weren't in the existing file
			for (const [key, value] of Object.entries(config)) {
				if (!processedKeys.has(key) && value !== undefined) {
					const quotedValue = this.formatEnvValue(value);
					content += `${key}=${quotedValue}\n`;
				}
			}
		} else {
			// Create new .env file
			content = this.generateNewEnvContent(config);
		}

		fs.writeFileSync(this.envPath, content, 'utf-8');
	}

	/**
	 * Validate configuration values
	 */
	validateConfig(config: DashboardConfig): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];
		
		// Validate GCP_SERVICE_ACCOUNT JSON format
		if (config.GCP_SERVICE_ACCOUNT) {
			try {
				const parsed = JSON.parse(config.GCP_SERVICE_ACCOUNT);
				if (!parsed.access_token || !parsed.refresh_token) {
					errors.push('GCP_SERVICE_ACCOUNT must contain valid OAuth2 credentials with access_token and refresh_token');
				}
			} catch {
				errors.push('GCP_SERVICE_ACCOUNT must be valid JSON');
			}
		}

		// Validate boolean fields
		const booleanFields = ['ENABLE_FAKE_THINKING', 'ENABLE_REAL_THINKING', 'STREAM_THINKING_AS_CONTENT'];
		for (const field of booleanFields) {
			const value = config[field as keyof DashboardConfig];
			if (value && !['true', 'false'].includes(value.toLowerCase())) {
				errors.push(`${field} must be 'true' or 'false'`);
			}
		}

		// Validate dashboard credentials
		if (config.DASHBOARD_USERNAME && !config.DASHBOARD_PASSWORD) {
			errors.push('DASHBOARD_PASSWORD is required when DASHBOARD_USERNAME is set');
		}
		if (config.DASHBOARD_PASSWORD && !config.DASHBOARD_USERNAME) {
			errors.push('DASHBOARD_USERNAME is required when DASHBOARD_PASSWORD is set');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Get configuration field definitions
	 */
	getConfigFields(): ConfigField[] {
		return [
			{
				key: 'GCP_SERVICE_ACCOUNT',
				label: 'GCP Service Account',
				type: 'file',
				required: true,
				description: 'OAuth2 credentials JSON from Gemini CLI authentication',
				placeholder: 'Upload oauth_creds.json file'
			},
			{
				key: 'OPENAI_API_KEY',
				label: 'OpenAI API Key',
				type: 'password',
				required: false,
				description: 'Optional API key for authentication. If not set, API is public',
				placeholder: 'sk-your-secret-api-key-here'
			},
			{
				key: 'GEMINI_PROJECT_ID',
				label: 'Gemini Project ID',
				type: 'text',
				required: false,
				description: 'Google Cloud Project ID (auto-discovered if not set)',
				placeholder: 'your-project-id'
			},
			{
				key: 'ENABLE_FAKE_THINKING',
				label: 'Enable Fake Thinking',
				type: 'boolean',
				required: false,
				description: 'Enable synthetic thinking output for thinking models',
				placeholder: 'true'
			},
			{
				key: 'ENABLE_REAL_THINKING',
				label: 'Enable Real Thinking',
				type: 'boolean',
				required: false,
				description: 'Enable real Gemini thinking output with native reasoning',
				placeholder: 'true'
			},
			{
				key: 'STREAM_THINKING_AS_CONTENT',
				label: 'Stream Thinking as Content',
				type: 'boolean',
				required: false,
				description: 'Stream thinking as content with <thinking> tags (DeepSeek R1 style)',
				placeholder: 'true'
			}
		];
	}

	/**
	 * Format value for .env file with proper quoting
	 */
	private formatEnvValue(value: string): string {
		// Handle JSON values specially - compact and quote
		if (this.isJsonValue(value)) {
			try {
				// Parse and re-stringify to ensure single line, valid JSON
				const parsed = JSON.parse(value);
				const compactJson = JSON.stringify(parsed);
				return `'${compactJson}'`;
			} catch {
				// If parsing fails, just compact whitespace
				const compactJson = value.replace(/\s+/g, ' ').replace(/\n/g, '').trim();
				return `'${compactJson}'`;
			}
		}
		
		// For other values, quote if they contain spaces or special characters
		if (this.shouldQuoteValue(value)) {
			return `'${value}'`;
		}
		
		return value;
	}

	/**
	 * Check if a value is a JSON string
	 */
	private isJsonValue(value: string): boolean {
		return value.trim().startsWith('{') && value.trim().endsWith('}');
	}

	/**
	 * Check if a value should be quoted in the .env file
	 */
	private shouldQuoteValue(value: string): boolean {
		// Quote if contains spaces or special env characters
		return /[\s#$\\]/.test(value);
	}

	/**
	 * Generate new .env file content with comments
	 */
	private generateNewEnvContent(config: DashboardConfig): string {
		let content = '# Gemini CLI OpenAI Docker Environment Variables\n\n';

		// GCP Service Account
		if (config.GCP_SERVICE_ACCOUNT) {
			content += '# Required: OAuth2 credentials JSON from Gemini CLI authentication\n';
			content += '# IMPORTANT: This should be a single line with no line breaks.\n';
			const quotedValue = this.formatEnvValue(config.GCP_SERVICE_ACCOUNT);
			content += `GCP_SERVICE_ACCOUNT=${quotedValue}\n\n`;
		}

		// Project ID
		if (config.GEMINI_PROJECT_ID) {
			content += '# Optional: Google Cloud Project ID (auto-discovered if not set)\n';
			content += `GEMINI_PROJECT_ID=${config.GEMINI_PROJECT_ID}\n\n`;
		}

		// API Key
		if (config.OPENAI_API_KEY) {
			content += '# Optional: API key for authentication (if not set, API is public)\n';
			content += `OPENAI_API_KEY=${config.OPENAI_API_KEY}\n\n`;
		}

		// Thinking flags
		if (config.ENABLE_FAKE_THINKING) {
			content += '# Optional: Enable fake thinking output for thinking models\n';
			content += `ENABLE_FAKE_THINKING=${config.ENABLE_FAKE_THINKING}\n\n`;
		}

		if (config.ENABLE_REAL_THINKING) {
			content += '# Optional: Enable real Gemini thinking output\n';
			content += `ENABLE_REAL_THINKING=${config.ENABLE_REAL_THINKING}\n\n`;
		}

		if (config.STREAM_THINKING_AS_CONTENT) {
			content += '# Optional: Stream thinking as content with <thinking> tags\n';
			content += `STREAM_THINKING_AS_CONTENT=${config.STREAM_THINKING_AS_CONTENT}\n\n`;
		}

		// Dashboard credentials
		if (config.DASHBOARD_USERNAME) {
			content += '# Dashboard Authentication (required for web dashboard access)\n';
			content += '# Set these credentials to enable the configuration dashboard at /dashboard\n';
			content += `DASHBOARD_USERNAME=${config.DASHBOARD_USERNAME}\n`;
			if (config.DASHBOARD_PASSWORD) {
				content += `DASHBOARD_PASSWORD=${config.DASHBOARD_PASSWORD}\n`;
			}
			content += '\n';
		}

		return content;
	}
}