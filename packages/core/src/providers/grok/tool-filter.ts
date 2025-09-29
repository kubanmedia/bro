/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool filtering and prioritization logic for Grok provider.
 *
 * This module implements the tool prioritization strategy:
 * 1) Always include all "must-always-work" Essential File System Tools
 * 2) Always include all 5 Chrome tools (if discovered)
 * 3) Include "optional essential" tools next (only if there is room)
 * 4) Fill remaining space with other tools
 */

export interface ToolFilterConfig {
  maxTools: number;
  optionalEssentialsEnabled: boolean;
}

export interface CategorizedTools {
  mustAlwaysWorkEssentials: any[];
  chromeTools: any[];
  optionalEssentials: any[];
  otherTools: any[];
}

export interface FilteredToolsResult {
  limitedTools: any[];
  guaranteedTools: any[];
  remainingSlots: number;
  categorized: CategorizedTools;
}

// Must-always-work essential file system tools
const MUST_ALWAYS_WORK_TOOLS = [
  'write_file',
  'read_file',
  'edit_file',
  'replace',
  'list_directory',
  'run_shell_command',
  'memory',
];

// Optional essential tools (can be temporarily excluded)
const OPTIONAL_ESSENTIAL_TOOLS = [
  'grep',
  'glob',
  'web_search',
  'web_fetch',
  'read_many_files',
];

// Allowed Chrome MCP tools
const ALLOWED_CHROME_TOOLS = [
  'chrome_navigate',
  'chrome_get_interactive_elements',
  'chrome_fill_or_select',
  'chrome_click_element',
  'chrome_get_web_content',
];

/**
 * Categorizes tools into different priority groups.
 */
export function categorizeTools(tools: any[]): CategorizedTools {
  const mustAlwaysWorkEssentials: any[] = [];
  const chromeTools: any[] = [];
  const optionalEssentials: any[] = [];
  const otherTools: any[] = [];

  for (const tool of tools) {
    const name = tool.function?.name;
    if (name?.startsWith('chrome_') && ALLOWED_CHROME_TOOLS.includes(name)) {
      chromeTools.push(tool);
    } else if (MUST_ALWAYS_WORK_TOOLS.includes(name)) {
      mustAlwaysWorkEssentials.push(tool);
    } else if (OPTIONAL_ESSENTIAL_TOOLS.includes(name)) {
      optionalEssentials.push(tool);
    } else if (!name?.startsWith('chrome_')) {
      // Include all non-Chrome tools that aren't essential
      otherTools.push(tool);
    }
  }

  return {
    mustAlwaysWorkEssentials,
    chromeTools,
    optionalEssentials,
    otherTools,
  };
}

/**
 * Filters and prioritizes tools based on the configuration and categorization.
 */
export function filterAndPrioritizeTools(
  tools: any[],
  config: ToolFilterConfig,
): FilteredToolsResult {
  const categorized = categorizeTools(tools);

  // Guaranteed tools: must-always-work essentials + Chrome tools
  const guaranteedTools = [
    ...categorized.mustAlwaysWorkEssentials,
    ...categorized.chromeTools,
  ];

  // Calculate remaining slots after guaranteed tools
  const remainingSlots = Math.max(0, config.maxTools - guaranteedTools.length);

  // Build flexible tools list (optional essentials first, then others)
  const flexibleTools: any[] = [];

  // Include optional essentials if enabled
  if (config.optionalEssentialsEnabled) {
    flexibleTools.push(...categorized.optionalEssentials);
  }

  // Always include other tools after optional essentials
  flexibleTools.push(...categorized.otherTools);

  // Final tool list: guaranteed tools + flexible tools up to remaining slots
  const limitedTools = [
    ...guaranteedTools,
    ...flexibleTools.slice(0, remainingSlots),
  ];

  return {
    limitedTools,
    guaranteedTools,
    remainingSlots,
    categorized,
  };
}

/**
 * Gets the Chrome navigation instruction text if Chrome tools are available.
 */
export function getChromeNavigationInstruction(hasChrome: boolean): string {
  if (!hasChrome) {
    return '';
  }

  return `

CHROME NAVIGATION: When the user asks to navigate to websites, interact with web pages, or browse web content, use the chrome_* tools instead of web_fetch:
- Use 'chrome_navigate' to navigate to URLs or refresh pages
- Use 'chrome_get_interactive_elements' to see clickable elements on a page
- Use 'chrome_click_element' to click on buttons, links, or other elements
- Use 'chrome_fill_or_select' to fill forms or select dropdown options
- Use 'chrome_get_web_content' to get the visible text content from a page
Only use web_fetch as a fallback if Chrome tools are unavailable.`;
}

export {
  MUST_ALWAYS_WORK_TOOLS,
  OPTIONAL_ESSENTIAL_TOOLS,
  ALLOWED_CHROME_TOOLS,
};
