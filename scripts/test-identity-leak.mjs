/* W2123 验收: 身份泄漏判据。
 * 两头都要验 ——
 *   该拦的必须拦(模型把自己的身份说出来)
 *   不该拦的绝不能拦(演员【谈论】AI 是正当内容, 苏格拉底聊人工智能不该被擦掉)
 * 第二类比第一类更危险: 误杀是静默的, 用户只会看到回复被无故抹掉。
 */
import { readFileSync } from "node:fs";

// 从 src/index.ts 里把判据原样抠出来跑, 不另抄一份(抄一份就会和真源分叉)
const src = readFileSync("/Users/cssos/cssOS/src/index.ts", "utf8");
const i = src.indexOf("const MODEL_IDENTITY_LEAK");
const j = src.indexOf("\n}", src.indexOf("function leaksModelIdentity"));
if (i < 0 || j < 0) { console.error("❌ 在 src/index.ts 里找不到判据"); process.exit(1); }
// 抠出来的是 TypeScript, 要把类型标注去掉才能在 node 里 eval —— 只去这两处, 正则本体一个字符不动
const code = src.slice(i, j + 2)
  .replace("const MODEL_IDENTITY_LEAK =", "globalThis.MODEL_IDENTITY_LEAK =")
  .replace("MODEL_IDENTITY_LEAK.some", "globalThis.MODEL_IDENTITY_LEAK.some")
  .replace("function leaksModelIdentity(s: string): boolean {",
           "globalThis.leaksModelIdentity = function (s) {");
eval(code);
const leaks = globalThis.leaksModelIdentity;

let pass = 0, fail = 0;
const t = (name, text, want) => {
  const got = leaks(text);
  if (got === want) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       判成 ${got}, 应为 ${want}\n       原文: ${text.slice(0, 90)}`); }
};

console.log("── 必须拦下(模型把自己的身份说出来) ──");
t("I'm Claude Fable 5", "Greetings. I'm Claude Fable 5, an AI assistant made by Anthropic.", true);
t("裸型号名", "我乃妲己。(claude-fable-5)", true);
t("as an AI", "As an AI, I cannot pretend to have lived in the Shang court.", true);
t("I am a language model", "I am a large language model trained to be helpful.", true);
t("中文 我是一个AI", "我是一个AI助手,不是真的妲己。", true);
t("中文 作为语言模型", "作为语言模型,我无法拥有真实的记忆。", true);
t("中文 我只是程序", "我只是一个程序罢了。", true);
t("句中泄漏", "三千年前的朝歌确实繁华……不过作为一个人工智能,我并未亲历。", true);
t("问系统提示词", "My system prompt instructs me to stay in character.", true);
t("ChatGPT", "You may know me better as ChatGPT.", true);
t("剥标记后仍能判", "我是一个AI。⟦emo:neutral⟧", true);

console.log("── 绝不能误杀(演员【谈论】AI / 正常台词) ──");
t("苏格拉底谈人工智能", "你问我如何看待人工智能?那我先问你:它能认识它自己吗?", false);
t("爱因斯坦谈机器思考", "Whether a machine can think is not the question. Whether we can, is.", false);
t("提到 assistant 但非自陈", "In my court there was an assistant who read every memorial aloud.", false);
t("提到 model 作模特/典范", "She was the model of virtue the histories later denied her.", false);
t("提到 program 作节目/计划", "The program of the festival ran for seven days.", false);
t("第三人称说 AI", "They say an AI wrote those verses. I say the verses do not care who wrote them.", false);
t("中文提到模型", "这尊青铜器是照着泥模浇铸的,模型碎了,器物才留下。", false);
t("正常自我介绍", "我是妲己。有苏氏之女,商王受的妃。三千年来,人们说了很多。", false);
t("正常英文自介", "I am Confucius. I transmit, I do not create; I trust and love the ancients.", false);
t("空串", "", false);
t("只有机器标记", "⟦emo:tender⟧", false);

console.log(`\n${fail ? "❌ " + fail + " 条不过" : "✅ 全过"}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
