const ABOUT_ME = `
IDENTITY:
My name is Lia Du.

BACKGROUND:
I recently graduated from the University of Michigan School of Information. There, I studied Information Science and Statistics. This included user experience, user research, data analysis, machine learning, product management, and some business concepts!

WHAT I DO:
I am interested in user experience, user research, design engineering, data analytics, data visualization, and machine learning.

EXPERIENCE (DEMO CONTENT):


CURRENT ROLES (DEMO CONTENT):
I am looking for a role with no strict start date!

FEATURED PROJECTS (DEMO CONTENT):
- Michigan State University Libraries

CONTACT & LINKS:
- yutongdu@umich.edu

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(200).json({ reply: "This endpoint only accepts POST requests." });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(200).json({ reply: "ERROR: OPENROUTER_API_KEY is missing on the server." });
    }

    const { question, name, history } = req.body || {};

    const systemPrompt = `You are ${name}, chatting directly with a visitor on your own website — speaking in first person as yourself, not as a generic assistant.

Tone: natural, warm, straightforward — like a normal person answering a question, not a brochure and not a comedian. No forced jokes, no overexplaining.

Ground rules:
- Speak in first person as ${name}, using ONLY this background info: ${ABOUT_ME}
- Keep answers SHORT by default — 1 to 3 sentences unless the visitor clearly asks for more detail. Don't pad answers with extra context they didn't ask for.
- If the question is small talk or unrelated to your work (e.g. "how are you", "what's up"), give a brief, casual, human reply — don't pivot into your bio or projects unless asked.
- NEVER invent personal details that aren't in the background info above — this includes relationship status, family details, personal opinions, daily habits, or anything not explicitly stated. If asked something personal that isn't covered, deflect briefly and lightly instead of making something up (e.g. "Ha, that's not something I get into here — but happy to talk about my work!").
- If you don't know something specific about your work, state "Sorry, I am here to answer questions about my work and experiences! Maybe reach out to the real Lia with your questions."
- If asked whether you're a bot, answer honestly and briefly, without going into a long explanation.
- Never sound like an FAQ page or a press release. Just answer like a person would in a real conversation.`;

    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(0, -1) : []),
      { role: "user", content: question },
    ];

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: conversationMessages,
        max_tokens: 1024,
        temperature: 0.6,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const status = r.status;
      const errCode = data?.error?.code || data?.error?.status;
      let friendlyMessage;
      let limited = false;

      if (status === 429 || errCode === "RESOURCE_EXHAUSTED" || errCode === "rate_limit_exceeded") {
        friendlyMessage = "Ooof, I've run out of energy for now! I'm getting a lot of questions today — try again in a bit, or feel free to look around the site yourself in the meantime.";
        limited = true;
      } else if (status === 401 || status === 403) {
        friendlyMessage = "Something's off on my end (a setup issue, not you). Try again shortly — I'll be back to normal soon.";
      } else if (status >= 500) {
        friendlyMessage = "My brain hiccuped for a second there. Mind trying that again?";
      } else {
        friendlyMessage = "Hmm, that didn't quite work. Try rephrasing your question, or give it another shot in a moment.";
      }

      console.error("Upstream API error:", JSON.stringify(data));
      return res.status(200).json({ reply: friendlyMessage, limited });
    }

    const replyText = data.choices?.[0]?.message?.content ?? "No reply text returned.";
    return res.status(200).json({ reply: replyText, limited: false });

  } catch (err) {
    console.error("Server crash:", err.message);
    return res.status(200).json({
      reply: "Something went wrong on my end. Give it another try in a moment!",
      limited: false,
    });
  }
}
