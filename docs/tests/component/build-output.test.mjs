import { describe, it, expect } from 'bun:test'
import { existsSync } from 'node:fs'

describe('VitePress build output', () => {
  it('vitepress config exists', () => {
    const configExists = existsSync('.vitepress/config.mts') || existsSync('.vitepress/config.ts')
    expect(configExists).toBe(true)
  })
})
