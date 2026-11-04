import {createContext, useContext, createResource} from "solid-js";
import io from "socket.io-client";

const WebsocketContext = createContext();

export function WebsocketProvider(props) {

    const [ws, { mutate }] = createResource(connectSocket), socket = [ws]

    async function connectSocket() {

        let tempWs = io(import.meta.env.VITE_SOCKET_URL + '', { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10, withCredentials: true})

        tempWs.on('connect', () => {
            console.log('Connected to WS')
            tempWs.emit('auth')
            mutate(tempWs)
        })

        tempWs.on('disconnect', (reason) => {
            if (reason !== 'io server disconnect') return

            mutate(null)
            let retrying = setInterval(() => {
                tempWs.removeAllListeners()
                tempWs = io(import.meta.env.VITE_SERVER_URL, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10, withCredentials: true})
                mutate(tempWs)
                clearInterval(retrying)
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