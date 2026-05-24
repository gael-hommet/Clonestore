import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAnonDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase not configured");
  return createClient(url, anon, { auth: { persistSession: false } });
}

// âš ️ Mets ici l'URL EXACTE de ton webhook Make
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/u8nkxlkauyxlygy1r6p59rhmdk35ta4r";

// =============================
// TYPES
// =============================
type RouterRequestBody = {
  client_id?: string; // ignoré côté front, on utilise le token
  token?: string;
  agent?: string;
  payload?: any;
};

type RouterStatus = "OK" | "UNAUTHORIZED" | "FORBIDDEN" | "ERROR";

type RouterResponse = {
  status: RouterStatus;
  agent: string | null;
  data: any | null;
  error: string | null;
};

// =============================
// RÉPONSE STANDARD
// =============================
function buildResponse(
  status: RouterStatus,
  agent: string | null,
  data: any = null,
  error: string | null = null
) {
  const body: RouterResponse = { status, agent, data, error };
  return NextResponse.json(body);
}

// =============================
// HANDLER PRINCIPAL : POST /api/router
// =============================
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RouterRequestBody;
    const { token, agent, payload } = body;

    // 1) Vérif des champs obligatoires (token + agent)
    if (!token || !agent) {
      return buildResponse(
        "ERROR",
        agent ?? null,
        null,
        "Missing token or agent"
      );
    }

    const supabase = createAnonDbClient();

    // 2) Récupérer le client_id à partir du token
    const clientId = await getClientIdFromToken(supabase, token);
    if (!clientId) {
      return buildResponse("UNAUTHORIZED", agent, null, "Invalid credentials");
    }

    // 3) Vérifier que ce client possède bien cet agent
    const allowed = await checkAgentPermission(supabase, clientId, agent);
    if (!allowed) {
      return buildResponse(
        "FORBIDDEN",
        agent,
        null,
        "Agent not owned by this client"
      );
    }

    // 4) Appel à Make : on envoie agent + payload
    try {
      const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent: agent,
          payload: payload,
        }),
      });

      const rawText = await makeResponse.text();
      let parsed: any = null;

      if (rawText && rawText.trim().length > 0) {
        // On essaie de récupérer tout ce qu'il y a entre le 1er { et le dernier }
        const match = rawText.match(/{[\s\S]*}/);
        if (match) {
          const jsonSlice = match[0];
          try {
            parsed = JSON.parse(jsonSlice);
          } catch (e) {
            console.error("JSON.parse failed on slice, keeping rawText:", e);
            parsed = rawText;
          }
        } else {
          // pas de {} trouvés, on garde le texte brut
          parsed = rawText;
        }
      } else {
        parsed = null;
      }

      return buildResponse("OK", agent, parsed, null);
    } catch (err) {
      console.error("Make call error:", err);
      return buildResponse("ERROR", agent, null, "Make error");
    }
  } catch (err) {
    console.error("Router error:", err);
    return buildResponse("ERROR", null, null, "Unexpected server error");
  }
}

// =============================
// Récupérer le client_id à partir du token
// =============================
async function getClientIdFromToken(
  supabase: any,
  token: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("api_tokens")
      .select("client_id, active")
      .eq("token", token)
      .eq("active", true)
      .maybeSingle();

    console.log("getClientIdFromToken result:", { data, error });

    if (error) {
      console.error("getClientIdFromToken error:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return data.client_id as string;
  } catch (err) {
    console.error("getClientIdFromToken exception:", err);
    return null;
  }
}

// =============================
// Vérifier si ce client possède cet agent
// =============================
async function checkAgentPermission(
  supabase: any,
  clientId: string,
  agent: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("agents_owned")
      .select("id")
      .eq("client_id", clientId)
      .eq("agent_name", agent)
      .maybeSingle();

    console.log("checkAgentPermission result:", { data, error });

    if (error) {
      console.error("checkAgentPermission error:", error);
      return false;
    }

    if (!data) {
      return false;
    }

    return true;
  } catch (err) {
    console.error("checkAgentPermission exception:", err);
    return false;
  }
}









  

