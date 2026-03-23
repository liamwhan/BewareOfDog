/// <reference types="vite/client" />

import type { ElectronApi } from '../preload/index'

interface Window {
  electron: ElectronApi
}
