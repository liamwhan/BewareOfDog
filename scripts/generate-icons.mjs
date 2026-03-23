import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const png2icons = require('png2icons')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const inputPath = join(root, 'public', 'bod.png')
const buildDir = join(root, 'build')
mkdirSync(buildDir, { recursive: true })

const input = readFileSync(inputPath)
const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0)
writeFileSync(join(buildDir, 'icon.icns'), icns)
const ico = png2icons.createICO(input, png2icons.BICUBIC, 0, true, true)
writeFileSync(join(buildDir, 'icon.ico'), ico)
copyFileSync(inputPath, join(buildDir, 'icon.png'))

console.log('Wrote build/icon.icns, build/icon.ico, build/icon.png')
