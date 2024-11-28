import { Application, Context, Router } from "@oak/oak";
import ChatServer from "./ChatServer.ts";

const app = new Application();
const port = 8080;
const router = new Router();
const server = new ChatServer();

router.get("/start_web_socket", (ctx: Context) => {
    console.log("Handling connection");
    server.handleConnection(ctx)
});

app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context) => {
    context.response.status = 200;
});

console.log("Listening at http://localhost:" + port);
await app.listen({ port });
