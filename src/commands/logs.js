import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';

export async function logsCommand(options) {
  console.log(chalk.blue.bold('\n[LOGS] Deployment Logs\n'));

  try {
    const config = loadConfig();
    const lines = parseInt(options.lines) || 50;

    const sshClient = new SSHClient(config);
    await sshClient.connect();

    // Show deployment logs
    console.log(chalk.yellow('Deployment History:'));
    const deployLogExists = await sshClient.fileExists(`${config.server.deployPath}/.autodeploy/deployments.log`);
    
    if (deployLogExists) {
      const deployResult = await sshClient.exec(
        `tail -n ${lines} ${config.server.deployPath}/.autodeploy/deployments.log`,
        { ignoreErrors: true }
      );
      
      if (deployResult.stdout) {
        console.log(chalk.white(deployResult.stdout));
      } else {
        console.log(chalk.gray('No deployment logs found.'));
      }
    } else {
      console.log(chalk.gray('No deployment logs found.'));
    }

    // Show application logs for Node.js apps
    if (config.project.type === 'nodejs') {
      console.log(chalk.yellow('\nApplication Logs:'));
      const pm2LogResult = await sshClient.exec(
        `pm2 logs ${config.project.name} --lines ${lines} --nostream`,
        { ignoreErrors: true }
      );
      
      if (pm2LogResult.stdout) {
        console.log(chalk.white(pm2LogResult.stdout));
      } else {
        console.log(chalk.gray('No application logs found.'));
      }
    }

    // Show nginx error logs if domain is configured
    if (config.domain) {
      console.log(chalk.yellow('\nNginx Error Logs:'));
      const nginxLogResult = await sshClient.exec(
        `tail -n ${Math.min(lines, 20)} /var/log/nginx/error.log`,
        { ignoreErrors: true }
      );
      
      if (nginxLogResult.stdout) {
        console.log(chalk.white(nginxLogResult.stdout));
      } else {
        console.log(chalk.gray('No nginx errors.'));
      }
    }

    await sshClient.disconnect();
    console.log();

  } catch (error) {
    console.error(chalk.red('\n[ERROR] Failed to get logs:'), error.message);
    process.exit(1);
  }
}
