# Git Hooks

## Setup Git Hook

To enable auto-deployment on `git push`, install git hook:

```bash
cp hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## How It Works

1. Every time you `git push`, the hook will run
2. Hook checks if `deploy-config.yml` exists
3. If exists, deployment will automatically run

## Configuration

Edit `.git/hooks/pre-push` to customize behavior:

### Auto-deploy after push (Recommended)

Uncomment this line in the hook:

```bash
node_modules/.bin/autodeploy deploy || true
```

### Manual deploy

Leave hook as reminder only, deploy manually with:

```bash
autodeploy deploy
```

## Tips

- Hook will not stop push if deployment fails
- Use `autodeploy status` to check deployment result
- Use `autodeploy rollback` if there are issues
