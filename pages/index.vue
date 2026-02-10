<template>
  <div class="app-container" v-if="hospital">
    <template v-if="isBannerActive">
      <div v-if="hospital.is_low_alert_naika" class="alert-banner naika-bg">📢 内科：いま空いています！</div>
      <div v-if="hospital.is_low_alert_seikei" class="alert-banner">📢 整形外科：いま空いています！</div>
    </template>

    <div class="main-card">
      <h1 class="hospital-name">{{ hospital.name }}</h1>

      <div class="wait-display">
        <div class="wait-item">内科：<span class="time-value">{{ displayWait.naika }}分</span></div>
        <div class="wait-item">整形：<span class="time-value">{{ displayWait.seikei }}分</span></div>
        
        <div class="report-summary-box" v-if="recentReports.length > 0">
          <div class="report-summary-header">
            <span>👥 患者さんの体感（直近30分）</span>
            <span v-if="recentReports.length < 3" class="ref-tag">参考情報</span>
          </div>
          <div class="status-gauge">
            <div :class="['gauge-bar', autoStatus.class]" :style="{ width: '100%' }">
              {{ autoStatus.icon }} {{ autoStatus.text }}
            </div>
          </div>
        </div>
        <div v-else class="no-report-msg">📝 まだ直近の報告はありません</div>
      </div>

      <p class="guide-text">1. 日にちを選択</p>
      <div class="day-selector">
        <button :disabled="isLocked" :class="{ active: dayType === 'weekday' }" @click="setDayType('weekday')">平日</button>
        <button :disabled="isLocked" :class="{ active: dayType === 'saturday' }" @click="setDayType('saturday')">土曜日</button>
      </div>

      <p class="guide-text">2. 時間帯を選択</p>
      <div class="time-selector-vertical">
        <button :disabled="isLocked" :class="{ active: selectedSlot === 'morning' }" @click="selectedSlot = 'morning'">9:00 - 10:30</button>
        <button :disabled="isLocked" :class="{ active: selectedSlot === 'noon' }" @click="selectedSlot = 'noon'">10:30 - 12:30</button>
        <button v-if="dayType === 'weekday'" :disabled="isLocked" :class="{ active: selectedSlot === 'afternoon' }" @click="selectedSlot = 'afternoon'">14:00 - 17:00</button>
      </div>

      <hr class="divider" />

      <section class="report-section">
        <p class="report-title">3. いまの様子を教えてください</p>
        <div class="report-buttons">
          <button 
            v-for="opt in reportOptions" 
            :key="opt.status"
            :disabled="isLocked"
            :class="[opt.class, { 'selected-btn': lastReport === opt.status }]"
            @click="sendReport(opt.status)"
          >
            <span class="main-text">
              {{ opt.label }}
              <span v-if="lastReport === opt.status"> ✅</span>
            </span>
            <span class="sub-text">{{ opt.desc }}</span>
          </button>
        </div>

        <div class="status-message" v-if="lastReport">
          <p class="sent-msg">✅ ありがとうございます。送信しました</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const hospitalId = 'd6e29b2d-668a-4450-ba27-25c8724f5715' 

const dayType = ref('weekday')
const selectedSlot = ref('morning')
const lastReport = ref(null) 
const editCount = ref(0)
const isLocked = ref(false)

const { data: hospital } = await useAsyncData('get_hospital', async () => {
  const { data } = await supabase.from('hospitals').select('*').eq('id', hospitalId).single()
  return data
})

const { data: reports, refresh: refreshReports } = await useAsyncData('get_recent_reports', async () => {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data } = await supabase.from('reports').select('*').eq('hospital_id', hospitalId).gt('created_at', thirtyMinsAgo)
  return data
})

// 平均待ち時間データ
const waitData = {
  weekday: { morning: { naika: 45, seikei: 60 }, noon: { naika: 20, seikei: 35 }, afternoon: { naika: 30, seikei: 40 } },
  saturday: { morning: { naika: 60, seikei: 80 }, noon: { naika: 50, seikei: 70 } }
}

const displayWait = computed(() => {
  const base = waitData[dayType.value][selectedSlot.value] || { naika: 0, seikei: 0 }
  return {
    naika: hospital.value?.current_wait_naika || base.naika,
    seikei: hospital.value?.current_wait_seikei || base.seikei
  }
})

const isBannerActive = computed(() => {
  if (!hospital.value?.updated_at) return true
  return new Date(hospital.value.updated_at).getTime() > (Date.now() - 60 * 60 * 1000)
})

const recentReports = computed(() => reports.value || [])
const autoStatus = computed(() => {
  if (recentReports.value.length === 0) return { text: '', icon: '', class: '' }
  const scoreMap = { 'すいてる': 1, 'ふつう': 2, 'こんでる': 3 }
  const avg = recentReports.value.reduce((acc, r) => acc + (scoreMap[r.status] || 0), 0) / recentReports.value.length
  if (avg < 1.5) return { text: 'すいてる', icon: '😊', class: 'c-low' }
  if (avg >= 2.5) return { text: 'こんでる', icon: '😣', class: 'c-high' }
  return { text: 'ふつう', icon: '😐', class: 'c-mid' }
})

// 曜日切替（時間を9時に戻さない設定）
const setDayType = (type) => {
  if (isLocked.value) return
  dayType.value = type
  if (type === 'saturday' && selectedSlot.value === 'afternoon') {
    selectedSlot.value = 'noon'
  }
}

const sendReport = async (status) => {
  if (isLocked.value) return
  lastReport.value = status 
  editCount.value++
  await supabase.from('reports').insert([{ hospital_id: hospitalId, status: status, time_slot: selectedSlot.value }])
  refreshReports()
  if (editCount.value >= 2) isLocked.value = true
}

const reportOptions = [
  { status: 'すいてる', label: '😊 すいてる', desc: '半分以上の席があいている', class: 'btn-low' },
  { status: 'ふつう', label: '😐 ふつう', desc: 'だいたい席が埋まっている', class: 'btn-mid' },
  { status: 'こんでる', label: '😣 こんでる', desc: '立っている人がいる', class: 'btn-high' }
]
</script>

<style scoped>
/* 最初の「良い」と言っていただいたスタイルをベースに維持 */
.app-container { background-color: #E0F2F1; min-height: 100vh; padding: 15px; font-family: sans-serif; }
.alert-banner { padding: 18px; border-radius: 15px; margin-bottom: 12px; text-align: center; font-weight: bold; color: white; background-color: #FF9800; font-size: 1.1rem; }
.naika-bg { background-color: #009688; }
.main-card { background: white; border-radius: 35px; padding: 25px; max-width: 480px; margin: 0 auto; box-sizing: border-box; }
.hospital-name { text-align: center; font-size: 1.8rem; color: #333; margin-bottom: 15px; }

.wait-display { text-align: center; margin-bottom: 30px; background: #F8FDFF; padding: 20px; border-radius: 25px; border: 1px solid #E1F5FE; }
.time-value { color: #1A237E; font-size: 2.8rem; font-weight: bold; }

.report-summary-box { margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 15px; }
.report-summary-header { display: flex; justify-content: space-between; font-size: 0.85rem; color: #666; font-weight: bold; margin-bottom: 8px; }
.ref-tag { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
.status-gauge { background: #eee; height: 35px; border-radius: 50px; overflow: hidden; position: relative; }
.gauge-bar { height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; transition: 0.5s; }
.c-low { background: #42A5F5; }
.c-mid { background: #66BB6A; }
.c-high { background: #FFA726; }
.no-report-msg { margin-top: 15px; font-size: 0.85rem; color: #999; }

.guide-text { font-size: 1.1rem; color: #666; font-weight: bold; margin-bottom: 12px; }
.day-selector { display: flex; gap: 10px; margin-bottom: 25px; }
.day-selector button { flex: 1; padding: 15px; border-radius: 20px; border: 3px solid #4FA3D1; background: white; color: #4FA3D1; font-size: 1.2rem; font-weight: bold; }
.time-selector-vertical { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
.time-selector-vertical button { padding: 15px; border-radius: 15px; border: 2px solid #4FA3D1; background: white; color: #4FA3D1; font-size: 1.2rem; font-weight: bold; }
.active { background-color: #4FA3D1 !important; color: white !important; }

.report-buttons button { display: flex; flex-direction: column; align-items: center; padding: 15px; border-radius: 25px; width: 100%; margin-bottom: 10px; border: 4px solid transparent; }
.main-text { font-size: 1.4rem; font-weight: bold; }
.btn-low { background-color: #E3F2FD; color: #1565C0; }
.btn-mid { background-color: #E8F5E9; color: #2E7D32; }
.btn-high { background-color: #FFF3E0; color: #EF6C00; }
.selected-btn { border-color: #4FA3D1 !important; }

.status-message { text-align: center; margin-top: 25px; }
.sent-msg { font-size: 1.2rem; font-weight: bold; color: #333; }
</style>

