import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { saveConfig, configExists } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function initCommand() {
  console.log(chalk.blue.bold('\nAutoDeploy CLI - Initial Setup\n'));

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
      name: 'appType',
      message: 'Application type:',
      choices: ['nodejs', 'php', 'static', 'python'],
      default: 'nodejs'
    },
    {
      type: 'input',
      name: 'buildCommand',
      message: 'Build command (leave empty if none):',
      default: ''
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
      branch: answers.gitBranch
    },
    build: {
      command: answers.buildCommand,
      startCommand: answers.startCommand || '',
      port: answers.port ? parseInt(answers.port) : null
    },
    domain: answers.domain || null
  };

  // Test SSH connection
  console.log(chalk.blue('\nTesting SSH connection...'));
  try {
    const sshClient = new SSHClient(config);
    await sshClient.connect();
    
    // Setup server environment
    await setupServer(sshClient, config);
    
    await sshClient.disconnect();
    
    saveConfig(config);
    
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
pm2 delete ${config.project.name} || true
pm2 start ${config.build.startCommand} --name ${config.project.name}
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
