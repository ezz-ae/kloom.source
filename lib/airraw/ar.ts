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

/**
 * Keys that are deliberately identical in both languages.
 *
 * Declared rather than tolerated: the test asserts every OTHER value contains
 * Arabic script, so the only way a string stays English is by being named here
 * on purpose. Slipping one through silently is exactly what that test exists to
 * stop.
 */
export const UNTRANSLATED = new Set<string>([
  "airraw pro",   // the wordmark — a brand is not translated
])

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
  "chip": "رقاقة",
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
  "one chip is a minute of their voice. {n} chips is a photo.":
    "الرقاقة الوحدة دقيقة من صوته. و{n} رقائق صورة.",
  "they don't expire.": "وما تنتهي صلاحيتها.",
  "free, once a day, whether or not you came yesterday":
    "مجاناً، مرة كل يوم، جيت أمس أو ما جيت",
  "≈ {n} minutes out loud": "≈ {n} دقيقة صوت",
  "{pct}% more per dollar": "{pct}٪ أكثر لكل دولار",
  "the cage is closed for a moment — chips can't be bought right now. nothing was charged, and your balance is safe.":
    "الشراء مقفل لحظة — ما تقدر تشتري رقائق الحين. ما انخصم منك شي، ورصيدك بأمان.",
  "chips are spent as you use them — voice, photos, scenes.":
    "الرقائق تنصرف وأنت تستخدمها — صوت، صور، مشاهد.",
  "already claimed today — {n} more tomorrow": "استلمتها اليوم — {n} بكرة",
  "+{n} chips": "+{n} رقائق",

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
  "airraw pro": "airraw pro",
  "unlock the floor": "افتح الصالة كاملة",
  "already paid? restore it": "دافع من قبل؟ استرجعه",
  "restore my pass": "استرجع اشتراكي",
  "pay with crypto": "ادفع بالعملات الرقمية",
  "not now": "مو الحين",
  "your languages": "لغاتك",
  "you speak mostly": "تتكلم غالباً",
  "and also": "وكذلك",

  // ── the golden room ────────────────────────────────────────────────────────
  "the golden room": "الغرفة الذهبية",
  "Take someone somewhere better.": "خذ أحد لمكان أرقى.",
  "book ahead": "احجز مقدماً",
  "a session starts when you open it, not when you buy it.":
    "الجلسة تبدأ لما تفتحها، مو لما تشتريها.",
  "nothing is charged automatically, ever.": "ما نخصم منك تلقائياً أبداً.",
  "the golden room is closed for a moment — nothing was charged.":
    "الغرفة الذهبية مقفلة لحظة — ما انخصم منك شي.",
  "You don't walk into it — you bring someone with you. Whoever you're already talking to comes exactly as they are: same voice, same face, same conversation.":
    "ما تدخلها لحالك — تاخذ معك أحد. اللي تتكلم معه الحين يجي مثل ما هو تماماً: نفس الصوت، نفس الوجه، نفس السالفة.",
  "${usd} a session · {min} minutes": "{usd} دولار للجلسة · {min} دقيقة",
  ", however you use it.": "، مهما استخدمتها.",
  "you're holding {n} — open one from inside any conversation.":
    "عندك {n} — افتح وحدة من داخل أي محادثة.",
  "hold {n} · ${total}": "احجز {n} · {total} دولار",

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
  "reference": "المرجع",
  "not sent": "ما يُرسل",
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

  // ── the deck, the tabs, the account page ─────────────────────────────────
  "swipe for someone else": "اسحب لشخص ثاني",
  "someone else": "شخص ثاني",
  "your scenes": "مشاهدك",
  "go back in": "ارجع لها",
  "delete it — sure?": "تحذفه — أكيد؟",
  "delete": "حذف",
  "happening now": "يصير الحين",
  "one FAI takes a seat. you earn one every time you finish a talk.":
    "نقطة FAI وحدة تحجز لك مقعد. تكسب وحدة كل ما تخلّص جلسة.",
  "take a seat · 1 FAI": "احجز مقعد · 1 FAI",
  "take a seat in \"{title}\" · 1 FAI": "احجز مقعد في \"{title}\" · 1 FAI",
  "talks": "يتكلم",
  "open it · 1 FAI": "افتحها · 1 FAI",
  "seats": "مقاعد",
  "+ start your own talk": "+ ابدأ جلستك",
  "{n} seats": "{n} مقاعد",
  "cancel": "إلغاء",
  "{n} seats open": "{n} مقاعد فاضية",
  "1 seat open": "مقعد واحد فاضي",
  "Show me everyone again": "ورّني الكل مرة ثانية",
  "Get a pass": "خذ الاشتراك",
  "Remember my conversations": "احفظ محادثاتي",
  "forget": "انسَ",
  "forget your conversation with {name}": "انسَ محادثتك مع {name}",
  "Forget everything": "انسَ كل شي",
  "Nothing to erase — nothing was kept.": "ما فيه شي يُمسح — ما انحفظ شي.",
  "Terms": "الشروط",
  "Privacy": "الخصوصية",
  "Conversations": "المحادثات",
  "The golden room": "الغرفة الذهبية",
  "Voice minutes": "دقائق الصوت",
  "Who you want to meet": "مين تبي تقابل",
  "You speak": "تتكلم",
  "anyone": "أي أحد",
  "women": "نساء",
  "men": "رجال",
  "Your FAI": "نقاطك FAI",
  "free · tap the avatar to reshuffle": "مجاني · اضغط الصورة تغيّرها",
  "everyone, for now. pick anything to narrow the floor.":
    "الكل، حالياً. اختر أي شي تضيّق الصالة.",
  "a seat in a talk costs one. it cannot be bought — you earn one every time you finish a talk.":
    "المقعد في الجلسة يكلّف وحدة. ما تنشرى — تكسبها كل ما تخلّص جلسة.",
  "{n} more to find today": "باقي {n} تلقاها اليوم",
  "Cast your own scene": "اصنع مشهدك",
  "who speaks, and when": "مين يتكلم، ومتى",
  "pick a scene": "اختر مشهد",
  "who's in it": "مين فيه",
  "how it runs": "كيف يمشي",
  "{n} to choose from": "{n} للاختيار",
  "step {n} of 3": "خطوة {n} من ٣",
  "Tap one and it starts.": "اضغط وحدة وتبدأ.",
  "or cast it yourself": "أو اصنعه بنفسك",
  "kept on this device only, so you can pick one back up. nothing leaves your browser.":
    "محفوظة على هذا الجهاز بس، عشان تقدر تكمّل وحدة. ما يطلع شي من متصفحك.",
  "how you can tell who's talking": "كيف تعرف مين يتكلم",
  "search 57 scenes…": "دوّر بين ٥٧ مشهد…",
  "search scenes": "بحث المشاهد",
  "or describe them in your own words…": "أو وصفه بكلامك…",
  "Everywhere else you meet whoever is here. In Scenes you choose the situation, who is in the room, what each of them is, and who is allowed to speak.":
    "في كل مكان ثاني تقابل اللي موجود. في المشاهد أنت تختار الموقف، ومين في الغرفة، ووش دور كل واحد، ومين مسموح له يتكلم.",
  "that's all of today's": "خلصت حصة اليوم",
  "${usd} a session · {min} minutes. open one from inside any conversation — whoever you're talking to comes with you.":
    "{usd} دولار للجلسة · {min} دقيقة. افتح وحدة من داخل أي محادثة — اللي تتكلم معه يجي معك.",
  "book up to {n}": "احجز لين {n}",
  "book more": "احجز أكثر",
  "the pass covers your minutes.": "الاشتراك يغطي دقائقك.",
  "what's left of your free minutes on the floor.": "اللي باقي من دقائقك المجانية في الصالة.",
  "saved as your default between visits.": "محفوظة كافتراضي بين الزيارات.",
  "kept for this visit. a pass makes it stick.": "محفوظة لهذي الزيارة. الاشتراك يخليها ثابتة.",
  "a free session keeps nothing — nothing is stored, on this device or anywhere else.":
    "الجلسة المجانية ما تحفظ شي — لا على هذا الجهاز ولا في أي مكان ثاني.",

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
