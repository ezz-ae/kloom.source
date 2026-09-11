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
  "airraw",       // same
  "you@email.com" // an example address, not prose
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
  "ask her for a photo": "اطلب منها صورة",
  "talk": "تكلم",
  "type to {name}…": "اكتب لـ {name}…",
  "say something to the room…": "قول شي للغرفة…",
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
  "that pass has expired — the floor's open again with a new one": "الاشتراك ده انتهى — الفلور يفتح تاني باشتراك جديد",
  "airraw pro": "airraw pro",
  "airraw": "airraw",
  "you@email.com": "you@email.com",
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
  "call {name}": "اتصل بـ {name}",
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
  "we keep who you met, on this device only. with the pass, she also remembers what you said.": "بنحتفظ بمين قابلت، على جهازك بس. مع الاشتراك هي كمان بتفتكر اللي اتقال.",
  "Remember who I met": "افتكر مين قابلت",
  "remember who I met": "افتكر مين قابلت",

  // ── the call ───────────────────────────────────────────────────────────────
  "while you talk": "وأنت تتكلم",
  "call settings": "إعدادات المكالمة",
  "close settings": "إغلاق الإعدادات",
  "test your mic": "جرّب المايك",
  "swipe → for the words": "اسحب ← تشوف الكلام",
  "get a golden room": "خذ غرفة ذهبية",
  "take {name} into the golden room": "خذ {name} للغرفة الذهبية",
  "take {name} to the golden room": "خذ {name} للغرفة الذهبية",
  "show the words": "أظهر الكلام",
  "hide the words": "أخفِ الكلام",
  "on mute": "صامت",
  "sound": "الصوت",
  // ── the call ───────────────────────────────────────────────────────────────
  "leave": "خروج",
  "got it": "تمام",
  "quick pick": "اختيار سريع",
  "set it": "ثبّتها",
  "set the vibe": "حدد الجو",
  "pro · set the vibe": "برو · حدد الجو",
  "e.g. flirty and slow · hype me up · brutally honest": "مثلاً: غزل وعلى مهل · شجّعني · صريح بلا رحمة",
  "forget this conversation": "انسَ هذي المحادثة",
  "see her photos": "شوف صورها",
  "couldn't reach the voice — tap to retry": "ما وصلنا للصوت — اضغط تعيد",
  "some voices here are real people — you won't always know.": "بعض الأصوات هنا ناس حقيقيين — وما بتعرف دايم.",
  "speaker": "السماعة",
  "keypad": "الكيبورد",
  "photo": "صورة",
  "taking…": "بتصوّر…",
  "speaker · system default": "السماعة · الافتراضي",
  "volume": "مستوى الصوت",

  // ── the group room ─────────────────────────────────────────────────────────
  "back →": "رجوع ←",
  "pass the mic to someone else": "مرّر المايك لأحد ثاني",
  "pro · set the room vibe": "برو · حدد جو الغرفة",
  "set the room vibe": "حدد جو الغرفة",
  "set the mood and the whole room follows it.": "حدد المزاج والغرفة كلها تمشي عليه.",
  "e.g. roast each other · deep and honest · hype": "مثلاً: تنمّروا على بعض · عميق وصادق · حماس",
  "some people in here are real — you won't always know which.": "بعض اللي هنا حقيقيين — وما بتعرف مين.",
  "tap someone to call them, just you two · swipe → back · swipe ← leave":
    "اضغط على أحد تتصل فيه، أنتم بس · اسحب ← رجوع · اسحب → خروج",
  "the room is talking…": "الغرفة تتكلم…",
  "who's on this call": "مين بالمكالمة",

  // ── the room ───────────────────────────────────────────────────────────────
  "back to the room": "رجوع للغرفة",
  "talk here instead": "تكلم هنا بدالها",
  "the room is running in another tab —": "الغرفة شغّالة بتبويب ثاني —",
  "the room went quiet while you were away —": "الغرفة سكتت وأنت غايب —",
  "to you": "لك",
  "tonight": "الليلة",
  "he'll argue": "بيجادل في",
  "she'll argue": "بتجادل في",

  // ── the scene and golden rooms ─────────────────────────────────────────────
  "leave the scene": "اخرج من المشهد",
  "say something in the scene": "قل شي بالمشهد",
  "say something…": "قل شي…",
  "Say something, and it starts.": "قل شي، وتبدأ.",
  "leave the golden room": "اخرج من الغرفة الذهبية",
  "say something in the golden room": "قل شي بالغرفة الذهبية",
  "pick something below, or just carry on.": "اختر شي تحت، أو بس كمّل.",

  // ── the scene builder ──────────────────────────────────────────────────────
  "here, but doesn't speak": "موجود، بس ما يتكلم",
  "keep the transcript": "احفظ النص",
  "keep the voices": "احفظ الأصوات",
  "nothing by that name.": "ما فيه شي بهذا الاسم.",
  "remove": "احذف",

  // ── the talks board ────────────────────────────────────────────────────────
  "i've never told anyone this": "ما قلتها لأحد أبداً",
  "what's it about? the good ones sound like a confession, not a topic.":
    "عن وش؟ الحلوة تكون مثل الاعتراف، مو مثل الموضوع.",

  // ── the way in, the sky, the lobby ─────────────────────────────────────────
  "it's the now": "هذا هو الحين",
  "tap a face — and talk, out loud, right now.": "اضغط على وجه — وتكلم، بصوت، الحين.",
  "some here are AI · some are real": "بعضهم ذكاء اصطناعي · وبعضهم حقيقي",
  "fall deeper into the universe ↓": "انزل أعمق في العالم ↓",
  "get the pass": "خذ الاشتراك",
  "privacy": "الخصوصية",
  "a voice": "صوت",
  "it gets adult": "تصير للكبار",
  "never mind": "لا يهم",
  "i'm 18 or older": "عمري ١٨ أو أكثر",
  "i'm 18 or older — enter": "عمري ١٨ أو أكثر — ادخل",
  "no — take me back": "لا — رجّعني",
  "flirty, late-night, 18+. nothing explicit — but grown. confirm you're old enough.":
    "غزل، وقت متأخر، +١٨. ما فيه صريح — بس للكبار. أكّد إنك بالعمر المناسب.",
  "flirty, explicit, late-night. tap below to confirm you're 18 or older.":
    "غزل، صريح، وقت متأخر. اضغط تحت تأكّد إن عمرك ١٨ أو أكثر.",
  "step into the room — a few of them, together →": "ادخل الغرفة — كم واحد منهم، مع بعض ←",
  "this one's in the fire": "هذا في قلب النار",
  "step in →": "ادخل ←",
  "tap to skip": "اضغط تتخطى",
  "unlock scenes →": "افتح المشاهد ←",
  "part of the pass · 18+": "جزء من الاشتراك · +١٨",
  "scroll to go closer · drag to drift": "مرّر تقرب · اسحب تطوف",
  "you're approaching the deep": "أنت تقترب من العمق",
  "RAW — drift the open sky": "RAW — طوّف بالسماء المفتوحة",
  "back to people": "رجوع للناس",
  "people": "الناس",
  "language": "اللغة",
  "what else do you speak?": "وش تتكلم غير كذا؟",
  "your FAI balance": "رصيدك من FAI",
  "your profile": "ملفك",

  // ── the account page ───────────────────────────────────────────────────────
  "your name on the floor": "اسمك في الصالة",
  "your language": "لغتك",
  "remember my conversations": "احفظ محادثاتي",
  "reshuffle your avatar": "غيّر صورتك",
  "Cookies": "الكوكيز",
  "Payments": "المدفوعات",

  // ── the mic test, the arena, the waitlist ──────────────────────────────────
  "test your microphone": "جرّب المايك",
  "new game": "لعبة جديدة",
  "the arena · chess": "الحلبة · شطرنج",
  "loading…": "يحمّل…",
  "get in before the floor fills.": "ادخل قبل ما تمتلي الصالة.",
  "you felt it.": "حسّيتها.",
  "you're in.": "دخلت.",
  "founding access saved. we'll call you when the floor opens.":
    "حجزنا لك دخول مؤسّس. بنكلمك أول ما تفتح الصالة.",
  "that email looks off — try again?": "الإيميل شكله غلط — تجرب مرة ثانية؟",
  "maybe later": "يمكن بعدين",
  "one takes a seat. you earn one every time you finish a talk.":
    "وحدة تحجز مقعد. وتكسب وحدة كل ما تخلّص جلسة.",
  // ── the call, continued ────────────────────────────────────────────────────
  "{name} is talking…": "{name} يتكلم…",
  "{name} is thinking…": "{name} يفكر…",
  "listening — just talk": "يسمعك — بس تكلم",
  "tap call to start": "اضغط اتصال تبدأ",
  "your mic is off": "المايك مقفل",
  "muted · text only": "صامت · كتابة بس",
  "on air · just you two": "على الهواء · أنتم بس",
  "show the words while we talk": "أظهر الكلام وإحنا نتكلم",
  "you hear him out loud": "تسمعه بصوت",
  "he is on mute — tap to hear him": "هو صامت — اضغط تسمعه",
  "she is on mute — tap to hear her": "هي صامتة — اضغط تسمعها",
  "you hear her out loud": "تسمعها بصوت",
  "message {name} privately": "كلّم {name} على الخاص",

  // The last of the surfaces: chess, the buffet, the group mic, the deck.
  "clear": "مسح",
  "terms": "الشروط",
  "$9 opens her all the way →": "٩ دولار تفتحها لك بالكامل ←",
  "$9 keeps it going for 90 days →": "٩ دولار تكمّلها ٩٠ يوم ←",
  "airraw opens with a $1 day-pass. drop your email — founding access, free, and you're first through the door.": "airraw يفتح بتذكرة يوم بدولار واحد. اكتب إيميلك — دخول التأسيس، مجاناً، وتكون أول من يعبر الباب.",
  "← leave": "→ خروج",
  "💬 talk": "💬 كلام",
  "↓ board": "↓ اللوح",
  "↦ pass the mic": "↤ مرّر المايك",
  "pass the mic to {name}": "مرّر المايك لـ{name}",
  "18+ only past here": "\u200f+١٨ فقط بعد هنا",
  "■ stop": "■ وقّف",
  "▶ hear their voice": "▶ اسمع صوتهم",
  "▶ play again": "▶ شغّلها مرة ثانية",
  "🎙 said out loud": "🎙 قيلت بصوت",
  "← zoom out": "→ تصغير",
  "← lobby": "→ اللوبي",
  "~1,000 rooms inside": "\u200f~١٠٠٠ غرفة بالداخل",
  "…or tap a single voice for a 1:1": "…أو المس صوت واحد لجلسة على انفراد",
  "book golden sessions": "احجز جلسات ذهبية",
  "you are in this. add up to {n} others — what they are, what they're like, and whether they speak.":
    "أنت داخل القصة. ضيف لين {n} غيرك — مين هم، كيف طباعهم، ويتكلمون ولا لا.",

  // The discovery floor: its nine zones, and the gate in front of them.
  "Stories": "قصص",
  "Romance": "رومانسية",
  "Roleplay · GFE": "تمثيل أدوار · صديقة",
  "Lesbian": "سحاقيات",
  "Gay": "مثليين",
  "Couples": "أزواج",
  "Groups": "مجموعات",
  "BDSM": "بي دي إس إم",
  "Wild": "متوحش",
  "{n} inside": "{n} بالداخل",
  "enter {name} →": "ادخل {name} ←",
  "adults only": "للكبار فقط",
  "explicit content ahead": "محتوى صريح قدّامك",
  "kink, groups, explicit roleplay — everything adults actually want. confirm your age to keep going.": "كينك، مجموعات، تمثيل أدوار صريح — كل اللي الكبار يبونه فعلاً. أكّد عمرك عشان تكمّل.",
  "i'm 18 or older — let me in": "عمري ١٨ أو أكثر — خلّني أدخل",
  "go back": "رجوع",
  "by continuing you confirm you are 18+": "بمواصلتك أنت تؤكد أن عمرك ١٨ أو أكثر",
  "18+ · explicit content below": "\u200f+١٨ · محتوى صريح تحت",

  // The mic, the board, and the scene — status text that is set in one place
  // and read in another, so it is translated where it is READ.
  "unmute your microphone": "شغّل المايك",
  "mute your microphone": "اكتم المايك",
  "unmute": "شغّل",
  "mute": "اكتم",
  "swipe on": "كمّل سحب",
  "↑ swipe up": "↑ اسحب فوق",
  "saved as your default": "محفوظ كإعدادك الأساسي",
  "kept for this visit": "محفوظ لهذي الزيارة",
  "delete the scene with {cast}": "احذف المشهد مع {cast}",
  " · not saved": " · غير محفوظ",
  "turn the voices on": "شغّل الأصوات",
  "turn the voices off": "اكتم الأصوات",
  "your mic is off — they can't hear you": "مايكك مقفل — ما يسمعونك",
  "you've used today's voice — your pass resets at midnight": "خلّصت صوت اليوم — اشتراكك يتجدد منتصف الليل",
  "your free minute is up — unlock the pass to keep talking": "خلصت دقيقتك المجانية — افتح الاشتراك عشان تكمّل",
  "paused to save your minutes — tap talk to wake it up": "وقفناها نحفظ دقايقك — اضغط تكلم تصحيها",
  "voice isn't supported on this browser — tap the keypad to type": "الصوت ما يشتغل على هذا المتصفح — اضغط الكيبورد وتكتب",
  "voice needs your real browser — tap ⋯ at the top, then “open in browser” — or tap the keypad to type": "الصوت محتاج المتصفح الحقيقي — اضغط ⋯ فوق وبعدين «فتح في المتصفح» — أو اضغط الكيبورد وتكتب",
  "the free voice is spent on your network for today — the pass opens it now": "الصوت المجاني خلص على شبكتك النهارده — الاشتراك يفتحه دلوقتي",
  "voice needs your real browser.": "الصوت محتاج المتصفح الحقيقي.",
  "voice needs your real browser — tap ⋯ at the top, then “open in browser”.": "الصوت محتاج المتصفح الحقيقي — اضغط ⋯ فوق وبعدين «فتح في المتصفح».",
  "open in Chrome": "افتح في كروم",
  "dismiss": "إغلاق",
  "allow mic access to talk — or tap the keypad to type": "اسمح بالمايك عشان تتكلم — أو اضغط الكيبورد وتكتب",
  "heard you — one sec…": "سمعناك — لحظة…",
  "mic off — you left the call screen": "المايك مقفل — طلعت من شاشة المكالمة",
  "mic back on": "المايك رجع",
  "voice unavailable — tap the keypad to type": "الصوت مو متاح — اضغط الكيبورد وتكتب",
  "checkmate — the house wins": "كش ملك — البيت يكسب",
  "checkmate — you win": "كش ملك — أنت تكسب",
  "a draw — even tonight": "تعادل — متعادلين الليلة",
  "your move": "دورك",
  "your move — you're white": "دورك — أنت الأبيض",
  "switched to {lang}": "تحوّلنا لـ{lang}",
  "you're in check": "أنت في كش",
  "check — careful": "كش — انتبه",

  // The fifteen languages, by the name the picker prints. The VALUE it stores
  // stays the English key — prefs, the roster and the voice all match on that.
  "English": "الإنجليزية",
  "Spanish": "الإسبانية",
  "French": "الفرنسية",
  "German": "الألمانية",
  "Italian": "الإيطالية",
  "Portuguese": "البرتغالية",
  "Japanese": "اليابانية",
  "Korean": "الكورية",
  "Chinese": "الصينية",
  "Arabic": "العربية",
  "Hindi": "الهندية",
  "Russian": "الروسية",
  "Dutch": "الهولندية",
  "Turkish": "التركية",
  "Polish": "البولندية",
  "chatting in {lang} — switch language": "تتكلم بـ{lang} — بدّل اللغة",

  // The way in: your name, your mood, and the line while the room is built.
  "one thing — what's tonight?": "شي واحد — وش سوالفك الليلة؟",
  "good to meet you, {name}. what's tonight?": "تشرفنا يا {name}. وش سوالفك الليلة؟",
  "slow & quiet": "على مهل وهدوء",
  "a corner, low voices": "ركن جانبي، أصوات واطية",
  "easy & warm": "مرتاح ودافي",
  "a bar, just filling up": "بار، لسه يمتلي",
  "electric": "مكهرب",
  "rooftop, city below": "سطح، والمدينة تحت",
  "no filter": "بدون فلتر",
  "3am, nothing to lose": "٣ الفجر، ما عندك شي تخسره",
  "shaping your first room…": "نجهّز أول غرفة لك…",
  "shaping it around you, {name}…": "نفصّلها على مقاسك يا {name}…",
  "switch to {lang}": "بدّل إلى {lang}",
  "end the call": "أنهِ المكالمة",
  "call": "اتصال",
  "type": "اكتب",
  "text": "كتابة",
  "{n} people": "{n} شخص",
  "live": "مباشر",
  "you": "أنت",
  "your pass has run out — restore or renew it to keep talking": "انتهى اشتراكك — استرجعه أو جدّده عشان تكمّل",
  "we couldn't verify your pass — restore it and you're back": "ما قدرنا نتحقق من اشتراكك — استرجعه وترجع تكمّل",
  "✦ pass active · until {date}": "✦ اشتراكك فعّال · حتى {date}",
  "✦ pass active": "✦ اشتراكك فعّال",
  "airraw opens with a ${usd} pass for {days} days. drop your email — founding access, free, and you're first through the door.": "airraw يفتح باشتراك {usd} دولار لمدة {days} يوم. اكتب إيميلك — دخول التأسيس، مجاناً، وتكون أول من يعبر الباب.",
  "drop your email — founding access, free, and you're first through the door.": "اكتب إيميلك — دخول التأسيس، مجاناً، وتكون أول من يعبر الباب.",
}
