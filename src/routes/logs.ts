import { Hono } from 'hono';
import { logBuffer, LogCategory } from '../utils/logger';
import { dashboardAuth } from '../middlewares/dashboard-auth';

const app = new Hono();

// Apply authentication middleware to all log routes
app.use('*', dashboardAuth.requireAuth);

/**
 * GET /logs - Get recent logs with optional filtering
 */
app.get('/', async (c) => {
	try {
		const url = new URL(c.req.url);
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const level = url.searchParams.get('level') || undefined;
		const category = url.searchParams.get('category') as LogCategory || undefined;
		const search = url.searchParams.get('search') || undefined;
		const since = url.searchParams.get('since') ? new Date(url.searchParams.get('since')!) : undefined;

		const logs = logBuffer.filter({
			level,
			category,
			search,
			since
		}).slice(0, limit);

		return c.json({
			logs,
			count: logs.length,
			filters: { level, category, search, since: since?.toISOString() },
			success: true
		});
	} catch (error) {
		console.error('Failed to fetch logs:', error);
		return c.json({ error: 'Failed to fetch logs' }, 500);
	}
});

/**
 * GET /logs/categories - Get available log categories
 */
app.get('/categories', async (c) => {
	try {
		const categories = Object.values(LogCategory);
		return c.json({
			categories,
			success: true
		});
	} catch (error) {
		console.error('Failed to fetch log categories:', error);
		return c.json({ error: 'Failed to fetch log categories' }, 500);
	}
});

/**
 * GET /logs/levels - Get available log levels
 */
app.get('/levels', async (c) => {
	try {
		const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
		return c.json({
			levels,
			success: true
		});
	} catch (error) {
		console.error('Failed to fetch log levels:', error);
		return c.json({ error: 'Failed to fetch log levels' }, 500);
	}
});

/**
 * GET /logs/stats - Get logging statistics
 */
app.get('/stats', async (c) => {
	try {
		const recentLogs = logBuffer.getRecent(1000);
		
		// Calculate statistics
		const stats = {
			total: recentLogs.length,
			byLevel: {} as Record<string, number>,
			byCategory: {} as Record<string, number>,
			recentErrors: recentLogs.filter(log => log.level === 'error').length,
			avgResponseTime: 0
		};

		// Count by level and category
		recentLogs.forEach(log => {
			stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
			stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
		});

		// Calculate average response time for HTTP requests
		const httpLogs = recentLogs.filter(log => 
			log.category === LogCategory.HTTP && log.res?.responseTime
		);
		
		if (httpLogs.length > 0) {
			const totalResponseTime = httpLogs.reduce((sum, log) => 
				sum + (log.res?.responseTime || 0), 0
			);
			stats.avgResponseTime = Math.round(totalResponseTime / httpLogs.length);
		}

		return c.json({
			stats,
			success: true
		});
	} catch (error) {
		console.error('Failed to fetch log stats:', error);
		return c.json({ error: 'Failed to fetch log stats' }, 500);
	}
});

/**
 * DELETE /logs - Clear log buffer (for testing/maintenance)
 */
app.delete('/', async (c) => {
	try {
		// Clear the log buffer using public method
		// Note: This only clears in-memory logs, not file logs
		logBuffer.clear();
		
		return c.json({
			message: 'Log buffer cleared successfully',
			success: true
		});
	} catch (error) {
		console.error('Failed to clear logs:', error);
		return c.json({ error: 'Failed to clear logs' }, 500);
	}
});

export { app as LogsRoute };