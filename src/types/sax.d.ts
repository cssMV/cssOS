/* CSSOS_WAVE_1696 — sax 不随包提供类型。只声明本项目 musicxml.ts 用到的最小面,
 * 不引入 @types/sax 依赖(它已在 node_modules 里, 但未列入 package.json)。 */
declare module "sax" {
  export type Tag = { name: string; attributes: Record<string, string> };
  export interface SAXParser {
    onopentag: (node: Tag) => void;
    onclosetag: (name: string) => void;
    ontext: (t: string) => void;
    oncdata: (t: string) => void;
    write(chunk: string): SAXParser;
    close(): void;
  }
  export function parser(strict: boolean, opt?: Record<string, unknown>): SAXParser;
  const _default: { parser: typeof parser };
  export default _default;
}
