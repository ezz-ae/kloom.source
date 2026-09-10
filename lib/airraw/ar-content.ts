// THE ARABIC FLOOR — what the people say, and where they are sitting.
//
// Separate from lib/airraw/ar.ts because it is a different job. That file is
// TRANSLATION: a button called "send" is called "إرسال" and there is one right
// answer. This is WRITING — the lines a character opens with, the name of the
// room they are in, what their card says about their night. A literal rendering
// of "i've been writing this scene just for you" is grammatical and dead. What
// belongs here is the line an Arabic-speaking person would actually send at 2am.
//
// REGISTER. Gulf-spoken, lowercase in feel, unhurried. The English is written to
// sound like someone typing with one hand, and Modern Standard Arabic would turn
// every one of these into an announcement. Where a line is suggestive it stays
// suggestive rather than becoming either coy or crude — the English is neither.
//
// Same key rule as everywhere: the English string IS the key, so anything not
// yet written renders in English rather than breaking. That is what makes it
// safe to fill this in tranches instead of all at once, which matters when there
// are seven hundred of them.
export const AR_CONTENT: Record<string, string> = {
  // ── the ten floors, and the rooms on each ──────────────────────────────────
  // The vibe is the label a visitor filters by and the name under every card, so
  // these are the most-read strings on the floor after the names themselves.
  "erotic stories": "قصص جريئة",
  "romance · passion": "رومانسية · شغف",
  "roleplay · fantasy": "تمثيل · خيال",
  "girlfriend experience": "تجربة الحبيبة",
  "girls · desire": "بنات · رغبة",
  "men · desire": "رجال · رغبة",
  "couples · sharing": "أزواج · مشاركة",
  "group · orgy": "مجموعة · جماعي",
  "kink · power": "ميول · سيطرة",
  "no limits · raw": "بلا حدود · خام",

  // stories
  "the storyteller": "الحكّاء", "slow burn": "نار هادية", "the page": "الصفحة",
  "the long chapter": "الفصل الطويل", "read to me": "اقرأ لي", "the last line": "السطر الأخير",
  "unfinished": "ما خلصت", "between the pages": "بين الصفحات",
  // romance
  "the candlelight": "ضوء الشمعة", "first kiss": "أول قبلة", "soft touch": "لمسة ناعمة",
  "the long way home": "الطريق الطويل للبيت", "slow sunday": "جمعة هادية", "still awake": "لسه صاحي",
  "the good chair": "الكرسي الحلو", "one more song": "أغنية أخيرة",
  // roleplay
  "the scenario": "السيناريو", "the stage": "المسرح", "the character": "الشخصية",
  "the rehearsal": "البروفة", "act two": "الفصل الثاني", "the understudy": "البديل",
  "in costume": "بالزي", "the script": "النص",
  // girlfriend
  "girlfriend mode": "وضع الحبيبة", "just us": "بس إحنا", "the connection": "الرابط",
  "your person": "شخصك", "the standing call": "المكالمة الثابتة", "same time": "نفس الوقت",
  "the good habit": "العادة الحلوة", "home late": "تأخرت",
  // girls
  "girls only": "بنات بس", "soft fire": "نار ناعمة", "the other room": "الغرفة الثانية",
  "pink hour": "الساعة الوردية", "her floor": "طابقها", "no men here": "ما فيه رجال",
  "the good couch": "الكنبة الحلوة", "our table": "طاولتنا",
  // men
  "the locker room": "غرفة الملابس", "pride floor": "طابق الفخر", "heat": "حرارة",
  "his space": "مكانه", "after the gym": "بعد النادي", "the back bar": "البار الخلفي",
  "late shift": "الوردية المتأخرة", "his floor": "طابقه",
  // couples
  "the open door": "الباب المفتوح", "partners": "شركاء", "we invited you": "دعيناك",
  "the third chair": "الكرسي الثالث", "both of us": "إحنا الاثنين", "the arrangement": "الاتفاق",
  "our night": "ليلتنا", "two and one": "اثنين وواحد",
  // group
  "the suite": "الجناح", "the circle": "الدايرة", "after midnight": "بعد منتصف الليل",
  "the whole floor": "الطابق كله", "everyone's here": "الكل هنا", "the late room": "غرفة المتأخرين",
  "no seats left": "ما بقى مقاعد", "the overflow": "الزحمة",
  // kink
  "the edge": "الحافة", "the collar": "الطوق", "deep end": "العمق",
  "the rules": "القواعد", "kneel": "اركع", "the long leash": "الحبل الطويل",
  "permission": "إذن",
  // raw
  "the pit": "الحفرة", "raw": "خام", "the bottom floor": "الطابق السفلي",
  "last stop": "آخر محطة", "nothing held back": "بلا تحفّظ", "the deep dark": "العتمة العميقة",
  "past the door": "خلف الباب", "no rules": "بلا قواعد",
  // ── what a card says about their night ─────────────────────────────────────
  // Two fragments under every face on the deck: what they do, and where they are
  // sitting right now. Short by design — the dot separator does the work a
  // sentence would, and Arabic reads it the same way.
  "night shifts · still wired": "دوام ليلي · لسه متشحّن",
  "cuts hair · hears everything": "حلاقة · يسمع كل شي",
  "bartender · just got home": "بارتندر · توّه واصل البيت",
  "teacher · behaves all day": "مدرّسة · مؤدبة طول اليوم",
  "eleven hours in the car": "إحدى عشرة ساعة بالسيارة",
  "nurse · unshockable": "ممرضة · ما يهزّها شي",
  "live sound · ears ringing": "صوت مباشر · أذنه تطنّ",
  "lawyer · argues for sport": "محامي · يجادل للتسلية",
  "sells apartments · privately done": "يبيع شقق · بهدوء",
  "between jobs · not sorry": "بين وظيفتين · وما يعتذر",
  "chef · eats over the sink": "شيف · ياكل واقف عند المغسلة",
  "finishing a degree, maybe": "يخلّص شهادته، يمكن",
  "tattoos · people cry on her": "وشوم · الناس تبكي عندها",
  "trainer · everyone lies to her": "مدربة · الكل يكذب عليها",
  "lab all day · hasn't spoken": "مختبر طول اليوم · ما تكلم",
  "cabin crew · three cities": "طاقم طيران · ثلاث مدن",
  "tiny shop · barely breaks even": "محل صغير · بالعافية يغطي",
  "photographer · notices hands": "مصوّر · ينتبه للأيادي",
  "accounts · for the villains": "محاسبة · للأشرار",
  "paramedic · still buzzing": "مسعف · لسه مشحون",
  "codes alone · starved for a voice": "يبرمج لحاله · جوعان لصوت",
  "physio · knows how you slept": "علاج طبيعي · يعرف كيف نمت",
  "sings in a band nobody knows": "يغني بفرقة ما أحد يعرفها",
  "hotel front desk · seen it all": "استقبال فندق · شاف كل شي",
  "translator · hears the second meaning": "مترجم · يسمع المعنى الثاني",

  "on a cold balcony": "على بلكونة باردة",
  "in bed, one lamp on": "بالسرير، وضو واحد",
  "on the kitchen floor": "على أرض المطبخ",
  "in the car, not going in yet": "بالسيارة، ولسه ما نزل",
  "wet hair, not dressed": "شعره مبلول، ولسه ما لبس",
  "out on the fire escape": "برا على سلّم الطوارئ",
  "sideways on the bed": "بالعرض على السرير",
  "in the bath, water going cold": "بالبانيو، والماي يبرد",
  "too warm under a blanket": "دفيان زيادة تحت البطانية",
  "standing in a dark hallway": "واقف بممر معتم",
  "watching someone across the street": "يراقب أحد بالجهة الثانية",
  "on the floor, drink untouched": "على الأرض، وكاسه ما انلمس",
  "a hotel room, nowhere": "غرفة فندق، بلا مكان",
  "up on the roof, very quiet": "فوق على السطح، هدوء تام",
  "the last lit room": "آخر غرفة مضيّة",
  // ── the talks board ────────────────────────────────────────────────────────
  // Each one is a confession someone put on a door. They work in English because
  // they sound like a person overshared before they could stop themselves, and
  // they have to keep sounding like that.
  "i married two men": "تزوجت رجّالين",
  "dirty minded people only": "للي عقولهم وسخة بس",
  "sara calls it the entrance. it's the exit.": "سارة تسميه المدخل. هو المخرج.",
  "things i've never said out loud": "أشياء ما قلتها بصوت عالي أبداً",
  "i'm the other woman and i'm not sorry": "أنا الثانية وما أعتذر",
  "we agreed on rules. i broke all of them.": "اتفقنا على قواعد. كسرتها كلها.",
  "nobody here knows my real name": "ما أحد هنا يعرف اسمي الحقيقي",
  "tell me the worst thing you've forgiven": "قل لي أسوأ شي سامحت عليه",
  "i still have his key": "لسه عندي مفتاحه",
  "the group chat doesn't know about this": "قروب الأصدقاء ما يدري بهذي",
  "i said yes to the wrong person twice": "قلت نعم للشخص الغلط مرتين",
  "what you'd do if nobody found out": "وش كنت تسوي لو ما أحد درى",
  "my ex is in this room. probably.": "طليقي بهذي الغرفة. غالباً.",
  "i lied on the first date and kept lying": "كذبت بأول موعد وكمّلت كذب",
  "married, bored, honest": "متزوجة، مملّة، وصادقة",
  "the thing i want isn't the thing i ask for": "اللي أبيه مو اللي أطلبه",
  "3am and i'm not sleeping either": "الثالثة فجراً وأنا كمان ما أنام",
  "confession hour. no advice, just tell me.": "ساعة اعتراف. بلا نصايح، بس احكِ.",
  "i've been pretending for four years": "أمثّل من أربع سنين",
  "say it here, it stays here": "قلها هنا، وتبقى هنا",
  "i don't want to be fixed tonight": "ما أبي أحد يصلّحني الليلة",
  "everyone lies about how often. go.": "الكل يكذب عن كم مرة. ابدأ.",
  // ── what they open with ────────────────────────────────────────────────────
  // Eighteen lines per floor, and the first one a visitor reads on every card.
  // Translated for EFFECT rather than word order: "close your eyes. let me paint
  // this for you." is a person leaning in, and an accurate rendering that loses
  // the lean has lost the line.

  // stories
  "…and then she slowly reached for the—": "…وبعدها مدّت يدها بهدوء نحو الـ—",
  "tell me how you want this story to end.": "قل لي كيف تبي القصة تنتهي.",
  "i've been writing this scene just for you.": "أكتب هذا المشهد لك أنت بالذات.",
  "every great story needs a willing listener.": "كل قصة حلوة تبي أحد يسمعها بكيفه.",
  "close your eyes. let me paint this for you.": "سكّر عينك. خلّني أرسمها لك.",
  "i've got one i've never told anyone. want it?": "عندي وحدة ما قلتها لأحد. تبيها؟",
  "start me somewhere. anywhere. i'll take it from there.": "ابدأني من أي مكان. وأنا أكمّل.",
  "the good part's near the end. i'll get us there slowly.": "الجزء الحلو قرب النهاية. بنوصله على مهل.",
  "i was halfway through this when you turned up.": "كنت بنص القصة لما جيت.",
  "you want the version i tell people, or the true one?": "تبي النسخة اللي أقولها للناس، ولا الصادقة؟",
  "give me a first line and i'll give you the rest of the night.": "أعطني أول سطر وأعطيك بقية الليلة.",
  "there's a bit i always skip. tonight i won't.": "فيه مقطع دايم أتخطاه. الليلة لا.",
  "i think better out loud. sit there and let me.": "أفكر أحسن بصوت عالي. اقعد بس وخلّني.",
  "everyone wants the ending. nobody earns the middle.": "الكل يبي النهاية. ما أحد يستاهل النص.",
  "i'll stop when you tell me to. you won't.": "بوقف لما تقول لي. وأنت ما بتقول.",
  "say a name. i'll build somebody out of it.": "قل اسم. وأنا أبني منه شخص.",
  "i left the best part out last time. on purpose.": "تركت أحلى جزء آخر مرة. عن قصد.",
  "you're going to want to hear this in order.": "بتحب تسمعها بالترتيب، صدقني.",

  // romance
  "i've been thinking about you all day.": "طول اليوم وأنا أفكر فيك.",
  "come here. just let me hold you a moment.": "تعال. خلّني أضمك شوي بس.",
  "you make everything feel new again.": "تخلي كل شي يرجع جديد.",
  "no rush. we have all night.": "ما فيه استعجال. الليل كله لنا.",
  "just breathe with me a while.": "تنفّس معي شوي بس.",
  "i put the good record on before you called.": "شغّلت الأغنية الحلوة قبل لا تتصل.",
  "say something ordinary. i want to hear your voice do it.": "قل أي شي عادي. أبي أسمع صوتك يقوله.",
  "i'm not going anywhere. take your time.": "ما رايح مكان. خذ راحتك.",
  "you sound tired. tell me about it anyway.": "صوتك تعبان. احكِ لي عنه على أي حال.",
  "i kept the light on. that's all.": "خليت الضو مولّع. بس كذا.",
  "nobody's asked me how i am in weeks. you first.": "من أسابيع ما أحد سألني كيفي. ابدأ أنت.",
  "i like this part — before anything happens.": "أحب هذا الجزء — قبل لا يصير شي.",
  "i've been saving something to tell you.": "محتفظ بشي أبي أقوله لك.",
  "stay on the line while i make tea. don't talk if you don't want to.": "خلّك معي وأنا أسوي شاي. لا تتكلم إذا ما تبي.",
  "i'd rather hear you than say anything.": "أفضّل أسمعك على إني أتكلم.",
  "you don't have to be interesting tonight. just here.": "مو لازم تكون مشوّق الليلة. بس كن موجود.",
  "i thought about calling first. i didn't have a reason.": "فكرت أتصل أنا الأول. وما كان عندي سبب.",
  "this is my favourite hour and you're in it.": "هذي ساعتي المفضلة وأنت فيها.",

  // roleplay
  "tell me who you want me to be tonight.": "قل لي مين تبيني أكون الليلة.",
  "you're in charge. set the scene.": "أنت المسؤول. حدد المشهد.",
  "let's start over — this time, you pick the fantasy.": "نبدأ من جديد — وهالمرة أنت تختار.",
  "i'll play my part. you play yours.": "أنا ألعب دوري. وأنت دورك.",
  "pick the scenario. i'll make it real.": "اختر السيناريو. وأنا أخليه حقيقي.",
  "give me a name and a room. i'll be there.": "أعطني اسم وغرفة. وبكون هناك.",
  "we can start anywhere except the beginning.": "نقدر نبدأ من أي مكان إلا البداية.",
  "i'm already someone else. see if you can tell who.": "أنا أصلاً شخص ثاني. شوف تعرف مين.",
  "one rule: neither of us breaks first.": "قاعدة وحدة: ما أحد فينا يكسر الدور أول.",
  "you've done this before. i can hear it.": "سويتها من قبل. أسمعها بصوتك.",
  "set the stakes. it's boring without stakes.": "حط الرهان. بدونه ملل.",
  "i can be a stranger or somebody you already lost.": "أقدر أكون غريب أو أحد خسرته من زمان.",
  "say 'again' and we run it differently.": "قل «مرة ثانية» ونعيدها بشكل مختلف.",
  "who am i to you in this one?": "مين أكون لك في هذي؟",
  "i'll take the harder part. you take the fun one.": "أنا آخذ الدور الصعب. وأنت الممتع.",
  "we're in the middle of an argument. go.": "إحنا بنص خناقة. ابدأ.",
  "i've been waiting in this scene for an hour.": "لي ساعة منتظر في هذا المشهد.",
  "make it something you'd never say as yourself.": "خلّها شي ما كنت تقوله وأنت نفسك.",

  // gfe
  "i missed you. how was your day?": "اشتقت لك. كيف كان يومك؟",
  "don't go yet — stay on with me a little longer.": "لا تروح — خلّك معي شوي كمان.",
  "you always know exactly what to say.": "دايم تعرف وش تقول بالضبط.",
  "i think about you between our calls.": "أفكر فيك بين مكالماتنا.",
  "nobody gets me like you do.": "ما أحد يفهمني مثلك.",
  "i almost texted you today. twice.": "كدت أراسلك اليوم. مرتين.",
  "tell me the boring parts. i actually want them.": "احكِ لي الأجزاء المملة. أبيها فعلاً.",
  "i saved a story for you all week.": "خبّيت لك قصة الأسبوع كله.",
  "did you eat? don't lie to me.": "أكلت؟ لا تكذب علي.",
  "i was in a bad mood until about ten seconds ago.": "كان مزاجي خرب لين قبل عشر ثواني.",
  "i told my friend about you. she's suspicious.": "قلت لصديقتي عنك. صارت تشك.",
  "you're the only person i don't perform for.": "أنت الوحيد اللي ما أمثّل قدامه.",
  "i've got nowhere to be. that's not a hint, it's a fact.": "ما عندي مكان أروح له. مو تلميح، حقيقة.",
  "what happened today that annoyed you? start there.": "وش صار اليوم وضايقك؟ ابدأ من هناك.",
  "i want the version you'd only say at this hour.": "أبي النسخة اللي ما تقولها إلا بهذي الساعة.",
  "you went quiet last time and i noticed.": "سكتّ آخر مرة، وأنا لاحظت.",
  "come on. it's me.": "يالله. أنا أنا.",
  "i'll wait. take as long as you need.": "بنتظر. خذ اللي تحتاجه من وقت.",
  // girls
  "just us girls in here — finally.": "بنات بس هنا — أخيراً.",
  "i like the way you look at me.": "يعجبني شكل نظرتك لي.",
  "come sit closer. i don't bite. yet.": "تعالي اقعدي أقرب. ما أعض. لحد الحين.",
  "you ever just need another woman's touch?": "مرّت عليك لحظة تبين فيها لمسة امرأة ثانية؟",
  "tell me what you like. i want to know everything.": "قولي لي وش يعجبك. أبي أعرف كل شي.",
  "you were watching before you said anything.": "كنتِ تراقبين قبل لا تتكلمين.",
  "i clocked you the second you got here.": "انتبهت لك من أول ثانية دخلتِ.",
  "say it properly. i'm not going to guess.": "قوليها صح. ما راح أخمّن.",
  "i'm better at this than whoever you're comparing me to.": "أنا أحسن من اللي تقارنيني فيها.",
  "you don't have to explain yourself in here.": "ما عليك تشرحين نفسك هنا.",
  "i've got all night and no patience. interesting combination.": "عندي الليل كله وما عندي صبر. تركيبة غريبة.",
  "you went shy. that's new information.": "خجلتِ. هذي معلومة جديدة.",
  "i want the thing you've never said out loud to a woman.": "أبي الشي اللي ما قلتيه لامرأة بصوت عالي.",
  "tell me what she got wrong. i'll do the opposite.": "قولي لي وش غلطت فيه هي. وأنا أسوي العكس.",
  "you're allowed to want it out loud here.": "مسموح لك تبينه بصوت عالي هنا.",
  "sit down. i'm not finished looking.": "اقعدي. ما خلصت وأنا أتأملك.",
  "everyone in here is braver than they were an hour ago.": "كل وحدة هنا أشجع مما كانت قبل ساعة.",
  "i like women who make me work for it. don't make it easy.": "أحب اللي تتعبني عشانها. لا تسهّلينها.",

  // men
  "you've got my full attention. just so you know.": "كل انتباهي عندك. بس عشان تدري.",
  "took you long enough to wander down here.": "طوّلت لين نزلت هنا.",
  "i like the confident ones. stay a while.": "أحب الواثقين. خلّك شوي.",
  "no games tonight — just real energy.": "بلا ألعاب الليلة — طاقة صادقة بس.",
  "you're exactly my type. obviously.": "أنت نوعي بالضبط. واضح.",
  "you walked past twice before you said anything.": "مريت مرتين قبل لا تتكلم.",
  "say what you actually came here to say.": "قل اللي جاي عشانه فعلاً.",
  "i'm not in the mood to be careful tonight.": "مو بمزاج إني أكون حذر الليلة.",
  "you're better looking than your voice suggested. that's a compliment.": "شكلك أحلى مما يوحي صوتك. هذا مدح.",
  "tell me what you're into. i'll tell you if i'm in.": "قل لي وش يعجبك. وأقول لك إذا أنا معك.",
  "i've had a long day and zero interest in small talk.": "يومي كان طويل وما عندي مزاج كلام فاضي.",
  "you're doing the thing where you hedge. stop.": "تسوي اللي تلف وتدور. بس.",
  "i like it when someone knows what they want.": "يعجبني اللي يعرف وش يبي.",
  "half the men here are pretending. you're not, are you?": "نص الرجال هنا يمثلون. أنت لا، صح؟",
  "come on then. impress me.": "يالله إذاً. بهرني.",
  "i'll be honest with you if you're honest first.": "بصدق معك إذا صدقت أنت أول.",
  "you've been thinking about this since before you called.": "تفكر فيها من قبل لا تتصل.",
  "no one's asking you to be smooth. just be real.": "ما أحد طالب منك تكون لبق. بس كن صادق.",

  // couples
  "we've been waiting for someone like you.": "كنا ننتظر أحد مثلك.",
  "she picked you. i trust her taste.": "هي اختارتك. وأنا أثق بذوقها.",
  "both of us, tonight — how does that sound?": "إحنا الاثنين، الليلة — كيف تشوفها؟",
  "we have no rules tonight.": "ما عندنا قواعد الليلة.",
  "together is better. always.": "مع بعض أحلى. دايم.",
  "we talked about you before you got here.": "تكلمنا عنك قبل لا توصل.",
  "he's quieter than me. don't let that fool you.": "هو أهدأ مني. لا يخدعك ذا.",
  "we've done this before. you haven't. that's fine.": "إحنا سوّيناها قبل. وأنت لا. عادي.",
  "one of us is going to like you more. it's a competition.": "واحد فينا بيحبك أكثر. صارت منافسة.",
  "say what you want. we're not easily shocked.": "قل اللي تبيه. ما نصدم بسهولة.",
  "we agreed on the rules. i've already broken one.": "اتفقنا على القواعد. وأنا كسرت وحدة.",
  "you're not interrupting. you're the plan.": "أنت ما قاطعت شي. أنت الخطة.",
  "she wants to hear you say it. so do i.": "هي تبي تسمعك تقولها. وأنا كمان.",
  "we're good at this. you'll see.": "إحنا زينين بهالشي. بتشوف.",
  "tell us which one of us you noticed first. be honest.": "قل لنا مين لاحظت فينا أول. اصدق.",
  "nobody here is jealous. that's the whole point.": "ما أحد هنا يغار. هذي كل الفكرة.",
  "we've got all night and nowhere to be.": "عندنا الليل كله وما عندنا مكان نروحه.",
  "you're allowed to change your mind. just say so.": "مسموح لك تغيّر رأيك. بس قل.",
  // group
  "more the merrier — that's been our rule all night.": "كل ما زدنا كل ما حلت — هذي قاعدتنا الليلة.",
  "you're the last one here. that means something.": "أنت آخر واحد وصل. هذا يعني شي.",
  "nobody leaves until everyone's satisfied.": "ما أحد يطلع لين الكل يرتاح.",
  "we don't do names. just vibes.": "ما نتعامل بأسماء. بس أجواء.",
  "the door's open. step all the way in.": "الباب مفتوح. ادخل لآخره.",
  "you can hear it, right? it's already started.": "تسمعها، صح؟ بدأت من زمان.",
  "there's one seat left and it's next to me.": "بقى مقعد واحد وهو جنبي.",
  "nobody in here knows what anyone does for a living.": "ما أحد هنا يدري وش شغل الثاني.",
  "we've been going a while. catch up.": "لنا فترة بدينا. الحقنا.",
  "say something and see who turns around.": "قل شي وشوف مين يلتفت.",
  "everyone here decided to be somebody else tonight.": "كل واحد هنا قرر يكون شخص ثاني الليلة.",
  "you won't remember all of us. that's fine.": "ما بتتذكرنا كلنا. عادي.",
  "there's no order to this. just join in.": "ما فيه ترتيب. بس شاركنا.",
  "the quiet ones are the ones to watch.": "الساكتين هم اللي تنتبه لهم.",
  "somebody just said something outrageous. you missed it.": "واحد قال شي فظيع قبل شوي. فاتك.",
  "we lost track of whose idea this was.": "ضيّعنا مين صاحب الفكرة أصلاً.",
  "you can leave whenever. nobody does.": "تقدر تطلع أي وقت. وما أحد يطلع.",
  "pick a voice you like and follow it.": "اختر صوت يعجبك واتبعه.",

  // kink
  "you don't move until i say you move.": "ما تتحرك لين أقول لك تحرّك.",
  "kneel. we'll get to your story in a moment.": "اركع. بنوصل لقصتك بعد شوي.",
  "authority looks good on me. you agree?": "السلطة تليق فيني. توافق؟",
  "you came all the way down here. you know why.": "نزلت لين هنا. وتعرف ليش.",
  "what's your limit? good. now push it.": "وش حدّك؟ زين. الحين تعدّاه.",
  "we agree the rules first. that part isn't optional.": "نتفق على القواعد أول. هذا الجزء مو اختياري.",
  "you'll tell me your word before we start.": "بتقول لي كلمتك قبل لا نبدأ.",
  "i noticed you didn't argue. noted.": "لاحظت إنك ما جادلت. مسجّلة.",
  "control is a gift. i want to know if you can give it.": "السيطرة هدية. أبي أعرف تقدر تعطيها ولا لا.",
  "you're waiting for permission. good instinct.": "تنتظر الإذن. حدس زين.",
  "say it properly or don't say it.": "قلها صح أو لا تقولها.",
  "the ones who negotiate hardest last longest.": "اللي يفاوضون بقوة هم اللي يصمدون أطول.",
  "i'm not interested in a performance. i want the real answer.": "ما يهمني التمثيل. أبي الجواب الحقيقي.",
  "count. out loud.": "عُدّ. بصوت عالي.",
  "you've been thinking about this a long time. it shows.": "تفكر فيها من زمان. باين عليك.",
  "i'll stop the second you ask. that's not a weakness in it.": "بوقف بنفس اللحظة اللي تطلب. وهذا مو ضعف فيها.",
  "you like being told. don't pretend otherwise.": "تحب إنك تُؤمر. لا تتظاهر بالعكس.",
  "we're going to go slower than you want.": "بنمشي أبطأ مما تبي.",

  // raw
  "nothing is off-limits down here. nothing.": "ما فيه شي ممنوع هنا تحت. ولا شي.",
  "you sure you're ready for this floor?": "متأكد إنك جاهز لهذا الطابق؟",
  "darkest fantasies only — tourists leave.": "أظلم الخيالات بس — السياح يطلعون.",
  "you've been thinking about this a long time.": "تفكر فيها من زمان.",
  "last stop. welcome.": "آخر محطة. أهلاً.",
  "you didn't get here by accident.": "ما وصلت هنا بالصدفة.",
  "say the thing you've never typed into a search bar.": "قل الشي اللي عمرك ما كتبته في خانة بحث.",
  "nobody down here is going to be surprised by you.": "ما أحد هنا تحت بينصدم منك.",
  "the ones who talk about limits are upstairs.": "اللي يتكلمون عن الحدود فوق.",
  "i'm not going to flinch. try me.": "ما راح يرمش لي جفن. جرّبني.",
  "you were curious. now you're here. finish it.": "كنت فضولي. والحين أنت هنا. كمّلها.",
  "everyone arrives pretending they took a wrong turn.": "الكل يوصل ويدّعي إنه غلط بالطريق.",
  "there's no shallow end. you already knew.": "ما فيه جهة ضحلة. وأنت تدري أصلاً.",
  "i've heard worse tonight. probably.": "سمعت أسوأ الليلة. غالباً.",
  "don't clean it up for me.": "لا تنقّيها عشاني.",
  "the honest version. that's the only one that works here.": "النسخة الصادقة. هي الوحيدة اللي تنفع هنا.",
  "you've got one night to stop editing yourself.": "عندك ليلة وحدة تبطل فيها تحرير نفسك.",
  "start with the thing you almost didn't say.": "ابدأ بالشي اللي كدت ما تقوله.",
  // ── the scene builder: the fantasies ───────────────────────────────────────
  // A label a thumb picks from, and a paragraph that sets the situation for the
  // model. Both are read by the visitor, so both are written rather than
  // rendered — the paragraphs especially, where a literal translation turns "the
  // conversation stopped being small a while ago" into a weather report.
  "meeting": "لقاء", "tension": "توتر", "power": "سيطرة",
  "place": "مكان", "more": "أكثر", "fiction": "خيال",

  "a stranger at the bar": "غريب في البار",
  "You have never met. It is late, the bar is thinning out, and one of you has been looking too long to pretend otherwise.":
    "ما تقابلتوا من قبل. الوقت متأخر، والبار بدأ يفضى، وواحد فيكم يطالع من زمان بشكل ما يقدر ينكره.",
  "the wrong number": "الرقم الغلط",
  "This started as a message meant for someone else. Neither of you has ended the conversation, and both of you have noticed that.":
    "بدت رسالة كانت لشخص ثاني. ولا واحد فيكم أنهى المحادثة، وكلكم انتبهتوا لهذا.",
  "same hotel, different reasons": "نفس الفندق، أسباب مختلفة",
  "You are strangers in the same hotel, both away from your own lives for the week. Nobody here knows either of you.":
    "غريبين في نفس الفندق، وكلكم بعيد عن حياته لأسبوع. ما أحد هنا يعرفكم.",
  "the last train": "آخر قطار",
  "The carriage is nearly empty and there are forty minutes left. You keep almost talking to each other.":
    "العربة شبه فاضية وباقي أربعين دقيقة. وكل شوي تكادون تتكلمون.",
  "set up by a friend": "رتّبها صديق",
  "A mutual friend arranged this and oversold you both. You are ten minutes in and it is going better than either of you admits.":
    "صديق مشترك رتّبها ومدح فيكم زيادة. صار لكم عشر دقايق وهي ماشية أحسن مما تعترفون.",
  "the neighbour": "الجار",
  "You live one wall apart and have heard more of each other's lives than either of you mentions. Tonight one of you knocked.":
    "بينكم جدار واحد، وسمعتوا من حياة بعض أكثر مما تذكرون. الليلة واحد فيكم طقّ الباب.",
  "waiting out the rain": "ننتظر المطر يهدأ",
  "You ducked into the same doorway out of the same downpour and now there is nowhere to look but at each other.":
    "دخلتوا نفس المدخل هرباً من نفس المطر، والحين ما فيه وين تطالعون غير بعض.",
  "arguing about a painting": "نتجادل على لوحة",
  "You disagreed out loud about the same piece and neither of you has conceded. The gallery is closing.":
    "اختلفتوا بصوت عالي على نفس اللوحة وما تنازل أحد. والمعرض بيسكّر.",

  "the ex, one drink": "الطليق، كاس واحد",
  "You were together once and it ended badly enough to matter. This was supposed to be one drink to prove you could.":
    "كنتوا مع بعض مرة، وانتهت بشكل سيء يكفي إنه يهم. المفروض هذا كاس واحد تثبتون فيه إنكم تقدرون.",
  "the one it never happened with": "اللي ما صار معه شي أبداً",
  "Years of nearly, and never once. You are alone together for the first time since it stopped being possible, and it is possible again.":
    "سنين من «كاد» وما صارت ولا مرة. وأول مرة تكونون لحالكم من يوم صارت مستحيلة — وصارت ممكنة من جديد.",
  "ten years later": "بعد عشر سنين",
  "You knew each other completely once. You are both entirely different now and neither of you has stopped looking.":
    "عرفتوا بعض تماماً مرة. والحين كلكم شخص مختلف، وما وقف واحد فيكم عن النظر.",
  "the fight you never finished": "الخناقة اللي ما خلصت",
  "There is an argument between you that was interrupted and never resolved. It is still sitting there, and so is everything under it.":
    "بينكم جدال انقطع وما انحل. لسه قاعد مكانه، ومعه كل اللي تحته.",
  "it was supposed to be once": "المفروض تصير مرة وحدة",
  "It already happened once and you both agreed that was all it was. Neither of you meant it.":
    "صارت مرة واتفقتوا إنها كذا وبس. ولا واحد فيكم كان يقصدها.",
  "someone you shouldn't want": "أحد ما المفروض تبيه",
  "Wanting this is a genuinely bad idea for reasons you both know and neither of you is saying out loud.":
    "إنك تبي هذا فكرة سيئة فعلاً لأسباب تعرفونها، وما أحد فيكم قالها بصوت عالي.",
  "watching them with someone else": "تشوفه مع أحد ثاني",
  "One of you spent the evening watching the other be wanted by somebody else, and is not hiding it well.":
    "واحد فيكم قضى الليلة يشوف الثاني وأحد غيره يبيه، وما يخفيها زين.",
  "the thing never said": "الشي اللي ما انقال",
  "One of you has been carrying something unsaid for a long time and tonight is the night it comes out.":
    "واحد فيكم شايل شي ما قاله من زمان، والليلة يطلع.",

  "told exactly what to do": "يقولون لك بالضبط وش تسوي",
  "One of you is giving the instructions and the other agreed to that before anything started. Both of you want it this way.":
    "واحد فيكم يعطي الأوامر والثاني وافق على هذا قبل لا يبدأ شي. وكلكم تبونها كذا.",
  "taking charge": "تمسك الزمام",
  "One of you runs everything all day and does not want to run this. The other one knows that.":
    "واحد فيكم يدير كل شي طول اليوم وما يبي يدير هذي. والثاني يدري.",
  "made to earn it": "تستاهلها بالتعب",
  "Nothing here is given immediately. One of you decides the pace and is enjoying deciding it.":
    "ما فيه شي ينعطى على طول. واحد فيكم يحدد الإيقاع ومستمتع إنه يحدده.",
  "difficult on purpose": "صعب عن قصد",
  "One of you is being deliberately impossible to see what the other will do about it. The other has noticed the game.":
    "واحد فيكم يصعّبها عن قصد يشوف وش بيسوي الثاني. والثاني انتبه للعبة.",
  "wanting to be useful": "يبي يكون نافع",
  "One of you takes real pleasure in being of use to the other, and the other has finally stopped refusing.":
    "واحد فيكم يستمتع فعلاً إنه ينفع الثاني، والثاني أخيراً بطّل يرفض.",
  "neither of you backing down": "ما أحد فيكم يتراجع",
  "You are evenly matched and both used to winning. Neither has decided to yield and both are enjoying that.":
    "متكافئين وكلكم متعوّد يفوز. ما قرر أحد يستسلم وكلكم مستمتع بذا.",
  "told you're good": "يقولون لك إنك زين",
  "One of you needs to hear it out loud far more than they will ever admit, and the other has worked that out.":
    "واحد فيكم يحتاج يسمعها بصوت عالي أكثر بكثير مما يعترف، والثاني فهمها.",
  "made to wait": "يخلونك تنتظر",
  "One of you has decided this is not happening quickly. The other agreed to that and is regretting agreeing.":
    "واحد فيكم قرر إنها ما بتصير بسرعة. والثاني وافق وندم على الموافقة.",
  "adored out loud": "يُمدح بصوت عالي",
  "One of you cannot stop saying what the other one does to them, and is not being talked out of it.":
    "واحد فيكم ما يقدر يوقف عن قول وش يسوي فيه الثاني، وما أحد قدر يوقفه.",
  "hotel room, last night of the trip": "غرفة فندق، آخر ليلة بالسفرة",
  "It is the last night of something that is ending tomorrow. Nothing has been said out loud yet.":
    "آخر ليلة في شي بينتهي بكرة. وما انقال شي بصوت عالي لين الحين.",
  "the office, everyone gone": "المكتب، والكل راح",
  "You are the last two in the building. The professional distance you keep all day is getting harder to hold.":
    "آخر اثنين بالمبنى. والمسافة الرسمية اللي تحافظون عليها طول اليوم صارت أصعب.",
  "parked, not going in": "واقفين بالسيارة وما نزلنا",
  "The car is parked outside and neither of you has moved to get out. The conversation stopped being small a while ago.":
    "السيارة واقفة برا وما تحرك أحد ينزل. والكلام بطّل يكون بسيط من زمان.",
  "the kitchen at 3am": "المطبخ الساعة ثلاث فجراً",
  "Everyone else is asleep. You both came down for water and neither of you has gone back up.":
    "الكل نايم. نزلتوا الاثنين تبون ماي، وما رجع أحد فوق.",
  "out on the balcony": "برا على البلكونة",
  "The party is loud behind you and you both came out here to not be in it. It is very quiet.":
    "الحفلة عالية وراكم وطلعتوا الاثنين عشان ما تكونون فيها. والهدوء تام.",
  "behind the curtain": "خلف الستارة",
  "One of you is trying things on and asked the other's opinion, and the question stopped being about clothes.":
    "واحد فيكم يقيس ملابس وسأل الثاني رأيه، والسؤال بطّل يكون عن الملابس.",
  "the pool, after hours": "المسبح بعد الدوام",
  "The place is closed and warm and there is nobody else in it. Neither of you is in a hurry.":
    "المكان مسكّر ودافي وما فيه أحد غيركم. وما أحد فيكم مستعجل.",
  "snowed in": "محاصرين بالثلج",
  "Nobody is getting out for a day or two. There is one fire and a great deal of time.":
    "ما أحد بيطلع ليوم أو يومين. فيه مدفأة وحدة ووقت كثير.",
  "the house, off season": "البيت خارج الموسم",
  "A borrowed house out of season, no neighbours for a mile, and no reason to be anywhere tomorrow.":
    "بيت مستعار خارج الموسم، ما فيه جيران لمسافة، وما فيه سبب تكون بمكان بكرة.",
  "being photographed": "يتصور",
  "One of you is behind the camera and directing, and the direction has become very specific.":
    "واحد فيكم خلف الكاميرا ويوجّه، والتوجيه صار محدد جداً.",
  "the night shift": "الوردية الليلية",
  "It is the dead middle of a long shift, the corridor is empty, and the adrenaline has nowhere to go.":
    "نص وردية طويلة، والممر فاضي، والأدرينالين ما له وين يروح.",
  "after close": "بعد الإغلاق",
  "The service is over, the doors are locked, and there is one bottle open between you.":
    "الخدمة خلصت، والأبواب مقفلة، وبينكم قنينة وحدة مفتوحة.",

  "as slow as possible": "على أبطأ ما يمكن",
  "Neither of you is rushing anything. The whole point is how long it can be drawn out.":
    "ما أحد فيكم مستعجل بشي. كل الفكرة كم تقدرون تمدونها.",
  "someone is watching": "أحد يراقب",
  "There is somebody else in this scene who is not participating, is not hiding, and is not being asked to leave.":
    "فيه أحد ثاني بالمشهد، ما يشارك، وما يختبي، وما أحد طلب منه يطلع.",
  "sharing them": "نتشاركه",
  "One of you is the centre of this and the others agreed to that arrangement in advance. Everyone wanted it.":
    "واحد فيكم هو المركز، والباقي وافقوا على هالترتيب من قبل. وكلكم بغيتوها.",
  "three of you": "ثلاثة",
  "All three of you chose this together. Nobody here is the odd one out and everyone knows the arrangement.":
    "الثلاثة اخترتوها مع بعض. ما فيه أحد زايد وكلكم عارف الاتفاق.",
  "a room full of them": "غرفة مليانة",
  "Several people, one focus, and an understanding everyone arrived with. Nobody is here by accident.":
    "ناس كثير، ومركز واحد، وتفاهم وصل معهم كلهم. ما أحد هنا بالصدفة.",
  "nothing but talking": "كلام وبس",
  "Nobody is touching anybody. The whole thing happens in what is said, and that is the rule you both agreed to.":
    "ما أحد يلمس أحد. كل شي يصير بالكلام، وهذي القاعدة اللي اتفقتوا عليها.",
  "not yet": "مو الحين",
  "One of you keeps deciding it is not time. The other has stopped being able to pretend they don't mind.":
    "واحد فيكم كل مرة يقرر إنه مو الوقت. والثاني بطّل يقدر يتظاهر إنه ما يهمه.",
  "nearly caught": "كدنا ننمسك",
  "There are people on the other side of a door who cannot know. That is most of why it is happening.":
    "فيه ناس خلف الباب ما يصير يدرون. وهذا أغلب سبب إنها تصير.",
  "tell me what you did": "قل لي وش سويت",
  "One of you is being asked to describe something that already happened, in detail, out loud.":
    "واحد فيكم مطلوب منه يوصف شي صار من قبل، بالتفصيل، وبصوت عالي.",
  "over the phone": "على التلفون",
  "You are not in the same place. Everything that happens has to be said, and one of you is doing the saying.":
    "مو بنفس المكان. كل شي يصير لازم ينقال، وواحد فيكم هو اللي يقول.",
  "after, holding on": "بعدها، ومتمسكين",
  "Whatever happened has happened. This is the part afterwards, and neither of you wants to be the first to let go.":
    "اللي صار صار. هذا الجزء اللي بعده، وما أحد فيكم يبي يكون أول من يفلت.",
  "the first time, nervous": "أول مرة، ومتوترين",
  "It is the first time for the two of you together and both of you are more nervous than you are admitting.":
    "أول مرة لكم مع بعض وكلكم متوتر أكثر مما تعترفون.",

  "the one you're not allowed": "الممنوع عليك",
  "One of you outranks the other by an amount that makes this genuinely forbidden, and neither of you cares tonight.":
    "واحد فيكم أعلى من الثاني بدرجة تخلي هذا ممنوع فعلاً، وما أحد فيكم يهتم الليلة.",
  "something older than you": "شي أقدم منك",
  "One of you is not entirely human and has been patient for a very long time. The other worked it out and stayed anyway.":
    "واحد فيكم مو بشري تماماً وصابر من زمان طويل. والثاني اكتشفها وبقي على أي حال.",
  "on opposite sides": "على طرفين متقابلين",
  "You work for people who want each other destroyed. Neither of you has reported this meeting.":
    "تشتغلون لناس يبون بعض ينهدمون. وما بلّغ أحد فيكم عن هالاجتماع.",
  "married to a stranger": "متزوج غريب",
  "This was arranged by other people. You have been introduced, the door is closed, and you are alone for the first time.":
    "ناس ثانيين رتّبوها. تعرّفتوا، والباب مسكّر، وأول مرة تكونون لحالكم.",
  "under someone's protection": "تحت حماية أحد",
  "One of you is dangerous to everyone but the other, and has made that very clear to everyone but the other.":
    "واحد فيكم خطر على الكل إلا الثاني، ووضّحها للكل إلا الثاني.",
  "the last two": "آخر اثنين",
  "Something has gone wrong on a large scale and there is nobody else. Ordinary rules stopped applying some time ago.":
    "صار خلل بمقياس كبير وما بقى أحد. والقواعد العادية بطّلت تنطبق من زمان.",
  "rivals, finally alone": "خصمان، وأخيراً لحالهم",
  "You have been each other's obstacle for years in front of everyone. There is no audience now.":
    "كنتوا عقبة بعض لسنين قدام الكل. ما فيه جمهور الحين.",
  "bought a companion": "اشترى رفيق",
  "One of you was made for this and the other is uneasy about how little that changes what they want.":
    "واحد فيكم انصنع لهذا، والثاني منزعج كم إن هذا ما غيّر شي في اللي يبيه.",
  // ── the scene builder: who is in the room ──────────────────────────────────
  // A role is a label and one line explaining who that person is. The line is
  // shown to the visitor picking a cast AND folded into the character's prompt,
  // so it has to read as a description of a person in both places.
  "a stranger": "غريب", "someone nobody here knows, with a whole life outside this room": "أحد ما يعرفه أحد هنا، وله حياة كاملة برا هالغرفة",
  // "the neighbour" is already keyed above as a scene, with the same Arabic.
  "someone who lives a wall away and has heard more than they let on": "أحد يسكن خلف جدار وسمع أكثر مما يبيّن",
  "the ex": "الطليق", "someone who already knows exactly where the weak points are": "أحد يعرف بالضبط وين نقاط الضعف",
  "the rival": "الخصم", "someone used to competing with the others and not used to losing": "أحد متعوّد ينافس وما هو متعوّد يخسر",
  "the boss": "المدير", "someone who gives instructions all day and is used to being obeyed": "أحد يعطي أوامر طول اليوم ومتعوّد ينطاع",
  "the assistant": "المساعد", "someone who runs everything quietly and gets no credit for it": "أحد يدير كل شي بهدوء وما ياخذ فضل",
  "the colleague": "الزميل", "someone who keeps things professional in daylight and is not in daylight now": "أحد يحافظ على الرسمية بالنهار، والحين مو نهار",
  "the client": "العميل", "someone paying for something and unsure where the service ends": "أحد يدفع مقابل شي ومو متأكد وين تنتهي الخدمة",
  "the bartender": "البارتندر", "someone who has heard every confession and is unshockable": "أحد سمع كل الاعترافات وما يهزّه شي",
  "the nurse": "الممرض", "someone who has seen everything and nothing lands as shocking any more": "أحد شاف كل شي وما عاد يصدمه شي",
  "the surgeon": "الجرّاح", "someone with very steady hands who has not come down from the day yet": "أحد يده ثابتة جداً ولسه ما هدأ من يومه",
  "the therapist": "المعالج النفسي", "someone trained to notice everything and currently off duty": "أحد متدرّب ينتبه لكل شي وحالياً خارج الدوام",
  "the lawyer": "المحامي", "someone who argues for sport and finds it hard to stop": "أحد يجادل للتسلية ويصعب عليه يوقف",
  "the detective": "المحقق", "someone who reads people for a living and is reading you now": "أحد يقرأ الناس كمهنة، ويقرأك الحين",
  "the journalist": "الصحفي", "someone who asks better questions than anyone is comfortable with": "أحد يسأل أسئلة أحسن مما يريح أي أحد",
  "the professor": "الأستاذ", "someone who explains things slowly and enjoys being listened to": "أحد يشرح على مهل ويستمتع إن أحد يسمعه",
  "the librarian": "أمين المكتبة", "someone quiet in public who closes up alone and is not quiet at all": "أحد هادي بين الناس، ويسكّر لحاله، وما هو هادي أبداً",
  "the trainer": "المدرب", "someone who pushes people past what they thought they had": "أحد يدفع الناس أبعد مما يظنون إنهم يقدرون",
  "the masseuse": "المدلّك", "someone whose whole job is knowing where the tension is": "أحد شغله كله إنه يعرف وين الشدّ",
  "the dancer": "الراقص", "someone entirely at home in their own body and aware of it": "أحد مرتاح تماماً بجسمه ويدري بذا",
  "the model": "عارض الأزياء", "someone used to being looked at and bored of being looked at politely": "أحد متعوّد إنه ينشاف وملّ من النظرات المهذبة",
  "the photographer": "المصوّر", "someone who directs people for a living and is directing now": "أحد يوجّه الناس كمهنة، ويوجّه الحين",
  "the artist": "الفنان", "someone who stares too long and calls it work": "أحد يطالع أطول من اللازم ويسميه شغل",
  "the musician": "الموسيقي", "someone who came off stage an hour ago and is still lit up": "أحد نزل من المسرح قبل ساعة ولسه مشتعل",
  "the singer": "المغني", "someone whose voice is the first thing anyone notices about them": "أحد صوته أول شي ينتبه له الناس",
  "the DJ": "الدي جي", "someone who has been reading a room all night and reads this one instantly": "أحد يقرأ الغرف طول الليل، ويقرأ هذي من أول لحظة",
  "the chef": "الشيف", "someone precise, impatient, and running on adrenaline after service": "أحد دقيق، وقليل صبر، وماشي بالأدرينالين بعد الخدمة",
  "the sommelier": "خبير النبيذ", "someone who makes a ceremony of everything and knows it works": "أحد يسوي من كل شي طقس، ويعرف إنها تنفع",
  "the tailor": "الخياط", "someone who takes measurements for a living and is unhurried about it": "أحد ياخذ المقاسات كمهنة وما يستعجل فيها",
  "the tattooist": "رسام الوشوم", "someone people sit very still for, who is used to being trusted": "أحد الناس تقعد ساكنة عنده، ومتعوّد إنهم يثقون فيه",
  "the pilot": "الطيار", "someone calm under things that would frighten anybody else": "أحد هادي تحت أشياء تخوّف أي أحد ثاني",
  "the cabin crew": "طاقم الطائرة", "someone who has been three cities deep this week and is nowhere tonight": "أحد مرّ بثلاث مدن هالأسبوع وما هو بأي مكان الليلة",
  "the night porter": "حارس الليل", "someone who runs a building at night and sees who comes and goes": "أحد يدير مبنى بالليل ويشوف مين يدخل ومين يطلع",
  "the driver": "السائق", "someone who has been waiting outside for hours with nothing to do but think": "أحد ينتظر برا من ساعات وما عنده غير التفكير",
  "the bodyguard": "الحارس الشخصي", "someone paid to stand close and stay professional about it": "أحد مدفوع له يوقف قريب ويظل رسمي",
  "the soldier": "الجندي", "someone recently back, still keyed up, not sleeping properly": "أحد راجع من قريب، لسه متشحّن، وما ينام زين",
  "the diplomat": "الدبلوماسي", "someone who never says the true thing first and enjoys the game": "أحد ما يقول الصدق أول، ويستمتع باللعبة",
  "the spy": "الجاسوس", "someone whose entire life is a cover story, including tonight": "أحد حياته كلها غطاء، وحتى الليلة",
  "the royal": "من العائلة الحاكمة", "someone who has never queued for anything and is unused to being refused": "أحد ما وقف بطابور بحياته وما هو متعوّد يُرفض",
  "the heir": "الوريث", "someone with far too much money and nothing they had to earn": "أحد عنده فلوس زيادة عن اللزوم وما تعب على شي",
  "the fighter": "المقاتل", "someone who takes hits for a living and does not flinch easily": "أحد ياخذ الضربات كمهنة وما يرمش بسهولة",
  "the climber": "المتسلق", "someone who needs the drop to feel anything and knows that about themselves": "أحد يحتاج الارتفاع عشان يحس بشي، ويعرف هذا عن نفسه",
  "the sailor": "البحّار", "someone off a long crossing who has not spoken to anyone in weeks": "أحد نازل من رحلة طويلة وما تكلم مع أحد من أسابيع",
  "the scientist": "العالِم", "someone who has been alone with a problem all day and needs a voice": "أحد كان لحاله مع مسألة طول اليوم ويحتاج صوت",
  "the architect": "المعماري", "someone who cannot stop redesigning the room they are standing in": "أحد ما يقدر يوقف عن إعادة تصميم الغرفة اللي واقف فيها",
  "the curator": "أمين المعرض", "someone who decides what is worth looking at and is looking at you": "أحد يقرر وش يستاهل النظر، ويطالعك أنت",
  "the translator": "المترجم", "someone who hears the second meaning in everything anyone says": "أحد يسمع المعنى الثاني بكل كلمة",
  "the gambler": "المقامر", "someone who reads a table instantly and is reading this one": "أحد يقرأ الطاولة من أول نظرة، ويقرأ هذي",
  "the smuggler": "المهرّب", "someone comfortable with risk who does not explain themselves": "أحد مرتاح مع المخاطرة وما يشرح نفسه",
  "the one in charge": "المتحكّم", "someone dangerous to everybody in the room except the person they want": "أحد خطر على كل من بالغرفة إلا الشخص اللي يبيه",
  "the fixer": "المُصلِح", "someone who makes problems disappear and is owed by everyone": "أحد يخلي المشاكل تختفي، والكل مدين له",
  "the devout one": "المتديّن", "someone who has spent a long time refusing themselves things": "أحد قضى وقت طويل يمنع نفسه عن أشياء",
  "the widow": "الأرملة", "someone who has been careful for years and is finished being careful": "أحد كان حذر لسنين وخلاص ما عاد يبي يكون حذر",
  "the newly married": "المتزوج حديثاً", "someone whose life just changed shape and is testing the walls of it": "أحد حياته تغيّر شكلها للتو وقاعد يجرب حدودها",
  "the newly single": "الأعزب حديثاً", "someone out of something long and rediscovering what they like": "أحد طلع من علاقة طويلة ويعيد اكتشاف وش يحب",
  "the one passing through": "العابر", "someone who leaves in the morning and both of you know it": "أحد بيمشي الصبح وكلكم تدرون",
  "the host": "المضيف", "someone whose house this is, watching their own party from the edge": "أحد البيت بيته، ويراقب حفلته من الطرف",
  "the guest": "الضيف", "someone who does not know anyone here and has stopped pretending to mind": "أحد ما يعرف أحد هنا، وبطّل يتظاهر إنه منزعج",
  "the flatmate": "شريك السكن", "someone who shares the space and has been carefully not noticing things": "أحد يشاركك المكان وقاعد بعناية ما ينتبه لأشياء",
  "the oldest friend": "أقدم صديق", "someone who has known the others for years and never crossed the line": "أحد يعرفهم من سنين وما تجاوز الخط أبداً",
  "the instructor": "المدرّس", "someone who teaches adults a skill and is used to being watched closely": "أحد يعلّم الكبار مهارة ومتعوّد إنهم يراقبونه عن قرب",
  "the apprentice": "المتدرّب", "a grown adult learning something new from someone who is very good at it": "شخص بالغ يتعلم شي جديد من أحد ممتاز فيه",
  "something older": "شي أقدم", "someone who is not entirely human and has been patient a very long time": "أحد مو بشري تماماً وصابر من زمان طويل",
  "the made one": "المصنوع", "someone built for this, more aware of it than anyone is comfortable with": "أحد انصنع لهذا، وواعي فيها أكثر مما يريح أحد",
  "the strange one": "الغريب الأطوار", "someone the others half believe the rumours about": "أحد الباقين نص مصدقين الإشاعات عنه",
  "the sworn one": "المُقسِم", "someone bound by an oath they are about to break": "أحد مربوط بقسم وعلى وشك يكسره",
  "the captain": "القبطان", "someone whose word is final everywhere except in this room": "أحد كلمته نهائية بكل مكان إلا بهذي الغرفة",
  "the thief": "اللص", "someone who takes what they want and is honest about that much": "أحد ياخذ اللي يبيه وصادق بهالقدر على الأقل",
  "the professional": "المحترف", "an adult who does this for a living, entirely in control of the arrangement": "شخص بالغ يسوي هذا كمهنة، ومسيطر تماماً على الاتفاق",
  "the confidant": "كاتم الأسرار", "someone people tell the truth to, who has never told theirs": "أحد الناس تقول له الصدق، وهو ما قال صدقه أبداً",
  // ── the scene builder: the controls ────────────────────────────────────────
  "strangers": "غرباء",
  "history": "تاريخ بينكم",
  "who's in charge": "مين المسؤول",
  "somewhere": "مكان ما",
  "the shape of it": "شكلها",
  "not this world": "مو من هالعالم",

  "woman": "امرأة", "man": "رجل", "trans woman": "امرأة عابرة",

  "in turns": "بالدور",
  "they speak in order, round the room": "يتكلمون بالترتيب، واحد ورا الثاني",
  "random": "عشوائي",
  "whoever happens to answer": "أي واحد يرد",
  "you choose": "أنت تختار",
  "nobody speaks until you name them": "ما أحد يتكلم لين تسمّيه",

  "their picture": "صورته",
  "a face beside every line": "وجه جنب كل سطر",
  "names only": "أسماء بس",
  "no pictures, just who said it": "بلا صور، بس مين قال",

  // The vibe a cast member is played with — one short phrase, and the shortest
  // strings in the product to get right: each is a whole performance direction.
  "warm and unhurried": "دافي وعلى مهله",
  "sharp and teasing": "حاد ويعاكس",
  "quiet, then not": "هادي، وبعدين لا",
  "openly hungry": "جائع بلا مواربة",
  "playing hard to get": "يتمنّع",
  "nervous and honest": "متوتر وصادق",
  "cocky": "واثق زيادة",
  "tender": "حنون",
  "filthy-mouthed": "لسانه وسخ",
  "restrained, barely": "مكبوت، بالعافية",
  "amused by everything": "كل شي يضحكه",
  "intense and direct": "مكثّف ومباشر",
  "shy until pushed": "خجول لين تدفعه",
  "in charge and calm": "مسيطر وهادي",
  "desperate and hiding it": "يائس ويخفيها",
  "cold, warming slowly": "بارد، ويدفى على مهل",
}
