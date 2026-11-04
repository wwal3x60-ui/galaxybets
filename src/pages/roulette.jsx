import {createEffect, createSignal, For} from "solid-js";
import RouletteSpinner from "../components/Roulette/roulettespinner";
import RouletteIcon from "../components/Roulette/rouletteicons";
import {useWebsocket} from "../contexts/socketprovider";
import {numberToColor} from "../util/roulettehelpers";
import RouletteBetControls from "../components/Roulette/betcontrols";
import RouletteColor from "../components/Roulette/roulettecolor";
import {subscribeToGame, unsubscribeFromGames} from "../util/socket";
import {Meta, Title} from "@solidjs/meta";

function Roulette(props) {

    let hasConnected = false
    let bar

    const [bets, setBets] = createSignal([])
    const [bet, setBet] = createSignal(0.2)
    const [timeLeft, setTimeLeft] = createSignal(15)
    const [isSpinning, setIsSpinning] = createSignal(false)
    const [config, setConfig] = createSignal({ rollTime: 5000, betTime: 15000 })
    const [round, setRound] = createSignal(null)
    const [last10, setLast10] = createSignal([])
    const [state, setState] = createSignal('')

    const [last100, setLast100] = createSignal([])
    const [stats, setStats] = createSignal({
        green: 0,
        red: 0,
        gold: 0
    })

    const [ws] = useWebsocket()

    createEffect(() => {
        if (ws() && ws().connected && !hasConnected) {
            unsubscribeFromGames(ws())
            subscribeToGame(ws(), 'roulette')
            ws().on('roulette:set', (data) => {
                let stats = { green: 0, red: 0, gold: 0 }
                let last10 = []

                for (let i = 0; i < data.last.length; i++) {
                    let color = numberToColor(data.last[i])
                    stats[color]++

                    if (i < 10) {
                        last10.push(data.last[i])
                    }
                }

                setStats(stats)
                setLast100(data.last)
                setLast10(last10)
                setConfig(data.config)
                setBets(data.bets)
                setTimeLeft(data.timeLeft ?? 15)
                setIsSpinning(data.spinning || Boolean(data.round.rolledAt))
                setRound(data.round?.rolledAt ? data.round : null)
                animateCountdown((data.timeLeft ?? 15) * 1000)
            })

            ws().on('roulette:tick', (seconds) => {
                setTimeLeft(seconds)
                setIsSpinning(seconds === 0)
                if (seconds === 0) setBet(0)
            })

            ws().on('roulette:bets', (b) => {
                setBets(bets => [...b, ...bets])
            })

            ws().on('roulette:bet:update', (b) => {
                let curBets = bets()
                let betIndex = curBets?.findIndex(bet => bet.id === b.id)
                if (betIndex < 0) return

                let newBet = curBets[betIndex]
                newBet.amount = b.amount

                setBets([...curBets.slice(0, betIndex), {...newBet}, ...curBets.slice(betIndex + 1)])
            })

            ws().on('roulette:new', (roll) => {
                setBets([])
                setState('')
                const spinning = Boolean(roll.spinning)
                const seconds = roll.timeLeft ?? 15
                setBet(spinning ? 0 : 0.2)
                setTimeLeft(seconds)
                setIsSpinning(spinning)
                animateCountdown(seconds * 1000)
            })

            ws().on('roulette:spin', (data) => {
                console.log("FRONTEND GOT SPIN:", data)
                const winningNumber = data.winningNumber ?? data.result
                const winningColor = data.winningColor ?? numberToColor(winningNumber)
                const colorNumbers = { gold: 0, green: 1, red: 2 }
                const spin = {
                    ...data,
                    result: winningNumber,
                    color: typeof winningColor === 'number' ? winningColor : colorNumbers[winningColor]
                }

                setTimeLeft(0)
                setIsSpinning(true)
                setBet(0)

                let prev10 = last10()
                let newLast100 = last100()

                newLast100.unshift(winningNumber)
                newLast100 = newLast100.slice(0, 100)

                prev10.unshift(winningNumber)
                prev10 = prev10.slice(0, 10)

                setTimeout(() => {
                    setStats(calculateStats(newLast100))
                    setLast100(newLast100)
                    setLast10(prev10)
                    setBets([])
                    if (isSpinning()) setState('WINNERS')
                }, 5000)

                setRound(spin)
            })

            hasConnected = true
        }

        if (!ws() || !ws().connected) {
            hasConnected = false
        }
    })

    function animateCountdown(duration) {
        if (!bar?.animate) return

        bar.animate([
            {width: '100%'},
            {width: '0%'}
        ], {
            duration,
            easing: 'linear',
            fill: 'forwards'
        })
    }

    function calculateStats(history) {
        let stats = { green: 0, red: 0, gold: 0 }

        for (let i = 0; i < history.length; i++) {
            let color = numberToColor(history[i])
            stats[color]++
        }

        return stats
    }

    return (
        <>
            <Title>GalaxyBets | Roulette</Title>
            <Meta name='title' content='Roulette'></Meta>
            <Meta name='description' content='Play roulette on GalaxyBets. Bet on red, green, or gold for up to a 14x multiplier.'></Meta>

            <div class='roulette-container fadein'>
                <p class='global-countdown'>
                    {timeLeft() > 0 ? `Next spin in: ${timeLeft()}s` : 'SPINNING'}
                </p>

                <div class='roulette-header'>
                    <p class='desc'>PREVIOUS 10 ROLLS</p>

                    <div class='lastten'>
                        <For each={last10()}>{(round, index) => <RouletteIcon num={round} size='small'/>}</For>
                    </div>

                    <div class='timer-container'>
                        {isSpinning() ?
                            <p class='rolling'>ROLLING <span class='white'>NOW</span></p>
                            :
                            <p class='rolling'>ROLLING IN <span class='white'>{timeLeft()}s</span></p>
                        }
                        <div class='timer'>
                            <div class='bar' ref={bar}/>
                        </div>
                    </div>

                    <p class='title'>LAST 100</p>

                    <div class='stats'>
                        <div class='stat'>
                            <p class='desc green'>{stats().green}</p>
                            <RouletteIcon num={1} size='small'/>
                        </div>

                        <div class='stat'>
                            <p class='desc gold'>{stats().gold}</p>
                            <RouletteIcon num={0} size='small'/>
                        </div>

                        <div class='stat'>
                            <p class='desc red'>{stats().red}</p>
                            <RouletteIcon num={14} size='small'/>
                        </div>
                    </div>
                </div>

                <RouletteSpinner roll={round()} config={config()}/>
                {round()?.result !== undefined && (
                    <p class='roulette-result'>
                        LAST RESULT: <span>{round().result} - {numberToColor(round().result).toUpperCase()}</span>
                    </p>
                )}
                <RouletteBetControls bet={bet()} setBet={setBet} user={props.user}/>

                <div class='colors'>
                    <RouletteColor color='green' amount={bet()} bets={bets()} round={round()} state={state()} timeLeft={timeLeft()} bettingOpen={!isSpinning() && timeLeft() >= 1}/>

                    <RouletteColor color='gold' amount={bet()} bets={bets()} round={round()} state={state()} timeLeft={timeLeft()} bettingOpen={!isSpinning() && timeLeft() >= 1}/>

                    <RouletteColor color='red' amount={bet()} bets={bets()} round={round()} state={state()} timeLeft={timeLeft()} bettingOpen={!isSpinning() && timeLeft() >= 1}/>
                </div>
            </div>

            <style jsx>{`
              .roulette-result {
                margin: 12px 0 0;
                color: #9F9AC8;
                font-weight: 700;
              }

              .roulette-result span {
                color: #FFF;
              }

              .roulette-container {
                width: 100%;
                max-width: 1175px;
                height: fit-content;

                padding: 30px 0;
                margin: 0 auto;
              }

              .global-countdown {
                margin: 0 0 24px;
                color: #c77dff;
                font-size: 24px;
                font-weight: 800;
                text-align: center;
                text-shadow: 0 0 8px rgba(199, 125, 255, 0.85), 0 0 20px rgba(157, 78, 221, 0.65);
              }

              .roulette-header {
                width: 100%;
                display: flex;
                align-items: center;
                position: relative;
                margin: 30px 0;
              }

              .lastten {
                display: flex;
                gap: 10px;
              }

              .desc {
                color: #ADA3EF;
                font-size: 14px;
                font-weight: 700;

                position: absolute;
                top: -25px;
              }

              .rolling {
                color: #ADA3EF;
                font-size: 13px;
                font-weight: 700;
                width: 95px;
              }

              .timer-container {
                display: flex;
                gap: 10px;
                align-items: center;
                margin-left: auto;
              }

              .timer {
                min-width: 132px;
                max-width: 132px;
                width: 132px;
                height: 9px;
                border-radius: 2px;
                background: #242140;
              }

              .bar {
                height: 100%;
                width: 100%;

                border-radius: 2px;
                background: #FCA31E;
              }

              .stats {
                display: flex;
                gap: 15px;
              }

              .stat {
                position: relative;
                display: flex;
                justify-content: center;

                color: #41D164;
              }

              .title {
                color: #ADA3EF;
                font-size: 14px;
                font-weight: 700;
                margin: 0 20px;
              }

              .colors {
                display: flex;
                width: 100%;
                gap: 20px;
              }

              .bet-column {
                flex: 1;
                display: flex;
                flex-direction: column;
              }

              .color {
                color: #FFF !important;
                font-size: 15px;
                font-family: Geogrotesque Wide;
                font-weight: 700;

                outline: unset;
                width: unset;
                border: unset;
                background: unset;

                min-height: 70px;
                padding: 0 20px;

                display: flex;
                align-items: center;
                gap: 20px;
                flex: 1;

                cursor: pointer;
              }

              .color.green {
                border-radius: 7px;
                border: 1px solid #41D163;
                background: rgba(65, 209, 99, 0.25);
                box-shadow: 0px 1px 5px 0px rgba(0, 0, 0, 0.15);
              }

              .color.gold {
                border-radius: 7px;
                border: 1px solid #FF9900;
                background: linear-gradient(37deg, rgba(255, 153, 0, 0.25) 30.03%, rgba(249, 172, 57, 0.25) 42.84%);
                box-shadow: 0px 1px 5px 0px rgba(0, 0, 0, 0.15);
              }

              .color.red {
                border-radius: 7px;
                border: 1px solid #F04B69;
                background: rgba(197, 56, 82, 0.25);
                box-shadow: 0px 1px 5px 0px rgba(0, 0, 0, 0.15);
              }

              .color.red img {
                filter: drop-shadow(0px 0px 15px #C53852);
              }

              .color.green img {
                filter: drop-shadow(0px 0px 15px #41D163);
              }

              .bets-header {
                margin-top: 35px;
                min-height: 30px;
                border-radius: 5px 5px 0 0;
                background: linear-gradient(238deg, #6159B0 0%, #43378D 100%);

                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 15px;
              }

              .win {
                margin-left: auto;
              }

              .green {
                color: #59E878;
              }

              .gold {
                color: var(--gold);
              }

              .red {
                color: #C53852;
              }

              @media only screen and (max-width: 1000px) {
                .roulette-container {
                  padding-bottom: 90px;
                }
              }

              @media only screen and (max-width: 875px) {
                .colors {
                  flex-direction: column;
                  gap: 36px;
                }
              }
            `}</style>
        </>
    );
}

export default Roulette;
