// The drawing behind a project with no photo yet (components/landing/schematics.tsx): its field,
// guessed from its tags and tools. Used by the project page, its reel and Home's build cards.
const FIELDS: [RegExp, string][] = [
  [/rocket|aero|flight|drone|uav|space|satellite|wind tunnel/i, "aerospace"],
  [/circuit|pcb|embedded|electr|stm32|arduino|kicad|fpga|power/i, "electrical"],
  [/bio|med|crispr|cell|protein/i, "biomedical"],
  [/chem|reaction|polymer/i, "chemical"],
  [/civil|bridge|struct|concrete/i, "civil"],
  [/\bai\b|\bml\b|machine learning|neural|model/i, "ai"],
  [/software|web|app|code|python|react|rust|typescript/i, "cs"],
  [/physics|optic|laser|quantum/i, "physics"],
];
export function schematicFor(tags: string[], tools: string[]): string {
  const text = [...tags, ...tools].join(" ");
  return FIELDS.find(([re]) => re.test(text))?.[1] ?? "mechanical";
}
