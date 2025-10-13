// test/setup.js
// Max/MSP JavaScript API のモック

import { vi } from 'vitest';

// グローバル変数のモック
global.autowatch = 1;
global.inlets = 1;
global.outlets = 1;

// Max API 関数のモック
global.post = vi.fn((message) => {
  // テスト時は console.log に出力
  if (process.env.DEBUG_TEST) {
    console.log('[MAX]', message);
  }
});

global.messnamed = vi.fn();
global.outlet = vi.fn();

// jsarguments のモック（デフォルト値）
global.jsarguments = ['mcp_client.js', 'test1'];

// Patcher オブジェクトのモック
const createMockPatcher = () => ({
  newdefault: vi.fn((x, y, type, ...args) => ({
    varname: '',
    maxclass: type,
    rect: [x, y, x + 100, y + 100],
    message: vi.fn(),
    getattrnames: vi.fn(() => []),
    getattr: vi.fn(),
    setattr: vi.fn()
  })),
  getnamed: vi.fn((varname) => ({
    varname: varname,
    maxclass: 'object',
    rect: [0, 0, 100, 100],
    message: vi.fn(),
    getattrnames: vi.fn(() => []),
    getattr: vi.fn(),
    setattr: vi.fn()
  })),
  connect: vi.fn(),
  disconnect: vi.fn(),
  remove: vi.fn(),
  applydeep: vi.fn(),
  applyif: vi.fn(),
  applydeepif: vi.fn()
});

// this.patcher のモック
global.p = createMockPatcher();

// this オブジェクトのモック
global.box = {
  varname: '',
  maxclass: 'js'
};

// messagename のモック（anything() で使用）
global.messagename = '';
global.arguments = [];

// Max.require のモック（max_mcp_node.js 用）
const mockMaxApi = {
  outlet: vi.fn(),
  post: vi.fn(),
  addHandler: vi.fn((name, handler) => {
    // ハンドラーを保存して後でテストできるようにする
    if (!mockMaxApi._handlers) {
      mockMaxApi._handlers = {};
    }
    mockMaxApi._handlers[name] = handler;
  }),
  _handlers: {}
};

// require のモック（max-api と socket.io 用）
vi.mock('max-api', () => ({
  default: mockMaxApi,
  Max: mockMaxApi
}));

vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    of: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn()
    })),
    close: vi.fn()
  }))
}));

export { mockMaxApi, createMockPatcher };
