import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import { Application } from "@oak/oak";
import ChatServer from "./ChatServer.ts";
import { MessagingServer } from "./types.ts";

const app = new Application();

app.use((ctx) => {
    ctx.response.body = "Hello World!";
});

const io: MessagingServer = new Server();
const chatServer = new ChatServer(io);

io.on("connection", chatServer.handleConnection);

const handler = io.handler(async (req) => {
    console.log('rcv request', req);
    return await app.handle(req) || new Response(null, { status: 404 });
});

await serve(handler, {
    port: 3000,
});