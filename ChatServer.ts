import { SupabaseClient } from "@supabase/supabase-js";
import { MessagingServer, ServerSocket, SocketData } from "./types.ts";
import { libreTranslate } from "libretranslate-ts";
import { Database } from "./database.types.ts";

const LIBRETRANSLATE_ENDPOINT = "http://localhost:5001";
libreTranslate.setApiEndpoint(LIBRETRANSLATE_ENDPOINT);
libreTranslate.setApiKey("");

const QOS_ENDPOINT = 'https://quality-of-service-on-demand.p-eu.rapidapi.com';

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
        // const firstName = query.get('firstName') || '';
        const deviceId = query.get('deviceId') || '';
        const language = query.get('language');
        const room = query.get('room') || 'global';

        // const roomQuery = await this.supabase.from('chat_rooms').select().eq('name', room).single();
        // if (!roomQuery.data) {
        //     throw new Error(`Room '${room}' does not exist`);
        // }

        if (!username || !language) {
            throw new Error("Missing required query parameters");
        }

        return { username, deviceId, language, room };
    }

    private createQualityConnection = async (device: string) => {
        const url = `${QOS_ENDPOINT}/sessions`;
        const options = {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': '2706be42cdmsh22be1950cf9fedap1dd839jsnc5b58d12c0c3',
                'X-RapidAPI-Host': 'quality-of-service-on-demand.nokia.rapidapi.com'
            },
            body: {
                qosProfile: '',
                device: {
                    phoneNumber: {},
                    networkAccessIdentifier: {},
                    ipv4Address: {
                        publicAddress: {},
                        privateAddress: {},
                        publicPort: {}
                    },
                    ipv6Address: {}
                },
                devicePorts: {
                    ranges: {
                        '0': { from: 0, to: 0 }
                    },
                    ports: {}
                },
                applicationServer: {
                    ipv4Address: {},
                    ipv6Address: {}
                },
                applicationServerPorts: {
                    ranges: {
                        '0': { from: 0, to: 0 }
                    },
                    ports: {}
                },
                webhook: {
                    notificationUrl: '',
                    notificationAuthToken: {}
                },
                notificationUrl: {},
                notificationAuthToken: {},
                duration: 0
            }
        };

        try {
            const response = await fetch(url, options);
            const result = await response.text();
            console.log(result);
        } catch (error) {
            console.error(error);
        }
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

        socket.on('message', (pl) => {

            const { message: sourceMessage } = pl;
            console.log('message received: ', sourceMessage, sourceLanguage);

            const translatedMessages: Map<string, any> = new Map();
            const requests = [];
            for (const targetLanguage of this.activeLanguages) {

                console.log('target', targetLanguage)
                const defaultPayload = { sourceLanguage, sourceMessage, translatedMessage: sourceMessage, username: socketData.username };
                if (targetLanguage === sourceLanguage) {
                    // translatedMessages.set(targetLanguage, sourceMessage);
                    console.log('got key same', languageRoom)
                    translatedMessages.set(languageRoom, defaultPayload);
                    // socket.broadcast.to(languageRoom).emit('message', defaultPayload);
                    continue;
                }

                const targetLanguageRoom = `${room}_${targetLanguage}`;

                const req = libreTranslate.translate(sourceMessage, sourceLanguage, targetLanguage).then((result) => {
                    if (result?.status >= 400) {
                        console.error("Translate Error: ", result?.error);
                        console.error(result?.translatedText);
                        return;
                    }

                    const translatedMessage = result?.translatedText;
                    console.log('got key', targetLanguageRoom)
                    translatedMessages.set(targetLanguageRoom, { ...defaultPayload, translatedMessage });
                    // console.log('translating', targetLanguageRoom, translatedMessages)
                    // socket.broadcast.to(targetLanguageRoom).emit('message', {
                    //     ...defaultPayload,
                    //     translatedMessage
                    // });
                }).catch((error) => {
                    console.error(error);
                    console.log('got key err', targetLanguageRoom)
                    translatedMessages.set(targetLanguageRoom, { ...defaultPayload, translatedMessage: sourceMessage });
                    // socket.broadcast.to(targetLanguageRoom).emit('message', {
                    //     ...defaultPayload,
                    //     translatedMessage: sourceMessage
                    // });
                });
                requests.push(req);
            }
            Promise.all(requests).then(() => {
                console.log('finished gathering')
                translatedMessages.forEach((payload, room) => {
                    console.log('emitting', room, payload);
                    socket.broadcast.to(room).emit('message', payload);
                });
            });

        });
    }
}

