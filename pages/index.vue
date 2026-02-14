<template>
  <div class="app-container">
    <div v-if="!hospital" class="loading-state">
      <p>読み込み中...</p>
    </div>
    <template v-else>
    <template v-if="isBannerActive">
      <div v-if="hospital.is_low_alert_naika" class="alert-banner naika-bg">📢 内科：いま空いています！</div>
      <div v-if="hospital.is_low_alert_seikei" class="alert-banner">📢 整形外科：いま空いています！</div>
    </template>

    <div class="main-card">
      <h1 class="hospital-name">{{ hospital.name }}</h1>

      <!-- 受付ステータス -->
      <div class="reception-badge" :style="{ background: isOpen ? '#e6f4ea' : '#fdecea', color: isOpen ? '#1e7e34' : '#c62828' }">
        {{ isOpen ? '🟢 本日受付中' : '🔴 本日受付終了' }}
      </div>

      <div class="wait-display">
        <div class="wait-item">内科：<span class="time-value">{{ displayWait.naika }}分</span></div>
        <div class="wait-item">整形：<span class="time-value">{{ displayWait.seikei }}分</span></div>

        <!-- 混雑状況ゲージ（Tailwind 3段階カラー） -->
        <div
          class="mt-5 pt-5 border-t border-dashed border-gray-300"
          :class="isManualOverride ? '' : (displayStatus?.isReliable ? '' : 'opacity-75')"
        >
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-bold text-gray-600">👥 患者さんの体感（直近30分）</span>
            <span
              v-if="!displayStatus?.isReliable && !isManualOverride && recentReports.length > 0"
              class="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600"
            >
              参考情報
            </span>
            <span
              v-if="isManualOverride"
              class="px-2 py-0.5 rounded text-xs font-medium bg-emerald-600 text-white"
            >
              病院による確定情報
            </span>
          </div>

          <div v-if="displayStatus || isManualOverride" class="relative overflow-hidden rounded-full h-12 bg-slate-100">
            <div
              class="absolute inset-y-0 left-0 flex items-center justify-center font-bold tracking-wider text-white rounded-full transition-all duration-700 ease-in-out"
              :style="{ width: gaugeWidth, backgroundColor: gaugeBarColor }"
            >
              {{ displayStatus?.icon || manualStatusDisplay?.icon }} {{ displayStatus?.label || manualStatusDisplay?.label }}
            </div>
          </div>

          <p
            v-if="!displayStatus?.isReliable && !isManualOverride && recentReports.length > 0"
            class="mt-2 text-xs text-gray-500"
          >
            データ少なめ（{{ recentReports.length }}件）
          </p>
          <div v-else-if="recentReports.length === 0 && !isManualOverride" class="mt-2 text-sm text-gray-500">
            📝 まだ直近の報告はありません
          </div>
        </div>
      </div>

      <p class="guide-text">1. 日にちを選択</p>
      <div class="day-selector">
        <button :class="{ active: dayType === 'weekday' }" @click="setDayType('weekday')">平日</button>
        <button :class="{ active: dayType === 'saturday' }" @click="setDayType('saturday')">土曜日</button>
      </div>

      <p class="guide-text">2. 時間帯を選択</p>
      <div class="time-selector-vertical">
        <button :class="{ active: selectedSlot === 'morning' }" @click="selectedSlot = 'morning'">9:00 - 10:30</button>
        <button :class="{ active: selectedSlot === 'noon' }" @click="selectedSlot = 'noon'">10:30 - 12:30</button>
        <button v-if="dayType === 'weekday'" :class="{ active: selectedSlot === 'afternoon' }" @click="selectedSlot = 'afternoon'">14:00 - 17:00</button>
      </div>

      <hr class="divider" />

      <section class="report-section">
        <p class="report-title">3. いまの様子を教えてください</p>
        <div class="report-buttons">
          <button
            v-for="opt in reportOptions"
            :key="opt.status"
            :disabled="isSendingReport || !isOpen"
            :class="[opt.class, { 'selected-btn': lastReport === opt.status, 'btn-closed': !isOpen }]"
            @click="sendReport(opt.status)"
          >
            <span class="main-text">
              {{ opt.label }}
              <span v-if="lastReport === opt.status"> ✅</span>
            </span>
            <span class="sub-text">{{ opt.desc }}</span>
          </button>
        </div>

        <div class="status-message" v-if="lastReport && !reportError">
          <p class="sent-msg">✅ ありがとうございます。送信しました</p>
        </div>
        <div v-if="reportError" class="mt-3 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
          {{ reportError }}
        </div>
      </section>
    </div>
    </template>
  </div>
</template>

<script setup>
// デモ用: true=受付中, false=受付終了（この値を切り替えるだけで表示・ボタン状態が変わる）
const isOpen = true

const supabase = useSupabaseClient()
const hospitalId = 'd6e29b2d-668a-4450-ba27-25c8724f5715'

const dayType = ref('weekday')
const selectedSlot = ref('morning')
const lastReport = ref(null)

const { data: hospital, refresh: refreshHospital } = await useAsyncData(
  'get_hospital',
  async () => {
    const { data } = await supabase.from('hospitals').select('*').eq('id', hospitalId).single()
    return data
  },
  { server: false }
)

const { data: reports, refresh: refreshReports } = await useAsyncData(
  'get_recent_reports',
  async () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data } = await supabase.from('reports').select('*').eq('hospital_id', hospitalId).gt('created_at', thirtyMinsAgo)
    return data
  },
  { server: false }
)

// リアルタイム購読
onMounted(() => {
  const reportsChannel = supabase
    .channel('reports-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports', filter: `hospital_id=eq.${hospitalId}` }, () => {
      refreshReports()
    })
    .subscribe()

  const hospitalChannel = supabase
    .channel('hospital-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hospitals', filter: `id=eq.${hospitalId}` }, () => {
      refreshHospital()
    })
    .subscribe()

  onUnmounted(() => {
    supabase.removeChannel(reportsChannel)
    supabase.removeChannel(hospitalChannel)
  })
})

const recentReports = computed(() => reports.value || [])

// 集計ロジック: 直近30分、スコア すいてる=1/ふつう=2/こんでる=3
const crowdStatus = useCrowdStatus(() => recentReports.value)

// 手動上書きの判定
// 本番: 60分。デモ用は 1 に変更すると1分で自動解除
const MANUAL_EXPIRY_MINUTES = 60
const isManualOverride = computed(() => {
  const h = hospital.value
  if (!h?.manual_status || !h?.manual_status_expires_at) return false
  return new Date(h.manual_status_expires_at).getTime() > Date.now()
})

const manualStatusDisplay = computed(() => {
  const status = hospital.value?.manual_status
  if (!status) return null
  const map = {
    空いている: { label: '空いている', icon: '😊', colorClass: 'green' },
    ふつう: { label: 'ふつう', icon: '😐', colorClass: 'yellow' },
    混んでいる: { label: '混んでいる', icon: '😣', colorClass: 'red' }
  }
  return map[status] || null
})

// 表示するステータス（手動優先 → 自動集計）
const displayStatus = computed(() => {
  if (isManualOverride.value && manualStatusDisplay.value) {
    const m = manualStatusDisplay.value
    return { ...m, isReliable: true }
  }
  return crowdStatus.value
})

// ゲージの幅（1=緑, 2=黄, 3=赤に対応）
const gaugeWidth = computed(() => {
  const s = displayStatus.value
  if (!s) return '33%'
  const score = crowdStatus.value && !isManualOverride.value ? crowdStatus.value.avgScore : (s.colorClass === 'green' ? 1 : s.colorClass === 'red' ? 3 : 2)
  const pct = 33 + ((score - 1) / 2) * 67
  return `${Math.min(100, Math.max(33, pct))}%`
})

const gaugeBarColor = computed(() => {
  const s = displayStatus.value
  if (!s) return '#0EA5E9'
  const c = s.colorClass
  if (c === 'green') return '#0EA5E9' // 澄んだスカイブルー（空いている）
  if (c === 'red')   return '#F43F5E' // きつすぎないローズレッド（混んでいる）
  return '#10B981' // 穏やかなエメラルド（ふつう）
})

const waitData = {
  weekday: { morning: { naika: 45, seikei: 60 }, noon: { naika: 20, seikei: 35 }, afternoon: { naika: 30, seikei: 40 } },
  saturday: { morning: { naika: 60, seikei: 80 }, noon: { naika: 50, seikei: 70 } }
}

const displayWait = computed(() => {
  const base = waitData[dayType.value][selectedSlot.value] || { naika: 0, seikei: 0 }
  return {
    naika: hospital.value?.current_wait_naika ?? base.naika,
    seikei: hospital.value?.current_wait_seikei ?? base.seikei
  }
})

const isBannerActive = computed(() => {
  if (!hospital.value?.updated_at) return true
  return new Date(hospital.value.updated_at).getTime() > Date.now() - 60 * 60 * 1000
})

const setDayType = (type) => {
  dayType.value = type
  if (type === 'saturday' && selectedSlot.value === 'afternoon') selectedSlot.value = 'noon'
}

const isSendingReport = ref(false)
const reportError = ref(null)

const sendReport = async (status) => {
  if (isSendingReport.value) return
  isSendingReport.value = true
  reportError.value = null
  lastReport.value = status

  const { error } = await supabase.from('reports').insert([{ hospital_id: hospitalId, status, time_slot: selectedSlot.value }])
  if (error) {
    reportError.value = error.message
    isSendingReport.value = false
    return
  }
  await refreshReports()
  isSendingReport.value = false
}

const reportOptions = [
  { status: 'すいてる', label: '😊 すいてる', desc: '半分以上の席があいている', class: 'btn-low' },
  { status: 'ふつう', label: '😐 ふつう', desc: 'だいたい席が埋まっている', class: 'btn-mid' },
  { status: 'こんでる', label: '😣 こんでる', desc: '立っている人がいる', class: 'btn-high' }
]
</script>

<style scoped>
.app-container { background-color: #E0F2F1; min-height: 100vh; padding: 15px; font-family: sans-serif; }
.loading-state { display: flex; justify-content: center; align-items: center; min-height: 50vh; font-size: 1.2rem; color: #666; }
.alert-banner { padding: 18px; border-radius: 15px; margin-bottom: 12px; text-align: center; font-weight: bold; color: white; background-color: #FF9800; font-size: 1.1rem; }
.naika-bg { background-color: #009688; }
.main-card { background: white; border-radius: 35px; padding: 25px; max-width: 480px; margin: 0 auto; box-sizing: border-box; }
.hospital-name { text-align: center; font-size: 1.8rem; color: #333; margin-bottom: 15px; }

.wait-display { text-align: center; margin-bottom: 30px; background: #F8FDFF; padding: 20px; border-radius: 25px; border: 1px solid #E1F5FE; }
.time-value { color: #1A237E; font-size: 2.8rem; font-weight: bold; }

.guide-text { font-size: 1.1rem; color: #666; font-weight: bold; margin-bottom: 12px; }
.day-selector { display: flex; gap: 10px; margin-bottom: 25px; }
.day-selector button { flex: 1; padding: 15px; border-radius: 20px; border: 3px solid #4FA3D1; background: white; color: #4FA3D1; font-size: 1.2rem; font-weight: bold; }
.time-selector-vertical { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
.time-selector-vertical button { padding: 15px; border-radius: 15px; border: 2px solid #4FA3D1; background: white; color: #4FA3D1; font-size: 1.2rem; font-weight: bold; }
.active { background-color: #4FA3D1 !important; color: white !important; }

.report-buttons button { display: flex; flex-direction: column; align-items: center; padding: 15px; border-radius: 25px; width: 100%; margin-bottom: 10px; border: 4px solid transparent; cursor: pointer; }
.report-buttons button:disabled { opacity: 0.7; cursor: not-allowed; }
.main-text { font-size: 1.4rem; font-weight: bold; }
.btn-low { background-color: #E3F2FD; color: #1565C0; }
.btn-mid { background-color: #E8F5E9; color: #2E7D32; }
.btn-high { background-color: #FFF3E0; color: #EF6C00; }
.selected-btn { border-color: #4FA3D1 !important; }

.status-message { text-align: center; margin-top: 25px; }
.sent-msg { font-size: 1.2rem; font-weight: bold; color: #333; }

/* 受付ステータスバッジ */
.reception-badge {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 16px;
  font-size: 1.05rem;
}

/* 受付終了時のボタン */
.btn-closed {
  background-color: #ccc !important;
  color: #888 !important;
  cursor: not-allowed !important;
}
</style>
