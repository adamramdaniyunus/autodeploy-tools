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
        await sshClient.execWithSpinner(
          `pm2 delete ${config.project.name} || true && pm2 start ${config.build.startCommand} --name ${config.project.name} && pm2 save`,
          'Restarting application...'
        );
      }
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
