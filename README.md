# Create Localize Jira Task

A Node.js CLI tool to automate the creation of Jira localization tasks by detecting newly added translation keys. The script compares your local translation file changes against the master branch **before pushing to remote**, automatically creates a Jira issue with all new keys in a formatted table.

## Workflow

This script is designed to be run **after committing your translation changes locally but before pushing to remote**:

1. Make changes to your translation files in the translation repository
2. Commit your changes locally
3. Run this script to detect new keys and create a Jira task
4. Push your changes to remote

The script compares your local working directory against `origin/master` to detect all newly added translation keys.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Git**: Access to the translation repository
- **Translation Repository**: Cloned locally with the base branch fetched
- **Jira Cloud**: Access to a Jira Cloud instance
- **Jira API Token**: Generate at [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)

## Installation

1. Clone or download this repository

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your `.env` file:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and configure your translation repository paths:
   ```bash
   # Open in your preferred editor
   nano .env
   # or
   code .env
   ```

## Configuration

Your `.env` file should contain the following variables:

### Translation Repository Configuration

| Variable                | Description                                 | Example                                | Required |
| ----------------------- | ------------------------------------------- | -------------------------------------- | -------- |
| `TRANSLATION_REPO_PATH` | Absolute path to the translation repository | `/Users/UserName/dev/translationsrepo` | Yes      |
| `TRANSLATION_FILE`      | Relative path to the translation JSON file  | `i18n/en/ims-ui.json`                  | Yes      |
| `BASE_BRANCH`           | Base branch to compare against              | `origin/master` (default)              | No       |

### Jira Configuration

| Variable              | Description                                       | Example                              | Required |
| --------------------- | ------------------------------------------------- | ------------------------------------ | -------- |
| `JIRA_BASE_URL`       | Your Jira Cloud base URL (without trailing slash) | `https://your-company.atlassian.net` | Yes      |
| `JIRA_EMAIL`          | Your Jira email address                           | `your.email@example.com`             | Yes      |
| `JIRA_API_TOKEN`      | Your Jira API token                               | `ATBBx...`                           | Yes      |
| `JIRA_PROJECT_ID`     | The project ID where tasks will be created        | `10000`                              | Yes      |
| `JIRA_ISSUE_TYPE_ID`  | The issue type ID to use for tasks                | `10001`                              | Yes      |
| `JIRA_ASSIGNEE_EMAIL` | Email of the user to assign tasks to (optional)   | `assignee@example.com`               | No       |
| `JIRA_REPORTER_EMAIL` | Email of the user to set as reporter (optional)   | `reporter@example.com`               | No       |

### Example .env

```bash
# Translation Repository
TRANSLATION_REPO_PATH=/Users/UserName/dev/translationsrepo
TRANSLATION_FILE=i18n/en/translations.json
BASE_BRANCH=origin/master

# Jira Configuration
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your.email@example.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT_ID=10000
JIRA_ISSUE_TYPE_ID=10001
JIRA_ASSIGNEE_EMAIL=assignee@example.com
JIRA_REPORTER_EMAIL=reporter@example.com
```

### Getting Your Jira API Token

1. Go to [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Localization CLI")
4. Copy the token and paste it into your `.env` file

## Usage

### Typical Workflow

1. **Make changes** to your translation files in the translation repository:

   ```bash
   cd /Users/UserName/dev/translationsrepo
   # Edit i18n/en/translations.json to add new keys
   ```

2. **Commit your changes** locally:

   ```bash
   git add i18n/en/translations.json
   git commit -m "Add validation error messages"
   ```

3. **Run the script** from anywhere:

   ```bash
   cd /Users/UserName/dev/create-localize-jira-task
   npm run start
   ```

4. **Push to remote** after the Jira task is created:
   ```bash
   cd /Users/UserName/dev/translations
   git push origin your-branch
   ```

### Basic Command

```bash
npm run start
```

Or directly:

```bash
node create-loc-task.mjs
```

The script will:

1. Read the base version of the translation file from `origin/master`
2. Read the current local version (your working directory)
3. Compare both versions using deep-diff
4. Detect newly added translation keys (including nested keys)
5. Display the results in a markdown table
6. Create a Jira issue with the new keys
7. Display the Jira issue URL

### Example Output (With New Keys)

```bash
Comparing translation files...
  Repository: /Users/UserName/dev/translations
  File: i18n/en/translations.json
  Base branch: origin/master

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

### Example Output (No New Keys)

```bash
Comparing translation files...
  Repository: /Users/UserName/dev/translationsrepo
  File: i18n/en/translations.json
  Base branch: origin/master

No new translation keys detected.
```

## How It Works

### Git Comparison

The script compares your **local working directory** against **origin/master** to detect new translation keys added in your local commits that haven't been pushed yet:

```bash
# Get base version from origin/master
git -C /path/to/translation/repo show origin/master:i18n/en/ims-ui.json

# Read current version from your local working directory
cat /path/to/translation/repo/i18n/en/ims-ui.json
```

This means the script detects all new keys in your local changes (committed or uncommitted) compared to what exists in the remote master branch.

### Deep Diff Analysis

The script uses the `deep-diff` library to:

- Compare nested JSON structures
- Detect newly added keys at any depth
- Filter only "new" changes (kind === 'N')
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

## Troubleshooting

### "TRANSLATION_REPO_PATH is required in .env"

Make sure your `.env` file exists and contains the `TRANSLATION_REPO_PATH` variable.

### "Translation repository not found"

The path specified in `TRANSLATION_REPO_PATH` doesn't exist. Verify:

- The path is absolute (not relative)
- The directory exists
- You have permission to access it

### "Translation file not found"

The file specified in `TRANSLATION_FILE` doesn't exist at the current location. Verify:

- The path is correct and relative to the translation repository
- The file exists in your working directory
- You have permission to read it

### "Branch origin/master not found. Did you forget to fetch?"

The base branch specified in `BASE_BRANCH` doesn't exist in the translation repository. Try:

```bash
cd /path/to/translation/repo
git fetch origin
```

### "File i18n/en/ims-ui.json does not exist in origin/master"

The translation file doesn't exist in the base branch. This could mean:

- The file was newly created (not just modified)
- The file path has changed
- You're comparing against the wrong branch

### Git command errors

If you see git-related errors, verify:

- The translation repository is a valid git repository
- You have git installed and accessible from the command line
- The base branch exists and is up to date

### "Missing required environment variables"

Make sure your `.env` file contains all required Jira variables. Check `.env.example` for reference.

### "User not found: email@example.com"

The email address in your `.env` file doesn't match any Jira user. Verify:

- The email is correct
- The user exists in your Jira instance
- Your API token has permission to view users

### Jira API errors (401 Unauthorized)

Your Jira credentials are incorrect. Verify:

- `JIRA_EMAIL` matches your Atlassian account
- `JIRA_API_TOKEN` is valid and not expired
- `JIRA_BASE_URL` is correct

### Jira API errors (403 Forbidden)

Your API token doesn't have sufficient permissions. Make sure:

- You have "Browse users and groups" permission in Jira
- You can create issues in the specified project
- Your API token is valid

### "Issue type ID not found"

The issue type ID in your `.env` file is incorrect or doesn't exist in your project. Verify that `JIRA_ISSUE_TYPE_ID` contains the correct numeric ID for your project.

## Jira Integration

The script automatically creates Jira issues when new translation keys are detected. The integration includes:

### Features

- **Automatic issue creation** with ADF (Atlassian Document Format) table formatting
- **User account resolution** for assignee and reporter
- **Automatic labeling** with "localisation" tag
- **Smart title generation** from the first translation key (e.g., "Localization request – general.validation-errors.emptyString")

### Generated Jira Issue Format

The created Jira issue will contain a formatted table in the description:

| KEY                                   | VALUE                                     |
| ------------------------------------- | ----------------------------------------- |
| general.validation-errors.emptyString | The field cannot contain only whitespace. |
| general.validation-errors.required    | This field is required.                   |

### No Jira Issue Created When

- No new translation keys are detected
- All changes are modifications or deletions (not new keys)

## Development

### Project Structure

```
.
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules (includes .env)
├── README.md            # This file
├── create-loc-task.mjs  # Main CLI script
└── package.json         # Project configuration and dependencies
```

### Dependencies

- **deep-diff**: Detects differences between JSON objects
- **dotenv**: Environment variable management
- **axios**: HTTP client for Jira REST API

### Running from Different Directories

The script uses absolute paths and `git -C` commands, so it can be run from any directory:

```bash
cd /any/directory
node /path/to/create-localize-jira-task/create-loc-task.mjs
```

Or use npm script:

```bash
cd /Users/UserName/dev/create-localize-jira-task
npm run start
```

## Testing

To test the script with your translation repository:

1. **Fetch the latest master branch**:

   ```bash
   cd /path/to/translation/repo
   git fetch origin
   ```

2. **Create a test branch** and add new translation keys:

   ```bash
   git checkout -b test-localization
   # Edit your translation file to add new keys
   git add i18n/en/ims-ui.json
   git commit -m "Test: Add new translation keys"
   ```

3. **Configure your `.env` file** with correct paths and Jira credentials

4. **Run the script**:

   ```bash
   cd /path/to/create-localize-jira-task
   npm run start
   ```

5. **Verify**:
   - The detected keys match your additions
   - A Jira issue was created with the correct keys
   - The issue link opens in your browser

## License

MIT

## Contributing

This is a private automation tool. Feel free to modify it to suit your needs.
