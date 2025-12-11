import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, getDeploymentHistory, saveDeploymentHistory } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';

export async function rollbackCommand(options) {
  console.log(chalk.blue.bold('\n[ROLLBACK] Rollback Deployment\n'));

  try {
    const config = loadConfig();
    const history = getDeploymentHistory();

    if (history.length < 2) {
      console.log(chalk.yellow('No previous deployments to rollback to.'));
      return;
    }

    let targetCommit;

    if (options.version) {
      // Rollback to specific version
      targetCommit = options.version;
    } else {
      // Show list of previous deployments
      const choices = history
        .filter(d => d.status === 'success')
        .slice(1, 11) // Skip current, show up to 10 previous
        .map((deployment, index) => {
          const date = new Date(deployment.timestamp).toLocaleString();
          return {
            name: `${deployment.commit.substring(0, 7)} - ${deployment.message || 'No message'} (${date})`,
            value: deployment.commit
          };
        });

      if (choices.length === 0) {
        console.log(chalk.yellow('No successful deployments to rollback to.'));
        return;
      }

      const { selectedCommit } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedCommit',
          message: 'Select deployment to rollback to:',
          choices: choices
        }
      ]);

      targetCommit = selectedCommit;
    }

    // Confirm rollback
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to rollback to ${targetCommit.substring(0, 7)}?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('Rollback cancelled.'));
      return;
    }

    // Perform rollback
    const sshClient = new SSHClient(config);
    await sshClient.connect();

    // Checkout the target commit
    await sshClient.execWithSpinner(
      `git checkout ${targetCommit}`,
      'Rolling back to previous version...'
    );

    // Reinstall dependencies if needed
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

    // Run build if needed
    if (config.build.command) {
      await sshClient.execWithSpinner(
        config.build.command,
        'Rebuilding application...'
      );
    }

    await sshClient.disconnect();

    // Save rollback in history
    saveDeploymentHistory({
      commit: targetCommit,
      message: `Rollback to ${targetCommit.substring(0, 7)}`,
      status: 'success',
      type: 'rollback'
    });

    console.log(chalk.green.bold('\n[SUCCESS] Rollback completed successfully!\n'));

  } catch (error) {
    console.error(chalk.red('\n[ERROR] Rollback failed:'), error.message);
    process.exit(1);
  }
}
