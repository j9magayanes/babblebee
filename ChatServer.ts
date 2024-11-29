import { SupabaseClient } from "@supabase/supabase-js";
import { MessagingServer, ServerSocket, SocketData } from "./types.ts";
import { libreTranslate } from "libretranslate-ts";
import { Database } from "./database.types.ts";

const LIBRETRANSLATE_ENDPOINT = "http://localhost:5001";
libreTranslate.setApiEndpoint(LIBRETRANSLATE_ENDPOINT);
libreTranslate.setApiKey("");


export default class ChatServer {
    private io: MessagingServer;
    private supabase: SupabaseClient<Database>;
    private activeLanguages: Set<string> = new Set();

    constructor(io: MessagingServer, supabase: SupabaseClient<Database>) {
        this.io = io;
        this.supabase = supabase;
    }

    private parseQuery = async (query: URLSearchParams): Promise<SocketData> => {
        const username = query.get('username');
        const firstName = query.get('firstName') || '';
        const deviceId = query.get('deviceId') || '';
        const language = query.get('language');
        const room = query.get('room') || 'global';

        const roomQuery = await this.supabase.from('chat_rooms').select().eq('name', room).single();
        if (!roomQuery.data) {
            throw new Error(`Room '${room}' does not exist`);
        }

        if (!username || !language) {
            throw new Error("Missing required query parameters");
        }

        return { username, firstName, deviceId, language };
    }

    public handleConnection = async (socket: ServerSocket) => {
        try {
            socket.data = await this.parseQuery(socket.handshake.query);
        } catch (e) {
            console.error(e);
            socket.emit('error', 'some error');
            socket.disconnect();
            return;
        }

        const socketData = socket.data as SocketData;
        const sourceLanguage = socketData.language;
        const room = socketData.room;
        const languageRoom = `${room}_${sourceLanguage}`;
        this.activeLanguages.add(sourceLanguage);

        socket.join(room)
        socket.join(languageRoom);

        socket.broadcast.to(room).emit('userJoined', socketData.username);

        socket.on("disconnect", (reason) => {
            console.log(`socket ${socket.id} disconnected due to ${reason}`);
            socket.broadcast.to(room).emit('userDisconnected', socketData.username);
        });

        socket.on('message', ({ message: sourceMessage }) => {
            for (const targetLanguage of this.activeLanguages) {

                const defaultPayload = { sourceLanguage, sourceMessage, translatedMessage: sourceMessage, username: socketData.username };
                if (targetLanguage === sourceLanguage) {
                    socket.broadcast.to(languageRoom).emit('message', defaultPayload);
                    continue;
                }

                const targetLanguageRoom = `${room}_${targetLanguage}`;

                libreTranslate.translate(sourceMessage, sourceLanguage, targetLanguage).then((result) => {
                    if (result?.status >= 400) {
                        console.error("Translate Error: ", result?.error);
                        console.error(result?.translatedText);
                        return;
                    }

                    const translatedMessage = result?.translatedText;
                    socket.broadcast.to(targetLanguageRoom).emit('message', {
                        ...defaultPayload,
                        translatedMessage
                    });
                }).catch((error) => {
                    console.error(error);
                    socket.broadcast.to(targetLanguageRoom).emit('message', {
                        ...defaultPayload,
                        translatedMessage: sourceMessage
                    });
                });
            }

        });
    }
}

