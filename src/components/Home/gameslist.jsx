import {For} from "solid-js";
import {A} from "@solidjs/router";

function GamesList() {
    const gamemodes = [
        {
            icon: '⚔️',
            title: 'CASE BATTLES',
            tag: 'HOT',
            image: '/img/game-battles.png',
            link: '/battles',
        },
        {
            icon: '💣',
            title: 'MINES',
            tag: 'NEW',
            image: '/img/game-mines.png',
            link: '/mines',
        },
        {
            icon: '🎡',
            title: 'ROULETTE',
            image: '/img/game-roulette.png',
            link: '/roulette',
        },
        {
            icon: '📦',
            title: 'CASE OPENING',
            image: '/img/game-cases.png',
            link: '/cases',
        },
        {
            icon: '🪙',
            title: 'COINFLIP',
            image: '/img/game-coinflip.png',
            link: '/coinflip',
        },
        {
            icon: '🏆',
            title: 'JACKPOT',
            image: '/img/game-jackpot.png',
            link: '/jackpot',
        },
    ]

    return (
        <>
            <section class='games' aria-labelledby='games-heading'>
                <div class='games-header'>
                    <svg class='cube' width='24' height='26' viewBox='0 0 19 22' fill='none'
                         xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
                        <path d='M9.025 0.879 17.27 5.396c.98.567.98 1.979 0 2.545l-8.245 4.76L.78 7.941c-.98-.566-.98-1.978 0-2.545L8.244 1.087a1.56 1.56 0 0 1 .781-.208Z' fill='currentColor'/>
                        <path d='m.78 8.55 8.245 4.76v7.812a1.56 1.56 0 0 1-.78-.208L.78 16.72A1.56 1.56 0 0 1 0 15.368V6.748c0-.07.005-.14.014-.207L.78 8.55Z' fill='currentColor' opacity='.72'/>
                        <path d='m9.805 13.31 8.245-4.76v6.818c0 .556-.299 1.075-.78 1.352l-7.464 4.31a1.56 1.56 0 0 1-.78.208V13.31h.779Z' fill='currentColor' opacity='.88'/>
                    </svg>
                    <h2 id='games-heading'>ALL GAMES</h2>
                    <div class='header-spacer'/>
                    <button class='arrow' type='button' aria-label='Previous games'>
                        <svg viewBox='0 0 12 12' aria-hidden='true'>
                            <path d='M12 6H2m0 0 5-5M2 6l5 5' fill='none' stroke='currentColor' stroke-width='2'/>
                        </svg>
                    </button>
                    <button class='arrow' type='button' aria-label='Next games'>
                        <svg viewBox='0 0 12 12' aria-hidden='true'>
                            <path d='M0 6h10m0 0L5 1m5 5-5 5' fill='none' stroke='currentColor' stroke-width='2'/>
                        </svg>
                    </button>
                </div>

                <div class='game-grid'>
                    <For each={gamemodes}>{(game) =>
                        <div class='game-card'>
                            <div class='card-header'>
                                <div class='game-title'>
                                    <span class='game-icon' aria-hidden='true'>{game.icon}</span>
                                    <span>{game.title}</span>
                                    {game.tag && <span class={'badge ' + game.tag.toLowerCase()}>{game.tag}</span>}
                                </div>
                                <button
                                    class='help'
                                    type='button'
                                    aria-label={`${game.title} information`}
                                    title={game.title}
                                >?</button>
                            </div>
                            <A href={game.link} aria-label={`Play ${game.title}`}>
                                <img class='game-image' src={game.image} alt={game.title} draggable='false'/>
                            </A>
                        </div>
                    }</For>
                </div>
            </section>

            <style jsx>{`
              .games {
                width: 100%;
                margin-top: 30px;
              }

              .games-header {
                width: 100%;
                min-height: 48px;
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
              }

              .cube {
                flex: 0 0 auto;
                color: #9d4edd;
                filter: drop-shadow(0 0 7px rgba(157, 78, 221, 0.65));
              }

              .games-header h2 {
                margin: 0;
                color: #ffffff;
                font-size: 24px;
                font-weight: 800;
                text-transform: uppercase;
              }

              .header-spacer {
                flex: 1;
              }

              .arrow {
                width: 40px;
                height: 40px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                background: #9d4edd;
                border: 1px solid #c77dff;
                border-radius: 6px;
                box-shadow: 0 0 12px rgba(157, 78, 221, 0.25);
                cursor: pointer;
              }

              .arrow svg {
                width: 14px;
                height: 14px;
              }

              .game-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 20px;
              }

              .game-card {
                min-width: 0;
                overflow: hidden;
                display: block;
                color: #ffffff;
                background: #1a0b2e;
                border: 1px solid #9d4edd;
                border-radius: 12px;
                transition: box-shadow .2s ease, transform .2s ease;
              }

              .game-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 18px rgba(157, 78, 221, 0.28);
              }

              .card-header {
                min-height: 44px;
                padding: 10px 15px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                background: #13081f;
              }

              .game-title {
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 9px;
                color: #ffffff;
                font-size: 15px;
                font-weight: 800;
                white-space: nowrap;
              }

              .game-icon {
                font-size: 16px;
                line-height: 1;
              }

              .badge {
                padding: 3px 7px;
                border-radius: 4px;
                color: #ffffff;
                font-size: 10px;
                font-weight: 800;
                line-height: 1.2;
              }

              .badge.hot {
                background: #e83e8c;
              }

              .badge.new {
                background: #25a85a;
              }

              .help {
                flex: 0 0 20px;
                width: 20px;
                height: 20px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 0;
                border-radius: 50%;
                color: #d7c6e8;
                background: #38234e;
                font-size: 12px;
                font-weight: 700;
                cursor: help;
              }

              .game-image {
                display: block;
                width: 100%;
                aspect-ratio: 373 / 200;
                object-fit: cover;
              }

              @media only screen and (max-width: 1000px) {
                .game-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }
              }

              @media only screen and (max-width: 600px) {
                .game-grid {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
        </>
    );
}

export default GamesList;
