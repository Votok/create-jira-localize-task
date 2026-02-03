# Jira Localization Task Creator

A Node.js CLI tool that automates creation of Jira localization tasks by detecting newly added translation keys. The tool runs directly from your translation repository and interactively guides you through the process.

## Features

- **Auto-detection**: Automatically detects git repository and available translation files
- **Interactive prompts**: Select translation file and comparison mode via CLI prompts
- **Flexible comparison**: Work with uncommitted changes or analyze last commit
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Smart formatting**: Creates Jira issues with properly formatted translation tables

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Git**: Translation repository must be a git repository
- **Translation Structure**: Translation files in `i18n/en/` directory
- **Jira Cloud**: Access to a Jira Cloud instance
- **Jira API Token**: Generate at [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)

## Installation

1. Clone or download this repository

2. Install dependencies:

   ```bash
   npm install
   ```

3. Link the CLI tool globally:

   ```bash
   npm link
   ```

   This makes the `create-loc-task` and `clt` commands available from anywhere.

4. Create your configuration file:

   ```bash
   cp config.example.json ~/.create-jira-localize-task
   ```

5. Edit the configuration:

   ```bash
   nano ~/.create-jira-localize-task
   # or
   code ~/.create-jira-localize-task
   ```

## Configuration

Create `~/.create-jira-localize-task` with your Jira credentials:

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

### Configuration Fields

| Field                      | Description                                       | Required |
| -------------------------- | ------------------------------------------------- | -------- |
| `jira.baseURL`             | Your Jira Cloud base URL (without trailing slash) | Yes      |
| `jira.email`               | Your Jira email address                           | Yes      |
| `jira.apiToken`            | Your Jira API token                               | Yes      |
| `jira.projectId`           | The project ID where tasks will be created        | Yes      |
| `jira.issueTypeId`         | The issue type ID to use for tasks                | Yes      |
| `jira.assigneeEmail`       | Email of the user to assign tasks to              | No       |
| `jira.reporterEmail`       | Email of the user to set as reporter              | No       |
| `baseBranch`               | Base branch name for comparison                   | No       |

### Getting Your Jira API Token

1. Go to [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Localization CLI")
4. Copy the token and paste it into your config file

## Usage

Navigate to your translation repository and run:

```bash
create-loc-task
```

Or use the short alias:

```bash
clt
```

The CLI will interactively prompt you for:

1. **Translation file selection**: Choose from available JSON files in `i18n/en/` directory
   - Default: `ims-ui.json`
   - Files are listed alphabetically

2. **Comparison mode**:
   - **Work with uncommitted changes**: Detects changes not yet committed (HEAD vs working directory)
   - **Work with last commit changes**: Detects changes in the last commit (HEAD~1 vs HEAD)

The tool will then:
- Detect new translation keys using deep-diff analysis
- Display them in a formatted table
- Create a Jira issue with the changes
- Provide the issue URL

## Workflow Examples

### Working with Uncommitted Changes

This is useful when you want to create a Jira task before committing your changes:

```bash
cd /path/to/translation/repo

# Make translation changes
vim i18n/en/ims-ui.json

# Create Jira task
clt
# Select: "Work with uncommitted changes"

# Review the Jira task
# Then commit and push
git add i18n/en/ims-ui.json
git commit -m "Add new translations"
git push
```

### Working with Last Commit

This is useful when you've already committed your changes and want to create a Jira task for what was just committed:

```bash
cd /path/to/translation/repo

# Make and commit translation changes
vim i18n/en/ims-ui.json
git add i18n/en/ims-ui.json
git commit -m "Add new translations"

# Create Jira task from what was just committed
clt
# Select: "Work with last commit changes"

# Push to remote
git push
```

## Example Output

### With New Keys

```bash
============================================================
  Jira Localization Task Creator
============================================================

Repository: /Users/username/dev/Commend.Translations.SCS

✔ Select translation file: › ims-ui.json
✔ Select comparison mode: › Work with uncommitted changes

Comparing translation files...
  File: i18n/en/ims-ui.json
  Comparison: working directory vs HEAD

✅ 2 new keys detected

| KEY | VALUE |
| --- | ----- |
| general.validation-errors.emptyString | Cannot use empty string |
| general.validation-errors.tooShort | Too short |

Resolving Jira user accounts...
  ✓ Assignee: assignee@example.com
  ✓ Reporter: reporter@example.com

Creating Jira issue...

============================================================
✓ SUCCESS!
============================================================
Issue Key: PROJ-123
Issue URL: https://your-company.atlassian.net/browse/PROJ-123
============================================================
```

### No New Keys

```bash
============================================================
  Jira Localization Task Creator
============================================================

Repository: /Users/username/dev/Commend.Translations.SCS

✔ Select translation file: › ims-ui.json
✔ Select comparison mode: › Work with uncommitted changes

Comparing translation files...
  File: i18n/en/ims-ui.json
  Comparison: working directory vs HEAD

No new translation keys detected.
```

## How It Works

### Git Comparison

The tool uses git commands to compare different versions of your translation files:

- **Uncommitted changes**: Compares HEAD (last commit) vs working directory
- **Last commit**: Compares HEAD~1 (previous commit) vs HEAD (current commit)

```bash
# Get file from git
git -C /path/to/repo show HEAD:i18n/en/ims-ui.json

# Read current file
cat /path/to/repo/i18n/en/ims-ui.json
```

### Deep Diff Analysis

The tool uses the `deep-diff` library to:

- Compare nested JSON structures
- Detect newly added keys at any depth (kind === 'N')
- Filter out modifications and deletions
- Convert nested paths to dot notation (e.g., `general.validation-errors.emptyString`)

### Supported JSON Structures

Both flat and nested JSON structures are supported:

**Flat structure:**
```json
{
  "key1": "value1",
  "key2": "value2"
}
```

**Nested structure:**
```json
{
  "general": {
    "validation-errors": {
      "emptyString": "Cannot use empty string",
      "tooShort": "Too short"
    }
  }
}
```

## Jira Integration

The tool automatically creates Jira issues when new translation keys are detected.

### Features

- **Automatic issue creation** with ADF (Atlassian Document Format) table formatting
- **User account resolution** for assignee and reporter
- **Automatic labeling** with "localisation" tag
- **Smart title generation** from the first translation key
  - Format: `"Localization request – {first-key-name}"`

### Generated Jira Issue Format

The created Jira issue contains a formatted table in the description:

| KEY                                   | VALUE                    |
| ------------------------------------- | ------------------------ |
| general.validation-errors.emptyString | Cannot use empty string  |
| general.validation-errors.tooShort    | Too short                |

## Troubleshooting

### "Configuration file not found"

Create `~/.create-jira-localize-task` based on `config.example.json`.

### "Not in a git repository"

The tool must be run from within your translation repository. Navigate to the repository first:

```bash
cd /path/to/translation/repo
clt
```

### "Translation directory not found: i18n/en"

The tool expects translation files in `i18n/en/` directory. Verify:

- The directory exists in your repository
- You're running the command from the repository root or subdirectory

### "No JSON files found"

The `i18n/en/` directory doesn't contain any `.json` files. Verify:

- Translation files exist and have `.json` extension
- You have permission to read the files

### "Branch origin/master not found"

The base branch doesn't exist. Try:

```bash
git fetch origin
```

### "File does not exist in HEAD~1"

For "last commit" mode, this means the file didn't exist in the previous commit. This could mean:

- The file was newly created in the last commit
- You're working on the first commit in the repository

### "User not found: email@example.com"

The email address in your config doesn't match any Jira user. Verify:

- The email is correct
- The user exists in your Jira instance
- Your API token has permission to view users

### Jira API Errors (401 Unauthorized)

Your Jira credentials are incorrect. Verify:

- `jira.email` matches your Atlassian account
- `jira.apiToken` is valid and not expired
- `jira.baseURL` is correct

### Jira API Errors (403 Forbidden)

Your API token doesn't have sufficient permissions. Ensure:

- You have "Browse users and groups" permission in Jira
- You can create issues in the specified project

## Development

### Running Without Linking

```bash
npm run start
```

Or directly:

```bash
node create-loc-task.mjs
```

Note: When running without linking, you need to be in this project's directory, but the tool will still detect your translation repository automatically.

### Project Structure

```
.
├── config.example.json   # Configuration template
├── .gitignore           # Git ignore rules
├── CLAUDE.md            # Developer documentation
├── README.md            # This file
├── create-loc-task.mjs  # Main CLI script
└── package.json         # Project configuration and dependencies
```

### Dependencies

- **deep-diff**: Detects differences between JSON objects
- **axios**: HTTP client for Jira REST API
- **prompts**: Interactive CLI prompts

## License

MIT
