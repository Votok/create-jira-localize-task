# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js CLI tool that automates Jira localization task creation by detecting newly added translation keys. The tool compares translation files using git, identifies new keys using deep-diff analysis, and creates a formatted Jira issue with all detected changes.

## Installation

### Local Development
```bash
npm install
npm link
```

After linking, you can use the `create-loc-task` or `clt` command from anywhere.

### Running Locally (without linking)
```bash
npm run start
```

## Configuration

The tool uses a JSON configuration file at `~/.create-jira-localize-task` (use `config.example.json` as template):

```json
{
  "jira": {
    "baseURL": "https://your-company.atlassian.net",
    "email": "your.email@example.com",
    "apiToken": "your_api_token_here",
    "projectId": "10000",
    "issueTypeId": "10001",
    "assigneeEmail": "assignee@example.com",
    "reporterEmail": "reporter@example.com"
  },
  "baseBranch": "origin/master"
}
```

**Required Jira Fields:**
- `jira.baseURL`: Jira Cloud URL without trailing slash
- `jira.email`: Jira account email
- `jira.apiToken`: API token from Atlassian Account Security
- `jira.projectId`: Numeric project ID
- `jira.issueTypeId`: Numeric issue type ID

**Optional Jira Fields:**
- `jira.assigneeEmail`: Email for automatic assignment
- `jira.reporterEmail`: Email for reporter field

**Optional Fields:**
- `baseBranch`: Base branch name (default: `origin/master`)

## Architecture

### Single-File CLI Tool

The entire application logic is contained in `create-loc-task.mjs`, which follows this flow:

1. **Configuration & Validation**
   - `loadConfig()`: Loads JSON config from `~/.create-jira-localize-task`
   - Validates required Jira fields
   - `getGitRoot()`: Auto-detects current git repository using `git rev-parse --show-toplevel`

2. **Interactive File Selection**
   - `findTranslationFiles()`: Scans `i18n/en/` directory for JSON files
   - `selectTranslationFile()`: Prompts user to select file (default: ims-ui.json)
   - `selectMode()`: Prompts for comparison mode (uncommitted vs last commit)

3. **Git-Based Comparison**
   - `getFileFromGit()`: Fetches file content from git at specific revision using `git show`
   - `getCurrentFileContent()`: Reads current filesystem version
   - `getFileContents()`: Orchestrates comparison based on selected mode:
     - **Uncommitted**: HEAD vs working directory
     - **Last commit**: HEAD~1 vs HEAD
   - Uses git commands with `-C` flag for cross-platform compatibility

4. **Deep-Diff Analysis**
   - `detectNewKeys()`: Uses `deep-diff` library to compare JSON structures
   - Filters for kind === 'N' (new additions only)
   - `flattenPath()`: Converts nested arrays to dot notation
   - `flattenObject()`: Recursively flattens nested objects to leaf key-value pairs

5. **Format Generation**
   - `generateMarkdownTable()`: Creates console output table
   - `createADFTable()`: Generates Atlassian Document Format table for Jira API
   - ADF structure: doc → table → tableRow → tableHeader/tableCell → paragraph → text

6. **Jira Integration**
   - `getAccountId()`: Resolves email addresses to Jira account IDs
   - Uses multiple search endpoints (assignable/search and user/search)
   - `createJiraIssue()`: Creates issue via REST API v3
   - Auto-assigns "localisation" label
   - Title format: `"Localization request – {first-key-name}"`

### Key Implementation Details

**Git Command Pattern:**
```javascript
git -C "${translationConfig.repoPath}" show ${translationConfig.baseBranch}:${translationConfig.filePath}
```
This allows running git commands in a different repository from any working directory.

**Deep-Diff Detection:**
The tool only detects NEW keys (additions), not modifications or deletions. This is intentional - localization tasks are only needed for new text requiring translation.

**Jira API Structure:**
- Uses Basic Auth (email + API token)
- REST API v3 endpoints
- ADF (Atlassian Document Format) for rich text formatting
- Account IDs required for assignee/reporter (not email addresses)

**Error Handling:**
- Environment validation exits early with clear error messages
- User lookup failures are non-fatal (issues created without assignee/reporter)
- Git errors include contextual hints (e.g., "Did you forget to fetch?")

## Usage

Navigate to your translation repository and run:

```bash
create-loc-task
# or using the alias
clt
```

The CLI will interactively prompt you for:

1. **Translation file selection**: Choose from available JSON files in `i18n/en/` directory (default: `ims-ui.json`)
2. **Comparison mode**:
   - **Uncommitted changes**: Compare working directory vs HEAD (detects changes not yet committed)
   - **Last commit changes**: Compare HEAD vs HEAD~1 (detects what was changed in the last commit)

## Workflow Context

**For Uncommitted Changes:**
1. Make translation changes in translation repository
2. Run `create-loc-task` and select "Work with uncommitted changes"
3. Review and create Jira task
4. Commit and push changes

**For Last Commit:**
1. Make and commit translation changes
2. Run `create-loc-task` and select "Work with last commit changes"
3. Review and create Jira task based on what was just committed
4. Push to remote

## Dependencies

- `axios`: Jira REST API communication
- `deep-diff`: JSON structure comparison
- `prompts`: Interactive CLI prompts
- Node.js built-ins: `child_process` (execSync), `fs`, `path`, `os`
