(function initWatchFontManifest(global){
  const entries = [
  {
    "family": "HengShanMaoBiCaoShu",
    "src": "fonts/HengShanMaoBiCaoShu.ttf",
    "format": "truetype"
  },
  {
    "family": "AQUARIUM",
    "src": "fonts_en/AQUARIUM-2.otf",
    "format": "opentype"
  },
  {
    "family": "Acmedia",
    "src": "fonts_en/Acmedia-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AidianSignatureTi",
    "src": "fonts_en/AidianSignatureTi-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AliceInWonderland",
    "src": "fonts_en/AliceInWonderland-1GzL0-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Alien",
    "src": "fonts_en/Alien-2.otf",
    "format": "opentype"
  },
  {
    "family": "Alison",
    "src": "fonts_en/Alison-finch-2.otf",
    "format": "opentype"
  },
  {
    "family": "Allianty",
    "src": "fonts_en/Allianty-2.otf",
    "format": "opentype"
  },
  {
    "family": "AlloefiraForPersonal",
    "src": "fonts_en/AlloefiraFreeForPersonal-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Alter",
    "src": "fonts_en/Alter-Bridge-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amattera",
    "src": "fonts_en/Amattera-Million-2.otf",
    "format": "opentype"
  },
  {
    "family": "Amberllee",
    "src": "fonts_en/Amberllee-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amelline",
    "src": "fonts_en/Amelline-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amerilatte",
    "src": "fonts_en/AmerilatteDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Amiela",
    "src": "fonts_en/Amiela-2.otf",
    "format": "opentype"
  },
  {
    "family": "Andromeda",
    "src": "fonts_en/Andromeda-0WGzd-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Angellita",
    "src": "fonts_en/Angellita-demo-2.otf",
    "format": "opentype"
  },
  {
    "family": "Anthony",
    "src": "fonts_en/Anthony-Houston-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AnytimeSoon",
    "src": "fonts_en/AnytimeSoonDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Apple Kids",
    "src": "fonts_en/Apple-Kids-2.otf",
    "format": "opentype"
  },
  {
    "family": "Artisual Deco",
    "src": "fonts_en/Artisual-Deco-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ashburton",
    "src": "fonts_en/Ashburton-MVGKJ-2.otf",
    "format": "opentype"
  },
  {
    "family": "Asmelina",
    "src": "fonts_en/Asmelina-Harley-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AulionItalic",
    "src": "fonts_en/AulionDemoItalic-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Aulion",
    "src": "fonts_en/AulionDemoRegular-3.ttf",
    "format": "truetype"
  },
  {
    "family": "Aurum Script",
    "src": "fonts_en/Aurum-Script-Free-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Austin",
    "src": "fonts_en/Austin-Hearts-2.otf",
    "format": "opentype"
  },
  {
    "family": "Authentica",
    "src": "fonts_en/Authentica-2.otf",
    "format": "opentype"
  },
  {
    "family": "Avaca",
    "src": "fonts_en/Avaca-Davra-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AvocadoDiet",
    "src": "fonts_en/AvocadoDietDemo-JRBBB-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Avondale",
    "src": "fonts_en/Avondale-Sample-2.otf",
    "format": "opentype"
  },
  {
    "family": "Ayanalove",
    "src": "fonts_en/Ayanalove-2.otf",
    "format": "opentype"
  },
  {
    "family": "BackToSchool",
    "src": "fonts_en/BackToSchoolPersonalUseRegular-w1xX2-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Backrush",
    "src": "fonts_en/Backrush-2.otf",
    "format": "opentype"
  },
  {
    "family": "Badlooking",
    "src": "fonts_en/Badlooking-Brush-2.otf",
    "format": "opentype"
  },
  {
    "family": "Bagsman",
    "src": "fonts_en/BagsmanDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Balinesse",
    "src": "fonts_en/Balinesse-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Baliung",
    "src": "fonts_en/Baliung-2.otf",
    "format": "opentype"
  },
  {
    "family": "Balkous",
    "src": "fonts_en/Balkous-FREE-2.otf",
    "format": "opentype"
  },
  {
    "family": "Balymond",
    "src": "fonts_en/Balymond-2.ttf",
    "format": "truetype"
  },
  {
    "family": "BarbieScript",
    "src": "fonts_en/BarbieScript-gxYjP-2.otf",
    "format": "opentype"
  },
  {
    "family": "BattomGlory",
    "src": "fonts_en/BattomGlory-p7Ryy-2.otf",
    "format": "opentype"
  },
  {
    "family": "Battur",
    "src": "fonts_en/Battur-demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Beauty",
    "src": "fonts_en/Beauty-Boutique-2.otf",
    "format": "opentype"
  },
  {
    "family": "Beguns",
    "src": "fonts_en/Beguns-FREE-2.otf",
    "format": "opentype"
  },
  {
    "family": "Belianty",
    "src": "fonts_en/Belianty-Elesha-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Belinda",
    "src": "fonts_en/Belinda-Heylove-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Bellamy",
    "src": "fonts_en/Bellamy-Stevenson-2.otf",
    "format": "opentype"
  },
  {
    "family": "Berthessa",
    "src": "fonts_en/Berthessa-2.otf",
    "format": "opentype"
  },
  {
    "family": "Bintank",
    "src": "fonts_en/Bintank-PersonalUse-2.otf",
    "format": "opentype"
  },
  {
    "family": "Blackish",
    "src": "fonts_en/Blackish-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Blogh",
    "src": "fonts_en/Blogh-2.otf",
    "format": "opentype"
  },
  {
    "family": "Bold Ish",
    "src": "fonts_en/Bold-Ish-Demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "BoldnessRace",
    "src": "fonts_en/BoldnessRace-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Brevard",
    "src": "fonts_en/BrevardDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Brightons",
    "src": "fonts_en/Brightons-2.otf",
    "format": "opentype"
  },
  {
    "family": "Brilganttyne",
    "src": "fonts_en/Brilganttyne-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Brogetta",
    "src": "fonts_en/BrogettaRegular-ZV5EK-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Bugis",
    "src": "fonts_en/Bugis-2.ttf",
    "format": "truetype"
  },
  {
    "family": "California sun",
    "src": "fonts_en/California-sun-2.otf",
    "format": "opentype"
  },
  {
    "family": "Capuche",
    "src": "fonts_en/Capuche-Trial-2.otf",
    "format": "opentype"
  },
  {
    "family": "Carnallians",
    "src": "fonts_en/CarnalliansDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "CastilloSignature",
    "src": "fonts_en/CastilloSignature-rgaey-2.otf",
    "format": "opentype"
  },
  {
    "family": "Cathena",
    "src": "fonts_en/Cathena-vmKE7-2.otf",
    "format": "opentype"
  },
  {
    "family": "Celistyne",
    "src": "fonts_en/CelistyneDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "CharlieKayden",
    "src": "fonts_en/CharlieKaydenDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Chedaty",
    "src": "fonts_en/Chedaty-2.otf",
    "format": "opentype"
  },
  {
    "family": "Cheerful Day",
    "src": "fonts_en/Cheerful-Day-EaZ4j-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChristmasQueen",
    "src": "fonts_en/ChristmasQueenPersonalUse-lgqEX-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Claudia",
    "src": "fonts_en/Claudia-Laura-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Corna",
    "src": "fonts_en/Corna-2.otf",
    "format": "opentype"
  },
  {
    "family": "Courteous",
    "src": "fonts_en/Courteous-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Coventysh",
    "src": "fonts_en/CoventyshDemo-Eayez-2.otf",
    "format": "opentype"
  },
  {
    "family": "Cuningham",
    "src": "fonts_en/Cuningham-Singleton-2.otf",
    "format": "opentype"
  },
  {
    "family": "CyberGothic",
    "src": "fonts_en/CyberGothicDemo-2.otf",
    "format": "opentype"
  },
  {
    "family": "Cyberion",
    "src": "fonts_en/Cyberion-demo-2.otf",
    "format": "opentype"
  },
  {
    "family": "DELMANOMORELLI",
    "src": "fonts_en/DELMANOMORELLI-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Danillous",
    "src": "fonts_en/DanillousDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Dankfield",
    "src": "fonts_en/Dankfield-regular-demo-2.otf",
    "format": "opentype"
  },
  {
    "family": "DarkFalcon",
    "src": "fonts_en/DarkFalconDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "David And",
    "src": "fonts_en/David-And-Sovhie-2.otf",
    "format": "opentype"
  },
  {
    "family": "Delisha",
    "src": "fonts_en/Delisha-2.otf",
    "format": "opentype"
  },
  {
    "family": "Dellima",
    "src": "fonts_en/Dellima-Demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "n",
    "src": "fonts_en/Demon-Blade-2.otf",
    "format": "opentype"
  },
  {
    "family": "Devilion",
    "src": "fonts_en/Devilion-Demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "DiamondFlower",
    "src": "fonts_en/DiamondFlowerDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "DilanWhemsy",
    "src": "fonts_en/DilanWhemsy-2.otf",
    "format": "opentype"
  },
  {
    "family": "Display-Magazine-2",
    "src": "fonts_en/Display-Magazine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Display-Magazine-3",
    "src": "fonts_en/Display-Magazine-3.ttf",
    "format": "truetype"
  },
  {
    "family": "Dovetail",
    "src": "fonts_en/DovetailDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Draco",
    "src": "fonts_en/Draco-2.otf",
    "format": "opentype"
  },
  {
    "family": "Edellyn",
    "src": "fonts_en/Edellyndemo-w1x78-2.otf",
    "format": "opentype"
  },
  {
    "family": "Ediana",
    "src": "fonts_en/Ediana-PK2JB-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Energetic Script",
    "src": "fonts_en/Energetic-Script-Limited-2.otf",
    "format": "opentype"
  },
  {
    "family": "EnglandScript",
    "src": "fonts_en/EnglandScript-2.otf",
    "format": "opentype"
  },
  {
    "family": "FamousIdol",
    "src": "fonts_en/FamousIdolDemoDisplay-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Firebreak",
    "src": "fonts_en/FirebreakDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Frasell",
    "src": "fonts_en/FrasellPersonalUse-2.otf",
    "format": "opentype"
  },
  {
    "family": "Frick0.",
    "src": "fonts_en/Frick0.3-Condensed-2.otf",
    "format": "opentype"
  },
  {
    "family": "Fuel Injection",
    "src": "fonts_en/Fuel-Injection-Normal-2.otf",
    "format": "opentype"
  },
  {
    "family": "Gamiela",
    "src": "fonts_en/Gamiela-Demo-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Gegor",
    "src": "fonts_en/Gegor-Demo-2.otf",
    "format": "opentype"
  },
  {
    "family": "Generation",
    "src": "fonts_en/Generation-EaZ2r-2.otf",
    "format": "opentype"
  },
  {
    "family": "Genta",
    "src": "fonts_en/Genta-Font-2.otf",
    "format": "opentype"
  },
  {
    "family": "Geyster",
    "src": "fonts_en/Geyster-DEMO-2.otf",
    "format": "opentype"
  },
  {
    "family": "GingerBiscuitExtrudePul",
    "src": "fonts_en/GingerBiscuitExtrudePul-ZVOWl-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GingerBiscuit",
    "src": "fonts_en/GingerBiscuitPersonalUse-3zXmy-3.ttf",
    "format": "truetype"
  },
  {
    "family": "GoldenBrick",
    "src": "fonts_en/GoldenBrickPersonalUseRegular-eZyr6-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GoodHood",
    "src": "fonts_en/GoodHood-2.otf",
    "format": "opentype"
  },
  {
    "family": "Goodselves",
    "src": "fonts_en/GoodselvesDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GreenHome",
    "src": "fonts_en/GreenHome-WyZa4-2.ttf",
    "format": "truetype"
  },
  {
    "family": "HFWhale",
    "src": "fonts_en/HFWhale-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Hadnich",
    "src": "fonts_en/HadnichRegular-51x4Z-2.ttf",
    "format": "truetype"
  },
  {
    "family": "HamsleyScript",
    "src": "fonts_en/HamsleyScriptRegular-8MyrJ-2.otf",
    "format": "opentype"
  },
  {
    "family": "Hamsterly",
    "src": "fonts_en/HamsterlyDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Han Le Tours",
    "src": "fonts_en/Han-Le-Tours-Demo-Version-2.otf",
    "format": "opentype"
  },
  {
    "family": "Heaven Wanders",
    "src": "fonts_en/Heaven-Wanders-DEMO-2.otf",
    "format": "opentype"
  },
  {
    "family": "Hello",
    "src": "fonts_en/Hello-Hamna-2.otf",
    "format": "opentype"
  },
  {
    "family": "HiJack",
    "src": "fonts_en/HiJack-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Honeybears",
    "src": "fonts_en/Honeybears-2.otf",
    "format": "opentype"
  },
  {
    "family": "Hypeblox",
    "src": "fonts_en/Hypeblox-L3YGZ-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Igoe",
    "src": "fonts_en/Igoe-2.otf",
    "format": "opentype"
  },
  {
    "family": "InterpretateOne",
    "src": "fonts_en/InterpretateOneDemo-7BEZB-2.ttf",
    "format": "truetype"
  },
  {
    "family": "IronHorse",
    "src": "fonts_en/IronHorseRegular-K78rA-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Jacky",
    "src": "fonts_en/Jacky-Brushes-2.otf",
    "format": "opentype"
  },
  {
    "family": "Jacob and son",
    "src": "fonts_en/Jacob-and-son-2.otf",
    "format": "opentype"
  },
  {
    "family": "Janelotus",
    "src": "fonts_en/Janelotus-2.otf",
    "format": "opentype"
  },
  {
    "family": "Junior",
    "src": "fonts_en/Junior-prince-2.otf",
    "format": "opentype"
  },
  {
    "family": "Katracy",
    "src": "fonts_en/Katracy-2.otf",
    "format": "opentype"
  },
  {
    "family": "KitaharaScript",
    "src": "fonts_en/KitaharaScriptRegular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Klipan",
    "src": "fonts_en/Klipan-Black-2.ttf",
    "format": "truetype"
  },
  {
    "family": "LemonRolls",
    "src": "fonts_en/LemonRolls-2OGol-2.otf",
    "format": "opentype"
  },
  {
    "family": "LightenUp",
    "src": "fonts_en/LightenUpDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "LittleBirds",
    "src": "fonts_en/LittleBirdsRegular-lg81w-2.ttf",
    "format": "truetype"
  },
  {
    "family": "LocalBreweryTwo",
    "src": "fonts_en/LocalBreweryTwo-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Lomario",
    "src": "fonts_en/LomarioDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Losttimoh",
    "src": "fonts_en/Losttimoh-2.otf",
    "format": "opentype"
  },
  {
    "family": "Lovelygirly",
    "src": "fonts_en/Lovelygirly-2.otf",
    "format": "opentype"
  },
  {
    "family": "Madelita",
    "src": "fonts_en/Madelita-demo-2.otf",
    "format": "opentype"
  },
  {
    "family": "Maeryn",
    "src": "fonts_en/Maeryn-Demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Maleficent",
    "src": "fonts_en/Maleficent-2.otf",
    "format": "opentype"
  },
  {
    "family": "Mango",
    "src": "fonts_en/Mango-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Marchell",
    "src": "fonts_en/Marchell-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Maves",
    "src": "fonts_en/Maves-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Meghatone",
    "src": "fonts_en/Meghatone-Signature-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Melat i",
    "src": "fonts_en/Melat-iDemo-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Melonday",
    "src": "fonts_en/MelondayDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "MilknBalls",
    "src": "fonts_en/MilknBalls-BlackDemo-2.otf",
    "format": "opentype"
  },
  {
    "family": "MonsieurLaDoulaise",
    "src": "fonts_en/MonsieurLaDoulaise-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Montheylin",
    "src": "fonts_en/Montheylin-2.otf",
    "format": "opentype"
  },
  {
    "family": "Montreau",
    "src": "fonts_en/Montreau-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "Moon Charming",
    "src": "fonts_en/Moon-Charming-Demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Moreland",
    "src": "fonts_en/Moreland-2.otf",
    "format": "opentype"
  },
  {
    "family": "MrsAlexandra",
    "src": "fonts_en/MrsAlexandra-4BGxW-2.otf",
    "format": "opentype"
  },
  {
    "family": "MrsAlexandraMonogram",
    "src": "fonts_en/MrsAlexandraMonogram-owqeo-3.otf",
    "format": "opentype"
  },
  {
    "family": "Muathuk",
    "src": "fonts_en/Muathuk-2.otf",
    "format": "opentype"
  },
  {
    "family": "Munich",
    "src": "fonts_en/Munich-2.otf",
    "format": "opentype"
  },
  {
    "family": "MySunshine",
    "src": "fonts_en/MySunshine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Nature Green",
    "src": "fonts_en/Nature-Green-Italic-2.otf",
    "format": "opentype"
  },
  {
    "family": "Neography",
    "src": "fonts_en/Neography-DEMO-2.ttf",
    "format": "truetype"
  },
  {
    "family": "No.013 Sounso Moon",
    "src": "fonts_en/No.013-Sounso-Moon-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Northline",
    "src": "fonts_en/Northline-2.otf",
    "format": "opentype"
  },
  {
    "family": "Ottama",
    "src": "fonts_en/Ottama-Demo-2.otf",
    "format": "opentype"
  },
  {
    "family": "Pandemi",
    "src": "fonts_en/PandemiDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Photogenics",
    "src": "fonts_en/PhotogenicsDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Pithick",
    "src": "fonts_en/Pithick-Crispy-2.otf",
    "format": "opentype"
  },
  {
    "family": "Play Spoon",
    "src": "fonts_en/Play-Spoon-Demo-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Plularius",
    "src": "fonts_en/PlulariusDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Polonium",
    "src": "fonts_en/Polonium-3.otf",
    "format": "opentype"
  },
  {
    "family": "Polonium Bold",
    "src": "fonts_en/Polonium-Bold-2.otf",
    "format": "opentype"
  },
  {
    "family": "Qittuny",
    "src": "fonts_en/Qittuny-2.otf",
    "format": "opentype"
  },
  {
    "family": "Qualitative",
    "src": "fonts_en/Qualitative-2.otf",
    "format": "opentype"
  },
  {
    "family": "Qualy Bold",
    "src": "fonts_en/Qualy-Bold-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Quickstep",
    "src": "fonts_en/QuickstepDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Quillbacks",
    "src": "fonts_en/Quillbacks-Demo-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Quimil",
    "src": "fonts_en/Quimil-Demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rainbow",
    "src": "fonts_en/Rainbow-Universe-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rallisha",
    "src": "fonts_en/RallishaDemo-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rankfine",
    "src": "fonts_en/RankfinePersonalUse-lgPDd-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rastano",
    "src": "fonts_en/Rastano-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rastella",
    "src": "fonts_en/Rastella-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rattnugidari",
    "src": "fonts_en/Rattnugidari-3.ttf",
    "format": "truetype"
  },
  {
    "family": "Rayleigh",
    "src": "fonts_en/Rayleigh-Demo-Version-2.otf",
    "format": "opentype"
  },
  {
    "family": "Realistic",
    "src": "fonts_en/Realistic-2.otf",
    "format": "opentype"
  },
  {
    "family": "Reflisatta",
    "src": "fonts_en/Reflisatta-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Resta",
    "src": "fonts_en/RestaDisplayFont-p7o2Z-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RevijAnovik",
    "src": "fonts_en/RevijAnovik-X3ARG-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Reynatta",
    "src": "fonts_en/Reynatta-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rindu",
    "src": "fonts_en/Rindu-demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rivandell",
    "src": "fonts_en/Rivandell-2.otf",
    "format": "opentype"
  },
  {
    "family": "Rough Owl",
    "src": "fonts_en/Rough-Owl-Regular-qZpJd-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Rubicela",
    "src": "fonts_en/RubicelaDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ruottey",
    "src": "fonts_en/Ruottey-2.otf",
    "format": "opentype"
  },
  {
    "family": "Samberia",
    "src": "fonts_en/Samberia-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Shailendra",
    "src": "fonts_en/ShailendraDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "SidgerNakson",
    "src": "fonts_en/SidgerNaksonDemo-lgvx5-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Siegra",
    "src": "fonts_en/Siegra-2.otf",
    "format": "opentype"
  },
  {
    "family": "Sinethar",
    "src": "fonts_en/Sinethar-0WLLo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Sonatta",
    "src": "fonts_en/SonattaDemo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Starshy",
    "src": "fonts_en/Starshy-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Suffer",
    "src": "fonts_en/Suffer-through-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Swansong",
    "src": "fonts_en/Swansong-FREE-2.otf",
    "format": "opentype"
  },
  {
    "family": "Sweetish",
    "src": "fonts_en/SweetishDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Sweety",
    "src": "fonts_en/Sweety-Sunshine-2.otf",
    "format": "opentype"
  },
  {
    "family": "Themordeus",
    "src": "fonts_en/Themordeusdemo-p76xv-2.otf",
    "format": "opentype"
  },
  {
    "family": "TheropodsBold",
    "src": "fonts_en/TheropodsDemoBold-2.ttf",
    "format": "truetype"
  },
  {
    "family": "TheropodsItalic",
    "src": "fonts_en/TheropodsDemoItalic-3.ttf",
    "format": "truetype"
  },
  {
    "family": "Theropods",
    "src": "fonts_en/TheropodsDemoRegular-4.ttf",
    "format": "truetype"
  },
  {
    "family": "Timothy Sign",
    "src": "fonts_en/Timothy-Sign-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Undertones",
    "src": "fonts_en/UndertonesDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Undertow",
    "src": "fonts_en/Undertow-3.otf",
    "format": "opentype"
  },
  {
    "family": "Undertow Slab",
    "src": "fonts_en/Undertow-Slab-2.otf",
    "format": "opentype"
  },
  {
    "family": "VILLADICANCE",
    "src": "fonts_en/VILLADICANCE-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Ventus",
    "src": "fonts_en/Ventus-2.otf",
    "format": "opentype"
  },
  {
    "family": "Violableness",
    "src": "fonts_en/ViolablenessDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Violet",
    "src": "fonts_en/Violet-Twinkle-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Virgolate",
    "src": "fonts_en/Virgolatedemo-JRAaK-2.otf",
    "format": "opentype"
  },
  {
    "family": "WeddingDream",
    "src": "fonts_en/WeddingDreamDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "WelcomeValentine",
    "src": "fonts_en/WelcomeValentine-2.otf",
    "format": "opentype"
  },
  {
    "family": "WhetherFark",
    "src": "fonts_en/WhetherFarkDemoRegular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Wilson",
    "src": "fonts_en/Wilson-wells-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Winstonia",
    "src": "fonts_en/Winstonia-2.otf",
    "format": "opentype"
  },
  {
    "family": "Winter",
    "src": "fonts_en/Winter-Sunshine-2.otf",
    "format": "opentype"
  },
  {
    "family": "YouraScript",
    "src": "fonts_en/YouraScript-qZ51x-2.otf",
    "format": "opentype"
  },
  {
    "family": "abington bold",
    "src": "fonts_en/abington-bold-font-2.otf",
    "format": "opentype"
  },
  {
    "family": "angelin",
    "src": "fonts_en/angelin-2.otf",
    "format": "opentype"
  },
  {
    "family": "belights",
    "src": "fonts_en/belights-2.ttf",
    "format": "truetype"
  },
  {
    "family": "branch zystoo",
    "src": "fonts_en/branch-zystoo-Regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "calib resuper condensed",
    "src": "fonts_en/calib-resuper-condensed-regular-2.otf",
    "format": "opentype"
  },
  {
    "family": "celattin",
    "src": "fonts_en/celattin-font-2.ttf",
    "format": "truetype"
  },
  {
    "family": "earga",
    "src": "fonts_en/earga-2.ttf",
    "format": "truetype"
  },
  {
    "family": "far out",
    "src": "fonts_en/far-out-2.ttf",
    "format": "truetype"
  },
  {
    "family": "hallimah",
    "src": "fonts_en/hallimah-demo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "holly and",
    "src": "fonts_en/holly-and-berries-2.ttf",
    "format": "truetype"
  },
  {
    "family": "karen",
    "src": "fonts_en/karen-2.otf",
    "format": "opentype"
  },
  {
    "family": "malema",
    "src": "fonts_en/malema-free-2.ttf",
    "format": "truetype"
  },
  {
    "family": "nucleo",
    "src": "fonts_en/nucleo-2.ttf",
    "format": "truetype"
  },
  {
    "family": "pittsburgh",
    "src": "fonts_en/pittsburgh-personal-use-only-2.otf",
    "format": "opentype"
  },
  {
    "family": "ractor",
    "src": "fonts_en/ractor-2.ttf",
    "format": "truetype"
  },
  {
    "family": "sharpshooter",
    "src": "fonts_en/sharpshooter-2.ttf",
    "format": "truetype"
  },
  {
    "family": "summer",
    "src": "fonts_en/summer-coast-2.ttf",
    "format": "truetype"
  },
  {
    "family": "the",
    "src": "fonts_en/the-antter-2.ttf",
    "format": "truetype"
  },
  {
    "family": "thinkers",
    "src": "fonts_en/thinkers-2.ttf",
    "format": "truetype"
  },
  {
    "family": "vanberg",
    "src": "fonts_en/vanberg-free-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AZhuPaoPaoTi-2",
    "src": "fonts_cn2/AZhuPaoPaoTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "AaJianHaoTi-2",
    "src": "fonts_cn2/AaJianHaoTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheBeiJianFan-Shan(REEJI-CHAO-BeiMingGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheBeiJianFan-Shan(REEJI-CHAO-BeiMingGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheFengYunJianFan-Shan(REEJI-CHAO-FengyunGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheFengYunJianFan-Shan(REEJI-CHAO-FengyunGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheGuoFengHongShuJian-2",
    "src": "fonts_cn2/ChaoZiSheGuoFengHongShuJian-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheGuoFengKaiJianFan-Shan(REEJI-CHAO-RuikaiGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheGuoFengKaiJianFan-Shan(REEJI-CHAO-RuikaiGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheJuanMeiJian-Shan-ChangGui(REEJI-CHAO-MeiGB-Flash-Regular)-2",
    "src": "fonts_cn2/ChaoZiSheJuanMeiJian-Shan-ChangGui(REEJI-CHAO-MeiGB-Flash-Regular)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheJuanMeiJian-Shan-CuTi(REEJI-CHAO-MeiGB-Flash-Bold)-2",
    "src": "fonts_cn2/ChaoZiSheJuanMeiJian-Shan-CuTi(REEJI-CHAO-MeiGB-Flash-Bold)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheJuanMeiJian-Shan-XiTi(REEJI-CHAO-MeiGB-Flash-Light)-2",
    "src": "fonts_cn2/ChaoZiSheJuanMeiJian-Shan-XiTi(REEJI-CHAO-MeiGB-Flash-Light)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheKanTingLiuJianFan-Shan(REEJI-CHAO-KanTingLiuGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheKanTingLiuJianFan-Shan(REEJI-CHAO-KanTingLiuGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheLingDuBengTaJianFan-Shan(CHAO-BengtaGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheLingDuBengTaJianFan-Shan(CHAO-BengtaGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheLingTuYueYeJianFan-Shan(REEJI-CHAO-HareGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheLingTuYueYeJianFan-Shan(REEJI-CHAO-HareGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheYueNOUSAKI-REEJI-CHAO-HareJP)-2",
    "src": "fonts_cn2/ChaoZiSheYueNOUSAKI-REEJI-CHAO-HareJP)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ChaoZiSheZengYuBoShouShuJianFan-Shan(REEJI-CHAO-ZengGBT-Flash)-2",
    "src": "fonts_cn2/ChaoZiSheZengYuBoShouShuJianFan-Shan(REEJI-CHAO-ZengGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "DMFT1607996674306-2",
    "src": "fonts_cn2/DMFT1607996674306-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GEETYPEQingKongHeiGB-YanShiBan-ChangGui(GEETYPE-SkyGB-Demo-Reguar)-2",
    "src": "fonts_cn2/GEETYPEQingKongHeiGB-YanShiBan-ChangGui(GEETYPE-SkyGB-Demo-Reguar)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GEETYPEQingKongHeiGB-YanShiBan-XiHei(GEETYPE-SkyGB-Demo-Light)-2",
    "src": "fonts_cn2/GEETYPEQingKongHeiGB-YanShiBan-XiHei(GEETYPE-SkyGB-Demo-Light)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GEETYPEQingKongHeiGB-YanShiBan-XianHei(GEETYPE-SkyGB-Demo-Thin)-2",
    "src": "fonts_cn2/GEETYPEQingKongHeiGB-YanShiBan-XianHei(GEETYPE-SkyGB-Demo-Thin)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GEETYPEQingKongHeiGB-YanShiBan-ZhongHei(GEETYPE-SkyGB-Demo-Medium)-2",
    "src": "fonts_cn2/GEETYPEQingKongHeiGB-YanShiBan-ZhongHei(GEETYPE-SkyGB-Demo-Medium)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "GongFanMianFeiTi2.0(GengDuoZiTiBaiDuSouShiJueFang)-2",
    "src": "fonts_cn2/GongFanMianFeiTi2.0(GengDuoZiTiBaiDuSouShiJueFang)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "JingNanBoBoHei-Bold-2",
    "src": "fonts_cn2/JingNanBoBoHei-Bold-2.ttf",
    "format": "truetype"
  },
  {
    "family": "Kingnammm-Maiyuan-II-Regular-2",
    "src": "fonts_cn2/Kingnammm-Maiyuan-II-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "KingnamypeYuanmoSC-Regular-2",
    "src": "fonts_cn2/KingnamypeYuanmoSC-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "MFFengWu-Noncommercial-Regular-2",
    "src": "fonts_cn2/MFFengWu-Noncommercial-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "MFSuHei-Noncommercial-Regular-2",
    "src": "fonts_cn2/MFSuHei-Noncommercial-Regular-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PangMenZhengDaoXiXianTi-2",
    "src": "fonts_cn2/PangMenZhengDaoXiXianTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangGongZiTi-2",
    "src": "fonts_cn2/PingFangGongZiTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangJiangJunTi-2",
    "src": "fonts_cn2/PingFangJiangJunTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangJiangNanTi-2",
    "src": "fonts_cn2/PingFangJiangNanTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangLaiJiangHuFeiYangTi-2",
    "src": "fonts_cn2/PingFangLaiJiangHuFeiYangTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangLaiJiangHuHuaiGuTi-2",
    "src": "fonts_cn2/PingFangLaiJiangHuHuaiGuTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangLaiJiangHuLangTi-2",
    "src": "fonts_cn2/PingFangLaiJiangHuLangTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangLiuAngLeTianTi-2",
    "src": "fonts_cn2/PingFangLiuAngLeTianTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangMengMeng-2",
    "src": "fonts_cn2/PingFangMengMeng-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangQingChunTi-2",
    "src": "fonts_cn2/PingFangQingChunTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangSaTuoTi-2",
    "src": "fonts_cn2/PingFangSaTuoTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangSaiBeiTi-2",
    "src": "fonts_cn2/PingFangSaiBeiTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangSanShengTi-2",
    "src": "fonts_cn2/PingFangSanShengTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangShangShangQianTi-2",
    "src": "fonts_cn2/PingFangShangShangQianTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangShaoHuaTi-2",
    "src": "fonts_cn2/PingFangShaoHuaTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangShiGuangTi-2",
    "src": "fonts_cn2/PingFangShiGuangTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangShouShuTi-2",
    "src": "fonts_cn2/PingFangShouShuTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangXiangSiTi-2",
    "src": "fonts_cn2/PingFangXiangSiTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "PingFangZhangYaLingHeiFangTi-2",
    "src": "fonts_cn2/PingFangZhangYaLingHeiFangTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "QianTuBiFengShouXieTi-2",
    "src": "fonts_cn2/QianTuBiFengShouXieTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "QianTuHouHeiTi-2",
    "src": "fonts_cn2/QianTuHouHeiTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "QianTuMaKeShouXieTi-2",
    "src": "fonts_cn2/QianTuMaKeShouXieTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "QianTuXianMoTi-2",
    "src": "fonts_cn2/QianTuXianMoTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "QingNiaoHuaGuangXingKai-2",
    "src": "fonts_cn2/QingNiaoHuaGuangXingKai-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiAoYunJingShenDuoGuanJianMianFei-Shan(REEJI-DuoguanGB-free-Flash)-2",
    "src": "fonts_cn2/RuiZiAoYunJingShenDuoGuanJianMianFei-Shan(REEJI-DuoguanGB-free-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiAoYunJingShenPinBoJianMianFei-Shan(REEJI-PinboGB-Flash)-2",
    "src": "fonts_cn2/RuiZiAoYunJingShenPinBoJianMianFei-Shan(REEJI-PinboGB-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiChaoPaiHaoHengHeiJian-ChangGui-2",
    "src": "fonts_cn2/RuiZiChaoPaiHaoHengHeiJian-ChangGui-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiChaoPaiHaoHengHeiJian-DaHei-2",
    "src": "fonts_cn2/RuiZiChaoPaiHaoHengHeiJian-DaHei-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiChaoPaiHaoHengHeiJian-TeHei-2",
    "src": "fonts_cn2/RuiZiChaoPaiHaoHengHeiJian-TeHei-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiChaoPaiHaoHengHeiJian-ZhongHei-2",
    "src": "fonts_cn2/RuiZiChaoPaiHaoHengHeiJian-ZhongHei-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongLiXianXiangSuJian-Shan(REEJI-TaikoRiskGB-Flash)-2",
    "src": "fonts_cn2/RuiZiTaiKongLiXianXiangSuJian-Shan(REEJI-TaikoRiskGB-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongQiYuXiangSuJian-Shan(REEJI-TaikoMagicGB-Flash)-2",
    "src": "fonts_cn2/RuiZiTaiKongQiYuXiangSuJian-Shan(REEJI-TaikoMagicGB-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongZhuMengHeiJian-Shan-ChangGui(REEJI-TaikodreamGB-Flash-Regular)-2",
    "src": "fonts_cn2/RuiZiTaiKongZhuMengHeiJian-Shan-ChangGui(REEJI-TaikodreamGB-Flash-Regular)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongZhuMengHeiJian-Shan-ChaoHei(REEJI-TaikodreamGB-Flash-Heavy)-2",
    "src": "fonts_cn2/RuiZiTaiKongZhuMengHeiJian-Shan-ChaoHei(REEJI-TaikodreamGB-Flash-Heavy)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongZhuMengHeiJian-Shan-DaHei(REEJI-TaikodreamGB-Flash-Bold)-2",
    "src": "fonts_cn2/RuiZiTaiKongZhuMengHeiJian-Shan-DaHei(REEJI-TaikodreamGB-Flash-Bold)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongZhuMengHeiJian-Shan-TeHei(REEJI-TaikodreamGB-Flash-Black)-2",
    "src": "fonts_cn2/RuiZiTaiKongZhuMengHeiJian-Shan-TeHei(REEJI-TaikodreamGB-Flash-Black)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiTaiKongZhuMengHeiJian-Shan-ZhongHei(REEJI-TaikodreamGB-Flash-Medium)-2",
    "src": "fonts_cn2/RuiZiTaiKongZhuMengHeiJian-Shan-ZhongHei(REEJI-TaikodreamGB-Flash-Medium)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "RuiZiZhenYanCiPoGongYiMianFei-Shan(REEJI-PierceGB-free-Flash)-2",
    "src": "fonts_cn2/RuiZiZhenYanCiPoGongYiMianFei-Shan(REEJI-PierceGB-free-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "SanJiLiLiangTiJian-Cu-2",
    "src": "fonts_cn2/SanJiLiLiangTiJian-Cu-2.ttf",
    "format": "truetype"
  },
  {
    "family": "SanJiPoMoTi-2",
    "src": "fonts_cn2/SanJiPoMoTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "SanJiSuXianJianTi-2",
    "src": "fonts_cn2/SanJiSuXianJianTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "SanJiXingKaiJianTi-Cu-2",
    "src": "fonts_cn2/SanJiXingKaiJianTi-Cu-2.ttf",
    "format": "truetype"
  },
  {
    "family": "XiaoDouDaoHuaXinFengJianFan-Shan(REEJI-Xiaodou-FlowerGBT-Flash)-2",
    "src": "fonts_cn2/XiaoDouDaoHuaXinFengJianFan-Shan(REEJI-Xiaodou-FlowerGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "XiaoDouDaoQiuRiHeJianFan-Shan(REEJI-Xiaodou-AutumnGBT-Flash)-2",
    "src": "fonts_cn2/XiaoDouDaoQiuRiHeJianFan-Shan(REEJI-Xiaodou-AutumnGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "XiaoDouDaoTaoYuanXiangJianFan-Shan(REEJI-Xiaodou-UtopiaGBT-Flash)-2",
    "src": "fonts_cn2/XiaoDouDaoTaoYuanXiangJianFan-Shan(REEJI-Xiaodou-UtopiaGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "XiaoDouDaoXiaXiKongJianFan-Shan(REEJI-Xiaodou-SummerGBT-Flash)-2",
    "src": "fonts_cn2/XiaoDouDaoXiaXiKongJianFan-Shan(REEJI-Xiaodou-SummerGBT-Flash)-2.ttf",
    "format": "truetype"
  },
  {
    "family": "YuWeiShuFaYunMoFanTi-2",
    "src": "fonts_cn2/YuWeiShuFaYunMoFanTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "YunFengHanChanTi-2",
    "src": "fonts_cn2/YunFengHanChanTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ZhengXinGeYingBiKaiShuJian-2",
    "src": "fonts_cn2/ZhengXinGeYingBiKaiShuJian-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ZiTiChuanQiNanAnTi-MianFeiShangYong-2",
    "src": "fonts_cn2/ZiTiChuanQiNanAnTi-MianFeiShangYong-2.ttf",
    "format": "truetype"
  },
  {
    "family": "ZiZhiQuXiMaiTi-2",
    "src": "fonts_cn2/ZiZhiQuXiMaiTi-2.ttf",
    "format": "truetype"
  },
  {
    "family": "dianyingzimuti-2",
    "src": "fonts_cn2/dianyingzimuti-2.ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂丝滑黑巧体(商用需授权)",
    "src": "fonts_cn2/字小魂丝滑黑巧体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂兔兔体(商用需授权)",
    "src": "fonts_cn2/字小魂兔兔体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂公式黑(商用需授权)",
    "src": "fonts_cn2/字小魂公式黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂公路体(商用需授权)",
    "src": "fonts_cn2/字小魂公路体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂凌智黑(商用需授权)",
    "src": "fonts_cn2/字小魂凌智黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂启力黑(商用需授权)",
    "src": "fonts_cn2/字小魂启力黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂咔嗒体(商用需授权)",
    "src": "fonts_cn2/字小魂咔嗒体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂品味黑(商用需授权)",
    "src": "fonts_cn2/字小魂品味黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂外星奇趣体(商用需授权)",
    "src": "fonts_cn2/字小魂外星奇趣体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂天润黑(商用需授权)",
    "src": "fonts_cn2/字小魂天润黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂小尾巴体(商用需授权)",
    "src": "fonts_cn2/字小魂小尾巴体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂小木屋体(商用需授权)",
    "src": "fonts_cn2/字小魂小木屋体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂彩虹积木体(商用需授权)",
    "src": "fonts_cn2/字小魂彩虹积木体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂心悦体(商用需授权)",
    "src": "fonts_cn2/字小魂心悦体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂怪力趣黑(商用需授权)",
    "src": "fonts_cn2/字小魂怪力趣黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂悦动音速黑(商用需授权)",
    "src": "fonts_cn2/字小魂悦动音速黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂摩登时尚体(商用需授权)",
    "src": "fonts_cn2/字小魂摩登时尚体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂新跃黑体(商用需授权)",
    "src": "fonts_cn2/字小魂新跃黑体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂方块黑(商用需授权)",
    "src": "fonts_cn2/字小魂方块黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂明日山峰体(商用需授权)",
    "src": "fonts_cn2/字小魂明日山峰体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂智趣黑(商用需授权)",
    "src": "fonts_cn2/字小魂智趣黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂未来体(商用需授权)",
    "src": "fonts_cn2/字小魂未来体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂林海体(商用需授权)",
    "src": "fonts_cn2/字小魂林海体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂活力飞扬体(商用需授权)",
    "src": "fonts_cn2/字小魂活力飞扬体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂清欢体(商用需授权)",
    "src": "fonts_cn2/字小魂清欢体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂清水体(商用需授权)",
    "src": "fonts_cn2/字小魂清水体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂烈日当空体(商用需授权)",
    "src": "fonts_cn2/字小魂烈日当空体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂玉米体(商用需授权)",
    "src": "fonts_cn2/字小魂玉米体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂甜心泡泡体(商用需授权)",
    "src": "fonts_cn2/字小魂甜心泡泡体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂聚力体(商用需授权)",
    "src": "fonts_cn2/字小魂聚力体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂自由行星体(商用需授权)",
    "src": "fonts_cn2/字小魂自由行星体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂芯科幻体(商用需授权)",
    "src": "fonts_cn2/字小魂芯科幻体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂行者黑(商用需授权)",
    "src": "fonts_cn2/字小魂行者黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂醇香悠然体(商用需授权)",
    "src": "fonts_cn2/字小魂醇香悠然体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂钢铁黑(商用需授权)",
    "src": "fonts_cn2/字小魂钢铁黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂铁塔黑(商用需授权)",
    "src": "fonts_cn2/字小魂铁塔黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂阳光体(商用需授权)",
    "src": "fonts_cn2/字小魂阳光体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字小魂音律体(商用需授权)",
    "src": "fonts_cn2/字小魂音律体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂假日乐园体(商用需授权)",
    "src": "fonts_cn2/字魂假日乐园体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂光年体(商用需授权)",
    "src": "fonts_cn2/字魂光年体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂动力火车体(商用需授权)",
    "src": "fonts_cn2/字魂动力火车体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂勇士体(商用需授权)",
    "src": "fonts_cn2/字魂勇士体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂卡通软糖体(商用需授权)",
    "src": "fonts_cn2/字魂卡通软糖体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂吨吨桶(商用需授权)",
    "src": "fonts_cn2/字魂吨吨桶(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂团圆宋(商用需授权)",
    "src": "fonts_cn2/字魂团圆宋(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂天狼体(商用需授权)",
    "src": "fonts_cn2/字魂天狼体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂奇迹宇宙体(商用需授权)",
    "src": "fonts_cn2/字魂奇迹宇宙体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂学士黑(商用需授权)",
    "src": "fonts_cn2/字魂学士黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂宝珠体(商用需授权)",
    "src": "fonts_cn2/字魂宝珠体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂宝藏体(商用需授权)",
    "src": "fonts_cn2/字魂宝藏体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂无限引力黑(商用需授权)",
    "src": "fonts_cn2/字魂无限引力黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂火焰隶(商用需授权)",
    "src": "fonts_cn2/字魂火焰隶(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂烟花体(商用需授权)",
    "src": "fonts_cn2/字魂烟花体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂精灵体(商用需授权)",
    "src": "fonts_cn2/字魂精灵体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂翠竹楷书(商用需授权)",
    "src": "fonts_cn2/字魂翠竹楷书(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂翰林皇榜体(商用需授权)",
    "src": "fonts_cn2/字魂翰林皇榜体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂虎虎威风体(商用需授权)",
    "src": "fonts_cn2/字魂虎虎威风体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂超硬核体(商用需授权)",
    "src": "fonts_cn2/字魂超硬核体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂趋光体(商用需授权)",
    "src": "fonts_cn2/字魂趋光体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂跳动旋律体(商用需授权)",
    "src": "fonts_cn2/字魂跳动旋律体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂铁甲坦克体(商用需授权)",
    "src": "fonts_cn2/字魂铁甲坦克体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂闪烁凝光体(商用需授权)",
    "src": "fonts_cn2/字魂闪烁凝光体(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂阅然楷(商用需授权)",
    "src": "fonts_cn2/字魂阅然楷(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂雅致黑(商用需授权)",
    "src": "fonts_cn2/字魂雅致黑(商用需授权).ttf",
    "format": "truetype"
  },
  {
    "family": "字魂青龙霸道体(商用需授权)",
    "src": "fonts_cn2/字魂青龙霸道体(商用需授权).ttf",
    "format": "truetype"
  }
];
  // CSSOS_PHASE2_FONT_404_PRUNE 20260426 #134 — Jing
  // "控制台报错，还是这些字体问题，能不能一次性下载他们？免得每次都报错？"
  //
  // The manifest references ~380 fonts under /fonts_en/<name>.otf|ttf, but
  // that directory was never deployed (only /fonts/HengShanMaoBiCaoShu.ttf
  // and /fonts_cn2/* exist on the server). The browser was firing 380×
  // failed-to-load errors per page load, drowning out useful console output.
  //
  // Strategy: HEAD-probe each unique src ROOT directory exactly ONCE per
  // session, cached in localStorage with a 24h TTL. If `fonts_en/` is
  // missing, prune all `fonts_en/*` entries from the @font-face emit. The
  // system fallback list in app.watch-media-layout-p2100.js (LATIN_FONTS,
  // CJK_FONTS) takes over and the random-font picker still has a healthy
  // pool to draw from. Auto-rehydrates if the catalog ever gets deployed.
  const ROOT_PROBE_KEY = "cssos.fontRootProbe.v1";
  const ROOT_PROBE_TTL_MS = 24 * 3600 * 1000;
  const allRoots = Array.from(new Set(
    entries
      .map((e) => String(e.src || "").split("/")[0])
      .filter(Boolean)
  ));

  function readProbeCache() {
    try {
      const raw = localStorage.getItem(ROOT_PROBE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (Date.now() - Number(parsed.ts || 0) > ROOT_PROBE_TTL_MS) return null;
      return parsed.roots || {};
    } catch (_e) { return null; }
  }
  function writeProbeCache(roots) {
    try {
      localStorage.setItem(ROOT_PROBE_KEY, JSON.stringify({
        ts: Date.now(), roots: roots
      }));
    } catch (_e) { /* quota / private mode — ignore */ }
  }

  async function probeRoots() {
    const cached = readProbeCache();
    if (cached && allRoots.every((r) => cached[r] !== undefined)) {
      return cached;
    }
    const roots = cached || {};
    const probes = allRoots.map(async (root) => {
      // Probe a representative entry from each root folder.
      const sample = entries.find((e) => String(e.src || "").startsWith(root + "/"));
      if (!sample) { roots[root] = false; return; }
      try {
        const resp = await fetch("/" + sample.src, { method: "HEAD", cache: "no-store" });
        roots[root] = resp.ok;
      } catch (_err) {
        roots[root] = false;
      }
    });
    await Promise.all(probes);
    writeProbeCache(roots);
    return roots;
  }

  function injectAvailable(availableRoots) {
    let survivors = entries.filter((e) => {
      const root = String(e.src || "").split("/")[0];
      return availableRoots[root] === true;
    });
    // CSSOS_PHASE2_MOBILE_PAIN_RELIEF 20260505 — Jing
    // Cap @font-face declarations on mobile. 143+ rules + the 58
    // Google Fonts above blew past Safari's mobile font budget;
    // many phones reported "A problem repeatedly occurred" at boot.
    // Sample evenly across the survivors so the picker still has
    // visual variety, just from a smaller pool.
    try {
      const isMobile =
        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
        (window.innerWidth && window.innerWidth <= 720) ||
        /iPhone|iPod|Android.*Mobile/i.test(String(navigator.userAgent || ""));
      const MOBILE_LOCAL_CAP = 32;
      if (isMobile && survivors.length > MOBILE_LOCAL_CAP) {
        const stride = Math.max(1, Math.floor(survivors.length / MOBILE_LOCAL_CAP));
        const sampled = [];
        for (let i = 0; i < survivors.length && sampled.length < MOBILE_LOCAL_CAP; i += stride) {
          sampled.push(survivors[i]);
        }
        survivors = sampled;
      }
    } catch (_e) { /* fall through with the un-capped list */ }
    global.CSSOS_WATCH_FONT_MANIFEST = survivors;
    const styleId = "cssos-watch-font-manifest-style";
    if (document.getElementById(styleId)) return;
    if (survivors.length === 0) {
      // Nothing exists on the server yet — leave the system-fallback path
      // alone and stay quiet. No @font-face rules → no 404 storm.
      console.info(
        "[font-manifest] All font roots probed missing on server " +
        "(" + Object.keys(availableRoots).filter((r) => !availableRoots[r]).join(", ") +
        "). Falling back to system fonts. Re-deploy the font catalog to " +
        "auto-rehydrate; cache TTL = 24h, clear with localStorage.removeItem('" +
        ROOT_PROBE_KEY + "')."
      );
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = survivors
      .map((entry) => `@font-face{font-family:"${entry.family.replace(/"/g, "\"")}";src:url("/${encodeURI(entry.src)}") format("${entry.format}");font-display:swap;unicode-range:U+0000-024F,U+2E80-9FFF,U+3000-303F,U+3400-4DBF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF;}`)
      .join("\n");
    document.head.appendChild(style);
    // Silenced 20260506 — keep console clean (only the LOGO survives).
  }

  // Optimistic boot: if the cache says a root is available, inject those
  // immediately so first paint has the fonts. Then probe in the background
  // to catch any fresh 404s. If no cache, set CSSOS_WATCH_FONT_MANIFEST to
  // an empty array temporarily so consumers don't crash on undefined.
  const seedCache = readProbeCache();
  if (seedCache) {
    injectAvailable(seedCache);
  } else {
    global.CSSOS_WATCH_FONT_MANIFEST = [];
  }
  probeRoots().then((roots) => {
    // If we already injected from a stale cache, don't re-inject.
    if (document.getElementById("cssos-watch-font-manifest-style")) return;
    injectAvailable(roots);
  });

  // CSSOS_PHASE2_GOOGLE_FANCY_FONTS 20260504 — Jing
  // "希望，尽快看到这样的字体" (Qwitcher Grypen / Ballet / Rochester /
  // Romanesco …). The local manifest is pruned heavy on CJK — the Latin
  // fancy bucket is starved. Hook a curated set of Google Fonts script /
  // calligraphic / display faces into the same manifest so the 90/10
  // weighted picker has plenty of beautiful Latin (and a few CN) fonts
  // to draw from. CSS-served, no local file dependency, font-display:
  // swap ⇒ never blocks paint.
  const GOOGLE_FANCY_FONTS = [
    // Latin script / calligraphic
    "Qwitcher Grypen", "Ballet", "Rochester", "Romanesco", "Pacifico",
    "Dancing Script", "Great Vibes", "Allura", "Sacramento", "Tangerine",
    "Marck Script", "Parisienne", "Pinyon Script", "Mr Dafoe", "Mrs Saint Delafield",
    "Petit Formal Script", "Italianno", "Yellowtail", "Kaushan Script",
    "Caveat", "Caveat Brush", "Homemade Apple", "Reenie Beanie",
    "Shadows Into Light", "Permanent Marker", "Just Another Hand",
    // Display / decorative
    "Lobster", "Lobster Two", "Bungee Shade", "Monoton", "Faster One",
    "Bowlby One", "Black Ops One", "Cinzel Decorative", "UnifrakturMaguntia",
    "Pirata One", "Almendra Display", "Henny Penny", "Vampiro One",
    "Eater", "Creepster", "Nosifer", "Rubik Glitch", "Rubik Wet Paint",
    "Rubik Beastly", "Bungee Outline", "Rye", "Smokum", "Special Elite",
    // CJK calligraphic (Google supplies these)
    "Ma Shan Zheng", "Liu Jian Mao Cao", "Long Cang",
    "ZCOOL XiaoWei", "ZCOOL KuaiLe", "ZCOOL QingKe HuangYou",
    "Zhi Mang Xing", "Noto Serif SC", "Noto Sans SC"
  ];

  // CSSOS_PHASE2_MOBILE_PAIN_RELIEF 20260505 — Jing
  // "手机端痛点，可以解决吗". Mobile Safari kills the page with
  // "A problem repeatedly occurred" when the boot sequence pulls
  // 58 Google Fonts on top of 143 local @font-face rules — each
  // glyph encountered fans out a WOFF2 fetch + decode, easily
  // exhausting the 4 GB-iPhone tab budget. Detect mobile / narrow
  // viewport and trim the Google list HARD: keep ~10 best-loved
  // script faces only, drop the rest. Desktop sees the full 58.
  function isMobileViewport() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.innerWidth && window.innerWidth <= 720) return true;
      const ua = String(navigator.userAgent || "");
      if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return true;
    } catch (_e) {}
    return false;
  }
  const MOBILE_FANCY_FONTS = [
    "Pacifico", "Dancing Script", "Great Vibes", "Sacramento",
    "Caveat", "Lobster", "Permanent Marker", "Cinzel Decorative",
    "Ma Shan Zheng", "ZCOOL XiaoWei",
  ];
  function injectGoogleFancyFonts() {
    if (document.getElementById("cssos-google-fancy-fonts")) return;
    const fonts = isMobileViewport() ? MOBILE_FANCY_FONTS : GOOGLE_FANCY_FONTS;
    // Build the families= URL fragment. Google's css2 endpoint takes
    // semicolon-separated entries with + for spaces.
    const families = fonts
      .map((f) => "family=" + f.replace(/ /g, "+"))
      .join("&");
    const link = document.createElement("link");
    link.id = "cssos-google-fancy-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + families + "&display=swap";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    // Append entries to the in-memory manifest so the per-token picker
    // (loadFontPools fallback in app.watch-media-overlays.js) treats
    // them as part of the font pool. Empty src signals "external CSS,
    // no local file".
    const existing = Array.isArray(global.CSSOS_WATCH_FONT_MANIFEST)
      ? global.CSSOS_WATCH_FONT_MANIFEST.slice()
      : [];
    const seen = new Set(existing.map((e) => String(e.family || "")));
    const CN_FAM = /[一-鿿]/;
    for (const fam of fonts) {
      if (seen.has(fam)) continue;
      existing.push({
        family: fam,
        src: "",
        format: "external",
        group: CN_FAM.test(fam) ||
               /^(Ma Shan|Liu Jian|Long Cang|ZCOOL|Zhi Mang|Noto (?:Serif|Sans) SC)/i.test(fam)
                 ? "cjk" : "latin"
      });
    }
    global.CSSOS_WATCH_FONT_MANIFEST = existing;
    // Bust the overlays cache so loadFontPools picks up the new entries
    // on next call.
    try {
      if (global.cssmvAssignFontForPiece && typeof global.cssmvAssignFontForPiece === "function") {
        // Stamp the cache invalidation marker — the cache is internal
        // to overlays.js, but it expires every 1s anyway, so we just
        // wait for the next tick.
      }
    } catch (_e) {}
    // Silenced 20260506 — keep console clean.
  }
  // CSSOS_PHASE2_MOBILE_PAIN_RELIEF 20260505 — Jing
  // On mobile, defer Google Fonts injection until first user
  // interaction. The homepage logo + dock don't need fancy fonts;
  // by the time the user taps anything, the network is warm and
  // the boot bundle has already settled. Desktop injects eagerly
  // because the boot budget is comfortable.
  function isMobileFontDefer() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.innerWidth && window.innerWidth <= 720) return true;
      const ua = String(navigator.userAgent || "");
      if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return true;
    } catch (_e) {}
    return false;
  }
  function scheduleGoogleFancyInjection() {
    if (!isMobileFontDefer()) {
      injectGoogleFancyFonts();
      return;
    }
    const oncePer = (fn) => {
      let fired = false;
      return () => { if (fired) return; fired = true; fn(); };
    };
    const fire = oncePer(() => {
      try { injectGoogleFancyFonts(); } catch (_e) {}
    });
    ["pointerdown", "touchstart", "click", "keydown"].forEach((ev) => {
      document.addEventListener(ev, fire, { once: true, passive: true, capture: true });
    });
    // Failsafe: even without interaction, inject after 6s so the
    // watch panel has fonts when the user eventually opens it.
    setTimeout(fire, 6000);
  }
  if (document.head) {
    scheduleGoogleFancyInjection();
  } else {
    document.addEventListener("DOMContentLoaded", scheduleGoogleFancyInjection, { once: true });
  }
})(window);
