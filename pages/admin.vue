<template>
  <div class="admin-container">
    <!-- 混雑アラート（平均スコア>=2.5） -->
    <div
      v-if="showCongestionAlert"
      class="fixed inset-0 z-50 flex items-center justify-center bg-red-600/95 backdrop-blur-sm"
    >
      <div class="text-center text-white p-8 max-w-md">
        <p class="text-6xl mb-4">🚨</p>
        <h2 class="text-3xl font-bold mb-2">混雑アラート</h2>
        <p class="text-xl mb-6">スタッフの皆様、ご対応をお願いします</p>
        <p class="text-lg opacity-90">患者さんの報告が「混んでいる」と示しています</p>
        <button
          @click="dismissCongestionAlert"
          class="mt-8 px-8 py-3 bg-white text-red-600 font-bold rounded-lg hover:bg-gray-100"
        >
          確認しました
        </button>
      </div>
    </div>

    <header class="admin-header">
      <h1>🏥 受付管理パネル</h1>
      <button @click="refreshData" class="refresh-btn">🔄 最新に更新</button>
    </header>

    <div v-if="hospital" class="admin-content">
      <!-- 受付ステータス操作（iPad対応・巨大ボタン） -->
      <section class="ipad-section">
        <h2 class="ipad-section-title">🚪 受付ステータス</h2>
        <div class="reception-mega-buttons">
          <button
            @click="setReceptionStatus('open')"
            :class="['reception-mega-btn', receptionStatus === 'open' ? 'reception-mega-active-open' : 'reception-mega-inactive']"
          >
            <span class="reception-mega-icon">🟢</span>
            <span class="reception-mega-label">受付開始</span>
          </button>
          <button
            @click="setReceptionStatus('closed')"
            :class="['reception-mega-btn', receptionStatus === 'closed' ? 'reception-mega-active-closed' : 'reception-mega-inactive']"
          >
            <span class="reception-mega-icon">🔴</span>
            <span class="reception-mega-label">受付終了</span>
          </button>
        </div>
      </section>

      <!-- 1. 患者と共通のゲージ（一番大きく） -->
      <section class="gauge-section">
        <h2 class="section-title">今、患者にどう見えているか</h2>
        <div
          v-if="displayStatus || isManualOverride"
          class="gauge-wrapper"
          :class="{ 'opacity-80': !effectiveStatus?.isReliable && !isManualOverride }"
        >
          <div class="relative overflow-hidden rounded h-16 bg-gray-200 shadow-inner">
            <div class="absolute inset-0 flex">
              <div class="flex-1" style="background:#BBDEFB"></div>
              <div class="flex-1" style="background:#C8E6C9"></div>
              <div class="flex-1" style="background:#FFE0B2"></div>
            </div>
            <div
              class="absolute inset-y-0 left-0 flex items-center justify-center font-bold text-white text-xl transition-all duration-500"
              :style="{ width: adminGaugeWidth, backgroundColor: adminGaugeBarColor }"
            >
              {{ displayStatus?.icon || manualStatusDisplay?.icon }}
              {{ displayStatus?.label || manualStatusDisplay?.label }}
            </div>
          </div>
          <div class="gauge-meta mt-2 flex justify-between items-center text-sm">
            <span v-if="isManualOverride" class="text-emerald-600 font-medium">手動設定中</span>
            <span v-else-if="effectiveStatus?.isReliable" class="text-slate-600">確定情報（{{ recentReports.length }}件）</span>
            <span v-else class="text-amber-600">参考情報（{{ recentReports.length }}件・データ少なめ）</span>
            <span v-if="countdownMinutes !== null" class="text-slate-500 font-medium">
              残り{{ countdownMinutes }}分で自動解除
            </span>
          </div>
        </div>
        <div v-else class="text-slate-500 py-8 text-center">直近30分の報告がまだありません</div>
      </section>

      <!-- 手動上書き -->
      <section class="status-card">
        <h2 class="section-title">手動で混雑状況を上書き</h2>
        <div v-if="isManualOverride" class="flex gap-3 items-center flex-wrap">
          <span class="text-slate-600">現在: {{ hospital.manual_status }}</span>
          <button
            @click="clearManualOverride"
            class="px-4 py-2 text-sm font-medium border border-slate-300 rounded hover:bg-slate-50"
          >
            解除して自動集計に戻す
          </button>
        </div>
        <div v-else class="flex gap-3 flex-wrap">
          <button
            v-for="opt in manualOptions"
            :key="opt.value"
            @click="setManualOverride(opt.value)"
            :class="['px-4 py-2 rounded font-medium border', opt.class]"
          >
            {{ opt.icon }} {{ opt.label }}
          </button>
        </div>
      </section>

      <!-- 2. 分析セクション -->
      <section class="status-card analysis-section">
        <div class="flex justify-between items-center mb-3">
          <h2 class="section-title mb-0">📊 分析</h2>
          <span
            v-if="hasNewReportBadge"
            class="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white animate-pulse"
          >
            新着報告あり
          </span>
        </div>
        <div class="report-trend grid grid-cols-3 gap-4 text-center">
          <div class="trend-item">
            <span class="trend-value">{{ reportCount5min }}</span>
            <span class="trend-label">直近5分</span>
          </div>
          <div class="trend-item">
            <span class="trend-value">{{ reportCount15min }}</span>
            <span class="trend-label">直近15分</span>
          </div>
          <div class="trend-item">
            <span class="trend-value">{{ recentReports.length }}</span>
            <span class="trend-label">直近30分</span>
          </div>
        </div>
        <p v-if="recentReports.length > 0" class="text-sm text-slate-500 mt-2 text-center">
          平均スコア: {{ effectiveStatus?.score ?? '-' }}（すいてる=1, ふつう=2, こんでる=3）
        </p>
        <!-- デモ用リセットボタン -->
        <div class="mt-4 pt-4 border-t border-slate-200">
          <button
            @click="resetReportsData"
            :disabled="isResetting"
            class="w-full px-4 py-2 text-sm font-medium border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {{ isResetting ? 'リセット中...' : '🗑️ デモ用：報告データをリセット' }}
          </button>
        </div>
      </section>

      <!-- 待ち時間（iPad対応・人数入力 → 1人=10分で自動計算） -->
      <section class="ipad-section">
        <h2 class="ipad-section-title">⏱️ 待ち人数の入力</h2>
        <p class="ipad-hint">待っている人数をタップで入力 → 1人 = 10分で自動計算</p>

        <!-- 内科 -->
        <div class="wait-mega-row">
          <span class="wait-mega-dept">内科</span>
          <div class="wait-mega-display">
            <span class="wait-mega-number">{{ waitNaika }}</span>
            <span class="wait-mega-unit">分</span>
          </div>
          <div class="wait-mega-control">
            <button class="wait-mega-btn wait-mega-minus" @click="adjustCount('naika', -1)">－</button>
            <span class="wait-mega-count">{{ countNaika }}人</span>
            <button class="wait-mega-btn wait-mega-plus" @click="adjustCount('naika', 1)">＋</button>
          </div>
        </div>

        <!-- 整形外科 -->
        <div class="wait-mega-row">
          <span class="wait-mega-dept">整形</span>
          <div class="wait-mega-display">
            <span class="wait-mega-number">{{ waitSeikei }}</span>
            <span class="wait-mega-unit">分</span>
          </div>
          <div class="wait-mega-control">
            <button class="wait-mega-btn wait-mega-minus" @click="adjustCount('seikei', -1)">－</button>
            <span class="wait-mega-count">{{ countSeikei }}人</span>
            <button class="wait-mega-btn wait-mega-plus" @click="adjustCount('seikei', 1)">＋</button>
          </div>
        </div>
      </section>

      <!-- バナー操作 -->
      <section class="status-card">
        <h2 class="section-title">📢 「空いてます」バナー操作</h2>
        <div class="toggle-group">
          <button
            :class="['toggle-btn toggle-naika', { active: hospital.is_low_alert_naika }]"
            @click="toggleAlert('is_low_alert_naika')"
          >
            <span class="toggle-icon">🩺</span>
            内科：{{ hospital.is_low_alert_naika ? '表示中' : 'OFF' }}
          </button>
          <button
            :class="['toggle-btn toggle-seikei', { active: hospital.is_low_alert_seikei }]"
            @click="toggleAlert('is_low_alert_seikei')"
          >
            <span class="toggle-icon">🦴</span>
            整形：{{ hospital.is_low_alert_seikei ? '表示中' : 'OFF' }}
          </button>
        </div>
      </section>
    </div>

    <div v-else class="loading">データを読み込み中...</div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const hospitalId = 'd6e29b2d-668a-4450-ba27-25c8724f5715'

// 受付ステータス（localStorage 連動）
const receptionStatus = ref('open')

const handleReceptionStorageChange = (event) => {
  if (event.key === 'hospital_status') {
    receptionStatus.value = event.newValue || 'open'
  }
}

const setReceptionStatus = (status) => {
  receptionStatus.value = status
  localStorage.setItem('hospital_status', status)
  // 他タブへ即通知（storage イベントを手動発火）
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'hospital_status',
    newValue: status
  }))
}

// 手動上書きの有効期限（分）
// 本番: 60。デモ用は 1 に変更すると1分で自動解除
const MANUAL_EXPIRY_MINUTES = 60

// 待ち時間（人数ベース。1人=10分で自動計算）
const countNaika = ref(0)
const countSeikei = ref(0)
const waitNaika = computed(() => countNaika.value * 10)
const waitSeikei = computed(() => countSeikei.value * 10)

const congestionAlertDismissed = ref(false)
const hasNewReportBadge = ref(false)
const prevReportCount = ref(0)
const isResetting = ref(false)

const { data: hospital, refresh: refreshHospital } = await useAsyncData('hosp', async () => {
  const { data } = await supabase.from('hospitals').select('*').eq('id', hospitalId).single()
  if (data) {
    countNaika.value = Math.round((data.current_wait_naika || 0) / 10)
    countSeikei.value = Math.round((data.current_wait_seikei || 0) / 10)
  }
  return data
})

const { data: reports, refresh: refreshReports } = await useAsyncData(
  'reps',
  async () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data } = await supabase.from('reports')
      .select('*')
      .eq('hospital_id', hospitalId)
      .gt('created_at', thirtyMinsAgo)
    return data
  },
  { server: false }
)

const recentReports = computed(() => reports.value || [])

// 報告件数（5分・15分）
const reportCount5min = computed(() => {
  const cutoff = Date.now() - 5 * 60 * 1000
  return recentReports.value.filter(r => new Date(r.created_at).getTime() > cutoff).length
})
const reportCount15min = computed(() => {
  const cutoff = Date.now() - 15 * 60 * 1000
  return recentReports.value.filter(r => new Date(r.created_at).getTime() > cutoff).length
})

// 集計ロジック（共通composable）
const crowdStatus = useCrowdStatus(() => recentReports.value)
const effectiveStatus = computed(() => crowdStatus.value)

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

const displayStatus = computed(() => {
  if (isManualOverride.value && manualStatusDisplay.value) {
    return { ...manualStatusDisplay.value, isReliable: true }
  }
  return effectiveStatus.value
})

// 残り時間（分）
const countdownMinutes = computed(() => {
  const h = hospital.value
  if (!h?.manual_status_expires_at || !isManualOverride.value) return null
  const diff = new Date(h.manual_status_expires_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 60000))
})

const adminGaugeWidth = computed(() => {
  const s = displayStatus.value
  if (!s) return '33%'
  const score = effectiveStatus.value && !isManualOverride.value ? effectiveStatus.value.avgScore : (s.colorClass === 'green' ? 1 : s.colorClass === 'red' ? 3 : 2)
  const pct = 33 + ((score - 1) / 2) * 67
  return `${Math.min(100, Math.max(33, pct))}%`
})

const adminGaugeBarColor = computed(() => {
  const s = displayStatus.value
  if (!s) return '#0EA5E9'
  const c = s.colorClass
  if (c === 'green') return '#0EA5E9' // 澄んだスカイブルー（空いている）
  if (c === 'red')   return '#F43F5E' // きつすぎないローズレッド（混んでいる）
  return '#10B981' // 穏やかなエメラルド（ふつう）
})

// 混雑アラート（自動集計で平均>=2.5）
const showCongestionAlert = computed(() => {
  if (congestionAlertDismissed.value) return false
  if (isManualOverride.value) return false
  const s = effectiveStatus.value
  return s && s.avgScore >= 2.5
})

const dismissCongestionAlert = () => { congestionAlertDismissed.value = true }

// 新着報告バッジ（3件未満かつ報告が増えたとき。初回ロードは除く）
watch(recentReports, (next) => {
  const cnt = next.length
  if (cnt > prevReportCount.value && cnt < 3 && prevReportCount.value >= 0) {
    if (prevReportCount.value > 0) hasNewReportBadge.value = true
    setTimeout(() => { hasNewReportBadge.value = false }, 8000)
  }
  prevReportCount.value = cnt
}, { immediate: true })

// 手動上書きのタイマー（期限切れで自動解除）
let expiryCheckInterval = null

const setManualOverride = async (status) => {
  const expiresAt = new Date(Date.now() + MANUAL_EXPIRY_MINUTES * 60 * 1000).toISOString()
  await supabase.from('hospitals').update({
    manual_status: status,
    manual_status_expires_at: expiresAt
  }).eq('id', hospitalId)
  refreshHospital()
}

// デモ用：報告データリセット（クライアント側から直接削除）
const resetReportsData = async () => {
  if (isResetting.value) return
  if (!confirm('この病院の報告データをすべて削除します。よろしいですか？')) return
  isResetting.value = true
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('hospital_id', hospitalId)
  if (error) {
    alert('リセットに失敗しました: ' + error.message)
    isResetting.value = false
    return
  }
  await refreshReports()
  isResetting.value = false
}

const clearManualOverride = async () => {
  await supabase.from('hospitals').update({
    manual_status: null,
    manual_status_expires_at: null
  }).eq('id', hospitalId)
  refreshHospital()
}

const adjustCount = async (dept, delta) => {
  if (dept === 'naika') {
    countNaika.value = Math.max(0, countNaika.value + delta)
  } else {
    countSeikei.value = Math.max(0, countSeikei.value + delta)
  }
  const col = dept === 'naika' ? 'current_wait_naika' : 'current_wait_seikei'
  const val = dept === 'naika' ? waitNaika.value : waitSeikei.value
  await supabase.from('hospitals').update({ [col]: val }).eq('id', hospitalId)
}

const toggleAlert = async (col) => {
  if (!hospital.value) return
  await supabase.from('hospitals').update({ [col]: !hospital.value[col] }).eq('id', hospitalId)
  refreshHospital()
}

const refreshData = () => { refreshHospital(); refreshReports(); congestionAlertDismissed.value = false }

const manualOptions = [
  { value: '空いている', label: '空いている', icon: '😊', class: 'border-green-500 text-green-600 hover:bg-green-50' },
  { value: 'ふつう', label: 'ふつう', icon: '😐', class: 'border-amber-500 text-amber-600 hover:bg-amber-50' },
  { value: '混んでいる', label: '混んでいる', icon: '😣', class: 'border-red-500 text-red-600 hover:bg-red-50' }
]

// リアルタイム購読 + 期限切れチェック + 受付ステータス読み込み
onMounted(() => {
  // localStorage から受付状態を読み込み（リロード後も状態維持）
  const savedStatus = localStorage.getItem('hospital_status')
  receptionStatus.value = savedStatus || 'open'

  // 他タブ・同タブからの変更をリアルタイム検知
  window.addEventListener('storage', handleReceptionStorageChange)

  const reportsChannel = supabase
    .channel('admin-reports-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports', filter: `hospital_id=eq.${hospitalId}` }, () => {
      refreshReports()
    })
    .subscribe()

  const hospitalChannel = supabase
    .channel('admin-hospital-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hospitals', filter: `id=eq.${hospitalId}` }, () => {
      refreshHospital()
    })
    .subscribe()

  expiryCheckInterval = setInterval(() => {
    const h = hospital.value
    if (h?.manual_status_expires_at && new Date(h.manual_status_expires_at).getTime() <= Date.now()) {
      clearManualOverride()
      refreshHospital()
    }
  }, 10000)

  onUnmounted(() => {
    supabase.removeChannel(reportsChannel)
    supabase.removeChannel(hospitalChannel)
    if (expiryCheckInterval) clearInterval(expiryCheckInterval)
    window.removeEventListener('storage', handleReceptionStorageChange)
  })
})
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1e293b;
  padding: 24px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e2e8f0;
}

.admin-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.refresh-btn {
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #334155;
  cursor: pointer;
}

.refresh-btn:hover {
  background: #f8fafc;
}

.admin-content {
  max-width: 800px;
  margin: 0 auto;
}

.gauge-section {
  margin-bottom: 24px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.section-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12px;
}

.gauge-wrapper {
  max-width: 480px;
}

.status-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.highlight-card {
  border-top: 4px solid #0ea5e9;
}

.trend-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.trend-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.trend-label {
  font-size: 0.75rem;
  color: #64748b;
}

.toggle-group { display: flex; flex-direction: column; gap: 12px; }
.toggle-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 16px 20px;
  border-radius: 10px;
  border: 2px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  color: #d1d5db;
  transition: all 0.2s ease;
}
.toggle-btn:hover { background: #f9fafb; }
.toggle-icon {
  font-size: 1.4rem;
  margin-right: 10px;
}
.toggle-naika.active {
  background: #f0fdfa;
  color: #0d9488;
  border-color: #0d9488;
}
.toggle-seikei.active {
  background: #fff7ed;
  color: #e27d60;
  border-color: #e27d60;
}
.loading { text-align: center; padding: 48px; font-size: 1.125rem; color: #64748b; }

/* ===== iPad対応 共通 ===== */
.ipad-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 28px 24px;
  margin-bottom: 28px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.ipad-section-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 20px;
  text-align: center;
}
.ipad-hint {
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 24px;
}

/* ===== 受付ステータス 巨大ボタン ===== */
.reception-mega-buttons {
  display: flex;
  gap: 16px;
}
.reception-mega-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 16px;
  border-radius: 20px;
  border: 4px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.reception-mega-btn:active {
  transform: scale(0.97);
}
.reception-mega-icon {
  font-size: 2.5rem;
}
.reception-mega-label {
  font-size: 1.4rem;
  font-weight: 800;
  color: #64748b;
}
.reception-mega-inactive {
  opacity: 0.5;
}
.reception-mega-active-open {
  background: #dcfce7;
  border-color: #16a34a;
}
.reception-mega-active-open .reception-mega-label {
  color: #15803d;
}
.reception-mega-active-closed {
  background: #fee2e2;
  border-color: #dc2626;
}
.reception-mega-active-closed .reception-mega-label {
  color: #b91c1c;
}

/* ===== 待ち時間 巨大数字 + ＋/－ ===== */
.wait-mega-row {
  margin-bottom: 28px;
}
.wait-mega-row:last-child {
  margin-bottom: 0;
}
.wait-mega-dept {
  display: block;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 12px;
  letter-spacing: 0.1em;
}
.wait-mega-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.wait-mega-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid #e2e8f0;
  background: white;
  font-size: 2.2rem;
  font-weight: 900;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  line-height: 1;
}
.wait-mega-btn:active {
  transform: scale(0.92);
}
.wait-mega-minus {
  color: #dc2626;
  border-color: #fca5a5;
}
.wait-mega-minus:active {
  background: #fee2e2;
}
.wait-mega-plus {
  color: #16a34a;
  border-color: #86efac;
}
.wait-mega-plus:active {
  background: #dcfce7;
}
.wait-mega-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  min-width: 140px;
}
.wait-mega-number {
  font-size: 5rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.wait-mega-unit {
  font-size: 1.5rem;
  font-weight: 700;
  color: #94a3b8;
  margin-left: 4px;
}
.wait-mega-count {
  font-size: 1.2rem;
  font-weight: 700;
  color: #64748b;
  min-width: 60px;
  text-align: center;
}


</style>