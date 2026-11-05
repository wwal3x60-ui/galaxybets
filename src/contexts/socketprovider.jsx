import {createContext, useContext, createResource} from "solid-js";
import io from "socket.io-client";
import {getJWT} from "../util/api";

const WebsocketContext = createContext();

function stripTrailingSlashes(url) {
    return (url || '').replace(/\/+$/, '')
}

export function WebsocketProvider(props) {

    const [ws, { mutate }] = createResource(connectSocket), socket = [ws]

    async function connectSocket() {

        const socketUrl = stripTrailingSlashes(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_SERVER_URL)
        let tempWs = io(socketUrl, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, withCredentials: true})

        tempWs.on('connect', () => {
            console.log('Connected to WS')
            tempWs.emit('auth', getJWT())
            mutate(tempWs)
        })

        tempWs.on('disconnect', (reason) => {
            if (reason !== 'io server disconnect') return

            mutate(null)
            setTimeout(() => {
                if (!tempWs.connected) tempWs.connect()
            }, 1000)
        })

        return tempWs
    }

    return (
        <WebsocketContext.Provider value={socket}>
            {props.children}
        </WebsocketContext.Provider>
    );
}

export function useWebsocket() { return useContext(WebsocketContext); }