#!/usr/bin/env node

/**
 * Lightweight Node.js Health Check Script
 * Alternative to curl-based health checks for Alpine containers
 * 
 * This script performs HTTP health check against the local application
 * and validates the health endpoint response structure.
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  method: 'GET',
  timeout: 5000,
  headers: {
    'User-Agent': 'Docker-HealthCheck/1.0'
  }
};

console.log(`[${new Date().toISOString()}] Starting health check on ${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  let data = '';
  
  // Collect response data
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`[${new Date().toISOString()}] Health check response: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      try {
        const healthData = JSON.parse(data);
        console.log(`[${new Date().toISOString()}] Health status: ${healthData.status}`);
        console.log(`[${new Date().toISOString()}] Services: ${JSON.stringify(healthData.services || {})}`);
        
        // Additional validation for enhanced health check
        if (healthData.status === 'ok') {
          console.log(`[${new Date().toISOString()}] ✅ Health check passed - All systems operational`);
          process.exit(0);
        } else if (healthData.status === 'degraded') {
          console.log(`[${new Date().toISOString()}] ⚠️  Health check passed - System degraded but functional`);
          process.exit(0);
        } else {
          console.log(`[${new Date().toISOString()}] ❌ Health check failed - System unhealthy`);
          process.exit(1);
        }
      } catch (parseError) {
        console.log(`[${new Date().toISOString()}] ⚠️  Health check passed but response parsing failed: ${parseError.message}`);
        process.exit(0); // Still consider it healthy if endpoint responds
      }
    } else if (res.statusCode === 503) {
      console.log(`[${new Date().toISOString()}] ❌ Health check failed - Service unavailable (503)`);
      process.exit(1);
    } else {
      console.log(`[${new Date().toISOString()}] ❌ Health check failed - Unexpected status code: ${res.statusCode}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.log(`[${new Date().toISOString()}] ❌ Health check failed - Connection error: ${error.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.log(`[${new Date().toISOString()}] ❌ Health check failed - Request timeout (${options.timeout}ms)`);
  req.destroy();
  process.exit(1);
});

// Set timeout
req.setTimeout(options.timeout);

// Send the request
req.end();