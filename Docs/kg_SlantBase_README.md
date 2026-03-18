# kg_SlantBase.jsx

**スラントベース移動** — v1.1.0

**SlantBase ヌル**の回転角度を U 方向の基準として、選択レイヤーを **U/V 方向**（ヌルの傾きに沿った斜め方向）にオフセット移動させるパネル型スクリプトです。

---

## インストール

`.jsx` を `ScriptUI Panels` フォルダに配置し、AE 再起動後に `ウィンドウ` メニューから開きます。

---

## 概念

```
SlantBase ヌルの Rotation = θ とすると
  U 方向 = [cos θ, sin θ]   （ヌルの "右方向"）
  V 方向 = [-sin θ, cos θ]  （ヌルの "上方向"）
```

各ターゲットレイヤーの Position に追加したスライダー **Slant U** と **Slant V** の値だけ、その方向にずれます。
ヌルを回転させると全レイヤーのスラント方向が連動して変わります。

---

## 機能一覧

### Create SlantBase Null
コンプに **SlantBase** ヌルを作成します（複数作成時は "SlantBase 2" のように連番）。
ヌルの `Rotation` を変えることで U/V 軸方向を定義します。

### Attach Layers
選択レイヤーの Position に以下のエフェクト＋エクスプレッションを追加します。

| エフェクト | 説明 |
|-----------|------|
| SlantBase Null | 参照するヌルレイヤーを指定 |
| Slant U | U 方向へのオフセット量 (px) |
| Slant V | V 方向へのオフセット量 (px) |

### Align Rotation to Null
選択レイヤーの Rotation を SlantBase ヌルの Rotation にエクスプレッションで同期させます。
テキストや図形をスラント方向に整列させるときに使います。

### Detach Layers
選択レイヤーから Slant エクスプレッションとエフェクトを削除し、元の Position 値に戻します。

---

## 使い方

```
1. Create SlantBase Null でヌルを作成
2. ヌルの Rotation で傾き方向を調整
3. 移動させたいレイヤーを選択 → Attach Layers
4. 各レイヤーのエフェクトコントロールで Slant U / Slant V を調整
```

---

## 複数 SlantBase Null がある場合

Attach / Align 実行時にどのヌルを使うかドロップダウンで選択できます。
