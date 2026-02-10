export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],
  supabase: {
    redirect: false // これを忘れるとログイン画面に飛ばされてしまいます！
  }
})

