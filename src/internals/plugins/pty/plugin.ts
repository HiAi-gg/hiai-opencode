import type { PluginContext, PluginResult } from './types'
import { initManager, manager } from './pty/manager'
import { initPermissions } from './pty/permissions'
import { ptySpawn } from './pty/tools/spawn'
import { ptyWrite } from './pty/tools/write'
import { ptyRead } from './pty/tools/read'
import { ptyList } from './pty/tools/list'
import { ptyKill } from './pty/tools/kill'

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
