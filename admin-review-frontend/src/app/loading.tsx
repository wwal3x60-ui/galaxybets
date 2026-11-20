import styles from '@/components/layout/PageLoading.module.css';
export default function Loading(){return <section className={styles.loading} role="status" aria-busy="true"><span className={styles.label}>Loading page…</span><div className={styles.heading} aria-hidden="true"/><div className={styles.grid} aria-hidden="true">{[0,1,2,3].map(i=><div key={i} className={styles.card}/>)}</div></section>}
