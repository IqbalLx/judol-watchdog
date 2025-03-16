import { sql } from "bun";

export const migrate = async () => {
  try {
    await sql`
    CREATE TABLE IF NOT EXISTS monitored_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        weight INTEGER NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS submitted_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS judol_comments (
        id TEXT PRIMARY KEY,
        serial_id SERIAL,
        channel TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS llm_batches (
        id TEXT PRIMARY KEY,
        jsonl_input_content JSONB NOT NULL,
        detail JSONB NOT NULL,
        jsonl_output_content JSONB,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
        last_checked_at TIMESTAMP WITHOUT TIME ZONE,
        completed_at TIMESTAMP WITHOUT TIME ZONE
    );

    CREATE UNLOGGED TABLE IF NOT EXISTS blocked_words (
        id SERIAL PRIMARY KEY,
        batch TEXT[],
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
        invalidated_at TIMESTAMP WITHOUT TIME ZONE
    );

    CREATE UNLOGGED TABLE IF NOT EXISTS blocked_channels (
        id SERIAL PRIMARY KEY,
        batch TEXT[],
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
        invalidated_at TIMESTAMP WITHOUT TIME ZONE
    );

    CREATE UNLOGGED TABLE IF NOT EXISTS raw_yt_comments (
        id SERIAL PRIMARY KEY,
        page_token TEXT,
        all_threads_related_to_channel_id TEXT,
        part TEXT,
        max_results INTEGER,
        data JSONB,
        expired_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() + '1d'
    )
`.simple();
  } catch (error) {
    console.error(error, "migrate error");
  }
};
