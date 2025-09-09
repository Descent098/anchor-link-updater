import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Notice,
} from "obsidian";

/**
 * Settings interface for HeadingLinkSyncPlugin.
 */
interface HeadingLinkSyncSettings {
  /** Whether the plugin is enabled */
  enabled: boolean;
}

/**
 * Default plugin settings.
 */
const DEFAULT_SETTINGS: HeadingLinkSyncSettings = {
  enabled: true,
};

/**
 * Represents a change in heading text from oldHeading to newHeading.
 */
interface HeadingChange {
  oldHeading: string;
  newHeading: string;
}

/**
 * Main plugin class that synchronizes heading links within a file
 * when headings are renamed.
 */
export default class HeadingLinkSyncPlugin extends Plugin {
  /** Current plugin settings */
  settings: HeadingLinkSyncSettings;

  /** Cache storing headings for each file path */
  private fileHeadingsCache: Map<string, string[]> = new Map();

  /**
   * Called when the plugin is loaded.
   * Loads settings, registers settings tab, and hooks vault modify events.
   */
  async onload() {
    await this.loadSettings();

    // Register the plugin settings tab in the Obsidian settings UI
    this.addSettingTab(new HeadingLinkSyncSettingTab(this.app, this));

    // Register an event handler for file modifications
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        // Only proceed if plugin is enabled
        if (!this.settings.enabled) return;

        // Only proceed if the modified file is a markdown file
        if (!(file instanceof TFile) || file.extension !== "md") return;

        // Read the new content of the file
        const newContent = await this.app.vault.read(file);

        // Extract all headings from the new content
        const newHeadings = this.extractHeadings(newContent);

        // Retrieve old headings from cache
        const oldHeadings = this.fileHeadingsCache.get(file.path);

        // If no cached headings, initialize cache and return early
        if (!oldHeadings) {
          this.fileHeadingsCache.set(file.path, newHeadings);
          return;
        }

        // Determine what headings have changed
        const changes = this.getHeadingChanges(oldHeadings, newHeadings);

        // If no heading changes, just update cache and return early
        if (changes.length === 0) {
          this.fileHeadingsCache.set(file.path, newHeadings);
          return;
        }

        let updatedContent = newContent;

        // Loop through all detected heading changes to update links accordingly
        for (const { oldHeading, newHeading } of changes) {
          // Escape special regex characters in old heading for safe regex usage
          const escapedOldHeading = this.escapeForRegex(oldHeading);

          // Regex to match Obsidian-style heading links:
          // Matches [[#OldHeading]] or [[#OldHeading|Alias]] to preserve alias if present
          const obsidianLinkRegex = new RegExp(
            `\\[\\[#${escapedOldHeading}(\\|[^\\]]+)?\\]\\]`,
            "g"
          );

          // Regex to match markdown inline links of the form (#OldHeading)
          // Typically these don't have an alias
          const markdownLinkRegex = new RegExp(`\\(\\#${escapedOldHeading}\\)`, "g");

          // Replace all matched Obsidian heading links, preserving alias if any
          updatedContent = updatedContent
            .replace(obsidianLinkRegex, (match, aliasPart) => {
              // aliasPart includes the pipe and alias text if present, e.g. "|Wireguard"
              return `[[#${newHeading}${aliasPart ?? ""}]]`;
            })
            // Replace markdown inline links (#OldHeading)
            .replace(markdownLinkRegex, `(#${newHeading})`);

          // Log the replacement details to developer console
          console.log(
            `🔁 Updated links:\n  [[#${oldHeading}]] -> [[#${newHeading}]]\n  (#${oldHeading}) -> (#${newHeading})`
          );
        }

        // If any replacements occurred, write updated content back to the file
        if (updatedContent !== newContent) {
          await this.app.vault.modify(file, updatedContent);
          new Notice("Heading links updated to match renamed headings.");
        }

        // Update cache with the new headings after modification
        this.fileHeadingsCache.set(file.path, newHeadings);
      })
    );
  }

  /**
   * Extracts all headings from markdown content.
   * Matches headings from level 1 to 6 (e.g., # to ######).
   * @param content The markdown content as a string
   * @returns Array of heading strings (without # marks)
   */
  private extractHeadings(content: string): string[] {
    // Regex explanation:
    // ^(#{1,6}) - match 1 to 6 '#' characters at line start (heading marker)
    // \s+       - at least one whitespace after hashes
    // (.*)      - capture the rest of the line (heading text)
    // gm        - global and multiline flags to find all matches in the content
    const headingRegex = /^(#{1,6})\s+(.*)$/gm;
    const headings: string[] = [];
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      // match[2] is the heading text
      headings.push(match[2].trim());
    }
    return headings;
  }

  /**
   * Compares old and new heading arrays to detect heading renames.
   * Works by checking which headings were removed and which were added.
   * If removed and added arrays have the same length, pairs them by index.
   * Otherwise tries to pair by position in the arrays.
   * @param oldHeadings Headings before the file modification
   * @param newHeadings Headings after the file modification
   * @returns Array of HeadingChange objects representing renames
   */
  private getHeadingChanges(
    oldHeadings: string[],
    newHeadings: string[]
  ): HeadingChange[] {
    const changes: HeadingChange[] = [];

    const oldSet = new Set(oldHeadings);
    const newSet = new Set(newHeadings);

    // Headings that were removed from old but not in new
    const removed = oldHeadings.filter((h) => !newSet.has(h));

    // Headings that were added in new but not in old
    const added = newHeadings.filter((h) => !oldSet.has(h));

    // If same number of removed and added, assume renamed pairs in order
    if (removed.length === added.length) {
      for (let i = 0; i < removed.length; i++) {
        changes.push({ oldHeading: removed[i], newHeading: added[i] });
      }
    } else {
      // Fallback: iterate through indexes and pair different headings
      const maxLen = Math.max(oldHeadings.length, newHeadings.length);
      for (let i = 0; i < maxLen; i++) {
        const oldH = oldHeadings[i];
        const newH = newHeadings[i];
        if (oldH && newH && oldH !== newH) {
          changes.push({ oldHeading: oldH, newHeading: newH });
        }
      }
    }

    return changes;
  }

  /**
   * Escapes special characters in a string to safely use it inside a RegExp constructor.
   * @param str Input string to escape
   * @returns Escaped string safe for RegExp
   */
  private escapeForRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Loads plugin settings from storage or defaults.
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Saves current plugin settings to storage.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }
}

/**
 * Settings tab for the Heading Link Sync plugin.
 * Provides UI for toggling the plugin on/off.
 */
class HeadingLinkSyncSettingTab extends PluginSettingTab {
  plugin: HeadingLinkSyncPlugin;

  /**
   * Constructor.
   * @param app Obsidian app instance
   * @param plugin Instance of HeadingLinkSyncPlugin
   */
  constructor(app: App, plugin: HeadingLinkSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Displays the settings tab UI.
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Add a toggle setting for enabling/disabling the plugin
    new Setting(containerEl)
      .setName("Enable Heading Link Sync")
      .setDesc("Toggle automatic updating of heading links in the current file.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async (value) => {
            this.plugin.settings.enabled = value;
            await this.plugin.saveSettings();
            new Notice(`Heading Link Sync ${value ? "enabled" : "disabled"}`);
          })
      );
  }
}
