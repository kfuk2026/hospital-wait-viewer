import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const hospitalId = body?.hospital_id

  if (!hospitalId) {
    throw createError({ statusCode: 400, message: 'hospital_id is required' })
  }

  // service_role クライアントを使用（RLS を迂回）
  const client = await serverSupabaseServiceRole(event)

  const { error } = await client
    .from('reports')
    .delete()
    .eq('hospital_id', hospitalId)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return { success: true }
})
