/**
 * 混雑状況の集計ロジック（患者・管理画面で共通）
 * スコア: すいてる=1, ふつう=2, こんでる=3
 * 判定: <1.5=空いている, >=2.5=混んでいる, それ以外=ふつう
 */
const SCORE_MAP = { すいてる: 1, ふつう: 2, こんでる: 3 } as const
const THRESHOLD_LOW = 1.5
const THRESHOLD_HIGH = 2.5
const RELIABLE_COUNT = 3

export type CrowdStatus = '空いている' | 'ふつう' | '混んでいる'

export interface CrowdStatusResult {
  text: CrowdStatus
  label: string // 表示用（空いている / ふつう / 混んでいる）
  icon: string
  score: number
  avgScore: number
  isReliable: boolean // 3件以上で確定
  colorClass: 'green' | 'yellow' | 'red'
}

export function useCrowdStatus(getReports: () => { status: string }[]) {
  return computed<CrowdStatusResult | null>(() => {
    const reps = getReports() || []
    if (reps.length === 0) {
      return null
    }
    const total = reps.reduce((acc, r) => acc + (SCORE_MAP[r.status as keyof typeof SCORE_MAP] ?? 0), 0)
    const avgScore = total / reps.length
    const isReliable = reps.length >= RELIABLE_COUNT

    let text: CrowdStatus
    let icon: string
    let colorClass: 'green' | 'yellow' | 'red'

    if (avgScore < THRESHOLD_LOW) {
      text = '空いている'
      icon = '😊'
      colorClass = 'green'
    } else if (avgScore >= THRESHOLD_HIGH) {
      text = '混んでいる'
      icon = '😣'
      colorClass = 'red'
    } else {
      text = 'ふつう'
      icon = '😐'
      colorClass = 'yellow'
    }

    return {
      text,
      label: text,
      icon,
      score: Number(avgScore.toFixed(1)),
      avgScore,
      isReliable,
      colorClass
    }
  })
}
