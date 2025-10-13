// test/mcp_client.test.js
import { describe, test, expect, beforeEach, vi } from 'vitest';

// mcp_client.js の関数をテストするため、直接評価する
// Max/MSP環境では require が使えないため、テスト用に関数を抽出

describe('mcp_client.js - safe_parse_json', () => {
  // safe_parse_json 関数のテスト用実装
  function safe_parse_json(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      post("mcp-client: Invalid JSON: " + e.message + "\n");
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

  test('undefinedはnullを返す', () => {
    const result = safe_parse_json(undefined);
    expect(result).toBeNull();
  });

  test('nullはnullを返す（JSON.parse(null) は null を返すが、文字列"null"としてパースされる想定）', () => {
    const result = safe_parse_json('null');
    expect(result).toBeNull();
  });
});

describe('mcp_client.js - collect_objects', () => {
  let obj_count, boxes, lines;

  // collect_objects 関数のテスト用実装
  function collect_objects(obj) {
    if (obj.varname.substring(0, 8) == "maxmcpid" || obj.varname.substring(0, 10) == "mcp-client") {
      return;
    }
    if (!obj.varname) {
      obj.varname = "obj-" + obj_count;
    }
    obj_count += 1;

    var outputs = obj.patchcords.outputs;
    if (outputs.length) {
      for (var i = 0; i < outputs.length; i++) {
        lines.push({
          patchline: {
            source: [obj.varname, outputs[i].srcoutlet],
            destination: [outputs[i].dstobject.varname, outputs[i].dstinlet]
          }
        })
      }
    }
    boxes.push({
      box: {
        maxclass: obj.maxclass,
        varname: obj.varname,
        patching_rect: obj.rect,
      }
    })
  }

  beforeEach(() => {
    obj_count = 0;
    boxes = [];
    lines = [];
  });

  test('通常のオブジェクトを収集できる', () => {
    const obj = {
      varname: 'test_obj',
      maxclass: 'button',
      rect: [10, 20, 50, 60],
      patchcords: { outputs: [] }
    };

    collect_objects(obj);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].box.varname).toBe('test_obj');
    expect(boxes[0].box.maxclass).toBe('button');
    expect(obj_count).toBe(1);
  });

  test('maxmcpidプレフィックスのオブジェクトは除外される', () => {
    const obj = {
      varname: 'maxmcpid-1',
      maxclass: 'button',
      rect: [10, 20, 50, 60],
      patchcords: { outputs: [] }
    };

    collect_objects(obj);

    expect(boxes).toHaveLength(0);
    expect(obj_count).toBe(0);
  });

  test('mcp-clientプレフィックスのオブジェクトは除外される', () => {
    const obj = {
      varname: 'mcp-client-1',
      maxclass: 'button',
      rect: [10, 20, 50, 60],
      patchcords: { outputs: [] }
    };

    collect_objects(obj);

    expect(boxes).toHaveLength(0);
    expect(obj_count).toBe(0);
  });

  test('varnameが空の場合は自動生成される', () => {
    const obj = {
      varname: '',
      maxclass: 'button',
      rect: [10, 20, 50, 60],
      patchcords: { outputs: [] }
    };

    collect_objects(obj);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].box.varname).toBe('obj-0');
    expect(obj_count).toBe(1);
  });

  test('パッチコードを正しく収集できる', () => {
    const obj = {
      varname: 'source_obj',
      maxclass: 'button',
      rect: [10, 20, 50, 60],
      patchcords: {
        outputs: [
          {
            srcoutlet: 0,
            dstinlet: 0,
            dstobject: { varname: 'dest_obj' }
          }
        ]
      }
    };

    collect_objects(obj);

    expect(lines).toHaveLength(1);
    expect(lines[0].patchline.source).toEqual(['source_obj', 0]);
    expect(lines[0].patchline.destination).toEqual(['dest_obj', 0]);
  });

  test('複数のパッチコードを収集できる', () => {
    const obj = {
      varname: 'source_obj',
      maxclass: 'button',
      rect: [10, 20, 50, 60],
      patchcords: {
        outputs: [
          {
            srcoutlet: 0,
            dstinlet: 0,
            dstobject: { varname: 'dest_obj1' }
          },
          {
            srcoutlet: 1,
            dstinlet: 1,
            dstobject: { varname: 'dest_obj2' }
          }
        ]
      }
    };

    collect_objects(obj);

    expect(lines).toHaveLength(2);
    expect(boxes).toHaveLength(1);
  });
});

describe('mcp_client.js - send_response', () => {
  const my_patch_id = "test1";

  // send_response のロジック部分をテスト
  function create_response_object(request_id, result) {
    return {
      request_id: request_id,
      patch_id: my_patch_id,
      results: result
    };
  }

  test('正しいレスポンス構造を生成できる', () => {
    const response = create_response_object('req-123', { status: 'success' });

    expect(response).toHaveProperty('request_id', 'req-123');
    expect(response).toHaveProperty('patch_id', 'test1');
    expect(response).toHaveProperty('results');
    expect(response.results).toEqual({ status: 'success' });
  });

  test('resultsキーが正しく設定される（resultではない）', () => {
    const response = create_response_object('req-456', [1, 2, 3]);

    expect(response).toHaveProperty('results');
    expect(response).not.toHaveProperty('result'); // 旧キー名ではない
    expect(response.results).toEqual([1, 2, 3]);
  });

  test('JSONシリアライズ可能な構造である', () => {
    const response = create_response_object('req-789', {
      boxes: [],
      lines: []
    });

    expect(() => JSON.stringify(response)).not.toThrow();
    const json_str = JSON.stringify(response);
    expect(json_str).toContain('"results"');
    expect(json_str).toContain('"patch_id":"test1"');
  });
});

describe('mcp_client.js - should_exclude_object', () => {
  // オブジェクト除外判定のロジック
  function should_exclude_object(varname) {
    return varname.substring(0, 8) === "maxmcpid" ||
      varname.substring(0, 10) === "mcp-client";
  }

  test('maxmcpidプレフィックスは除外対象', () => {
    expect(should_exclude_object('maxmcpid-1')).toBe(true);
    expect(should_exclude_object('maxmcpid123')).toBe(true);
  });

  test('mcp-clientプレフィックスは除外対象', () => {
    expect(should_exclude_object('mcp-client-test')).toBe(true);
    expect(should_exclude_object('mcp-client123')).toBe(true);
  });

  test('通常のオブジェクト名は除外対象外', () => {
    expect(should_exclude_object('my_button')).toBe(false);
    expect(should_exclude_object('test_obj')).toBe(false);
    expect(should_exclude_object('cycle~')).toBe(false);
  });

  test('空文字列は除外対象外', () => {
    expect(should_exclude_object('')).toBe(false);
  });

  test('部分一致では除外されない', () => {
    expect(should_exclude_object('obj_maxmcpid')).toBe(false);
    expect(should_exclude_object('obj_mcp-client')).toBe(false);
  });
});
