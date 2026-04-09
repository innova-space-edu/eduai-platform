// lib/superagent/registry.ts

import { SUPERAGENT_SKILLS } from "./config"
import type {
  SuperAgentSkillDefinition,
  SuperAgentSkillName,
  SuperAgentTarget,
} from "./types"

export function getAllSuperAgentSkills(): SuperAgentSkillDefinition[] {
  return SUPERAGENT_SKILLS
}

export function getEnabledSuperAgentSkills(): SuperAgentSkillDefinition[] {
  return SUPERAGENT_SKILLS.filter((skill) => skill.enabled)
}

export function getSkillByName(
  skillName: SuperAgentSkillName
): SuperAgentSkillDefinition | undefined {
  return SUPERAGENT_SKILLS.find((skill) => skill.name === skillName)
}

export function isSkillRegistered(skillName: SuperAgentSkillName): boolean {
  return SUPERAGENT_SKILLS.some((skill) => skill.name === skillName)
}

export function isSkillEnabled(skillName: SuperAgentSkillName): boolean {
  return SUPERAGENT_SKILLS.some(
    (skill) => skill.name === skillName && skill.enabled
  )
}

export function getSkillsForTarget(
  target: SuperAgentTarget
): SuperAgentSkillDefinition[] {
  return SUPERAGENT_SKILLS.filter((skill) =>
    skill.allowedTargets.includes(target)
  )
}

export function getEnabledSkillsForTarget(
  target: SuperAgentTarget
): SuperAgentSkillDefinition[] {
  return SUPERAGENT_SKILLS.filter(
    (skill) => skill.enabled && skill.allowedTargets.includes(target)
  )
}

export function getSafeSkills(): SuperAgentSkillDefinition[] {
  return SUPERAGENT_SKILLS.filter((skill) => skill.safeByDefault)
}

export function getSafeEnabledSkillsForTarget(
  target: SuperAgentTarget
): SuperAgentSkillDefinition[] {
  return SUPERAGENT_SKILLS.filter(
    (skill) =>
      skill.enabled &&
      skill.safeByDefault &&
      skill.allowedTargets.includes(target)
  )
}
