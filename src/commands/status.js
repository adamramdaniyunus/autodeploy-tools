import chalk from 'chalk';
import { loadConfig, getDeploymentHistory } from '../utils/config.js';
import { SSHClient } from '../utils/ssh.js';

export async function statusCommand() {
  console.log(chalk.blue.bold('\n[STATUS] Deployment Status\n'));

  try {
    const config = loadConfig();
    const sshClient = new SSHClient(config);
    await sshClient.connect();

    // Server info
    console.log(chalk.yellow('Server Information:'));
    const uptimeResult = await sshClient.exec('uptime -p', { ignoreErrors: true });
    console.log(chalk.white(`  Uptime: ${uptimeResult.stdout.trim()}`));

    const memResult = await sshClient.exec('free -h | grep Mem', { ignoreErrors: true });
    const memInfo = memResult.stdout.trim().split(/\s+/);
    console.log(chalk.white(`  Memory: ${memInfo[2]} / ${memInfo[1]} used`));

    const diskResult = await sshClient.exec('df -h / | tail -1', { ignoreErrors: true });
    const diskInfo = diskResult.stdout.trim().split(/\s+/);
    console.log(chalk.white(`  Disk: ${diskInfo[2]} / ${diskInfo[1]} used (${diskInfo[4]})`));

    // Git info
    console.log(chalk.yellow('\nGit Information:'));
    const branchResult = await sshClient.exec('git rev-parse --abbrev-ref HEAD');
    console.log(chalk.white(`  Current Branch: ${branchResult.stdout.trim()}`));

    const commitResult = await sshClient.exec('git log -1 --pretty=format:"%h - %s (%cr)"');
    console.log(chalk.white(`  Latest Commit: ${commitResult.stdout.trim()}`));

    // Application status
    if (config.project.type === 'nodejs') {
      console.log(chalk.yellow('\nApplication Status:'));
      const pm2Result = await sshClient.exec(`pm2 jlist`, { ignoreErrors: true });
      
      try {
        const processes = JSON.parse(pm2Result.stdout);
        const app = processes.find(p => p.name === config.project.name);
        
        if (app) {
          const status = app.pm2_env.status === 'online' ? chalk.green('[ONLINE]') : chalk.red('[OFFLINE]');
          console.log(chalk.white(`  ${status} ${app.name}`));
          console.log(chalk.white(`    Status: ${app.pm2_env.status}`));
          console.log(chalk.white(`    Uptime: ${formatUptime(app.pm2_env.pm_uptime)}`));
          console.log(chalk.white(`    Restarts: ${app.pm2_env.restart_time}`));
          console.log(chalk.white(`    Memory: ${formatBytes(app.monit.memory)}`));
          console.log(chalk.white(`    CPU: ${app.monit.cpu}%`));
        } else {
          console.log(chalk.red('  Application not running'));
        }
      } catch (e) {
        console.log(chalk.red('  Could not get application status'));
      }
    }

    // Domain & SSL
    if (config.domain) {
      console.log(chalk.yellow('\nDomain & SSL:'));
      console.log(chalk.white(`  Domain: ${config.domain}`));
      
      const sslResult = await sshClient.exec(`certbot certificates -d ${config.domain} 2>/dev/null | grep "Expiry Date" || echo "No SSL"`, { ignoreErrors: true });
      if (sslResult.stdout.includes('Expiry Date')) {
        const expiryMatch = sslResult.stdout.match(/Expiry Date: (.+)/);
        if (expiryMatch) {
          console.log(chalk.white(`  SSL Expiry: ${expiryMatch[1].trim()}`));
        }
      } else {
        console.log(chalk.yellow('  SSL: Not configured'));
      }
    }

    // Recent deployments
    console.log(chalk.yellow('\nRecent Deployments:'));
    const history = getDeploymentHistory();
    
    if (history.length === 0) {
      console.log(chalk.white('  No deployment history'));
    } else {
      history.slice(0, 5).forEach((deployment, index) => {
        const statusIcon = deployment.status === 'success' ? chalk.green('[OK]') : chalk.red('[FAIL]');
        const date = new Date(deployment.timestamp).toLocaleString();
        console.log(chalk.white(`  ${statusIcon} ${deployment.commit.substring(0, 7)} - ${deployment.message || 'No message'}`));
        console.log(chalk.gray(`    ${date} on ${deployment.branch}`));
      });
    }

    await sshClient.disconnect();
    console.log();

  } catch (error) {
    console.error(chalk.red('\n[ERROR] Failed to get status:'), error.message);
    process.exit(1);
  }
}

function formatUptime(timestamp) {
  const uptime = Date.now() - timestamp;
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
