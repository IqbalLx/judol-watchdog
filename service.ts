import { youtube } from "@googleapis/youtube";
import { sql, file, randomUUIDv7 } from "bun";
import {
  checkBatchStatus,
  createBatchJob,
  getBatchFileOutput,
  readJSONL,
  uploadJsonl,
  writeJSONL,
} from "./groq";

type Channel = {
  id: string;
  name: string;
  weight: number;
};

type Comment = {
  id: string;
  channel: string;
  text: string;
};

type LLMBatch = {
  id: string;
};

async function getMonitoredChannels(): Promise<
  [channels: Channel[], error: Error | null]
> {
  try {
    const channels = await sql`
            SELECT 
                id,
                name,
                weight
            FROM monitored_channels
            ORDER BY weight asc;`.values();

    const fmtChannels = channels.map(
      (channel: [id: string, name: string, weight: number]) => ({
        id: channel[0],
        name: channel[1],
        weight: channel[2],
      })
    );

    return [fmtChannels, null];
  } catch (error) {
    return [[], error as Error];
  }
}

async function getActiveLLMBatch(): Promise<
  [batch: LLMBatch | undefined, error: Error | null]
> {
  try {
    const batches = await sql`
            SELECT 
                id
            FROM llm_batches
            WHERE completed_at IS NULL
            LIMIT 1;`.values();

    if (batches.length === 0) return [undefined, null];

    const batchID = batches[0][0];

    return [{ id: batchID }, null];
  } catch (error) {
    return [undefined, error as Error];
  }
}

function distributeUnits(
  resources: Channel[],
  totalUnits: number
): Map<string, number> {
  const totalWeight = resources.reduce(
    (sum, resource) => sum + resource.weight,
    0
  );

  // Map to store the number of units allocated for each resource
  const resourceUnits = new Map<string, number>();

  // Distribute units based on weight
  for (const resource of resources) {
    const allocatedUnits = Math.round(
      (resource.weight / totalWeight) * totalUnits
    );
    resourceUnits.set(resource.id, allocatedUnits);
  }

  // In case of rounding errors, adjust the remaining units
  let allocatedTotal = Object.values(resourceUnits).reduce(
    (sum, units) => sum + units,
    0
  );
  const remainingUnits = totalUnits - allocatedTotal;

  // Adjust the resources to distribute the remaining units
  for (let i = 0; i < remainingUnits; i++) {
    // Sort resources by weight in descending order to give more units to higher weight
    const highestWeightResource = resources
      .sort((a, b) => b.weight - a.weight)
      .find(
        (resource) =>
          (resourceUnits.get(resource.id) ?? 0) <
          Math.ceil((resource.weight / totalWeight) * totalUnits)
      );

    if (highestWeightResource) {
      const currUnit = resourceUnits.get(highestWeightResource.id) ?? 0;
      resourceUnits.set(highestWeightResource.id, currUnit + 1);
    }
  }

  return resourceUnits;
}

function getYTInstance() {
  return youtube({
    version: "v3",
    auth: process.env["YOUTUBE_API_KEY"],
  });
}

export async function collectComments(
  channelID: string,
  quota: number,
  maxCommentsPerFetch = 100
) {
  const rawComments: Comment[] = [];
  try {
    const yt = getYTInstance();

    let pageToken = undefined;
    for (let index = 0; index < quota; index++) {
      console.time(`processing ${index}/${quota} for channel ${channelID}`);

      let data: any;

      const caches = await sql`
        SELECT data
        FROM raw_yt_comments 
        WHERE 
          page_token = ${pageToken ?? null} AND
          all_threads_related_to_channel_id = ${channelID} AND
          part = 'snippet' AND
          max_results = ${maxCommentsPerFetch} AND
          expired_at > NOW()
        LIMIT 1`.values();

      if (caches.length === 0) {
        const comments = await yt.commentThreads.list({
          pageToken,
          allThreadsRelatedToChannelId: channelID,
          part: "snippet",
          maxResults: maxCommentsPerFetch,
        });

        data = comments.data;

        await sql`
        INSERT INTO raw_yt_comments ${sql({
          page_token: pageToken ?? null,
          all_threads_related_to_channel_id: channelID,
          part: "snippet",
          max_results: maxCommentsPerFetch,
          data: JSON.stringify(data),
        })}`;
      } else {
        data = JSON.parse(caches[0]);
      }

      pageToken = data.nextPageToken;

      data.items.forEach(
        (item: { snippet: { topLevelComment: { snippet: any; id: any } } }) => {
          const snippet = item.snippet.topLevelComment.snippet;
          rawComments.push({
            id: item.snippet.topLevelComment.id,
            channel: snippet.authorChannelUrl,
            text: snippet.textOriginal,
          });
        }
      );

      console.timeEnd(`processing ${index}/${quota} for channel ${channelID}`);
    }

    return rawComments;
  } catch (error) {
    console.error(error);
    return rawComments;
  }
}

export function containsFancyUnicode(text: string): boolean {
  const fancyUnicodeRegex =
    /[\u{1D400}-\u{1D7FF}\u{2100}-\u{214F}\u{2460}-\u{24FF}\u{1F110}-\u{1F12F}\u0400-\u04FF]/u;
  return fancyUnicodeRegex.test(text);
}

export function batchArray<T>(array: T[], batchSize: number = 5): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

export function getLLMConfig(judolComments: string[]) {
  return {
    custom_id: randomUUIDv7(),
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      max_completion_tokens: 1024,
      temperature: 1,
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an assistant to help reduce illegal online-gamble promotion in youtube comments.
You will be provided an array of youtube comments inside <comment> tag.
You need to extract exact word from given comments that are highly possible to be the online-gambling name.
Do not hallucinate, only response with text within provided comments.

Examples:

<comment>
Buat yang belum coba, kalian harus coba sekarang juga di 𝘼𝘌𝐑𝘖𝟴𝟪!
Gacir banget tiap main di АHMA𝘿𝑇O𝙏𝐎,nggak pernah bikin kecewa!
Nggak salah pilih main di 𝐴𝐆U𝐒𝑇O𝘛О,rezekinya ngalir terus. Top banget!
Gak ada yang tau kapan rezeki datang, tapi di A𝐆𝑈𝑆T𝐎𝘛О,semuanya bisa terjadi!
Hasil gacir bikin aku makin puas main di 𝐀𝙀𝙍𝙊𝟴𝟾,makasih banyak!
АGU𝑆𝑇𝑂𝑇Omenawarkan berbagai fitur yang menarik bagi sebagian pemain.
Main bentar langsung gacir. Rezeki nggak bisa diprediksi di D𝑂𝙍A7𝟩!
𝐦𝐚𝐢𝐧 𝐝𝐢 sini 𝐠𝐚𝐜𝐨𝐫 𝐡𝐚𝐛𝐢𝐬 𝐛𝐚𝐫𝐮 𝐬𝐚𝐣𝐚 𝐦𝐚𝐢𝐧 𝐬𝐮𝐝𝐚𝐡 𝐝𝐢 𝐤𝐚𝐬𝐢 𝐦𝐚𝐱𝐰𝐢𝐧 𝐢 𝐥𝐨𝐯𝐞 𝐲𝐨𝐮 sawer4d 𝐞𝐦𝐦𝐦𝐦𝐮𝐚𝐚𝐚𝐡𝐡.
<comment/>

𝘼𝘌𝐑𝘖𝟴𝟪,АHMA𝘿𝑇O𝙏𝐎,𝐴𝐆U𝐒𝑇O𝘛О,A𝐆𝑈𝑆T𝐎𝘛О,𝐀𝙀𝙍𝙊𝟴𝟾,АGU𝑆𝑇𝑂𝑇O,D𝑂𝙍A7𝟩,sawer4d`,
        },
        {
          role: "user",
          content: "<comment>" + judolComments.join("\n") + "</comment>",
        },
      ],
    },
  };
}

/**
 * Convert an array of strings to a PostgreSQL curly-brace array literal
 * @param values Array of strings
 */
function toPgCurlyBraceArray(values: string[]): string {
  const unique = new Set(values);
  const escapedValues = [...unique].map((v) => `"${v.replace(/"/g, '\\"')}"`); // Escape double quotes
  return `{${escapedValues.join(",")}}`;
}

/**
 * Generate SQL INSERT statement for blocked_channels with batch column.
 * @param data Object containing blockedChannels array
 * @returns SQL string for insert statement
 */
export function batchInsertForTextArrColumn(
  tableName: string,
  data: { batch: string }[]
): string {
  const column = "batch";

  // Map each batch string into a properly quoted SQL value
  const values = data.map((item) => {
    const batch = item.batch.replace(/'/g, "''"); // Escape single quotes if any
    return `('${batch}')`;
  });

  // Join all value rows into a single INSERT query
  const query = `INSERT INTO ${tableName} (${column})\nVALUES\n${values.join(
    ",\n"
  )};`;

  return query;
}

export async function doCollectJudolComments(): Promise<Error | null> {
  const [activeBatch, activeBatchErr] = await getActiveLLMBatch();
  if (activeBatchErr !== null)
    return new Error(`get active batch db errored: ${activeBatchErr.message}`);

  // allow one batch a time to reduce cost
  if (activeBatch !== undefined) return null;

  const [channels, channelErr] = await getMonitoredChannels();
  if (channelErr !== null)
    return new Error(`get channel db errored: ${channelErr.message}`);

  const YT_QUOTA_UNITS_LIMIT = 10_000;
  const MAX_COMMENT_PER_FETCH = 100;
  const COMMENT_EACH_BATCH = 50;
  const BATCH_COMPLETION_WINDOW = "168h";

  const distributedCommentQuotas = distributeUnits(
    channels,
    YT_QUOTA_UNITS_LIMIT
  );

  let poolRawComments: Comment[] = [];
  for (const channel of channels) {
    console.time(`collecting comments for ${channel.name} (${channel.id})`);
    const rawCommentsOnChannel = await collectComments(
      channel.id,
      distributedCommentQuotas.get(channel.id) ?? 0,
      MAX_COMMENT_PER_FETCH
    );

    poolRawComments = [...poolRawComments, ...rawCommentsOnChannel];
    console.timeEnd(`collecting comments for ${channel.name}`);
  }

  const judolComments = poolRawComments.filter((comment) =>
    containsFancyUnicode(comment.text)
  );

  if (judolComments.length === 0) return null;

  const batchedJudolComments = batchArray(judolComments, COMMENT_EACH_BATCH);

  const blockedChannels = batchedJudolComments.map((batchedJudolComment) => ({
    batch: toPgCurlyBraceArray(
      batchedJudolComment.map((comment) => comment.channel)
    ),
  }));

  // persist comments and channel first
  console.time(`saving judol comments`);
  try {
    for (const judolComment of batchedJudolComments) {
      await sql`INSERT INTO judol_comments ${sql(
        judolComment
      )} ON CONFLICT (id) DO NOTHING;`;
    }

    await sql`UPDATE blocked_channels SET invalidated_at = NOW();`;
    for (const blockedChannel of blockedChannels) {
      await sql.unsafe(
        batchInsertForTextArrColumn("blocked_channels", [blockedChannel])
      );
    }
  } catch (error) {
    console.error(error);
    return new Error(
      `persisting comment n channel db errored: ${(error as Error).message}`
    );
  }
  console.timeEnd(`saving judol comments`);

  // prepare LLM batch to extract blocked judol words
  console.time(`groq batch processing`);
  const configs = batchedJudolComments.map((batchedJudolComment) =>
    getLLMConfig(batchedJudolComment.map((comment) => comment.text))
  );

  const filepath = `./tmp/judol_${randomUUIDv7()}.jsonl`;
  await writeJSONL(filepath, configs);

  const [uploadRes, uploadErr] = await uploadJsonl(filepath);
  if (uploadErr !== null) {
    return new Error(`groq errored: ${uploadErr.message}`);
  }

  const groqFileID = (uploadRes as { id: string }).id;
  const [batchRes, batchErr] = await createBatchJob(
    groqFileID,
    BATCH_COMPLETION_WINDOW
  );

  if (batchErr !== null) {
    return new Error(`groq errored: ${batchErr.message}`);
  }
  console.timeEnd(`groq batch processing`);

  // persist LLM batch
  console.time(`saving groq batch processing`);
  try {
    await sql`INSERT INTO llm_batches ${sql({
      id: (batchRes as { id: string }).id,
      jsonl_input_content: JSON.stringify(configs),
      detail: JSON.stringify(batchRes),
    })};`;
  } catch (error) {
    return new Error(
      `persisting llm batch db errored: ${(error as Error).message}`
    );
  }

  await file(filepath).delete();
  console.timeEnd(`saving groq batch processing`);

  return null;
}

export async function doCheckOngoingLLMBatch(): Promise<Error | null> {
  const [batch, batchErr] = await getActiveLLMBatch();
  if (batchErr !== null)
    return new Error(`get active batch db errored: ${batchErr.message}`);

  if (batch === undefined) return null;

  const [batchDetail, batchDetailErr] = await checkBatchStatus(batch.id);
  if (batchDetailErr !== null)
    return new Error(`groq errored: ${batchDetailErr.message}`);

  await sql`UPDATE llm_batches SET detail = ${JSON.stringify(
    batchDetail
  )}, last_checked_at = NOW() WHERE id = ${batch.id};`;

  // validating	batch file is being validated before the batch processing begins
  // failed	batch file has failed the validation process
  // in_progress	batch file was successfully validated and the batch is currently being run
  // finalizing	batch has completed and the results are being prepared
  // completed	batch has been completed and the results are ready
  // expired	batch was not able to be completed within the 24-hour time window
  // cancelling	batch is being cancelled (may take up to 10 minutes)
  // cancelled	batch was cancelled
  type status =
    | "validating"
    | "failed"
    | "in_progress"
    | "finalizing"
    | "completed"
    | "expired"
    | "cancelling"
    | "cancelled";
  const batchRes = batchDetail as {
    status: status;
    output_file_id: string | null;
  };

  if (
    (
      ["validating", "in_progress", "finalizing", "cancelling"] as status[]
    ).includes(batchRes.status)
  ) {
    return null;
  }

  if (
    (["failed", "expired", "cancelled"] as status[]).includes(batchRes.status)
  ) {
    await sql`UPDATE llm_batches SET completed_at = NOW() WHERE id = ${batch.id};`;
    return null;
  }

  // if completed
  if (batchRes.output_file_id === null)
    return new Error(`groq errored: got null output_file_id`);

  await getBatchFileOutput(batchRes.output_file_id);

  const filepath = `./tmp/${batch.id}_output.jsonl`;
  const llmResponses = await readJSONL(filepath);

  const blockedWords = llmResponses.map((llmResponse) => {
    const rawWords = (llmResponse as any).response.body.choices[0].message
      .content as string;
    const arrWords = rawWords.split(", ");
    return {
      batch: toPgCurlyBraceArray(arrWords),
    };
  });

  await sql`UPDATE blocked_words SET invalidated_at = NOW()`;

  for (const blockedWord of blockedWords) {
    await sql.unsafe(
      batchInsertForTextArrColumn("blocked_words", [blockedWord])
    );
  }

  await sql`UPDATE llm_batches SET jsonl_output_content = ${JSON.stringify(
    llmResponses
  )}, completed_at = NOW() WHERE id = ${batch.id};`;

  await file(filepath).delete();

  return null;
}

export async function doGetAllJudolChannels(
  id: number,
  direction: "before" | "after"
): Promise<
  [data: string[][], firstID: number, lastID: number, error: Error | null]
> {
  try {
    const blockedChannels = await sql`SELECT batch, id FROM blocked_channels 
      WHERE invalidated_at IS NULL AND
        id ${sql.unsafe(direction === "before" ? "<" : ">")} ${id}
      ORDER BY id ${sql.unsafe(direction === "before" ? "DESC" : "ASC")}
      LIMIT 1;`.values();

    if (blockedChannels.length === 0) return [[], 0, 0, null];

    const fmtBlockedChannels: string[][] = blockedChannels.map(
      (blockedChannel: string[][]) => blockedChannel[0]
    );

    const firstID = Number(blockedChannels[0][1]);
    const lastID = Number(blockedChannels[blockedChannels.length - 1][1]);

    return [fmtBlockedChannels, firstID, lastID, null];
  } catch (error) {
    return [[], 0, 0, error as Error];
  }
}

export async function doGetAllJudolWords(
  id: number,
  direction: "before" | "after"
): Promise<
  [data: string[][], firstID: number, lastID: number, error: Error | null]
> {
  try {
    const blockedWords = await sql`SELECT batch, id FROM blocked_words 
      WHERE invalidated_at IS NULL AND
        id ${sql.unsafe(direction === "before" ? "<" : ">")} ${id}
      ORDER BY id ${sql.unsafe(direction === "before" ? "DESC" : "ASC")}
      LIMIT 6;`.values();

    if (blockedWords.length === 0) return [[], 0, 0, null];

    const fmtBlockedWords: string[][] = blockedWords.map(
      (blockedWord: string[][]) => blockedWord[0]
    );

    const firstID = Number(blockedWords[0][1]);
    const lastID = Number(blockedWords[blockedWords.length - 1][1]);

    return [
      direction === "before" ? fmtBlockedWords.reverse() : fmtBlockedWords,
      Math.min(firstID, lastID),
      Math.max(firstID, lastID),
      null,
    ];
  } catch (error) {
    return [[], 0, 0, error as Error];
  }
}
