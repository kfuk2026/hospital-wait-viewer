<template>
  <div class="post-container">
    <!-- ローディング -->
    <div v-if="loading" class="state-screen">
      <div class="state-icon">⏳</div>
      <p class="state-text">読み込み中...</p>
    </div>

    <!-- エラー（hospital_id 不正） -->
    <div v-else-if="errorMsg" class="state-screen">
      <div class="state-icon">⚠️</div>
      <p class="state-text">{{ errorMsg }}</p>
    </div>

    <!-- 投稿完了 -->
    <div v-else-if="submitted" class="state-screen thanks">
      <div class="state-icon">🎉</div>
      <h2 class="thanks-title">ご協力ありがとうございます！</h2>
      <p class="thanks-sub">あなたの投稿が地域の助けになります</p>
      <button class="retry-btn" @click="submitted = false">もう一度投稿する</button>
    </div>

    <!-- 投稿フォーム -->
    <div v-else class="post-card">
      <p class="post-label">🏥 投稿先</p>
      <h1 class="hospital-name">{{ hospital.name }}</h1>

      <!-- 受付ステータス -->
      <div :class="['status-badge', isOpen ? 'status-open' : 'status-closed']">
        {{ isOpen ? '🟢 本日受付中' : '🔴 本日受付終了' }}
      </div>

      <p class="post-question">いまの混雑状況を教えてください</p>

      <div class="btn-group" :class="{ 'btn-disabled': !isOpen }">
        <button
          v-for="opt in options"
          :key="opt.status"
          :disabled="sending || !isOpen"
          class="report-btn"
          :style="isOpen ? { background: opt.bg, color: opt.color } : {}"
          @click="send(opt.status)"
        >
          <span class="btn-icon">{{ opt.icon }}</span>
          <span class="btn-label">{{ opt.label }}</span>
          <span class="btn-desc">{{ opt.desc }}</span>
        </button>
      </div>

      <p v-if="sendError" class="error-msg">{{ sendError }}</p>
    </div>
  </div>
</template>

<script setup>
// デモ用: true=受付中, false=受付終了（この値を変えるだけで切り替え可能）
const isOpen = true

const supabase = useSupabaseClient()
const route = useRoute()

const hospitalId = route.query.hospital_id
const loading = ref(true)
const errorMsg = ref(null)
const hospital = ref(null)
const submitted = ref(false)
const sending = ref(false)
const sendError = ref(null)

// hospital_id チェック & 病院データ取得
onMounted(async () => {
  if (!hospitalId) {
    errorMsg.value = 'hospital_id が指定されていません'
    loading.value = false
    return
  }

  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name')
    .eq('id', hospitalId)
    .single()

  if (error || !data) {
    errorMsg.value = '病院が見つかりませんでした'
    loading.value = false
    return
  }

  hospital.value = data
  loading.value = false
})

const send = async (status) => {
  if (sending.value) return
  sending.value = true
  sendError.value = null

  const { error } = await supabase.from('reports').insert([{
    hospital_id: hospitalId,
    status,
    time_slot: 'qr'
  }])

  if (error) {
    sendError.value = '送信に失敗しました: ' + error.message
    sending.value = false
    return
  }

  sending.value = false
  submitted.value = true
}

const options = [
  { status: 'すいてる', label: 'すいてる', icon: '😊', desc: '半分以上の席があいている', bg: '#EFF6FF', color: '#1565C0' },
  { status: 'ふつう',   label: 'ふつう',   icon: '😐', desc: 'だいたい席が埋まっている', bg: '#ECFDF5', color: '#047857' },
  { status: 'こんでる', label: 'こんでる', icon: '😣', desc: '立っている人がいる',       bg: '#FFF7ED', color: '#C2410C' }
]
</script>

<style scoped>
.post-container {
  min-height: 100vh;
  background: #F0FDFA;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: sans-serif;
}

/* ローディング・エラー・サンクス共通 */
.state-screen {
  text-align: center;
  max-width: 400px;
}
.state-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}
.state-text {
  font-size: 1.1rem;
  color: #64748b;
}

/* サンクス画面 */
.thanks-title {
  font-size: 1.5rem;
  color: #0f172a;
  margin-bottom: 8px;
}
.thanks-sub {
  font-size: 1rem;
  color: #64748b;
  margin-bottom: 24px;
}
.retry-btn {
  padding: 12px 28px;
  border-radius: 50px;
  border: 2px solid #4FA3D1;
  background: white;
  color: #4FA3D1;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
}
.retry-btn:hover {
  background: #4FA3D1;
  color: white;
}

/* 投稿フォーム */
.post-card {
  background: white;
  border-radius: 30px;
  padding: 32px 24px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  text-align: center;
}
.post-label {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 4px;
}
.hospital-name {
  font-size: 1.6rem;
  color: #0f172a;
  margin-bottom: 28px;
}
.post-question {
  font-size: 1.1rem;
  font-weight: bold;
  color: #334155;
  margin-bottom: 20px;
}

/* 受付ステータスバッジ */
.status-badge {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  text-align: center;
  font-size: 1.05rem;
  font-weight: bold;
  margin-bottom: 20px;
}
.status-open {
  background: #ECFDF5;
  color: #047857;
}
.status-closed {
  background: #FEF2F2;
  color: #B91C1C;
}

/* ボタン */
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.report-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
}
.report-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.report-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.btn-icon {
  font-size: 2rem;
  flex-shrink: 0;
}
.btn-label {
  font-size: 1.2rem;
  font-weight: bold;
}
.btn-desc {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-left: auto;
}
.btn-disabled .report-btn {
  background: #f1f5f9 !important;
  color: #94a3b8 !important;
}

.error-msg {
  margin-top: 16px;
  padding: 10px;
  border-radius: 10px;
  background: #FEF2F2;
  color: #B91C1C;
  font-size: 0.85rem;
}
</style>
