import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { saveConfig, configExists } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export async function initCommand(options = {}) {
  console.log(chalk.blue.bold('\nAutoDeploy CLI - Initial Setup\n'));
  
  if (options.full) {
    console.log(chalk.yellow('🚀 Full server setup mode enabled'));
    console.log(chalk.gray('   Will install: Nginx, PHP, Composer, Node.js, Database\n'));
  }

  if (configExists()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Configuration already exists. Do you want to overwrite it?',
        default: false
      }
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('Setup cancelled.'));
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-app'
    },
    {
      type: 'input',
      name: 'serverHost',
      message: 'VPS IP Address:',
      validate: (input) => input.length > 0 || 'IP address is required'
    },
    {
      type: 'input',
      name: 'serverUsername',
      message: 'VPS Username:',
      default: 'root'
    },
    {
      type: 'password',
      name: 'serverPassword',
      message: 'VPS Password:',
      validate: (input) => input.length > 0 || 'Password is required'
    },
    {
      type: 'input',
      name: 'serverPort',
      message: 'SSH Port:',
      default: '22'
    },
    {
      type: 'input',
      name: 'deployPath',
      message: 'Deploy path on server:',
      default: '/var/www/html'
    },
    {
      type: 'input',
      name: 'gitRepo',
      message: 'Git repository URL:',
      validate: (input) => input.length > 0 || 'Git repository is required'
    },
    {
      type: 'input',
      name: 'gitBranch',
      message: 'Default branch:',
      default: 'main'
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Domain name (optional):',
      default: ''
    },
    {
      type: 'list',
      name: 'gitAuth',
      message: 'Git authentication method:',
      choices: [
        { name: 'Personal Access Token (PAT) - Recommended', value: 'pat' },
        { name: 'SSH Key', value: 'ssh' },
        { name: 'None (Public repo or manual setup)', value: 'none' }
      ],
      default: 'pat'
    },
    {
      type: 'password',
      name: 'gitToken',
      message: 'GitHub Personal Access Token:',
      when: (answers) => answers.gitAuth === 'pat',
      validate: (input) => input.length > 0 || 'Token is required for PAT authentication'
    },
    {
      type: 'list',
      name: 'appType',
      message: 'Application type:',
      choices: ['nodejs', 'php', 'laravel-react', 'static', 'python'],
      default: 'nodejs'
    },
    {
      type: 'checkbox',
      name: 'packagesToInstall',
      message: 'Select packages to install on server:',
      choices: (answers) => {
        const isLaravelReact = answers.appType === 'laravel-react';
        const isNodejs = answers.appType === 'nodejs';
        const isPhp = answers.appType === 'php';
        
        return [
          {
            name: 'Nginx (Web Server)',
            value: 'nginx',
            checked: isLaravelReact || isPhp || isNodejs
          },
          {
            name: 'PHP + PHP-FPM',
            value: 'php',
            checked: isLaravelReact || isPhp
          },
          {
            name: 'Composer (PHP Package Manager)',
            value: 'composer',
            checked: isLaravelReact || isPhp
          },
          {
            name: 'Node.js + npm',
            value: 'nodejs',
            checked: isLaravelReact || isNodejs
          },
          {
            name: 'PM2 (Node.js Process Manager)',
            value: 'pm2',
            checked: isNodejs
          },
          {
            name: 'MySQL 8.0',
            value: 'mysql',
            checked: false
          },
          {
            name: 'PostgreSQL 15',
            value: 'postgresql',
            checked: false
          },
          {
            name: 'Redis (Cache & Queue)',
            value: 'redis',
            checked: false
          },
          {
            name: 'UFW Firewall',
            value: 'ufw',
            checked: false
          },
          {
            name: 'SSL Certificate (Let\'s Encrypt)',
            value: 'ssl',
            checked: true
          }
        ];
      },
      when: (answers) => options.full,
      validate: (input) => {
        if (input.length === 0) {
          return 'Please select at least one package';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'phpVersion',
      message: 'Select PHP version:',
      choices: [
        { name: 'PHP 8.4 (Latest)', value: '8.4' },
        { name: 'PHP 8.3 (Recommended)', value: '8.3' },
        { name: 'PHP 8.2', value: '8.2' },
        { name: 'PHP 8.1', value: '8.1' },
        { name: 'PHP 7.4 (Legacy)', value: '7.4' }
      ],
      default: '8.3',
      when: (answers) => {
        // Show if PHP selected in packages (full mode)
        if (options.full && answers.packagesToInstall?.includes('php')) {
          return true;
        }
        // Show if PHP or Laravel-React type (basic mode)
        return ['php', 'laravel-react'].includes(answers.appType);
      }
    },
    {
      type: 'list',
      name: 'nodeVersion',
      message: 'Select Node.js version:',
      choices: [
        { name: 'Node.js 22 (Latest)', value: '22' },
        { name: 'Node.js 20 LTS (Recommended)', value: '20' },
        { name: 'Node.js 18 LTS', value: '18' },
        { name: 'Node.js 16 (Legacy)', value: '16' }
      ],
      default: '20',
      when: (answers) => {
        // Show if Node.js selected in packages (full mode)
        if (options.full && answers.packagesToInstall?.includes('nodejs')) {
          return true;
        }
        // Show if Node.js or Laravel-React type (basic mode)
        return ['nodejs', 'laravel-react'].includes(answers.appType);
      }
    },
    {
      type: 'input',
      name: 'frontendDir',
      message: 'Frontend directory (relative to project root):',
      default: 'resources/ts',
      when: (answers) => answers.appType === 'laravel-react'
    },
    {
      type: 'input',
      name: 'frontendBuildCmd',
      message: 'Frontend build command:',
      default: 'npm run build',
      when: (answers) => answers.appType === 'laravel-react'
    },
    {
      type: 'confirm',
      name: 'composerInstall',
      message: 'Run composer install on deployment?',
      default: true,
      when: (answers) => answers.appType === 'laravel-react'
    },
    {
      type: 'confirm',
      name: 'laravelOptimize',
      message: 'Run Laravel optimization commands (cache config/routes/views)?',
      default: true,
      when: (answers) => answers.appType === 'laravel-react'
    },
    {
      type: 'confirm',
      name: 'runMigrations',
      message: 'Run database migrations on deployment?',
      default: false,
      when: (answers) => answers.appType === 'laravel-react'
    },
    {
      type: 'list',
      name: 'database',
      message: 'Database type:',
      choices: [
        { name: 'MySQL 8.0', value: 'mysql' },
        { name: 'PostgreSQL 15', value: 'postgresql' },
        { name: 'Skip (setup manually later)', value: 'none' }
      ],
      default: (answers) => {
        // Auto-select based on package selection
        if (answers.packagesToInstall?.includes('mysql')) return 'mysql';
        if (answers.packagesToInstall?.includes('postgresql')) return 'postgresql';
        return 'mysql';
      },
      when: (answers) => {
        // Show if Laravel-React and no database selected in packages
        if (answers.appType !== 'laravel-react') return false;
        if (!options.full) return true; // Always show in basic mode
        // In full mode, show only if no database was selected
        const hasDatabase = answers.packagesToInstall?.includes('mysql') || 
                           answers.packagesToInstall?.includes('postgresql');
        return !hasDatabase;
      }
    },
    {
      type: 'input',
      name: 'dbName',
      message: 'Database name:',
      default: (answers) => answers.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
      when: (answers) => answers.appType === 'laravel-react' && answers.database !== 'none'
    },
    {
      type: 'input',
      name: 'dbUser',
      message: 'Database username:',
      default: (answers) => answers.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_user',
      when: (answers) => answers.appType === 'laravel-react' && answers.database !== 'none'
    },
    {
      type: 'password',
      name: 'dbPassword',
      message: 'Database password:',
      validate: (input) => input.length >= 8 || 'Password must be at least 8 characters',
      when: (answers) => answers.appType === 'laravel-react' && answers.database !== 'none'
    },
    {
      type: 'confirm',
      name: 'createEnvFile',
      message: 'Auto-generate .env file on server? (You can edit it later)',
      default: true,
      when: (answers) => answers.appType === 'laravel-react'
    },
    {
      type: 'input',
      name: 'buildCommand',
      message: 'Build command (leave empty if none):',
      default: '',
      when: (answers) => answers.appType !== 'laravel-react'
    },
    {
      type: 'input',
      name: 'startCommand',
      message: 'Start command (for Node.js/Python apps):',
      default: 'npm start',
      when: (answers) => ['nodejs', 'python'].includes(answers.appType)
    },
    {
      type: 'input',
      name: 'port',
      message: 'Application port:',
      default: '3000',
      when: (answers) => ['nodejs', 'python'].includes(answers.appType)
    }
  ]);

  const config = {
    project: {
      name: answers.projectName,
      type: answers.appType
    },
    server: {
      host: answers.serverHost,
      username: answers.serverUsername,
      password: answers.serverPassword,
      port: parseInt(answers.serverPort),
      deployPath: answers.deployPath
    },
    git: {
      repository: answers.gitRepo,
      branch: answers.gitBranch,
      authMethod: answers.gitAuth,
      token: answers.gitToken || null
    },
    build: {
      command: answers.buildCommand,
      startCommand: answers.startCommand || '',
      port: answers.port ? parseInt(answers.port) : null,
      // Laravel-React specific
      frontendDir: answers.frontendDir || null,
      frontendBuildCmd: answers.frontendBuildCmd || null,
      composerInstall: answers.composerInstall !== undefined ? answers.composerInstall : null,
      laravelOptimize: answers.laravelOptimize !== undefined ? answers.laravelOptimize : null,
      runMigrations: answers.runMigrations !== undefined ? answers.runMigrations : null
    },
    database: {
      type: (() => {
        // Auto-detect from package selection in full mode
        if (options.full && answers.packagesToInstall) {
          if (answers.packagesToInstall.includes('mysql')) return 'mysql';
          if (answers.packagesToInstall.includes('postgresql')) return 'postgresql';
        }
        return answers.database || null;
      })(),
      name: answers.dbName || null,
      user: answers.dbUser || null,
      password: answers.dbPassword || null
    },
    laravel: {
      createEnvFile: answers.createEnvFile || false
    },
    runtime: {
      phpVersion: answers.phpVersion || '8.3',
      nodeVersion: answers.nodeVersion || '20'
    },
    domain: answers.domain || null,
    fullSetup: options.full || false,
    packagesToInstall: answers.packagesToInstall || []
  };

  // Test SSH connection
  console.log(chalk.blue('\nTesting SSH connection...'));
  try {
    const sshClient = new SSHClient(config);
    await sshClient.connect();
    
    // Setup server environment
    await setupServer(sshClient, config);
    
    // Setup git authentication
    await setupGitAuth(sshClient, config);
    
    await sshClient.disconnect();
    
    saveConfig(config);
    
    // Update .gitignore to exclude sensitive files
    await updateGitignore();
    
    console.log(chalk.green.bold('\n[SUCCESS] Configuration saved successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white('  1. Set up git hook: autodeploy setup-hook'));
    console.log(chalk.white('  2. Deploy your app: git push'));
    console.log(chalk.white('  3. Check status: autodeploy status\n'));
    
  } catch (error) {
    console.error(chalk.red('\n[ERROR] Setup failed:'), error.message);
    process.exit(1);
  }
}

async function updateGitignore() {
  try {
    const gitignorePath = '.gitignore';
    const entriesToAdd = [
      'deploy-config.yml',
      '.autodeploy/'
    ];
    
    let gitignoreContent = '';
    
    // Read existing .gitignore if it exists
    if (existsSync(gitignorePath)) {
      gitignoreContent = await readFile(gitignorePath, 'utf-8');
    }
    
    // Check which entries need to be added
    const linesToAdd = [];
    for (const entry of entriesToAdd) {
      if (!gitignoreContent.includes(entry)) {
        linesToAdd.push(entry);
      }
    }
    
    // Add entries if needed
    if (linesToAdd.length > 0) {
      const newContent = gitignoreContent.trim() + '\n\n# AutoDeploy CLI\n' + linesToAdd.join('\n') + '\n';
      await writeFile(gitignorePath, newContent);
      console.log(chalk.gray(`✓ Updated .gitignore (added: ${linesToAdd.join(', ')})`));
    } else {
      console.log(chalk.gray('✓ .gitignore already contains AutoDeploy entries'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠ Could not update .gitignore automatically'));
    console.log(chalk.gray('  Please add these lines manually:'));
    console.log(chalk.gray('  - deploy-config.yml'));
    console.log(chalk.gray('  - .autodeploy/'));
  }
}

async function setupServer(sshClient, config) {
  const spinner = ora('Setting up server environment...').start();
  
  try {
    // Create deploy directory
    await sshClient.exec(`mkdir -p ${config.server.deployPath}`);
    
    // Install git if not present
    const gitCheck = await sshClient.exec('which git', { ignoreErrors: true });
    if (!gitCheck.stdout) {
      spinner.text = 'Installing git...';
      await sshClient.exec('apt-get update && apt-get install -y git', { ignoreErrors: true });
    }
    
    // Setup git repository
    const repoExists = await sshClient.fileExists(`${config.server.deployPath}/.git`);
    if (!repoExists) {
      spinner.text = 'Cloning repository...';
      await sshClient.exec(`git clone ${config.git.repository} ${config.server.deployPath}`);
    }
    
    // Setup post-receive hook
    spinner.text = 'Setting up git hooks...';
    await setupGitHook(sshClient, config);
    
    // Install dependencies based on app type
    if (config.project.type === 'nodejs') {
      spinner.text = 'Installing Node.js dependencies...';
      const nodeCheck = await sshClient.exec('which node', { ignoreErrors: true });
      if (!nodeCheck.stdout) {
        await sshClient.exec('curl -fsSL https://deb.nodesource.com/setup_18.x | bash -', { ignoreErrors: true });
        await sshClient.exec('apt-get install -y nodejs', { ignoreErrors: true });
      }
      
      // Install PM2 for process management
      const pm2Check = await sshClient.exec('which pm2', { ignoreErrors: true });
      if (!pm2Check.stdout) {
        await sshClient.exec('npm install -g pm2', { ignoreErrors: true });
      }
    }
    
    // Setup nginx if domain is provided
    if (config.domain) {
      spinner.text = 'Setting up Nginx...';
      await setupNginx(sshClient, config);
    }
    
    spinner.succeed('Server setup completed');
  } catch (error) {
    spinner.fail('Server setup failed');
    throw error;
  }
}

async function setupGitHook(sshClient, config) {
  const hookScript = `#!/bin/bash
set -e

echo "[DEPLOY] Starting deployment..."

# Navigate to deploy directory
cd ${config.server.deployPath}

# Pull latest changes
git --git-dir=${config.server.deployPath}/.git --work-tree=${config.server.deployPath} pull origin ${config.git.branch}

# Save deployment info
echo "$(date '+%Y-%m-%d %H:%M:%S') - $(git rev-parse HEAD)" >> .autodeploy/deployments.log

${config.build.command ? `
# Run build command
echo "[BUILD] Building application..."
${config.build.command}
` : ''}

${config.project.type === 'nodejs' && config.build.startCommand ? `
# Install dependencies
echo "[INSTALL] Installing dependencies..."
npm install --production

# Restart application with PM2
echo "[RESTART] Restarting application..."
if pm2 describe ${config.project.name} > /dev/null 2>&1; then
  pm2 restart ${config.project.name}
else
  ${config.build.startCommand.startsWith('npm ') 
    ? `pm2 start npm --name ${config.project.name} -- ${config.build.startCommand.replace('npm ', '')}`
    : config.build.startCommand.startsWith('node ')
      ? `pm2 start ${config.build.startCommand.replace('node ', '')} --name ${config.project.name}`
      : `pm2 start ${config.build.startCommand} --name ${config.project.name}`
  }
fi
pm2 save
` : ''}

${config.project.type === 'php' ? `
# Reload PHP-FPM
echo "[RELOAD] Reloading PHP-FPM..."
systemctl reload php-fpm || true
` : ''}

echo "[SUCCESS] Deployment completed successfully!"
`;

  // Create hooks directory
  await sshClient.exec(`mkdir -p ${config.server.deployPath}/.git/hooks`);
  
  // Write hook script
  const hookPath = `${config.server.deployPath}/.git/hooks/post-receive`;
  await sshClient.exec(`cat > ${hookPath} << 'EOF'
${hookScript}
EOF`);
  
  // Make hook executable
  await sshClient.exec(`chmod +x ${hookPath}`);
  
  // Create autodeploy directory
  await sshClient.exec(`mkdir -p ${config.server.deployPath}/.autodeploy`);
}

async function setupNginx(sshClient, config) {
  const nginxConfig = `server {
    listen 80;
    server_name ${config.domain};

    ${config.project.type === 'nodejs' || config.project.type === 'python' ? `
    location / {
        proxy_pass http://localhost:${config.build.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    ` : `
    root ${config.server.deployPath};
    index index.html index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    ${config.project.type === 'php' ? `
    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    ` : ''}
    `}
}`;

  // Install nginx if not present
  const nginxCheck = await sshClient.exec('which nginx', { ignoreErrors: true });
  if (!nginxCheck.stdout) {
    await sshClient.exec('apt-get install -y nginx', { ignoreErrors: true });
  }

  // Write nginx config
  await sshClient.exec(`cat > /etc/nginx/sites-available/${config.project.name} << 'EOF'
${nginxConfig}
EOF`);

  // Enable site
  await sshClient.exec(`ln -sf /etc/nginx/sites-available/${config.project.name} /etc/nginx/sites-enabled/`);
  
  // Test and reload nginx
  await sshClient.exec('nginx -t && systemctl reload nginx', { ignoreErrors: true });
  
  // Install certbot for SSL
  const certbotCheck = await sshClient.exec('which certbot', { ignoreErrors: true });
  if (!certbotCheck.stdout) {
    await sshClient.exec('apt-get install -y certbot python3-certbot-nginx', { ignoreErrors: true });
  }
  
  // Get SSL certificate
  await sshClient.exec(`certbot --nginx -d ${config.domain} --non-interactive --agree-tos --email admin@${config.domain} || true`, { ignoreErrors: true });
}

async function setupGitAuth(sshClient, config) {
  if (config.git.authMethod === 'none') {
    console.log(chalk.yellow('\nSkipping Git authentication setup. You may need to configure manually.'));
    return;
  }

  const spinner = ora('Setting up Git authentication...').start();

  try {
    if (config.git.authMethod === 'pat') {
      // Setup Personal Access Token
      spinner.text = 'Configuring Git credential store...';
      
      // Enable credential store
      await sshClient.exec('git config --global credential.helper store', { 
        cwd: config.server.deployPath 
      });

      // Extract username from repository URL
      const repoMatch = config.git.repository.match(/github\.com[\/:](.+?)\/(.+?)(\.git)?$/);
      const username = repoMatch ? repoMatch[1] : 'git';

      // Create credentials file with token
      const credentialUrl = config.git.repository.replace('https://', `https://${username}:${config.git.token}@`);
      
      // Store credential by doing a fetch
      await sshClient.exec(
        `git config credential.helper store && echo "${credentialUrl}" | git credential approve`,
        { cwd: config.server.deployPath, ignoreErrors: true }
      );

      // Alternative: Create .git-credentials file directly
      const homeDir = await sshClient.exec('echo $HOME');
      const credFile = `${homeDir.stdout.trim()}/.git-credentials`;
      
      await sshClient.exec(
        `echo "https://${username}:${config.git.token}@github.com" >> ${credFile} && chmod 600 ${credFile}`,
        { ignoreErrors: true }
      );

      spinner.succeed('Git authentication configured with Personal Access Token');
      
    } else if (config.git.authMethod === 'ssh') {
      // Setup SSH Key
      spinner.text = 'Generating SSH key...';
      
      // Check if SSH key already exists
      const sshKeyExists = await sshClient.fileExists('~/.ssh/id_ed25519');
      
      if (!sshKeyExists) {
        // Generate SSH key
        await sshClient.exec(
          'ssh-keygen -t ed25519 -C "autodeploy@server" -f ~/.ssh/id_ed25519 -N ""',
          { ignoreErrors: true }
        );
      }

      // Get public key
      const pubKeyResult = await sshClient.exec('cat ~/.ssh/id_ed25519.pub');
      const publicKey = pubKeyResult.stdout.trim();

      spinner.succeed('SSH key generated');
      
      console.log(chalk.yellow('\n' + '='.repeat(70)));
      console.log(chalk.yellow('ACTION REQUIRED: Add this SSH key to your GitHub account'));
      console.log(chalk.yellow('='.repeat(70)));
      console.log(chalk.white('\n1. Go to: https://github.com/settings/ssh/new'));
      console.log(chalk.white('2. Title: AutoDeploy Server'));
      console.log(chalk.white('3. Key:\n'));
      console.log(chalk.cyan(publicKey));
      console.log(chalk.yellow('\n' + '='.repeat(70) + '\n'));

      // Update git remote to use SSH
      const sshUrl = config.git.repository
        .replace('https://github.com/', 'git@github.com:')
        .replace(/\.git$/, '') + '.git';

      await sshClient.exec(
        `git remote set-url origin ${sshUrl}`,
        { cwd: config.server.deployPath, ignoreErrors: true }
      );

      console.log(chalk.blue('Git remote updated to use SSH'));
      console.log(chalk.yellow('Please add the SSH key to GitHub before deploying.\n'));
    }

  } catch (error) {
    spinner.fail('Git authentication setup failed');
    console.log(chalk.yellow('You may need to configure Git credentials manually on the server.'));
    console.log(chalk.gray('Error:', error.message));
  }
}
