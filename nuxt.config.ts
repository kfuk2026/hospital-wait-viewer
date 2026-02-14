export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],
  supabase: {
    redirect: false // これを忘れるとログイン画面に飛ばされてしまいます！
  }
})


