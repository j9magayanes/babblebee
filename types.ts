import { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts";

interface ServerMessageEvent {
    message: string;
    sourceLanguage: string;
}

interface ClientMessageEvent {
    username: string;
    sourceMessage: string;
    sourceLanguage: string;
    translatedMessage: string;
}

interface ServerToClientEvents {
    message: (msg: ClientMessageEvent) => void;
    userJoined: (username: string) => void;
    userDisconnected: (username: string) => void;
    error: (msg: string) => void;
}

interface ClientToServerEvents {
    message: (msg: ServerMessageEvent) => void;
}

interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    deviceId: string;
    username: string;
    firstName: string;
    language: string;
}

export type MessagingServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

export type ServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData>;