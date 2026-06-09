import type { BuiltinSkill } from "./types";
import type { BrowserAutomationProvider } from "../../config/schema";

import {
  agentBrowserSkill,
  frontendUiUxSkill,
  gitMasterSkill,
  devBrowserSkill,
  reviewWorkSkill,
  aiSlopRemoverSkill,
  hiaiOpencodeSetupSkill,
  websiteCopywritingSkill,
} from "./skills/index";

export interface CreateBuiltinSkillsOptions {
  browserProvider?: BrowserAutomationProvider;
  disabledSkills?: Set<string>;
}

export function createBuiltinSkills(
  options: CreateBuiltinSkillsOptions = {},
): BuiltinSkill[] {
  const { disabledSkills } = options;

  const skills = [
    agentBrowserSkill,
    hiaiOpencodeSetupSkill,
    frontendUiUxSkill,
    gitMasterSkill,
    devBrowserSkill,
    reviewWorkSkill,
    aiSlopRemoverSkill,
    websiteCopywritingSkill,
  ];

  if (!disabledSkills) {
    return skills;
  }

  return skills.filter((skill) => !disabledSkills.has(skill.name));
}
