import type {
  AvailableCategory,
  AvailableSkill,
} from "./dynamic-agent-prompt-types";

function buildSkillsSection(skills: AvailableSkill[]): string {
  const builtinSkills = skills.filter((skill) => skill.location === "plugin");
  const customSkills = skills.filter((skill) => skill.location !== "plugin");

  const builtinNames = builtinSkills.map((skill) => skill.name).join(", ");
  const customNames = customSkills
    .map((skill) => {
      const source = skill.location === "project" ? "project" : "user";
      return `${skill.name} (${source})`;
    })
    .join(", ");

  if (customSkills.length > 0 && builtinSkills.length > 0) {
    return `#### Available Skills (via \`skill\` tool)

Skills are instruction packs, not agents. Do not look for \`strategist\`, \`critic\`, or \`researcher\` here; call agents with \`task(subagent_type="...")\`.

**Built-in**: ${builtinNames}
**⚡ YOUR SKILLS (PRIORITY)**: ${customNames}

> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.
> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`;
  }

  if (customSkills.length > 0) {
    return `#### Available Skills (via \`skill\` tool)

Skills are instruction packs, not agents. Do not look for \`strategist\`, \`critic\`, or \`researcher\` here; call agents with \`task(subagent_type="...")\`.

**⚡ YOUR SKILLS (PRIORITY)**: ${customNames}

> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.
> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`;
  }

  if (builtinSkills.length > 0) {
    return `#### Available Skills (via \`skill\` tool)

Skills are instruction packs, not agents. Do not look for \`strategist\`, \`critic\`, or \`researcher\` here; call agents with \`task(subagent_type="...")\`.

**Built-in**: ${builtinNames}

> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`;
  }

  return "";
}

export function buildCategorySkillsDelegationGuide(
  categories: AvailableCategory[],
  skills: AvailableSkill[],
): string {
  if (categories.length === 0 && skills.length === 0) {
    return "";
  }

  const categoryRows = categories.map((category) => {
    const description = category.description || category.name;
    return `- \`${category.name}\` - ${description}`;
  });

  const customSkills = skills.filter((skill) => skill.location !== "plugin");
  const skillsSection = buildSkillsSection(skills);
  const customPriorityNote =
    customSkills.length > 0
      ? `
> **User-installed skills get PRIORITY.** When in doubt, INCLUDE rather than omit.`
      : "";

  return `### Category + Skills Delegation

\`task()\` combines categories (domain-optimized models) and skills (instruction packs).

#### Available Categories
${categoryRows.join("\n")}

${skillsSection}

---

**STEP 1: Select Category** — match task to category domain.
**STEP 2: Evaluate ALL Skills** — for each, ask: "Does this overlap with my task?" → INCLUDE in \`load_skills=[...]\` if yes, OMIT if no.${customPriorityNote}

\`\`\`typescript
task(category="[domain]", load_skills=["skill-1", "skill-2"], prompt="...")
// ANTI-PATTERN: empty load_skills without justification
\`\`\`

### Category Domain Matching (ZERO TOLERANCE)
**VISUAL WORK = ALWAYS \`visual-engineering\`.** UI/UX/CSS/styling/layout/animation/design/frontend → \`visual-engineering\`. Hard logic/architecture/algorithms → \`ultrabrain\`. Research + end-to-end impl → \`deep\`. Trivial single-file fix → \`quick\`. **Almost never \`quick\` or \`unspecified-*\` — match the domain.**`;
}
