# kg_scripts - Adobe After Effects スクリプト集

**ke-go 自作の After Effects 用スクリプト集**

各スクリプトの詳細なドキュメントは [Docs](./Docs/) フォルダを参照してください。

---

## 📦 スクリプト一覧

| スクリプト | バージョン | 概要 |
|-----------|-----------|------|
| [kg_autorect.jsx](#kg_autorectjsx) | v1.5.0 | バウンディングボックス自動生成 |
| [kg_CustomWiggleProperty.jsx](#kg_customwigglepropertyjsx) | v1.1.2 | カスタムWiggleエクスプレッション |
| [kg_WiggleTransform.jsx](#kg_wiggletransformjsx) | v1.0.0 | トランスフォームWiggle（位置・スケール・回転） |
| [kg_EaseSync.jsx](#kg_easesyncjsx) | v1.2.0 | マザーレイヤーによるイージング同期 |
| [kg_BoundingBoxLines.jsx](#kg_boundingboxlinesjsx) | v1.2 | バウンディングボックス沿いの線 |
| [kg_pathmotion.jsx](#kg_pathmotionjsx) | v2.1.0 | マスクパスに沿った移動 |

---

## 🔧 インストール方法

1. スクリプトファイル（`.jsx`）を以下のフォルダに配置:
   - **Windows**: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS**: `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
2. After Effects を再起動
3. `ウィンドウ` メニューから各スクリプトを開く

---

## 📚 各スクリプトの概要

### kg_autorect.jsx

**バウンディングボックス自動生成スクリプト** - [詳細ドキュメント](./Docs/kg_autorect_README.md)

選択したレイヤー（テキスト、シェイプなど）のバウンディングボックスに合わせた長方形シェイプを自動生成します。

**主な機能:**
- 🎯 選択レイヤーに自動フィット
- 🔄 位置・サイズ変更に動的追従
- 🎛️ Padding / Width Offset / Height Offset をエフェクトで調整
- 📦 プリコンポーズ機能（位置・スケール・回転追従付き）
- 🔒 ベイク機能（静的シェイプに変換）

```
使い方: レイヤー選択 → Create (Fit) → 必要に応じてエフェクトで調整
```

---

### kg_CustomWiggleProperty.jsx

**カスタムWiggleエクスプレッション** - [詳細ドキュメント](./Docs/kg_CustomWiggleProperty_README.md)

選択したプロパティに特別なWiggleまたは累積エクスプレッションを適用します。

**主な機能:**
- 🎲 レイヤーごとに異なるシードでランダム動作
- 📊 始点/終点で大きく、中間で微細な振幅
- ⏱️ posterizeTime による制御
- 🎛️ ヌルオブジェクトまたはレイヤー単位でのコントロール

```
使い方: プロパティ選択 → モード選択（Wiggle/累積）→ パラメータ設定 → OK
```

---

### kg_WiggleTransform.jsx

**トランスフォームWiggle** - [詳細ドキュメント](./Docs/kg_WiggleTransform_README.md)

選択レイヤーのトランスフォームプロパティ（位置・スケール・回転）に特別なwiggleを適用。レイヤーの始点/終点で大きく揺れ、中間では微細な揺れになります。

**主な機能:**
- 📍 位置・スケール・回転を個別に選択可能
- 📈 端で大きく、中央で微細な振幅変化
- 🎲 レイヤーごとに異なるシードで自動ランダム
- 🎛️ 複数レイヤー選択時はヌルで一括制御
- ⏱️ posterizeTime によるフレームレート制御

```
使い方: レイヤー選択 → プロパティ選択（位置/スケール/回転）→ OK
```

---

### kg_EaseSync.jsx

**マザーレイヤーによるイージング同期** - [詳細ドキュメント](./Docs/kg_EaseSync_README.md)

マザーレイヤーのイージングカーブを他のレイヤーに適用し、複数レイヤーのアニメーションを同期させます。

**主な機能:**
- 👑 マザーレイヤーの作成
- 🔗 選択したキーフレームにイージングを適用
- 📐 5種類のイージングプリセット
- ❌ イージング解除機能

```
使い方: Create Mother → キーフレーム選択 → Apply Ease
```

---

### kg_BoundingBoxLines.jsx

**バウンディングボックス沿いの線** - [詳細ドキュメント](./Docs/kg_BoundingBoxLines_README.md)

レイヤーのバウンディングボックスに沿った線を動的に追加します。

**主な機能:**
- 📏 上下左右の各辺に線を追加
- 🔄 レイヤーサイズ変更に追従
- 📐 マージン調整可能
- 🎨 線の太さ・色をカスタマイズ

```
使い方: レイヤー選択 → 辺を選択 → 適用
```

---

### kg_pathmotion.jsx

**マスクパスに沿った移動** - [詳細ドキュメント](./Docs/kg_pathmotion_README.md)

マスクパスに沿ってレイヤーを移動させるアニメーションを作成します。

**主な機能:**
- 🛤️ パスに沿った移動アニメーション
- 🔄 Path Rotation による回転制御
- 📍 終点を現在位置に合わせる
- ➕ パス付きヌルの作成
- ✂️ オープンパス変換

```
使い方: レイヤー＋パスヌル選択 → Apply Motion
```

---

## 🐛 既知の問題と対策

### Object Invalid エラー

After Effects の ExtendScript では、DOM 操作後に参照が無効化されることがあります。本スクリプト集では以下の対策を実装しています：

- DOM 操作後に参照を再取得
- プロパティパスによる参照管理
- エラー発生時のデバッグログ出力

詳細: [ExtendScript_ObjectInvalidError.md](../ExtendScript_ObjectInvalidError.md)

---

## 📄 ライセンス

すべてのスクリプトはフリーで使用できます。

---

## 🔄 更新履歴

### 2024-01
- **kg_autorect.jsx v1.5.0**: Pre-Compose機能追加、Layer Control対応
- **kg_CustomWiggleProperty.jsx v1.1.2**: Object Invalid エラー対策

### 2023
- 初期リリース