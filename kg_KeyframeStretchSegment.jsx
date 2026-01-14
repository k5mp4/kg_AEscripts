/**
 * kg_KeyframeStretchSegment.jsx
 *
 * 閉パス文字アウトラインの頂点を平行移動させ、
 * Pathプロパティにキーフレームとして記録する
 *
 * 機能:
 * - 2点で移動方向（角度）を決定
 * - 移動させる頂点を複数指定可能
 * - 頂点インデックスを視覚的に確認できるマーカー機能
 * - t0（現在時刻）に元の形、t1（現在時刻+Duration）に変形後の形をキーフレーム
 *
 * 対象: Shape Layer の Path（閉パスのみ）
 */

(function(thisObj) {

    // マーカーレイヤー管理用
    var markerLayers = [];

    // ============================================================
    // ビルドUI
    // ============================================================
    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Keyframe Stretch Segment", undefined, {resizeable: true});

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 6;
        panel.margins = 10;

        // === 頂点表示 ===
        var viewGroup = panel.add("panel", undefined, "Vertex Viewer");
        viewGroup.alignChildren = ["fill", "top"];
        viewGroup.spacing = 4;
        viewGroup.margins = 8;

        var viewBtnRow = viewGroup.add("group");
        viewBtnRow.alignment = ["fill", "top"];

        var showBtn = viewBtnRow.add("button", undefined, "Show");
        showBtn.preferredSize = [50, 25];
        showBtn.helpTip = "頂点にインデックス番号を表示";

        var deleteBtn = viewBtnRow.add("button", undefined, "Delete");
        deleteBtn.preferredSize = [50, 25];
        deleteBtn.helpTip = "マーカーを削除";

        var loadBtn = viewBtnRow.add("button", undefined, "Load List");
        loadBtn.alignment = ["fill", "center"];
        loadBtn.helpTip = "頂点リストを読み込み";

        // 頂点リスト表示エリア（図形表示用に拡大）
        var vertexList = viewGroup.add("edittext", undefined, "(Click 'Load List' to show vertices)", {multiline: true, readonly: true, scrolling: true});
        vertexList.preferredSize = [0, 140];
        vertexList.alignment = ["fill", "top"];

        // === 方向指定 ===
        var dirGroup = panel.add("panel", undefined, "Direction (2 points)");
        dirGroup.alignChildren = ["fill", "top"];
        dirGroup.spacing = 4;
        dirGroup.margins = 8;

        var dirHint = dirGroup.add("statictext", undefined, "Format: P-V (e.g. 1-0 = Path1, Vertex0)");
        dirHint.alignment = ["fill", "top"];

        var dirRow = dirGroup.add("group");
        dirRow.alignment = ["fill", "top"];
        dirRow.add("statictext", undefined, "From:");
        var fromInput = dirRow.add("edittext", undefined, "1-0");
        fromInput.preferredSize = [50, 25];
        fromInput.helpTip = "方向の始点 (パス番号-頂点番号)";
        dirRow.add("statictext", undefined, "To:");
        var toInput = dirRow.add("edittext", undefined, "1-1");
        toInput.preferredSize = [50, 25];
        toInput.helpTip = "方向の終点 (パス番号-頂点番号)";

        var dirInfoText = dirGroup.add("statictext", undefined, "Direction: [1-0] → [1-1]");
        dirInfoText.alignment = ["fill", "top"];

        // === 移動する頂点 ===
        var moveGroup = panel.add("panel", undefined, "Vertices to Move");
        moveGroup.alignChildren = ["fill", "top"];
        moveGroup.spacing = 4;
        moveGroup.margins = 8;

        var moveHint = moveGroup.add("statictext", undefined, "Format: P-V (e.g. 1-2, 1-3, 2-0)");
        moveHint.alignment = ["fill", "top"];

        var invertCb = moveGroup.add("checkbox", undefined, "Invert (specify fixed vertices)");
        invertCb.value = false;
        invertCb.helpTip = "チェック時: 動かさない頂点を指定";

        var moveInput = moveGroup.add("edittext", undefined, "1-1, 1-2, 1-3");
        moveInput.alignment = ["fill", "top"];
        moveInput.helpTip = "移動させる頂点（カンマ区切り, パス番号-頂点番号）";

        var moveInfoText = moveGroup.add("statictext", undefined, "Moving: 3 vertices");
        moveInfoText.alignment = ["fill", "top"];

        // === 入力パラメータ ===
        var inputGroup = panel.add("panel", undefined, "Parameters");
        inputGroup.alignChildren = ["fill", "top"];
        inputGroup.spacing = 4;
        inputGroup.margins = 8;

        var paramRow1 = inputGroup.add("group");
        paramRow1.add("statictext", undefined, "Distance:");
        var lengthInput = paramRow1.add("edittext", undefined, "20");
        lengthInput.preferredSize = [50, 25];
        lengthInput.helpTip = "移動距離 (px)";
        paramRow1.add("statictext", undefined, "px");

        var paramRow2 = inputGroup.add("group");
        paramRow2.add("statictext", undefined, "Duration:");
        var durationInput = paramRow2.add("edittext", undefined, "0.5");
        durationInput.preferredSize = [50, 25];
        durationInput.helpTip = "アニメーション時間 (sec)";
        paramRow2.add("statictext", undefined, "sec");

        // === オプション ===
        var optRow = panel.add("group");
        optRow.alignment = ["fill", "top"];

        var overwriteKeysCb = optRow.add("checkbox", undefined, "Overwrite keys");
        overwriteKeysCb.value = true;
        overwriteKeysCb.helpTip = "既存キーを上書き";

        var easeDropdown = optRow.add("dropdownlist", undefined, ["Linear", "Ease"]);
        easeDropdown.selection = 0;
        easeDropdown.preferredSize = [70, 25];

        // === 実行ボタン ===
        var execBtn = panel.add("button", undefined, "Keyframe Stretch");
        execBtn.alignment = ["fill", "bottom"];

        // ============================================================
        // イベントハンドラ
        // ============================================================

        // 頂点表示ボタン
        showBtn.onClick = function() {
            showVertexMarkers(vertexList);
        };

        // マーカー削除ボタン
        deleteBtn.onClick = function() {
            deleteMarkers();
        };

        // リスト読み込みボタン
        loadBtn.onClick = function() {
            loadVertexList(vertexList);
        };

        // 方向入力変更時
        fromInput.onChanging = toInput.onChanging = function() {
            var fromPV = parsePathVertex(fromInput.text);
            var toPV = parsePathVertex(toInput.text);
            if (fromPV && toPV) {
                dirInfoText.text = "Direction: [" + fromPV.path + "-" + fromPV.vertex + "] → [" + toPV.path + "-" + toPV.vertex + "]";
            } else {
                dirInfoText.text = "Direction: (enter P-V format)";
            }
        };

        // 移動頂点の情報更新関数
        function updateMoveInfo() {
            var pvList = parsePathVertexList(moveInput.text);
            if (invertCb.value) {
                // 反転モード：指定した頂点は固定
                if (pvList.length === 0) {
                    moveInfoText.text = "Fixed: (none) → All vertices move";
                } else {
                    var labels = [];
                    for (var i = 0; i < pvList.length; i++) {
                        labels.push(pvList[i].path + "-" + pvList[i].vertex);
                    }
                    moveInfoText.text = "Fixed: [" + labels.join(", ") + "]";
                }
            } else {
                // 通常モード
                if (pvList.length === 0) {
                    moveInfoText.text = "Moving: (enter P-V indices)";
                } else {
                    var labels = [];
                    for (var i = 0; i < pvList.length; i++) {
                        labels.push(pvList[i].path + "-" + pvList[i].vertex);
                    }
                    moveInfoText.text = "Moving: " + pvList.length + " [" + labels.join(", ") + "]";
                }
            }
        }

        // 移動頂点入力変更時
        moveInput.onChanging = updateMoveInfo;

        // 反転チェックボックス変更時
        invertCb.onClick = function() {
            updateMoveInfo();
            // ラベルも変更
            if (invertCb.value) {
                moveInput.helpTip = "固定する頂点（カンマ区切り, パス番号-頂点番号）";
            } else {
                moveInput.helpTip = "移動させる頂点（カンマ区切り, パス番号-頂点番号）";
            }
        };

        // 実行ボタン
        execBtn.onClick = function() {
            var params = {
                distance: parseFloat(lengthInput.text) || 0,
                duration: parseFloat(durationInput.text) || 0.5,
                overwriteKeys: overwriteKeysCb.value,
                easeType: easeDropdown.selection.index
            };

            var fromPV = parsePathVertex(fromInput.text);
            var toPV = parsePathVertex(toInput.text);
            var inputPVList = parsePathVertexList(moveInput.text);
            var invert = invertCb.value;

            executeStretch(params, fromPV, toPV, inputPVList, invert);
        };

        // パネル閉じ時にマーカー削除
        panel.onClose = function() {
            deleteMarkers();
        };

        // リサイズ対応
        panel.onResizing = panel.onResize = function() {
            this.layout.resize();
        };

        if (panel instanceof Window) {
            panel.center();
            panel.show();
        } else {
            panel.layout.layout(true);
            panel.layout.resize();
        }

        return panel;
    }

    // ============================================================
    // 全パスを取得
    // ============================================================
    function getAllPaths(layer) {
        var paths = [];
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return paths;

        function searchPaths(propGroup, groupName) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);

                if (prop.matchName === "ADBE Vector Shape - Group") {
                    var pathProp = prop.property("ADBE Vector Shape");
                    if (pathProp) {
                        paths.push({
                            prop: pathProp,
                            name: groupName ? groupName + "/" + prop.name : prop.name
                        });
                    }
                }

                if (prop.matchName === "ADBE Vector Group") {
                    var innerContents = prop.property("ADBE Vectors Group");
                    if (innerContents) {
                        searchPaths(innerContents, prop.name);
                    }
                }

                if (prop.numProperties !== undefined && prop.numProperties > 0 &&
                    prop.matchName !== "ADBE Vector Group") {
                    searchPaths(prop, groupName);
                }
            }
        }

        searchPaths(contents, "");
        return paths;
    }

    // ============================================================
    // 頂点リストを視覚的に表示（ASCII図形）
    // ============================================================
    function loadVertexList(listBox) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            listBox.text = "(No active composition)";
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            listBox.text = "(No layer selected)";
            return;
        }

        var layer = selectedLayers[0];
        if (!(layer instanceof ShapeLayer)) {
            listBox.text = "(Not a Shape Layer)";
            return;
        }

        // 全パスを取得
        var allPaths = getAllPaths(layer);
        if (allPaths.length === 0) {
            listBox.text = "(No path found)";
            return;
        }

        var output = [];

        for (var p = 0; p < allPaths.length; p++) {
            var pathNum = p + 1; // 1から始まるパス番号
            var pathData = allPaths[p];
            var shape = pathData.prop.value;
            var vertices = shape.vertices;
            var N = vertices.length;

            if (N === 0) continue;

            output.push("=== Path " + pathNum + ": " + pathData.name + " (" + N + " pts) ===");
            output.push(renderVertexDiagram(vertices, pathNum));
            output.push("");
        }

        listBox.text = output.join("\n");
    }

    // ============================================================
    // 頂点配置を図形として描画（パス番号付き）
    // ============================================================
    function renderVertexDiagram(vertices, pathNum) {
        var N = vertices.length;
        if (N === 0) return "";

        // 座標の範囲を計算
        var minX = vertices[0][0], maxX = vertices[0][0];
        var minY = vertices[0][1], maxY = vertices[0][1];

        for (var i = 1; i < N; i++) {
            if (vertices[i][0] < minX) minX = vertices[i][0];
            if (vertices[i][0] > maxX) maxX = vertices[i][0];
            if (vertices[i][1] < minY) minY = vertices[i][1];
            if (vertices[i][1] > maxY) maxY = vertices[i][1];
        }

        // グリッドサイズ（文字数）
        var gridW = 24;
        var gridH = 10;

        // 範囲が0の場合の処理
        var rangeX = maxX - minX;
        var rangeY = maxY - minY;
        if (rangeX < 1) rangeX = 1;
        if (rangeY < 1) rangeY = 1;

        // グリッドを初期化
        var grid = [];
        for (var y = 0; y < gridH; y++) {
            var row = [];
            for (var x = 0; x < gridW; x++) {
                row.push(" ");
            }
            grid.push(row);
        }

        // 頂点を配置（座標をグリッドに変換）
        var positions = [];
        for (var i = 0; i < N; i++) {
            var gx = Math.round((vertices[i][0] - minX) / rangeX * (gridW - 3));
            var gy = Math.round((vertices[i][1] - minY) / rangeY * (gridH - 1));

            // 範囲内に収める
            gx = Math.max(0, Math.min(gridW - 3, gx));
            gy = Math.max(0, Math.min(gridH - 1, gy));

            positions.push({idx: i, gx: gx, gy: gy});
        }

        // 接続線を描画（簡易版）
        for (var i = 0; i < N; i++) {
            var curr = positions[i];
            var next = positions[(i + 1) % N];

            // 線を描画（ブレゼンハムの簡易版）
            drawLine(grid, curr.gx, curr.gy, next.gx, next.gy, gridW, gridH);
        }

        // 頂点番号を配置（パス番号-頂点番号形式、線の上に上書き）
        for (var i = 0; i < positions.length; i++) {
            var pos = positions[i];
            var label = pathNum + "-" + pos.idx;

            // ラベルを配置
            for (var c = 0; c < label.length && pos.gx + c < gridW; c++) {
                grid[pos.gy][pos.gx + c] = label.charAt(c);
            }
        }

        // グリッドを文字列に変換
        var lines = [];
        for (var y = 0; y < gridH; y++) {
            lines.push(grid[y].join(""));
        }

        return lines.join("\n");
    }

    // ============================================================
    // 線を描画（簡易ブレゼンハム）
    // ============================================================
    function drawLine(grid, x0, y0, x1, y1, gridW, gridH) {
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1;
        var sy = y0 < y1 ? 1 : -1;
        var err = dx - dy;

        var x = x0, y = y0;
        var maxSteps = gridW + gridH; // 無限ループ防止

        for (var step = 0; step < maxSteps; step++) {
            // 始点・終点以外に線を描画
            if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1)) {
                if (y >= 0 && y < gridH && x >= 0 && x < gridW) {
                    if (grid[y][x] === " ") {
                        // 方向に応じた文字を選択
                        if (dx > dy * 2) {
                            grid[y][x] = "-";
                        } else if (dy > dx * 2) {
                            grid[y][x] = "|";
                        } else {
                            grid[y][x] = (sx === sy) ? "\\" : "/";
                        }
                    }
                }
            }

            if (x === x1 && y === y1) break;

            var e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    // ============================================================
    // 頂点マーカーを表示（全パス対応）
    // ============================================================
    function showVertexMarkers(listBox) {
        // 既存マーカーを削除
        deleteMarkers();

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Error: No active composition.");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("Error: No layer selected.");
            return;
        }

        var layer = selectedLayers[0];
        if (!(layer instanceof ShapeLayer)) {
            alert("Error: Selected layer is not a Shape Layer.");
            return;
        }

        // 全パスを取得
        var allPaths = getAllPaths(layer);
        if (allPaths.length === 0) {
            alert("Error: No path found.");
            return;
        }

        // レイヤーのトランスフォームを取得
        var layerPos = layer.position.value;
        var layerAnchor = layer.anchorPoint.value;
        var layerScale = layer.scale.value;

        // パスごとに色を変える（複数パス識別用）
        var pathColors = [
            [1, 1, 0],      // 黄色
            [0, 1, 1],      // シアン
            [1, 0.5, 1],    // ピンク
            [0.5, 1, 0.5],  // ライトグリーン
            [1, 0.7, 0.3],  // オレンジ
            [0.7, 0.7, 1]   // ライトブルー
        ];

        app.beginUndoGroup("Show Vertex Markers");

        try {
            var totalVertices = 0;

            // 各パスの頂点にマーカーを作成
            for (var p = 0; p < allPaths.length; p++) {
                var pathNum = p + 1; // 1から始まるパス番号
                var pathData = allPaths[p];
                var shape = pathData.prop.value;
                var vertices = shape.vertices;
                var N = vertices.length;

                if (N === 0) continue;

                // このパスの色を選択
                var color = pathColors[p % pathColors.length];
                var labelColor = (p % 16) + 1; // AEラベルカラー

                // 各頂点にテキストマーカーを作成
                for (var i = 0; i < N; i++) {
                    var vtx = vertices[i];

                    // レイヤー座標からコンポジション座標に変換
                    var compX = layerPos[0] + (vtx[0] - layerAnchor[0]) * (layerScale[0] / 100);
                    var compY = layerPos[1] + (vtx[1] - layerAnchor[1]) * (layerScale[1] / 100);

                    // テキストレイヤーを作成（パス番号-頂点番号形式）
                    var textLayer = comp.layers.addText(pathNum + "-" + i);
                    textLayer.name = "_vtx_P" + pathNum + "_" + i;

                    // テキストプロパティを設定
                    var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
                    var textDoc = textProp.value;
                    textDoc.fontSize = 14;
                    textDoc.fillColor = color;
                    textDoc.strokeColor = [0, 0, 0];
                    textDoc.strokeWidth = 2;
                    textDoc.applyStroke = true;
                    textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                    textProp.setValue(textDoc);

                    // 位置を設定
                    textLayer.position.setValue([compX, compY - 10]);
                    textLayer.label = labelColor;

                    markerLayers.push(textLayer);
                }

                // 頂点0に開始点マーカー（丸）
                var startMarker = comp.layers.addShape();
                startMarker.name = "_vtx_P" + (p + 1) + "_start";
                var contents = startMarker.property("ADBE Root Vectors Group");
                var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
                ellipse.property("ADBE Vector Ellipse Size").setValue([14, 14]);
                var fill = contents.addProperty("ADBE Vector Graphic - Fill");
                fill.property("ADBE Vector Fill Color").setValue([color[0], color[1], color[2], 1]);

                var vtx0 = vertices[0];
                var comp0X = layerPos[0] + (vtx0[0] - layerAnchor[0]) * (layerScale[0] / 100);
                var comp0Y = layerPos[1] + (vtx0[1] - layerAnchor[1]) * (layerScale[1] / 100);
                startMarker.position.setValue([comp0X, comp0Y]);
                startMarker.label = labelColor;

                markerLayers.push(startMarker);

                totalVertices += N;
            }

        } catch (e) {
            alert("Error creating markers: " + e.toString());
        }

        app.endUndoGroup();

        // リストも更新
        loadVertexList(listBox);

        // 選択を元のレイヤーに戻す
        for (var m = 0; m < markerLayers.length; m++) {
            markerLayers[m].selected = false;
        }
        layer.selected = true;
    }

    // ============================================================
    // マーカーを削除
    // ============================================================
    function deleteMarkers() {
        if (markerLayers.length === 0) return;

        app.beginUndoGroup("Delete Vertex Markers");

        for (var i = markerLayers.length - 1; i >= 0; i--) {
            try {
                if (markerLayers[i] && markerLayers[i].parentComp) {
                    markerLayers[i].remove();
                }
            } catch (e) {
                // 既に削除されている場合は無視
            }
        }
        markerLayers = [];

        app.endUndoGroup();
    }

    // ============================================================
    // インデックス文字列をパース（カンマ区切り）- 旧形式互換用
    // ============================================================
    function parseIndices(text) {
        var indices = [];
        var parts = text.split(",");

        for (var i = 0; i < parts.length; i++) {
            var trimmed = parts[i].replace(/\s/g, "");
            if (trimmed !== "") {
                var num = parseInt(trimmed, 10);
                if (!isNaN(num)) {
                    indices.push(num);
                }
            }
        }

        return indices;
    }

    // ============================================================
    // パス-頂点形式をパース（例: "1-0" → {path: 1, vertex: 0}）
    // ============================================================
    function parsePathVertex(text) {
        if (!text) return null;
        var trimmed = text.replace(/\s/g, "");
        var parts = trimmed.split("-");
        if (parts.length !== 2) return null;

        var pathNum = parseInt(parts[0], 10);
        var vertexNum = parseInt(parts[1], 10);

        if (isNaN(pathNum) || isNaN(vertexNum)) return null;
        if (pathNum < 1) return null; // パス番号は1から

        return { path: pathNum, vertex: vertexNum };
    }

    // ============================================================
    // パス-頂点リストをパース（例: "1-0, 1-1, 2-0"）
    // ============================================================
    function parsePathVertexList(text) {
        var result = [];
        var parts = text.split(",");

        for (var i = 0; i < parts.length; i++) {
            var pv = parsePathVertex(parts[i]);
            if (pv) {
                result.push(pv);
            }
        }

        return result;
    }

    // ============================================================
    // 選択されたパスを取得
    // ============================================================
    function getSelectedPath(layer) {
        var result = {
            pathProp: null,
            pathName: ""
        };

        // 選択されたプロパティからPathを探す
        var selectedProps = layer.selectedProperties;

        for (var i = 0; i < selectedProps.length; i++) {
            var prop = selectedProps[i];

            if (prop.matchName === "ADBE Vector Shape") {
                result.pathProp = prop;
                result.pathName = prop.parentProperty ? prop.parentProperty.name : "Path";
                return result;
            }

            if (prop.matchName === "ADBE Vector Shape - Group") {
                var innerPath = prop.property("ADBE Vector Shape");
                if (innerPath) {
                    result.pathProp = innerPath;
                    result.pathName = prop.name;
                    return result;
                }
            }

            if (prop.matchName === "ADBE Vector Group") {
                var contents = prop.property("ADBE Vectors Group");
                if (contents) {
                    for (var j = 1; j <= contents.numProperties; j++) {
                        var child = contents.property(j);
                        if (child.matchName === "ADBE Vector Shape - Group") {
                            var innerPath2 = child.property("ADBE Vector Shape");
                            if (innerPath2) {
                                result.pathProp = innerPath2;
                                result.pathName = child.name;
                                return result;
                            }
                        }
                    }
                }
            }
        }

        // 見つからない場合は最初のPathを使用
        var firstPath = findFirstPath(layer);
        if (firstPath) {
            result.pathProp = firstPath.prop;
            result.pathName = firstPath.name;
        }

        return result;
    }

    // ============================================================
    // 最初のPathを検索
    // ============================================================
    function findFirstPath(layer) {
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return null;

        var result = null;

        function searchPath(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);

                if (prop.matchName === "ADBE Vector Shape - Group") {
                    var pathProp = prop.property("ADBE Vector Shape");
                    if (pathProp) {
                        result = { prop: pathProp, name: prop.name };
                        return true;
                    }
                }

                if (prop.numProperties !== undefined && prop.numProperties > 0) {
                    if (searchPath(prop)) return true;
                }
            }
            return false;
        }

        searchPath(contents);
        return result;
    }

    // ============================================================
    // 伸長を実行（パス-頂点形式対応）
    // ============================================================
    function executeStretch(params, fromPV, toPV, inputPVList, invert) {
        // バリデーション
        if (!fromPV) {
            alert("Error: Invalid 'From' format.\n\nUse P-V format (e.g. 1-0 for Path1, Vertex0)");
            return;
        }

        if (!toPV) {
            alert("Error: Invalid 'To' format.\n\nUse P-V format (e.g. 1-1 for Path1, Vertex1)");
            return;
        }

        if (fromPV.path === toPV.path && fromPV.vertex === toPV.vertex) {
            alert("Error: 'From' and 'To' must be different vertices.");
            return;
        }

        // 反転モードでなく、頂点が指定されていない場合
        if (!invert && inputPVList.length === 0) {
            alert("Error: No vertices to move specified.\n\nUse P-V format (e.g. 1-1, 1-2, 2-0)");
            return;
        }

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Error: No active composition.");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("Error: No layer selected.");
            return;
        }

        var layer = selectedLayers[0];
        if (!(layer instanceof ShapeLayer)) {
            alert("Error: Selected layer is not a Shape Layer.");
            return;
        }

        // 全パスを取得
        var allPaths = getAllPaths(layer);
        if (allPaths.length === 0) {
            alert("Error: No path found in the Shape Layer.");
            return;
        }

        // 方向を決める2点が同じパスにあるか確認
        if (fromPV.path !== toPV.path) {
            alert("Error: 'From' and 'To' must be on the same path.\n\nFrom: Path " + fromPV.path + ", To: Path " + toPV.path);
            return;
        }

        var dirPathIdx = fromPV.path - 1; // 0-indexed
        if (dirPathIdx < 0 || dirPathIdx >= allPaths.length) {
            alert("Error: Path " + fromPV.path + " does not exist.\n\nAvailable paths: 1 to " + allPaths.length);
            return;
        }

        var dirPathData = allPaths[dirPathIdx];
        var dirShape = dirPathData.prop.value;
        var dirVertices = dirShape.vertices;
        var dirN = dirVertices.length;

        // 頂点インデックスチェック
        if (fromPV.vertex < 0 || fromPV.vertex >= dirN) {
            alert("Error: Vertex " + fromPV.vertex + " is out of range for Path " + fromPV.path + " (0 to " + (dirN-1) + ").");
            return;
        }
        if (toPV.vertex < 0 || toPV.vertex >= dirN) {
            alert("Error: Vertex " + toPV.vertex + " is out of range for Path " + toPV.path + " (0 to " + (dirN-1) + ").");
            return;
        }

        // 方向ベクトルを計算（From → To）
        var fromPt = dirVertices[fromPV.vertex];
        var toPt = dirVertices[toPV.vertex];
        var dx = toPt[0] - fromPt[0];
        var dy = toPt[1] - fromPt[1];
        var dirLength = Math.sqrt(dx * dx + dy * dy);

        if (dirLength < 0.001) {
            alert("Error: Direction vector is too small (From and To are too close).");
            return;
        }

        // 単位ベクトル
        var ux = dx / dirLength;
        var uy = dy / dirLength;

        // パスごとに移動する頂点をグループ化
        var pathMoveMap = {}; // pathIdx -> [vertexIndices]

        if (invert) {
            // 反転モード: 指定された頂点を固定、それ以外を移動
            var fixedSet = {}; // "pathIdx-vertexIdx" -> true
            for (var f = 0; f < inputPVList.length; f++) {
                var pv = inputPVList[f];
                fixedSet[(pv.path - 1) + "-" + pv.vertex] = true;
            }

            // 全パスの全頂点をチェック
            for (var p = 0; p < allPaths.length; p++) {
                var pShape = allPaths[p].prop.value;
                var pN = pShape.vertices.length;
                var moveList = [];
                for (var v = 0; v < pN; v++) {
                    if (!fixedSet[p + "-" + v]) {
                        moveList.push(v);
                    }
                }
                if (moveList.length > 0) {
                    pathMoveMap[p] = moveList;
                }
            }
        } else {
            // 通常モード: 指定された頂点を移動
            for (var m = 0; m < inputPVList.length; m++) {
                var pv = inputPVList[m];
                var pathIdx = pv.path - 1;
                if (pathIdx < 0 || pathIdx >= allPaths.length) {
                    alert("Error: Path " + pv.path + " does not exist.");
                    return;
                }
                var pShape = allPaths[pathIdx].prop.value;
                if (pv.vertex < 0 || pv.vertex >= pShape.vertices.length) {
                    alert("Error: Vertex " + pv.vertex + " is out of range for Path " + pv.path + ".");
                    return;
                }
                if (!pathMoveMap[pathIdx]) {
                    pathMoveMap[pathIdx] = [];
                }
                pathMoveMap[pathIdx].push(pv.vertex);
            }
        }

        // 移動する頂点がない場合
        var hasMovingVertices = false;
        for (var key in pathMoveMap) {
            if (pathMoveMap.hasOwnProperty(key)) {
                hasMovingVertices = true;
                break;
            }
        }
        if (!hasMovingVertices) {
            alert("Error: No vertices to move.");
            return;
        }

        // 伸長処理実行
        var t0 = comp.time;
        var t1 = t0 + params.duration;

        app.beginUndoGroup("Keyframe Stretch Vertices");

        try {
            var movedCount = 0;

            // 各パスを処理
            for (var pathIdx in pathMoveMap) {
                if (!pathMoveMap.hasOwnProperty(pathIdx)) continue;

                var pIdx = parseInt(pathIdx, 10);
                var moveIndices = pathMoveMap[pIdx];
                var pathData = allPaths[pIdx];
                var pathProp = pathData.prop;
                var shape = pathProp.value;

                if (!shape.closed) {
                    continue; // 閉パスのみ処理
                }

                var result = stretchPath(pathProp, moveIndices, ux, uy, params, t0, t1);

                if (result.success) {
                    movedCount += moveIndices.length;
                }
            }

            if (movedCount === 0) {
                alert("Error: No vertices were moved.");
                app.endUndoGroup();
                return;
            }

        } catch (e) {
            alert("Error: " + e.toString());
            app.endUndoGroup();
            return;
        }

        app.endUndoGroup();

        // 完了メッセージ
        var msg = "Keyframe Stretch completed!\n\n";
        msg += "Direction: [" + fromPV.path + "-" + fromPV.vertex + "] → [" + toPV.path + "-" + toPV.vertex + "]\n";
        if (invert) {
            var fixedLabels = [];
            for (var i = 0; i < inputPVList.length; i++) {
                fixedLabels.push(inputPVList[i].path + "-" + inputPVList[i].vertex);
            }
            msg += "Mode: Invert (fixed: " + fixedLabels.join(", ") + ")\n";
        }

        // 移動した頂点をリスト
        var movedLabels = [];
        for (var pathIdx in pathMoveMap) {
            if (!pathMoveMap.hasOwnProperty(pathIdx)) continue;
            var pIdx = parseInt(pathIdx, 10);
            var pathNum = pIdx + 1;
            var verts = pathMoveMap[pIdx];
            for (var v = 0; v < verts.length; v++) {
                movedLabels.push(pathNum + "-" + verts[v]);
            }
        }
        msg += "Moved vertices: " + movedLabels.join(", ") + "\n";
        msg += "Distance: " + params.distance + " px\n";
        msg += "Duration: " + params.duration + " sec\n";
        msg += "Keyframes: " + t0.toFixed(3) + "s → " + t1.toFixed(3) + "s";

        alert(msg);
    }

    // ============================================================
    // パス伸長処理（単位ベクトル指定版）
    // ============================================================
    function stretchPath(pathProp, moveIndices, ux, uy, params, t0, t1) {
        var result = { success: false, error: null };

        var shapeOriginal = pathProp.value;
        var vertices = shapeOriginal.vertices;
        var inTangents = shapeOriginal.inTangents;
        var outTangents = shapeOriginal.outTangents;
        var N = vertices.length;

        // 移動量
        var dist = params.distance;

        // 新しい頂点配列を作成（元をコピー）
        var newVertices = [];
        for (var v = 0; v < N; v++) {
            newVertices.push([vertices[v][0], vertices[v][1]]);
        }

        // 指定された頂点を移動
        for (var m = 0; m < moveIndices.length; m++) {
            var idx = moveIndices[m];
            newVertices[idx][0] += ux * dist;
            newVertices[idx][1] += uy * dist;
        }

        // 変形後のShapeオブジェクトを作成
        var shapeDeformed = new Shape();
        shapeDeformed.vertices = newVertices;
        shapeDeformed.inTangents = inTangents;
        shapeDeformed.outTangents = outTangents;
        shapeDeformed.closed = true;

        // 既存キーの処理
        if (params.overwriteKeys) {
            removeKeyAtTime(pathProp, t0);
            removeKeyAtTime(pathProp, t1);
        }

        // キーフレーム設定
        pathProp.setValueAtTime(t0, shapeOriginal);
        pathProp.setValueAtTime(t1, shapeDeformed);

        // 補間設定
        applyInterpolation(pathProp, t0, t1, params.easeType);

        result.success = true;
        return result;
    }

    // ============================================================
    // 特定時刻のキーフレームを削除
    // ============================================================
    function removeKeyAtTime(prop, time) {
        if (prop.numKeys === 0) return;

        var keyIndex = prop.nearestKeyIndex(time);
        if (keyIndex > 0 && keyIndex <= prop.numKeys) {
            var keyTime = prop.keyTime(keyIndex);
            if (Math.abs(keyTime - time) < 0.001) {
                prop.removeKey(keyIndex);
            }
        }
    }

    // ============================================================
    // 補間設定を適用
    // ============================================================
    function applyInterpolation(pathProp, t0, t1, easeType) {
        try {
            if (easeType === 1) {
                var key1 = pathProp.nearestKeyIndex(t0);
                var key2 = pathProp.nearestKeyIndex(t1);

                if (key1 > 0 && key2 > 0) {
                    pathProp.setInterpolationTypeAtKey(key1, KeyframeInterpolationType.LINEAR);
                    pathProp.setInterpolationTypeAtKey(key2, KeyframeInterpolationType.LINEAR);
                }
            }
        } catch (e) {
            // 補間設定に失敗しても続行
        }
    }

    // ============================================================
    // パネル起動
    // ============================================================
    buildUI(thisObj);

})(this);
