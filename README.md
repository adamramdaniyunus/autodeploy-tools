# AutoDeploy CLI

CLI tool for automatic deployment with git push - setup once, deploy forever!

## Overview

AutoDeploy CLI is a command-line tool for automatic deployment that makes the application deployment process incredibly easy. Developers only need to set it up once, and then deployments can be done with a simple command or even automatically on git push.

### Key Features

- **No SSH Required** - Everything is done automatically from the CLI
- **No Git PAT Setup** - Uses git repository directly
- **No Manual Installation** - Automatic server setup
- **Simple Deployment** - Deploy with one command or git push
- **Easy Domain & SSL** - Automatic Nginx and Let's Encrypt setup
- **Server Monitoring** - Status command to check server
- **Easy Rollback** - Return to previous version easily

### Supported Applications

- **Node.js** - Express, Next.js, NestJS, Koa, etc.
- **PHP** - Laravel, CodeIgniter, WordPress, Symfony, etc.
- **Laravel + React** - Full-stack monorepo with React frontend (Vite/Webpack)
- **Static** - HTML/CSS/JS, React (build), Vue (build), Angular (build)
- **Python** - Flask, Django, FastAPI

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

### Prerequisites

**Local Machine:**
- Node.js 16 or higher
- npm (comes with Node.js)
- Git installed and configured

**VPS/Server:**
- Ubuntu 20.04+ or Debian 10+ (recommended)
- SSH access with username and password
- Root access or user with sudo privileges
- Ports open: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### Install Globally

```bash
npm install -g autodeploy-cli
```

Verify installation:
```bash
autodeploy --version
autodeploy --help
```

### Install Locally in Project

```bash
npm install autodeploy-cli --save-dev
```

Use with npx:
```bash
npx autodeploy --help
```

Or add to package.json scripts:
```json
{
  "scripts": {
    "deploy": "autodeploy deploy",
    "status": "autodeploy status"
  }
}
```

---

## Quick Start

### 1. Initialize Configuration

Navigate to your project directory:
```bash
cd /path/to/your/project
```

Run init command:
```bash
autodeploy init
```

Answer the setup questions:
- Project name
- VPS IP Address
- VPS Username & Password
- Deploy path on server
- Git repository URL
- Domain name (optional)
- **Git authentication method** (PAT/SSH/None)
  - If PAT: Enter your GitHub Personal Access Token
  - If SSH: SSH key will be generated and displayed
- Application type (nodejs, php, static, python)
- Build command (optional)
- Start command (for Node.js/Python)
- Application port

**Note:** AutoDeploy will automatically setup Git credentials on your server so it can pull from private repositories.

### 2. Deploy Your Application

```bash
autodeploy deploy
```

### 3. Check Status

```bash
autodeploy status
```

### 4. Setup Git Hook (Optional)

For auto-deploy on git push:

```bash
cp node_modules/autodeploy-cli/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

Edit `.git/hooks/pre-push` and uncomment:
```bash
node_modules/.bin/autodeploy deploy || true
```

Now you can deploy with:
```bash
git push
```

---

## Commands

### `autodeploy init`

Initialize deployment configuration (one-time setup).

```bash
autodeploy init
```

Creates `deploy-config.yml` with all your settings.

### `autodeploy deploy`

Deploy application to server.

```bash
autodeploy deploy                    # Deploy default branch
autodeploy deploy --branch develop   # Deploy specific branch
```

### `autodeploy status`

Check server and deployment status.

```bash
autodeploy status
```

Shows:
- Server uptime, memory, disk usage
- Git branch and commit info
- Application status (for Node.js)
- SSL certificate expiry
- Recent deployment history

### `autodeploy rollback`

Rollback to previous deployment.

```bash
autodeploy rollback                  # Interactive selection
autodeploy rollback --version abc123 # Rollback to specific commit
```

### `autodeploy domain`

Manage domain and SSL configuration.

```bash
autodeploy domain --add example.com     # Add domain
autodeploy domain --remove example.com  # Remove domain
autodeploy domain --list                # List domains
```

SSL certificate automatically installed with Let's Encrypt.

### `autodeploy logs`

View deployment logs.

```bash
autodeploy logs                  # Last 50 lines
autodeploy logs --lines 100      # Last 100 lines
```

---

## Configuration

Configuration is stored in `deploy-config.yml`:

```yaml
project:
  name: my-app
  type: nodejs

server:
  host: 192.168.1.100
  username: root
  password: your-password
  port: 22
  deployPath: /var/www/html

git:
  repository: https://github.com/user/repo.git
  branch: main
  authMethod: pat  # pat, ssh, or none
  token: ghp_xxxxxxxxxxxxxxxxxxxx  # GitHub Personal Access Token (keep secret!)

build:
  command: npm run build
  startCommand: npm start
  port: 3000

domain: example.com
```

**Important:** The `deploy-config.yml` file is automatically added to `.gitignore` during initialization to prevent credentials from being committed to git. The `.autodeploy/` directory is also excluded.

If you need to manually add these entries:
```bash
echo "deploy-config.yml" >> .gitignore
echo ".autodeploy/" >> .gitignore
```

### Git Authentication

AutoDeploy supports three authentication methods:

1.  **Personal Access Token (PAT)** - Recommended
    -   Create token at: https://github.com/settings/tokens
    -   Select scope: `repo` (full control of private repositories)
    -   AutoDeploy will store it securely on server

2.  **SSH Key**
    -   AutoDeploy generates SSH key on server
    -   You add public key to GitHub manually
    -   More secure, no password storage

3.  **None**
    -   For public repositories
    -   Or if you want to setup credentials manually

---

## Examples

### Example 1: Deploy Node.js Express App

```bash
# Initialize
autodeploy init

# Configuration:
# - App type: nodejs
# - Start command: npm start
# - Port: 3000
# - Domain: api.example.com

# Deploy
autodeploy deploy

# Check status
autodeploy status
```

### Example 2: Deploy PHP Laravel App

```bash
# Initialize
autodeploy init

# Configuration:
# - App type: php
# - Build command: composer install --no-dev && php artisan migrate
# - Domain: app.example.com

# Deploy
autodeploy deploy
```

### Example 3: Deploy Static React App

```bash
# Initialize
autodeploy init

# Configuration:
# - App type: static
# - Build command: npm install && npm run build && cp -r build/* .
# - Domain: www.example.com

# Deploy
autodeploy deploy
```

### Example 4: Deploy Laravel + React Monorepo

```bash
# Initialize
autodeploy init

# Configuration:
# - App type: laravel-react
# - Frontend dir: resources/ts
# - Frontend build: npm run build
# - Composer install: yes
# - Laravel optimize: yes
# - Run migrations: no (safer to run manually)
# - Domain: app.example.com

# Deploy
autodeploy deploy

# This will automatically:
# 1. Pull latest code from git
# 2. Install npm dependencies
# 3. Build React app with Vite
# 4. Install composer dependencies
# 5. Run Laravel optimizations (config/route/view cache)
# 6. Reload PHP-FPM (auto-detects version)
```

**Typical Laravel + React Structure:**
```
my-app/
├── app/              # Laravel backend
├── resources/
│   ├── ts/          # React components (TypeScript)
│   └── views/
├── public/
│   └── build/       # Built React assets (auto-generated by Vite)
├── package.json     # Frontend dependencies
├── composer.json    # Backend dependencies
└── vite.config.js   # Vite configuration
```

### Example 5: Rollback After Error

```bash
# Check logs
autodeploy logs

# Rollback to previous version
autodeploy rollback

# Select version from list
# Verify
autodeploy status
```

### Example 6: Add Domain & SSL

```bash
# Add domain
autodeploy domain --add example.com

# Enter email for SSL certificate
# SSL automatically installed

# Verify
curl https://example.com
```

---

## Troubleshooting

### "Connection refused" during init

**Causes:**
- Incorrect VPS IP
- SSH port not open
- Firewall blocking SSH

**Solutions:**
```bash
# Test SSH manually
ssh username@vps-ip

# Check firewall
sudo ufw status
sudo ufw allow 22
```

### "Permission denied"

**Causes:**
- User doesn't have access to deploy path
- Need sudo privileges

**Solutions:**
- Use root user
- Or use user with sudo access
- Check deploy path permissions

### "SSL certificate failed"

**Causes:**
- Domain not pointing to VPS IP
- Ports 80/443 not open
- Another web server using port 80/443

**Solutions:**
```bash
# Check DNS
nslookup your-domain.com

# Check ports
sudo netstat -tuln | grep -E ':(80|443)'

# Open ports
sudo ufw allow 80
sudo ufw allow 443
```

### "Application not starting" (Node.js)

**Causes:**
- Dependencies not installed
- Incorrect start command
- Port already in use
- Syntax errors in code

**Solutions:**
```bash
# Check logs
autodeploy logs

# Verify locally first
npm install
npm start

# Check port usage
sudo lsof -i :3000
```

### "Build failed"

**Solutions:**
```bash
# Test build locally
npm run build

# Check build logs
autodeploy logs

# Verify all dependencies in package.json
```

---

## FAQ

### General Questions

**Q: Is it free?**  
A: Yes, AutoDeploy CLI is open source with MIT license. Free to use, modify, and distribute.

**Q: Who should use this tool?**  
A: Developers who want easy deployment, freelancers, startups/small teams, students learning web development.

**Q: How long does initial setup take?**  
A: Initial setup takes about 3-5 minutes. After that, deployments only take 30 seconds.

**Q: Is it safe to store passwords in the config file?**  
A: The `deploy-config.yml` file should be added to `.gitignore` to prevent it from being committed to git.

### Server Requirements

**Q: Which VPS providers are supported?**  
A: Ubuntu 20.04+, Debian 10+, CentOS 7+ (experimental).

**Q: Can I use shared hosting?**  
A: No. AutoDeploy requires SSH access and the ability to install software.

**Q: What are the minimum VPS specifications?**  
A: RAM: 512MB minimum (1GB recommended), Storage: 10GB minimum, CPU: 1 core minimum.

**Q: Do I need a domain?**  
A: No. Domain is optional. Without a domain, the application can be accessed via IP:PORT.

### Deployment

**Q: How long does deployment take?**  
A: Node.js app: 30-60 seconds, PHP app: 20-40 seconds, Static site: 10-20 seconds.

**Q: Does deployment cause downtime?**  
A: Node.js: PM2 performs zero-downtime restart. PHP: Minimal downtime (< 1 second). Static: No downtime.

**Q: What happens if deployment fails?**  
A: Errors are displayed in the terminal, the application keeps running with the previous version, and you can rollback if needed.

### Domain & SSL

**Q: Is SSL free?**  
A: Yes, using Let's Encrypt which is free.

**Q: How long is the SSL certificate valid?**  
A: 90 days. Auto-renewal is set up automatically by certbot.

**Q: Does the domain need to be pointing before setup?**  
A: Yes, for SSL certificate to succeed, the domain must already be pointing to the VPS IP.

### Advanced

**Q: Can I customize the build command?**  
A: Yes, during `autodeploy init` or by editing `deploy-config.yml`.

**Q: Can it integrate with CI/CD?**  
A: Yes, it can be called from CI/CD pipelines.

---

## Deployment Flow

```
1. Developer commits code
   git add .
   git commit -m "New feature"

2. Deploy command
   autodeploy deploy

3. CLI connects to server via SSH

4. Pull latest code from git

5. Install dependencies
   npm install / composer install

6. Run build command (if any)
   npm run build

7. Restart application
   PM2 restart / PHP-FPM reload

8. Save deployment history

9. Deployment complete
```

### Laravel + React Deployment Flow

```
1. Developer commits code
   git add .
   git commit -m "New feature"

2. Deploy command
   autodeploy deploy

3. CLI connects to server via SSH

4. Pull latest code from git

5. Install frontend dependencies
   npm install

6. Build React application
   npm run build (Vite)
   → Output to public/build/

7. Install backend dependencies
   composer install --no-dev --optimize-autoloader

8. Run Laravel optimizations
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache

9. Run migrations (if enabled)
   php artisan migrate

10. Reload PHP-FPM
    Auto-detect PHP version (8.1, 8.2, 8.3, etc.)
    systemctl reload php8.3-fpm

11. Save deployment history

12. Deployment complete
```

---

## Project Structure

```
deploy-tools/
├── bin/
│   └── cli.js                 # CLI entry point
├── src/
│   ├── commands/              # Command implementations
│   │   ├── init.js           # Setup wizard
│   │   ├── deploy.js         # Deployment logic
│   │   ├── status.js         # Server monitoring
│   │   ├── rollback.js       # Rollback functionality
│   │   ├── domain.js         # Domain & SSL management
│   │   └── logs.js           # Log viewer
│   └── utils/                 # Utility functions
│       ├── config.js         # Config file management
│       └── ssh.js            # SSH client wrapper
├── hooks/                     # Git hooks templates
│   ├── pre-push              # Auto-deploy on push
│   └── README.md
├── package.json
├── deploy-config.example.yml
└── README.md
```

---

## Contributing

Contributions are welcome! Here's how you can help:

### Development Setup

```bash
# Clone repository
git clone <repo-url>
cd deploy-tools

# Install dependencies
npm install

# Test CLI
node bin/cli.js --help
```

### Adding New Commands

1. Create new file in `src/commands/your-command.js`
2. Export async function
3. Register in `bin/cli.js`

### Code Style

- Use ES6+ modules
- Async/await for asynchronous operations
- Chalk for colored output
- Ora for spinners
- Inquirer for interactive prompts

### Pull Request Process

1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Ideas for Contribution

- Add SSH key authentication support
- Add automated tests
- Support for Docker deployments
- Database migration support
- Environment variables management
- Slack/Discord notifications
- Health check monitoring
- Multi-server deployment
- CI/CD integration
- Web dashboard

---

## Roadmap

### Version 1.0 (Current)
- [x] Basic deployment functionality
- [x] Domain & SSL management
- [x] Rollback support
- [x] Server monitoring
- [x] Deployment logs

### Version 1.1 (Planned)
- [ ] SSH key authentication
- [ ] Environment variables management
- [ ] Database migration support
- [ ] Health check monitoring

### Version 2.0 (Future)
- [ ] Multi-server deployment
- [ ] Docker support
- [ ] CI/CD integration
- [ ] Web dashboard
- [ ] Slack/Discord notifications
- [ ] Auto-scaling support

---

## Technical Stack

### Dependencies
- **commander** - CLI framework
- **inquirer** - Interactive prompts
- **chalk** - Colored terminal output
- **ora** - Loading spinners
- **node-ssh** - SSH client
- **js-yaml** - YAML parser

### Server Requirements
- Ubuntu/Debian (recommended)
- SSH access
- Root or sudo privileges

---

## Security Considerations

1. **Password Storage**
   - Stored in `deploy-config.yml`
   - File added to `.gitignore`
   - Never committed to git

2. **Recommended Practices**
   ```bash
   # Protect config file
   chmod 600 deploy-config.yml
   
   # Add to gitignore
   echo "deploy-config.yml" >> .gitignore
   ```

3. **Future Improvements**
   - SSH key authentication (planned)
   - Encrypted config file (planned)

---

## Comparison with Other Tools

### vs Heroku
- **AutoDeploy**: Deploy to your own VPS, cheaper for long-term
- **Heroku**: Platform as a Service, more expensive but easier

### vs Vercel/Netlify
- **AutoDeploy**: Full control, supports all types of apps
- **Vercel/Netlify**: Focused on static sites and serverless

### vs Docker
- **AutoDeploy**: Simpler, no need to learn Docker
- **Docker**: More powerful, but steeper learning curve

### vs Manual SSH
- **AutoDeploy**: Automatic, one command, has rollback
- **Manual SSH**: Complex, prone to error, no history

---

## Support

- **Documentation**: This README
- **GitHub Issues**: Report bugs or request features
- **Repository**: https://github.com/adamramdaniyunus/autodeploy-tools

---

## License

MIT License

Copyright (c) 2025 AutoDeploy CLI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Made with care for developers who want simple, powerful deployment**
