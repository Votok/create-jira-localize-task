#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import deepDiff from "deep-diff";
import axios from "axios";
import dotenv from "dotenv";

const { diff } = deepDiff;

// Load environment variables
dotenv.config();

// Get configuration from environment
const translationConfig = {
  repoPath: process.env.TRANSLATION_REPO_PATH,
  filePath: process.env.TRANSLATION_FILE,
  baseBranch: process.env.BASE_BRANCH || "origin/master",
};

// Validate environment variables
const requiredEnvVars = [
  "JIRA_BASE_URL",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "JIRA_PROJECT_ID",
  "JIRA_ISSUE_TYPE_ID",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error("Error: Missing required environment variables:");
  missingVars.forEach((varName) => console.error(`  - ${varName}`));
  console.error("\nPlease create a .env file based on .env.example");
  process.exit(1);
}

// Get Jira configuration from environment
const config = {
  baseURL: process.env.JIRA_BASE_URL,
  email: process.env.JIRA_EMAIL,
  apiToken: process.env.JIRA_API_TOKEN,
  projectId: process.env.JIRA_PROJECT_ID,
  issueTypeId: process.env.JIRA_ISSUE_TYPE_ID,
  assigneeEmail: process.env.JIRA_ASSIGNEE_EMAIL || "",
  reporterEmail: process.env.JIRA_REPORTER_EMAIL || "",
};

/**
 * Validate translation repository configuration
 */
function validateConfig() {
  if (!translationConfig.repoPath) {
    console.error("Error: TRANSLATION_REPO_PATH is required in .env");
    process.exit(1);
  }

  if (!translationConfig.filePath) {
    console.error("Error: TRANSLATION_FILE is required in .env");
    process.exit(1);
  }

  if (!existsSync(translationConfig.repoPath)) {
    console.error(`Error: Translation repository not found at: ${translationConfig.repoPath}`);
    process.exit(1);
  }

  const fullPath = join(translationConfig.repoPath, translationConfig.filePath);
  if (!existsSync(fullPath)) {
    console.error(`Error: Translation file not found at: ${fullPath}`);
    process.exit(1);
  }
}

/**
 * Get the base version of the translation file from git
 */
function getBaseFileContent() {
  try {
    const gitCommand = `git -C "${translationConfig.repoPath}" show ${translationConfig.baseBranch}:${translationConfig.filePath}`;
    const content = execSync(gitCommand, { encoding: "utf-8" });
    return JSON.parse(content);
  } catch (error) {
    if (error.message.includes("exists on disk, but not in")) {
      console.error(`Error: File ${translationConfig.filePath} does not exist in ${translationConfig.baseBranch}`);
    } else if (error.message.includes("unknown revision")) {
      console.error(`Error: Branch ${translationConfig.baseBranch} not found. Did you forget to fetch?`);
    } else {
      console.error(`Error reading base file from git: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Get the current version of the translation file from the filesystem
 */
function getCurrentFileContent() {
  try {
    const fullPath = join(translationConfig.repoPath, translationConfig.filePath);
    const content = readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading current file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Flatten a nested path array to dot notation
 * Example: ['general', 'validation-errors', 'emptyString'] => 'general.validation-errors.emptyString'
 */
function flattenPath(pathArray) {
  return pathArray.join(".");
}

/**
 * Detect newly added translation keys using deep-diff
 * Returns array of { key, value } objects for new keys only
 */
function detectNewKeys(baseContent, currentContent) {
  const differences = diff(baseContent, currentContent) || [];

  // Filter only "new" items (kind === 'N')
  const newKeys = differences
    .filter((d) => d.kind === "N")
    .map((d) => ({
      key: flattenPath(d.path),
      value: d.rhs, // right-hand side = new value
    }));

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
 * Returns an ADF table object for Jira API
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

  // Create header row
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

  // Create data rows
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
 * Returns null if user cannot be found (non-fatal)
 */
async function getAccountId(email, auth) {
  if (!email) return null;

  try {
    // Try multiple search methods
    const endpoints = [
      // Method 1: Assignable search (project-specific)
      {
        url: `${config.baseURL}/rest/api/3/user/assignable/search`,
        params: { query: email, projectId: config.projectId },
      },
      // Method 2: General user search
      {
        url: `${config.baseURL}/rest/api/3/user/search`,
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
          // Find exact email match (case-insensitive)
          const exactMatch = response.data.find(
            (user) => user.emailAddress?.toLowerCase() === email.toLowerCase()
          );

          if (exactMatch) {
            return exactMatch.accountId;
          }

          // If no exact match, return first result (partial match)
          console.warn(
            `  ⚠ No exact match for ${email}, using: ${response.data[0].emailAddress || response.data[0].displayName}`
          );
          return response.data[0].accountId;
        }
      } catch (err) {
        // Try next endpoint
        continue;
      }
    }

    // Could not find user with any method
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
async function createJiraIssue(title, description) {
  const auth = {
    username: config.email,
    password: config.apiToken,
  };

  try {
    console.log("\nResolving Jira user accounts...");

    // Get account IDs for assignee and reporter
    const [assigneeId, reporterId] = await Promise.all([
      getAccountId(config.assigneeEmail, auth),
      getAccountId(config.reporterEmail, auth),
    ]);

    if (assigneeId) {
      console.log(`  ✓ Assignee: ${config.assigneeEmail}`);
    }
    if (reporterId) {
      console.log(`  ✓ Reporter: ${config.reporterEmail}`);
    }

    console.log("\nCreating Jira issue...");

    // Build issue data with optional assignee and reporter
    const issueData = {
      fields: {
        project: {
          id: config.projectId,
        },
        summary: title,
        description: {
          type: "doc",
          version: 1,
          content: [description],
        },
        issuetype: {
          id: config.issueTypeId,
        },
        labels: ["localisation"],
      },
    };

    // Only add assignee if we found the user
    if (assigneeId) {
      issueData.fields.assignee = { id: assigneeId };
    }

    // Only add reporter if we found the user
    if (reporterId) {
      issueData.fields.reporter = { id: reporterId };
    }

    const response = await axios.post(`${config.baseURL}/rest/api/3/issue`, issueData, {
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

// Main execution
async function main() {
  try {
    // Validate configuration
    validateConfig();

    console.log("Comparing translation files...");
    console.log(`  Repository: ${translationConfig.repoPath}`);
    console.log(`  File: ${translationConfig.filePath}`);
    console.log(`  Base branch: ${translationConfig.baseBranch}\n`);

    // Get base and current versions
    const baseContent = getBaseFileContent();
    const currentContent = getCurrentFileContent();

    // Detect new keys
    const newKeys = detectNewKeys(baseContent, currentContent);

    // Generate output
    if (newKeys.length === 0) {
      console.log("No new translation keys detected.");
      return; // Exit early if no keys found
    }

    console.log(`✅ ${newKeys.length} new key${newKeys.length > 1 ? "s" : ""} detected`);
    console.log("");
    console.log(generateMarkdownTable(newKeys));

    // Generate task title
    const taskTitle = newKeys.length > 0
      ? `Localization request – ${newKeys[0].key}`
      : "Localization request";

    // Create ADF table for Jira
    const tableContent = createADFTable(newKeys);

    // Create Jira issue
    const issue = await createJiraIssue(taskTitle, tableContent);

    // Output results
    const issueUrl = `${config.baseURL}/browse/${issue.key}`;

    console.log("\n" + "=".repeat(60));
    console.log("✓ SUCCESS!");
    console.log("=".repeat(60));
    console.log(`Issue Key: ${issue.key}`);
    console.log(`Issue URL: ${issueUrl}`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n✗ Failed to process translation files");
    console.error(error.message);
    process.exit(1);
  }
}

main();
