import axe from 'axe-core'

/** Runs axe on a rendered screen and returns readable violations. */
export async function axeViolations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    // jsdom can't compute colours; contrast is checked in the browser audit.
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
}
