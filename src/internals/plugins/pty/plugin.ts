import type { PluginContext, PluginResult } from './types.ts'
import { initManager, manager } from './pty/manager.ts'
import { initPermissions } from './pty/permissions.ts'
import { ptySpawn } from './pty/tools/spawn.ts'
import { ptyWrite } from './pty/tools/write.ts'
import { ptyRead } from './pty/tools/read.ts'
import { ptyList } from './pty/tools/list.ts'
import { ptyKill } from './pty/tools/kill.ts'

export const PTYPlugin = async ({ client, directory }: PluginContext): Promise<PluginResult> => {
  initPermissions(client, directory)
  initManager(client)

  return {
    tool: {
      pty_spawn: ptySpawn,
      pty_write: ptyWrite,
      pty_read: ptyRead,
      pty_list: ptyList,
      pty_kill: ptyKill,
    },
    event: async ({ event }) => {
      if (event.type === 'session.deleted') {
        manager.cleanupBySession(event.properties.info.id)
      }
    },
  }
}
