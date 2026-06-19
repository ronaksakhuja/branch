# Branch CLI

Cloud-backed CLI for Branch markdown workspaces.

The CLI authenticates against the Branch web API and pushes/pulls documents to your cloud workspace.

## Commands

```bash
branch init
branch login
branch pull
branch status
branch diff
branch push --author Claude --summary "Updated product plan"
branch history
```

## Agent-Friendly Commands

```bash
branch status --json
branch diff --json
branch history --json
```

## Setup

```bash
mkdir my-workspace
cd my-workspace
node /Users/ronaksakhuja/Projects/branch/packages/cli/src/index.js init
node /Users/ronaksakhuja/Projects/branch/packages/cli/src/index.js login
```

`branch login` opens the Branch web app where you create an API token, then pastes it into the terminal.

After login, `branch pull` downloads all workspace documents. Then edit markdown files and run:

```bash
node /Users/ronaksakhuja/Projects/branch/packages/cli/src/index.js diff
node /Users/ronaksakhuja/Projects/branch/packages/cli/src/index.js push --author Claude --summary "Updated the workspace plan"
```

Config is stored in `.branch/config.json`.
