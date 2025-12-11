import { NodeSSH } from 'node-ssh';
import chalk from 'chalk';
import ora from 'ora';

export class SSHClient {
  constructor(config) {
    this.config = config;
    this.ssh = new NodeSSH();
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;

    const spinner = ora('Connecting to server...').start();
    
    try {
      await this.ssh.connect({
        host: this.config.server.host,
        username: this.config.server.username,
        password: this.config.server.password,
        port: this.config.server.port || 22,
      });
      
      this.connected = true;
      spinner.succeed('Connected to server');
    } catch (error) {
      spinner.fail('Failed to connect to server');
      throw error;
    }
  }

  async disconnect() {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
    }
  }

  async exec(command, options = {}) {
    await this.connect();
    
    const result = await this.ssh.execCommand(command, {
      cwd: options.cwd || this.config.server.deployPath,
      ...options
    });

    if (result.code !== 0 && !options.ignoreErrors) {
      throw new Error(`Command failed: ${result.stderr || result.stdout}`);
    }

    return result;
  }

  async execWithSpinner(command, message, options = {}) {
    const spinner = ora(message).start();
    
    try {
      const result = await this.exec(command, options);
      spinner.succeed();
      return result;
    } catch (error) {
      spinner.fail();
      throw error;
    }
  }

  async fileExists(remotePath) {
    try {
      const result = await this.exec(`test -e ${remotePath} && echo "exists"`, { ignoreErrors: true });
      return result.stdout.trim() === 'exists';
    } catch {
      return false;
    }
  }

  async uploadFile(localPath, remotePath) {
    await this.connect();
    await this.ssh.putFile(localPath, remotePath);
  }

  async downloadFile(remotePath, localPath) {
    await this.connect();
    await this.ssh.getFile(localPath, remotePath);
  }
}
