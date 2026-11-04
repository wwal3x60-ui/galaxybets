import {render} from 'solid-js/web';

import './fonts.css'
import './index.css';
import App from './App';
import {Router} from '@solidjs/router';

import {WebsocketProvider} from "./contexts/socketprovider";
import {UserProvider} from "./contexts/usercontextprovider";
import {RainProvider} from "./contexts/raincontext";
import {Meta, MetaProvider, Title} from "@solidjs/meta";

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error(
        'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got mispelled?',
    );
}

render(() => <>
    <UserProvider>
        <WebsocketProvider>
            <RainProvider>
                <Router>
                    <MetaProvider>
                        <Title>GalaxyBets | Play Our Games</Title>
                        <Meta name='title' content='GalaxyBets | Play Our Games'></Meta>
                        <Meta name='description' content='Play Case Battles, Loot Unboxing, Crash, Roulette, Coinflip and Jackpot on GalaxyBets.'></Meta>

                        <App/>
                    </MetaProvider>
                </Router>
            </RainProvider>
        </WebsocketProvider>
    </UserProvider>
</>, root);
