// test/mcp-router.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('mcp-router.js - registered patches management', () => {
  let registered_patches;

  // パッチ登録管理のロジック
  function register_patch(patch_id) {
    registered_patches[patch_id] = true;
    return true;
  }

  function unregister_patch(patch_id) {
    delete registered_patches[patch_id];
    return true;
  }

  function is_patch_registered(patch_id) {
    return !!registered_patches[patch_id];
  }

  function get_registered_patch_list() {
    const patch_list = [];
    for (const patch_id in registered_patches) {
      patch_list.push(patch_id);
    }
    return patch_list;
  }

  beforeEach(() => {
    registered_patches = {};
  });

  test('パッチを登録できる', () => {
    register_patch('test1');
    expect(is_patch_registered('test1')).toBe(true);
  });

  test('複数のパッチを登録できる', () => {
    register_patch('test1');
    register_patch('test2');
    register_patch('test3');

    expect(is_patch_registered('test1')).toBe(true);
    expect(is_patch_registered('test2')).toBe(true);
    expect(is_patch_registered('test3')).toBe(true);
  });

  test('パッチの登録を解除できる', () => {
    register_patch('test1');
    expect(is_patch_registered('test1')).toBe(true);

    unregister_patch('test1');
    expect(is_patch_registered('test1')).toBe(false);
  });

  test('登録されていないパッチはfalseを返す', () => {
    expect(is_patch_registered('nonexistent')).toBe(false);
  });

  test('登録済みパッチのリストを取得できる', () => {
    register_patch('test1');
    register_patch('test2');

    const list = get_registered_patch_list();
    expect(list).toHaveLength(2);
    expect(list).toContain('test1');
    expect(list).toContain('test2');
  });

  test('空の状態で登録リストを取得すると空配列を返す', () => {
    const list = get_registered_patch_list();
    expect(list).toHaveLength(0);
    expect(list).toEqual([]);
  });

  test('同じパッチIDを複数回登録しても重複しない', () => {
    register_patch('test1');
    register_patch('test1');
    register_patch('test1');

    const list = get_registered_patch_list();
    expect(list).toHaveLength(1);
    expect(list).toContain('test1');
  });
});

describe('mcp-router.js - message routing', () => {
  let registered_patches;

  function is_patch_registered(patch_id) {
    return !!registered_patches[patch_id];
  }

  function should_route_message(data) {
    // global command (no patch_id) は常にルーティング
    if (data.action === "list_registered_patches") {
      return true;
    }

    // patch_id がない場合はルーティングしない
    if (!data.patch_id) {
      return false;
    }

    // パッチが登録されていない場合はルーティングしない
    if (!is_patch_registered(data.patch_id)) {
      return false;
    }

    return true;
  }

  function get_message_type(data) {
    return data.request_id ? "request" : "command";
  }

  beforeEach(() => {
    registered_patches = {
      'test1': true,
      'test2': true
    };
  });

  test('list_registered_patches アクションは常にルーティングされる', () => {
    const data = { action: "list_registered_patches", request_id: "req-1" };
    expect(should_route_message(data)).toBe(true);
  });

  test('登録済みパッチへのメッセージはルーティングされる', () => {
    const data = { action: "add_object", patch_id: "test1" };
    expect(should_route_message(data)).toBe(true);
  });

  test('未登録パッチへのメッセージはルーティングされない', () => {
    const data = { action: "add_object", patch_id: "unknown" };
    expect(should_route_message(data)).toBe(false);
  });

  test('patch_idがないメッセージはルーティングされない（グローバルコマンド以外）', () => {
    const data = { action: "add_object" };
    expect(should_route_message(data)).toBe(false);
  });

  test('request_idがある場合はrequestタイプ', () => {
    const data = { action: "get_objects", request_id: "req-123" };
    expect(get_message_type(data)).toBe("request");
  });

  test('request_idがない場合はcommandタイプ', () => {
    const data = { action: "add_object" };
    expect(get_message_type(data)).toBe("command");
  });
});

describe('mcp-router.js - handle_list_registered_patches', () => {
  let registered_patches;

  function handle_list_registered_patches(request_id) {
    const patch_list = [];
    for (const patch_id in registered_patches) {
      patch_list.push(patch_id);
    }

    return {
      request_id: request_id,
      results: patch_list
    };
  }

  beforeEach(() => {
    registered_patches = {};
  });

  test('登録済みパッチのリストを含むレスポンスを生成できる', () => {
    registered_patches['test1'] = true;
    registered_patches['test2'] = true;

    const response = handle_list_registered_patches('req-123');

    expect(response).toHaveProperty('request_id', 'req-123');
    expect(response).toHaveProperty('results');
    expect(response.results).toHaveLength(2);
    expect(response.results).toContain('test1');
    expect(response.results).toContain('test2');
  });

  test('登録パッチがない場合は空配列を返す', () => {
    const response = handle_list_registered_patches('req-456');

    expect(response.results).toHaveLength(0);
    expect(response.results).toEqual([]);
  });

  test('レスポンスはJSON化可能', () => {
    registered_patches['test1'] = true;
    const response = handle_list_registered_patches('req-789');

    expect(() => JSON.stringify(response)).not.toThrow();
    const json_str = JSON.stringify(response);
    expect(json_str).toContain('"results"');
    expect(json_str).toContain('"request_id"');
  });
});

describe('mcp-router.js - JSON message parsing', () => {
  function is_json_message(msg) {
    if (!msg || msg.length === 0) {
      return false;
    }
    const json_str = Array.isArray(msg) ? msg.join(" ") : msg;
    return json_str.charAt(0) === '{';
  }

  test('JSONメッセージを識別できる', () => {
    expect(is_json_message(['{"action":"test"}'])).toBe(true);
    expect(is_json_message(['{"patch_id":"test1"}'])).toBe(true);
  });

  test('非JSONメッセージを識別できる', () => {
    expect(is_json_message(['test', 'message'])).toBe(false);
    expect(is_json_message(['list'])).toBe(false);
  });

  test('空メッセージはJSONではない', () => {
    expect(is_json_message([])).toBe(false);
    expect(is_json_message(null)).toBe(false);
    expect(is_json_message(undefined)).toBe(false);
  });

  test('配列形式のメッセージを結合して判定できる', () => {
    expect(is_json_message(['{', '"key":', '"value"', '}'])).toBe(true);
  });
});
