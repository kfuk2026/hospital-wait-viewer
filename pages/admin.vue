<template>
  <div class="admin-container">
    <header class="admin-header">
      <h1>🏥 受付管理パネル</h1>
      <button @input="refreshData" class="refresh-btn">🔄 最新に更新</button>
    </header>

    <div v-if="hospital" class="admin-grid">
      
      <section class="status-card highlight-card">
        <h2>⏱️ 待ち時間の更新（人数入力）</h2>
        <div class="calc-group">
          <div class="calc-row">
            <span class="dept-label">内科：</span>
            <input type="number" v-model="countNaika" @input="updateWait('naika')" min="0"> 人 
            <span class="arrow">→</span>
            <span class="calc-result">{{ waitNaika }} 分</span>
          </div>
          <div class="calc-row">
            <span class="dept-label">整形：</span>
            <input type="number" v-model="countSeikei" @input="updateWait('seikei')" min="0"> 人 
            <span class="arrow">→</span>
            <span class="calc-result">{{ waitSeikei }} 分</span>
          </div>
        </div>
        <p class="hint">※1人10分で自動計算。入力した瞬間に患者画面が変わります。</p>
      </section>

      <section class="status-card">
        <h2>📊 患者さんの体感報告（直近30分）</h2>
        <div class="analysis-box">
          <div v-if="recentReports && recentReports.length > 0">
            <p class="score-result">{{ autoStatus.text }}</p>
            <p class="score-sub">平均スコア: {{ autoStatus.score }}（{{ recentReports.length }}件の報告）</p>
            <p v-if="recentReports.length < 3" class="alert-text">⚠️ 報告不足のため患者側には「参考」と表示中</p>
          </div>
          <div v-else class="no-data">
            直近30分以内の報告はありません
          </div>
        </div>
      </section>

      <section class="status-card">
        <h2>📢 「空いてます」バナー操作</h2>
        <div class="toggle-group">
          <button 
            :class="['toggle-btn', { active: hospital.is_low_alert_naika }]" 
            @click="toggleAlert('is_low_alert_naika')"
          >
            内科：{{ hospital.is_low_alert_naika ? '表示中' : 'OFF' }}
          </button>
          <button 
            :class="['toggle-btn', { active: hospital.is_low_alert_seikei }]" 
            @click="toggleAlert('is_low_alert_seikei')"
          >
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

const countNaika = ref(0)
const countSeikei = ref(0)
const waitNaika = computed(() => (countNaika.value || 0) * 10)
const waitSeikei = computed(() => (countSeikei.value || 0) * 10)

// 病院データの取得
const { data: hospital, refresh: refreshHospital } = await useAsyncData('hosp', async () => {
  const { data } = await supabase.from('hospitals').select('*').eq('id', hospitalId).single()
  if (data) {
    countNaika.value = Math.floor(data.current_wait_naika / 10)
    countSeikei.value = Math.floor(data.current_wait_seikei / 10)
  }
  return data
})

// 患者報告の取得（直近30分）
const { data: reports, refresh: refreshReports } = await useAsyncData('reps', async () => {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data } = await supabase.from('reports')
    .select('*')
    .eq('hospital_id', hospitalId)
    .gt('created_at', thirtyMinsAgo)
  return data
})

// 待ち時間の自動更新
const updateWait = async (dept) => {
  const col = dept === 'naika' ? 'current_wait_naika' : 'current_wait_seikei'
  const val = dept === 'naika' ? waitNaika.value : waitSeikei.value
  await supabase.from('hospitals').update({ [col]: val }).eq('id', hospitalId)
}

// バナーの切り替え
const toggleAlert = async (col) => {
  if (!hospital.value) return
  await supabase.from('hospitals').update({ [col]: !hospital.value[col] }).eq('id', hospitalId)
  refreshHospital()
}

// 集計ロジック
const recentReports = computed(() => reports.value || [])
const autoStatus = computed(() => {
  const reps = recentReports.value
  if (reps.length === 0) return { text: '報告なし', score: 0 }
  const scoreMap = { 'すいてる': 1, 'ふつう': 2, 'こんでる': 3 }
  const total = reps.reduce((acc, r) => acc + (scoreMap[r.status] || 0), 0)
  const avg = (total / reps.length).toFixed(1)
  let text = 'ふつうです😐';
  if (avg < 1.5) text = '空いています😊';
  else if (avg >= 2.5) text = '混んでいます😣';
  return { text, score: avg }
})

const refreshData = () => { refreshHospital(); refreshReports() }
</script>

<style scoped>
.admin-container { padding: 20px; background: #f4f7f6; min-height: 100vh; font-family: sans-serif; }
.admin-grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.status-card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
.highlight-card { border-top: 5px solid #4FA3D1; }

.calc-row { display: flex; align-items: center; gap: 10px; margin: 15px 0; font-size: 1.2rem; }
.calc-row input { width: 70px; padding: 10px; font-size: 1.2rem; text-align: center; border: 2px solid #ddd; border-radius: 10px; }
.calc-result { font-weight: bold; color: #1A237E; font-size: 1.5rem; width: 80px; }
.arrow { color: #aaa; }

.score-result { font-size: 1.8rem; font-weight: bold; color: #1A237E; margin: 10px 0; text-align: center; }
.score-sub { text-align: center; color: #666; font-size: 0.9rem; }

.toggle-group { display: flex; flex-direction: column; gap: 10px; }
.toggle-btn { padding: 15px; border-radius: 10px; border: 2px solid #ccc; background: #eee; cursor: pointer; font-weight: bold; font-size: 1rem; }
.toggle-btn.active { background: #FF9800; color: white; border-color: #E68A00; }

.loading { text-align: center; padding: 50px; font-size: 1.2rem; }
.hint { font-size: 0.8rem; color: #999; margin-top: 10px; }
.alert-text { color: #f44336; font-size: 0.8rem; font-weight: bold; text-align: center; margin-top: 5px; }
</style>

