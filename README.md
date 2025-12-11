# AutoDeploy CLI

CLI tool for automatic deployment with git push - setup once, deploy forever!

## Overview

AutoDeploy CLI adalah tool command-line untuk automatic deployment yang membuat proses deploy aplikasi menjadi sangat mudah. Developer hanya perlu setup sekali, dan selanjutnya deploy bisa dilakukan dengan simple command atau bahkan otomatis saat git push.

### Key Features

- **No SSH Required** - Semua dilakukan otomatis dari CLI
- **No Git PAT Setup** - Menggunakan git repository langsung
- **No Manual Installation** - Setup otomatis di server
- **Simple Deployment** - Deploy dengan satu command atau git push
- **Easy Domain & SSL** - Otomatis setup Nginx dan Let's Encrypt
- **Server Monitoring** - Command status untuk cek server
- **Easy Rollback** - Kembali ke versi sebelumnya dengan mudah

### Supported Applications

- **Node.js** - Express, Next.js, NestJS, Koa, dll
- **PHP** - Laravel, CodeIgniter, WordPress, Symfony, dll
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

**Important:** Add `deploy-config.yml` to `.gitignore`:
```bash
echo "deploy-config.yml" >> .gitignore
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

### Example 4: Rollback After Error

```bash
# Check logs
autodeploy logs

# Rollback to previous version
autodeploy rollback

# Select version from list
# Verify
autodeploy status
```

### Example 5: Add Domain & SSL

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

**Q: Apakah gratis?**  
A: Ya, AutoDeploy CLI adalah open source dengan lisensi MIT. Gratis untuk digunakan, dimodifikasi, dan didistribusikan.

**Q: Siapa yang cocok menggunakan tool ini?**  
A: Developer yang ingin deployment mudah, freelancer, startup/tim kecil, pelajar yang belajar web development.

**Q: Berapa lama setup awal?**  
A: Setup pertama kali sekitar 3-5 menit. Setelah itu, deploy hanya butuh 30 detik.

**Q: Apakah aman menyimpan password di config file?**  
A: File `deploy-config.yml` harus ditambahkan ke `.gitignore` agar tidak ter-commit ke git.

### Server Requirements

**Q: VPS apa yang didukung?**  
A: Ubuntu 20.04+, Debian 10+, CentOS 7+ (experimental).

**Q: Apakah bisa pakai shared hosting?**  
A: Tidak. AutoDeploy membutuhkan SSH access dan kemampuan install software.

**Q: Berapa minimum spesifikasi VPS?**  
A: RAM: 512MB minimum (1GB recommended), Storage: 10GB minimum, CPU: 1 core minimum.

**Q: Apakah harus punya domain?**  
A: Tidak. Domain opsional. Tanpa domain, aplikasi bisa diakses via IP:PORT.

### Deployment

**Q: Berapa lama proses deployment?**  
A: Node.js app: 30-60 detik, PHP app: 20-40 detik, Static site: 10-20 detik.

**Q: Apakah deployment menyebabkan downtime?**  
A: Node.js: PM2 melakukan zero-downtime restart. PHP: Minimal downtime (< 1 detik). Static: No downtime.

**Q: Apa yang terjadi jika deployment gagal?**  
A: Error ditampilkan di terminal, aplikasi tetap running dengan versi sebelumnya, bisa rollback jika perlu.

### Domain & SSL

**Q: Apakah SSL gratis?**  
A: Ya, menggunakan Let's Encrypt yang gratis.

**Q: Berapa lama SSL berlaku?**  
A: 90 hari. Auto-renewal disetup otomatis oleh certbot.

**Q: Domain harus sudah pointing sebelum setup?**  
A: Ya, untuk SSL certificate berhasil, domain harus sudah pointing ke IP VPS.

### Advanced

**Q: Apakah bisa custom build command?**  
A: Ya, saat `autodeploy init` atau edit `deploy-config.yml`.

**Q: Apakah bisa integrate dengan CI/CD?**  
A: Ya, bisa dipanggil dari CI/CD pipeline.

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
- **AutoDeploy**: Deploy ke VPS sendiri, lebih murah untuk long-term
- **Heroku**: Platform as a Service, lebih mahal tapi lebih mudah

### vs Vercel/Netlify
- **AutoDeploy**: Full control, support semua jenis app
- **Vercel/Netlify**: Fokus pada static sites dan serverless

### vs Docker
- **AutoDeploy**: Simpler, tidak perlu belajar Docker
- **Docker**: More powerful, tapi learning curve lebih tinggi

### vs Manual SSH
- **AutoDeploy**: Otomatis, satu command, ada rollback
- **Manual SSH**: Ribet, prone to error, no history

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
