import { migrate } from "./migrate";
import { serve, type BunRequest } from "bun";
import {
  BlockedChannelSection,
  BlockedWordSection,
  Judol,
  wrapWithRoot,
} from "./views";
import {
  doCheckOngoingLLMBatch,
  doCollectJudolComments,
  doGetAllJudolChannels,
  doGetAllJudolWords,
} from "./service";

await migrate();

process.on("SIGINT", () => {
  console.log("Ctrl-C was pressed");
  process.exit();
});

serve({
  port: 3000,
  idleTimeout: 255,
  routes: {
    "/job/collect-comment": {
      POST: async (req) => {
        const authHeader = req.headers.get("authorization");
        if (authHeader === null)
          return Response.json({ error: "fuck off!" }, { status: 401 });

        if (!authHeader || !authHeader.startsWith("Basic ")) {
          return Response.json({ error: "fuck off!" }, { status: 401 });
        }

        // Decode and split credentials
        const base64Credentials = authHeader.split(" ")[1];
        if (base64Credentials === undefined)
          return Response.json({ error: "fuck off!" }, { status: 401 });

        const credentials = atob(base64Credentials);
        const [inputUser, inputPass] = credentials.split(":");

        // Verify credentials
        if (
          inputUser !== process.env["JOB_USER"] ||
          inputPass !== process.env["JOB_PWD"]
        ) {
          return Response.json({ error: "fuck off!" }, { status: 401 });
        }

        const err = await doCollectJudolComments();
        if (err !== null)
          return Response.json({ error: err.message }, { status: 500 });

        return Response.json({ message: "ok" }, { status: 200 });
      },
    },
    "/job/check-batch": {
      POST: async (req) => {
        const authHeader = req.headers.get("authorization");
        if (authHeader === null)
          return Response.json({ error: "fuck off!" }, { status: 401 });

        if (!authHeader || !authHeader.startsWith("Basic ")) {
          return Response.json({ error: "fuck off!" }, { status: 401 });
        }

        // Decode and split credentials
        const base64Credentials = authHeader.split(" ")[1];
        if (base64Credentials === undefined)
          return Response.json({ error: "fuck off!" }, { status: 401 });

        const credentials = atob(base64Credentials);
        const [inputUser, inputPass] = credentials.split(":");

        // Verify credentials
        if (
          inputUser !== process.env["JOB_USER"] ||
          inputPass !== process.env["JOB_PWD"]
        ) {
          return Response.json({ error: "fuck off!" }, { status: 401 });
        }

        const err = await doCheckOngoingLLMBatch();
        if (err !== null)
          return Response.json({ error: err.message }, { status: 500 });

        return Response.json({ message: "ok" }, { status: 200 });
      },
    },
    "/judol/word/:direction/:id": {
      GET: async (req: BunRequest<"/judol/word/:direction/:id">) => {
        if (!["before", "after"].includes(req.params.direction))
          return Response.json({ error: "fuck off!" }, { status: 403 });

        const [blockedWords, wordFirstID, wordLastID, err] =
          await doGetAllJudolWords(
            Number(req.params.id),
            req.params.direction as "before" | "after"
          );
        if (err !== null)
          return Response.json({ error: err.message }, { status: 500 });

        if (blockedWords.length === 0)
          return Response.json({ error: "no data" }, { status: 400 });

        const res = new Response(
          await BlockedWordSection(blockedWords, wordFirstID, wordLastID)
        );
        res.headers.set("content-type", "text/html");

        return res;
      },
    },
    "/judol/channel/:direction/:id": {
      GET: async (req: BunRequest<"/judol/channel/:direction/:id">) => {
        if (!["before", "after"].includes(req.params.direction))
          return Response.json({ error: "fuck off!" }, { status: 403 });

        const [blockedChannels, channelFirstID, chanelLastID, bcErr] =
          await doGetAllJudolChannels(
            Number(req.params.id),
            req.params.direction as "before" | "after"
          );
        if (bcErr !== null)
          return Response.json({ error: bcErr.message }, { status: 500 });

        if (blockedChannels.length === 0)
          return Response.json({ error: "no data" }, { status: 400 });

        const res = new Response(
          await BlockedChannelSection(
            blockedChannels,
            channelFirstID,
            chanelLastID
          )
        );
        res.headers.set("content-type", "text/html");

        return res;
      },
    },
    "/": {
      GET: async () => {
        const [blockedWords, wordFirstID, wordLastID, err] =
          await doGetAllJudolWords(0, "after");
        if (err !== null)
          return Response.json({ error: err.message }, { status: 500 });

        const [blockedChannels, channelFirstID, chanelLastID, bcErr] =
          await doGetAllJudolChannels(0, "after");
        if (bcErr !== null)
          return Response.json({ error: bcErr.message }, { status: 500 });

        const res = new Response(
          await wrapWithRoot(
            await Judol(
              blockedWords,
              wordFirstID,
              wordLastID,
              blockedChannels,
              channelFirstID,
              chanelLastID
            )
          )
        );
        res.headers.set("content-type", "text/html");

        return res;
      },
    },
  },
});
