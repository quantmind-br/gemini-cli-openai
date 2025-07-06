import { Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { createHash } from 'crypto';

export interface DashboardSession {
	authenticated: boolean;
	timestamp: number;
}

export class DashboardAuth {
	private sessions: Map<string, DashboardSession> = new Map();
	private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

	/**
	 * Authenticate user with username and password
	 */
	authenticate(username: string, password: string): boolean {
		const expectedUsername = process.env.DASHBOARD_USERNAME;
		const expectedPassword = process.env.DASHBOARD_PASSWORD;

		if (!expectedUsername || !expectedPassword) {
			console.warn('Dashboard authentication not configured - DASHBOARD_USERNAME and DASHBOARD_PASSWORD required');
			return false;
		}

		return username === expectedUsername && password === expectedPassword;
	}

	/**
	 * Create a new session for authenticated user
	 */
	createSession(): string {
		const sessionId = this.generateSessionId();
		this.sessions.set(sessionId, {
			authenticated: true,
			timestamp: Date.now()
		});

		// Clean up old sessions
		this.cleanupSessions();

		return sessionId;
	}

	/**
	 * Validate session by session ID
	 */
	validateSession(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return false;
		}

		// Check if session has expired
		if (Date.now() - session.timestamp > this.sessionTimeout) {
			this.sessions.delete(sessionId);
			return false;
		}

		// Update timestamp to extend session
		session.timestamp = Date.now();
		return session.authenticated;
	}

	/**
	 * Destroy session
	 */
	destroySession(sessionId: string): void {
		this.sessions.delete(sessionId);
	}

	/**
	 * Middleware to protect dashboard routes
	 */
	requireAuth = async (c: Context, next: Next) => {
		const sessionId = getCookie(c, 'dashboard_session');
		
		if (!sessionId || !this.validateSession(sessionId)) {
			// Not authenticated, redirect to login
			if (c.req.method === 'GET') {
				return c.redirect('/dashboard/login');
			} else {
				return c.json({ error: 'Authentication required' }, 401);
			}
		}

		await next();
	};

	/**
	 * Middleware to check if user is already authenticated
	 */
	redirectIfAuthenticated = async (c: Context, next: Next) => {
		const sessionId = getCookie(c, 'dashboard_session');
		
		if (sessionId && this.validateSession(sessionId)) {
			// Already authenticated, redirect to dashboard
			return c.redirect('/dashboard');
		}

		await next();
	};

	/**
	 * Handle login form submission
	 */
	handleLogin = async (c: Context) => {
		try {
			const body = await c.req.parseBody();
			const username = body.username as string;
			const password = body.password as string;

			console.log('[Dashboard Auth] Login attempt:', {
				username: username || '[MISSING]',
				password: password ? '[PROVIDED]' : '[MISSING]',
				expectedUsername: process.env.DASHBOARD_USERNAME || '[NOT_SET]',
				expectedPassword: process.env.DASHBOARD_PASSWORD ? '[SET]' : '[NOT_SET]'
			});

			if (!username || !password) {
				console.log('[Dashboard Auth] Missing credentials');
				return c.json({ error: 'Username and password are required' }, 400);
			}

			if (this.authenticate(username, password)) {
				const sessionId = this.createSession();
				console.log('[Dashboard Auth] Login successful, creating session:', sessionId);
				
				setCookie(c, 'dashboard_session', sessionId, {
					httpOnly: true,
					secure: false, // Set to true in production with HTTPS
					sameSite: 'Lax',
					maxAge: this.sessionTimeout / 1000
				});

				return c.json({ success: true, redirect: '/dashboard' });
			} else {
				console.log('[Dashboard Auth] Authentication failed');
				return c.json({ error: 'Invalid credentials' }, 401);
			}
		} catch (error) {
			console.error('[Dashboard Auth] Login error:', error);
			return c.json({ error: 'Login failed' }, 500);
		}
	};

	/**
	 * Handle logout
	 */
	handleLogout = async (c: Context) => {
		const sessionId = getCookie(c, 'dashboard_session');
		if (sessionId) {
			this.destroySession(sessionId);
		}

		setCookie(c, 'dashboard_session', '', {
			httpOnly: true,
			secure: false,
			sameSite: 'Lax',
			maxAge: 0
		});

		return c.json({ success: true, redirect: '/dashboard/login' });
	};

	/**
	 * Generate a secure session ID
	 */
	private generateSessionId(): string {
		const timestamp = Date.now().toString();
		const random = Math.random().toString(36).substring(2);
		const combined = timestamp + random;
		return createHash('sha256').update(combined).digest('hex');
	}

	/**
	 * Clean up expired sessions
	 */
	private cleanupSessions(): void {
		const now = Date.now();
		for (const [sessionId, session] of this.sessions.entries()) {
			if (now - session.timestamp > this.sessionTimeout) {
				this.sessions.delete(sessionId);
			}
		}
	}
}

// Export singleton instance
export const dashboardAuth = new DashboardAuth();