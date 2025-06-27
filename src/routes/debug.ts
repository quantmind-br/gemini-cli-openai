import { Hono } from 'hono';
import { Env } from '../types';
import { AuthManager } from '../auth';
import { GeminiApiClient } from '../gemini-client';

/**
 * Debug and testing routes for troubleshooting authentication and API functionality.
 */
export const DebugRoute = new Hono<{ Bindings: Env }>();

// Check KV cache status
DebugRoute.get('/cache', async (c) => {
    try {
        const authManager = new AuthManager(c.env);
        const cacheInfo = await authManager.getCachedTokenInfo();
        
        return c.json({
            status: 'ok',
            ...cacheInfo
        });
    } catch (e: any) {
        return c.json({
            status: 'error',
            message: e.message
        }, 500);
    }
});

// Simple token test endpoint
DebugRoute.post('/token-test', async (c) => {
    try {
        console.log('Token test endpoint called');
        const authManager = new AuthManager(c.env);
        
        // Test authentication only
        await authManager.initializeAuth();
        console.log('Token test passed');
        
        return c.json({ 
            status: 'ok', 
            message: 'Token authentication successful'
        });
    } catch (e: any) {
        console.error('Token test error:', e);
        return c.json({ 
            status: 'error', 
            message: e.message,
            stack: e.stack 
        }, 500);
    }
});

// Full functionality test endpoint
DebugRoute.post('/test', async (c) => {
    try {
        console.log('Test endpoint called');
        const authManager = new AuthManager(c.env);
        const geminiClient = new GeminiApiClient(c.env, authManager);
        
        // Test authentication
        await authManager.initializeAuth();
        console.log('Auth test passed');
        
        // Test project discovery
        const projectId = await geminiClient.discoverProjectId();
        console.log('Project discovery test passed:', projectId);
        
        return c.json({ 
            status: 'ok', 
            message: 'Authentication and project discovery successful',
            projectId: projectId
        });
    } catch (e: any) {
        console.error('Test endpoint error:', e);
        return c.json({ 
            status: 'error', 
            message: e.message,
            stack: e.stack 
        }, 500);
    }
});
