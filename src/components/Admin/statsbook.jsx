import {createResource, createSignal, For, Show} from "solid-js";
import {authedAPI, createNotification} from "../../util/api";
import Loader from "../Loader/loader";
import {useSearchParams} from "@solidjs/router";
import Pagination from "../Pagination/pagination";
import {formatUSD} from "../../util/numbers";

function AdminStatsbook(props) {

    let loadedPages = new Set()
    const [total, setTotal] = createSignal(1)
    const [page, setPage] = createSignal(1)
    const [isLoading, setIsLoading] = createSignal(true)

    const [params, setParams] = useSearchParams()
    const [stats, setStats] = createSignal([], { equals: false })
    const [statsbook, {
        mutate: mutateStats,
        refetch: refetchStats
    }] = createResource(fetchStats)

    async function fetchStats() {
        try {
            let statsbookRes = await authedAPI(`/admin/statsbook?page=${params.page || 1}`, 'GET', null)
            if (statsbookRes.error && statsbookRes.error === '2FA_REQUIRED') {
                createNotification('error', 'Admin authorization is required to continue.')
                return mutateStats(null)
            }

            setPage(+params?.page || 1)
            setTotal(statsbookRes?.pages)
            addStatsPage(statsbookRes.data)
            setIsLoading(false)
            return mutateStats(statsbookRes)
        } catch (e) {
            console.log(e)
            return mutateStats(null)
        }
    }

    function addStatsPage(data) {
        return setStats(stats => {
            stats[page()] = data
            return stats
        })
    }

    async function loadPage() {
        if (isLoading()) return
        setIsLoading(true)
        setParams({ page: page() })

        let moreData = await authedAPI(`/admin/statsbook?page=${page()}`, 'GET', null)
        if (!moreData) return setIsLoading(false)

        addStatsPage(moreData.data)
        setTotal(moreData.pages)
        loadedPages.add(page())

        setIsLoading(false)
    }

    function getColor(amount) {
        if (amount === 0) return ''
        if (amount > 0) return 'green'
        return 'red'
    }

    return (
        <>
            <div class='statsbook-wrapper'>
                <div className='table-header'>
                    <div className='table-column'>
                        <p>DATE</p>
                    </div>

                    <div className='table-column'>
                        <p>NPC</p>
                    </div>

                    <div className='table-column'>
                        <p>CRYPTO</p>
                    </div>

                    <div className='table-column'>
                        <p>NET</p>
                    </div>
                </div>

                <Show when={!statsbook.loading} fallback={<Loader/>}>
                    <div class='table'>
                        <For each={stats()[page()] || []}>{(stat, index) =>
                            <div className='table-data'>
                                <div className='table-column'>
                                    <p>{stat?.date}</p>
                                </div>

                                <div className='table-column'>
                                    <p>{stat?.npc}</p>
                                </div>

                                <div className='table-column'>
                                    <p className="green">{formatUSD(stat?.cryptoDeposits)}</p> / <p className="red">{formatUSD(stat?.cryptoWithdraws)}</p>
                                </div>

                                <div className='table-column'>
                                    <p className={getColor(stat?.netProfit)}>{formatUSD(stat?.netProfit)}</p>
                                </div>
                            </div>
                        }</For>
                    </div>

                    <Pagination isLoading={isLoading()} loadedPages={loadedPages} loadPage={loadPage} page={page()} total={total()} setPage={setPage} setParams={setParams}/>
                </Show>
            </div>

            <style jsx>{`
              .statsbook-wrapper {
                display: flex;
                flex-direction: column;
              }
              
              .table {
                display: flex;
                flex-direction: column;
                margin-bottom: 20px;
              }

              .table-header, .table-data {
                display: flex;
                justify-content: space-between;
              }

              .red {
                color: #ff5959;
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

              .table-data:nth-of-type(2n) {
                background: rgba(90, 84, 153, 0.15);
              }

              .table-column {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1 1 0;
              }

              .table-column:nth-of-type(9n) {
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
            `}</style>
        </>
    );
}

export default AdminStatsbook;
