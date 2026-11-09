import type { Entry } from "./model";
export function mergeEntries(cloud: Entry[], local: Entry[]) {
  const result = [...cloud];
  for (const entry of local) {
    const existing = cloud.find((e) => e.id === entry.id);
    if (!existing) result.push(entry);
    else if (JSON.stringify(existing) !== JSON.stringify(entry))
      throw new Error(
        `「${entry.title}」在雲端與本機內容不同。請先各自匯出備份，再決定要保留的版本。`,
      );
  }
  return result;
}
