import { Hono } from 'hono';
import { dashboardAuth } from '../middlewares/dashboard-auth';

const app = new Hono();

/**
 * POST /api/auth/login - Handle login form submission
 */
app.post('/login', dashboardAuth.handleLogin);

/**
 * POST /api/auth/logout - Handle logout
 */
app.post('/logout', dashboardAuth.handleLogout);

/**
 * GET /api/auth/status - Check authentication status
 */
app.get('/status', async (c) => {
    const sessionId = c.req.header('X-Session-ID');
    const isAuthenticated = sessionId ? dashboardAuth.validateSession(sessionId) : false;
    
    return c.json({
        authenticated: isAuthenticated,
        timestamp: new Date().toISOString()
    });
});

export { app as AuthRoute };