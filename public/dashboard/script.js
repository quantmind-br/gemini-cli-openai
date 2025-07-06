// Dashboard JavaScript

class Dashboard {
    constructor() {
        this.config = {};
        this.fields = [];
        this.init();
    }

    async init() {
        await this.loadConfiguration();
        this.setupEventListeners();
        this.updateStatusCards();
    }

    async loadConfiguration() {
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            
            if (data.success) {
                this.config = data.config;
                this.fields = data.fields;
                this.populateForm();
            } else {
                this.showNotification('Failed to load configuration', 'error');
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
            this.showNotification('Failed to load configuration', 'error');
        }
    }

    populateForm() {
        // Populate text inputs
        for (const [key, value] of Object.entries(this.config)) {
            const input = document.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value === 'true';
                } else if (input.type !== 'password') {
                    input.value = value === '[CONFIGURED]' ? '' : value;
                }
            }
        }

        // Special handling for password fields
        const apiKeyInput = document.querySelector('[name="OPENAI_API_KEY"]');
        if (apiKeyInput && this.config.OPENAI_API_KEY === '[CONFIGURED]') {
            apiKeyInput.placeholder = 'Current: [CONFIGURED] - Leave blank to keep current';
        }

        // Special handling for GCP credentials
        const gcpUpload = document.getElementById('gcp-upload');
        const fileLabel = document.querySelector('[for="gcp-upload"] .file-text');
        if (this.config.GCP_SERVICE_ACCOUNT === '[CONFIGURED]') {
            fileLabel.textContent = 'Current: [CONFIGURED] - Upload new file to replace';
        }
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConfiguration();
        });

        // Test button
        document.getElementById('testBtn').addEventListener('click', () => {
            this.testConfiguration();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // File upload
        document.getElementById('gcp-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        // Drag and drop for file upload
        const fileLabel = document.querySelector('.file-label');
        fileLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#667eea';
            fileLabel.style.backgroundColor = '#f8f9fa';
        });

        fileLabel.addEventListener('dragleave', () => {
            fileLabel.style.borderColor = '#e9ecef';
            fileLabel.style.backgroundColor = '';
        });

        fileLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = '#e9ecef';
            fileLabel.style.backgroundColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        if (!file.name.endsWith('.json')) {
            this.showNotification('Please upload a JSON file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/config/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.showNotification('GCP credentials uploaded successfully', 'success');
                const fileLabel = document.querySelector('[for="gcp-upload"] .file-text');
                fileLabel.textContent = `Uploaded: ${file.name}`;
                await this.loadConfiguration();
                this.updateStatusCards();
            } else {
                this.showNotification(result.error || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            this.showNotification('Upload failed', 'error');
        }
    }

    async saveConfiguration() {
        const formData = new FormData(document.getElementById('configForm'));
        const config = {};

        // Process form data
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('ENABLE_') || key.startsWith('STREAM_')) {
                // Boolean fields
                config[key] = 'true';
            } else if (value.trim()) {
                // Text fields - only include if not empty
                config[key] = value.trim();
            }
        }

        // Handle unchecked checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                config[checkbox.name] = 'false';
            }
        });

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ config })
            });

            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Configuration saved successfully', 'success');
                await this.loadConfiguration();
                this.updateStatusCards();
            } else {
                this.showNotification(result.error || 'Save failed', 'error');
                if (result.details) {
                    console.error('Validation errors:', result.details);
                }
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showNotification('Save failed', 'error');
        }
    }

    async testConfiguration() {
        try {
            const response = await fetch('/api/config/test', {
                method: 'POST'
            });

            const result = await response.json();
            
            if (result.success) {
                this.displayTestResults(result.tests, result.validation);
                document.getElementById('testSection').style.display = 'block';
                document.getElementById('testSection').scrollIntoView({ behavior: 'smooth' });
            } else {
                this.showNotification('Test failed', 'error');
            }
        } catch (error) {
            console.error('Test failed:', error);
            this.showNotification('Test failed', 'error');
        }
    }

    displayTestResults(tests, validation) {
        const container = document.getElementById('testResults');
        container.innerHTML = '';

        // Validation results
        const validationDiv = document.createElement('div');
        validationDiv.className = `test-result ${validation.isValid ? 'pass' : 'fail'}`;
        validationDiv.innerHTML = `
            <h4>Configuration Validation</h4>
            <p>${validation.isValid ? 'All validations passed' : 'Validation errors found'}</p>
            ${validation.errors ? validation.errors.map(error => `<p>• ${error}</p>`).join('') : ''}
        `;
        container.appendChild(validationDiv);

        // Individual test results
        const testNames = {
            gcpCredentials: 'GCP Credentials',
            redisConnection: 'Redis Connection',
            port: 'Port Configuration'
        };

        for (const [testName, testResult] of Object.entries(tests)) {
            if (testName === 'validation') continue;
            
            const testDiv = document.createElement('div');
            testDiv.className = `test-result ${testResult ? 'pass' : 'fail'}`;
            testDiv.innerHTML = `
                <h4>${testNames[testName] || testName}</h4>
                <p>${testResult ? 'Test passed' : 'Test failed'}</p>
            `;
            container.appendChild(testDiv);
        }
    }

    updateStatusCards() {
        const container = document.getElementById('statusCards');
        container.innerHTML = '';

        this.fields.forEach(field => {
            const isConfigured = this.config[field.key] && this.config[field.key] !== '';
            const card = document.createElement('div');
            
            let statusClass = '';
            let statusText = '';
            
            if (field.required) {
                statusClass = isConfigured ? 'configured' : 'not-configured';
                statusText = isConfigured ? 'Configured' : 'Not Configured';
            } else {
                statusClass = isConfigured ? 'configured' : 'optional';
                statusText = isConfigured ? 'Configured' : 'Optional';
            }

            card.className = `status-card ${statusClass}`;
            card.innerHTML = `
                <h3>${field.label}</h3>
                <p>${statusText}</p>
            `;
            container.appendChild(card);
        });
    }

    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST'
            });

            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Logged out successfully', 'success');
                setTimeout(() => {
                    window.location.href = result.redirect || '/dashboard/login';
                }, 1000);
            } else {
                this.showNotification('Logout failed', 'error');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            this.showNotification('Logout failed', 'error');
        }
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});