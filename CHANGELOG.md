# Changelog

All notable changes to this project will be documented in this file.

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
