import { migrate } from "./migrate";
import { serve } from "bun";
import { Judol, wrapWithRoot } from "./views";
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
    "/": {
      GET: async () => {
        const [blockedWords, err] = await doGetAllJudolWords();
        if (err !== null)
          return Response.json({ error: err.message }, { status: 500 });

        const [blockedChannels, bcErr] = await doGetAllJudolChannels();
        if (bcErr !== null)
          return Response.json({ error: bcErr.message }, { status: 500 });

        const res = new Response(
          await wrapWithRoot(await Judol(blockedWords, blockedChannels))
        );
        res.headers.set("content-type", "text/html");

        return res;
      },
    },
  },
});
