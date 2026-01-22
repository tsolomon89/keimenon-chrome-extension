# MCP Setup Guide

This repository uses **Model Context Protocol (MCP)** to ensure AI agents correctly understand our **Vanilla JS + Material Design 3** architecture.

## 1. Prerequisites

- **Node.js**: v18+
- **Agent Runner**: Claude Desktop, Cursor, or similar MCP-capable client.

## 2. Configuration

We use the standard **Filesystem MCP Server** to give agents access to our codebase. This is critical because our design system is defined in `src/ui/styles.css`, not in a UI library like MUI.

### Claude Desktop Setup

1.  Open your Claude Desktop config file:
    - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2.  Add the `filesystem` server pointing to this repository root:

    ```json
    {
      "mcpServers": {
        "keimenon-fs": {
          "command": "npx",
          "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "C:\\Development\\Projects\\keimenon-lite" 
          ]
        }
      }
    }
    ```
    *(Note: Replace the path with your actual absolute path to this repo)*

### Cursor / Other Agents

Follow the specific documentation for your tool to add an MCP server. The command is always: `npx -y @modelcontextprotocol/server-filesystem <REPO_PATH>`

## 3. Usage

Once configured, the agent will have a `read_file` (or equivalent) tool that accesses the repo. We enforce strict **Agent Rules** (see `docs/agent-rules.md`) to ensure they use this access to read our design tokens before writing code.
