// kg_advance_cornerpin.jsx
// Corner Pin / Shape Path — Null-Linked Controllers
// v1.2.0
//
// 使い方: レイヤーを選択してスクリプトを実行
//   シェイプレイヤー → 各ベジェパスの頂点をヌルにリンク
//   その他のレイヤー → Corner Pin エフェクトの 4 コーナーをヌルにリンク

(function () {

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return;

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) return;

    var time = comp.time;

    // ============================================================
    // Layer → Comp 座標変換 (2D)
    // ============================================================

    function layerToComp(point, anchor, position, scale, rotation) {
        var dx  = point[0] - anchor[0];
        var dy  = point[1] - anchor[1];
        var sx  = dx * (scale[0] / 100);
        var sy  = dy * (scale[1] / 100);
        var rad = rotation * Math.PI / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        return [sx * cos - sy * sin + position[0],
                sx * sin + sy * cos + position[1]];
    }

    // ============================================================
    // パラメトリックシェイプ → ベジェパス 変換
    // ============================================================

    var BEZIER_K = 0.5522847498; // ベジェ円近似係数

    function convertParametricShapes(layer) {
        try {
            var root = layer.property("ADBE Root Vectors Group");
            if (root) convertGroupParametric(root);
        } catch (e) {}
    }

    // グループ内のパラメトリックシェイプをベジェに置換 (後ろから走査して安全にremove/add)
    function convertGroupParametric(group) {
        for (var i = group.numProperties; i >= 1; i--) {
            var prop = group.property(i);
            var mn   = prop.matchName;
            var shapeData = null;
            if      (mn === "ADBE Vector Shape - Rect")    shapeData = rectToShape(prop);
            else if (mn === "ADBE Vector Shape - Ellipse") shapeData = ellipseToShape(prop);
            else if (mn === "ADBE Vector Shape - Star")    shapeData = starToShape(prop);
            else if (mn === "ADBE Vector Group") {
                var inner = prop.property("ADBE Vectors Group");
                if (inner) convertGroupParametric(inner);
            }
            if (shapeData) {
                try {
                    var targetIdx = i; // 元の描画順序を保存
                    prop.remove();
                    var ng = group.addProperty("ADBE Vector Shape - Group");
                    ng.property("ADBE Vector Shape").setValue(shapeData);
                    ng.moveTo(targetIdx); // 元の位置に戻す (塗り/線より前に配置)
                } catch (e) {}
            }
        }
    }

    function rectToShape(p) {
        try {
            var size = p.property("ADBE Vector Rect Size").valueAtTime(time, false);
            var pos  = p.property("ADBE Vector Rect Position").valueAtTime(time, false);
            var rnd  = p.property("ADBE Vector Rect Roundness").valueAtTime(time, false);
            var w2 = size[0] / 2, h2 = size[1] / 2;
            var cx = pos[0], cy = pos[1];
            var r  = Math.min(Math.abs(rnd), Math.min(w2, h2));
            var s  = new Shape();
            s.closed = true;
            if (r < 0.001) {
                s.vertices    = [[cx-w2,cy-h2],[cx+w2,cy-h2],[cx+w2,cy+h2],[cx-w2,cy+h2]];
                s.inTangents  = [[0,0],[0,0],[0,0],[0,0]];
                s.outTangents = [[0,0],[0,0],[0,0],[0,0]];
            } else {
                var k = BEZIER_K * r;
                s.vertices = [
                    [cx-w2+r, cy-h2],   [cx+w2-r, cy-h2],
                    [cx+w2,   cy-h2+r], [cx+w2,   cy+h2-r],
                    [cx+w2-r, cy+h2],   [cx-w2+r, cy+h2],
                    [cx-w2,   cy+h2-r], [cx-w2,   cy-h2+r]
                ];
                s.inTangents  = [[-k,0],[0,0],[0,-k],[0,0],[k,0],[0,0],[0,k],[0,0]];
                s.outTangents = [[0,0],[k,0],[0,0],[0,k],[0,0],[-k,0],[0,0],[0,-k]];
            }
            return s;
        } catch (e) { return null; }
    }

    function ellipseToShape(p) {
        try {
            var size = p.property("ADBE Vector Ellipse Size").valueAtTime(time, false);
            var pos  = p.property("ADBE Vector Ellipse Position").valueAtTime(time, false);
            var rx = size[0] / 2, ry = size[1] / 2;
            var cx = pos[0], cy = pos[1];
            var kx = rx * BEZIER_K, ky = ry * BEZIER_K;
            var s = new Shape();
            s.closed      = true;
            // 時計回り: 上 → 右 → 下 → 左
            s.vertices    = [[cx, cy-ry], [cx+rx, cy], [cx, cy+ry], [cx-rx, cy]];
            s.inTangents  = [[-kx, 0], [0, -ky], [kx, 0], [0,  ky]];
            s.outTangents = [[ kx, 0], [0,  ky], [-kx, 0], [0, -ky]];
            return s;
        } catch (e) { return null; }
    }

    function starToShape(p) {
        try {
            var type   = p.property("ADBE Vector Star Type").valueAtTime(time, false);
            var pts    = Math.round(p.property("ADBE Vector Star Points").valueAtTime(time, false));
            var outerR = p.property("ADBE Vector Star Outer Radius").valueAtTime(time, false);
            var pos    = p.property("ADBE Vector Star Position").valueAtTime(time, false);
            var rot    = p.property("ADBE Vector Star Rotation").valueAtTime(time, false);
            var cx = pos[0], cy = pos[1];
            var verts = [], inT = [], outT = [];
            if (type === 1) {
                // スター: 外側と内側の頂点が交互
                var innerR = p.property("ADBE Vector Star Inner Radius").valueAtTime(time, false);
                for (var i = 0; i < pts * 2; i++) {
                    var a = ((rot - 90) + i * 180 / pts) * Math.PI / 180;
                    var r = (i % 2 === 0) ? outerR : innerR;
                    verts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
                    inT.push([0, 0]); outT.push([0, 0]);
                }
            } else {
                // ポリゴン
                for (var i = 0; i < pts; i++) {
                    var a = ((rot - 90) + i * 360 / pts) * Math.PI / 180;
                    verts.push([cx + outerR * Math.cos(a), cy + outerR * Math.sin(a)]);
                    inT.push([0, 0]); outT.push([0, 0]);
                }
            }
            var s = new Shape();
            s.closed      = true;
            s.vertices    = verts;
            s.inTangents  = inT;
            s.outTangents = outT;
            return s;
        } catch (e) { return null; }
    }

    // ============================================================
    // シェイプレイヤー内のベジェパスプロパティを再帰収集
    // ============================================================

    function findAllPaths(group, results) {
        for (var i = 1; i <= group.numProperties; i++) {
            var prop = group.property(i);
            if (prop.matchName === "ADBE Vector Shape - Group") {
                // ベジェパス: "ADBE Vector Shape" が実体
                var pathProp = prop.property("ADBE Vector Shape");
                if (pathProp) results.push(pathProp);
            } else if (prop.matchName === "ADBE Vector Group") {
                // グループ: 再帰
                var inner = prop.property("ADBE Vectors Group");
                if (inner) findAllPaths(inner, results);
            }
        }
    }

    // ============================================================
    // シェイプレイヤー処理: パス頂点ごとにヌルを生成
    // ============================================================

    function setupShapeNulls(layer) {
        // パラメトリックシェイプ (Rectangle / Ellipse / Star) をベジェに変換してから処理
        convertParametricShapes(layer);

        var layerIdx  = layer.index;
        var layerName = layer.name;

        var position, anchor, scale, rotation;
        try {
            position = layer.position.valueAtTime(time, false);
            anchor   = layer.anchorPoint.valueAtTime(time, false);
            scale    = layer.scale.valueAtTime(time, false);
            rotation = layer.rotation.valueAtTime(time, false);
        } catch (e) { return; }

        // 全パスを収集
        var allPaths = [];
        try {
            var contents = layer.property("ADBE Root Vectors Group");
            findAllPaths(contents, allPaths);
        } catch (e) { return; }

        if (allPaths.length === 0) return;

        for (var pi = 0; pi < allPaths.length; pi++) {
            var pathProp = allPaths[pi];
            var shapeVal, vertices;
            try {
                shapeVal = pathProp.valueAtTime(time, false);
                vertices = shapeVal.vertices;
            } catch (e) { continue; }

            var numVerts = vertices.length;
            var prefix   = "SP_L" + layerIdx + "_P" + pi + "_V";

            // 既存ヌルを削除
            for (var li = comp.layers.length; li >= 1; li--) {
                if (comp.layers[li].name.indexOf(prefix) === 0) {
                    comp.layers[li].remove();
                }
            }

            if (pathProp.expressionEnabled) pathProp.expressionEnabled = false;

            // 頂点ヌル生成
            var nullNames  = [];
            var nullLayers = [];

            for (var k = 0; k < numVerts; k++) {
                var compPos  = layerToComp(vertices[k], anchor, position, scale, rotation);
                var nullName = prefix + k;

                var nl      = comp.layers.addNull();
                nl.name     = nullName;
                nl.label    = 6;  // Peach
                nl.shy      = false;
                nl.inPoint  = layer.inPoint;
                nl.outPoint = layer.outPoint;
                nl.position.setValue(compPos);

                nullNames.push(nullName);
                nullLayers.push(nl);
            }

            // ターゲットレイヤーの直上に一括移動
            for (var ni = 0; ni < nullLayers.length; ni++) {
                nullLayers[ni].moveBefore(layer);
            }

            // パスにエクスプレッション設定
            // fromComp() でコンプ空間 → レイヤー空間に逆変換して頂点を更新
            var exprLines = [
                "var pts    = thisProperty.points();",
                "var it     = thisProperty.inTangents();",
                "var ot     = thisProperty.outTangents();",
                "var closed = thisProperty.isClosed();",
                "var newPts = [];",
                "for (var _ki = 0; _ki < pts.length; _ki++) newPts[_ki] = pts[_ki];",
                "try {"
            ];
            for (var k = 0; k < numVerts; k++) {
                exprLines.push(
                    "    var _p  = thisComp.layer(\"" + nullNames[k] + "\").transform.position;",
                    "    var _fc = fromComp([_p[0], _p[1]]);",
                    "    newPts[" + k + "] = [_fc[0], _fc[1]];"
                );
            }
            exprLines.push("} catch(e) {}", "thisProperty.createPath(newPts, it, ot, closed);");

            try {
                pathProp.expression = exprLines.join("\n");
            } catch (e) {}
        }
    }

    // ============================================================
    // その他レイヤー処理: Corner Pin + ヌル
    // ============================================================

    var CORNER_SUFFIXES = ["UL", "UR", "LL", "LR"];
    var CORNER_LABELS   = [14, 8, 6, 5]; // Cyan / Blue / Peach / Lavender

    function setupCornerPin(layer) {
        var layerIdx = layer.index;

        var fx = layer.Effects;

        // 既存の Corner Pin を削除して新規追加
        for (var ei = fx.numProperties; ei >= 1; ei--) {
            if (fx.property(ei).matchName === "ADBE Corner Pin") {
                fx.property(ei).remove();
            }
        }
        var cpEffect = fx.addProperty("ADBE Corner Pin");

        // レイヤーのトランスフォームを取得
        var position, anchor, scale, rotation;
        try {
            position = layer.position.valueAtTime(time, false);
            anchor   = layer.anchorPoint.valueAtTime(time, false);
            scale    = layer.scale.valueAtTime(time, false);
            rotation = layer.rotation.valueAtTime(time, false);
        } catch (e) { return; }

        // ソース解像度を取得 (Corner Pin はソースピクセル空間で値を持つ)
        var w, h;
        try {
            w = layer.source.width;
            h = layer.source.height;
        } catch (e) { return; }

        // ソースピクセル空間の四隅 → コンプ空間に変換してヌル配置位置を得る
        // 順序: UL, UR, LL, LR (Corner Pin property 1-4 と一致)
        var srcCorners = [[0, 0], [w, 0], [0, h], [w, h]];
        var csCorners  = [];
        for (var c = 0; c < 4; c++) {
            csCorners.push(layerToComp(srcCorners[c], anchor, position, scale, rotation));
        }

        // ヌル名
        var prefix = "CP_L" + layerIdx + "_";
        var cNames = [];
        for (var c = 0; c < 4; c++) cNames.push(prefix + CORNER_SUFFIXES[c]);

        // 既存の同名ヌルを削除
        for (var li = comp.layers.length; li >= 1; li--) {
            var ln = comp.layers[li].name;
            for (var c = 0; c < 4; c++) {
                if (ln === cNames[c]) { comp.layers[li].remove(); break; }
            }
        }

        // ヌルをコンプ空間のコーナー位置に生成
        var nullLayers = [];
        for (var c = 0; c < 4; c++) {
            var nl      = comp.layers.addNull();
            nl.name     = cNames[c];
            nl.label    = CORNER_LABELS[c];
            nl.shy      = false;
            nl.inPoint  = layer.inPoint;
            nl.outPoint = layer.outPoint;
            nl.position.setValue(csCorners[c]);
            nullLayers.push(nl);
        }

        // ターゲットレイヤーの直上に一括移動
        for (var ni = 0; ni < nullLayers.length; ni++) {
            nullLayers[ni].moveBefore(layer);
        }

        // Corner Pin デフォルト値をソースピクセル空間のコーナーに設定
        // エクスプレッション無効時もこの値が維持される
        var srcValues = [[0, 0], [w, 0], [0, h], [w, h]];
        for (var c = 0; c < 4; c++) {
            cpEffect.property(c + 1).setValue(srcValues[c]);
        }

        // Corner Pin エクスプレッション設定
        // fromComp() はコンプ空間→ソースピクセル空間に変換するため、
        // ヌルのコンプ座標をそのまま渡すだけでよい
        for (var c = 0; c < 4; c++) {
            cpEffect.property(c + 1).expression = [
                "var _p = thisComp.layer(\"" + cNames[c] + "\").transform.position;",
                "fromComp([_p[0], _p[1]])"
            ].join("\n");
        }
    }

    // ============================================================
    // エントリーポイント
    // ============================================================

    app.beginUndoGroup("Advanced Corner Pin");

    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];
        if (layer.nullLayer) continue;

        if (layer.matchName === "ADBE Vector Layer") {
            setupShapeNulls(layer);
        } else {
            setupCornerPin(layer);
        }
    }

    app.endUndoGroup();

}());
