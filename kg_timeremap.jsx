// kg_timeremap.jsx
// After Effects CC 2025用 タイムリマップグリッドスクリプト
// 動画レイヤーをグリッド状に分割 or 縮小タイル配置し、各タイルの再生タイミングをパターンに応じてずらす

(function () {

    // ===== タイムリマップエクスプレッション生成関数 =====
    // 各タイルに埋め込む行・列インデックスを実数値として展開する

    function buildExpression(pattern, rowIdx, colIdx, totalCols, totalRows, maxOfs, gradName, tileCenterX, tileCenterY) {
        var expr = "";

        if (pattern === "diagonal") {
            // 対角線パターン：左上（0,0）から右下にかけてディレイが増加
            var denom = totalCols + totalRows - 2;
            var delay = (denom > 0) ? (maxOfs / denom) : 0;
            expr  = "// Diagonal パターン（行: " + rowIdx + ", 列: " + colIdx + "）\n";
            expr += "var row = " + rowIdx + ";\n";
            expr += "var col = " + colIdx + ";\n";
            expr += "var delay = " + delay + ";\n";
            expr += "time - delay * (row + col);";

        } else if (pattern === "radial") {
            // 放射パターン：グリッド中心から外側にかけてディレイが増加
            var cx = (totalCols - 1) / 2;
            var cy = (totalRows - 1) / 2;
            var maxDist = Math.sqrt(cx * cx + cy * cy);
            expr  = "// Radial パターン（行: " + rowIdx + ", 列: " + colIdx + "）\n";
            expr += "var row = " + rowIdx + ";\n";
            expr += "var col = " + colIdx + ";\n";
            expr += "var cx = " + cx + ";\n";
            expr += "var cy = " + cy + ";\n";
            expr += "var dist = Math.sqrt(Math.pow(col - cx, 2) + Math.pow(row - cy, 2));\n";
            expr += "var maxDist = " + maxDist + ";\n";
            expr += "time - " + maxOfs + " * (maxDist > 0 ? dist / maxDist : 0);";

        } else if (pattern === "leftright") {
            // 左→右パターン：列インデックスのみでディレイが増加（行は無関係）
            var denom = totalCols - 1;
            var delay = (denom > 0) ? (maxOfs / denom) : 0;
            expr  = "// Left→Right パターン（行: " + rowIdx + ", 列: " + colIdx + "）\n";
            expr += "var col = " + colIdx + ";\n";
            expr += "var delay = " + delay + ";\n";
            expr += "time - delay * col;";

        } else if (pattern === "gradient") {
            // グラデーション輝度パターン：指定レイヤーの輝度値でディレイを制御
            // タイル中心のコンプ座標をスクリプト実行時に定数として埋め込む。
            // fromComp() でグラデーションレイヤーのローカル空間に変換するため、
            // エフェクト・スケール・回転が掛かったレイヤーやプリコンプでも正しくサンプリングできる。
            expr  = "// Gradient Image パターン（行: " + rowIdx + ", 列: " + colIdx + "）\n";
            expr += "var gradLayer = thisComp.layer(\"" + gradName + "\");\n";
            expr += "// タイル中心のコンプ座標（定数）をグラデーションレイヤーのローカル座標に変換\n";
            expr += "var compCenter = [" + tileCenterX + ", " + tileCenterY + "];\n";
            expr += "var samplePoint = gradLayer.fromComp(compCenter);\n";
            expr += "var brightness = gradLayer.sampleImage(samplePoint, [1, 1], true, time)[0];\n";
            expr += "time - " + maxOfs + " * brightness;";
        }

        return expr;
    }

    // ===== ScriptUI ダイアログ作成 =====

    var dialog = new Window("dialog", "タイムリマップグリッド設定");
    dialog.orientation = "column";
    dialog.alignChildren = "fill";
    dialog.spacing = 8;
    dialog.margins = 16;

    // 列数入力
    var colsGroup = dialog.add("group");
    colsGroup.alignChildren = "center";
    var colsLabel = colsGroup.add("statictext", undefined, "列数 (Columns):");
    colsLabel.preferredSize.width = 210;
    var colsInput = colsGroup.add("edittext", undefined, "4");
    colsInput.preferredSize.width = 60;

    // 行数入力
    var rowsGroup = dialog.add("group");
    rowsGroup.alignChildren = "center";
    var rowsLabel = rowsGroup.add("statictext", undefined, "行数 (Rows):");
    rowsLabel.preferredSize.width = 210;
    var rowsInput = rowsGroup.add("edittext", undefined, "4");
    rowsInput.preferredSize.width = 60;

    // 最大オフセット秒数入力
    var offsetGroup = dialog.add("group");
    offsetGroup.alignChildren = "center";
    var offsetLabel = offsetGroup.add("statictext", undefined, "最大オフセット秒数 (Max Offset):");
    offsetLabel.preferredSize.width = 210;
    var offsetInput = offsetGroup.add("edittext", undefined, "1.0");
    offsetInput.preferredSize.width = 60;

    // グリッドモード選択パネル
    var modePanel = dialog.add("panel", undefined, "グリッドモード");
    modePanel.orientation = "column";
    modePanel.alignChildren = "left";
    modePanel.spacing = 6;
    modePanel.margins = [10, 15, 10, 10];

    var splitRb = modePanel.add("radiobutton", undefined, "Split（分割）— 動画を分割して各タイルに割り当てる");
    var tileRb  = modePanel.add("radiobutton", undefined, "Tile（縮小タイル）— 動画全体を縮小して敷き詰める");
    splitRb.value = true;

    // オフセットパターン選択パネル
    var patternPanel = dialog.add("panel", undefined, "オフセットパターン");
    patternPanel.orientation = "column";
    patternPanel.alignChildren = "left";
    patternPanel.spacing = 6;
    patternPanel.margins = [10, 15, 10, 10];

    var diagonalRb  = patternPanel.add("radiobutton", undefined, "Diagonal（左上→右下）");
    var radialRb    = patternPanel.add("radiobutton", undefined, "Radial（中心から外側）");
    var leftRightRb = patternPanel.add("radiobutton", undefined, "Left→Right（左から右）");
    var gradientRb  = patternPanel.add("radiobutton", undefined, "Gradient Image（グラデーション輝度ベース）");
    diagonalRb.value = true;

    // グラデーションレイヤー名入力欄（Gradient Image選択時のみ表示）
    var gradGroup = dialog.add("group");
    gradGroup.alignChildren = "center";
    var gradLabel = gradGroup.add("statictext", undefined, "グラデーションレイヤー名:");
    gradLabel.preferredSize.width = 210;
    var gradInput = gradGroup.add("edittext", undefined, "");
    gradInput.preferredSize.width = 150;
    gradGroup.visible = false;

    // ラジオボタンクリック時にグラデーション入力欄の表示を切り替える
    function updateGradVisibility() {
        gradGroup.visible = gradientRb.value;
        dialog.layout.layout(true);
        dialog.layout.resize();
    }
    diagonalRb.onClick  = updateGradVisibility;
    radialRb.onClick    = updateGradVisibility;
    leftRightRb.onClick = updateGradVisibility;
    gradientRb.onClick  = updateGradVisibility;

    // OK / キャンセルボタン
    var btnGroup = dialog.add("group");
    btnGroup.alignment = "right";
    var cancelBtn = btnGroup.add("button", undefined, "キャンセル", {name: "cancel"});
    var okBtn     = btnGroup.add("button", undefined, "OK",         {name: "ok"});

    // ダイアログ表示
    var dlgResult = dialog.show();
    if (dlgResult !== 1) return;

    // ===== 入力値の取得 =====

    var cols        = parseInt(colsInput.text,  10);
    var rows        = parseInt(rowsInput.text,   10);
    var maxOffset   = parseFloat(offsetInput.text);
    var gridMode    = splitRb.value ? "split" : "tile";
    var pattern;
    if      (diagonalRb.value)  { pattern = "diagonal"; }
    else if (radialRb.value)    { pattern = "radial"; }
    else if (leftRightRb.value) { pattern = "leftright"; }
    else                        { pattern = "gradient"; }
    var gradLayerName = gradInput.text;

    // ===== 入力値のバリデーション =====

    if (isNaN(cols) || cols < 1) {
        alert("列数が無効です。1 以上の整数を入力してください。");
        return;
    }
    if (isNaN(rows) || rows < 1) {
        alert("行数が無効です。1 以上の整数を入力してください。");
        return;
    }
    if (isNaN(maxOffset) || maxOffset <= 0) {
        alert("最大オフセット秒数が無効です。0 より大きい値を入力してください。");
        return;
    }
    if (pattern === "gradient" && gradLayerName === "") {
        alert("Gradient Image パターンを選択した場合は\nグラデーションレイヤー名を入力してください。");
        return;
    }

    // ===== アクティブなコンポジションを取得 =====

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("アクティブなアイテムがコンポジションではありません。\nコンポジションを開いてから実行してください。");
        return;
    }

    // ===== 選択レイヤーを取得 =====

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length !== 1) {
        alert("レイヤーを 1 つだけ選択してください。\n現在 " + selectedLayers.length + " 個選択されています。");
        return;
    }

    var srcLayer = selectedLayers[0];

    // AVLayer（映像・静止画・プリコンプ等）でなければ拒否
    if (!(srcLayer instanceof AVLayer)) {
        alert("選択されたレイヤーは動画レイヤーではありません。\n動画レイヤーを選択してください。");
        return;
    }

    // ソースを持たないレイヤー（テキスト・シェイプ等）は拒否
    if (!srcLayer.source) {
        alert("テキストレイヤーまたはシェイプレイヤーは対応していません。\n動画・静止画・プリコンプレイヤーを選択してください。");
        return;
    }

    // ===== メイン処理（Undo対応） =====

    app.beginUndoGroup("タイムリマップグリッド");

    try {
        var compWidth  = comp.width;
        var compHeight = comp.height;
        var tileWidth  = compWidth  / cols;
        var tileHeight = compHeight / rows;
        var srcIndex   = srcLayer.index;

        // ---- 1. プリコンプ化 ----
        // 全レイヤーの選択を解除し、対象レイヤーのみ選択してプリコンプ化
        var layerCount = comp.numLayers;
        for (var i = 1; i <= layerCount; i++) {
            comp.layer(i).selected = false;
        }
        srcLayer.selected = true;

        var precompName = srcLayer.name + "_TimeRemap";
        comp.layers.precompose([srcIndex], precompName, true);

        // プリコンプ化後のレイヤーを取得（元のインデックス位置に配置される）
        var precompLayer = comp.layer(srcIndex);

        // コンプ全体をカバーするようにトランスフォームをリセット
        precompLayer.transform.anchorPoint.setValue([compWidth / 2, compHeight / 2]);
        precompLayer.transform.position.setValue([compWidth / 2, compHeight / 2]);
        precompLayer.transform.scale.setValue([100, 100]);

        // ---- 2. プリコンプのソースコンプのデュレーションを maxOffset 分延長 ----
        // タイムリマップ式 "time - offset" により、最大 maxOffset 秒ディレイしたタイルは
        // コンプ終端で元映像の末尾に届かず映像が止まって見える。
        // ソースコンプを延長することで、ディレイ分だけ余分な再生時間を確保する。
        var precompSource = precompLayer.source; // CompItem
        precompSource.duration = precompSource.duration + maxOffset;

        // ---- 3. タイムリマップ有効化（複製前に設定することで複製にも引き継がれる） ----
        precompLayer.timeRemapEnabled = true;

        // ---- 4. グリッドタイル数分だけ複製 ----
        // precompLayer.duplicate() を呼ぶたびに複製が元レイヤーの上（小インデックス）に挿入され
        // 元レイヤー（precompLayer）が1つずつ下（大インデックス）に押し下げられる
        var totalTiles = cols * rows;
        for (var dup = 0; dup < totalTiles - 1; dup++) {
            precompLayer.duplicate();
        }

        // すべての複製後、元レイヤーの現在インデックスを取得
        // 先頭（firstIdx）から末尾（lastIdx = precompLayer.index）にグリッドレイヤーが並ぶ
        var lastLayerIdx  = precompLayer.index;
        var firstLayerIdx = lastLayerIdx - (totalTiles - 1);

        // グリッドレイヤーを配列に収集
        var gridLayers = [];
        for (var gi = 0; gi < totalTiles; gi++) {
            gridLayers.push(comp.layer(firstLayerIdx + gi));
        }

        // ---- 5. 各タイルにトランスフォーム・エクスプレッションを適用 ----
        var tileIdx = 0;
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var layer = gridLayers[tileIdx++];
                layer.name = "Tile_r" + r + "_c" + c;

                if (gridMode === "split") {
                    // ---- Split モード ----
                    // レクタングルマスクで該当タイル領域のみ表示する
                    // レイヤーはコンプ全体をカバーしており、マスク座標 = コンプ座標

                    var maskLeft   = c       * tileWidth;
                    var maskTop    = r       * tileHeight;
                    var maskRight  = (c + 1) * tileWidth;
                    var maskBottom = (r + 1) * tileHeight;

                    var masksProperty = layer.property("ADBE Mask Parade");
                    var newMask       = masksProperty.addProperty("ADBE Mask Atom");

                    var maskShape         = new Shape();
                    maskShape.vertices    = [
                        [maskLeft,  maskTop],
                        [maskRight, maskTop],
                        [maskRight, maskBottom],
                        [maskLeft,  maskBottom]
                    ];
                    maskShape.inTangents  = [[0, 0], [0, 0], [0, 0], [0, 0]];
                    maskShape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
                    maskShape.closed      = true;
                    newMask.property("ADBE Mask Shape").setValue(maskShape);

                } else {
                    // ---- Tile モード ----
                    // 動画全体を 1/cols × 1/rows に縮小し、各タイル位置に配置する
                    // アンカーはレイヤー中心（プリコンプのコンプサイズ中央）のまま

                    var scaleX = 100 / cols;
                    var scaleY = 100 / rows;

                    // タイル中心のコンプ座標にアンカーを置く
                    var posX = (c + 0.5) * tileWidth;
                    var posY = (r + 0.5) * tileHeight;

                    layer.transform.scale.setValue([scaleX, scaleY]);
                    layer.transform.position.setValue([posX, posY]);
                    // アンカーはプリコンプ中心のまま（precompLayer 設定を引き継ぐ）
                }

                // ---- レイヤーのアウトポイントを maxOffset 分延長 ----
                // ソースコンプのデュレーション延長に合わせて外側レイヤーも伸ばす
                layer.outPoint = layer.outPoint + maxOffset;

                // ---- タイムリマップエクスプレッションを設定 ----
                // タイル中心のコンプ座標を計算して渡す（Gradient Image パターンで使用）
                var tileCX = (c + 0.5) * tileWidth;
                var tileCY = (r + 0.5) * tileHeight;
                var expr = buildExpression(pattern, r, c, cols, rows, maxOffset, gradLayerName, tileCX, tileCY);
                layer.property("Time Remap").expression = expr;
            }
        }

        alert(
            "完了しました！\n" +
            cols + " 列 × " + rows + " 行（合計 " + totalTiles + " タイル）\n" +
            "パターン: " + pattern + "\n" +
            "最大オフセット: " + maxOffset + " 秒"
        );

    } catch (e) {
        alert(
            "エラーが発生しました:\n" +
            e.toString() +
            (e.line ? "\n行番号: " + e.line : "")
        );
    }

    app.endUndoGroup();

})();
