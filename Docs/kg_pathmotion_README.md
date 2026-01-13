# Mask Path Motion for Adobe After Effects

## 概要

**kg_pathmotion.jsx** は、マスクパスに沿ってレイヤーを移動させるAfter Effects用スクリプトです。テキストや図形をパスに沿ってアニメーションさせる際に便利です。

### バージョン
- 現在: **v2.0.0**

---

## 主な機能

| 機能 | 説明 |
|------|------|
| **パスモーション** | マスクパスの形状に沿ってレイヤーを移動 |
| **個別Progress制御** | 各レイヤーごとにProgress（0-100%）スライダーを追加 |
| **グラフエディタ対応** | 各レイヤーのProgressキーフレームをグラフエディタで編集可能 |
| **Path Rotation** | パス全体を回転させて動きの方向を変更 |
| **Auto-Orient** | レイヤーをパスの接線方向に自動的に回転（終点で元の角度に滑らかに戻る） |
| **複数レイヤー対応** | 複数レイヤーを一度に設定（PathMotion_Null使用） |
| **Delay機能** | 複数レイヤー時に階段状のディレイを設定可能 |
| **位置編集可能** | スクリプト適用後もレイヤーの位置を直接編集可能 |
| **Rotation Mode** | 複数レイヤー時のPath Rotationの分配方法を選択 |

---

## インストール方法

1. `kg_pathmotion.jsx` を保存
2. 以下のフォルダに配置:
   - **Windows**: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS**: `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
3. After Effectsを再起動
4. `ウィンドウ` → `kg_pathmotion` で開く

---

## 使い方

### 単一レイヤーモード

1. **マスクを持つレイヤーを選択**（そのレイヤー自身のマスクパスを使用）
2. **Timing** でアニメーションのDuration（継続フレーム数）を設定
3. **Options** でPath RotationやAuto-Orientを設定
4. **Apply Motion** をクリック

### 複数レイヤーモード

1. **Create Path Null** をクリック → `PathMotion_Null` が作成される（画面中央にS字カーブ）
2. ヌルのマスクパスを編集して希望の形状にする
3. `PathMotion_Null` + 動かしたい複数レイヤーを選択
4. **Multi-Layer Mode** で設定:
   - **Rotation**: Path Rotationの分配方法
     - **Fixed**: 全レイヤー同じPath Rotation
     - **Random**: 各レイヤーにランダムな角度（0-360°）
     - **Distribute (360/n)**: 均等に分割（4レイヤーなら0°, 90°, 180°, 270°）
   - **Delay**: レイヤー間のディレイ（フレーム数）
5. **Apply Motion** をクリック

---

## UI解説

### Mask パネル
- **Mask Index**: 使用するマスクの番号（1から開始）
- **Open Path**: 選択マスクをオープンパスに変換
- **Select Mask**: タイムラインでマスクを選択

### Timing パネル
- **Duration (frames)**: アニメーションの継続フレーム数（レイヤーのインポイントから開始）

### Options パネル
- **Path Rotation**: パス全体の回転角度（度）
- **Auto-Orient**: チェックで接線方向に回転（終点付近で元の角度に滑らかに戻る）

### Multi-Layer Mode パネル
- **Rotation**: 複数レイヤー時のPath Rotation分配方法
- **Delay (frames) per layer**: 各レイヤー間のディレイ（フレーム数）

### ボタン
- **Create Path Null**: マスクパス付きヌルレイヤーを作成（画面中央に配置）
- **Apply Motion**: モーションを適用

---

## 適用後のエフェクトコントロール

### 単一レイヤーモード

Apply Motion後、レイヤーに以下のエフェクトが追加されます：

| エフェクト名 | 種類 | 説明 |
|-------------|------|------|
| **Path Progress** | スライダー | 0-100%でパス上の位置を制御（キーフレーム済み） |
| **Path Rotation** | スライダー | パスの回転角度 |
| **Auto-Orient** | チェックボックス | 接線方向への回転ON/OFF |
| **End Position** | ポイント | 終点位置を調整 |

### 複数レイヤーモード

PathMotion_Nullに以下のエフェクトが追加されます：

| エフェクト名 | 種類 | 説明 |
|-------------|------|------|
| **Path Rotation** | スライダー | パスの回転角度（全レイヤー共通） |
| **Auto-Orient** | チェックボックス | 接線方向への回転ON/OFF（全レイヤー共通） |
| **Progress_Lx** | スライダー | 各レイヤー個別の進行度（xはレイヤーインデックス） |
| **EndPos_Lx** | ポイント | 各レイヤー個別の終点位置 |

---

## 新機能の詳細

### 個別Progress制御とグラフエディタ

複数レイヤーモードでは、各レイヤーに個別の`Progress_Lx`スライダーが追加されます。

**使い方：**
1. PathMotion_Nullを選択
2. エフェクトコントロールで`Progress_Lx`を展開
3. キーフレームを選択
4. グラフエディタでイージングカーブを自由に編集

これにより、各レイヤーに異なるイージング（イーズイン、イーズアウト、カスタムカーブなど）を設定できます。

### Delay機能

複数レイヤーを階段状に配置した場合など、アニメーションを順番に開始させることができます。

**動作：**
- 1番目のレイヤー: ディレイなし
- 2番目のレイヤー: 設定したフレーム数だけ遅れて開始
- 3番目のレイヤー: 2倍のフレーム数だけ遅れて開始
- ...

### 位置編集機能

スクリプト適用後も、レイヤーのPositionプロパティを直接編集できます。

**動作：**
- レイヤーをドラッグまたは数値入力で位置を変更
- パスモーション全体がオフセットされる
- Progress 100%の時、レイヤーは設定した位置に到達

### Auto-Orientの滑らかな終了

Auto-Orient機能を使用した場合、アニメーション終了時に元の回転角度に滑らかに戻ります。

**動作：**
- Progress 0〜70%: 接線方向に完全追従
- Progress 70〜100%: 接線方向から元の回転角度へスムーズに遷移
- Progress 100%: 完全に元の回転角度

---

## 実装の仕組み

### アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│                   UI Layer                          │
│  (ScriptUI Panel - buildUI function)                │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│               Apply Motion Function                 │
│  - パラメータ取得                                     │
│  - レイヤー/マスク検証                                │
│  - スライダーコントロール追加                          │
│  - エクスプレッション設定                              │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Expression Engine                      │
│  - Position Expression (ベジェ曲線計算)              │
│  - Rotation Expression (接線方向計算+ブレンド)       │
└─────────────────────────────────────────────────────┘
```

### Position エクスプレッションの仕組み

#### ベジェ曲線の計算

マスクパスはベジェ曲線で構成されています。エクスプレッションでは3次ベジェ曲線の公式を使用:

```javascript
// 3次ベジェ曲線の計算
function bezier(p0, c0, c1, p1, t) {
    var u = 1 - t;
    return [
        u*u*u*p0[0] + 3*u*u*t*c0[0] + 3*u*t*t*c1[0] + t*t*t*p1[0],
        u*u*u*p0[1] + 3*u*u*t*c0[1] + 3*u*t*t*c1[1] + t*t*t*p1[1]
    ];
}
```

#### 位置オフセットの計算

レイヤーの位置編集を反映するため、`value`との差分を加算:

```javascript
// 終点位置をPoint Controlから取得
var endPos = ctrl.effect("EndPos_Lx")(1).value;
// レイヤー位置の編集を反映
var posOffset = [value[0] - endPos[0], value[1] - endPos[1]];
[finalPt[0] + posOffset[0], finalPt[1] + posOffset[1]];
```

### Rotation エクスプレッションの仕組み

#### 元の角度への滑らかなブレンド

```javascript
// スムーズステップ関数（滑らかなブレンド）
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

// 終点付近（progress > 0.7）で元の回転値にブレンド
var blendStart = 0.7;
if (progress > blendStart) {
    var blendT = (progress - blendStart) / (1 - blendStart);
    blendT = smoothstep(blendT);
    // 角度の最短距離でブレンド
    var diff = origRot - tangentAngle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    tangentAngle + diff * blendT;
}
```

---

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| レイヤーが動かない | マスクがない | レイヤーにマスクを追加するか、Create Path Nullを使用 |
| 「マスクが見つかりません」 | Mask Indexが不正 | 正しいマスク番号を入力（1から開始） |
| 複数レイヤーで動かない | PathMotion_Null未選択 | PathMotion_Nullも一緒に選択 |
| エクスプレッションエラー | コンポ名に特殊文字 | コンポ名を英数字に変更 |
| 位置を編集できない | 古いバージョン | 最新バージョン(v2.0.0)に更新 |
| 同名レイヤーが同じ位置になる | - | v2.0.0で修正済み（レイヤーインデックスで管理） |

---

## ライセンス

このスクリプトはフリーで使用できます。

---

## 更新履歴

| バージョン | 内容 |
|-----------|------|
| 2.0.0 | 大幅リニューアル: 個別Progress制御、グラフエディタ対応、Delay機能、位置編集可能、Auto-Orientの滑らかな終了、同名レイヤー対応 |
| 1.5.1 | v1.5.0ベースに戻した安定版 |
| 1.5.0 | Create Path Nullボタン追加、複数レイヤー対応 |
| 1.4.0 | 複数レイヤーモード初期実装 |
| 1.3.0 | Multi-Layer Mode追加、Open Path/Select Maskボタン追加 |
| 1.2.0 | Auto-Orient機能追加 |
| 1.1.0 | Path Rotation機能追加 |
| 1.0.0 | 初期リリース |
