// kg_SlantBase.jsx
// SlantBase Null の回転角度を基準に U/V 方向でレイヤーを移動するスクリプト
// v1.1.0

(function SlantBasePanel(thisObj) {

    var SCRIPT_NAME = "kg SlantBase";
    var SCRIPT_VER  = "1.1.0";
    var NULL_PREFIX = "SlantBase";
    var EXPR_MARKER = "// kg_SlantBase";

    // ============================================================
    // ユーティリティ
    // ============================================================

    function getActiveComp() {
        var item = app.project.activeItem;
        return (item && item instanceof CompItem) ? item : null;
    }

    /** コンプ内から SlantBase* という名前のレイヤーを配列で返す */
    function findSlantBaseNull(comp) {
        var results = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var ly = comp.layer(i);
            if (ly.name.indexOf(NULL_PREFIX) === 0) {
                results.push(ly);
            }
        }
        return results;
    }

    /** 重複しない "SlantBase" / "SlantBase 2" / ... を生成 */
    function generateUniqueNullName(comp) {
        var base      = NULL_PREFIX;
        var candidate = base;
        var counter   = 1;
        var taken     = true;
        while (taken) {
            taken = false;
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).name === candidate) {
                    taken = true;
                    counter++;
                    candidate = base + " " + counter;
                    break;
                }
            }
        }
        return candidate;
    }

    /** position プロパティに kg_SlantBase マーカーが含まれているか */
    function hasSlantExpression(positionProp) {
        try {
            return positionProp.expressionEnabled
                && positionProp.expression.indexOf(EXPR_MARKER) !== -1;
        } catch (e) {
            return false;
        }
    }

    /**
     * SlantBase Null を特定して返す。
     * 0件 → alert して null を返す
     * 1件 → そのまま返す
     * 2件以上 → ピッカーダイアログで選択させて返す（キャンセルは null）
     */
    function resolveNullLayer(comp) {
        var candidates = findSlantBaseNull(comp);
        if (candidates.length === 0) {
            alert("SlantBase Null が見つかりません。\n先に「Create SlantBase Null」でヌルを作成してください。");
            return null;
        }
        if (candidates.length === 1) return candidates[0];

        var names = [];
        for (var n = 0; n < candidates.length; n++) names.push(candidates[n].name);
        var picker = new Window("dialog", "SlantBase Null を選択");
        picker.orientation   = "column";
        picker.alignChildren = ["fill", "top"];
        picker.margins       = 15;
        picker.add("statictext", undefined, "複数の SlantBase Null が見つかりました。使用するヌルを選択してください。");
        var dd = picker.add("dropdownlist", undefined, names);
        dd.selection = 0;
        var btnGrp = picker.add("group");
        btnGrp.alignment = ["center", "top"];
        btnGrp.add("button", undefined, "OK",         { name: "ok" });
        btnGrp.add("button", undefined, "キャンセル", { name: "cancel" });
        if (picker.show() !== 1) return null;
        return candidates[dd.selection.index];
    }

    /** エフェクト名でエフェクトを検索して返す (なければ null) */
    function findEffectByName(layer, name) {
        var fx = layer.property("ADBE Effect Parade");
        if (!fx) return null;
        for (var i = 1; i <= fx.numProperties; i++) {
            if (fx.property(i).name === name) return fx.property(i);
        }
        return null;
    }

    /** U/V オフセットを加算するエクスプレッション文字列 */
    function buildSlantExpression() {
        return [
            "// kg_SlantBase",
            "try {",
            "var nullLayer = thisComp.layer(effect(\"SlantBase Null\")(\"レイヤー\").index);",
            "var angle = nullLayer.rotation * Math.PI / 180;",
            "var u = effect(\"Slant U\")(\"スライダー\");",
            "var v = effect(\"Slant V\")(\"スライダー\");",
            "var uDir = [Math.cos(angle), Math.sin(angle)];",
            "var vDir = [-Math.sin(angle), Math.cos(angle)];",
            "[value[0] + uDir[0]*u + vDir[0]*v, value[1] + uDir[1]*u + vDir[1]*v]",
            "} catch(e) { value }"
        ].join("\n");
    }

    // ============================================================
    // コア処理
    // ============================================================

    function onCreateNull() {
        var comp = getActiveComp();
        if (!comp) {
            alert("アクティブなコンポジションを開いてください。");
            return;
        }
        app.beginUndoGroup("SlantBase: Create Null");
        try {
            var name = generateUniqueNullName(comp);
            var nl   = comp.layers.addNull();
            nl.name  = name;
            nl.label = 4; // シアン
            alert("\"" + name + "\" を作成しました。\n回転角度で U 方向を定義します。");
        } catch (e) {
            alert("ヌル作成中にエラーが発生しました:\n" + e.toString());
        }
        app.endUndoGroup();
    }

    function onAttach() {
        var comp = getActiveComp();
        if (!comp) {
            alert("アクティブなコンポジションを開いてください。");
            return;
        }
        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        var nullLayer = resolveNullLayer(comp);
        if (!nullLayer) return;

        attachLayers(comp, layers, nullLayer);
    }

    function onDelete() {
        var comp = getActiveComp();
        if (!comp) {
            alert("アクティブなコンポジションを開いてください。");
            return;
        }
        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }
        deleteLayers(comp, layers);
    }

    function onAlignRotation() {
        var comp = getActiveComp();
        if (!comp) {
            alert("アクティブなコンポジションを開いてください。");
            return;
        }
        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }
        var nullLayer = resolveNullLayer(comp);
        if (!nullLayer) return;
        alignRotation(comp, layers, nullLayer);
    }

    // ---- attachLayers ------------------------------------------

    function attachLayers(comp, layers, nullLayer) {
        app.beginUndoGroup("SlantBase: Attach");
        var errors = [];

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            try {
                // ── ガード ──────────────────────────────────────
                if (layer.index === nullLayer.index) continue;

                if (layer.threeDLayer) {
                    errors.push("「" + layer.name + "」は 3D レイヤーです。スキップします。");
                    continue;
                }

                var positionProp = layer.property("ADBE Transform Group")
                                        .property("ADBE Position");

                if (hasSlantExpression(positionProp)) {
                    errors.push("「" + layer.name + "」は既に Slant 式が適用されています。スキップします。");
                    continue;
                }

                // 既存の非 Slant エクスプレッションがある場合は確認
                if (positionProp.expressionEnabled && positionProp.expression !== "") {
                    var preview = positionProp.expression.substring(0, 60);
                    var dlg = new Window("dialog", "確認");
                    dlg.orientation  = "column";
                    dlg.alignChildren = ["fill", "top"];
                    dlg.margins      = 15;
                    dlg.add("statictext", undefined,
                        "「" + layer.name + "」の位置プロパティには\n既存のエクスプレッションがあります。\n上書きしますか?\n\n" + preview + "...");
                    var dBtns = dlg.add("group");
                    dBtns.alignment = ["center", "top"];
                    dBtns.add("button", undefined, "上書き",     { name: "ok" });
                    dBtns.add("button", undefined, "スキップ", { name: "cancel" });
                    if (dlg.show() !== 1) continue;
                }

                // ── Phase 1: エフェクト追加（addProperty 後に参照再取得） ──
                var layerIndex = layer.index;
                var fx = comp.layer(layerIndex).property("ADBE Effect Parade");

                // Slant U
                var uFx = fx.addProperty("ADBE Slider Control");
                uFx.name = "Slant U";
                layer = comp.layer(layerIndex);
                fx    = layer.property("ADBE Effect Parade");
                fx.property("Slant U").property("ADBE Slider Control-0001").setValue(0);

                // Slant V
                layer = comp.layer(layerIndex);
                fx    = layer.property("ADBE Effect Parade");
                var vFx = fx.addProperty("ADBE Slider Control");
                vFx.name = "Slant V";
                layer = comp.layer(layerIndex);
                fx    = layer.property("ADBE Effect Parade");
                fx.property("Slant V").property("ADBE Slider Control-0001").setValue(0);

                // SlantBase Null (Layer Control)
                layer = comp.layer(layerIndex);
                fx    = layer.property("ADBE Effect Parade");
                var nlFx = fx.addProperty("ADBE Layer Control");
                nlFx.name = "SlantBase Null";

                // ── Phase 2: Layer Control にヌルの index を設定 ──
                layer = comp.layer(layerIndex);
                fx    = layer.property("ADBE Effect Parade");
                fx.property("SlantBase Null")
                  .property("ADBE Layer Control-0001")
                  .setValue(nullLayer.index);

                // ── Phase 3: エクスプレッション適用 ──────────────
                layer        = comp.layer(layerIndex);
                positionProp = layer.property("ADBE Transform Group")
                                    .property("ADBE Position");

                if (positionProp.canSetExpression) {
                    positionProp.expression = buildSlantExpression();
                }

            } catch (e) {
                errors.push("「" + layer.name + "」の処理中にエラー: " + e.toString());
            }
        }

        app.endUndoGroup();
        if (errors.length > 0) {
            alert("処理結果:\n\n" + errors.join("\n"));
        }
    }

    // ---- deleteLayers ------------------------------------------

    function deleteLayers(comp, layers) {
        app.beginUndoGroup("SlantBase: Delete");
        var errors = [];
        var EFFECT_NAMES = ["Slant U", "Slant V", "SlantBase Null"];

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            try {
                var layerIndex = layer.index;

                // エクスプレッション削除
                var positionProp = layer.property("ADBE Transform Group")
                                        .property("ADBE Position");
                if (hasSlantExpression(positionProp)) {
                    positionProp.expression = "";
                }

                // エフェクト削除（2 パス: 対象 index 収集 → 逆順で削除）
                layer = comp.layer(layerIndex);
                var fx = layer.property("ADBE Effect Parade");

                var toRemoveIndices = [];
                for (var p = 1; p <= fx.numProperties; p++) {
                    var fxName = fx.property(p).name;
                    for (var k = 0; k < EFFECT_NAMES.length; k++) {
                        if (fxName === EFFECT_NAMES[k]) {
                            toRemoveIndices.push(p);
                            break;
                        }
                    }
                }

                // 逆順で削除（index ずれを防ぐ）
                for (var r = toRemoveIndices.length - 1; r >= 0; r--) {
                    layer = comp.layer(layerIndex);
                    fx    = layer.property("ADBE Effect Parade");
                    fx.property(toRemoveIndices[r]).remove();
                }

            } catch (e) {
                errors.push("「" + layer.name + "」の処理中にエラー: " + e.toString());
            }
        }

        app.endUndoGroup();
        if (errors.length > 0) {
            alert("処理結果:\n\n" + errors.join("\n"));
        }
    }

    // ---- alignRotation -----------------------------------------

    function alignRotation(comp, layers, nullLayer) {
        app.beginUndoGroup("SlantBase: Align Rotation");
        var errors = [];
        var time = comp.time;

        var nullRotation;
        try {
            nullRotation = nullLayer.property("ADBE Transform Group")
                                    .property("ADBE Rotate Z")
                                    .valueAtTime(time, false);
        } catch (e) {
            alert("SlantBase Null の回転角度を取得できませんでした:\n" + e.toString());
            app.endUndoGroup();
            return;
        }

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            try {
                if (layer.index === nullLayer.index) continue;
                if (layer.threeDLayer) {
                    errors.push("「" + layer.name + "」は 3D レイヤーです。スキップします。");
                    continue;
                }

                var rotProp = layer.property("ADBE Transform Group")
                                   .property("ADBE Rotate Z");

                if (rotProp.numKeys > 0) {
                    // キーフレームがある場合は現在時刻にキーを追加/上書き
                    rotProp.setValueAtTime(time, nullRotation);
                } else {
                    rotProp.setValue(nullRotation);
                }
            } catch (e) {
                errors.push("「" + layer.name + "」の処理中にエラー: " + e.toString());
            }
        }

        app.endUndoGroup();
        if (errors.length > 0) {
            alert("処理結果:\n\n" + errors.join("\n"));
        }
    }

    // ============================================================
    // UI
    // ============================================================

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, { resizable: true });

        pal.orientation  = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing      = 6;
        pal.margins      = [10, 10, 10, 10];

        // ヘッダー
        var header = pal.add("group");
        header.orientation = "row";
        header.alignChildren = ["left", "center"];
        header.add("statictext", undefined, SCRIPT_NAME);
        var verText = header.add("statictext", undefined, "v" + SCRIPT_VER);
        verText.alignment = ["right", "center"];

        // ---- Null セクション ----
        var nullPanel = pal.add("panel", undefined, "Null");
        nullPanel.alignChildren = ["fill", "top"];
        nullPanel.margins       = [10, 15, 10, 10];

        var createNullBtn = nullPanel.add("button", undefined, "Create SlantBase Null");
        createNullBtn.helpTip = "コンプに SlantBase Null を追加します。\n回転角度が U 方向を定義します。";

        // ---- Selected Layers セクション ----
        var layerPanel = pal.add("panel", undefined, "Selected Layers");
        layerPanel.alignChildren = ["fill", "top"];
        layerPanel.margins       = [10, 15, 10, 10];
        layerPanel.orientation   = "column";
        layerPanel.spacing       = 6;

        var btnGroup = layerPanel.add("group");
        btnGroup.orientation  = "row";
        btnGroup.alignChildren = ["fill", "center"];

        var attachBtn = btnGroup.add("button", undefined, "Attach");
        attachBtn.helpTip = "選択レイヤーに Slant U/V スライダーとエクスプレッションを適用します。";

        var deleteBtn = btnGroup.add("button", undefined, "Delete");
        deleteBtn.helpTip = "選択レイヤーから Slant エクスプレッションとエフェクトを削除します。";

        var alignRotBtn = layerPanel.add("button", undefined, "Align Rotation to Null");
        alignRotBtn.helpTip = "選択レイヤーの回転角度を SlantBase Null の現在の回転角度に合わせます。";

        // ヒントテキスト
        var hint = layerPanel.add("statictext", undefined,
            "Attach 後、エフェクトコントロールの\nSlant U/V スライダーで移動量を調整");
        hint.alignment = ["fill", "top"];

        // ---- ボタンハンドラー ----
        createNullBtn.onClick = function () { onCreateNull(); };
        attachBtn.onClick     = function () { onAttach(); };
        deleteBtn.onClick     = function () { onDelete(); };
        alignRotBtn.onClick   = function () { onAlignRotation(); };

        // リサイズ対応
        pal.onResizing = pal.onResize = function () { this.layout.resize(); };

        if (pal instanceof Window) {
            pal.layout.layout(true);
            pal.layout.resize();
        } else {
            pal.layout.layout(true);
        }

        return pal;
    }

    // ============================================================
    // エントリーポイント
    // ============================================================
    var myPal = buildUI(thisObj);
    if (myPal instanceof Window) {
        myPal.center();
        myPal.show();
    }

})(this);
