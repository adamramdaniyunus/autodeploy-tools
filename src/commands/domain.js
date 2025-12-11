import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';

export async function domainCommand(options) {
  console.log(chalk.blue.bold('\n[DOMAIN] Domain Management\n'));

  try {
    const config = loadConfig();

    if (options.list) {
      // List domains
      if (config.domain) {
        console.log(chalk.white(`Primary domain: ${config.domain}`));
      } else {
        console.log(chalk.yellow('No domain configured.'));
      }
      return;
    }

    if (options.add) {
      // Add domain
      await addDomain(config, options.add);
    } else if (options.remove) {
      // Remove domain
      await removeDomain(config, options.remove);
    } else {
      // Interactive mode
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Add/Update domain', value: 'add' },
            { name: 'Remove domain', value: 'remove' },
            { name: 'Renew SSL certificate', value: 'renew' }
          ]
        }
      ]);

      if (action === 'add') {
        const { domain } = await inquirer.prompt([
          {
            type: 'input',
            name: 'domain',
            message: 'Enter domain name:',
            validate: (input) => input.length > 0 || 'Domain is required'
          }
        ]);
        await addDomain(config, domain);
      } else if (action === 'remove') {
        await removeDomain(config, config.domain);
      } else if (action === 'renew') {
        await renewSSL(config);
      }
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Domain management failed:'), error.message);
    process.exit(1);
  }
}

async function addDomain(config, domain) {
  const sshClient = new SSHClient(config);
  await sshClient.connect();

  // Create nginx config
  const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    ${config.project.type === 'nodejs' || config.project.type === 'python' ? `
    location / {
        proxy_pass http://localhost:${config.build.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

  await sshClient.execWithSpinner(
    `cat > /etc/nginx/sites-available/${config.project.name} << 'EOF'
${nginxConfig}
EOF`,
    'Creating nginx configuration...'
  );

  await sshClient.exec(`ln -sf /etc/nginx/sites-available/${config.project.name} /etc/nginx/sites-enabled/`);
  await sshClient.execWithSpinner(
    'nginx -t && systemctl reload nginx',
    'Reloading nginx...'
  );

  // Install SSL certificate
  console.log(chalk.blue('\nInstalling SSL certificate...'));
  const { email } = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email for SSL certificate:',
      default: `admin@${domain}`
    }
  ]);

  await sshClient.execWithSpinner(
    `certbot --nginx -d ${domain} --non-interactive --agree-tos --email ${email}`,
    'Installing SSL certificate...'
  );

  await sshClient.disconnect();

  // Update config
  config.domain = domain;
  saveConfig(config);

  console.log(chalk.green.bold('\n[SUCCESS] Domain configured successfully!'));
  console.log(chalk.blue(`[INFO] Your app is now available at: https://${domain}\n`));
}

async function removeDomain(config, domain) {
  if (!config.domain) {
    console.log(chalk.yellow('No domain configured.'));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove domain ${domain}?`,
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('Cancelled.'));
    return;
  }

  const sshClient = new SSHClient(config);
  await sshClient.connect();

  await sshClient.execWithSpinner(
    `rm -f /etc/nginx/sites-enabled/${config.project.name} && systemctl reload nginx`,
    'Removing nginx configuration...'
  );

  await sshClient.disconnect();

  config.domain = null;
  saveConfig(config);

  console.log(chalk.green.bold('\n[SUCCESS] Domain removed successfully!\n'));
}

async function renewSSL(config) {
  if (!config.domain) {
    console.log(chalk.yellow('No domain configured.'));
    return;
  }

  const sshClient = new SSHClient(config);
  await sshClient.connect();

  await sshClient.execWithSpinner(
    `certbot renew --nginx`,
    'Renewing SSL certificate...'
  );

  await sshClient.disconnect();

  console.log(chalk.green.bold('\n[SUCCESS] SSL certificate renewed successfully!\n'));
}
