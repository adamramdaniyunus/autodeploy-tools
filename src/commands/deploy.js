import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, saveDeploymentHistory } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function deployCommand(options) {
  console.log(chalk.blue.bold('\n[DEPLOY] Starting deployment...\n'));

  try {
    const config = loadConfig();
    const branch = options.branch || config.git.branch;

    // Get current git info
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD');
    const { stdout: commitHash } = await execAsync('git rev-parse HEAD');
    const { stdout: commitMessage } = await execAsync('git log -1 --pretty=%B');

    console.log(chalk.blue(`Branch: ${currentBranch.trim()}`));
    console.log(chalk.blue(`Commit: ${commitHash.trim().substring(0, 7)}`));
    console.log(chalk.blue(`Message: ${commitMessage.trim()}\n`));

    // Push to git
    const pushSpinner = ora('Pushing to git repository...').start();
    try {
      await execAsync(`git push origin ${branch}`);
      pushSpinner.succeed('Code pushed to repository');
    } catch (error) {
      pushSpinner.fail('Failed to push to repository');
      throw error;
    }

    // Connect to server and trigger deployment
    const sshClient = new SSHClient(config);
    await sshClient.connect();

    // Pull latest changes
    await sshClient.execWithSpinner(
      `cd ${config.server.deployPath} && git pull origin ${branch}`,
      'Pulling latest changes on server...'
    );

    // Get latest commit on server
    const result = await sshClient.exec('git rev-parse HEAD');
    const serverCommit = result.stdout.trim();

    // Run build if needed
    if (config.build.command) {
      await sshClient.execWithSpinner(
        config.build.command,
        'Building application...'
      );
    }

    // Install dependencies and restart based on app type
    if (config.project.type === 'nodejs') {
      await sshClient.execWithSpinner(
        'npm install --production',
        'Installing dependencies...'
      );

      if (config.build.startCommand) {
        // Check if PM2 process already exists, restart if yes, start if no
        let pm2StartCmd;
        
        if (config.build.startCommand.startsWith('npm ')) {
          // For npm scripts, use pm2 start npm with -- run
          const npmScript = config.build.startCommand.replace('npm ', '');
          pm2StartCmd = `
            if pm2 describe ${config.project.name} > /dev/null 2>&1; then
              pm2 restart ${config.project.name}
            else
              pm2 start npm --name "${config.project.name}" -- ${npmScript}
            fi
            pm2 startup
            pm2 save
          `;
        } else if (config.build.startCommand.startsWith('node ')) {
          // For direct node commands
          const scriptPath = config.build.startCommand.replace('node ', '');
          pm2StartCmd = `
            if pm2 describe ${config.project.name} > /dev/null 2>&1; then
              pm2 restart ${config.project.name}
            else
              pm2 start ${scriptPath} --name "${config.project.name}"
            fi
            pm2 startup
            pm2 save
          `;
        } else {
          // Assume it's a script path
          pm2StartCmd = `
            if pm2 describe ${config.project.name} > /dev/null 2>&1; then
              pm2 restart ${config.project.name}
            else
              pm2 start ${config.build.startCommand} --name ${config.project.name}
            fi
            pm2 startup
            pm2 save
          `;
        }
        
        await sshClient.execWithSpinner(
          pm2StartCmd,
          'Restarting application...'
        );
      }
    } else if (config.project.type === 'laravel-react') {
      // Laravel + React deployment flow
      console.log(chalk.blue('\\n[LARAVEL-REACT] Starting full-stack deployment...\\n'));
      
      // 1. Install frontend dependencies
      await sshClient.execWithSpinner(
        `cd ${config.server.deployPath} && npm install`,
        'Installing frontend dependencies...'
      );
      
      // 2. Build frontend
      const buildCmd = config.build.frontendBuildCmd || 'npm run build';
      await sshClient.execWithSpinner(
        `cd ${config.server.deployPath} && ${buildCmd}`,
        'Building React frontend with Vite...'
      );
      
      // 3. Install backend dependencies
      if (config.build.composerInstall !== false) {
        await sshClient.execWithSpinner(
          `cd ${config.server.deployPath} && composer install --no-dev --optimize-autoloader`,
          'Installing Laravel dependencies...'
        );
      }
      
      // 4. Run Laravel optimizations
      if (config.build.laravelOptimize !== false) {
        await sshClient.execWithSpinner(
          `cd ${config.server.deployPath} && php artisan config:cache && php artisan route:cache && php artisan view:cache`,
          'Optimizing Laravel (caching config/routes/views)...'
        );
      }
      
      // 5. Run migrations (safe mode, no --force)
      if (config.build.runMigrations) {
        await sshClient.execWithSpinner(
          `cd ${config.server.deployPath} && php artisan migrate`,
          'Running database migrations...'
        );
      }
      
      // 6. Reload PHP-FPM (dynamic version detection)
      const phpVersionResult = await sshClient.exec(
        'php -r "echo PHP_MAJOR_VERSION.\\".\\".PHP_MINOR_VERSION;"',
        { ignoreErrors: true }
      );
      
      const phpFpmService = phpVersionResult.stdout 
        ? `php${phpVersionResult.stdout.trim()}-fpm` 
        : 'php-fpm';
      
      await sshClient.execWithSpinner(
        `systemctl reload ${phpFpmService} || systemctl reload php-fpm || true`,
        `Reloading ${phpFpmService}...`
      );
      
      console.log(chalk.green('\\n[LARAVEL-REACT] Full-stack deployment completed!\\n'));
    } else if (config.project.type === 'php') {
      await sshClient.execWithSpinner(
        'systemctl reload php-fpm || true',
        'Reloading PHP-FPM...'
      );
    }

    await sshClient.disconnect();

    // Save deployment history
    saveDeploymentHistory({
      branch: currentBranch.trim(),
      commit: commitHash.trim(),
      message: commitMessage.trim(),
      serverCommit: serverCommit,
      status: 'success'
    });

    console.log(chalk.green.bold('\n[SUCCESS] Deployment completed successfully!\n'));
    
    if (config.domain) {
      console.log(chalk.blue(`[INFO] Your app is live at: https://${config.domain}\n`));
    }

  } catch (error) {
    console.error(chalk.red('\n[ERROR] Deployment failed:'), error.message);
    
    // Save failed deployment
    try {
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD');
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD');
      
      saveDeploymentHistory({
        branch: currentBranch.trim(),
        commit: commitHash.trim(),
        status: 'failed',
        error: error.message
      });
    } catch {}
    
    process.exit(1);
  }
}
