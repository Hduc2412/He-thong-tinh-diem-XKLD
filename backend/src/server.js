import app from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";

async function bootstrap() {
  await connectDb();
  app.listen(env.port, () => {
    console.log(`API running at http://127.0.0.1:${env.port}/api`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
