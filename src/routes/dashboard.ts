import { Hono } from 'hono';
import { dashboardAuth } from '../middlewares/dashboard-auth';
import * as fs from 'fs';
import * as path from 'path';

const app = new Hono();

/**
 * Dashboard login page
 */
app.get('/login', dashboardAuth.redirectIfAuthenticated, async (c) => {
    try {
        const loginPath = path.join(process.cwd(), 'public', 'dashboard', 'login.html');
        const html = fs.readFileSync(loginPath, 'utf-8');
        return c.html(html);
    } catch (error) {
        console.error('Failed to serve login page:', error);
        return c.text('Login page not found', 404);
    }
});

/**
 * Dashboard main page
 */
app.get('/', dashboardAuth.requireAuth, async (c) => {
    try {
        const dashboardPath = path.join(process.cwd(), 'public', 'dashboard', 'index.html');
        const html = fs.readFileSync(dashboardPath, 'utf-8');
        return c.html(html);
    } catch (error) {
        console.error('Failed to serve dashboard page:', error);
        return c.text('Dashboard page not found', 404);
    }
});

/**
 * Serve dashboard CSS
 */
app.get('/styles.css', async (c) => {
    try {
        const cssPath = path.join(process.cwd(), 'public', 'dashboard', 'styles.css');
        const css = fs.readFileSync(cssPath, 'utf-8');
        c.header('Content-Type', 'text/css');
        return c.body(css);
    } catch (error) {
        console.error('Failed to serve dashboard CSS:', error);
        return c.text('CSS not found', 404);
    }
});

/**
 * Serve dashboard JavaScript
 */
app.get('/script.js', async (c) => {
    try {
        const jsPath = path.join(process.cwd(), 'public', 'dashboard', 'script.js');
        const js = fs.readFileSync(jsPath, 'utf-8');
        c.header('Content-Type', 'application/javascript');
        return c.body(js);
    } catch (error) {
        console.error('Failed to serve dashboard JavaScript:', error);
        return c.text('JavaScript not found', 404);
    }
});

export { app as DashboardRoute };