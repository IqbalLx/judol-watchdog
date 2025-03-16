// Environment variables
const BASE_URL = process.env.GROQ_BASE_URL!;
const API_KEY = process.env.GROQ_API_KEY!;

// Helper for headers
const defaultHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

/**
 * Upload a JSONL file.
 * @param filePath Path to the file
 * @param purpose Purpose of the upload (default: "batch")
 * @returns [data, error]
 */
export async function uploadJsonl(
  filePath: string,
  purpose = "batch"
): Promise<[data: unknown, error: Error | null]> {
  try {
    const form = new FormData();
    form.append("file", Bun.file(filePath));
    form.append("purpose", purpose);

    const response = await fetch(`${BASE_URL}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form,
    });

    return [await response.json(), null];
  } catch (error) {
    return [
      undefined,
      new Error(`groq uploadJsonl errored: ${(error as Error).message}`),
    ];
  }
}

/**
 * Create a batch job.
 * @param inputFileId ID of the input file
 * @param endpoint API endpoint (default: "/v1/chat/completions")
 * @param completionWindow Completion window (default: "24h")
 * @returns [data, error]
 */
export async function createBatchJob(
  inputFileId: string,
  completionWindow = "24h",
  endpoint = "/v1/chat/completions"
): Promise<[data: unknown, error: Error | null]> {
  try {
    const body = JSON.stringify({
      input_file_id: inputFileId,
      endpoint,
      completion_window: completionWindow,
    });

    const response = await fetch(`${BASE_URL}/batches`, {
      method: "POST",
      headers: defaultHeaders,
      body,
    });

    return [await response.json(), null];
  } catch (error) {
    return [
      undefined,
      new Error(`groq createBatchJob errored: ${(error as Error).message}`),
    ];
  }
}

/**
 * Check batch status.
 * @param batchId Batch job ID
 * @returns [data, error]
 */
export async function checkBatchStatus(
  batchId: string
): Promise<[data: unknown, error: Error | null]> {
  try {
    const response = await fetch(`${BASE_URL}/batches/${batchId}`, {
      method: "GET",
      headers: defaultHeaders,
    });

    return [await response.json(), null];
  } catch (error) {
    return [
      undefined,
      new Error(`groq checkBatchStatus errored: ${(error as Error).message}`),
    ];
  }
}

/**
 * List all batches.
 * @returns [data, error]
 */
export async function listBatches(): Promise<
  [data: unknown, error: Error | null]
> {
  try {
    const response = await fetch(`${BASE_URL}/batches`, {
      method: "GET",
      headers: defaultHeaders,
    });

    return [await response.json(), null];
  } catch (error) {
    return [
      undefined,
      new Error(`groq listBatches errored: ${(error as Error).message}`),
    ];
  }
}

/**
 * Extract filename from Content-Disposition header
 * @param contentDisposition Content-Disposition header value
 * @returns Filename string or null if not found
 */
export function parseFilename(contentDisposition: string): string | null {
  const match = contentDisposition.match(/filename="(.+?)"/);
  if (match === null) return null;
  return match[1] ?? null;
}

/**
 * Get batch file output content.
 * @param batchFileOutputId ID of the batch file output
 * @returns [data, error]
 */
export async function getBatchFileOutput(
  batchFileOutputId: string
): Promise<Error | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/files/${batchFileOutputId}/content`,
      {
        method: "GET",
        headers: defaultHeaders,
      }
    );

    if (!response.headers.get("content-type")?.includes("application/jsonl")) {
      return new Error(
        `groq getBatchFileOutput errored: response header not JSONL formatted`
      );
    }

    const contentDisposition = response.headers.get("content-disposition");
    if (contentDisposition === null)
      return new Error(
        `groq getBatchFileOutput errored: response header not having content disposition header set`
      );

    const filename = parseFilename(contentDisposition);
    if (filename === null)
      return new Error(
        `groq getBatchFileOutput errored: content disposition header not having filename set`
      );

    await Bun.write(`./tmp/${filename}`, response);

    return null;
  } catch (error) {
    return new Error(
      `groq getBatchFileOutput errored: ${(error as Error).message}`
    );
  }
}

/**
 * Read JSONL file and return as array of JSON objects
 * @param filePath Path to the .jsonl file
 * @returns Array of JSON objects
 */
export async function readJSONL(filePath: string): Promise<unknown[]> {
  const file = Bun.file(filePath);
  const content = await file.text();
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  const jsonArray = lines
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.error(`Failed to parse JSON on line ${index + 1}:`, error);
        return null;
      }
    })
    .filter((item) => item !== null); // Filter out unknown failed JSON parses

  return jsonArray;
}

/**
 * Write array of JSON objects to a JSONL file
 * @param filePath Path to save the .jsonl file
 * @param data Array of JSON objects
 */
export async function writeJSONL(
  filePath: string,
  data: unknown[]
): Promise<void> {
  const lines = data.map((obj) => JSON.stringify(obj));
  const content = lines.join("\n") + "\n"; // Add newline at the end
  await Bun.write(filePath, content);
}
