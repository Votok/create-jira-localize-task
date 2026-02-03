#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import deepDiff from "deep-diff";
import axios from "axios";
import prompts from "prompts";

const { diff } = deepDiff;

// Configuration
const CONFIG_PATH = join(homedir(), ".create-jira-localize-task");
const TRANSLATION_DIR = "i18n/en";
const DEFAULT_FILE = "ims-ui.json";

/**
 * Load configuration from ~/.create-jira-localize-task
 */
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Error: Configuration file not found at: ${CONFIG_PATH}`);
    console.error(`\nPlease create it based on config.example.json`);
    console.error(`Example: cp config.example.json ~/.create-jira-localize-task`);
    process.exit(1);
  }

  try {
    const configContent = readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(configContent);

    // Validate required Jira fields
    const requiredFields = ["baseURL", "email", "apiToken", "projectId", "issueTypeId"];
    const missingFields = requiredFields.filter(field => !config.jira?.[field]);

    if (missingFields.length > 0) {
      console.error("Error: Missing required fields in config:");
      missingFields.forEach(field => console.error(`  - jira.${field}`));
      process.exit(1);
    }

    return config;
  } catch (error) {
    console.error(`Error reading config file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Get the root directory of the current git repository
 */
function getGitRoot() {
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return gitRoot;
  } catch (error) {
    console.error("Error: Not in a git repository");
    console.error("Please run this command from within your translation repository");
    process.exit(1);
  }
}

/**
 * Find all JSON files in the i18n/en directory
 */
function findTranslationFiles(repoPath) {
  const translationDir = join(repoPath, TRANSLATION_DIR);

  if (!existsSync(translationDir)) {
    console.error(`Error: Translation directory not found: ${translationDir}`);
    console.error(`Expected to find: ${TRANSLATION_DIR}`);
    process.exit(1);
  }

  try {
    const files = readdirSync(translationDir)
      .filter(file => file.endsWith(".json"))
      .sort();

    if (files.length === 0) {
      console.error(`Error: No JSON files found in ${translationDir}`);
      process.exit(1);
    }

    return files;
  } catch (error) {
    console.error(`Error reading translation directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Prompt user to select translation file
 */
async function selectTranslationFile(files) {
  // Find default file index
  const defaultIndex = files.indexOf(DEFAULT_FILE);
  const initialIndex = defaultIndex >= 0 ? defaultIndex : 0;

  const response = await prompts({
    type: "select",
    name: "file",
    message: "Select translation file:",
    choices: files.map(file => ({ title: file, value: file })),
    initial: initialIndex
  });

  if (!response.file) {
    console.error("\nOperation cancelled");
    process.exit(0);
  }

  return response.file;
}

/**
 * Prompt user to select comparison mode
 */
async function selectMode() {
  const response = await prompts({
    type: "select",
    name: "mode",
    message: "Select comparison mode:",
    choices: [
      { title: "Work with uncommitted changes", value: "uncommitted" },
      { title: "Work with last commit changes", value: "lastCommit" }
    ],
    initial: 0
  });

  if (!response.mode) {
    console.error("\nOperation cancelled");
    process.exit(0);
  }

  return response.mode;
}

/**
 * Get file content from git at a specific revision
 */
function getFileFromGit(repoPath, filePath, revision) {
  try {
    const gitCommand = `git -C "${repoPath}" show ${revision}:${filePath}`;
    const content = execSync(gitCommand, { encoding: "utf-8" });
    return JSON.parse(content);
  } catch (error) {
    if (error.message.includes("exists on disk, but not in")) {
      console.error(`Error: File ${filePath} does not exist in ${revision}`);
    } else if (error.message.includes("unknown revision") || error.message.includes("bad revision")) {
      console.error(`Error: Revision ${revision} not found`);
    } else {
      console.error(`Error reading file from git: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Get current file content from filesystem
 */
function getCurrentFileContent(repoPath, filePath) {
  try {
    const fullPath = join(repoPath, filePath);
    const content = readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading current file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Get file contents based on selected mode
 */
function getFileContents(repoPath, filePath, mode, baseBranch) {
  let baseContent, currentContent, comparison;

  if (mode === "uncommitted") {
    // Compare: working directory vs HEAD
    baseContent = getFileFromGit(repoPath, filePath, "HEAD");
    currentContent = getCurrentFileContent(repoPath, filePath);
    comparison = "working directory vs HEAD";
  } else {
    // Compare: HEAD vs HEAD~1
    baseContent = getFileFromGit(repoPath, filePath, "HEAD~1");
    currentContent = getFileFromGit(repoPath, filePath, "HEAD");
    comparison = "HEAD vs HEAD~1 (last commit)";
  }

  return { baseContent, currentContent, comparison };
}

/**
 * Flatten a nested path array to dot notation
 */
function flattenPath(pathArray) {
  return pathArray.join(".");
}

/**
 * Recursively flatten a nested object to leaf key-value pairs
 */
function flattenObject(obj, prefix = "") {
  const result = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result.push(...flattenObject(value, fullKey));
    } else {
      result.push({ key: fullKey, value: String(value) });
    }
  }

  return result;
}

/**
 * Detect newly added translation keys using deep-diff
 */
function detectNewKeys(baseContent, currentContent) {
  const differences = diff(baseContent, currentContent) || [];

  // Filter only "new" items (kind === 'N')
  const newItems = differences.filter((d) => d.kind === "N");

  const newKeys = [];

  for (const item of newItems) {
    const basePath = flattenPath(item.path);
    const value = item.rhs;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const flattened = flattenObject(value, basePath);
      newKeys.push(...flattened);
    } else {
      newKeys.push({ key: basePath, value: String(value) });
    }
  }

  return newKeys;
}

/**
 * Generate markdown table from key:value pairs
 */
function generateMarkdownTable(pairs) {
  if (pairs.length === 0) {
    return "No new translation keys detected.";
  }

  const header = "| KEY | VALUE |";
  const separator = "| --- | ----- |";
  const rows = pairs.map((pair) => `| ${pair.key} | ${pair.value} |`);

  return [header, separator, ...rows].join("\n");
}

/**
 * Convert key:value pairs to ADF table format
 */
function createADFTable(pairs) {
  if (pairs.length === 0) {
    return {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "No translation keys provided."
        }
      ]
    };
  }

  const headerRow = {
    type: "tableRow",
    content: [
      {
        type: "tableHeader",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "KEY" }]
          }
        ]
      },
      {
        type: "tableHeader",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "VALUE" }]
          }
        ]
      }
    ]
  };

  const dataRows = pairs.map(pair => ({
    type: "tableRow",
    content: [
      {
        type: "tableCell",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: pair.key }]
          }
        ]
      },
      {
        type: "tableCell",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: pair.value }]
          }
        ]
      }
    ]
  }));

  return {
    type: "table",
    content: [headerRow, ...dataRows]
  };
}

/**
 * Get Jira account ID from email address
 */
async function getAccountId(email, auth, config) {
  if (!email) return null;

  try {
    const endpoints = [
      {
        url: `${config.jira.baseURL}/rest/api/3/user/assignable/search`,
        params: { query: email, projectId: config.jira.projectId },
      },
      {
        url: `${config.jira.baseURL}/rest/api/3/user/search`,
        params: { query: email },
      },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint.url, {
          params: endpoint.params,
          auth,
        });

        if (response.data && response.data.length > 0) {
          const exactMatch = response.data.find(
            (user) => user.emailAddress?.toLowerCase() === email.toLowerCase()
          );

          if (exactMatch) {
            return exactMatch.accountId;
          }

          console.warn(
            `  ⚠ No exact match for ${email}, using: ${response.data[0].emailAddress || response.data[0].displayName}`
          );
          return response.data[0].accountId;
        }
      } catch (err) {
        continue;
      }
    }

    console.warn(`  ⚠ Could not find user: ${email} (will be unassigned)`);
    return null;
  } catch (error) {
    console.warn(`  ⚠ Error looking up user ${email}: ${error.message} (will be unassigned)`);
    return null;
  }
}

/**
 * Create Jira issue
 */
async function createJiraIssue(title, description, config) {
  const auth = {
    username: config.jira.email,
    password: config.jira.apiToken,
  };

  try {
    console.log("\nResolving Jira user accounts...");

    const [assigneeId, reporterId] = await Promise.all([
      getAccountId(config.jira.assigneeEmail, auth, config),
      getAccountId(config.jira.reporterEmail, auth, config),
    ]);

    if (assigneeId) {
      console.log(`  ✓ Assignee: ${config.jira.assigneeEmail}`);
    }
    if (reporterId) {
      console.log(`  ✓ Reporter: ${config.jira.reporterEmail}`);
    }

    console.log("\nCreating Jira issue...");

    const issueData = {
      fields: {
        project: {
          id: config.jira.projectId,
        },
        summary: title,
        description: {
          type: "doc",
          version: 1,
          content: [description],
        },
        issuetype: {
          id: config.jira.issueTypeId,
        },
        labels: ["localisation"],
      },
    };

    if (assigneeId) {
      issueData.fields.assignee = { id: assigneeId };
    }

    if (reporterId) {
      issueData.fields.reporter = { id: reporterId };
    }

    const response = await axios.post(`${config.jira.baseURL}/rest/api/3/issue`, issueData, {
      auth,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return {
      key: response.data.key,
      id: response.data.id,
      self: response.data.self,
    };
  } catch (error) {
    if (error.response) {
      console.error("\nJira API Error:");
      console.error(`Status: ${error.response.status} ${error.response.statusText}`);
      console.error("Details:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("\nError:", error.message);
    }
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log("=".repeat(60));
    console.log("  Jira Localization Task Creator");
    console.log("=".repeat(60) + "\n");

    // Load configuration
    const config = loadConfig();

    // Detect git repository
    const repoPath = getGitRoot();
    console.log(`Repository: ${repoPath}\n`);

    // Find available translation files
    const files = findTranslationFiles(repoPath);

    // Prompt user to select file
    const selectedFile = await selectTranslationFile(files);
    const filePath = join(TRANSLATION_DIR, selectedFile);

    // Prompt user to select mode
    const mode = await selectMode();

    console.log("\nComparing translation files...");
    console.log(`  File: ${filePath}`);

    // Get file contents based on mode
    const { baseContent, currentContent, comparison } = getFileContents(
      repoPath,
      filePath,
      mode,
      config.baseBranch || "origin/master"
    );

    console.log(`  Comparison: ${comparison}\n`);

    // Detect new keys
    const newKeys = detectNewKeys(baseContent, currentContent);

    if (newKeys.length === 0) {
      console.log("No new translation keys detected.");
      return;
    }

    console.log(`✅ ${newKeys.length} new key${newKeys.length > 1 ? "s" : ""} detected`);
    console.log("");
    console.log(generateMarkdownTable(newKeys));

    // Generate task title
    const taskTitle = `Localization request – ${newKeys[0].key}`;

    // Create ADF table for Jira
    const tableContent = createADFTable(newKeys);

    // Create Jira issue
    const issue = await createJiraIssue(taskTitle, tableContent, config);

    // Output results
    const issueUrl = `${config.jira.baseURL}/browse/${issue.key}`;

    console.log("\n" + "=".repeat(60));
    console.log("✓ SUCCESS!");
    console.log("=".repeat(60));
    console.log(`Issue Key: ${issue.key}`);
    console.log(`Issue URL: ${issueUrl}`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n✗ Failed to process translation files");
    if (error.message) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();
