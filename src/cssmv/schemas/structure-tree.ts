export type StructuredWorkType = "single" | "triptych" | "opera";

export type StructuredNodeRole =
  | "single"
  | "triptych"
  | "part"
  | "opera"
  | "act"
  | "scene";

export interface StructurePlan {
  totalActs?: number;
  scenesPerAct?: number;
  scenesPerBatch?: number;
  targetActNumber?: number;
  sceneStart?: number;
  sceneEnd?: number;
  totalParts?: number;
  partsPerBatch?: number;
  targetPartNumber?: number;
}

export interface StructuredNode {
  nodeId: string;
  title: string;
  role: StructuredNodeRole;
  workType: StructuredWorkType;
  sequenceIndex: number;
  sourceSection?: string;
  children?: StructuredNode[];
}

type StructureSeedRow = {
  section?: string;
  title?: string;
};

function safeNodeTitle(value: string, fallback: string) {
  const title = String(value || "").trim();
  return title || fallback;
}

export function normalizeStructuredWorkType(
  value: unknown,
): StructuredWorkType {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "triptych") return "triptych";
  if (raw === "opera") return "opera";
  return "single";
}

function chunkRows<T>(items: T[], groups: number) {
  const safeGroups = Math.max(1, groups || 1);
  const chunkSize = Math.max(1, Math.ceil(items.length / safeGroups));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function positiveInt(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeStructurePlan(value: unknown): StructurePlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  const totalActs = positiveInt(plan.totalActs);
  const scenesPerAct = positiveInt(plan.scenesPerAct);
  const scenesPerBatch = positiveInt(plan.scenesPerBatch);
  const targetActNumber = positiveInt(plan.targetActNumber);
  const sceneStart = positiveInt(plan.sceneStart);
  const sceneEnd = positiveInt(plan.sceneEnd);
  const totalParts = positiveInt(plan.totalParts);
  const partsPerBatch = positiveInt(plan.partsPerBatch);
  const targetPartNumber = positiveInt(plan.targetPartNumber);
  if (
    !totalActs &&
    !scenesPerAct &&
    !scenesPerBatch &&
    !targetActNumber &&
    !sceneStart &&
    !sceneEnd &&
    !totalParts &&
    !partsPerBatch &&
    !targetPartNumber
  ) {
    return null;
  }
  return {
    ...(totalActs ? { totalActs } : {}),
    ...(scenesPerAct ? { scenesPerAct } : {}),
    ...(scenesPerBatch ? { scenesPerBatch } : {}),
    ...(targetActNumber ? { targetActNumber } : {}),
    ...(sceneStart ? { sceneStart } : {}),
    ...(sceneEnd ? { sceneEnd } : {}),
    ...(totalParts ? { totalParts } : {}),
    ...(partsPerBatch ? { partsPerBatch } : {}),
    ...(targetPartNumber ? { targetPartNumber } : {}),
  };
}

export function flattenStructuredLeaves(
  nodes: StructuredNode[],
): StructuredNode[] {
  const leaves: StructuredNode[] = [];
  const walk = (list: StructuredNode[]) => {
    list.forEach((node) => {
      const children = Array.isArray(node.children) ? node.children : [];
      if (!children.length) {
        leaves.push(node);
        return;
      }
      walk(children);
    });
  };
  walk(Array.isArray(nodes) ? nodes : []);
  return leaves;
}

export function inferStructureTreeFromSongSeed(args: {
  title?: string;
  lyrics?: string;
  workType?: unknown;
  sectionRows?: StructureSeedRow[];
  structurePlan?: StructurePlan | null;
}): StructuredNode[] {
  const title = safeNodeTitle(String(args.title || ""), "CSS MV");
  const workType = normalizeStructuredWorkType(args.workType);
  const structurePlan = normalizeStructurePlan(args.structurePlan);
  const rows = (Array.isArray(args.sectionRows) ? args.sectionRows : [])
    .map((row, index) => ({
      section: String(row?.section || "").trim(),
      title: safeNodeTitle(String(row?.title || ""), `Scene ${index + 1}`),
    }))
    .filter((row) => row.title);

  if (workType === "single") {
    return rows.map((row, index) => ({
      nodeId: `single_scene_${index + 1}`,
      title: row.title,
      role: "scene",
      workType,
      sequenceIndex: index + 1,
      sourceSection: row.section,
    }));
  }

  if (workType === "triptych") {
    const totalParts = Math.max(1, structurePlan?.totalParts || 3);
    const targetPartNumber = Math.min(
      totalParts,
      Math.max(1, structurePlan?.targetPartNumber || 1),
    );
    const partRows = rows.length
      ? rows.slice(0, Math.max(1, structurePlan?.partsPerBatch || 1))
      : [{ title: `${title} · Part ${targetPartNumber}`, section: "" }];
    return [
      {
        nodeId: "triptych_root",
        title,
        role: "triptych",
        workType,
        sequenceIndex: 1,
        children: [
          {
            nodeId: `part_${targetPartNumber}`,
            title: `${title} · Part ${targetPartNumber}`,
            role: "part",
            workType,
            sequenceIndex: targetPartNumber,
            children: partRows.map((row, sceneIndex) => ({
              nodeId: `part_${targetPartNumber}_scene_${sceneIndex + 1}`,
              title: row.title,
              role: "scene",
              workType,
              sequenceIndex: sceneIndex + 1,
              sourceSection: row.section,
            })),
          },
        ],
      },
    ];
  }

  const lyricBlockCount = String(args.lyrics || "")
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => String(line || "").trim())
        .filter(Boolean),
    )
    .filter((block) => block.length).length;
  const inferredTotalScenes = Math.max(rows.length, lyricBlockCount, 1);
  const inferredScenesPerAct =
    inferredTotalScenes <= 4
      ? inferredTotalScenes
      : inferredTotalScenes <= 8
        ? 4
        : inferredTotalScenes <= 15
          ? 5
          : 6;
  const totalActs = Math.max(
    1,
    structurePlan?.totalActs ||
      Math.ceil(inferredTotalScenes / inferredScenesPerAct),
  );
  const scenesPerAct = Math.max(
    1,
    structurePlan?.scenesPerAct ||
      Math.max(1, Math.ceil(inferredTotalScenes / totalActs)),
  );
  const targetActNumber = Math.min(
    totalActs,
    Math.max(1, structurePlan?.targetActNumber || 1),
  );
  const sceneStart = Math.min(
    scenesPerAct,
    Math.max(1, structurePlan?.sceneStart || 1),
  );
  const desiredBatchCount = Math.max(
    1,
    structurePlan?.sceneEnd && structurePlan.sceneEnd >= sceneStart
      ? structurePlan.sceneEnd - sceneStart + 1
      : structurePlan?.scenesPerBatch || rows.length || scenesPerAct,
  );
  const sceneEnd = Math.min(scenesPerAct, sceneStart + desiredBatchCount - 1);
  const effectiveRows = rows.length
    ? rows.slice(0, sceneEnd - sceneStart + 1)
    : Array.from({ length: sceneEnd - sceneStart + 1 }, (_, index) => ({
        title: `Scene ${sceneStart + index}`,
        section: "",
      }));
  return [
    {
      nodeId: "opera_root",
      title,
      role: "opera",
      workType,
      sequenceIndex: 1,
      children: [
        {
          nodeId: `act_${targetActNumber}`,
          title: `${title} · 第${targetActNumber}幕`,
          role: "act",
          workType,
          sequenceIndex: targetActNumber,
          children: effectiveRows.map((row, index) => {
            const absoluteSceneNumber = sceneStart + index;
            return {
              nodeId: `act_${targetActNumber}_scene_${absoluteSceneNumber}`,
              title: row.title || `Scene ${absoluteSceneNumber}`,
              role: "scene" as const,
              workType,
              sequenceIndex: absoluteSceneNumber,
              sourceSection: row.section,
            };
          }),
        },
      ],
    },
  ];
}
