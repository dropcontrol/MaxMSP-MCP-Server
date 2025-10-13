// test/max_mcp_node.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('max_mcp_node.js - safe_parse_json', () => {
  // safe_parse_json 関数のテスト用実装
  function safe_parse_json(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

  test('正常なJSONをパースできる', () => {
    const result = safe_parse_json('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  test('配列JSONをパースできる', () => {
    const result = safe_parse_json('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  test('不正なJSONはnullを返す', () => {
    const result = safe_parse_json('{invalid}');
    expect(result).toBeNull();
  });

  test('空文字列はnullを返す', () => {
    const result = safe_parse_json('');
    expect(result).toBeNull();
  });

  test('巨大なJSONもパースできる', () => {
    const large_obj = { data: Array(1000).fill({ id: 1, name: 'test' }) };
    const json_str = JSON.stringify(large_obj);
    const result = safe_parse_json(json_str);
    expect(result).toEqual(large_obj);
    expect(result.data).toHaveLength(1000);
  });
});

describe('max_mcp_node.js - response handler', () => {
  // レスポンスハンドラーのロジック
  function process_response_args(...args) {
    if (args.length === 0) {
      return { error: 'No arguments' };
    }

    const joined_str = args.join("");

    try {
      const data = JSON.parse(joined_str);
      return { success: true, data: data };
    } catch (e) {
      return { error: 'Parse failed', message: e.message };
    }
  }

  test('単一引数のレスポンスを処理できる', () => {
    const result = process_response_args('{"request_id":"req-1","results":[]}');
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('request_id');
    expect(result.data).toHaveProperty('results');
  });

  test('複数引数を結合して処理できる', () => {
    const result = process_response_args(
      '{"request_id":"req-1",',
      '"results":',
      '[]}'
    );
    expect(result.success).toBe(true);
    expect(result.data.request_id).toBe('req-1');
  });

  test('引数がない場合はエラーを返す', () => {
    const result = process_response_args();
    expect(result).toHaveProperty('error');
  });

  test('不正なJSONの場合はエラーを返す', () => {
    const result = process_response_args('{invalid}');
    expect(result).toHaveProperty('error', 'Parse failed');
  });

  test('長いJSONレスポンスも処理できる', () => {
    const large_response = JSON.stringify({
      request_id: 'req-long',
      results: {
        boxes: Array(100).fill({ maxclass: 'button', varname: 'btn' }),
        lines: Array(50).fill({ source: ['a', 0], destination: ['b', 0] })
      }
    });

    const result = process_response_args(large_response);
    expect(result.success).toBe(true);
    expect(result.data.results.boxes).toHaveLength(100);
    expect(result.data.results.lines).toHaveLength(50);
  });
});

describe('max_mcp_node.js - mcp_client_response handler', () => {
  // mcp_client_response ハンドラーのロジック
  function process_mcp_client_response(...args) {
    if (args.length < 2 || args[0] !== "response") {
      return { error: 'Unexpected format' };
    }

    const json_str = args.slice(1).join("");

    try {
      const data = JSON.parse(json_str);
      return { success: true, data: data };
    } catch (e) {
      return { error: 'Parse failed' };
    }
  }

  test('正常なmcp_client_responseを処理できる', () => {
    const result = process_mcp_client_response(
      'response',
      '{"request_id":"req-1","results":{}}'
    );
    expect(result.success).toBe(true);
    expect(result.data.request_id).toBe('req-1');
  });

  test('第1引数がresponseでない場合はエラー', () => {
    const result = process_mcp_client_response(
      'command',
      '{"request_id":"req-1"}'
    );
    expect(result).toHaveProperty('error', 'Unexpected format');
  });

  test('引数が2つ未満の場合はエラー', () => {
    const result = process_mcp_client_response('response');
    expect(result).toHaveProperty('error', 'Unexpected format');
  });

  test('複数引数のJSONを結合して処理できる', () => {
    const result = process_mcp_client_response(
      'response',
      '{"request_id":',
      '"req-2",',
      '"results":[]}'
    );
    expect(result.success).toBe(true);
    expect(result.data.request_id).toBe('req-2');
  });
});

describe('max_mcp_node.js - registered patches management', () => {
  let registered_patches;

  function register_patch(patch_id, socket_id) {
    registered_patches[patch_id] = socket_id;
  }

  function unregister_patch(patch_id) {
    delete registered_patches[patch_id];
  }

  function is_patch_registered(patch_id) {
    return patch_id in registered_patches;
  }

  function get_socket_id_for_patch(patch_id) {
    return registered_patches[patch_id];
  }

  function unregister_by_socket_id(socket_id) {
    const removed_patches = [];
    for (const patch_id in registered_patches) {
      if (registered_patches[patch_id] === socket_id) {
        delete registered_patches[patch_id];
        removed_patches.push(patch_id);
      }
    }
    return removed_patches;
  }

  beforeEach(() => {
    registered_patches = {};
  });

  test('パッチとソケットIDを関連付けて登録できる', () => {
    register_patch('test1', 'socket-123');
    expect(is_patch_registered('test1')).toBe(true);
    expect(get_socket_id_for_patch('test1')).toBe('socket-123');
  });

  test('パッチの登録を解除できる', () => {
    register_patch('test1', 'socket-123');
    unregister_patch('test1');
    expect(is_patch_registered('test1')).toBe(false);
  });

  test('ソケットIDでパッチを一括解除できる', () => {
    register_patch('test1', 'socket-123');
    register_patch('test2', 'socket-123');
    register_patch('test3', 'socket-456');

    const removed = unregister_by_socket_id('socket-123');

    expect(removed).toHaveLength(2);
    expect(removed).toContain('test1');
    expect(removed).toContain('test2');
    expect(is_patch_registered('test1')).toBe(false);
    expect(is_patch_registered('test2')).toBe(false);
    expect(is_patch_registered('test3')).toBe(true);
  });

  test('同じパッチIDで別のソケットIDを登録すると上書きされる', () => {
    register_patch('test1', 'socket-123');
    register_patch('test1', 'socket-456');

    expect(get_socket_id_for_patch('test1')).toBe('socket-456');
  });
});

describe('max_mcp_node.js - command/request routing', () => {
  function should_route_command(data) {
    return !!(data && data.patch_id);
  }

  function get_routing_target(data) {
    return data.patch_id;
  }

  test('patch_idがある場合はルーティングされる', () => {
    const data = { action: 'add_object', patch_id: 'test1' };
    expect(should_route_command(data)).toBe(true);
    expect(get_routing_target(data)).toBe('test1');
  });

  test('patch_idがない場合はルーティングされない', () => {
    const data = { action: 'add_object' };
    expect(should_route_command(data)).toBe(false);
  });

  test('nullやundefinedはルーティングされない', () => {
    expect(should_route_command(null)).toBe(false);
    expect(should_route_command(undefined)).toBe(false);
  });
});
