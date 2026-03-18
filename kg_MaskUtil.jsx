// kg_MaskUtil.jsx
// Adobe After Effects Mask Utility Script
// v1.4.0

(function (thisObj) {

    // ============================================================
    // 座標変換ユーティリティ
    // ============================================================

    function layerToComp(point, anchorPoint, position, scale, rotation) {
        var dx = point[0] - anchorPoint[0];
        var dy = point[1] - anchorPoint[1];
        var sx = dx * (scale[0] / 100);
        var sy = dy * (scale[1] / 100);
        var rad = rotation * Math.PI / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        return [
            sx * cos - sy * sin + position[0],
            sx * sin + sy * cos + position[1]
        ];
    }

    function compToLayer(point, anchorPoint, position, scale, rotation) {
        var dx = point[0] - position[0];
        var dy = point[1] - position[1];
        var rad = -rotation * Math.PI / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        var rx = dx * cos - dy * sin;
        var ry = dx * sin + dy * cos;
        return [
            rx / (scale[0] / 100) + anchorPoint[0],
            ry / (scale[1] / 100) + anchorPoint[1]
        ];
    }

    function clampToComp(point, compWidth, compHeight) {
        return [
            Math.max(0, Math.min(compWidth, point[0])),
            Math.max(0, Math.min(compHeight, point[1]))
        ];
    }

    // ============================================================
    // Mask ユーティリティ
    // ============================================================

    function selectMaskPaths() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return;

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) return;

        var selProps = comp.selectedProperties;
        for (var i = selProps.length - 1; i >= 0; i--) {
            selProps[i].selected = false;
        }

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var masks = layer.mask;
            if (!masks || masks.numProperties === 0) continue;
            for (var j = 1; j <= masks.numProperties; j++) {
                masks.property(j).property("maskShape").selected = true;
            }
        }
    }

    function fitMaskToComp() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("アクティブなコンポジションが見つかりません。");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        var compWidth  = comp.width;
        var compHeight = comp.height;
        var time       = comp.time;

        app.beginUndoGroup("Fit Mask to Comp");

        var processedMasks = 0;
        var noMaskLayers   = 0;

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var masks = layer.mask;

            if (!masks || masks.numProperties === 0) {
                noMaskLayers++;
                continue;
            }

            var position, anchorPoint, scale, rotation;
            try {
                position    = layer.position.valueAtTime(time, false);
                anchorPoint = layer.anchorPoint.valueAtTime(time, false);
                scale       = layer.scale.valueAtTime(time, false);
                rotation    = layer.rotation.valueAtTime(time, false);
            } catch (e) {
                alert("トランスフォームの取得に失敗しました: " + layer.name + "\n" + e.toString());
                continue;
            }

            for (var j = 1; j <= masks.numProperties; j++) {
                var mask          = masks.property(j);
                var maskShapeProp = mask.property("maskShape");
                var maskShape     = maskShapeProp.valueAtTime(time, false);
                var vertices      = maskShape.vertices;
                var inTangents    = maskShape.inTangents;
                var outTangents   = maskShape.outTangents;

                var newVertices   = [];
                var newInTangents  = [];
                var newOutTangents = [];

                for (var k = 0; k < vertices.length; k++) {
                    var compPoint  = layerToComp(vertices[k], anchorPoint, position, scale, rotation);
                    var clamped    = clampToComp(compPoint, compWidth, compHeight);
                    var layerPoint = compToLayer(clamped, anchorPoint, position, scale, rotation);
                    newVertices.push(layerPoint);
                    newInTangents.push(inTangents[k]);
                    newOutTangents.push(outTangents[k]);
                }

                var newShape        = new Shape();
                newShape.vertices   = newVertices;
                newShape.inTangents  = newInTangents;
                newShape.outTangents = newOutTangents;
                newShape.closed     = maskShape.closed;

                if (maskShapeProp.numKeys > 0) {
                    maskShapeProp.setValueAtTime(time, newShape);
                } else {
                    maskShapeProp.setValue(newShape);
                }

                processedMasks++;
            }
        }

        app.endUndoGroup();

        if (processedMasks === 0 && noMaskLayers > 0) {
            alert("選択したレイヤーにマスクが見つかりませんでした。");
        }
    }

    // ============================================================
    // MW_Control ヘルパー
    // ============================================================

    /**
     * MW_Control ヌルを取得または作成し、指定名のスライダーを追加/更新して返す。
     */
    function ensureCtrlSlider(ctrlLayer, name, value) {
        var slider = null;
        for (var ei = 1; ei <= ctrlLayer.Effects.numProperties; ei++) {
            if (ctrlLayer.Effects.property(ei).name === name) {
                slider = ctrlLayer.Effects.property(ei);
                break;
            }
        }
        if (!slider) {
            slider = ctrlLayer.Effects.addProperty("ADBE Slider Control");
            slider.name = name;
        }
        slider.property(1).setValue(value);
        return slider;
    }

    function getOrCreateCtrlLayer(comp) {
        var ctrlName = "MW_Control";
        for (var ci = comp.layers.length; ci >= 1; ci--) {
            if (comp.layers[ci].name === ctrlName) return comp.layers[ci];
        }
        var ctrlLayer = comp.layers.addNull();
        ctrlLayer.name     = ctrlName;
        ctrlLayer.label    = 3;
        ctrlLayer.shy      = true;
        ctrlLayer.inPoint  = comp.displayStartTime;
        ctrlLayer.outPoint = comp.displayStartTime + comp.duration;
        return ctrlLayer;
    }

    // ============================================================
    // Wiggle Mask Path (with Null)
    // ============================================================

    function setupWiggleMask(posterizeTime, strength, seed) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("アクティブなコンポジションが見つかりません。");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        if (posterizeTime <= 0) {
            alert("posterizeTime は 1 以上の値を入力してください。");
            return;
        }

        var baseTime = comp.time;

        app.beginUndoGroup("Setup Wiggle Mask");

        var ctrlLayer = getOrCreateCtrlLayer(comp);
        ensureCtrlSlider(ctrlLayer, "MW PosterizeTime", posterizeTime);
        ensureCtrlSlider(ctrlLayer, "MW Strength",      strength);
        ensureCtrlSlider(ctrlLayer, "MW Seed",          seed);

        var processedMasks = 0;
        var noMaskLayers   = 0;

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var masks = layer.mask;

            if (!masks || masks.numProperties === 0) {
                noMaskLayers++;
                continue;
            }

            var layerIdx = layer.index;

            var position, anchorPoint, scale, rotation;
            try {
                position    = layer.position.valueAtTime(baseTime, false);
                anchorPoint = layer.anchorPoint.valueAtTime(baseTime, false);
                scale       = layer.scale.valueAtTime(baseTime, false);
                rotation    = layer.rotation.valueAtTime(baseTime, false);
            } catch (e) {
                alert("トランスフォームの取得に失敗: " + layer.name);
                continue;
            }

            for (var j = 1; j <= masks.numProperties; j++) {
                var mask          = masks.property(j);
                var maskShapeProp = mask.property("maskShape");
                var maskShape     = maskShapeProp.valueAtTime(baseTime, false);
                var vertices      = maskShape.vertices;
                var numVerts      = vertices.length;

                // 既存ヌルを削除してリセット
                var nullPrefix = "MW_L" + layerIdx + "_M" + j + "_V";
                for (var li = comp.layers.length; li >= 1; li--) {
                    if (comp.layers[li].name.indexOf(nullPrefix) === 0) {
                        comp.layers[li].remove();
                    }
                }

                if (maskShapeProp.expressionEnabled) {
                    maskShapeProp.expressionEnabled = false;
                }

                var nullNames = [];
                for (var k = 0; k < numVerts; k++) {
                    var nullName = nullPrefix + k;
                    var compPos  = layerToComp(vertices[k], anchorPoint, position, scale, rotation);

                    var nullLayer = comp.layers.addNull();
                    nullLayer.name     = nullName;
                    nullLayer.label    = 9;
                    nullLayer.shy      = true;
                    nullLayer.inPoint  = layer.inPoint;
                    nullLayer.outPoint = layer.outPoint;
                    // 3Dレイヤー対応: ヌルも3Dにして Z 座標を保持する
                    if (layer.threeDLayer) {
                        nullLayer.threeDLayer = true;
                        nullLayer.position.setValue([compPos[0], compPos[1], position[2]]);
                    } else {
                        nullLayer.position.setValue(compPos);
                    }

                    // ユニークシード (レイヤー・マスク・頂点ごとに分離) + ユーザー可変シード
                    // 各頂点ごとにユニークなシード (x,y 共用 → 1次元スカラーオフセットで使う)
                    var seedX = layerIdx * 100 + j * 37 + k * 7;
                    nullLayer.position.expression =
                        "var _ctrl = thisComp.layer(\"MW_Control\");\n" +
                        "var _freq = _ctrl.effect(\"MW PosterizeTime\")(1);\n" +
                        "var _amp  = _ctrl.effect(\"MW Strength\")(1);\n" +
                        "var _seed = _ctrl.effect(\"MW Seed\")(1);\n" +
                        "var _L    = thisComp.layer(\"" + layer.name + "\");\n" +
                        // toComp は 3D レイヤーでは [x,y,z] を返す → _base に Z が含まれる
                        "var _base = _L.toComp([" + vertices[k][0] + ", " + vertices[k][1] + "]);\n" +
                        // レイヤー中心 (Position = アンカー点のコンプ座標) を放射の起点にする
                        "var _ctr  = _L.transform.position;\n" +
                        "var _rdx  = _base[0] - _ctr[0];\n" +
                        "var _rdy  = _base[1] - _ctr[1];\n" +
                        "var _rlen = Math.sqrt(_rdx * _rdx + _rdy * _rdy);\n" +
                        "var _ux   = (_rlen > 0.0001) ? _rdx / _rlen : 1;\n" +
                        "var _uy   = (_rlen > 0.0001) ? _rdy / _rlen : 0;\n" +
                        // 1次元 noise → 放射方向へのスカラーオフセット (ナナメ引っ張りなし)
                        "var _t    = Math.floor(time * _freq) / _freq;\n" +
                        "var _s    = (noise([_seed + " + seedX + ", _t]) * 2 - 1) * _amp;\n" +
                        // 3Dヌルなら Z を保持して返す (fromComp で正しく逆変換できるよう)
                        "(_base.length > 2) ? [_base[0] + _ux * _s, _base[1] + _uy * _s, _base[2]] : [_base[0] + _ux * _s, _base[1] + _uy * _s];";

                    nullNames.push(nullName);
                }

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
                    // 3Dヌルは _p.length === 3 → fromComp に Z を渡して 3D 逆変換
                    // 2Dヌルは _p.length === 2 → fromComp に [x,y] のみ渡す
                    exprLines.push(
                        "    var _p  = thisComp.layer(\"" + nullNames[k] + "\").transform.position;",
                        "    var _fc = (_p.length > 2) ? fromComp([_p[0], _p[1], _p[2]]) : fromComp([_p[0], _p[1]]);",
                        "    newPts[" + k + "] = [_fc[0], _fc[1]];"
                    );
                }
                exprLines.push("} catch(e) {}", "thisProperty.createPath(newPts, it, ot, closed);");

                try {
                    maskShapeProp.expression = exprLines.join("\n");
                    processedMasks++;
                } catch (e) {
                    alert("マスクパスへのエクスプレッション設定に失敗しました:\n" +
                          layer.name + " / Mask " + j + "\n" + e.toString());
                }
            }
        }

        app.endUndoGroup();

        if (processedMasks === 0 && noMaskLayers > 0) {
            alert("選択したレイヤーにマスクが見つかりませんでした。");
        } else if (processedMasks > 0) {
            alert(processedMasks + " 個のマスクにWiggle Null を設定しました。\n" +
                  "「MW_Control」レイヤーのエフェクトコントロールで調整できます。");
        }
    }

    // ============================================================
    // Wiggle Mask Path (without Null)
    // ============================================================

    function setupWiggleMaskNoNull(posterizeTime, strength, seed) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("アクティブなコンポジションが見つかりません。");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        if (posterizeTime <= 0) {
            alert("posterizeTime は 1 以上の値を入力してください。");
            return;
        }

        app.beginUndoGroup("Setup Wiggle Mask (No Null)");

        var processedMasks = 0;
        var noMaskLayers   = 0;

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var masks = layer.mask;

            if (!masks || masks.numProperties === 0) {
                noMaskLayers++;
                continue;
            }

            var layerIdx = layer.index;

            // スライダーをターゲットレイヤー自身に追加 / 更新
            ensureLayerSlider(layer, "MW PosterizeTime", posterizeTime);
            ensureLayerSlider(layer, "MW Strength",      strength);
            ensureLayerSlider(layer, "MW Seed",          seed);

            for (var j = 1; j <= masks.numProperties; j++) {
                var mask          = masks.property(j);
                var maskShapeProp = mask.property("maskShape");

                if (maskShapeProp.expressionEnabled) {
                    maskShapeProp.expressionEnabled = false;
                }

                var baseSeed = layerIdx * 100 + j * 37;
                var exprLines = [
                    "var pts    = thisProperty.points();",
                    "var it     = thisProperty.inTangents();",
                    "var ot     = thisProperty.outTangents();",
                    "var closed = thisProperty.isClosed();",
                    "var _freq  = thisLayer.effect(\"MW PosterizeTime\")(1);",
                    "var _amp   = thisLayer.effect(\"MW Strength\")(1);",
                    "var _seed  = thisLayer.effect(\"MW Seed\")(1);",
                    "var _t     = Math.floor(time * _freq) / _freq;",
                    "var _bs    = " + baseSeed + " + _seed;",
                    // レイヤー空間で完結させる → toComp/fromComp 不要, 3Dレイヤーでも動作
                    // アンカーポイント (レイヤー空間) を放射の起点にする
                    "var _anc   = thisLayer.transform.anchorPoint;",
                    "var newPts = [];",
                    "for (var _i = 0; _i < pts.length; _i++) {",
                    "    var _sx   = _bs + _i * 7;",
                    "    var _rdx  = pts[_i][0] - _anc[0];",
                    "    var _rdy  = pts[_i][1] - _anc[1];",
                    "    var _rlen = Math.sqrt(_rdx * _rdx + _rdy * _rdy);",
                    "    var _ux   = (_rlen > 0.0001) ? _rdx / _rlen : 1;",
                    "    var _uy   = (_rlen > 0.0001) ? _rdy / _rlen : 0;",
                    "    var _s    = (noise([_sx, _t]) * 2 - 1) * _amp;",
                    "    newPts[_i] = [pts[_i][0] + _ux * _s, pts[_i][1] + _uy * _s];",
                    "}",
                    "thisProperty.createPath(newPts, it, ot, closed);"
                ];

                try {
                    maskShapeProp.expression = exprLines.join("\n");
                    processedMasks++;
                } catch (e) {
                    alert("エクスプレッション設定失敗:\n" +
                          layer.name + " / Mask " + j + "\n" + e.toString());
                }
            }
        }

        app.endUndoGroup();

        if (processedMasks === 0 && noMaskLayers > 0) {
            alert("選択したレイヤーにマスクが見つかりませんでした。");
        } else if (processedMasks > 0) {
            alert(processedMasks + " 個のマスクにWiggleを設定しました (Null なし)。\n" +
                  "レイヤーのエフェクトコントロールで調整できます。");
        }
    }

    function ensureLayerSlider(layer, name, value) {
        var slider = null;
        for (var ei = 1; ei <= layer.Effects.numProperties; ei++) {
            if (layer.Effects.property(ei).name === name) {
                slider = layer.Effects.property(ei);
                break;
            }
        }
        if (!slider) {
            slider = layer.Effects.addProperty("ADBE Slider Control");
            slider.name = name;
        }
        slider.property(1).setValue(value);
        return slider;
    }

    // ============================================================
    // Toggle Wiggle Expressions
    // ============================================================

    /**
     * 選択レイヤーの Wiggle エクスプレッションを一括で有効/無効切り替え。
     *
     * [without-null 方式]
     *   無効化 → マスクパスを直接編集 → 有効化
     *   エクスプレッションは thisProperty.points() で現在の頂点を読むため、
     *   編集後に有効化すると新頂点が新しい基点として使われる。
     *
     * [with-null 方式]
     *   無効化 → マスクパス/ヌルが静止状態になり直接編集可能
     *   → 編集後は「Setup Wiggle (with Null)」を再実行して新頂点で焼き直す。
     */
    function toggleWiggleExpressions() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("アクティブなコンポジションが見つかりません。");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        // 最初に見つかったエクスプレッション付きマスクの現在状態を基準にトグル方向を決定
        var currentEnabled = null;
        outer: for (var i = 0; i < selectedLayers.length; i++) {
            var masks = selectedLayers[i].mask;
            if (!masks) continue;
            for (var j = 1; j <= masks.numProperties; j++) {
                var sp = masks.property(j).property("maskShape");
                if (sp.expression !== "") {
                    currentEnabled = sp.expressionEnabled;
                    break outer;
                }
            }
        }

        if (currentEnabled === null) {
            alert("Wiggle エクスプレッションが設定されたマスクが見つかりませんでした。");
            return;
        }

        var newEnabled = !currentEnabled;

        app.beginUndoGroup("Toggle Wiggle Expressions");

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer    = selectedLayers[i];
            var masks    = layer.mask;
            if (!masks || masks.numProperties === 0) continue;
            var layerIdx = layer.index;

            // マスクシェイプエクスプレッションをトグル
            for (var j = 1; j <= masks.numProperties; j++) {
                var sp = masks.property(j).property("maskShape");
                if (sp.expression !== "") {
                    sp.expressionEnabled = newEnabled;
                }
            }

            // with-null 方式: 対応ヌル (MW_L*) の position エクスプレッションもトグル
            var pfx = "MW_L" + layerIdx + "_M";
            for (var li = 1; li <= comp.layers.length; li++) {
                var nl = comp.layers[li];
                if (nl.name.indexOf(pfx) !== 0) continue;
                var pos = nl.transform.position;
                if (pos.expression !== "") {
                    pos.expressionEnabled = newEnabled;
                }
            }
        }

        app.endUndoGroup();
    }

    // ============================================================
    // Remove Wiggle
    // ============================================================

    function removeWiggleMask() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("アクティブなコンポジションが見つかりません。");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        app.beginUndoGroup("Remove Wiggle Mask");

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var masks = layer.mask;
            if (!masks || masks.numProperties === 0) continue;

            var layerIdx = layer.index;

            for (var j = 1; j <= masks.numProperties; j++) {
                var maskShapeProp = masks.property(j).property("maskShape");
                if (maskShapeProp.expressionEnabled) {
                    maskShapeProp.expressionEnabled = false;
                }

                // with Null / Create Linked Nulls 方式のヌルを削除
                var wPfx = "MW_L" + layerIdx + "_M" + j + "_V";
                var lPfx = "ML_L" + layerIdx + "_M" + j + "_V";
                for (var li = comp.layers.length; li >= 1; li--) {
                    var n = comp.layers[li].name;
                    if (n.indexOf(wPfx) === 0 || n.indexOf(lPfx) === 0) {
                        comp.layers[li].remove();
                    }
                }
            }

            // without Null 方式のスライダーをレイヤーから削除
            for (var ei = layer.Effects.numProperties; ei >= 1; ei--) {
                var eName = layer.Effects.property(ei).name;
                if (eName === "MW PosterizeTime" || eName === "MW Strength" || eName === "MW Seed") {
                    layer.Effects.property(ei).remove();
                }
            }
        }

        // MW_ / ML_ 系ヌルが残っていなければ MW_Control も削除
        var hasRemaining = false;
        for (var li = 1; li <= comp.layers.length; li++) {
            var n = comp.layers[li].name;
            if (n.indexOf("MW_L") === 0 || n.indexOf("ML_L") === 0) {
                hasRemaining = true;
                break;
            }
        }
        if (!hasRemaining) {
            for (var li = comp.layers.length; li >= 1; li--) {
                if (comp.layers[li].name === "MW_Control") {
                    comp.layers[li].remove();
                    break;
                }
            }
        }

        app.endUndoGroup();
        alert("Wiggle Null とエクスプレッションを削除しました。");
    }

    // ============================================================
    // Create Linked Nulls (wiggle なし)
    // ============================================================

    /**
     * 各マスク頂点にリンクしたヌルを作成する。
     * wiggle は適用しない。ヌルの Position は toComp() でレイヤートランスフォームを追従。
     * ピックウィップや他レイヤーへの接続など汎用目的に使える。
     */
    function createMaskNulls() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("アクティブなコンポジションが見つかりません。");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        var baseTime = comp.time;

        app.beginUndoGroup("Create Mask Linked Nulls");

        var processedMasks = 0;
        var noMaskLayers   = 0;

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var masks = layer.mask;

            if (!masks || masks.numProperties === 0) {
                noMaskLayers++;
                continue;
            }

            var layerIdx = layer.index;

            var position, anchorPoint, scale, rotation;
            try {
                position    = layer.position.valueAtTime(baseTime, false);
                anchorPoint = layer.anchorPoint.valueAtTime(baseTime, false);
                scale       = layer.scale.valueAtTime(baseTime, false);
                rotation    = layer.rotation.valueAtTime(baseTime, false);
            } catch (e) {
                alert("トランスフォームの取得に失敗: " + layer.name);
                continue;
            }

            for (var j = 1; j <= masks.numProperties; j++) {
                var maskShapeProp = masks.property(j).property("maskShape");
                var maskShape     = maskShapeProp.valueAtTime(baseTime, false);
                var vertices      = maskShape.vertices;
                var numVerts      = vertices.length;

                // 既存リンクヌルを削除してリセット
                var nullPrefix = "ML_L" + layerIdx + "_M" + j + "_V";
                for (var li = comp.layers.length; li >= 1; li--) {
                    if (comp.layers[li].name.indexOf(nullPrefix) === 0) {
                        comp.layers[li].remove();
                    }
                }

                // ヌル作成 (expression なし → Position にキーフレームを打てる)
                var nullNames = [];
                for (var k = 0; k < numVerts; k++) {
                    var nullName = nullPrefix + k;
                    var compPos  = layerToComp(vertices[k], anchorPoint, position, scale, rotation);

                    var nullLayer = comp.layers.addNull();
                    nullLayer.name     = nullName;
                    nullLayer.label    = 6; // ピンク
                    nullLayer.shy      = false; // 操作しやすいよう非シャイ
                    nullLayer.inPoint  = layer.inPoint;
                    nullLayer.outPoint = layer.outPoint;

                    // 3Dレイヤー対応: ヌルも3Dにして Z 座標を保持する
                    if (layer.threeDLayer) {
                        nullLayer.threeDLayer = true;
                        nullLayer.position.setValue([compPos[0], compPos[1], position[2]]);
                    } else {
                        nullLayer.position.setValue(compPos);
                    }

                    nullNames.push(nullName);
                }

                // マスクパスにヌル Position を追従させる expression を設定
                if (maskShapeProp.expressionEnabled) {
                    maskShapeProp.expressionEnabled = false;
                }

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
                    // 3Dヌルは _p.length === 3 → fromComp に Z を渡して正しく逆変換
                    exprLines.push(
                        "    var _p  = thisComp.layer(\"" + nullNames[k] + "\").transform.position;",
                        "    var _fc = (_p.length > 2) ? fromComp([_p[0], _p[1], _p[2]]) : fromComp([_p[0], _p[1]]);",
                        "    newPts[" + k + "] = [_fc[0], _fc[1]];"
                    );
                }
                exprLines.push("} catch(e) {}", "thisProperty.createPath(newPts, it, ot, closed);");

                try {
                    maskShapeProp.expression = exprLines.join("\n");
                    processedMasks++;
                } catch (e) {
                    alert("エクスプレッション設定失敗:\n" +
                          layer.name + " / Mask " + j + "\n" + e.toString());
                }
            }
        }

        app.endUndoGroup();

        if (processedMasks === 0 && noMaskLayers > 0) {
            alert("選択したレイヤーにマスクが見つかりませんでした。");
        } else if (processedMasks > 0) {
            alert(processedMasks + " 個のマスクにリンクヌルを作成しました。\n" +
                  "ヌル名: ML_L*_M*_V*\n" +
                  "ヌルの Position を移動 / キーフレームするとマスクが追従します。");
        }
    }

    // ============================================================
    // UI
    // ============================================================

    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "kg Mask Util", undefined, { resizable: true });

        panel.orientation   = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing       = 6;
        panel.margins       = [10, 10, 10, 10];

        var title = panel.add("statictext", undefined, "kg Mask Utility");
        title.alignment = ["center", "top"];

        panel.add("panel", undefined, undefined);

        // ---- Mask ユーティリティ ----
        var fitSection = panel.add("group");
        fitSection.orientation   = "column";
        fitSection.alignChildren = ["fill", "top"];
        fitSection.spacing       = 4;

        var selectBtn = fitSection.add("button", undefined, "Select Mask Paths");
        selectBtn.helpTip = "選択レイヤーの全マスクパスプロパティを選択状態にします。";
        selectBtn.onClick = function () { selectMaskPaths(); };

        fitSection.add("statictext", undefined, "マスクをコンプサイズに収める");

        var fitBtn = fitSection.add("button", undefined, "Fit Mask to Comp");
        fitBtn.helpTip = "選択レイヤーのマスク頂点をコンポジション範囲内にクランプします。\n(現在時刻のトランスフォームを基準に変換)";
        fitBtn.onClick = function () { fitMaskToComp(); };

        panel.add("panel", undefined, undefined);

        // ---- Wiggle Mask ----
        var wiggleSection = panel.add("group");
        wiggleSection.orientation   = "column";
        wiggleSection.alignChildren = ["fill", "top"];
        wiggleSection.spacing       = 4;

        wiggleSection.add("statictext", undefined, "マスクパスをカクカク (Expression)");

        // パラメータ行を生成するヘルパー
        function addParamRow(parent, labelText, defaultVal, unit) {
            var row = parent.add("group");
            row.orientation   = "row";
            row.alignChildren = ["left", "center"];
            row.spacing       = 6;
            var lbl = row.add("statictext", undefined, labelText);
            lbl.preferredSize.width = 100;
            var inp = row.add("edittext", undefined, String(defaultVal));
            inp.preferredSize.width = 45;
            if (unit) row.add("statictext", undefined, unit);
            return inp;
        }

        var ptInput   = addParamRow(wiggleSection, "posterizeTime:", 6,  "fps");
        var stInput   = addParamRow(wiggleSection, "strength:",      10, "px");
        var seedInput = addParamRow(wiggleSection, "seed:",          0,  "");

        function getParams() {
            var pt   = parseFloat(ptInput.text);
            var st   = parseFloat(stInput.text);
            var sd   = parseFloat(seedInput.text);
            if (isNaN(pt) || pt <= 0) { alert("posterizeTime に正の数値を入力してください。"); return null; }
            if (isNaN(st) || st < 0)  { alert("strength に 0 以上の数値を入力してください。"); return null; }
            if (isNaN(sd))             { alert("seed に数値を入力してください。"); return null; }
            return { pt: pt, st: st, sd: sd };
        }

        var wiggleBtn = wiggleSection.add("button", undefined, "Setup Wiggle (with Null)");
        wiggleBtn.helpTip =
            "各マスク頂点にヌルを生成し noise エクスプレッションで動作させます。\n" +
            "MW_Control のエフェクトコントロールでパラメータを調整できます。";
        wiggleBtn.onClick = function () {
            var p = getParams(); if (!p) return;
            setupWiggleMask(p.pt, p.st, p.sd);
        };

        var wiggleNoNullBtn = wiggleSection.add("button", undefined, "Setup Wiggle (without Null)");
        wiggleNoNullBtn.helpTip =
            "ヌルを作成せず、マスクパスエクスプレッションだけで wiggle を実現します。\n" +
            "レイヤーのエフェクトコントロールでパラメータを調整できます。";
        wiggleNoNullBtn.onClick = function () {
            var p = getParams(); if (!p) return;
            setupWiggleMaskNoNull(p.pt, p.st, p.sd);
        };

        var linkedNullBtn = wiggleSection.add("button", undefined, "Create Linked Nulls");
        linkedNullBtn.helpTip =
            "wiggle なしで各マスク頂点にリンクしたヌルを作成します。\n" +
            "ヌルはレイヤートランスフォームを追従します。\n" +
            "ピックウィップや他レイヤーへの接続などに活用できます。";
        linkedNullBtn.onClick = function () { createMaskNulls(); };

        var toggleBtn = wiggleSection.add("button", undefined, "Wiggle 停止 / 再開");
        toggleBtn.helpTip =
            "選択レイヤーの Wiggle エクスプレッションを有効 / 無効 切り替え。\n" +
            "\n" +
            "[without-null]\n" +
            "  停止 → マスクパスを直接編集 → 再開\n" +
            "  (再開時に編集後の頂点が新しい基点になります)\n" +
            "\n" +
            "[with-null]\n" +
            "  停止 → マスクパス / ヌルを直接編集\n" +
            "  → 「Setup Wiggle (with Null)」を再実行して新頂点で焼き直し";
        toggleBtn.onClick = function () { toggleWiggleExpressions(); };

        var removeBtn = wiggleSection.add("button", undefined, "Remove Wiggle / Linked Nulls");
        removeBtn.helpTip = "選択レイヤーの Wiggle / リンクヌルとマスクパスエクスプレッションを削除します。";
        removeBtn.onClick = function () { removeWiggleMask(); };

        if (panel instanceof Window) {
            panel.layout.layout(true);
            panel.layout.resize();
        } else {
            panel.layout.layout(true);
        }

        return panel;
    }

    // ============================================================
    // エントリーポイント
    // ============================================================
    var myPanel = buildUI(thisObj);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }

})(this);
