import { expect, test } from "bun:test"

import { createBuiltinSkills } from "./skills"

test("website-copywriting is available as a builtin skill", () => {
  const skills = createBuiltinSkills()
  expect(skills.some((skill) => skill.name === "website-copywriting")).toBe(true)
})
