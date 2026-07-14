<p align="center">
  <img src="packages/frontend/public/deepscience-logo.png" alt="DeepScience logo" width="112">
</p>

<h1 align="center">DeepScience</h1>

<p align="center">
  An AI research collaborator for scientific reasoning, data acquisition, analysis, and reproducible results.
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README_EN.md">English</a>
</p>

DeepScience 是一个面向科研工作的本地 AI Agent。它可以围绕一个研究项目持续工作，查询科学数据库、运行分析、管理生成文件，并通过 WebUI 或终端展示完整的执行过程和最终结果。

项目基于 Pi Agent 运行时构建，目前处于积极开发阶段。

## 功能

### 科学 Agent

DeepScience 内置四个主要 Agent：

- **Biology**：生物信息学分析、基因与通路查询、蛋白质和组学数据处理。
- **Research**：资料调研、科学问题分析、证据整理和研究报告。
- **Physics**：数值计算、模拟、方程求解和物理数据分析。
- **Machine Learning**：模型训练、评估、结果分析和可视化。

简单问候会直接回复；明确的分析任务会调用必要工具；开放性研究问题则会进行更完整的调研、计算和验证。

### 科学技能与资源

Agent 可以按任务需要使用 DeepScience 的技能库和科学资源库，而不会在每次会话中加载所有内容。

资源库包括：

- **Biological Knowledge**：基因、通路、蛋白、调控网络、代谢、表型和临床知识库。
- **Experimental Data**：测序、转录组、蛋白组、代谢组和结构生物学数据。
- **Literature**：论文、临床试验和专利资源。

对于同时提供本地数据和远程接口的数据库，DeepScience 会优先使用能够满足任务的本地数据，并在必要时查询远程 API。

### Project 与 Session Workspace

- 可以新建或打开本机任意研究目录作为 Project。
- 每个 Session 拥有独立 Workspace，避免不同任务的输出文件相互覆盖。
- 支持 Session 停止、恢复、删除和 Fork。
- 支持可选 Git Worktree 隔离。
- 会话和运行结果持久保存，服务器重启后仍可继续。

以 `/path/to/project` 为例：

```text
/path/to/project/.deepscience/
├── workspace.json
├── sessions/
└── workspace/<session-id>/
```

全局模型配置和最近打开的 Project 记录保存在 `~/.deepscience/`。任务生成的文件不会默认写入用户主目录。

### 实时运行过程

WebUI 会实时展示：

- Agent 当前的推理和执行步骤
- 工具名称、参数、运行状态和输出
- 成功、失败、停止等准确状态
- 最终回答与生成文件

运行步骤可以折叠，切换到其他 Session 后再返回也会继续同步当前进度。

### Artifacts

重要结果可以发布到右侧 Artifacts 面板，包括：

- Markdown 和科学报告
- Markdown tables 与 CSV
- 数学公式
- 图片和绘图结果
- HTML 页面
- JSON、TSV、FASTA 等文件预览
- PDB、CIF、mmCIF 和 MOL2 分子结构

Agent 会选择性发布关键结果。用户也可以在 Files 或回答中的文件链接上点击预览其他 Workspace 文件。

### 本机计算环境

运行 Python 或科学计算任务时，DeepScience 可以检测并选择已有环境，包括：

- Conda、Mamba、Micromamba
- venv、virtualenv
- uv、Poetry、Pipenv
- Pixi、PDM、Hatch、pyenv

Agent 会优先复用与项目兼容的环境，并在结果中记录实际使用的解释器和运行方式。

### 模型与登录

DeepScience 通过统一模型层支持多种 Provider。WebUI 的模型选择器只显示已经配置凭据的模型，并按 Provider 和 Model 两级组织。

支持：

- 在 Settings → Model 中保存 API Key
- OpenAI Codex、Anthropic 和 GitHub Copilot 等 Provider 的订阅登录
- 使用环境变量配置 Provider
- 为 Workspace 选择默认 Agent、模型和 thinking level

通过 WebUI 保存的凭据位于 `~/.deepscience/credentials.json`，权限为 `0600`，不会返回给浏览器。

## 快速开始

### 环境要求

- Node.js `>= 22.19.0`
- npm
- Git

### 开发模式

```bash
cd /path/to/DeepScience
git submodule update --init --recursive
npm install --ignore-scripts
npm run dev
```

打开：

- WebUI：<http://localhost:5175>
- API：<http://127.0.0.1:3000>

开发模式使用两个端口是为了支持前端热更新。也可以分别启动：

```bash
npm run dev:api
npm run dev:web
```

### 本地安装

发布后可以直接通过 npm 全局安装：

```bash
npm install -g @shying/deepscience
```

从源码安装：

```bash
npm run build
cd packages/server
npm link
```

随后在准备作为 Workspace 的目录运行：

```bash
cd /path/to/research-project
deepscience web
```

WebUI 地址为 <http://localhost:3000>，启动目录会成为初始 Workspace。

也可以在任意目录显式指定端口和初始 Workspace：

```bash
deepscience web --port 8080 --workspace /path/to/research-project
```

`--project` 可作为 `--workspace` 的别名。未指定 `--port` 时会使用 `PORT` 环境变量，若也未设置则使用 `3000`。

## 配置模型

启动 WebUI 后进入 **Settings → Model**，选择 Provider 并配置 API Key 或订阅登录，然后选择默认模型。

也可以使用环境变量：

```bash
export BIGMODEL_API_KEY="..."
export ZAI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
export OPENAI_API_KEY="..."
```

查看当前可用模型：

```bash
deepscience --list-models
```

## CLI / TUI

```bash
# 打开交互式 TUI
deepscience

# 打开 TUI 并立即执行任务
deepscience "查询胆固醇代谢相关 gene sets"

# 非交互执行
deepscience -p "总结当前项目"

# 指定 Agent、模型和思考强度
deepscience -a biology -m bigmodel/glm-5.2 --thinking medium -p "分析这些基因"

# 恢复当前 Project 最近一次 Session
deepscience --continue

# 恢复指定 Session
deepscience --session <session-id>
```

更多命令：

```bash
deepscience --list-agents
deepscience --list-models
deepscience --list-sessions
deepscience --help
```

TUI 支持 `/help`、`/status`、`/clear`、`/stop` 和 `/exit`。默认 thinking level 为 `medium`。

## 开发与验证

```bash
npm run check
npm test
npm run skills:validate
npm run resources:validate
```

## 安全说明

DeepScience Web Server 默认只监听本机地址，并限制 Session Workspace、项目文件和 Resource 文件之间的访问范围。

这些限制不是操作系统级沙箱。Agent 执行命令时仍继承启动用户的系统权限；运行不可信任务时，请额外使用容器、虚拟机或系统沙箱。

## 致谢与来源

- 部分 Agent Prompt 参考或来源于 [synthetic-sciences/openscience](https://github.com/synthetic-sciences/openscience)。
- Agent Core 来自 [earendil-works/pi](https://github.com/earendil-works/pi)。

## License

本项目采用 [MIT License](LICENSE)。Pi 相关源码与衍生部分保留其原始版权声明。
