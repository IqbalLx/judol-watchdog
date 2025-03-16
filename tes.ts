import { migrate } from "./migrate";
import { doCheckOngoingLLMBatch, doCollectJudolComments } from "./service";

// await migrate();

// const err = await doCollectJudolComments();
// if (err !== null) {
//   console.log(err);
// }

const checkErr = await doCheckOngoingLLMBatch();
if (checkErr !== null) {
  console.log(checkErr);
}
