import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** The GitHub event a generated post was distilled from. Mirrors the
 * contract's `githubMetaSchema`. */
export type GithubMeta = {
  action: string;
  commitSha: string | null;
  language: string | null;
  repo: string;
  stars: number | null;
  url: string;
};

/** The LinkedIn post a generated post mirrors. Mirrors the contract's
 * `linkedinMetaSchema`. */
export type LinkedinMeta = {
  permalink: string;
  postedAt: string | null;
};

export const postsTable = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").unique(),
    title: text("title").notNull(),
    body: text("body"),
    excerpt: text("excerpt"),
    source: text("source").notNull(),
    status: text("status").notNull().default("draft"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    coverImage: text("cover_image"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    githubMeta: jsonb("github_meta").$type<GithubMeta | null>(),
    linkedinMeta: jsonb("linkedin_meta").$type<LinkedinMeta | null>(),
    readTimeMin: integer("read_time_min").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("posts_source_external_id_unique").on(
      table.source,
      table.externalId,
    ),
    index("posts_published_at_idx").on(table.publishedAt),
  ],
);

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body"),
  stack: text("stack").array().notNull().default(sql`'{}'::text[]`),
  repoUrl: text("repo_url"),
  liveUrl: text("live_url"),
  coverImage: text("cover_image"),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  email: text("email"),
  name: text("name"),
  groups: text("groups").array().notNull().default(sql`'{}'::text[]`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const syncStateTable = pgTable("sync_state", {
  source: text("source").primaryKey(),
  cursor: text("cursor"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mediaTable = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tables = {
  media: mediaTable,
  posts: postsTable,
  projects: projectsTable,
  sessions: sessionsTable,
  settings: settingsTable,
  syncState: syncStateTable,
};
