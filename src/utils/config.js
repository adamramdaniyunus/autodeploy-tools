import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_FILE = 'deploy-config.yml';

export function getConfigPath() {
  return path.join(process.cwd(), CONFIG_FILE);
}

export function configExists() {
  return fs.existsSync(getConfigPath());
}

export function loadConfig() {
  if (!configExists()) {
    throw new Error('Configuration file not found. Please run "autodeploy init" first.');
  }
  
  const fileContents = fs.readFileSync(getConfigPath(), 'utf8');
  return yaml.load(fileContents);
}

export function saveConfig(config) {
  const yamlStr = yaml.dump(config);
  fs.writeFileSync(getConfigPath(), yamlStr, 'utf8');
}

export function getDeploymentDir() {
  const deployDir = path.join(process.cwd(), '.autodeploy');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }
  return deployDir;
}

export function saveDeploymentHistory(deployment) {
  const deployDir = getDeploymentDir();
  const historyFile = path.join(deployDir, 'history.json');
  
  let history = [];
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  }
  
  history.unshift({
    ...deployment,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 20 deployments
  history = history.slice(0, 20);
  
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

export function getDeploymentHistory() {
  const historyFile = path.join(getDeploymentDir(), 'history.json');
  
  if (!fs.existsSync(historyFile)) {
    return [];
  }
  
  return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
}
