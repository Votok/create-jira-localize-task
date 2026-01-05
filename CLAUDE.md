# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js CLI tool that automates Jira localization task creation by detecting newly added translation keys. The tool compares a local translation file against its base branch version, identifies new keys using deep-diff analysis, and creates a formatted Jira issue with all detected changes.

## Commands

### Running the Tool
```bash
npm run start
# or
node create-loc-task.mjs
```

### Installation
```bash
npm install
```

## Configuration

The tool requires a `.env` file (use `.env.example` as template):

**Required Translation Variables:**
- `TRANSLATION_REPO_PATH`: Absolute path to the translation repository
- `TRANSLATION_FILE`: Relative path to translation JSON file (e.g., `i18n/en/ims-ui.json`)
- `BASE_BRANCH`: Base branch for comparison (default: `origin/master`)

**Required Jira Variables:**
- `JIRA_BASE_URL`: Jira Cloud URL without trailing slash
- `JIRA_EMAIL`: Jira account email
- `JIRA_API_TOKEN`: API token from Atlassian Account Security
- `JIRA_PROJECT_ID`: Numeric project ID
- `JIRA_ISSUE_TYPE_ID`: Numeric issue type ID

**Optional Jira Variables:**
- `JIRA_ASSIGNEE_EMAIL`: Email for automatic assignment
- `JIRA_REPORTER_EMAIL`: Email for reporter field

## Architecture

### Single-File CLI Tool

The entire application logic is contained in `create-loc-task.mjs`, which follows this flow:

1. **Configuration & Validation** (lines 12-74)
   - Loads `.env` variables using dotenv
   - Validates required environment variables
   - Checks translation repository and file paths exist

2. **Git-Based Comparison** (lines 76-108)
   - `getBaseFileContent()`: Fetches base version from git using `git show origin/master:path`
   - `getCurrentFileContent()`: Reads current filesystem version
   - Uses git commands with `-C` flag to operate from any directory

3. **Deep-Diff Analysis** (lines 110-134)
   - `detectNewKeys()`: Uses `deep-diff` library to compare JSON structures
   - Filters for kind === 'N' (new additions only)
   - `flattenPath()`: Converts nested arrays to dot notation (e.g., `['general', 'validation-errors', 'emptyString']` → `'general.validation-errors.emptyString'`)

4. **Format Generation** (lines 136-222)
   - `generateMarkdownTable()`: Creates console output table
   - `createADFTable()`: Generates Atlassian Document Format table for Jira API
   - ADF structure: doc → table → tableRow → tableHeader/tableCell → paragraph → text

5. **Jira Integration** (lines 224-362)
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

## Workflow Context

This tool is designed to run AFTER local commits but BEFORE pushing to remote:

1. Make translation changes in translation repository
2. Commit changes locally
3. Run this tool (detects differences vs. origin/master)
4. Push to remote

The comparison is local working directory vs. remote base branch, so uncommitted changes are also detected.

## Dependencies

- `axios`: Jira REST API communication
- `deep-diff`: JSON structure comparison
- `dotenv`: Environment variable loading
- Node.js built-ins: `child_process` (execSync), `fs`, `path`
