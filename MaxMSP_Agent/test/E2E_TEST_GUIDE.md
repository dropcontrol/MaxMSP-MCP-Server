# E2Eテストガイド

このドキュメントは、MaxMSP-MCPサーバーのEnd-to-End（E2E）テストを実行するための手順を記載しています。ユーザーとClaudeが協力してテストを実施します。

## 前提条件

- Max/MSP 9以降がインストールされていること
- Node.js依存関係がインストールされていること（`npm install`済み）
- Pythonサーバーが起動可能な状態であること

## テスト環境のセットアップ

### 1. Max/MSP側の準備

1. **demo.maxpatを開く**
   ```
   MaxMSP_Agent/demo.maxpat
   ```

2. **Node.js環境を確認**
   - 最初のタブで `script npm version` メッセージをクリック
   - Maxウィンドウにnpmバージョンが表示されることを確認

3. **依存関係をインストール**
   - `script npm install` メッセージをクリック
   - インストール完了メッセージを確認

4. **Socket.IOサーバーを起動**
   - 2番目のタブに切り替え
   - `script start` メッセージをクリック
   - Max Consoleに以下が表示されることを確認：
     ```
     port-number: "Server listening on port 5002"
     ```

### 2. test1.maxpatを開く

1. **test1.maxpatを開く**
   ```
   MaxMSP_Agent/test1.maxpat
   ```

2. **パッチが登録されることを確認**
   - Max Consoleに以下が表示されることを確認：
     ```
     js: mcp-client initialized with patch_id: test1
     js: mcp-client[test1]: Created and connected receiver
     js: mcp-client[test1]: Created and connected sender to mcp_router_events
     js: mcp-router: ✓ Registered patch_id=test1
     js: mcp-client[test1]: Registration request sent
     node.script: mcp_router_register: test1 registered and broadcasted
     ```

### 3. Pythonサーバーの起動（Claudeが実行）

Claudeは以下を実行して、MCPサーバーがtest1パッチと通信できることを確認します：

```python
# list_registered_patches()を実行して"test1"が返ることを確認
```

## E2Eテストシナリオ

以下のテストを順番に実行します。各テストの実行はClaudeが行い、結果をユーザーが目視で確認します。

### テスト1: パッチ登録の確認

**目的**: パッチが正しく登録されているか確認

**Claudeが実行**:
```python
mcp__MaxMSPMCP__list_registered_patches()
```

**期待される結果**:
- 返り値: `"test1"`
- Max Console: 特にエラーなし

**ユーザー確認事項**:
- [ ] Max Consoleにエラーが表示されていないこと

---

### テスト2: オブジェクト領域の取得

**目的**: 既存オブジェクトが占める領域を取得できるか確認

**Claudeが実行**:
```python
mcp__MaxMSPMCP__get_avoid_rect_position(patch_id="test1")
```

**期待される結果**:
- 返り値: `[left, top, right, bottom]`（数値の配列）
- 例: `[10, 10, 231, 115]`

**Max Consoleログ**:
```
js: mcp-client[test1]: Processing: get_avoid_rect_position
js: mcp-client[test1]: Calculated avoid rect
js: mcp-client[test1]: Sending response via outlet, length=97
node.script: response handler called with 1 args
node.script: response: Emitted to Socket.IO for request_id=...
```

**ユーザー確認事項**:
- [ ] Max Consoleに上記のログが表示されていること
- [ ] エラーが表示されていないこと

---

### テスト3: パッチ内オブジェクトの取得

**目的**: パッチ内のオブジェクトとその接続情報を取得できるか確認

**Claudeが実行**:
```python
mcp__MaxMSPMCP__get_objects_in_patch(patch_id="test1")
```

**期待される結果**:
- 返り値: `{"boxes": [...], "lines": [...]}`
- `boxes`: MCPインフラオブジェクト（mcp_sender, mcp_receiver, mcp_js）が含まれる
- `lines`: オブジェクト間の接続情報

**Max Consoleログ**:
```
js: mcp-client[test1]: Processing: get_objects_in_patch
js: mcp-client[test1]: Fetched 3 objects
js: mcp-client[test1]: Sending response via outlet, length=...
node.script: response handler called with 1 args
node.script: response: Emitted to Socket.IO for request_id=...
```

**ユーザー確認事項**:
- [ ] Max Consoleに上記のログが表示されていること
- [ ] Fetchedオブジェクト数が適切であること

---

### テスト4: オブジェクトの追加

**目的**: パッチに新しいオブジェクトを追加できるか確認

**Claudeが実行**:
```python
mcp__MaxMSPMCP__add_max_object(
    patch_id="test1",
    position=[250, 150],
    obj_type="cycle~",
    varname="test_cycle",
    args=[440]
)
```

**期待される結果**:
- 返り値: `{"status": "success", "varname": "test_cycle"}`
- **パッチに`cycle~ 440`オブジェクトが表示される**

**Max Consoleログ**:
```
js: mcp-client[test1]: Processing: add_object
js: mcp-client[test1]: Added cycle~ as test_cycle
```

**ユーザー確認事項**:
- [ ] test1.maxpatに`cycle~ 440`オブジェクトが追加されたこと
- [ ] オブジェクトの位置が約(250, 150)であること
- [ ] Max Consoleにエラーが表示されていないこと

---

### テスト5: オブジェクトの接続

**目的**: 2つのオブジェクトを接続できるか確認

**事前準備**: テスト4で`test_cycle`を追加済み

**Claudeが実行**:
```python
# dac~を追加
mcp__MaxMSPMCP__add_max_object(
    patch_id="test1",
    position=[250, 200],
    obj_type="dac~",
    varname="test_dac",
    args=[]
)

# cycle~ と dac~ を接続
mcp__MaxMSPMCP__connect_max_objects(
    patch_id="test1",
    src_varname="test_cycle",
    outlet_idx=0,
    dst_varname="test_dac",
    inlet_idx=0
)
```

**期待される結果**:
- `dac~`オブジェクトが追加される
- `cycle~`から`dac~`へパッチコードが表示される

**Max Consoleログ**:
```
js: mcp-client[test1]: Added dac~ as test_dac
js: mcp-client[test1]: Connected test_cycle -> test_dac
```

**ユーザー確認事項**:
- [ ] test1.maxpatに`dac~`オブジェクトが追加されたこと
- [ ] `cycle~`の出力と`dac~`の入力がパッチコードで接続されていること
- [ ] パッチコードが視覚的に表示されていること

---

### テスト6: オブジェクト属性の変更

**目的**: オブジェクトの属性を変更できるか確認

**事前準備**: テスト4で`test_cycle`を追加済み

**Claudeが実行**:
```python
mcp__MaxMSPMCP__set_object_attribute(
    patch_id="test1",
    varname="test_cycle",
    attr_name="frequency",
    attr_value=[880]
)
```

**期待される結果**:
- `cycle~`の周波数が880Hzに変更される
- Max Consoleにログが表示される

**Max Consoleログ**:
```
js: mcp-client[test1]: Set attr frequency
```

**ユーザー確認事項**:
- [ ] Max Consoleに上記のログが表示されていること
- [ ] エラーが表示されていないこと
- （注: 属性変更は内部的に適用されるが、視覚的には確認しにくい）

---

### テスト7: パッチコードの切断

**目的**: オブジェクト間の接続を切断できるか確認

**事前準備**: テスト5で`test_cycle`と`test_dac`を接続済み

**Claudeが実行**:
```python
mcp__MaxMSPMCP__disconnect_max_objects(
    patch_id="test1",
    src_varname="test_cycle",
    outlet_idx=0,
    dst_varname="test_dac",
    inlet_idx=0
)
```

**期待される結果**:
- パッチコードが削除される

**Max Consoleログ**:
```
js: mcp-client[test1]: Disconnected test_cycle -X- test_dac
```

**ユーザー確認事項**:
- [ ] `cycle~`と`dac~`の間のパッチコードが削除されたこと
- [ ] Max Consoleに上記のログが表示されていること

---

### テスト8: オブジェクトの削除

**目的**: オブジェクトを削除できるか確認

**事前準備**: テスト4, 5でオブジェクトを追加済み

**Claudeが実行**:
```python
mcp__MaxMSPMCP__remove_max_object(
    patch_id="test1",
    varname="test_cycle"
)

mcp__MaxMSPMCP__remove_max_object(
    patch_id="test1",
    varname="test_dac"
)
```

**期待される結果**:
- `cycle~`と`dac~`がパッチから削除される

**Max Consoleログ**:
```
js: mcp-client[test1]: Removed test_cycle
js: mcp-client[test1]: Removed test_dac
```

**ユーザー確認事項**:
- [ ] test1.maxpatから`cycle~`オブジェクトが削除されたこと
- [ ] test1.maxpatから`dac~`オブジェクトが削除されたこと
- [ ] MCPインフラオブジェクトのみが残っていること

---

### テスト9: 最終状態の確認

**目的**: テスト後のパッチ状態を確認

**Claudeが実行**:
```python
mcp__MaxMSPMCP__get_objects_in_patch(patch_id="test1")
```

**期待される結果**:
- 返り値: MCPインフラオブジェクトのみ（mcp_sender, mcp_receiver, mcp_js）
- テスト用に追加したオブジェクトは削除されている

**ユーザー確認事項**:
- [ ] パッチがテスト前の状態に戻っていること
- [ ] 不要なオブジェクトが残っていないこと

---

## トラブルシューティング

### 問題1: パッチが登録されない

**症状**: `list_registered_patches()`が空を返す

**確認事項**:
- [ ] demo.maxpatが開いていること
- [ ] `script start`を実行済みであること
- [ ] test1.maxpatが開いていること
- [ ] Max Consoleに登録メッセージが表示されていること

**対処法**:
1. demo.maxpatで`script stop`を実行
2. `script start`を再実行
3. test1.maxpatを閉じて再度開く

---

### 問題2: タイムアウトエラー

**症状**: `No response received in 2.0 seconds.`

**確認事項**:
- [ ] Max Consoleに`Processing: <action>`が表示されていること
- [ ] Max Consoleに`Sending response via outlet`が表示されていること
- [ ] Max Consoleに`response handler called`が表示されていること

**対処法**:
1. Max ConsoleのログをClaudeに共有
2. Claudeが原因を特定
3. 必要に応じてコード修正

---

### 問題3: オブジェクトが表示されない

**症状**: `add_max_object`が成功したが、パッチにオブジェクトが表示されない

**確認事項**:
- [ ] test1.maxpatがロック状態（プレゼンテーションモード）でないこと
- [ ] Max Consoleに`Added <type> as <varname>`が表示されていること

**対処法**:
1. test1.maxpatのロックを解除（Command + E）
2. パッチを再描画（Command + R）

---

### 問題4: JSON parse error

**症状**: Max Consoleに`Invalid JSON`エラーが表示される

**原因**: パッチ内のオブジェクトが多すぎて、JSONが大きすぎる

**対処法**:
1. 一部のオブジェクトのみを選択してテスト
2. `get_objects_in_selected()`を使用

---

## テスト完了チェックリスト

全てのテストが完了したら、以下を確認してください：

- [ ] テスト1～9が全て成功した
- [ ] test1.maxpatがテスト前の状態に戻っている
- [ ] Max Consoleにエラーが表示されていない
- [ ] demo.maxpatとtest1.maxpatが正常に動作している

---

## 次のステップ

E2Eテストが成功したら、以下を実施してください：

1. **追加パッチでのテスト**
   - test2.maxpat, test3.maxpatなど、複数パッチで同時テスト
   - マルチパッチ対応の検証

2. **パフォーマンステスト**
   - 大量のオブジェクトを含むパッチでのテスト
   - レスポンスタイムの測定

3. **エッジケーステスト**
   - 不正なパラメータでの動作確認
   - 存在しないオブジェクトへの操作

---

## 参考情報

- ユニットテスト: `npm test`で実行可能（61テスト）
- テストカバレッジ: `npm run test:coverage`で確認可能
- テストUI: `npm run test:ui`でブラウザで確認可能

---

**最終更新**: 2025-10-13
**作成者**: Claude Code
