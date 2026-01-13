# Auto Rect Shape for Adobe After Effects

## 概要

**kg_autorect.jsx** は、選択したレイヤーのバウンディングボックスに合わせた長方形シェイプレイヤーを自動生成するAfter Effects用スクリプトです。テキストやシェイプの背景ボックスを素早く作成する際に便利です。

### バージョン
- 現在: **v1.5.0**

---

## 主な機能

| 機能 | 説明 |
|------|------|
| **自動フィット** | 選択レイヤーのバウンディングボックスに合わせた長方形を生成 |
| **動的追従** | ターゲットレイヤーの位置・サイズ変更に自動追従 |
| **Layer Control** | レイヤー名変更・順序変更に対応 |
| **エフェクト制御** | Padding / Width Offset / Height Offset をスライダーで調整可能 |
| **回転・スケール対応** | 親レイヤーが回転・スケールされていても正確にフィット |
| **パディング** | 長方形の余白を指定可能 |
| **角丸** | 角の丸みを指定可能 |
| **フィル/ストローク** | 塗りと線の有無を選択可能 |
| **ベイク機能** | エクスプレッションを静的な値に変換 |
| **プリコンポーズ** | シェイプをコンポジションに変換（位置・スケール・回転追従付き） |

---

## インストール方法

1. `kg_autorect.jsx` を保存
2. 以下のフォルダに配置:
   - **Windows**: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS**: `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
3. After Effectsを再起動
4. `ウィンドウ` → `kg_autorect` で開く

---

## 使い方

### 基本的な使い方

1. バウンディングボックスを作成したいレイヤーを選択
2. **Options** で設定:
   - **Default Padding**: 余白（px）
   - **Default Roundness**: 角丸（px）
   - **Add Fill**: 塗りを追加
   - **Add Stroke**: 線を追加（線幅も設定可能）
3. **Create (Fit)** をクリック

### エフェクトコントロールからの調整

作成後、シェイプレイヤーのエフェクトパネルから以下を調整可能：

| エフェクト | 説明 |
|-----------|------|
| **Target Layer** | 追従するレイヤー（Layer Control） |
| **Padding** | 余白の調整 |
| **Width Offset** | 幅の追加オフセット |
| **Height Offset** | 高さの追加オフセット |

### ベイク機能

エクスプレッションを削除して静的なシェイプに変換します。

1. 作成したAutoRectシェイプレイヤーを選択
2. **Bake (Static)** をクリック
3. 現在のフレームの値で固定され、エクスプレッションが削除される

### プリコンポーズ機能

シェイプレイヤーをコンポジションに変換します。変換後もターゲットレイヤーへの追従が維持されます。

1. AutoRectシェイプレイヤーを選択
2. **Pre-Compose** をクリック
3. 新しいコンポジションが作成され、元の位置に配置される

**追従動作:**
- **Position**: ターゲットのsourceRect中心をコンプ空間で追従
- **Scale**: `(現在のsourceRectサイズ / Bake時サイズ) × ターゲットのスケール`
- **Rotation**: ターゲットの回転値に追従

---

## UI解説

### Options パネル

| 項目 | 説明 |
|------|------|
| **Default Padding** | 長方形とレイヤーの間の余白（px） |
| **Default Roundness** | 角の丸み（px） |
| **Add Fill** | チェックで白い塗りを追加 |
| **Add Stroke** | チェックで黒い線を追加 |
| **Stroke** | 線の太さ（px） |

### ボタン

| ボタン | 機能 |
|--------|------|
| **Create (Fit)** | 選択レイヤーに合わせた長方形を作成 |
| **Bake (Static)** | エクスプレッションを削除して静的な値に変換 |
| **Pre-Compose** | シェイプをコンポジションに変換（追従付き） |

---

## 生成されるレイヤー構造

### 作成されるシェイプレイヤー

- **名前**: `AutoRect - [元レイヤー名]`
- **位置**: 元レイヤーの直下（背面）
- **デュレーション**: 元レイヤーのイン/アウトポイントに一致

### シェイプ構造

```
AutoRect - [レイヤー名]
└── Contents
    └── AutoRect (グループ)
        ├── Rect (長方形パス)
        ├── Fill (塗り) ※オプション
        └── Stroke (線) ※オプション
```

### エフェクト構造

```
Effects
├── Target Layer (Layer Control)
├── Padding (Slider)
├── Width Offset (Slider)
└── Height Offset (Slider)
```

---

## 仕組み

### Layer Controlによるレイヤー参照

従来のインデックスや名前による参照ではなく、Layer Controlエフェクトを使用することで：

- レイヤー名を変更しても追従が維持される
- レイヤー順序を変更しても追従が維持される

### sourceRectAtTimeの活用

スクリプトは `sourceRectAtTime()` を使用して、レイヤーの実際のバウンディングボックスを取得します。これにより：

- テキストレイヤーのテキスト変更に対応
- シェイプレイヤーのパス変更に対応
- マスクされた領域を考慮

### 座標変換

```javascript
// レイヤーローカル座標をコンポ座標に変換
var tlC = t.toComp([r.left, r.top]);
var trC = t.toComp([r.left + r.width, r.top]);
var blC = t.toComp([r.left, r.top + r.height]);
var brC = t.toComp([r.left + r.width, r.top + r.height]);

// コンポ座標からシェイプのローカル座標に変換
var tl = fromComp(tlC);
```

この2段階の変換により、元レイヤーが回転・スケールされていても正確にフィットします。

---

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 長方形が作成されない | sourceRectAtTimeが使えないレイヤー | 画像やソリッドには対応していません |
| サイズが合わない | 元レイヤーのアンカーポイント | 元レイヤーのアンカーポイントを確認 |
| ベイクできない | AutoRectレイヤーを選択していない | 名前が「AutoRect - 」で始まるレイヤーを選択 |
| 追従が外れる | 古いバージョン使用 | v1.5.0にアップデート（Layer Control対応） |

---

## ライセンス

このスクリプトはフリーで使用できます。

---

## 更新履歴

| バージョン | 内容 |
|-----------|------|
| 1.5.0 | Pre-Compose機能追加（位置・スケール・回転追従） |
| 1.4.0 | Layer Control・スライダーエフェクト追加、Object Invalid対策 |
| 1.3.4 | 回転・スケールに対応した座標変換 |
| 1.3.0 | Fill/Stroke オプション追加 |
| 1.2.0 | ベイク機能追加 |
| 1.0.0 | 初期リリース |
