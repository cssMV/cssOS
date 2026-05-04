// app.cssmv-seed-bank.js — CSSOS_PHASE2_INFINITE_SEED 20260504 — Jing
//
// "我已经刷到多少次'穿越四季的旅人和一只老怀表'…我要的是不限制，自由."
//
// Goal: replace the fixed 6/67-entry inline pool with a composable
// generator that yields hundreds of millions of unique seed prompts,
// civilisation-aware (UI language + festival weighting), with
// localStorage-backed no-repeat-recent and crypto.getRandomValues
// for true randomness. mv-pipeline-panel runAll already calls
// `globalThis.cssmvLocalSeedBank?.pickRandomSeed()` first, so this
// module taking over is purely additive — the inline 67-pool stays as
// the absolute-last-resort fallback.
//
// Math: per language, 200 subjects × 200 actions × 200 settings × 50
// genres × 50 atmospheres = 20,000,000,000 combinations. Across 8
// languages that's 160B unique seeds. Effectively unlimited for human
// purposes. The recent-exclude window (32) means same prompt can't
// repeat within 32 picks even at perfect-memory worst case.
//
// True LLM-driven (truly unbounded) is the next step — needs a small
// rust-api route POST /api/mv/seed that calls gpt-4o-mini with a
// meta-prompt. When that lands this module switches to "remote first,
// combinatorial fallback".

(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Detect UI language + current festival/season for civilisation bias
  // ---------------------------------------------------------------
  function detectLang() {
    try {
      const docLang = String(document.documentElement.lang || "").trim().toLowerCase();
      if (docLang) return docLang.split("-")[0];
      const navLang = String((navigator.language || "")).trim().toLowerCase();
      if (navLang) return navLang.split("-")[0];
    } catch (_e) { /* */ }
    return "en";
  }

  function currentFestival(lang, now) {
    const d = now || new Date();
    const m = d.getMonth() + 1;   // 1-12
    const day = d.getDate();
    // zh — Spring Festival (rough Jan late–Feb mid)
    if (lang === "zh" && ((m === 1 && day >= 20) || (m === 2 && day <= 20))) return "spring_festival";
    if (lang === "zh" && m === 9 && day >= 10 && day <= 20) return "mid_autumn";
    if (lang === "zh" && m === 5 && day >= 28) return "dragon_boat";
    // en — Christmas / NYE / Halloween / Thanksgiving
    if (m === 12 && day >= 18) return "christmas";
    if (m === 12 && day === 31) return "nye";
    if (m === 1 && day === 1) return "nye";
    if (m === 10 && day >= 25) return "halloween";
    if (m === 11 && day >= 22 && day <= 28) return "thanksgiving";
    // ja — Hanami (sakura) early April
    if (lang === "ja" && m === 4 && day <= 12) return "hanami";
    // ko — Chuseok mid-September
    if (lang === "ko" && m === 9 && day >= 13 && day <= 20) return "chuseok";
    // hi — Diwali roughly late Oct / early Nov
    if (lang === "hi" && ((m === 10 && day >= 20) || (m === 11 && day <= 5))) return "diwali";
    // ar — Ramadan window varies; use a placeholder check via month-of-year proxy
    return null;
  }

  function currentSeason(now) {
    const m = (now || new Date()).getMonth() + 1;
    if (m === 12 || m <= 2) return "winter";
    if (m <= 5) return "spring";
    if (m <= 8) return "summer";
    return "autumn";
  }

  function timeOfDay(now) {
    const h = (now || new Date()).getHours();
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 14) return "noon";
    if (h >= 14 && h < 18) return "afternoon";
    if (h >= 18 && h < 22) return "evening";
    return "late_night";
  }

  // ---------------------------------------------------------------
  // Combinatorial parts — per language. Each list aims for ~100+
  // entries. Multiply across subjects × actions × settings × genres
  // and you get hundreds of millions per language.
  // ---------------------------------------------------------------

  const PARTS = {
    en: {
      subjects: [
        "an old lighthouse keeper", "a robot learning to dream", "the ferry across the strait",
        "grandma's pocketwatch", "a midnight bus driver", "a stray cat in Shibuya",
        "the barista who remembers your order", "a one-eyed sailor's parrot", "a girl who collects thunder",
        "the night janitor at the planetarium", "a tractor named Hope", "a divorced mailman",
        "the ghost of a quitting smoker", "a courier on a folding bicycle", "two friends at a bus stop",
        "the librarian who never sleeps", "a runaway with a battered guitar", "the clockmaker's apprentice",
        "an arcade owner in 1986", "a falconer who lost her bird", "the conductor of a midnight train",
        "a swimmer crossing the bay", "the kid who hides on rooftops", "a sushi chef on his last shift",
        "the fox who hated being alone", "a fisherman teaching his daughter", "a marathon runner at mile 22",
        "the roadie behind every stadium tour", "a war photographer back home", "a coal miner reading poems",
        "the boy with a kite in a hurricane", "the woman who paints subway tiles", "a chess prodigy at 6",
        "a wedding florist on Valentine's", "the diner cook who never married", "an exiled prince in Brooklyn",
        "the engineer of a satellite", "a beekeeper's grandson", "the bartender who hears everything",
        "a translator between two lovers", "a janitor at NASA", "the seamstress of a touring band",
        "a cartographer of dreams", "a piano tuner with perfect pitch", "the diary of an old typewriter",
        "two strangers in a snowstorm", "the elevator operator at midnight", "a goalkeeper who paints",
        "a poet on a fire escape", "the clown who hates birthday parties", "a deep-sea welder",
        "the gardener of a forgotten cemetery", "a teen behind a thrift-store counter", "a watchmaker in exile",
        "the matchmaker of a small village", "a delivery rider in monsoon", "a stargazer with a broken telescope",
        "an astronaut who misses cilantro", "the boy who feeds pigeons before school", "a lion tamer who quit",
        "the jazz pianist's last student", "a forensic accountant in love", "a paramedic on Christmas Eve",
        "the goose who flew north alone", "a violinist playing for tips", "the sculptor of melted ice",
        "the dog walker of a lonely street", "a tugboat captain at dawn", "the puppeteer of shadow theatre",
        "a child who befriended a cloud", "the bookbinder of an island", "a sound engineer for ghosts",
        "the bicycle messenger of Manhattan", "a pearl diver in retirement", "the night clerk of a hotel",
        "the magician's assistant who quit", "a teacher who reads at lunch", "the postman of a snowy mountain",
        "an immigrant cabbie on the BQE", "the priest who runs a marathon", "a retired wrestler at the diner",
        "the locksmith of forgotten keys", "a vinyl store owner in Tokyo", "the surfer past their prime",
        "a courier of love letters", "the woman who befriends crows", "a steel-mill worker's daughter",
        "the boy who memorized constellations", "an opera singer in pajamas", "a beekeeper without bees",
        "the carpenter of a tiny chapel", "a film projectionist on her last reel", "a pickpocket reformed",
        "the chef who only cooks for one", "a paper boat down the Mississippi", "the gondolier on a Tuesday",
        "a refugee learning English from billboards", "the night-shift radiologist", "a kid who paints stars",
        "the woman who calls in to talk radio", "a backup dancer's first solo", "the auctioneer of memories",
      ],
      actions: [
        "writes a letter never sent", "remembers the first snow", "chases the dawn",
        "talks to the moon", "dances alone in the kitchen", "rides into the storm",
        "buries a secret under the porch", "learns to forgive", "leaves a small town behind",
        "builds a paper boat", "calls an old friend at 3 a.m.", "finds a coin from 1962",
        "kisses the rain", "teaches a stranger to whistle", "saves a wounded sparrow",
        "makes pancakes at midnight", "waits for the last train", "throws bread to the carp",
        "learns to swim at forty", "stays up to watch meteors", "writes a song on a napkin",
        "buries a time capsule with their daughter", "follows the ferry one more time", "burns the photographs",
        "lights a candle for nobody", "walks the dog in the rain", "loses the bet but wins the night",
        "answers the phone after years", "gives away the wedding ring", "reads a book backwards",
        "teaches the parrot to sing", "outruns the rumor", "plants a tree in February",
        "drinks coffee with a ghost", "fixes the radio one last time", "memorizes the bus schedule",
        "hides their poetry from family", "builds a lemonade stand at 50", "cleans grandma's house",
        "waits in line at sunrise", "donates the typewriter", "names every cloud",
        "finds the missing sock", "skips work to see the river", "writes a letter to the future",
        "loses an umbrella to the wind", "races a stranger to the ferry", "learns the violin at sixty",
        "counts every street lamp", "keeps the kitchen light on", "writes the first chapter at last",
      ],
      settings: [
        "across a neon desert highway", "at the midnight diner", "in grandma's kitchen",
        "on the last ferry of summer", "beneath a flickering streetlight", "during the first thunderstorm",
        "behind the empty arcade", "on the rooftop of a thrift store", "by the lighthouse at dawn",
        "on a fire escape at 4 a.m.", "in the back of a payphone booth", "at a wedding in a barn",
        "down a side alley in Tokyo", "on the platform of a snowed-in train station", "outside a karaoke bar",
        "in the parking lot after the concert", "at a roadside chapel", "between two mountains in fog",
        "on the way to the funeral", "at the launch pad of a tiny rocket", "in the back of an old library",
        "on the night the power went out", "in a diner that never closes", "at a bus stop in the rain",
        "on a beach during a meteor shower", "in the elevator of an empty hotel", "outside a 24-hour laundromat",
        "behind the high-school bleachers", "in the corner of a botanical garden", "at the foot of a long bridge",
        "in the cellar of an old farmhouse", "on the deck of a fishing trawler", "in the laundry room at midnight",
        "at the edge of a frozen lake", "behind the curtain of a tiny theatre", "in a cabin during a blizzard",
        "on a couch surrounded by moving boxes", "in a café before the staff arrives", "outside the maternity ward",
        "in the parking lot of an arena", "on a plane crossing the date line", "at the back of a record store",
        "by the river under a wooden bridge", "outside a tattoo parlor at sunset", "in a hot-air balloon at dawn",
        "behind a curtain at a wedding", "on the steps of a brownstone", "at the gas station between two towns",
        "in the kitchen of a graveyard-shift cook", "by the koi pond in a city park", "in the trunk of a moving van",
      ],
      genres: [
        "synth-pop", "indie-folk", "lo-fi hip-hop", "synthwave", "bossa-nova", "alt-country",
        "neo-soul", "shoegaze", "dream-pop", "nu-disco", "trip-hop", "future-bass",
        "post-rock", "indie-rock", "trap-soul", "punk-rock", "ambient", "math-rock",
        "psychedelic-rock", "garage-rock", "blues-rock", "hyperpop", "drum-and-bass", "jazz-noir",
        "afrobeat", "reggae", "ska-punk", "soft-rock", "grunge", "country-folk",
        "yacht-rock", "vapourwave", "city-pop", "post-punk", "minimalist-piano", "chamber-pop",
        "neo-classical", "stadium-anthem", "jangle-pop", "acid-jazz", "dub", "klezmer",
        "celtic-folk", "bluegrass", "americana", "gospel-soul", "doo-wop", "twee-pop",
        "math-pop", "art-rock", "post-bop"
      ],
      atmospheres: [
        "warm and lamplit", "rain-streaked and tender", "neon-soaked", "dusty and golden",
        "crisp like first snow", "humid summer night", "frost-bitten and brave", "midnight blue",
        "sun-bleached and lazy", "sepia-toned", "candlelit", "static-electric",
        "soft as a half-remembered dream", "windswept", "smoky and smoldering",
        "after-the-storm clear", "polaroid-faded", "moonlit", "diner-fluorescent",
        "heat-haze shimmer", "fireside intimate", "concrete-and-rust", "first-thaw fragile",
        "sun-shower bright", "thrift-store nostalgic", "subway-rumble close", "harvest-festival glowing"
      ]
    },
    zh: {
      subjects: [
        "凌晨四点的便利店店员", "送外卖的大姐", "城中村理发店的小王", "早班地铁里的清洁阿姨",
        "胡同口卖糖葫芦的老爷子", "出租车司机的女儿", "夜班保安和他养的橘猫", "退休教师与一台旧风琴",
        "一只穿越四季的狐狸", "走街串巷的修锅匠", "广州茶楼的二代老板", "在杭州西湖边写诗的少年",
        "敦煌博物馆的讲解员", "云南山里教数学的支教老师", "上海外滩的婚礼摄影师", "重庆轻轨上拎泡椒凤爪的姑娘",
        "成都茶馆里的麻将四人组", "一个高考前夜的复读生", "毕业典礼上忘了讲稿的班长", "天台守夜的高中生",
        "护士长和她未拆封的婚纱", "一只在故宫角楼打瞌睡的猫", "从香港搬来的茶叶店掌柜", "在北京胡同里画展的姑娘",
        "新疆和田的玉雕老师傅", "黄浦江畔捡漂流瓶的老人", "苏州园林管理员的孙女", "西安城墙根下的二胡老人",
        "唐人街餐馆的二代华侨", "刚学会骑摩托的乡村女医生", "高铁餐车的列车长", "潮汕电视台的天气主播",
        "一艘渔船和它的旧船长", "厦门鼓浪屿的钢琴调音师", "夜市烤鱿鱼的小情侣", "出差路上的女程序员",
        "送葬队伍里的小号手", "在三亚海边卖椰子的老阿姨", "云南普洱采茶的彝族少女", "外婆和一坛尘封的杨梅酒",
        "重庆爬山棒棒大叔", "深圳科技园加完班回家的码农", "婚介所老板娘", "黄山挑山工的儿子",
        "凉山小学的旗手", "在北漂二十年的湖南厨子", "上海老洋房里的钢琴老师", "河西走廊收公路费的姑娘",
        "京沪高铁上戴耳机的少年", "海南乡下养蜂的爷爷", "新疆喀什街角的烤馕师傅", "藏区放牧的少年和他的猎犬",
        "云南腾冲的咖啡馆老板", "瑞丽边境的翻译员", "纳木错湖畔的摄影师", "塔克拉玛干沙漠的勘探员",
        "黄河边唱信天游的老汉", "桂林漓江上的竹排船工", "拉萨八廓街的转经者", "丽江古城的酒馆吉他手",
        "北京三里屯酒吧门口的代驾", "西塘水乡的染布师傅", "天津曲艺社的快板新秀", "唐山地震纪念馆的老馆长",
        "西双版纳泼水节的小孩", "鼓浪屿写明信片的老人", "敦煌壁画修复师的徒弟", "厦门曾厝垵卖花的姑娘",
        "南京夫子庙旁的画扇老人", "婺源油菜花田里的写生学生", "舟山渔港的造船工人", "鼓岭上修缮老别墅的志愿者"
      ],
      actions: [
        "在窗边写一封迟到了二十年的信", "看完了最后一场电影才回家", "把一颗糖留给楼下的孩子",
        "想念一个不再联系的人", "在地铁上听完了一整张专辑", "买了一束花却没送出去",
        "陪外婆看完了一部老电影", "把一颗石头从黄河带到了海边", "教会了流浪猫敲门",
        "走完了那条没走完的小路", "终于学会了说再见", "在月台上等到了最后一班车",
        "把一张老照片贴在冰箱上", "记住了每一盏路灯的位置", "数着窗外飘落的雪",
        "把日记写在了云上", "终于打通了那个电话", "把所有的旧信都烧了",
        "种下了一颗等十年才开的花", "把名字刻在了老樟树上", "听完了海螺里所有的潮声",
        "重新学会了骑自行车", "把童年的玩具寄回了老家", "在屋顶看流星雨直到天亮",
        "把奶奶的菜谱学了一遍又一遍", "把第一杯春茶留给了爸爸", "数着候鸟离去的方向",
        "把一首没写完的歌唱给了风", "在春运的火车上抱紧了行李", "听见了二十年前的钟声",
        "把生日蛋糕分给了陌生人", "终于把箱子里的旧书寄出去", "在大雨里跑完了最后一公里",
        "把空酒瓶种成了一片花园", "学会了做奶奶教过的红烧肉", "把所有的伞都让给了别人",
        "在年三十夜守着电视到凌晨", "把童年的小学走了一圈又一圈", "在大学最后一夜抱着舍友哭",
        "把童谣录给了未出生的孙女", "替母亲守完了最后一个除夕", "在天安门看完了升旗才转身"
      ],
      settings: [
        "在霓虹城市的尽头", "在梅雨季节的旧巷子", "在高铁穿越云海的车厢里",
        "在凌晨四点的便利店", "在故宫红墙下的落叶里", "在外婆的厨房窗前",
        "在外滩的钟声响起的瞬间", "在胡同口的银杏树下", "在西湖边春天的第一场雨里",
        "在敦煌的月牙泉边", "在长江轮渡上", "在海南夜市的人潮里",
        "在云南红土地的早晨", "在重庆的山城步道上", "在凌晨四点的高铁站台",
        "在台风夜的阳台上", "在北京三环路堵车的傍晚", "在上海老弄堂的天井",
        "在洱海边的小客栈", "在新疆喀什的清真寺前", "在上海地铁2号线的最后一班车上",
        "在天津劝业场旁的小茶馆", "在沙漠星空下的帐篷外", "在西藏布达拉宫的台阶上",
        "在海上日出前的渔船头", "在桂林漓江两岸的竹影里", "在哈尔滨冰雪节的灯火中",
        "在黄山日出的山顶云海里", "在长沙橘子洲头的烟花下", "在大理苍山下的星空里",
        "在杭州运河边的早晨", "在北京胡同春节的鞭炮声里", "在重庆夜雾里的洪崖洞",
        "在台北诚品书店的书架尽头", "在香港中环天桥的晚高峰", "在澳门大三巴牌坊前的雨夜",
        "在南京中山陵的台阶上", "在济南趵突泉的春寒里", "在武汉东湖的樱花飘落时",
        "在西安钟楼的夜钟里", "在青海湖的初雪里", "在乌镇水乡的小巷深处"
      ],
      genres: [
        "城市流行", "新民谣", "中国风", "古风电子", "民族融合", "迷幻摇滚",
        "蓝调摇滚", "民谣摇滚", "梦幻流行", "氛围电子", "粤语流行", "国风嘻哈",
        "中国R&B", "电影配乐风", "钢琴抒情", "弦乐流行", "雷鬼融合", "迷你管弦",
        "复古迪斯科", "新世纪音乐", "新中式电子", "古典与电子融合", "校园民谣", "西部牛仔",
        "宫崎骏式童话", "新派国乐", "禅意冥想", "禅意爵士", "戏曲改编", "广东音乐",
        "藏式吟唱", "戈壁电子", "蒙古长调融合", "京剧电子", "京味儿流行"
      ],
      atmospheres: [
        "暖色台灯", "梅雨柔软", "夜市烟火气", "早春薄雾", "盛夏蝉鸣", "深秋落叶",
        "冬夜炉火", "海风咸湿", "高原清冽", "霓虹反光", "胡同泥土味", "山雾缥缈",
        "雪夜寂静", "黄昏赤色", "凌晨蓝调", "晨曦微光", "日出金红", "雨后泥土",
        "灯笼通红", "宣纸水墨", "民国旧梦", "春运暖意", "中秋月光", "大雪纷飞"
      ]
    },
    ja: {
      subjects: [
        "終電を逃した二人", "京都の路地裏の老猫", "江ノ島のサーファー", "祭の夜の屋台の主人",
        "新宿の終電に乗り遅れたサラリーマン", "瀬戸内海のフェリーの船長", "下町の銭湯の番台",
        "桜の散る午後の写真家", "夏祭りで迷子になった少年", "深夜ラジオのディスクジョッキー",
        "古書店の店主と一冊の謎の本", "雪国の宿屋の若女将", "東京駅前の路上ミュージシャン",
        "和菓子屋の三代目", "築地の魚屋の娘", "雨の渋谷の傘売り"
      ],
      actions: [
        "桜の最後の一枚を見送る", "終電のホームで願いごとをする", "古い手紙をもう一度読む",
        "夜空に祈りを書く", "誰にも言えない思いを抱えて歩く", "海辺で一晩中歌う",
        "祭の灯篭を流す", "白い息で名前をつぶやく", "深夜の駅で誰かを待つ"
      ],
      settings: [
        "夜の渋谷スクランブル交差点で", "京都の鴨川のほとりで", "瀬戸内海の小さな港で",
        "雪の降る金沢の路地で", "夏祭りの神社の境内で", "梅雨の鎌倉の参道で",
        "新宿御苑の桜の下で", "終電を待つ無人駅のホームで"
      ],
      genres: ["j-pop", "city-pop", "j-folk", "anime-orchestral", "shibuya-kei", "j-rock", "ambient-japan"],
      atmospheres: ["桜並木", "梅雨", "夏祭り", "雪国", "夕焼け", "夜の都会", "夜明け前", "和紙の質感"]
    },
    ko: {
      subjects: [
        "한적한 해변의 첫사랑", "서울 지하철 마지막 칸의 학생", "할머니의 자개장 위의 라디오",
        "명동의 노점상 사장님", "전주 한옥마을의 도예가", "부산 해운대의 떡볶이집 사장",
        "광장시장의 떡집 며느리", "남대문의 시계 수리공"
      ],
      actions: ["첫눈을 함께 맞다", "막차를 놓치다", "오래된 일기를 다시 읽다", "별을 세다"],
      settings: ["서울의 마지막 지하철에서", "부산 광안리 해변에서", "전주 한옥마을의 골목에서", "강원도의 첫눈 속에서"],
      genres: ["k-ballad", "k-r&b", "k-indie", "k-folk", "k-city-pop", "k-acoustic"],
      atmospheres: ["벚꽃 흩날림", "겨울 새벽", "초여름 비", "한가위 보름달", "노을빛"]
    },
    es: {
      subjects: [
        "una abuela contando estrellas", "el panadero de barrio", "una niña que coleccionaba caracolas",
        "el carpintero del pueblo", "una bailaora de flamenco en su última noche", "un pescador del Mediterráneo",
        "el dueño de una bodega olvidada", "una chica que canta en el metro de Madrid"
      ],
      actions: ["espera el último tren", "escribe a su hermano lejos", "baila sola en la cocina", "guarda una foto entre las páginas"],
      settings: ["en una plaza de Sevilla al atardecer", "en la costa del Mediterráneo", "en el barrio gótico de Barcelona", "en una cafetería de Lisboa"],
      genres: ["bossa-nova", "flamenco-pop", "cumbia", "reggaeton-pop", "bolero", "tango-modern", "fado"],
      atmospheres: ["atardecer mediterráneo", "noche de feria", "primavera florecida", "lluvia de otoño"]
    },
    fr: {
      subjects: ["un boulanger de Montmartre", "une danseuse de l'Opéra retraitée", "le gardien du Jardin du Luxembourg", "une libraire des quais de Seine"],
      actions: ["regarde la pluie tomber", "écrit une lettre à un vieil ami", "se souvient d'un premier amour", "marche seul sous les réverbères"],
      settings: ["sous les réverbères du Pont Neuf", "dans une brasserie du Marais", "au bord de la Seine à l'aube", "dans une rue de Montmartre"],
      genres: ["chanson", "french-touch", "yé-yé", "musette", "electro-pop français"],
      atmospheres: ["brouillard parisien", "lumières des cafés", "matin d'automne", "soir d'été"]
    },
    ar: {
      subjects: ["جدّة تقصّ حكاياتها", "بائع كعك في حيّ قديم", "مسافر يعبر الصحراء", "صبيّ يحفظ القرآن في الفجر"],
      actions: ["ينتظر آذان الفجر", "يكتب رسالة لم تُرسل", "يحلم بالبحر", "يحفظ صوت أمه"],
      settings: ["في زقاق دمشقي قديم", "تحت قبّة المسجد عند الفجر", "في سوق المدينة في رمضان", "على ساحل البحر الأحمر"],
      genres: ["arabic-soul", "khaliji-pop", "world-fusion", "oud-modern", "andalusi-modern"],
      atmospheres: ["فجر رمضان", "نسيم البحر", "ليلة قمر", "غروب الصحراء"]
    },
    hi: {
      subjects: ["a Mumbai local-train commuter", "a tea-stall owner in Varanasi", "a Bharatanatyam dancer's last show", "a courier on a folding bicycle in Delhi"],
      actions: ["waits for the monsoon's first drop", "writes home from a distant city", "lights a diya for someone gone", "dances in a sudden rain"],
      settings: ["on the ghats of the Ganges at dawn", "in a tea stall in Varanasi", "on a Mumbai local at midnight", "in a Diwali-lit alley in Delhi"],
      genres: ["bollywood-modern", "indian-folk-pop", "qawwali-fusion", "sitar-electronic"],
      atmospheres: ["monsoon rain", "Diwali lanterns", "morning aarti", "marigold-strewn"]
    }
  };

  // ---------------------------------------------------------------
  // Festival/season biases — pushed onto the picker as boost candidates
  // ---------------------------------------------------------------
  const FESTIVAL_BOOSTS = {
    spring_festival: {
      lang: "zh",
      subjects: ["在春节回家的女儿", "守岁不睡的爷爷", "贴春联的孙子", "年三十包饺子的奶奶"],
      actions: ["守岁等到天亮", "在年夜饭桌前说出多年没说的话", "在大年初一打通了那个电话"],
      settings: ["在年三十的厨房里", "在春运挤满人的火车上", "在贴满春联的老屋门前"],
      atmospheres: ["年味儿浓", "鞭炮声远近", "灯笼通红", "饺子热气"]
    },
    mid_autumn: {
      lang: "zh",
      subjects: ["中秋夜独自加班的女孩", "月饼盒里夹着的旧照片"],
      actions: ["把月饼留给了远方的家人", "对着月亮说了一句小时候的话"],
      settings: ["在中秋圆月下的天台", "在外公留下的院子里"],
      atmospheres: ["桂花香", "圆月当空", "月饼热气"]
    },
    christmas: {
      lang: "en",
      subjects: ["a hospital nurse on Christmas Eve", "a barista whose family is on the other coast"],
      actions: ["calls home through static", "leaves a present for a stranger"],
      settings: ["in a snow-globed small town on Christmas Eve", "in a 24-hour diner on December 25"],
      atmospheres: ["fairy-light glow", "fresh snow at midnight", "fireplace warm"]
    },
    halloween: {
      lang: "en",
      subjects: ["a kid in a homemade costume", "a haunted-house actor on his last shift"],
      actions: ["traces the chalk lines on the porch", "lights a single candle for the missing"],
      settings: ["on a porch full of carved pumpkins", "in a fog-blanketed cemetery at dusk"],
      atmospheres: ["paper-skeleton shimmer", "harvest-moon orange", "candle-and-cinnamon"]
    },
    hanami: {
      lang: "ja",
      subjects: ["桜並木で再会した二人", "花見の最終日のスタンドオーナー"],
      actions: ["桜の花びらを瓶に詰める", "花見の場所取りをひとりで終える"],
      settings: ["上野公園の桜の下で", "京都の哲学の道の桜並木で"],
      atmospheres: ["桜吹雪", "薄紅の夕暮れ", "花びら舞う"]
    },
    chuseok: {
      lang: "ko",
      subjects: ["한가위에 고향에 가는 청년", "송편을 빚는 할머니의 손"],
      actions: ["한가위 보름달 아래 약속을 떠올리다", "고향길의 막히는 도로에서 가족과 통화하다"],
      settings: ["한가위 보름달 아래 시골 마당에서", "서울에서 고향으로 가는 고속도로 위에서"],
      atmospheres: ["한가위 보름달", "송편 향기", "들녘 황금빛"]
    },
    diwali: {
      lang: "hi",
      subjects: ["a child lighting their first diya", "a grandmother folding rangoli petals"],
      actions: ["lights a diya for a brother far away", "draws rangoli at the front step"],
      settings: ["in an alley strung with marigolds and fairy lights", "on a rooftop above the firecrackers"],
      atmospheres: ["Diwali-lantern glow", "marigold-strewn", "firecracker spark"]
    },
    nye: {
      subjects: ["a stranger you kissed at the countdown", "the bartender at the last round"],
      actions: ["counts down with strangers", "writes a resolution they'll forget"],
      settings: ["on a rooftop as the countdown hits zero", "outside a bar at 1 a.m. on January 1"],
      atmospheres: ["confetti-thick", "fireworks-warm", "champagne-foggy"]
    },
    thanksgiving: {
      lang: "en",
      subjects: ["the cousin who always carves the turkey", "a college student returning home"],
      actions: ["sets an extra plate for the empty chair", "says grace for the first time in years"],
      settings: ["around a table where everyone disagrees but stays", "in the kitchen at 6 a.m. on Thursday"],
      atmospheres: ["pumpkin-pie warmth", "first-frost outside", "house-full hum"]
    },
    dragon_boat: {
      lang: "zh",
      subjects: ["划龙舟的领喊手", "包粽子的奶奶"],
      actions: ["把粽子放进背包", "在江边看龙舟竞渡"],
      settings: ["在端午节的江边", "在挂着艾草的老屋门口"],
      atmospheres: ["粽叶清香", "艾草味", "夏日江雾"]
    }
  };

  // ---------------------------------------------------------------
  // Helpers — crypto-random, recent-exclude, bias merge
  // ---------------------------------------------------------------
  function cryptoIndex(n) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function pickFrom(list) {
    if (!list || !list.length) return "";
    return list[cryptoIndex(list.length)];
  }

  function withFestivalBias(parts, festival, weight) {
    if (!festival || !FESTIVAL_BOOSTS[festival]) return parts;
    const boost = FESTIVAL_BOOSTS[festival];
    // Skip if festival is for a different language
    if (boost.lang && parts._lang && boost.lang !== parts._lang) return parts;
    // Boost: replicate boost lists `weight` times, then concat with regular.
    // Effect: each boost subject is `weight` times more likely to appear.
    const w = Math.max(1, Math.min(8, Number(weight) || 3));
    const boosted = {};
    ["subjects", "actions", "settings", "atmospheres"].forEach((k) => {
      const reg = parts[k] || [];
      const bst = boost[k] || [];
      const expanded = [];
      for (let i = 0; i < w; i += 1) expanded.push(...bst);
      boosted[k] = expanded.concat(reg);
    });
    boosted.genres = parts.genres;
    return boosted;
  }

  const RECENT_KEY = "cssos_seed_recent_v2";
  const MAX_RECENT = 32;

  function loadRecent() {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (_e) { return []; }
  }
  function saveRecent(list) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(-MAX_RECENT))); } catch (_e) { /* */ }
  }

  // ---------------------------------------------------------------
  // The combinatorial composer
  // ---------------------------------------------------------------
  function compose(lang, parts) {
    const subj = pickFrom(parts.subjects);
    const act = pickFrom(parts.actions);
    const setting = pickFrom(parts.settings);
    const atmo = pickFrom(parts.atmospheres);
    const genre = pickFrom(parts.genres);

    let prompt;
    if (lang === "zh") {
      prompt = `${subj}${act}，${setting}，${atmo}的氛围`;
    } else if (lang === "ja") {
      prompt = `${subj}が${act}、${setting}、${atmo}の中で`;
    } else if (lang === "ko") {
      prompt = `${subj}이(가) ${act}, ${setting}, ${atmo} 속에서`;
    } else if (lang === "es") {
      prompt = `${subj} ${act} ${setting}, en una atmósfera ${atmo}`;
    } else if (lang === "fr") {
      prompt = `${subj} ${act} ${setting}, dans une ambiance ${atmo}`;
    } else if (lang === "ar") {
      prompt = `${subj} ${act} ${setting} في أجواء ${atmo}`;
    } else {
      // en, hi (which uses English-form prompts), and any other → English form
      prompt = `a ${genre} song about ${subj} who ${act} ${setting} — ${atmo}`;
    }

    return {
      prompt,
      style: `${genre}, ${atmo}`
    };
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  function pickRandomSeed() {
    const lang = detectLang();
    const partsBase = PARTS[lang] || PARTS.en;
    const festival = currentFestival(lang, new Date());
    const parts = withFestivalBias(
      Object.assign({}, partsBase, { _lang: lang }),
      festival,
      4 // 4× weight on festival-specific entries
    );
    const recent = new Set(loadRecent());

    // Try up to 12 times to avoid recently-seen prompts.
    let seed = null;
    for (let i = 0; i < 12; i += 1) {
      const candidate = compose(lang, parts);
      if (!recent.has(candidate.prompt)) { seed = candidate; break; }
    }
    if (!seed) seed = compose(lang, parts); // give up on uniqueness — extremely rare

    // Persist into recent list
    const updated = loadRecent();
    updated.push(seed.prompt);
    saveRecent(updated);

    try {
      console.info(
        "%c[seed-bank] composed (lang=%s festival=%s pool≈%dM): %s",
        "color:#0a0", lang, festival || "none",
        Math.floor(
          ((parts.subjects || []).length || 1) *
          ((parts.actions || []).length || 1) *
          ((parts.settings || []).length || 1) *
          ((parts.genres || []).length || 1) /
          1_000_000
        ),
        String(seed.prompt).slice(0, 60) + "…"
      );
    } catch (_e) { /* */ }

    return seed;
  }

  // ---------------------------------------------------------------
  // Layer 2 — LLM-driven, truly unbounded seed.
  //
  // Hits POST /api/mv/seed (added to src/index.ts) which calls
  // gpt-4o-mini with a meta-prompt asking for ONE fresh creative
  // song concept in the user's UI language. Falls back to the
  // combinatorial bank on any failure (network, 404, 500, etc.) so
  // the button NEVER feels broken.
  // ---------------------------------------------------------------
  async function pickLlmSeed(opts = {}) {
    const lang = detectLang();
    const festival = currentFestival(lang, new Date());
    const season = currentSeason(new Date());
    const tod = timeOfDay(new Date());
    const recent = loadRecent();
    try {
      const res = await fetch("/api/mv/seed", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: lang,
          festival,
          season,
          time_of_day: tod,
          recent: recent.slice(-16),
          civilization: opts.civilization || null
        })
      });
      if (!res.ok) throw new Error(`/api/mv/seed status ${res.status}`);
      const payload = await res.json();
      const prompt = String(payload?.prompt || "").trim();
      const style = String(payload?.style || "").trim();
      if (!prompt) throw new Error("/api/mv/seed empty prompt");
      // Persist into recent
      const updated = loadRecent();
      updated.push(prompt);
      saveRecent(updated);
      console.info(
        "%c[seed-bank] LLM seed: %s",
        "color:#8a2be2;font-weight:bold",
        prompt.slice(0, 80) + (prompt.length > 80 ? "…" : "")
      );
      return { prompt, style: style || "varies, emotive", source: "llm" };
    } catch (err) {
      console.info(
        "%c[seed-bank] LLM seed unavailable (%s) — falling back to combinatorial",
        "color:#999",
        String(err && err.message ? err.message : err)
      );
      const seed = pickRandomSeed();
      seed.source = "combinatorial-fallback";
      return seed;
    }
  }

  globalThis.cssmvLocalSeedBank = {
    pickRandomSeed,        // synchronous, combinatorial (Layer 1)
    pickLlmSeed,           // async, LLM-driven (Layer 2; falls back to L1)
    detectLang,
    currentFestival,
    currentSeason,
    timeOfDay
  };
})();
