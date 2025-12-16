# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-12-13

### Added
- **Laravel + React Monorepo Support** - Full-stack deployment for Laravel with React frontend
  - New project type: `laravel-react`
  - Automatic frontend build with Vite/Webpack
  - Automatic backend dependency installation with Composer
  - Laravel optimization commands (config/route/view cache)
  - Optional database migration support (safe mode, no --force)
  - Dynamic PHP-FPM version detection (supports PHP 8.1, 8.2, 8.3+)
  - Configurable frontend directory (default: `resources/ts`)
  - Configurable build command (default: `npm run build`)
- **Interactive Package Selection** (`autodeploy init --full`)
  - Checkbox interface to select packages to install
  - Smart defaults based on project type
  - Options: Nginx, PHP, Composer, Node.js, PM2, MySQL, PostgreSQL, Redis, UFW, SSL
- **Version Selection for Runtimes**
  - PHP version selection (8.4, 8.3, 8.2, 8.1, 7.4)
  - Node.js version selection (22, 20 LTS, 18 LTS, 16)
  - Versions stored in config and used during installation
- **Automatic .gitignore Update**
  - Automatically adds `deploy-config.yml` and `.autodeploy/` to .gitignore
  - Prevents credentials from being committed to git
- Git authentication support during initialization
  - Personal Access Token (PAT) method
  - SSH key generation and setup
  - Automatic credential configuration on server

## [1.0.0] - 2025-12-11

### Added
- Initial release of AutoDeploy CLI
- One-time setup with `autodeploy init`
- Auto-deployment with `autodeploy deploy`
- Server monitoring with `autodeploy status`
- Rollback deployment with `autodeploy rollback`
- Domain & SSL management with `autodeploy domain`
- Deployment logs with `autodeploy logs`
- Support for Node.js, PHP, Static, and Python apps
- Automatic Nginx setup
- Automatic SSL installation with Let's Encrypt
- PM2 process management for Node.js
- Git hooks for auto-deploy on push
- Deployment history tracking

### Supported Platforms
- Ubuntu/Debian servers
- Node.js 16+
- SSH access required

### Known Limitations
- Password-based SSH only (SSH key support coming soon)
- Single server deployment (multi-server coming soon)
- No database migration support yet
