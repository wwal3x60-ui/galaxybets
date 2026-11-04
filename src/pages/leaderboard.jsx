import {createEffect, createResource, createSignal, For, onCleanup, Show} from "solid-js";
import {useWebsocket} from "../contexts/socketprovider";
import Avatar from "../components/Level/avatar";
import {api} from "../util/api";
import Loader from "../components/Loader/loader";
import {Meta, Title} from "@solidjs/meta";
import {formatUSD} from "../util/numbers";

function Leaderboard(props) {

    const [ws] = useWebsocket()
    const [period, setPeriod] = createSignal('weekly')
    const [placements, setPlacements] = createSignal([])
    const [leaderboard, {mutate}] = createResource(() => period(), fetchLB)
    const [time, setTime] = createSignal(0)
    const endTime = new Date()
    endTime.setDate(endTime.getDate() + 8)
    const [weeklyTime, setWeeklyTime] = createSignal(endTime.getTime() - Date.now())
    const weeklyPrizes = [250, 150, 75, 25]
    const dailyPrizes = [1000, 500, 250, 50, 50, 50, 50, 50, 50, 50]

    function getPrize(rank, placement) {
        if (period() === 'weekly') return weeklyPrizes[rank - 1] || 0
        return placement?.reward ?? dailyPrizes[rank - 1] ?? 0
    }

    createEffect(() => {
        const socket = ws()
        if (!socket) return

        const handleWeeklyUpdate = (users) => {
            if (period() === 'weekly') setPlacements(users)
        }

        socket.on('leaderboard:weekly', handleWeeklyUpdate)
        onCleanup(() => socket.off('leaderboard:weekly', handleWeeklyUpdate))
    })

    async function fetchLB(period) {
        try {
            let lb = await api(`/leaderboard/${period}`, 'GET', null)
            if (lb.users) { setPlacements(lb.users) }
            if (lb.endsIn) {
                lb.endsAt = Date.now() + lb.endsIn
                setTime(lb.endsAt - Date.now())
            }

            return mutate(lb)
        } catch (e) {
            console.log(e)
            return mutate(null)
        }
    }

    const timer = setInterval(() => {
        setWeeklyTime(Math.max(0, endTime.getTime() - Date.now()))
        if (!leaderboard() || !leaderboard().endsAt) return
        setTime(leaderboard().endsAt - Date.now())
    }, 1000)
    onCleanup(() => clearInterval(timer))

    function formatTimeLeft() {
        const totalSeconds = Math.floor(time() / 1000)
        const days = Math.floor(totalSeconds / 86400)
        const hours = Math.floor((totalSeconds % 86400) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        return `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
    }

    function formatWeeklyTimeLeft() {
        const totalMinutes = Math.floor(Math.max(0, weeklyTime()) / 60000)
        const days = Math.floor(totalMinutes / 1440)
        const hours = Math.floor((totalMinutes % 1440) / 60)
        const minutes = totalMinutes % 60
        return `${days} Days, ${hours} Hours, ${minutes} Mins`
    }

    return (
        <>
            <Title>GalaxyBets | Leaderboard</Title>
            <Meta name='title' content='Leaderboard'></Meta>
            <Meta name='description' content='See the top players and results on GalaxyBets.'></Meta>

            <div class='leaderboard-container fadein'>
                <section class='weekly-promo' aria-label='Weekly Leaderboard'>
                    <div class='weekly-promo-copy'>
                        <p class='weekly-promo-label'>WEEKLY LEADERBOARD</p>
                        <h2>$500 WEEKLY CLASH - Top 4 Wagerers Share $500!</h2>
                    </div>
                    <p class='weekly-promo-timer'>Resets in: {formatWeeklyTimeLeft()}</p>
                </section>

                <div class='leaderboard-banner'>
                    <img class='art' src='/assets/art/goldswiggle.png' width='380' height='86'/>
                    <img class='art right' src='/assets/art/goldswiggle.png' width='380' height='86'/>

                    <img class='coin' src='/assets/icons/coin.svg' width='100' height='88'/>
                    <img class='coin two' src='/assets/icons/coinreverse.png' width='53' height='57'/>
                    <img class='coin three' src='/assets/icons/coin.svg' width='96' height='86'/>
                    <img class='coin four' src='/assets/icons/coinreverse.png' width='63' height='68'/>

                    <h1 class='title'>THE CLASH</h1>
                    <p class='desc'>
                        <span class='gold'>THE CLASH</span> IS A DAILY & WEEKLY LEADERBOARD BETWEEN ALL THE
                        COMPETITIVE PLAYERS WHO WANT TO PARTICIPATE TO <span class='gold'>EARN AMAZING PRIZES!</span>
                    </p>

                    <div class='periods'>
                        <button class={'period bevel-gold ' + (period() === 'daily' ? 'active' : '')} onClick={() => setPeriod('daily')}>DAILY</button>
                        <button class={'period bevel-gold ' + (period() === 'weekly' ? 'active' : '')} onClick={() => setPeriod('weekly')}>WEEKLY</button>
                    </div>
                </div>

                <Show when={!leaderboard.loading} fallback={<Loader/>}>
                    <>
                        <div className='time'>
                            <img src='/assets/icons/timer.svg' width='19' height='22' alt=''/>
                            <p>{formatTimeLeft()}</p>
                        </div>

                        <div className='podium-container'>
                            <div className='podium first'>
                                <p className='tag'>1st PLACE</p>

                                <Avatar id={placements()[0] ? placements()[0]?.id || 'Anonymous' : '?'} height='68'
                                        xp='gold'/>
                                <p>{placements()[0] ? placements()[0]?.username || 'Anonymous' : 'No User'}</p>
                                <div className='cost'>
                                    <img src='/assets/icons/coin.svg' height='14' width='15' alt=''/>
                                    <p>{formatUSD(placements()[0]?.wagered)}</p>
                                </div>
                                <div className='bar'/>
                                <img className='item'
                                     src={placements()[0]?.item} alt=''
                                     height='56'/>
                                <div className='cost'>
                                    <img src='/assets/icons/coin.svg' height='14' width='15' alt=''/>
                                    <p>{formatUSD(getPrize(1, placements()[0]))}</p>
                                </div>
                            </div>

                            <div className='podium second'>
                                <p className='tag'>2nd PLACE</p>

                                <Avatar id={placements()[1] ? placements()[1]?.id || 'Anonymous' : '?'} height='68'
                                        xp='silver'/>
                                <p>{placements()[1] ? placements()[1]?.username || 'Anonymous' : 'No User'}</p>
                                <div className='cost'>
                                    <img src='/assets/icons/coin.svg' height='14' width='15' alt=''/>
                                    <p>{formatUSD(placements()[1]?.wagered)}</p>
                                </div>
                                <div className='bar'/>
                                <img className='item' src={placements()[1]?.item} alt='' height='56'/>
                                <div className='cost'>
                                    <img src='/assets/icons/coin.svg' height='14' width='15' alt=''/>
                                    <p>{formatUSD(getPrize(2, placements()[1]))}</p>
                                </div>
                            </div>

                            <div className='podium third'>
                                <p className='tag'>3rd PLACE</p>

                                <Avatar id={placements()[2] ? placements()[2]?.id || 'Anonymous' : '?'} height='68'
                                        xp='bronze'/>
                                <p>{placements()[2] ? placements()[2]?.username || 'Anonymous' : 'No User'}</p>
                                <div className='cost'>
                                    <img src='/assets/icons/coin.svg' height='14' width='15' alt=''/>
                                    <p>{formatUSD(placements()[2]?.wagered)}</p>
                                </div>
                                <div className='bar'/>
                                <img className='item'
                                     src={placements()[2]?.item} alt=''
                                     height='56'/>
                                <div className='cost'>
                                    <img src='/assets/icons/coin.svg' height='14' width='15' alt=''/>
                                    <p>{formatUSD(getPrize(3, placements()[2]))}</p>
                                </div>
                            </div>
                        </div>

                        <div className='bar divider'/>

                        <div className='table-header'>
                            <div className='table-column'>
                                <p>PLACE</p>
                            </div>

                            <div className='table-column'>
                                <p>USER</p>
                            </div>

                            <div className='table-column'>
                                <p>WAGERED</p>
                            </div>

                            <div className='table-column'>
                                <p>REWARD</p>
                            </div>
                        </div>

                        <For each={placements().slice(3)}>{(placement, index) => (
                            <div className='table-data'>
                                <div className='table-column'>
                                    <p>#{index() + 4}</p>
                                </div>

                                <div className='table-column'>
                                    <Avatar id={placement?.id} height='30'/>
                                    <p>{placement?.username || 'Anonymous'}</p>
                                </div>

                                <div className='table-column'>
                                    <img src='/assets/icons/coin.svg' height='15' width='16' alt=''/>
                                    <p>{formatUSD(placement?.wagered)}</p>
                                </div>

                                <div className='table-column gold'>
                                    <img src='/assets/icons/coin.svg' height='15' width='16' alt=''/>
                                    <p>{formatUSD(getPrize(index() + 4, placement))}</p>
                                </div>
                            </div>
                        )}</For>
                    </>
                </Show>
            </div>

            <style jsx>{`
              .leaderboard-container {
                width: 100%;
                max-width: 1175px;
                height: fit-content;

                box-sizing: border-box;
                padding: 30px 0;
                margin: 0 auto;
              }

              .weekly-promo {
                min-height: 120px;
                box-sizing: border-box;
                margin-bottom: 24px;
                padding: 22px 30px;
                border: 1px solid rgba(176, 151, 255, 0.75);
                border-radius: 8px;
                background:
                  radial-gradient(70% 180% at 0% 50%, rgba(139, 92, 246, 0.4) 0%, transparent 100%),
                  linear-gradient(110deg, #21164c 0%, #38226f 52%, #201545 100%);
                box-shadow: 0 8px 28px rgba(20, 10, 55, 0.35);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
              }

              .weekly-promo-copy {
                display: flex;
                flex-direction: column;
                gap: 6px;
              }

              .weekly-promo-label {
                margin: 0;
                color: #c5b7ff;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 1.8px;
              }

              .weekly-promo h2 {
                margin: 0;
                color: #fff;
                font-size: 25px;
                font-weight: 900;
                text-shadow: 0 2px 12px rgba(160, 122, 255, 0.45);
              }

              .weekly-promo-timer {
                flex-shrink: 0;
                margin: 0;
                padding: 11px 15px;
                border: 1px solid rgba(194, 174, 255, 0.4);
                border-radius: 5px;
                background: rgba(15, 9, 39, 0.42);
                color: #e2d9ff;
                font-size: 15px;
                font-weight: 700;
              }
              
              .leaderboard-banner {
                width: 100%;
                height: 165px;

                border-radius: 8px;
                border: 1px dashed #FCA31E;
                background: linear-gradient(0deg, rgba(0, 0, 0, 0.20) 0%, rgba(0, 0, 0, 0.30) 100%), radial-gradient(102.11% 102.11% at 50.00% 103.31%, rgba(255, 171, 46, 0.78) 0%, rgba(0, 0, 0, 0.00) 100%), linear-gradient(0deg, rgba(0, 0, 0, 0.30) 0%, rgba(0, 0, 0, 0.20) 100%), radial-gradient(4404.69% 184.13% at 1.21% 0.00%, rgba(245, 170, 56, 0.60) 0%, rgba(0, 0, 0, 0.00) 100%), radial-gradient(7956.17% 242.63% at 105.07% -21.99%, rgba(255, 168, 0, 0.74) 0%, rgba(0, 0, 0, 0.00) 100%), #F4AD59;

                display: flex;
                gap: 10px;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                
                position: relative;
              }
              
              .coin {
                position: absolute;
                left: -30px;
                bottom: 5px;
              }

              .coin.two {
                position: absolute;
                left: 36px;
                top: -10px;
              }

              .coin.three {
                position: absolute;
                left: unset;
                right: 14px;
                top: 5px;
              }

              .coin.four {
                position: absolute;
                left: unset;
                right: -18px;
                bottom: 5px;
                transform: rotate(30deg);
              }
              
              .art {
                position: absolute;
                left: 0;
              }
              
              .art.right {
                left: unset;
                right: 0;
                transform: rotate(180deg) scaleY(-1);
              }
              
              .title {
                background: linear-gradient(37deg, #F90 30.03%, #F9AC39 42.84%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                
                text-align: center;
                font-family: "Rubik", sans-serif;
                font-size: 54px;
                font-weight: 900;
                filter: drop-shadow(0px 3px 0px rgba(0, 0, 0, 0.4));
              }
              
              h1 {
                margin: unset;
              }
              
              .desc {
                color: #FFF;
                text-align: center;
                font-family: "Rubik", sans-serif;
                font-size: 16px;
                font-weight: 700;
                max-width: 625px;
              }
              
              .periods {
                display: flex;
                align-items: center;
                gap: 8px;
                
                position: absolute;
                top: 18px;
                margin-left: 550px;
              }
              
              .period {
                height: 30px;
                padding: 0 15px;
              }
              
              .period:disabled {
                cursor: not-allowed;
                opacity: 0.5;
              }
              
              .period.active {
                box-shadow: unset;
                border-radius: 3px;
                border: 1px solid #FCA31E;
                background: rgba(252, 163, 30, 0.25);
                color: #FCA31E;
              }
              
              .time {
                display: flex;
                align-items: center;
                gap: 8px;
                
                margin-top: 20px;
                justify-content: flex-end;

                color: #FFF;
                font-size: 16px;
                font-weight: 700;
              }
              
              .podium-container {
                width: 100%;
                
                display: flex;
                align-items: flex-end;
                gap: 50px;
                padding: 0 60px;
              }
              
              .podium {
                flex: 1 1 0;
                height: 286px;
                border: 1px solid transparent;
                border-radius: 5px;
                position: relative;
                padding: 20px;
                
                display: flex;
                flex-direction: column;
                gap: 6px;
                align-items: center;

                color: #FFF;
                font-family: "Geogrotesque Wide", sans-serif;
                font-size: 14px;
                font-weight: 700;
              }
              
              .bar {
                width: 100%;
                min-height: 1px;
                margin: 6px 0;
                background: #5A5499;
              }
              
              .bar.divider {
                margin: 35px 0 0 0;
              }
              
              .item {
                margin: auto 0 auto 0;
              }
              
              .cost {
                border-radius: 3px;
                background: rgba(252, 163, 30, 0.24);
                min-height: 30px;
                padding: 0 12px;
              }
              
              .tag {
                padding: 0 8px;
                height: 25px;
                position: absolute;
                top: -6px;
                left: -1px;

                color: #FFF;
                font-size: 12px;
                font-weight: 700;
                line-height: 25px;
                
                border-radius: 2px;
              }
              
              .first {
                height: 312px;
                background: radial-gradient(134.74% 103.27% at 50.00% 103.27%, rgba(252, 163, 30, 0.34) 0%, rgba(0, 0, 0, 0.00) 100%), linear-gradient(143deg, rgba(255, 153, 0, 0.15) 30.03%, rgba(249, 172, 57, 0.15) 42.84%);
                border-color: rgb(249, 172, 57);
                order: 2;
              }
              
              .first .tag {
                background: linear-gradient(37deg, #F90 30.03%, #F9AC39 42.84%);
              }
              
              .first .bar {
                background: linear-gradient(270deg, rgba(252, 162, 27, 0.00) 0%, rgba(252, 162, 27, 0.65) 49.00%, rgba(252, 162, 27, 0.00) 100%);
              }
              
              .second {
                background: radial-gradient(134.74% 103.27% at 50.00% 103.27%,  rgba(189, 189, 189, 0.34) 0%, rgba(0, 0, 0, 0.00) 100%), linear-gradient(37deg, rgba(209, 209, 209, 0.15) 30.03%, rgba(251, 251, 251, 0.15) 42.84%);
                border-color: rgb(193, 193, 193);
                order: 1;
              }
              
              .second .tag {
                color: rgba(0, 0, 0, 0.53);
                background: linear-gradient(37deg, #D1D1D1 30.03%, #FBFBFB 42.84%);
              }
              
              .second .bar {
                background: linear-gradient(270deg, rgba(137, 137, 137, 0.00) 0%, rgba(192, 192, 192, 0.33) 49.00%, rgba(137, 137, 137, 0.00) 100%);
              }
              
              .third {
                background: radial-gradient(134.74% 103.27% at 50.00% 103.27%, rgba(115, 85, 68, 0.34) 0%, rgba(0, 0, 0, 0.00) 100%), linear-gradient(37deg, rgba(115, 85, 68, 0.15) 30.03%, rgba(160, 121, 98, 0.15) 42.84%);
                border-color: rgb(164, 124, 102);
                order: 3;
              }
              
              .third .tag {
                color: rgba(0, 0, 0, 0.46);
                background: linear-gradient(37deg, #735544 30.03%, #A07962 42.84%);
              }
              
              .third .bar {
                background: linear-gradient(270deg, rgba(252, 162, 27, 0.00) 0%, rgba(252, 162, 27, 0.33) 49.00%, rgba(252, 162, 27, 0.00) 100%);
              }
              
              .table-header, .table-data {
                display: flex;
                justify-content: space-between;
                margin: 20px 0;
              }
              
              .table-data {
                height: 55px;
                background: rgba(90, 84, 153, 0.35);
                padding: 0 20px;
                
                display: flex;
                align-items: center;

                color: #ADA3EF;
                font-size: 14px;
                font-weight: 700;
              }
              
              .table-column {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1 1 0;
              }
              
              .table-column:nth-of-type(4n) {
                justify-content: flex-end;
              }
              
              .table-header p {
                background: rgba(90, 84, 153, 0.35);
                height: 25px;
                line-height: 25px;
                padding: 0 15px;
                border-radius: 2px;

                color: #ADA3EF;
                font-size: 12px;
                font-weight: 700;
              }
              
              @media only screen and (max-width: 1000px) {
                .leaderboard-container {
                  padding-bottom: 90px;
                }
              }

              @media only screen and (max-width: 650px) {
                .weekly-promo {
                  align-items: flex-start;
                  flex-direction: column;
                  padding: 20px;
                }

                .weekly-promo h2 {
                  font-size: 20px;
                }
              }
            `}</style>
        </>
    );
}

export default Leaderboard;
