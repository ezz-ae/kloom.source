// THE ARABIC INTERFACE.
//
// Keys are the English strings themselves — see lib/airraw/i18n.ts for why.
// Anything absent here renders in English rather than breaking, so this file can
// grow surface by surface without a half-translated screen ever showing a raw
// token.
//
// REGISTER. The English copy is deliberately lowercase, short and unhurried —
// a voice at 2am, not a product. Formal Modern Standard Arabic would throw that
// away and read like a bank. So this leans Gulf-spoken where the line is
// conversational (وش، الحين، طوالي) and stays neutral where it is a label or
// a number, which is how people actually write to each other in the region.
//
// Two things are deliberately NOT translated:
//   · the wordmark — a brand is not translated
//   · the MOOD and KIND phrases in TheRoom ("arguing, and enjoying it") — those
//     are prompt text read by the model, not by a person. Translating them would
//     change what the model is asked for, which is a different job with a
//     different way of being wrong.

export const AR: Record<string, string> = {
  // ── the dock ───────────────────────────────────────────────────────────────
  "Room": "الغرفة",
  "People": "الناس",
  "Scenes": "مشاهد",
  "Talks": "جلسات",
  "You": "حسابك",

  // ── the room ───────────────────────────────────────────────────────────────
  "the room is waking up…": "الغرفة تصحى…",
  "say something to the room": "قل شي للغرفة",
  "hold to talk to the room": "اضغط مطوّلاً وتكلّم",
  "listening": "يسمعك",
  "listening…": "يسمعك…",
  "one sec…": "لحظة…",
  "mention someone": "نادِ أحد",
  "send whisper": "أرسل همسة",
  "send": "إرسال",
  "read the room": "اقرأ الجو",
  "carry on": "كمّل",
  "tap to carry on": "اضغط تكمل",
  "tap to move it here": "اضغط تنقلها هنا",
  " (whispering to you)": " (يهمس لك)",
  "running in another tab": "شغّالة في تبويب ثاني",
  "{name} whispered to you — answer alone": "{name} همس لك — ردّ عليه لحالك",
  "{name} whispered to you · only you can see this": "{name} همس لك · ما يشوفها غيرك",
  "answer {name} alone →": "ردّ على {name} لحالك ←",
  "open {name}'s profile": "افتح ملف {name}",

  // ── chips ──────────────────────────────────────────────────────────────────
  "chips": "رقائق",
  "get more": "زد رصيدك",
  "your chips": "رقائقك",
  "today's chips": "رقائق اليوم",
  "collected": "تم",
  "back tomorrow": "بكرة",
  "tomorrow": "بكرة",
  "most popular": "الأكثر طلباً",
  "promo code (optional)": "كود خصم (اختياري)",
  "promo code": "كود خصم",
  "checkout didn't open": "ما فتحت صفحة الدفع",
  "couldn't reach the cage — try again in a moment": "ما قدرنا نوصل الحين — جرّب بعد شوي",
  "charged in USD": "يُخصم بالدولار",
  "charged in AED": "يُخصم بالدرهم الإماراتي",

  // ── the pass ───────────────────────────────────────────────────────────────
  "a month": "شهر",
  "change": "تغيير",
  "checkout": "الدفع",
  "crypto": "عملات رقمية",
  "card / apple pay": "بطاقة / Apple Pay",
  "card / apple pay / crypto": "بطاقة / Apple Pay / عملات رقمية",
  "opening checkout…": "نفتح صفحة الدفع…",
  "restore code": "كود الاسترجاع",
  "paste your restore code": "الصق كود الاسترجاع",
  "couldn’t start checkout — try again": "ما بدأت عملية الدفع — جرّب مرة ثانية",
  "network hiccup — try again": "الشبكة تعثّرت — جرّب مرة ثانية",
  "that code looks invalid or expired — copy the whole thing": "الكود غير صالح أو منتهي — انسخه كامل",

  // ── the golden room ────────────────────────────────────────────────────────
  "the golden room": "الغرفة الذهبية",
  "Take someone somewhere better.": "خذ أحد لمكان أرقى.",
  "book ahead": "احجز مقدماً",
  "a session starts when you open it, not when you buy it.":
    "الجلسة تبدأ لما تفتحها، مو لما تشتريها.",
  "nothing is charged automatically, ever.": "ما نخصم منك تلقائياً أبداً.",
  "the golden room is closed for a moment — nothing was charged.":
    "الغرفة الذهبية مقفلة لحظة — ما انخصم منك شي.",

  // ── report ─────────────────────────────────────────────────────────────────
  "something's wrong": "في شي غلط",
  "report an issue": "بلّغ عن مشكلة",
  "what happened? one sentence is plenty.": "وش صار؟ جملة وحدة تكفي.",
  "what happened": "وش صار",
  "sent with this:": "يُرسل مع البلاغ:",
  "send it": "أرسل",
  "sending…": "نرسل…",
  "thank you": "شكراً لك",
  "Got it — that's logged.": "وصلنا — تم تسجيله.",
  "back": "رجوع",
  "couldn't send that": "ما قدرنا نرسل",
  "you seem to be offline": "يبدو إنك غير متصل",
  "tell us what happened": "قل لنا وش صار",
  "which page you were on": "أي صفحة كنت فيها",
  "your browser, screen size and language": "متصفحك، مقاس الشاشة، ولغتك",
  "which build you're running": "أي إصدار تستخدم",
  "anything that failed in the last few minutes": "أي شي فشل في آخر دقائق",
  "nothing you said, and nothing anyone said to you":
    "لا شي قلته، ولا شي قيل لك",

  // ── the way in ─────────────────────────────────────────────────────────────
  "restore my membership": "استرجع اشتراكي",
  "save to photos": "احفظ في الصور",
  "something not working?": "في شي ما يشتغل؟",
  "close": "إغلاق",
  "continue →": "كمّل ←",
  "skip, just take me in →": "تخطَّ وادخل ←",
  "hey — what should I call you?": "هلا — وش نناديك؟",
  "optional — go by anything": "اختياري — سمِّ نفسك أي اسم",

  // ── the call ───────────────────────────────────────────────────────────────
  "while you talk": "وأنت تتكلم",
  "call settings": "إعدادات المكالمة",
  "close settings": "إغلاق الإعدادات",
  "test your mic": "جرّب المايك",
  "show the words": "أظهر الكلام",
  "hide the words": "أخفِ الكلام",
  "on mute": "صامت",
  "sound": "الصوت",
}
