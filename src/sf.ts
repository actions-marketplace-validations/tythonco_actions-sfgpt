import * as cp from 'child_process'
import * as core from '@actions/core'
import * as dotenv from 'dotenv'
import {IFileContentsObject} from './interfaces'
import readFiles from './rf'
import spawnSync from './cp'

dotenv.config()

const ROOT_DIR_UNSANITIZED: string = core.getInput('root_dir') || './'
const ROOT_DIR: string = ROOT_DIR_UNSANITIZED.endsWith('/')
  ? ROOT_DIR_UNSANITIZED
  : `${ROOT_DIR_UNSANITIZED}/`
const CP_OPTIONS: cp.SpawnSyncOptions = {
  cwd: ROOT_DIR,
  encoding: 'utf-8',
  env: process.env,
  shell: true
}
const DIFF_DIR_UNSANITIZED: string =
  core.getInput('diff_dir') || 'sfDiffOutput/'
const DIFF_DIR: string = DIFF_DIR_UNSANITIZED.endsWith('/')
  ? DIFF_DIR_UNSANITIZED
  : `${DIFF_DIR_UNSANITIZED}/`
const DIFF_FROM: string = core.getInput('diff_from') || 'HEAD~1'
const DIFF_TO: string = core.getInput('diff_to') || 'HEAD'

export function cleanup(): void {
  spawnSync('rm', ['-rf', DIFF_DIR], CP_OPTIONS)
}

export function createDelta(): void {
  spawnSync('mkdir', ['-p', DIFF_DIR], CP_OPTIONS)
  spawnSync(
    'sfdx',
    [
      'sgd:source:delta',
      '--to',
      `${DIFF_TO}`,
      '--from',
      `${DIFF_FROM}`,
      '--generate-delta',
      '--output',
      `${DIFF_DIR}`
    ],
    CP_OPTIONS
  )
  spawnSync('rm', ['-rf', `${DIFF_DIR}destructiveChanges`], CP_OPTIONS)
  spawnSync('rm', ['-rf', `${DIFF_DIR}package`], CP_OPTIONS)
}

export function createSFMetadataContent(): string {
  const fileContentsObj: IFileContentsObject = {}
  readFiles(
    `${ROOT_DIR}${DIFF_DIR}`,
    (filename: string, content: string) => {
      fileContentsObj[filename] = content
    },
    (err: string | Error) => {
      if (err instanceof Error) throw new Error(err.message)
    }
  )
  let fileContents = ''
  Object.values(fileContentsObj).map(v => (fileContents += `${v}\n`))
  return fileContents
}

export function prep(): void {
  spawnSync('npm', [
    'install',
    'sfdx-cli',
    '--global',
    '--unsafe-perm=true',
    '--allow-root',
    '--silent'
  ])
  spawnSync('npm', [
    'install',
    'sfdx-git-delta',
    '--global',
    '--unsafe-perm=true',
    '--allow-root',
    '--silent'
  ])
  const npmPrefix = spawnSync('npm', ['config', 'get', 'prefix'], {
    encoding: 'utf-8',
    shell: true
  })
    ?.stdout?.toString()
    ?.trim()
  const sgdPath = `${npmPrefix}/lib/node_modules/sfdx-git-delta`
  try {
    spawnSync('sfdx', ['plugins:link', `${sgdPath}`], {
      encoding: 'utf-8',
      shell: true
    })
  } catch (err) {
    // Swallow error as sfdx plugins:link always returns a status code of 1
    // See: https://trailhead.salesforce.com/trailblazer-community/feed/0D53A00004f0GPYSA2
  }
}

export default {cleanup, createDelta, createSFMetadataContent, prep}
