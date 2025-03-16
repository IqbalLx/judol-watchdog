import { migrate } from "./migrate";
import { serve } from "bun";

await migrate();

const html = <div>{String.name}</div>;

serve({
  port: 3000,
  routes: {},
});
