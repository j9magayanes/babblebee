import { MessagingServer, ServerSocket, SocketData } from "./types.ts";
import { libreTranslate } from "libretranslate-ts";

const LIBRETRANSLATE_ENDPOINT = "http://localhost:5001";
libreTranslate.setApiEndpoint(LIBRETRANSLATE_ENDPOINT);
libreTranslate.setApiKey("");


export default class ChatServer {
    private io: MessagingServer;
    private activeLanguages: Set<string> = new Set();

    constructor(io: MessagingServer) {
        this.io = io;
    }

    private parseQuery(query: URLSearchParams): SocketData {
        const username = query.get('username');
        const firstName = query.get('firstName') || '';
        const deviceId = query.get('deviceId') || '';
        const language = query.get('language');

        if (!username || !language) {
            throw new Error("Missing required query parameters");
        }

        return { username, firstName, deviceId, language };
    }

    public handleConnection = async (socket: ServerSocket) => {
        try {
            socket.data = this.parseQuery(socket.handshake.query);
        } catch (_) {
            socket.emit('error', 'Missing required query parameters');
            socket.disconnect();
            return;
        }

        const userData = socket.data as SocketData;
        const sourceLanguage = userData.language;
        this.activeLanguages.add(sourceLanguage);

        socket.join('chat')
        socket.join(`chat_${sourceLanguage}`);

        socket.broadcast.to('chat').emit('userJoined', userData.username);

        socket.on("disconnect", (reason) => {
            console.log(`socket ${socket.id} disconnected due to ${reason}`);
            socket.broadcast.to('chat').emit('userDisconnected', userData.username);
        });

        socket.on('message', ({ message: sourceMessage }) => {
            for (const targetLanguage of this.activeLanguages) {

                const defaultPayload = { sourceLanguage, sourceMessage, translatedMessage: sourceMessage, username: userData.username };
                if (targetLanguage === sourceLanguage) {
                    socket.broadcast.to(`chat_${targetLanguage}`).emit('message', defaultPayload);
                    continue;
                }
                console.log('req:', sourceMessage, sourceLanguage, targetLanguage);

                libreTranslate.translate(sourceMessage, sourceLanguage, targetLanguage).then((result) => {
                    if (result?.status >= 400) {
                        console.error("Translate Error: ", result?.error);
                        console.error(result?.translatedText);
                        return;
                    }

                    const translatedMessage = result?.translatedText;
                    socket.broadcast.to(`chat_${targetLanguage}`).emit('message', {
                        ...defaultPayload,
                        translatedMessage
                    });
                }).catch((error) => {
                    console.error(error);
                    socket.broadcast.to(`chat_${targetLanguage}`).emit('message', {
                        ...defaultPayload,
                        translatedMessage: 'Error translating message'
                    });
                });
            }

        });
    }
}

