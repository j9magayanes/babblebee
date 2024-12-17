import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import { Application, Router } from "@oak/oak";
import ChatServer from "./ChatServer.ts";
import { MessagingServer } from "./types.ts";
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types.ts'

const supabase = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_KEY')!);

const io: MessagingServer = new Server({
    cors: {
        origin: "*"
    }
}
);
const chatServer = new ChatServer(io, supabase);
const app = new Application();
const roomsRouter = new Router({
    prefix: '/room',
});
const usersRouter = new Router({
    prefix: '/user',
});

function getResponseOnDB(obj: any, response: any) {
    if (obj.error) {
        response.status = 400;
        response.body = obj.error.message;
        return false;
    } else {
        response.status = 200;
        response.body = obj.data;
        return true;
    }
}

roomsRouter.post('/create', async (ctx) => {
    const body = await ctx.request.body.json();
    const newRoom = await supabase.from('chat_rooms').insert({
        display_name: body.displayName,
        name: body.name,
        room_languages: [],
    });

    getResponseOnDB(newRoom, ctx.response);
});


roomsRouter.post('/join/:id', async (ctx) => {
    const userId = ctx.request.headers.get('user-id');
    if (!userId) {
        ctx.response.status = 400;
        ctx.response.body = 'User ID not provided';
        return;
    }
    const user = await supabase.from('users').select().eq('id', userId).single();
    if (!getResponseOnDB(user, ctx.response)) return;

    const userData = user.data!;

    const room = await supabase.from('chat_rooms').select().eq('id', ctx.params.id).single();
    if (!getResponseOnDB(room, ctx.response)) return;
    const roomData = room.data!;

    supabase.from('chat_members').insert({
        user_id: userData.id,
        room_id: roomData.id,
    });

    supabase.from('chat_rooms').update({
        room_languages: [...roomData.room_languages ?? [], userData.language],
    })

});

usersRouter.post('/create', async (ctx) => {
    const body = await ctx.request.body.json();
    const newUser = await supabase.from('users').insert({
        first_name: body.firstName,
        last_name: body.lastName,
        user_name: body.username,
        device: body.device,
        language: body.language,
    })
    getResponseOnDB(newUser, ctx.response);
});


app.use(roomsRouter.routes());
app.use(roomsRouter.allowedMethods());
app.use(usersRouter.routes());
app.use(usersRouter.allowedMethods());


io.on("connection", chatServer.handleConnection);

const handler = io.handler(async (req) => {
    return await app.handle(req) || new Response(null, { status: 404 });
});

await serve(handler, {
    port: 3000,
});