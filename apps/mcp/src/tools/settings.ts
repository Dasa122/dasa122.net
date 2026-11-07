import {
  settingsUpdateSchema,
  type siteSettingsSchema,
} from "@dasa122/contract";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import type { ApiClient } from "../client";
import { stripUndefined } from "./input";
import { errorResult, textResult } from "./result";

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const getInputSchema = z.object({});

export const updateInputSchema = z.object({
  accent: settingsUpdateSchema.shape.accent.describe(
    "Accent colour; null restores the default.",
  ),
  description: settingsUpdateSchema.shape.description.describe(
    "Site description used for metadata.",
  ),
  enabledSources: settingsUpdateSchema.shape.enabledSources.describe(
    "Feed sources shown on the public site: own, github, linkedin.",
  ),
  githubUsername: settingsUpdateSchema.shape.githubUsername.describe(
    "GitHub account whose activity is shown.",
  ),
  name: settingsUpdateSchema.shape.name.describe("Site or owner name."),
  ogImage: settingsUpdateSchema.shape.ogImage.describe(
    "Open Graph image URL; null clears it.",
  ),
  socials: settingsUpdateSchema.shape.socials.describe(
    "Social links; supply only the keys you want to change.",
  ),
  tagline: settingsUpdateSchema.shape.tagline.describe("Homepage tagline."),
});

export type SettingsUpdateInput = z.infer<typeof updateInputSchema>;

/** GET /admin/settings */
export async function settingsGet(client: ApiClient) {
  try {
    const settings = await client.request<SiteSettings>(
      "GET",
      "/admin/settings",
    );
    return textResult(
      `Site settings for "${settings.name}": ${settings.tagline || "(no tagline)"}. Sources: ${settings.enabledSources.join(", ")}.`,
      { ...settings },
    );
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * PATCH /admin/settings. Only the supplied keys are serialized, because the
 * server merges the patch over the stored settings.
 */
export async function settingsUpdate(
  client: ApiClient,
  input: SettingsUpdateInput,
) {
  try {
    const patch = stripUndefined(input);
    const settings = await client.request<SiteSettings>(
      "PATCH",
      "/admin/settings",
      patch,
    );
    const changed = Object.keys(patch);
    return textResult(
      `Updated site settings (${changed.join(", ") || "no changes"}).`,
      { ...settings },
    );
  } catch (error) {
    return errorResult(error);
  }
}

/** Registers the settings tools on the MCP server. */
export function registerSettingsTools(
  server: McpServer,
  client: ApiClient,
): void {
  server.registerTool(
    "dasa_settings_get",
    {
      annotations: { readOnlyHint: true },
      description:
        "Read the dasa122.net site settings: name, tagline, description, accent, OG image, enabled feed sources, GitHub username and social links.",
      inputSchema: getInputSchema,
      title: "Get site settings",
    },
    () => settingsGet(client),
  );

  server.registerTool(
    "dasa_settings_update",
    {
      annotations: { idempotentHint: true },
      description:
        "Patch the site settings. Only the fields you supply are sent, so every other setting keeps its current value; socials is merged key by key.",
      inputSchema: updateInputSchema,
      title: "Update site settings",
    },
    (input) => settingsUpdate(client, input),
  );
}
