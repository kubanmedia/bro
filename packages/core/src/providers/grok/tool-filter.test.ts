/**
 * @license
 * Copyright 2025 Google LLC
 * Modifications Copyright 2025 ANUS Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  categorizeTools,
  filterAndPrioritizeTools,
  getChromeNavigationInstruction,
  MUST_ALWAYS_WORK_TOOLS,
  OPTIONAL_ESSENTIAL_TOOLS,
  ALLOWED_CHROME_TOOLS,
  type ToolFilterConfig,
} from './tool-filter.js';

describe('Tool Filter', () => {
  const createTool = (name: string) => ({ function: { name } });

  describe('categorizeTools', () => {
    it('should categorize must-always-work essential tools correctly', () => {
      const tools = [
        createTool('write_file'),
        createTool('read_file'),
        createTool('edit_file'),
        createTool('replace'),
        createTool('list_directory'),
        createTool('run_shell_command'),
        createTool('memory'),
        createTool('some_other_tool'),
      ];

      const result = categorizeTools(tools);

      expect(result.mustAlwaysWorkEssentials).toHaveLength(7);
      expect(
        result.mustAlwaysWorkEssentials.map((t) => t.function.name),
      ).toEqual([
        'write_file',
        'read_file',
        'edit_file',
        'replace',
        'list_directory',
        'run_shell_command',
        'memory',
      ]);
      expect(result.otherTools).toHaveLength(1);
      expect(result.otherTools[0].function.name).toBe('some_other_tool');
    });

    it('should categorize Chrome tools correctly', () => {
      const chromeTools = [
        createTool('chrome_navigate'),
        createTool('chrome_get_interactive_elements'),
        createTool('chrome_fill_or_select'),
        createTool('chrome_click_element'),
        createTool('chrome_get_web_content'),
        createTool('chrome_unknown_tool'), // Should be excluded
        createTool('not_chrome_tool'),
      ];

      const result = categorizeTools(chromeTools);

      expect(result.chromeTools).toHaveLength(5);
      expect(result.chromeTools.map((t) => t.function.name)).toEqual(
        ALLOWED_CHROME_TOOLS,
      );
      expect(result.otherTools).toHaveLength(1); // not_chrome_tool
      expect(result.otherTools[0].function.name).toBe('not_chrome_tool');
    });

    it('should categorize optional essential tools correctly', () => {
      const tools = [
        createTool('grep'),
        createTool('glob'),
        createTool('web_search'),
        createTool('web_fetch'),
        createTool('read_many_files'),
        createTool('some_other_tool'),
      ];

      const result = categorizeTools(tools);

      expect(result.optionalEssentials).toHaveLength(5);
      expect(result.optionalEssentials.map((t) => t.function.name)).toEqual(
        OPTIONAL_ESSENTIAL_TOOLS,
      );
      expect(result.otherTools).toHaveLength(1);
      expect(result.otherTools[0].function.name).toBe('some_other_tool');
    });

    it('should handle mixed tool types correctly', () => {
      const tools = [
        createTool('write_file'), // must-always-work
        createTool('chrome_navigate'), // chrome
        createTool('grep'), // optional essential
        createTool('some_other_tool'), // other
        createTool('chrome_unknown'), // unknown chrome (excluded)
        createTool('memory'), // must-always-work
      ];

      const result = categorizeTools(tools);

      expect(result.mustAlwaysWorkEssentials).toHaveLength(2);
      expect(result.chromeTools).toHaveLength(1);
      expect(result.optionalEssentials).toHaveLength(1);
      expect(result.otherTools).toHaveLength(1);
    });
  });

  describe('filterAndPrioritizeTools', () => {
    const config: ToolFilterConfig = {
      maxTools: 10,
      optionalEssentialsEnabled: true,
    };

    it('should guarantee inclusion of must-always-work tools and Chrome tools', () => {
      const tools = [
        // Must always work (7 tools)
        createTool('write_file'),
        createTool('read_file'),
        createTool('edit_file'),
        createTool('replace'),
        createTool('list_directory'),
        createTool('run_shell_command'),
        createTool('memory'),
        // Chrome tools (5 tools) = 12 total guaranteed
        createTool('chrome_navigate'),
        createTool('chrome_get_interactive_elements'),
        createTool('chrome_fill_or_select'),
        createTool('chrome_click_element'),
        createTool('chrome_get_web_content'),
        // Optional essentials
        createTool('grep'),
        createTool('glob'),
        // Other tools
        createTool('other_tool_1'),
        createTool('other_tool_2'),
      ];

      const result = filterAndPrioritizeTools(tools, config);

      // Should include all 12 guaranteed tools even though maxTools is 10
      expect(result.guaranteedTools).toHaveLength(12);
      expect(result.limitedTools).toHaveLength(12); // No room for flexible tools
      expect(result.remainingSlots).toBe(0); // Math.max(0, 10 - 12) = 0

      // Verify all essential and Chrome tools are included
      const toolNames = result.limitedTools.map((t) => t.function.name);
      MUST_ALWAYS_WORK_TOOLS.forEach((name) => {
        expect(toolNames).toContain(name);
      });
      ALLOWED_CHROME_TOOLS.forEach((name) => {
        expect(toolNames).toContain(name);
      });
    });

    it('should include optional essentials when there is room and they are enabled', () => {
      const tools = [
        createTool('write_file'), // must-always-work (1)
        createTool('chrome_navigate'), // chrome (1) = 2 guaranteed
        createTool('grep'), // optional essential
        createTool('web_search'), // optional essential
        createTool('other_tool'), // other
      ];

      const result = filterAndPrioritizeTools(tools, {
        maxTools: 6,
        optionalEssentialsEnabled: true,
      });

      expect(result.guaranteedTools).toHaveLength(2);
      expect(result.remainingSlots).toBe(4); // 6 - 2 = 4
      expect(result.limitedTools).toHaveLength(5); // 2 guaranteed + 2 optional + 1 other

      const toolNames = result.limitedTools.map((t) => t.function.name);
      expect(toolNames).toContain('write_file'); // guaranteed
      expect(toolNames).toContain('chrome_navigate'); // guaranteed
      expect(toolNames).toContain('grep'); // optional essential
      expect(toolNames).toContain('web_search'); // optional essential
      expect(toolNames).toContain('other_tool'); // other
    });

    it('should exclude optional essentials when disabled', () => {
      const tools = [
        createTool('write_file'), // must-always-work
        createTool('chrome_navigate'), // chrome
        createTool('grep'), // optional essential (should be excluded)
        createTool('web_search'), // optional essential (should be excluded)
        createTool('other_tool_1'), // other
        createTool('other_tool_2'), // other
      ];

      const result = filterAndPrioritizeTools(tools, {
        maxTools: 6,
        optionalEssentialsEnabled: false,
      });

      expect(result.guaranteedTools).toHaveLength(2);
      expect(result.remainingSlots).toBe(4);
      expect(result.limitedTools).toHaveLength(4); // 2 guaranteed + 2 other (no optional essentials)

      const toolNames = result.limitedTools.map((t) => t.function.name);
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('chrome_navigate');
      expect(toolNames).toContain('other_tool_1');
      expect(toolNames).toContain('other_tool_2');
      expect(toolNames).not.toContain('grep');
      expect(toolNames).not.toContain('web_search');
    });

    it('should prioritize optional essentials over other tools when enabled', () => {
      const tools = [
        createTool('write_file'), // guaranteed (1)
        createTool('grep'), // optional essential
        createTool('glob'), // optional essential
        createTool('web_search'), // optional essential
        createTool('other_tool_1'), // other
        createTool('other_tool_2'), // other
        createTool('other_tool_3'), // other
      ];

      const result = filterAndPrioritizeTools(tools, {
        maxTools: 5,
        optionalEssentialsEnabled: true,
      });

      expect(result.guaranteedTools).toHaveLength(1);
      expect(result.remainingSlots).toBe(4);
      expect(result.limitedTools).toHaveLength(5);

      const toolNames = result.limitedTools.map((t) => t.function.name);
      expect(toolNames).toContain('write_file'); // guaranteed
      expect(toolNames).toContain('grep'); // optional essential (prioritized)
      expect(toolNames).toContain('glob'); // optional essential (prioritized)
      expect(toolNames).toContain('web_search'); // optional essential (prioritized)
      expect(toolNames).toContain('other_tool_1'); // other (fills remaining slot)
      expect(toolNames).not.toContain('other_tool_2'); // excluded due to limit
      expect(toolNames).not.toContain('other_tool_3'); // excluded due to limit
    });

    it('should handle case with no Chrome tools present', () => {
      const tools = [
        createTool('write_file'),
        createTool('read_file'),
        createTool('grep'),
        createTool('other_tool'),
      ];

      const result = filterAndPrioritizeTools(tools, config);

      expect(result.categorized.chromeTools).toHaveLength(0);
      expect(result.guaranteedTools).toHaveLength(2); // Only must-always-work tools
      expect(result.limitedTools).toHaveLength(4); // All tools fit within limit
    });

    it('should handle empty tool list', () => {
      const result = filterAndPrioritizeTools([], config);

      expect(result.limitedTools).toHaveLength(0);
      expect(result.guaranteedTools).toHaveLength(0);
      expect(result.remainingSlots).toBe(config.maxTools);
    });
  });

  describe('getChromeNavigationInstruction', () => {
    it('should return Chrome navigation instruction when Chrome tools are present', () => {
      const instruction = getChromeNavigationInstruction(true);

      expect(instruction).toContain('CHROME NAVIGATION');
      expect(instruction).toContain('chrome_navigate');
      expect(instruction).toContain('chrome_get_interactive_elements');
      expect(instruction).toContain('chrome_click_element');
      expect(instruction).toContain('web_fetch as a fallback');
    });

    it('should return empty string when Chrome tools are not present', () => {
      const instruction = getChromeNavigationInstruction(false);
      expect(instruction).toBe('');
    });
  });

  describe('Constants', () => {
    it('should have the correct must-always-work tools', () => {
      expect(MUST_ALWAYS_WORK_TOOLS).toEqual([
        'write_file',
        'read_file',
        'edit_file',
        'replace',
        'list_directory',
        'run_shell_command',
        'memory',
      ]);
    });

    it('should have the correct optional essential tools', () => {
      expect(OPTIONAL_ESSENTIAL_TOOLS).toEqual([
        'grep',
        'glob',
        'web_search',
        'web_fetch',
        'read_many_files',
      ]);
    });

    it('should have the correct allowed Chrome tools', () => {
      expect(ALLOWED_CHROME_TOOLS).toEqual([
        'chrome_navigate',
        'chrome_get_interactive_elements',
        'chrome_fill_or_select',
        'chrome_click_element',
        'chrome_get_web_content',
      ]);
    });
  });
});
