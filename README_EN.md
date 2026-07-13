<p align="center">
  <img src="packages/frontend/public/deepscience-logo.png" alt="DeepScience logo" width="112">
</p>

<h1 align="center">DeepScience</h1>

<p align="center">
  An AI research collaborator for scientific reasoning, data acquisition, analysis, and reproducible results.
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong>
</p>

DeepScience is a local AI agent for scientific research. It works continuously within a research project, queries scientific databases, runs analyses, manages generated files, and presents both its execution process and final results through a WebUI or terminal interface.

DeepScience is built on the Pi Agent runtime and is currently under active development.

## Features

### Scientific agents

DeepScience includes four primary agents:

- **Biology**: bioinformatics analysis, gene and pathway queries, protein analysis, and omics data processing.
- **Research**: research discovery, scientific question analysis, evidence synthesis, and report generation.
- **Physics**: numerical computing, simulation, equation solving, and physical data analysis.
- **Machine Learning**: model training, evaluation, result analysis, and visualization.

Casual conversation receives a direct response. Well-defined analysis tasks use the necessary tools, while open-ended research questions trigger a more complete process of investigation, computation, and validation.

### Scientific skills and resources

Agents can use the DeepScience skill library and scientific resource library when a task requires them, without loading the entire collection into every session.

The resource library includes:

- **Biological Knowledge**: genes, pathways, proteins, regulatory networks, metabolism, phenotypes, and clinical knowledge bases.
- **Experimental Data**: sequencing, transcriptomics, proteomics, metabolomics, and structural biology data.
- **Literature**: publications, clinical trials, and patent resources.

When a database provides both local data and a remote service, DeepScience prefers local data when it can satisfy the task and queries the remote API when necessary.

### Projects and session workspaces

- Create or open any local research directory as a Project.
- Give every Session an independent Workspace so outputs from different tasks do not overwrite one another.
- Stop, resume, delete, and fork Sessions.
- Optionally isolate work with Git Worktrees.
- Persist conversations and execution results across server restarts.

For a Project located at `/path/to/project`:

```text
/path/to/project/.deepscience/
├── workspace.json
├── sessions/
└── workspace/<session-id>/
```

Global model settings and recently opened Projects are stored under `~/.deepscience/`. Generated task files are not written to the home directory by default.

### Live execution trace

The WebUI displays the following in real time:

- The Agent's current reasoning and execution steps
- Tool names, arguments, status, and output
- Accurate success, failure, and stopped states
- The final response and generated files

Execution steps can be collapsed. If you switch to another Session and return later, the active Session continues to synchronize its progress.

### Artifacts

Important results can be published to the Artifacts panel, including:

- Markdown and scientific reports
- Markdown tables and CSV data
- Mathematical equations
- Images and plots
- HTML pages
- JSON, TSV, FASTA, and other file previews
- PDB, CIF, mmCIF, and MOL2 molecular structures

The Agent selectively publishes important results. Other Workspace files can still be previewed from the Files panel or from file links in an answer.

### Local computing environments

Before running Python or scientific computing tasks, DeepScience can detect and select existing environments, including:

- Conda, Mamba, and Micromamba
- venv and virtualenv
- uv, Poetry, and Pipenv
- Pixi, PDM, Hatch, and pyenv

The Agent prefers an environment compatible with the current Project and records the interpreter and execution method used in its results.

### Models and authentication

DeepScience supports multiple model Providers through a unified model layer. The WebUI model selector only displays models whose credentials have been configured and organizes them by Provider and Model.

It supports:

- Saving API keys from **Settings → Model**
- Subscription login for Providers such as OpenAI Codex, Anthropic, and GitHub Copilot
- Provider configuration through environment variables
- Default Agent, model, and thinking level selection

Credentials saved through the WebUI are stored in `~/.deepscience/credentials.json` with `0600` permissions and are never returned to the browser.

## Quick start

### Requirements

- Node.js `>= 22.19.0`
- npm
- Git

### Development mode

```bash
cd /path/to/DeepScience
git submodule update --init --recursive
npm install --ignore-scripts
npm run dev
```

Open:

- WebUI: <http://localhost:5175>
- API: <http://127.0.0.1:3000>

Development mode uses two ports to support frontend hot reload. The services can also be started separately:

```bash
npm run dev:api
npm run dev:web
```

### Local installation

Once published, install DeepScience globally from npm:

```bash
npm install -g @shying/deepscience
```

To install from source:

```bash
npm run build
cd packages/server
npm link
```

Then run DeepScience from the directory you want to use as a Workspace:

```bash
cd /path/to/research-project
deepscience web
```

The WebUI is available at <http://localhost:3000>, and the launch directory becomes the initial Workspace.

## Model configuration

After starting the WebUI, open **Settings → Model**, select a Provider, configure an API key or subscription login, and choose the default model.

Providers can also be configured through environment variables:

```bash
export BIGMODEL_API_KEY="..."
export ZAI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
export OPENAI_API_KEY="..."
```

List currently available models:

```bash
deepscience --list-models
```

## CLI / TUI

```bash
# Open the interactive TUI
deepscience

# Open the TUI and run a task immediately
deepscience "find gene sets related to cholesterol metabolism"

# Run non-interactively
deepscience -p "summarize the current project"

# Select an Agent, model, and thinking level
deepscience -a biology -m bigmodel/glm-5.2 --thinking medium -p "analyze these genes"

# Resume the latest Session for the current Project
deepscience --continue

# Resume a specific Session
deepscience --session <session-id>
```

Additional commands:

```bash
deepscience --list-agents
deepscience --list-models
deepscience --list-sessions
deepscience --help
```

The TUI supports `/help`, `/status`, `/clear`, `/stop`, and `/exit`. The default thinking level is `medium`.

## Development and validation

```bash
npm run check
npm test
npm run skills:validate
npm run resources:validate
```

## Security

The DeepScience Web Server listens on a local address by default and restricts access between Session Workspaces, Project files, and Resource files.

These restrictions are not an operating-system sandbox. Commands executed by an Agent still inherit the permissions of the user who launched DeepScience. Use a container, virtual machine, or system sandbox for untrusted tasks.

## Acknowledgements and sources

- Some Agent prompts were adapted or sourced from [synthetic-sciences/openscience](https://github.com/synthetic-sciences/openscience).
- The Agent Core comes from [earendil-works/pi](https://github.com/earendil-works/pi).

## License

This project is licensed under the [MIT License](LICENSE). Pi-derived source code retains its original copyright notices.
