import { createClient } from "npm:@supabase/supabase-js@2"
import webpush from "npm:web-push"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:samepage@example.com"

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

const admin = createClient(supabaseUrl, serviceRoleKey)

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function eventMessage(event: string, answerCount: number) {
  if (event === "partner_joined") return { title: "Same Page", body: "Your partner joined the game." }
  if (event === "answer_submitted" && answerCount >= 2) return { title: "Same Page", body: "Both answers are in. Reveal is ready." }
  if (event === "answer_submitted") return { title: "Same Page", body: "Your partner submitted an answer." }
  if (event === "game_complete") return { title: "Same Page", body: "Your game is complete." }
  if (event === "partner_left") return { title: "Same Page", body: "Your partner left the game." }
  return { title: "Same Page", body: "Your game needs you." }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "")
    if (!token) return response({ error: "not_authenticated" }, 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) return response({ error: "not_authenticated" }, 401)

    const { room_code, event } = await req.json()
    const code = String(room_code || "").trim().toUpperCase()
    if (!code) return response({ error: "room_code_required" }, 400)

    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("code,host_id,guest_id,current_round")
      .eq("code", code)
      .maybeSingle()

    if (roomError) throw roomError
    if (!room || (room.host_id !== user.id && room.guest_id !== user.id)) {
      return response({ error: "not_member" }, 403)
    }

    const targetId = room.host_id === user.id ? room.guest_id : room.host_id
    if (!targetId) return response({ sent: 0 })

    let answerCount = 0
    if (event === "answer_submitted") {
      const { data: round } = await admin
        .from("rounds")
        .select("id,answer_count")
        .eq("room_code", code)
        .eq("idx", room.current_round)
        .maybeSingle()
      answerCount = round?.answer_count || 0
    }

    const message = eventMessage(event, answerCount)
    const { data: subscriptions, error: subError } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", targetId)

    if (subError) throw subError

    let sent = 0
    for (const row of subscriptions || []) {
      try {
        await webpush.sendNotification({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        }, JSON.stringify({ ...message, tag: `same-page-${event}`, url: `/join/${code}` }))
        sent += 1
      } catch (error) {
        const status = error?.statusCode
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id)
        } else {
          console.error("Push delivery failed", status, error?.message || error)
        }
      }
    }

    return response({ sent })
  } catch (error) {
    console.error(error)
    return response({ error: error?.message || "push_failed" }, 500)
  }
})
