import {createEffect, createSignal, For} from "solid-js";
import {useWebsocket} from "../contexts/socketprovider";
import {useUser} from "../contexts/usercontextprovider";
import Countup from "../components/Countup/countup";
import JackpotUser from "../components/Jackpot/jackpotuser";
import JackpotBet from "../components/Jackpot/jackpotbet";
import JackpotJoin from "../components/Jackpot/jackpotjoin";
import {generateBets} from "../resources/jackpot";
import Chance from 'chance'
import {getRandomNumber} from "../util/api";
import Level from "../components/Level/level";
import {formatUSD} from "../util/numbers";
import {subscribeToGame, unsubscribeFromGames} from "../util/socket";
import {Meta, Title} from "@solidjs/meta";

function Jackpot(props) {

    let timerBar
    let spinnerRef

    const [ws] = useWebsocket()
    const [user] = useUser()

    const [jackpot, setJackpot] = createSignal(null)
    const [bets, setBets] = createSignal([])
    const [rawBets, setRawBets] = createSignal([])
    const [total, setTotal] = createSignal(0)
    const [join, setJoin] = createSignal(false)
    const [timer, setTimer] = createSignal(-1)
    const [state, setState] = createSignal('waiting')
    const [config, setConfig] = createSignal({})
    const [users, setUsers] = createSignal([])
    const [winner, setWinner] = createSignal(null)
    const [ticket, setTicket] = createSignal(0)

    function chancePercent(amount, totalAmount, role) {
        const numericTotal = Number(totalAmount)
        if (numericTotal === 0) return 0
        const weight = Number(amount) * (role === 'BOT' ? 1.3 : 1)
        return weight / numericTotal * 100
    }

    function totalWeight() {
        return bets().reduce((weight, bet) => {
            return weight + Number(bet.amount) * (bet.user?.role === 'BOT' ? 1.3 : 1)
        }, 0)
    }

    let hasConnected = false
    let colors = [
        '#FCA31E',
        '#C2FC1E',
        '#FC6E1E',
        '#1EFC92',
        '#EC1507',
        '#1EB9FC',
        '#0073FA',
        '#9E52FF',
        '#69EFAF',
        '#D96DFF',
        '#6B54F9',
        '#A072BC',
        '#EC519B',
        '#F8BA5F',
        '#C6DA8D',
        '#D75E1A',
        '#1CBD70',
        '#54DA25',
        '#1399D2',
        '#5272E2',
    ]

    const timerText = {
        winners: () => '',
        rolling: () => '',
        counting: () => <>
            <img src='/assets/icons/timer.svg' height='18' width='15'/>
            {Math.ceil(Math.max(0, timer()) / 1000) + ' s'}
        </>,
        waiting: () => 'WAITING FOR PLAYERS...'
    }

    const spinnerContent = {
        winners: () => <div class='winner fadein'>
            <JackpotUser color={winner()?.color} id={winner()?.user?.id}
                         percent={(winner()?.chance || 0) / 100}
                         won={true}/>
            <div>
                <p class='details'>
                    <span class='white bold'>{winner()?.user?.username}</span>
                    <Level xp={winner()?.user?.xp}/>
                    WON
                    <img src='/assets/icons/coin.svg' height='17' width='17'/>
                    <span class='bold white'>{formatUSD(winner()?.totalAmount ?? total())}</span>
                    WITH A
                    <span class='white'>{Number(winner()?.chance || 0).toFixed(2)}%</span>
                    CHANCE
                </p>

                <p class='ticket'>
                    Winning ticket: {ticket()}
                </p>
            </div>
        </div>,
        rolling: () => <>
            <img class='arrow' src='/assets/icons/selector.png' height='16' alt=''/>
            <div class='spinner' ref={spinnerRef}>
                <For each={users()}>{(bet, index) => <JackpotUser color={bet?.color} id={bet?.user?.id}
                                                                  percent={chancePercent(bet?.amount || 0, totalWeight(), bet?.user?.role) / 100}
                                                                  state={state()}
                                                                  index={index()}/>}</For>
            </div>
        </>,
        counting: () => <For each={bets()}>{(bet, index) => <JackpotUser color={bet?.color} id={bet?.user?.id}
                                                                         percent={chancePercent(bet?.amount || 0, totalWeight(), bet?.user?.role) / 100}/>}</For>,
        waiting: () => <For each={bets()}>{(bet, index) => <JackpotUser color={bet?.color} id={bet?.user?.id}
                                                                        percent={chancePercent(bet?.amount || 0, totalWeight(), bet?.user?.role) / 100}/>}</For>
    }

    createEffect(() => {
        if (ws() && ws().connected && !hasConnected) {
            unsubscribeFromGames(ws())
            subscribeToGame(ws(), 'jackpot')

            ws().off('jackpot:set')
            ws().off('jackpot:bets')
            ws().off('jackpot:on')
            ws().off('jackpot:new')
            ws().off('jackpot:newRound')
            ws().off('jackpot:reset')
            ws().off('jackpot:tick')
            ws().off('jackpot:commit')
            ws().off('jackpot:roll')

            ws().on('jackpot:set', (jp) => {
                congregateBets(jp?.bets)
                setJackpot(jp)
                setConfig(jp?.config)
                setRawBets(jp.bets)
                const timeLeft = jp.timeLeft ?? 60
                setTimer(timeLeft * 1000)
                setState(jp.spinning ? 'rolling' : 'counting')
                animateCountdown(timeLeft * 1000)
            })

            ws().on('jackpot:reset', (jp) => {
                const timeLeft = jp.timeLeft ?? 60
                setTimer(timeLeft * 1000)
                setTotal(0)
                setBets([])
                setJackpot(jp)
                if (jp.config) setConfig(jp.config)
                setUsers([])
                setRawBets([])
                setState(jp.spinning ? 'rolling' : 'counting')
                setWinner(null)
                setTicket(0)
                animateCountdown(timeLeft * 1000)
            })

            ws().on('jackpot:tick', (seconds) => {
                const timeLeft = Math.max(0, Number(seconds) || 0)
                setTimer(timeLeft * 1000)
                if (state() !== 'rolling' && state() !== 'winners') setState('counting')
            })

            ws().on('jackpot:bets', (bets) => {
                let newJP = {...jackpot()}

                if (!Array.isArray(newJP.bets)) newJP.bets = []
                newJP.bets.push(...bets)

                congregateBets(newJP.bets)
                setJackpot(newJP)
                setRawBets((b) => [...b, ...bets])
            })

            ws().on('jackpot:commit', (commitTo) => {
                const current = jackpot()
                if (!current) return

                if (current.round) {
                    setJackpot({...current, round: {...current.round, EOSBlock: commitTo}})
                } else {
                    setJackpot({...current, EOSBlock: commitTo})
                }
            })

            ws().on('jackpot:roll', (roundId, unhashedServerSeed, clientSeed, winnerBetId, ticket, winnerInfo) => {
                if (state() === 'rolling') return

                setTicket(ticket)
                let winningBet = rawBets().find(bet => Number(bet.id) === Number(winnerBetId))
                const winningUser = winnerInfo?.user || winningBet?.user
                if (!winningUser) return
                let randomBets = generateBets(bets(), total())
                randomBets[50] = winningBet

                let congregatedBet = bets().find(bet => String(winningUser.id) === String(bet.user.id))
                randomBets[50] = {
                    ...randomBets[50],
                    user: winningUser,
                    color: congregatedBet?.color,
                    amount: winnerInfo?.amount ?? congregatedBet?.amount ?? winningBet?.amount ?? 0,
                    totalAmount: winnerInfo?.totalAmount ?? total(),
                    chance: winnerInfo?.chance
                        ?? chancePercent(congregatedBet?.amount ?? winningBet?.amount ?? 0, totalWeight(), winningUser.role)
                }
                setWinner(randomBets[50])

                setJackpot({...jackpot(), serverSeed: unhashedServerSeed})
                setUsers(randomBets)
                setState('rolling')
                setTimer(-1)
                rollAnimation(jackpot())
            })

            hasConnected = true
        }

        hasConnected = !!ws()?.connected
    })

    function rollAnimation(jp) {
        let chanceObj = new Chance(jp.serverSeed)

        const itemsWidth = 80
        const center = (itemsWidth / 2)
        const itemsGap = 8
        const firstItem = 9 * (itemsWidth + itemsGap) + center
        const lastItem = 50 * (itemsWidth + itemsGap) + center
        const offset = getRandomNumber(-38, 38, chanceObj)

        spinnerRef.getAnimations().forEach(anim => anim.cancel())

        spinnerRef.animate(
            [
                {left: `calc(50% + -${firstItem}px)`, offset: 0, easing: 'cubic-bezier(.05,.85,.3,1)'},
                {left: `calc(50% + ${-lastItem - offset}px)`, offset: 0.9, easing: 'cubic-bezier(.05,.85,.3,1)'},
                {left: `calc(50% + ${-lastItem - offset}px)`, offset: 0.95, easing: 'cubic-bezier(.05,.85,.3,1)'},
                {left: `calc(50% + -${lastItem}px)`, offset: 1, easing: 'cubic-bezier(.05,.85,.3,1)'}
            ],
            {
                duration: config()?.rollTime || 5000,
                fill: 'forwards'
            })

        window.requestAnimationFrame(showWinner)
    }

    function animateCountdown(duration) {
        if (!timerBar?.animate) return

        timerBar.getAnimations().forEach(anim => anim.cancel())
        timerBar.animate([
            {width: '100%', offset: 0},
            {width: '0%', offset: 1}
        ], {
            duration,
            easing: 'linear',
            fill: 'forwards'
        })
    }

    let start

    function showWinner(timeStamp) {
        if (!start) {
            start = timeStamp
        }
        let elapsed = timeStamp - start

        if (elapsed > config()?.rollTime + 2000) {
            start = null
            return setState('winners')
        }
        window.requestAnimationFrame(showWinner)
    }

    function usersBet() {
        if (!user()) return
        return bets()?.find(bet => bet.user.id === user().id)
    }

    function bettingClosed() {
        const current = jackpot()
        return !!(timer() <= 0 || current?.spinning || current?.round?.EOSBlock || current?.EOSBlock || state() === 'rolling' || state() === 'winners')
    }

    function congregateBets(bets) {
        let total = 0
        let combinedUserBets = []

        let color = 0
        bets.forEach((bet) => {
            const userId = bet.user.id
            const existingUserBetIndex = combinedUserBets.findIndex((userBet) => userBet.user.id === userId)

            if (existingUserBetIndex !== -1) {
                combinedUserBets[existingUserBetIndex].amount += bet.amount
            } else {
                combinedUserBets.push({
                    user: bet.user,
                    amount: bet.amount,
                    color: colors[color]
                })
                color++
            }

            total += bet.amount
        })

        setTotal(total)
        setBets(combinedUserBets)
    }

    return (
        <>
            <Title>GalaxyBets | Jackpot</Title>
            <Meta name='title' content='Jackpot'></Meta>
            <Meta name='description' content='Join jackpot games on GalaxyBets.'></Meta>

            {join() && (
                <JackpotJoin close={() => setJoin(false)} bettingClosed={bettingClosed()}/>
            )}

            <div class='jackpot-container fadein'>
                <div class='jackpot-header'>
                    <div class='header-section'>
                        <p class='title'>
                            <img src='/assets/icons/coin2.svg' height='18' alt=''/>
                            JACKPOT -
                        </p>
                    </div>

                    <div class='header-section right'>
                        <button class='bevel-gold join' disabled={bettingClosed()} onClick={() => setJoin(true)}>
                            {bettingClosed() ? 'WAITING FOR NEXT ROUND' : 'JOIN POT'}
                        </button>
                    </div>
                </div>

                <div class='bar'/>

                <div class='stats'>
                    <div class='stat'>
                        <p>{chancePercent(usersBet()?.amount || 0, totalWeight(), usersBet()?.user?.role).toFixed(2)}%</p>
                        <p>YOUR CHANCE</p>
                    </div>

                    <div class='stat'>
                        <p>{bets()?.length}</p>
                        <p>TOTAL PLAYERS</p>
                    </div>

                    <div class='stat'>
                        <p class='white align'>
                            <img class='stat-coin' src='/assets/icons/coin.svg' height='21' width='21' alt=''/>
                            <Countup end={total()} gray={true}/>
                        </p>

                        <p class='gold'>TOTAL AMOUNT</p>
                    </div>

                    <div class='stat gold'>
                        <p class='white align'>
                            <img class='stat-coin' src='/assets/icons/coin.svg' height='21' width='21' alt=''/>
                            <Countup end={usersBet()?.amount || 0} gray={true}/>
                        </p>

                        <p class='gold'>DEPOSITED VALUE</p>
                    </div>
                </div>

                <div class='timer-container'>
                    <div class='timer' ref={timerBar}/>
                    <p>{timerText[state()]}</p>
                </div>

                <div class='users'>
                    {spinnerContent[state()]}
                </div>

                <div class='bets'>
                    <For each={bets()}>{(bet, index) => <JackpotBet {...bet}/>}</For>
                </div>
            </div>

            <style jsx>{`
              .jackpot-container {
                width: 100%;
                max-width: 1175px;
                height: fit-content;

                box-sizing: border-box;
                padding: 30px 0;
                margin: 0 auto;
              }

              .jackpot-header {
                display: flex;
                justify-content: space-between;
              }

              .header-section {
                display: flex;
                align-items: center;
                flex-grow: 1;
                gap: 15px;
              }

              .right {
                justify-content: flex-end;
              }

              .title {
                color: #FFF;
                font-size: 18px;
                font-weight: 700;

                display: flex;
                align-items: center;
                gap: 8px;
              }

              .join {
                width: 130px;
                height: 35px;
              }

              .join:disabled {
                cursor: not-allowed;
                opacity: 0.6;
              }

              .bar {
                margin: 25px 0;
                border-radius: 555px;
                background: #5A5499;
                height: 1px;
                flex: 1;
              }

              .stats {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;

                width: 100%;
              }

              .stat {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 10px;

                flex: 1 1 0;
                height: 90px;

                border-radius: 5px;
                background: rgba(90, 84, 153, 0.27);

                color: #FFF;
                font-family: Geogrotesque Wide, sans-serif;
                font-size: 20px;
                font-weight: 600;

                padding: 10px;
                white-space: nowrap;
              }

              .stat.gold {
                border-radius: 5px;
                background: conic-gradient(from 180deg at 50% 50%, #FFDC18 -0.3deg, #B17818 72.1deg, rgba(156, 99, 15, 0.611382) 139.9deg, rgba(126, 80, 12, 0.492874) 180.52deg, rgba(102, 65, 10, 0.61) 215.31deg, #B17818 288.37deg, #FFDC18 359.62deg, #FFDC18 359.7deg, #B17818 432.1deg);
                backdrop-filter: blur(5px);

                position: relative;
                z-index: 0;
              }

              .stat.gold:before {
                position: absolute;
                top: 1px;
                left: 1px;
                content: '';
                height: calc(100% - 2px);
                width: calc(100% - 2px);
                border-radius: 5px;
                background: linear-gradient(0deg, rgba(255, 190, 24, 0.25) 0%, rgba(255, 190, 24, 0.25) 100%), linear-gradient(230deg, #1A0E33 0%, #423C7A 100%);
                z-index: -1;
              }

              .stat p:last-child {
                color: #ADA3EF;
                font-size: 13px;
                font-weight: 600;
              }

              .align {
                display: flex;
                align-items: center;
              }

              .stat-coin {
                margin-right: 8px;
              }

              .timer-container {
                width: 100%;
                height: 35px;

                border-radius: 5px;
                border: 1px dashed #534E8F;
                background: linear-gradient(0deg, rgba(0, 0, 0, 0.20) 0%, rgba(0, 0, 0, 0.20) 100%), linear-gradient(230deg, rgba(26, 14, 51, 0.35) 0%, rgba(66, 60, 122, 0.35) 100%);

                margin: 25px 0;
                position: relative;
                padding: 10px;
              }

              .timer-container p {
                display: flex;
                align-items: center;
                gap: 8px;
              }

              .timer {
                width: 100%;
                height: 100%;
                background: linear-gradient(to right, #403C72 0%, #5E58AC 100%);
              }

              .timer:before {
                position: absolute;
                z-index: -1;
                height: calc(100% - 20px);
                width: calc(100% - 20px);
                content: '';
                top: 10px;
                left: 10px;
                background: #1A0E33;
              }

              .timer-container p {
                position: absolute;
                top: -2px;
                text-align: center;
                left: 50%;
                transform: translateX(-50%);

                color: #FFF;
                font-family: Geogrotesque Wide, sans-serif;
                font-size: 16px;
                font-weight: 700;
                line-height: 35px;
              }

              .users {
                width: 100%;
                height: 100px;

                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;

                border-radius: 5px;
                background: linear-gradient(to right, rgba(0, 0, 0, 0.41) 0%, rgba(0, 0, 0, 0.15) 25%, rgba(0, 0, 0, 0.15) 75%, rgba(0, 0, 0, 0.41) 100%);
                padding: 10px;

                display: flex;
                gap: 8px;

                overflow: hidden;
              }

              .winner {
                display: flex;
                gap: 20px;
                align-items: center;
              }

              .details {
                display: flex;
                gap: 5px;

                color: #ADA3EF;
                font-size: 13px;
                font-weight: 600;
              }

              .ticket {
                margin-top: 10px;

                color: #ADA3EF;
                font-size: 11px;
                font-weight: 600;
              }

              .spinner {
                display: flex;
                gap: 8px;

                position: absolute;
                left: 50%;
              }

              .arrow {
                position: absolute;
                top: -8px;
              }

              .bets {
                width: 100%;
                margin-top: 25px;

                display: flex;
                flex-direction: column;
                gap: 6px;
              }

              @media only screen and (max-width: 1000px) {
                .jackpot-container {
                  padding-bottom: 90px;
                }
              }
            `}</style>
        </>
    );
}

export default Jackpot;
